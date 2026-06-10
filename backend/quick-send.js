const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const https = require('https');
const http = require('http');

const serviceAccount = require('./service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

function getTransporter(acc) {
  const pass = Buffer.from(acc.smtpPass, 'base64').toString();
  return nodemailer.createTransport({
    host: acc.smtpHost,
    port: Number(acc.smtpPort),
    secure: acc.smtpPort === '465' || acc.smtpPort === 465,
    auth: { user: acc.smtpUser, pass },
  });
}

async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function processQuickSends() {
  const snap = await db.collection('quickSends')
    .where('status', '==', 'pending')
    .limit(10)
    .get();

  if (snap.empty) {
    console.log('  ✅ No pending quick sends');
    return;
  }

  for (const doc of snap.docs) {
    const qs = { id: doc.id, ...doc.data() };

    await doc.ref.update({ status: 'processing', startedAt: new Date().toISOString() });

    try {
      const accSnap = await db.collection('smtpAccounts').doc(qs.smtpAccountId).get();
      if (!accSnap.exists) {
        await doc.ref.update({ status: 'failed', error: 'SMTP account not found' });
        continue;
      }
      const acc = accSnap.data();

      const emails = Array.isArray(qs.to) ? qs.to.filter(Boolean) : [];
      if (emails.length === 0) {
        await doc.ref.update({ status: 'failed', error: 'No valid recipients' });
        continue;
      }

      const attachments = [];
      if (qs.attachments && qs.attachments.length > 0) {
        for (const att of qs.attachments) {
          try {
            const content = await downloadFile(att.url);
            attachments.push({ filename: att.name, content });
          } catch (e) {
            console.log(`  ⚠️ Failed to download attachment ${att.name}: ${e.message}`);
          }
        }
      }

      const transporter = getTransporter(acc);
      let sent = 0, failed = 0;

      for (const email of emails) {
        try {
          await transporter.sendMail({
            from: `"${acc.name}" <${acc.smtpUser}>`,
            to: email,
            subject: qs.subject || '(no subject)',
            text: qs.body || '',
            attachments: attachments.length > 0 ? attachments : undefined,
          });
          sent++;
        } catch (e) {
          failed++;
        }
      }

      await doc.ref.update({
        status: 'completed',
        sent,
        failed,
        completedAt: new Date().toISOString(),
      });

      for (const email of emails) {
        await db.collection('emailLogs').add({
          campaignId: qs.id,
          campaignName: qs.subject || '(no subject)',
          recipient: email,
          smtpAccount: acc.name,
          status: 'sent',
          timestamp: new Date().toISOString(),
          error: '',
          isQuickSend: true,
        });
      }

      console.log(`  ✅ Sent "${qs.subject || '(no subject)'}" to ${sent} recipients (${failed} failed)`);
    } catch (err) {
      console.error(`  ❌ Error processing quick send ${qs.id}: ${err.message}`);
      await doc.ref.update({ status: 'failed', error: err.message });
    }
  }
}

processQuickSends()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
