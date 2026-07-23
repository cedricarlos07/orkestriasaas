import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MessageSquare, Phone, MapPin, Send, Check, Clock, ShieldCheck, CalendarDays, ArrowRight } from "lucide-react";
import { saveContactSubmission } from "@/lib/contact-store";
import { BookingModal } from "@/components/BookingModal";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Parlez à l'équipe Orkestria" },
      { name: "description", content: "Une question, une démo, un projet agence ? L'équipe Orkestria vous répond sous 24 h ouvrées." },
      { property: "og:title", content: "Contact — Orkestria" },
      { property: "og:description", content: "Écrivez-nous, prenez rendez-vous ou parlez directement à un humain de l'équipe Orkestria." },
    ],
  }),
  component: ContactPage,
});

const TOPICS = [
  "Découvrir Orkestria",
  "Démo produit",
  "Plan Agence",
  "Support technique",
  "Facturation",
  "Presse & partenariats",
];

function ContactPage() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !message) return;
    saveContactSubmission({
      topic,
      name,
      email,
      message,
      context: {
        page: "/contact",
        referrer: typeof document !== "undefined" ? document.referrer : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        profileCompany: company,
      },
    });
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-[#faf7f2] text-ink">
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 md:pt-16">
        <div className="max-w-2xl">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff6c02]">Contact</p>
          <h1 className="mt-2 font-sora text-4xl font-semibold tracking-tight md:text-5xl">On vous répond, vraiment.</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-ink/70">
            Une démo, un devis agence, une question précise sur vos campagnes&nbsp;? Écrivez-nous ci-dessous. Un membre de l'équipe Orkestria vous rappelle sous 24 heures ouvrées, en français, avec des réponses concrètes — pas un formulaire automatique.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[#ff6c02] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_10px_20px_-10px_rgba(255,108,2,0.6)] hover:brightness-110"
            >
              <CalendarDays className="h-4 w-4" /> Réserver une démo
            </button>
            <a href="#form" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink/70 hover:text-ink">
              Ou écrivez-nous <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div id="form" className="mt-12 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          {/* Form */}
          <div className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_40px_-30px_rgba(0,0,0,0.2)] md:p-8">
            {sent ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-[#ff6c02]/10 text-[#ff6c02]">
                  <Check className="h-7 w-7" />
                </div>
                <h2 className="mt-5 font-sora text-2xl font-semibold">Message reçu</h2>
                <p className="mt-2 max-w-sm text-[15px] text-ink/70">
                  Merci {name.split(" ")[0]}. Un membre de l'équipe vous répond sous 24 h ouvrées à <b>{email}</b>.
                </p>
                <div className="mt-6 flex gap-3">
                  <button onClick={() => { setSent(false); setMessage(""); }} className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Envoyer un autre message</button>
                  <Link to="/" className="rounded-full bg-[#ff6c02] px-5 py-2.5 text-sm font-medium text-white hover:brightness-110">Retour à l'accueil</Link>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label className="text-[13px] font-medium text-ink/80">Sujet</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TOPICS.map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setTopic(t)}
                        className={`rounded-full border px-3.5 py-1.5 text-[13px] transition ${
                          topic === t
                            ? "border-[#ff6c02] bg-[#ff6c02] text-white"
                            : "border-black/10 bg-white text-ink/70 hover:bg-black/[0.03]"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Votre nom" value={name} onChange={setName} placeholder="Marie Dupont" required />
                  <Field label="E-mail professionnel" value={email} onChange={setEmail} placeholder="marie@entreprise.com" type="email" required />
                </div>
                <Field label="Entreprise (optionnel)" value={company} onChange={setCompany} placeholder="Studio Velvet" />

                <div>
                  <label className="text-[13px] font-medium text-ink/80">Votre message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={6}
                    placeholder="Dites-nous en quelques mots ce que vous cherchez à faire..."
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-[#faf7f2]/50 px-4 py-3 text-[15px] outline-none placeholder:text-ink/40 focus:border-[#ff6c02] focus:bg-white"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <p className="text-[12px] text-ink/50">
                    En envoyant ce message, vous acceptez notre <Link to="/privacy" className="underline hover:text-ink">politique de confidentialité</Link>.
                  </p>
                  <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-[#ff6c02] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_10px_20px_-10px_rgba(255,108,2,0.6)] hover:brightness-110">
                    Envoyer le message <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Side info */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-black/[0.06] bg-gradient-to-br from-ink to-[#1a1a1a] p-5 text-white shadow-[0_20px_40px_-30px_rgba(0,0,0,0.6)]">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#ffb37a]">
                <CalendarDays className="h-4 w-4" /> Démo personnalisée
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-white/80">
                30 min avec un expert Orkestria pour cadrer vos objectifs et voir la plateforme sur vos cas réels.
              </p>
              <button
                type="button"
                onClick={() => setBookingOpen(true)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ff6c02] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
              >
                Choisir un créneau <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <InfoCard icon={<Mail className="h-5 w-5" />} title="E-mail" lines={["hello@orkestria.top", "Réponse sous 24 h ouvrées"]} />
            <InfoCard icon={<MessageSquare className="h-5 w-5" />} title="Chat produit" lines={["Depuis l'application", "Lundi → vendredi, 9 h – 19 h"]} />
            <InfoCard icon={<Phone className="h-5 w-5" />} title="Plan Agence & Entreprise" lines={["Rendez-vous téléphonique dédié", "Écrivez-nous pour planifier"]} />
            <InfoCard icon={<MapPin className="h-5 w-5" />} title="Éditeur" lines={["KAMALOKA AI TECHNOLOGIES LLC", "Dirigée par ALLE OSSEY ANGE CEDRIC", "Siège : Abidjan, Côte d'Ivoire"]} />

            <div className="rounded-2xl border border-black/[0.06] bg-gradient-to-br from-[#fff4ea] to-white p-5">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#ff6c02]">
                <Clock className="h-4 w-4" /> Temps de réponse moyen
              </div>
              <p className="mt-2 text-[15px] text-ink/80">
                <b>4 h 12 min</b> en semaine sur les 30 derniers jours.
              </p>
            </div>

            <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-ink/70">
                <ShieldCheck className="h-4 w-4 text-[#ff6c02]" /> Confidentialité
              </div>
              <p className="mt-2 text-[13px] text-ink/60">
                Vos messages sont stockés de façon sécurisée et utilisés uniquement pour vous répondre. Voir la <Link to="/privacy" className="underline hover:text-ink">politique de confidentialité</Link>.
              </p>
            </div>
          </aside>
        </div>

        {/* FAQ short */}
        <section className="mt-20">
          <h2 className="font-sora text-2xl font-semibold tracking-tight md:text-3xl">Avant de nous écrire</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <MiniFaq q="Puis-je essayer Orkestria gratuitement ?" a="Oui, vous pouvez créer un compte et configurer votre premier agent avant de choisir un plan." />
            <MiniFaq q="Combien de temps dure une démo ?" a="30 minutes en visio, avec un cas concret sur vos comptes ou un exemple équivalent." />
            <MiniFaq q="Travaillez-vous avec les agences ?" a="Oui, un plan Agence dédié permet de gérer plusieurs clients depuis un espace unique." />
          </div>
        </section>
      </main>
      <FooterMini />
      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} />
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-[13px] font-medium text-ink/80">{label}{required && <span className="text-[#ff6c02]"> *</span>}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-black/10 bg-[#faf7f2]/50 px-4 py-3 text-[15px] outline-none placeholder:text-ink/40 focus:border-[#ff6c02] focus:bg-white"
      />
    </div>
  );
}

function InfoCard({ icon, title, lines }: { icon: React.ReactNode; title: string; lines: string[] }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#ff6c02]/10 text-[#ff6c02]">{icon}</div>
        <div className="font-sora text-[15px] font-semibold">{title}</div>
      </div>
      <div className="mt-3 space-y-0.5 text-[14px] text-ink/70">
        {lines.map((l, i) => (
          <div key={i} className={i === 0 ? "text-ink" : ""}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function MiniFaq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
      <div className="font-sora text-[15px] font-semibold">{q}</div>
      <p className="mt-2 text-[14px] text-ink/70">{a}</p>
    </div>
  );
}

function TopBar() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <Link to="/" aria-label="Orkestria"><BrandLogo className="h-7 w-auto" /></Link>
      <Link to="/" className="text-sm text-ink/70 hover:text-ink">← Retour à l'accueil</Link>
    </header>
  );
}

function FooterMini() {
  return (
    <footer className="border-t border-black/[0.06] bg-white/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-ink/60">
        <span>© {new Date().getFullYear()} KAMALOKA AI TECHNOLOGIES LLC — Orkestria</span>
        <div className="flex gap-6">
          <Link to="/privacy" className="hover:text-ink">Confidentialité</Link>
          <Link to="/terms" className="hover:text-ink">Conditions</Link>
          <Link to="/cookies" className="hover:text-ink">Cookies</Link>
          <Link to="/contact" className="hover:text-ink">Contact</Link>
        </div>
      </div>
    </footer>
  );
}