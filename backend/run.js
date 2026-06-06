import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account.json', 'utf8')
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function sendEmail({ to, subject, html, account }) {
  const transporter = nodemailer.createTransport({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: { user: account.username, pass: Buffer.from(account.password, 'base64').toString() },
  });
  try {
    await transporter.sendMail({
      from: `"${account.name}" <${account.username}>`, to, subject, html,
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function main() {
  console.log('🔍 Checking for pending campaigns...');
  const snap = await db.collection('campaigns').where('status', '==', 'sending').get();
  if (snap.empty) { console.log('✅ No pending campaigns.'); return; }

  for (const doc of snap.docs) {
    const campaign = { id: doc.id, ...doc.data() };
    console.log(`\n📨 Campaign: ${campaign.name}`);

    const [contactsSnap, accountsSnap] = await Promise.all([
      db.collection('contacts').where('listId', '==', campaign.listId || '_').get(),
      db.collection('smtpAccounts').get(),
    ]);
    const contacts = contactsSnap.docs.map(d => d.data());
    const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a.status === 'active' && campaign.smtpAccounts?.includes(a.id));

    if (accounts.length === 0) { console.log('❌ No active SMTP accounts'); continue; }

    const template = campaign.templateId
      ? (await db.collection('templates').doc(campaign.templateId).get()).data()
      : null;

    let index = 0;
    let sent = 0, failed = 0;

    for (const contact of contacts) {
      const account = accounts[index % accounts.length];
      index++;

      let html = campaign.customBody || template?.htmlBody || '';
      let subject = campaign.subject || template?.subject || '';
      html = html.replace(/{{name}}/g, contact.name).replace(/{{email}}/g, contact.email)
                 .replace(/{{company}}/g, contact.company).replace(/{{title}}/g, contact.title);
      subject = subject.replace(/{{name}}/g, contact.name).replace(/{{email}}/g, contact.email)
                       .replace(/{{company}}/g, contact.company).replace(/{{title}}/g, contact.title);

      const result = await sendEmail({ to: contact.email, subject, html, account });
      if (result.success) { sent++; } else { failed++; }

      await db.collection('emailLogs').add({
        campaignId: campaign.id, recipientEmail: contact.email,
        status: result.success ? 'sent' : 'failed',
        smtpAccount: account.username, timestamp: new Date().toISOString(),
        error: result.error || null,
      });

      if (result.success) {
        await db.collection('smtpAccounts').doc(account.id).update({
          sentToday: (account.sentToday || 0) + 1,
        });
      }

      process.stdout.write(`\r  📧 ${sent + failed}/${contacts.length} (Sent: ${sent}, Failed: ${failed})`);
      await new Promise(r => setTimeout(r, Math.max(100, 60000 / (campaign.ratePerMinute || 10))));
    }

    await db.collection('campaigns').doc(campaign.id).update({
      status: failed === 0 ? 'completed' : failed > 0 && sent > 0 ? 'completed' : 'failed',
      'stats.sent': sent, 'stats.failed': failed,
    });
    console.log(`\n✅ Campaign "${campaign.name}" done (${sent} sent, ${failed} failed)`);
  }
}

main().catch(console.error);
