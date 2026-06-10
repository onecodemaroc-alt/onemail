import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account.json', 'utf8')
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  console.log('🔍 Checking for IMAP accounts...');
  const snap = await db.collection('smtpAccounts').where('status', '==', 'active').get();
  if (snap.empty) { console.log('✅ No active accounts.'); return; }

  for (const doc of snap.docs) {
    const acc = { id: doc.id, ...doc.data() };
    const imapHost = acc.imapHost || acc.host;
    const imapPort = acc.imapPort || (acc.secure ? 993 : 143);
    const password = Buffer.from(acc.password, 'base64').toString();

    console.log(`\n📬 Checking ${acc.username} (${imapHost}:${imapPort})...`);

    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: imapPort === 993,
      auth: { user: acc.username, pass: password },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const mails = [];
        for await (const msg of client.fetch({ seen: false }, { uid: true, envelope: true, bodyStructure: true, source: true })) {
          const parsed = await simpleParser(msg.source);
          const email = {
            smtpAccount: acc.name,
            smtpAccountId: acc.id,
            from: parsed.from?.text || '',
            to: Array.isArray(parsed.to) ? parsed.to.map(t => t.text).join(', ') : parsed.to?.text || '',
            subject: parsed.subject || '',
            textBody: parsed.text || '',
            htmlBody: parsed.html || '',
            date: parsed.date?.toISOString() || new Date().toISOString(),
            messageId: parsed.messageId || '',
            uid: msg.uid,
            read: false,
            fetchedAt: new Date().toISOString(),
          };

          // Avoid duplicates by messageId
          const existing = await db.collection('inbox')
            .where('messageId', '==', email.messageId)
            .where('smtpAccountId', '==', acc.id)
            .get();

          if (existing.empty) {
            await db.collection('inbox').add(email);
            mails.push(email.subject);
          }
        }
        if (mails.length > 0) {
          console.log(`  ✅ ${mails.length} new: ${mails.join(', ')}`);
        } else {
          console.log('  ℹ️ No new emails');
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err) {
      console.error(`  ❌ IMAP error for ${acc.username}:`, err.message);
    }
  }
  console.log('\n✅ Done checking inboxes');
}

main().catch(console.error);
