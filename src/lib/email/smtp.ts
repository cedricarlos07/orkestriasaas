import nodemailer from "nodemailer";

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD?.trim());
}

export function isMailConfigured(): boolean {
  return smtpConfigured();
}

function fromAddress(): string {
  return (process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "hello@orkestria.top").trim();
}

/** Openship Mail (or any SMTP) — submission usually port 587 + STARTTLS. */
export async function sendMail(input: SendMailInput): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!smtpConfigured()) {
    console.warn("[mail] SMTP not configured — skipped:", input.subject);
    return { ok: false, reason: "SMTP not configured" };
  }

  const port = Number(process.env.SMTP_PORT ?? "587");
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!.trim(),
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASSWORD!.trim(),
    },
  });

  await transporter.sendMail({
    from: fromAddress(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text ?? input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    replyTo: input.replyTo ?? process.env.SMTP_REPLY_TO?.trim() ?? undefined,
  });

  return { ok: true };
}

export async function sendPasswordResetEmail(opts: { to: string; name?: string; url: string }) {
  const name = opts.name?.trim() || "bonjour";
  return sendMail({
    to: opts.to,
    subject: "Réinitialiser votre mot de passe — Orkestria",
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#141414">
        <p style="font-size:16px">Salut ${escapeHtml(name)},</p>
        <p style="font-size:15px;line-height:1.5;color:#444">
          Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe Orkestria.
          Ce lien expire bientôt.
        </p>
        <p style="margin:28px 0">
          <a href="${escapeAttr(opts.url)}"
             style="display:inline-block;background:#ff6c02;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p style="font-size:13px;color:#777;line-height:1.5">
          Si vous n'avez pas demandé cet e-mail, ignorez-le.<br/>
          Lien : <a href="${escapeAttr(opts.url)}" style="color:#ff6c02">${escapeHtml(opts.url)}</a>
        </p>
        <p style="font-size:12px;color:#999;margin-top:32px">Orkestria · hello@orkestria.top</p>
      </div>
    `,
  });
}

export async function sendContactNotifyEmail(opts: {
  topic: string;
  name: string;
  email: string;
  message: string;
}) {
  const to = (process.env.SMTP_NOTIFY_TO ?? process.env.SMTP_FROM ?? "hello@orkestria.top").trim();
  return sendMail({
    to,
    replyTo: opts.email,
    subject: `[Contact] ${opts.topic} — ${opts.name}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#141414">
        <p><b>Sujet :</b> ${escapeHtml(opts.topic)}</p>
        <p><b>De :</b> ${escapeHtml(opts.name)} &lt;${escapeHtml(opts.email)}&gt;</p>
        <pre style="white-space:pre-wrap;font-family:inherit;background:#f6f4ef;padding:16px;border-radius:12px">${escapeHtml(opts.message)}</pre>
      </div>
    `,
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
