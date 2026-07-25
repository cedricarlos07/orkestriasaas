/** Transactional email via Resend HTTP API (no SMTP). */

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type OtpMailType = "sign-in" | "email-verification" | "forget-password" | "change-email";

function resendApiKey(): string | null {
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  return key || null;
}

export function isMailConfigured(): boolean {
  return Boolean(resendApiKey());
}

function fromAddress(): string {
  return (
    process.env.RESEND_FROM?.trim() ||
    process.env.MAIL_FROM?.trim() ||
    "Orkestria <hello@orkestria.top>"
  );
}

function notifyTo(): string {
  return (
    process.env.RESEND_NOTIFY_TO?.trim() ||
    process.env.MAIL_NOTIFY_TO?.trim() ||
    "hello@orkestria.top"
  );
}

function replyToDefault(): string | undefined {
  return process.env.RESEND_REPLY_TO?.trim() || process.env.MAIL_REPLY_TO?.trim() || undefined;
}

function shell(opts: { title: string; bodyHtml: string; footer?: string }) {
  const footer = opts.footer ?? "Orkestria · hello@orkestria.top";
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#141414">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#ff6c02;font-weight:600">Orkestria</p>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;line-height:1.25">${opts.title}</h1>
      ${opts.bodyHtml}
      <p style="font-size:12px;color:#999;margin-top:32px">${footer}</p>
    </div>
  `;
}

export async function sendMail(input: SendMailInput): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = resendApiKey();
  if (!apiKey) {
    console.warn("[mail] RESEND_API_KEY missing — skipped:", input.subject);
    return { ok: false, reason: "RESEND_API_KEY not configured" };
  }

  const text =
    input.text ?? input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const replyTo = input.replyTo ?? replyToDefault();

  const payload: Record<string, unknown> = {
    from: fromAddress(),
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text,
  };
  if (replyTo) payload.reply_to = replyTo;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[mail] Resend error:", res.status, body.slice(0, 400));
      return { ok: false, reason: `Resend ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[mail] Resend request failed:", err);
    return { ok: false, reason: err instanceof Error ? err.message : "Resend request failed" };
  }
}

export async function sendPasswordResetEmail(opts: { to: string; name?: string; url: string }) {
  const name = opts.name?.trim() || "bonjour";
  return sendMail({
    to: opts.to,
    subject: "Réinitialiser votre mot de passe — Orkestria",
    html: shell({
      title: "Nouveau mot de passe",
      bodyHtml: `
        <p style="font-size:15px;line-height:1.5;color:#444">Salut ${escapeHtml(name)},</p>
        <p style="font-size:15px;line-height:1.5;color:#444">
          Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire bientôt.
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
      `,
    }),
  });
}

export async function sendVerificationLinkEmail(opts: { to: string; name?: string; url: string }) {
  const name = opts.name?.trim() || "bonjour";
  return sendMail({
    to: opts.to,
    subject: "Confirmez votre e-mail — Orkestria",
    html: shell({
      title: "Confirmez votre e-mail",
      bodyHtml: `
        <p style="font-size:15px;line-height:1.5;color:#444">Salut ${escapeHtml(name)},</p>
        <p style="font-size:15px;line-height:1.5;color:#444">
          Une dernière étape : confirmez votre adresse pour activer votre espace Orkestria.
        </p>
        <p style="margin:28px 0">
          <a href="${escapeAttr(opts.url)}"
             style="display:inline-block;background:#ff6c02;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">
            Vérifier mon e-mail
          </a>
        </p>
      `,
    }),
  });
}

export async function sendOtpEmail(opts: { to: string; otp: string; type: OtpMailType }) {
  const copy: Record<OtpMailType, { subject: string; title: string; blurb: string }> = {
    "email-verification": {
      subject: "Votre code de vérification — Orkestria",
      title: "Code de vérification",
      blurb: "Entrez ce code pour confirmer votre adresse e-mail.",
    },
    "sign-in": {
      subject: "Votre code de connexion — Orkestria",
      title: "Code de connexion",
      blurb: "Entrez ce code pour vous connecter à Orkestria.",
    },
    "forget-password": {
      subject: "Code de réinitialisation — Orkestria",
      title: "Réinitialisation",
      blurb: "Entrez ce code pour définir un nouveau mot de passe.",
    },
    "change-email": {
      subject: "Confirmez le changement d'e-mail — Orkestria",
      title: "Changement d'e-mail",
      blurb: "Entrez ce code pour confirmer votre nouvelle adresse.",
    },
  };
  const c = copy[opts.type];
  return sendMail({
    to: opts.to,
    subject: c.subject,
    html: shell({
      title: c.title,
      bodyHtml: `
        <p style="font-size:15px;line-height:1.5;color:#444">${escapeHtml(c.blurb)}</p>
        <p style="margin:28px 0;text-align:center">
          <span style="display:inline-block;letter-spacing:0.35em;font-size:32px;font-weight:700;background:#f6f4ef;padding:14px 22px;border-radius:12px">${escapeHtml(opts.otp)}</span>
        </p>
        <p style="font-size:13px;color:#777;line-height:1.5">
          Le code expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.
        </p>
      `,
    }),
  });
}

export async function sendContactNotifyEmail(opts: {
  topic: string;
  name: string;
  email: string;
  message: string;
}) {
  return sendMail({
    to: notifyTo(),
    replyTo: opts.email,
    subject: `[Contact] ${opts.topic} — ${opts.name}`,
    html: shell({
      title: "Nouveau message contact",
      bodyHtml: `
        <p><b>Sujet :</b> ${escapeHtml(opts.topic)}</p>
        <p><b>De :</b> ${escapeHtml(opts.name)} &lt;${escapeHtml(opts.email)}&gt;</p>
        <pre style="white-space:pre-wrap;font-family:inherit;background:#f6f4ef;padding:16px;border-radius:12px">${escapeHtml(opts.message)}</pre>
      `,
    }),
  });
}

export async function sendBookingConfirmationEmail(opts: {
  to: string;
  name: string;
  topic: string;
  startIso: string;
  endIso: string;
  company?: string | null;
}) {
  const when = formatRange(opts.startIso, opts.endIso);
  return sendMail({
    to: opts.to,
    subject: `Rendez-vous confirmé — ${opts.topic}`,
    html: shell({
      title: "Rendez-vous confirmé",
      bodyHtml: `
        <p style="font-size:15px;line-height:1.5;color:#444">Salut ${escapeHtml(opts.name)},</p>
        <p style="font-size:15px;line-height:1.5;color:#444">
          Votre créneau Orkestria est bien réservé.
        </p>
        <div style="background:#f6f4ef;border-radius:12px;padding:16px;margin:20px 0;font-size:14px;line-height:1.6">
          <p style="margin:0"><b>Sujet :</b> ${escapeHtml(opts.topic)}</p>
          <p style="margin:8px 0 0"><b>Quand :</b> ${escapeHtml(when)}</p>
          ${opts.company ? `<p style="margin:8px 0 0"><b>Société :</b> ${escapeHtml(opts.company)}</p>` : ""}
        </div>
        <p style="font-size:13px;color:#777">Un membre de l'équipe vous recontactera si besoin. À bientôt !</p>
      `,
    }),
  });
}

export async function sendBookingNotifyEmail(opts: {
  name: string;
  email: string;
  topic: string;
  startIso: string;
  endIso: string;
  company?: string | null;
  message?: string | null;
}) {
  const when = formatRange(opts.startIso, opts.endIso);
  return sendMail({
    to: notifyTo(),
    replyTo: opts.email,
    subject: `[Booking] ${opts.topic} — ${opts.name}`,
    html: shell({
      title: "Nouveau rendez-vous",
      bodyHtml: `
        <p><b>De :</b> ${escapeHtml(opts.name)} &lt;${escapeHtml(opts.email)}&gt;</p>
        <p><b>Sujet :</b> ${escapeHtml(opts.topic)}</p>
        <p><b>Quand :</b> ${escapeHtml(when)}</p>
        ${opts.company ? `<p><b>Société :</b> ${escapeHtml(opts.company)}</p>` : ""}
        ${opts.message ? `<pre style="white-space:pre-wrap;font-family:inherit;background:#f6f4ef;padding:16px;border-radius:12px">${escapeHtml(opts.message)}</pre>` : ""}
      `,
    }),
  });
}

export async function sendNotificationEmail(opts: {
  to: string;
  title: string;
  body: string;
}) {
  return sendMail({
    to: opts.to,
    subject: `${opts.title} — Orkestria`,
    html: shell({
      title: escapeHtml(opts.title),
      bodyHtml: `
        <p style="font-size:15px;line-height:1.6;color:#444;white-space:pre-wrap">${escapeHtml(opts.body)}</p>
        <p style="margin:28px 0">
          <a href="https://orkestria.top/app"
             style="display:inline-block;background:#ff6c02;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">
            Ouvrir Orkestria
          </a>
        </p>
      `,
    }),
  });
}

function formatRange(startIso: string, endIso: string) {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const fmt = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Africa/Abidjan",
    });
    const endTime = new Intl.DateTimeFormat("fr-FR", {
      timeStyle: "short",
      timeZone: "Africa/Abidjan",
    }).format(end);
    return `${fmt.format(start)} → ${endTime}`;
  } catch {
    return `${startIso} → ${endIso}`;
  }
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
