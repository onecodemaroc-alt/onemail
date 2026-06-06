import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

initializeApp();
const db = getFirestore();

async function sendOne({ to, subject, html, account }) {
  const transporter = nodemailer.createTransport({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: {
      user: account.username,
      pass: Buffer.from(account.password, 'base64').toString(),
    },
  });
  await transporter.sendMail({
    from: `"${account.name}" <${account.username}>`,
    to, subject, html,
  });
}

export const onCampaignCreate = onDocumentWritten('campaigns/{campaignId}', async (event) => {
  const campaign = event.data?.after?.data();
  if (!campaign || campaign.status !== 'sending' || !campaign.smtpAccounts?.length) return;
  const campaignId = event.params.campaignId;

  const [contactsSnap, accountsSnap] = await Promise.all([
    db.collection('contacts').where('listId', '==', campaign.listId || '_').get(),
    db.collection('smtpAccounts').get(),
  ]);

  const contacts = contactsSnap.docs.map(d => d.data());
  const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.status === 'active' && campaign.smtpAccounts?.includes(a.id));

  if (!accounts.length) return;

  const template = campaign.templateId
    ? (await db.collection('templates').doc(campaign.templateId).get()).data()
    : null;

  let i = 0, sent = 0, failed = 0;
  for (const contact of contacts) {
    const acc = accounts[i % accounts.length];
    i++;

    let html = campaign.customBody || template?.htmlBody || '';
    let subject = campaign.subject || template?.subject || '';
    const vars = { name: contact.name || '', email: contact.email || '', company: contact.company || '', title: contact.title || '' };
    for (const [k, v] of Object.entries(vars)) {
      html = html.replaceAll(`{{${k}}}`, v);
      subject = subject.replaceAll(`{{${k}}}`, v);
    }

    try {
      await sendOne({ to: contact.email, subject, html, account: acc });
      sent++;
      await db.collection('smtpAccounts').doc(acc.id).update({ sentToday: (acc.sentToday || 0) + 1 });
    } catch (e) {
      failed++;
    }
    await db.collection('emailLogs').add({
      campaignId, recipientEmail: contact.email,
      status: failed ? 'failed' : 'sent',
      smtpAccount: acc.username,
      timestamp: new Date().toISOString(),
    });

    await new Promise(r => setTimeout(r, Math.max(100, 60000 / (campaign.ratePerMinute || 10))));
  }

  await db.collection('campaigns').doc(campaignId).update({
    status: 'completed', 'stats.sent': sent, 'stats.failed': failed,
  });
});
