import nodemailer, { type Transporter } from 'nodemailer';
import { env } from './env';

/**
 * E-mail for password-reset codes. SMTP when SMTP_HOST is set (Gmail: smtp.gmail.com, port 465, the address and an
 * app password), else Resend's HTTP API when RESEND_API_KEY is set. Returns false when mail is off or sending fails.
 */
let smtp: Transporter | null = null;
const from = () => (env.SMTP_HOST && env.SMTP_USER && !process.env.MAIL_FROM ? `English Street <${env.SMTP_USER}>` : env.MAIL_FROM);

export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  try {
    if (env.SMTP_HOST) {
      smtp ??= nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined });
      await smtp.sendMail({ from: from(), to, subject, text, ...(html ? { html } : {}) });
      return true;
    }
    if (!env.RESEND_API_KEY) return false;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: from(), to: [to], subject, text, ...(html ? { html } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    return r.ok;
  } catch (e) {
    console.error('mail failed', (e as Error).message);
    return false;
  }
}
export const mailEnabled = () => !!(env.SMTP_HOST || env.RESEND_API_KEY);
