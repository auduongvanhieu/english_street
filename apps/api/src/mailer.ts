import { env } from './env';

/** E-mail through Resend's HTTP API when RESEND_API_KEY is set; returns false when mail is off or fails. */
export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text, ...(html ? { html } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
export const mailEnabled = () => !!env.RESEND_API_KEY;
