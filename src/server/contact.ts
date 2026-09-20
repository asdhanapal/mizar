/**
 * Contact form handler, shared by every host.
 * The form itself only uses web-standard APIs (fetch, Response). Mail goes out through SMTP (your own mailbox)
 * when SMTP_* is set, otherwise through Resend when RESEND_API_KEY is set.
 */

export interface MailEnv {
  /** SMTP (recommended for skandava.com: mail is sent as your own mailbox, so SPF and DMARC pass). */
  SMTP_HOST?: string;
  /** 465 (SSL, default) or 587 (STARTTLS). */
  SMTP_PORT?: string;
  /** The mailbox that sends, e.g. hariprasad@skandava.com. */
  SMTP_USER?: string;
  SMTP_PASS?: string;
  /** Alternative to SMTP. Only works if Resend's DKIM and SPF records are added for skandava.com. */
  RESEND_API_KEY?: string;
  /** Where messages are delivered. */
  CONTACT_TO?: string;
  /** Sender shown to you. With SMTP it must be the mailbox (or an alias of it). Defaults to SMTP_USER. */
  CONTACT_FROM?: string;
}

export const DEFAULT_TO = 'hariprasad@skandava.com';

interface Payload { name: string; email: string; phone: string; message: string }
interface Mail { from: string; to: string; replyTo: string; subject: string; text: string; html: string }

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const oneLine = (v: string) => v.replace(/[\r\n]+/g, ' ');
const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(raw: unknown): { ok: true; data: Payload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid request.' };
  const b = raw as Record<string, unknown>;
  const data: Payload = { name: clean(b.name, 100), email: clean(b.email, 200), phone: clean(b.phone, 40), message: clean(b.message, 5000) };
  if (data.name.length < 2) return { ok: false, error: 'Please enter your name.' };
  if (!EMAIL.test(data.email)) return { ok: false, error: 'Please enter a valid email address.' };
  if (data.message.length < 10) return { ok: false, error: 'Please tell us a little more (at least 10 characters).' };
  return { ok: true, data };
}

/** Sends through your own mailbox. The package is loaded only here, so hosts that never use SMTP do not need it. */
async function sendViaSmtp(env: MailEnv, mail: Mail) {
  const nodemailer = (await import('nodemailer')).default;
  const port = Number(env.SMTP_PORT) || 465;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
  await transport.sendMail(mail);
}

async function sendViaResend(env: MailEnv, mail: Mail) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: mail.from, to: [mail.to], reply_to: mail.replyTo, subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

export async function handleContact(request: Request, env: MailEnv): Promise<Response> {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });

  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'Invalid request.' }); }

  // Spam traps: bots fill the hidden field or submit instantly. Answer "ok" so they learn nothing.
  const trap = body as Record<string, unknown>;
  if (clean(trap?.website, 200) !== '' || (typeof trap?.t === 'number' && trap.t < 2500)) return json(200, { ok: true });

  const parsed = validate(body);
  if (!parsed.ok) return json(400, { ok: false, error: parsed.error });
  const { name, email, phone, message } = parsed.data;

  const useSmtp = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
  if (!useSmtp && !env.RESEND_API_KEY) {
    console.error('[contact] no mail provider configured: set SMTP_HOST, SMTP_USER and SMTP_PASS (or RESEND_API_KEY)');
    return json(500, { ok: false, error: 'Email is not configured yet.' });
  }

  const to = env.CONTACT_TO || DEFAULT_TO;
  const from = env.CONTACT_FROM || (useSmtp ? env.SMTP_USER! : 'Skandava Website <onboarding@resend.dev>');
  const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1d1d1f">
    <p><strong>New enquiry from the Skandava website</strong></p>
    <p><strong>Name:</strong> ${escapeHtml(name)}<br><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a><br><strong>Phone:</strong> ${escapeHtml(phone || '-')}</p>
    <p style="white-space:pre-wrap;border-left:3px solid #d2d2d7;padding-left:12px">${escapeHtml(message)}</p>
  </div>`;
  const mail: Mail = {
    from,
    to,
    replyTo: email,
    subject: `New enquiry from ${oneLine(name)}`,
    text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || '-'}\n\n${message}`,
    html,
  };

  try {
    await (useSmtp ? sendViaSmtp(env, mail) : sendViaResend(env, mail));
    return json(200, { ok: true });
  } catch (err) {
    console.error('[contact] send failed', err);
    return json(502, { ok: false, error: 'We could not send your message right now.' });
  }
}
