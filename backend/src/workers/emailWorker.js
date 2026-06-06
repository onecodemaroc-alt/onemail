import { db } from '../config/firebase.js';
import { sendEmail } from '../services/sender.js';
import { AccountRotator } from '../services/accountRotator.js';

export async function processCampaign(campaignId) {
  const campaignSnap = await db.collection('campaigns').doc(campaignId).get();
  if (!campaignSnap.exists) return;
  const campaign = campaignSnap.data();

  const templateSnap = campaign.templateId
    ? await db.collection('templates').doc(campaign.templateId).get()
    : null;
  const template = templateSnap?.data();

  const contactsSnap = campaign.listId
    ? await db.collection('contacts').where('listId', '==', campaign.listId).get()
    : await db.collection('contacts').get();
  const contacts = contactsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const accountsSnap = await db.collection('smtpAccounts').get();
  const accounts = accountsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((a) => a.status === 'active' && campaign.smtpAccounts?.includes(a.id));

  if (accounts.length === 0) return;

  const rotator = new AccountRotator(accounts);

  await db.collection('campaigns').doc(campaignId).update({ status: 'sending' });

  for (const contact of contacts) {
    const account = rotator.getNextAvailable();
    if (!account) {
      await db.collection('campaigns').doc(campaignId).update({ status: 'paused' });
      return;
    }

    let html = campaign.customBody || template?.htmlBody || '';
    html = html
      .replace(/{{name}}/g, contact.name || '')
      .replace(/{{email}}/g, contact.email || '')
      .replace(/{{company}}/g, contact.company || '')
      .replace(/{{title}}/g, contact.title || '');

    let subject = campaign.subject || template?.subject || '';
    subject = subject
      .replace(/{{name}}/g, contact.name || '')
      .replace(/{{email}}/g, contact.email || '')
      .replace(/{{company}}/g, contact.company || '')
      .replace(/{{title}}/g, contact.title || '');

    const result = await sendEmail({
      to: contact.email,
      subject,
      html,
      account,
      campaignId,
    });

    if (result.success) {
      rotator.incrementSent(account.username);
    }

    const accountRate = account.ratePerMinute || campaign.ratePerMinute || 10;
    const accountDelayMs = Math.max(100, Math.floor((60 * 1000) / accountRate));
    await new Promise((r) => setTimeout(r, accountDelayMs));
  }

  await db.collection('campaigns').doc(campaignId).update({ status: 'completed' });
}
