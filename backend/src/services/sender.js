import nodemailer from 'nodemailer';
import { db } from '../config/firebase.js';

function createTransport(account) {
  return nodemailer.createTransport({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: {
      user: account.username,
      pass: Buffer.from(account.password, 'base64').toString(),
    },
  });
}

export async function sendEmail({ to, subject, html, account, campaignId }) {
  const transporter = createTransport(account);

  try {
    const info = await transporter.sendMail({
      from: `"${account.name}" <${account.username}>`,
      to,
      subject,
      html,
    });

    await db.collection('emailLogs').add({
      recipientEmail: to,
      status: 'sent',
      smtpAccount: account.username,
      campaignId,
      timestamp: new Date().toISOString(),
    });

    await db.collection('smtpAccounts').doc(account.id).update({
      sentToday: admin.firestore.FieldValue.increment(1),
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    await db.collection('emailLogs').add({
      recipientEmail: to,
      status: 'failed',
      smtpAccount: account.username,
      campaignId,
      timestamp: new Date().toISOString(),
      error: error.message,
    });

    return { success: false, error: error.message };
  }
}

export async function testSmtpConnection({ host, port, secure, user, pass }) {
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  try {
    await transporter.verify();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
