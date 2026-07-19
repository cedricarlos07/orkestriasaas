import { createFileRoute } from "@tanstack/react-router";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { authClient } from "@/lib/auth-client";
import { getProfile } from "@/functions/profiles";
import { useQuery } from "@tanstack/react-query";
import { saveContactSubmission } from "@/lib/contact-store";
import { BrandLogo } from "@/components/BrandLogo";
import {
  ChevronDown,
  Menu as MenuIcon,
  Plus,
  Minus,
  Clock,
  Zap,
  MessageSquare,
  ShieldCheck,
  BarChart3,
  Bell,
  Star,
  ArrowRight,
  Paperclip,
  ArrowUp,
  Check,
  X,
  Utensils,
  ShoppingBag,
  Home,
  GraduationCap,
  Dumbbell,
  Briefcase,
  Lock,
  Eye,
  PauseCircle,
  Sparkles,
  Users,
} from "lucide-react";

import heroBg from "@/assets/sasonix/hero.png";
import brand1 from "@/assets/sasonix/brand-4fMdQURZjmnz4MzthqdHnuPRWG0.svg";
import brand2 from "@/assets/sasonix/brand-dB1PWeivPriYzrOzFLIvXFX8teA.svg";
import brand3 from "@/assets/sasonix/brand-BBHcSBIzrDnCWY3nrcCEMFlNg.svg";
import brand4 from "@/assets/sasonix/brand-fXSD7U4CaxyRwmfthhdwuDx34.svg";
import brand5 from "@/assets/sasonix/brand-Cyr4ejVuCu6sMy4Tw1NTCOXXudI.svg";
import brand6 from "@/assets/sasonix/brand-B7qzJGyQj1SZjhTd5E6Dy3p1Y.svg";
import brand7 from "@/assets/sasonix/brand-U4oVWdjoibvyyURcfoffO9SURfw.svg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Orkestria — Votre équipe publicitaire IA pour Meta, Google et TikTok" },
      {
        name: "description",
        content:
          "Décrivez votre objectif commercial. Orkestria lance, surveille et optimise vos campagnes Meta, Google et TikTok à partir d'une simple conversation.",
      },
      { property: "og:title", content: "Orkestria — Publicité IA pour Meta, Google et TikTok" },
      { property: "og:description", content: "Lancez, pilotez et optimisez vos campagnes publicitaires depuis une simple conversation." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://orkestria.one/" },
      { property: "og:locale", content: "fr_FR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "keywords", content: "publicité IA, Meta Ads, Google Ads, TikTok Ads, agent IA marketing, automatisation publicitaire, gestionnaire de pubs, campagnes automatisées, orkestria" },
    ],
    links: [{ rel: "canonical", href: "https://orkestria.one/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Orkestria",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: "Agent IA qui lance et pilote vos publicités Meta, Google et TikTok depuis une conversation.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
          aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", ratingCount: "127" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "Je n'y connais rien en pub, ça marche quand même ?", acceptedAnswer: { "@type": "Answer", text: "Oui. Vous dites ce que vous voulez vendre et à qui, Orkestria s'occupe des réglages compliqués." } },
            { "@type": "Question", name: "Sur quelles plateformes tournent mes pubs ?", acceptedAnswer: { "@type": "Answer", text: "Facebook, Instagram, Google et TikTok — pilotés depuis une seule conversation." } },
            { "@type": "Question", name: "Est-ce qu'Orkestria peut vider mon budget sans prévenir ?", acceptedAnswer: { "@type": "Answer", text: "Non. Rien ne bouge sans votre accord, vous fixez la limite et coupez tout en un clic." } },
            { "@type": "Question", name: "En combien de temps mes premières ventes ?", acceptedAnswer: { "@type": "Answer", text: "Votre campagne tourne en 15 minutes, les premières commandes tombent souvent en 24 à 48 h." } },
            { "@type": "Question", name: "Je gère une agence, c'est fait pour moi ?", acceptedAnswer: { "@type": "Answer", text: "Oui. Vous suivez tous vos clients au même endroit, sous votre marque." } },
          ],
        }),
      },
    ],
  }),
  component: Index,
});

const BRANDS = [brand1, brand2, brand3, brand4, brand5, brand6, brand7];

const BENEFITS = [
  { icon: MessageSquare, title: "Parlez, on s'occupe du reste", text: "Dites ce que vous voulez vendre. Orkestria lance vos pubs pendant que vous servez vos clients." },
  { icon: Zap, title: "Des ventes dès demain", text: "Pas de formation, pas d'agence à briefer. Votre première campagne tourne en 15 minutes." },
  { icon: BarChart3, title: "Vous savez ce qui rapporte", text: "Chaque franc dépensé est relié à une vraie commande. Fini les rapports gonflés." },
  { icon: ShieldCheck, title: "Zéro mauvaise surprise", text: "Aucune dépense sans votre feu vert. Vous gardez la main sur chaque euro." },
  { icon: Bell, title: "Un œil qui ne dort jamais", text: "On vous prévient avant que ça dérape. Adieu les budgets brûlés le week-end." },
  { icon: Clock, title: "Ça s'améliore tout seul", text: "L'agent apprend, ajuste et fait grimper vos résultats sans vous réveiller la nuit." },
];

const STEPS = [
  { key: "connect", title: "Branchez en 2 minutes", text: "Un clic pour connecter Meta, Google et TikTok. C'est tout ce qu'on vous demande." },
  { key: "goal", title: "Dites votre objectif", text: "« Je veux 100 commandes ce mois-ci. » L'agent comprend, calcule et vous propose un plan." },
  { key: "launch", title: "Validez, encaissez", text: "Vous cliquez « OK », les pubs partent. Vous suivez les ventes depuis votre téléphone." },
] as const;

const FAQ = [
  { q: "Je n'y connais rien en pub, ça marche quand même ?", a: "Oui, c'est justement fait pour ça. Vous dites ce que vous voulez vendre et à qui. Orkestria s'occupe des réglages compliqués à votre place." },
  { q: "Sur quoi mes pubs vont tourner ?", a: "Sur les plus grandes plateformes : Facebook, Instagram, Google et TikTok. Vos clients vous trouvent là où ils passent déjà leur temps." },
  { q: "Est-ce qu'Orkestria peut vider mon budget sans prévenir ?", a: "Jamais. Rien ne bouge sans votre accord. Vous fixez la limite, vous validez les changements importants, vous coupez tout en un clic." },
  { q: "En combien de temps je vois mes premières ventes ?", a: "Votre campagne peut tourner en 15 minutes. Les premières commandes tombent souvent dans les 24 à 48 heures." },
  { q: "Je gère une agence, c'est fait pour moi ?", a: "Oui. Vous suivez tous vos clients au même endroit, chacun avec son espace, ses règles et ses rapports automatiques. Sous votre marque." },
];

const COMPARE = {
  before: [
    "Vous passez vos soirées dans le Gestionnaire de pubs",
    "Vous payez une agence 800 €/mois sans savoir ce qu'elle fait",
    "Vos campagnes s'arrêtent le week-end faute de surveillance",
    "Vous ne savez pas quelle pub ramène vraiment des clients",
    "Chaque plateforme a son jargon, ses réglages, ses bugs",
  ],
  after: [
    "Vous parlez en français, l'agent fait le reste",
    "Un tarif clair, aucune commission cachée sur vos dépenses",
    "Un œil qui veille 24/7 et bloque les dérapages avant vous",
    "Chaque euro relié à une commande, en clair, sur votre téléphone",
    "Meta, Google et TikTok pilotés depuis une seule conversation",
  ],
};

const SECTORS = [
  { icon: Utensils, title: "Restaurants", text: "Remplissez vos tables les soirs creux et gagnez des livraisons régulières." },
  { icon: ShoppingBag, title: "Boutiques & e-commerce", text: "Écoulez vos stocks et faites revenir vos meilleurs clients." },
  { icon: Home, title: "Immobilier", text: "Trouvez des acheteurs qualifiés sans brûler votre budget en clics." },
  { icon: GraduationCap, title: "Coachs & formations", text: "Remplissez vos sessions et vos webinaires sans agence." },
  { icon: Dumbbell, title: "Salles de sport", text: "Attirez de nouveaux abonnés chaque semaine, en pilote automatique." },
  { icon: Briefcase, title: "Agences", text: "Gérez tous vos clients au même endroit, sous votre marque." },
];

const TRUST = [
  { icon: Lock, title: "Vos accès restent à vous", text: "Connexion via OAuth officiel Meta, Google et TikTok. Aucun mot de passe stocké." },
  { icon: Eye, title: "Chaque action est tracée", text: "Un journal complet répond à la question « qui a changé quoi et quand ? »." },
  { icon: PauseCircle, title: "Bouton stop, tout de suite", text: "Un clic met tout en pause. Rien ne repart sans votre feu vert." },
  { icon: ShieldCheck, title: "Données hébergées en Europe", text: "RGPD, chiffrement et sauvegardes quotidiennes de série." },
];

const PLANS = [
  {
    id: "solo",
    name: "Solo",
    price: "29 €",
    tag: "Pour démarrer",
    text: "Une entreprise, un objectif à la fois. Idéal pour vos 15 premières minutes.",
    features: ["1 marque connectée", "Meta + Google + TikTok", "Alertes budget & performance", "Assistance par email"],
    cta: "Commencer",
    kpis: [
      { label: "Marques", value: "1" },
      { label: "Automations", value: "Basiques" },
      { label: "Support", value: "48 h" },
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "89 €",
    tag: "Le plus choisi",
    text: "Pour les entrepreneurs qui veulent vendre à grande échelle sans embaucher.",
    features: ["Jusqu'à 5 marques", "Automations avancées", "Rapports hebdo par email", "Assistance prioritaire"],
    cta: "Commencer",
    kpis: [
      { label: "Marques", value: "5" },
      { label: "Automations", value: "Avancées" },
      { label: "Support", value: "4 h" },
    ],
  },
  {
    id: "agence",
    name: "Agence",
    price: "Sur devis",
    tag: "Marque blanche",
    text: "Un portail client sous votre marque, des rôles, des approbations, des rapports auto.",
    features: ["Clients illimités", "Portail marque blanche", "Rôles & approbations", "Manager dédié"],
    cta: "Parler à un humain",
    kpis: [
      { label: "Clients", value: "∞" },
      { label: "Automations", value: "Sur-mesure" },
      { label: "Support", value: "Dédié" },
    ],
  },
];

// ---------- Shared context helpers ----------

function useSmartCta() {
  const { data: session, isPending } = authClient.useSession();
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["landing-profile", session?.user?.id],
    queryFn: () => getProfile(),
    enabled: !!session?.user,
  });
  if (isPending || (session?.user && profileLoading)) return "/auth";
  if (!session) return "/auth";
  if (!profile) return "/setup";
  return "/app";
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Contact modal (used by "Parlez à un humain") ----------

type ContactPrefill = { topic?: string; message?: string; goal?: string; step?: string };
let contactOpener: ((p?: ContactPrefill) => void) | null = null;
function openContact(p?: ContactPrefill) {
  contactOpener?.(p);
}

function ContactModal() {
  const { data: session } = authClient.useSession();
  const { data: profile } = useQuery({
    queryKey: ["landing-profile", session?.user?.id],
    queryFn: () => getProfile(),
    enabled: !!session?.user,
  });
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("Question générale");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [ctx, setCtx] = useState<{ goal?: string; step?: string }>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    contactOpener = (p?: ContactPrefill) => {
      if (p?.topic) setTopic(p.topic);
      if (p?.message) setMessage(p.message);
      setCtx({ goal: p?.goal, step: p?.step });
      if (profile) setName(profile.company);
      if (session?.user?.email) setEmail(session.user.email);
      setSent(false);
      lastFocused.current = (document.activeElement as HTMLElement) ?? null;
      setOpen(true);
    };
    return () => {
      contactOpener = null;
    };
  }, [profile, session?.user?.email]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => closeBtnRef.current?.focus(), 0);
    } else {
      lastFocused.current?.focus?.();
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div ref={dialogRef} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="contact-title" className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff6c02]">Contact</p>
            <h2 id="contact-title" className="mt-1 font-display text-[22px] font-semibold text-ink">Parlez à un humain</h2>
          </div>
          <button ref={closeBtnRef} onClick={() => setOpen(false)} aria-label="Fermer la fenêtre de contact" className="rounded-full p-1.5 text-ink-soft hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/50">
            <X className="h-4 w-4" />
          </button>
        </div>
        {sent ? (
          <div role="status" aria-live="polite" className="mt-6 rounded-2xl bg-emerald-50 p-5 text-emerald-800 ring-1 ring-emerald-200">
            <p className="text-[14px] font-semibold">Message envoyé ✓</p>
            <p className="mt-1 text-[13px]">Un humain vous répond dans les 4 h ouvrées.</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveContactSubmission({
                topic,
                name,
                email,
                message,
                context: {
                  goal: ctx.goal,
                  step: ctx.step,
                  page: typeof window !== "undefined" ? window.location.pathname : undefined,
                  referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
                  userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
                  profileCompany: profile?.company,
                  profileRole: profile?.appRole,
                },
              });
              setSent(true);
              setTimeout(() => setOpen(false), 1400);
            }}
            className="mt-5 space-y-3"
          >
            {(ctx.goal || ctx.step) && (
              <div className="rounded-xl bg-[#fff7ee] px-3 py-2 text-[12px] text-[#a63d00] ring-1 ring-[#ff6c02]/20">
                <span className="font-semibold">Contexte transmis :</span>{" "}
                {[ctx.goal ? `objectif « ${ctx.goal} »` : null, ctx.step ? `étape « ${ctx.step} »` : null].filter(Boolean).join(" · ")}
              </div>
            )}
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink">Sujet</span>
              <select value={topic} onChange={(e) => setTopic(e.target.value)} className="block w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink focus:border-[#ff6c02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40">
                <option>Question générale</option>
                <option>Démo produit</option>
                <option>Plan Solo</option>
                <option>Plan Business</option>
                <option>Plan Agence</option>
                <option>Support</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-ink">Nom / entreprise</span>
                <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="block w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink focus:border-[#ff6c02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-ink">Email</span>
                <input required type="email" maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink focus:border-[#ff6c02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink">Message</span>
              <textarea required rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} className="block w-full resize-none rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] text-ink focus:border-[#ff6c02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/40" />
            </label>
            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={() => setOpen(false)} className="chip-ghost">Annuler</button>
              <button type="submit" className="btn-primary">Envoyer</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------- Smart CTA button ----------

function SmartCta({ children, variant = "primary", className = "" }: { children: React.ReactNode; variant?: "primary" | "dark"; className?: string }) {
  const to = useSmartCta();
  const cls = variant === "dark" ? "btn-dark" : "btn-primary";
  return (
    <Link to={to} className={`${cls} ${className}`.trim()}>
      {children}
    </Link>
  );
}

function Logo() {
  return (
    <BrandLogo className="h-8 w-auto" />
  );
}

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);
  const jump = (id: string) => { setMobileOpen(false); scrollToId(id); };
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-[15px] text-ink md:flex">
          <ProductMenu />
          <a href="#how" onClick={(e) => { e.preventDefault(); scrollToId("how"); }} className="hover:opacity-70">Comment ça marche</a>
          <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollToId("pricing"); }} className="hover:opacity-70">Tarifs</a>
          <a href="#faq" onClick={(e) => { e.preventDefault(); scrollToId("faq"); }} className="hover:opacity-70">FAQ</a>
          <button onClick={() => openContact()} className="hover:opacity-70">Contact</button>
        </nav>
        <div className="flex items-center gap-3 md:gap-4">
          <Link to="/auth" className="hidden text-[15px] text-ink hover:opacity-70 md:inline">Connexion</Link>
          <div className="hidden md:inline-flex">
            <SmartCta variant="dark">Créer un compte</SmartCta>
          </div>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-ink ring-1 ring-black/10 backdrop-blur md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
      {mobileOpen && <MobileMenu onClose={() => setMobileOpen(false)} onJump={jump} />}
    </header>
  );
}

const PRODUCT_GROUPS: { title: string; items: { icon: React.ElementType; label: string; desc: string; hash: string }[] }[] = [
  {
    title: "La plateforme",
    items: [
      { icon: MessageSquare, label: "Assistant de campagne", desc: "Décrivez un objectif en une phrase, l'agent propose ciblage, budget et créas — vous validez.", hash: "how" },
      { icon: BarChart3, label: "Allocateur multi-plateformes", desc: "Répartit votre budget entre Meta, Google Ads et TikTok Ads selon les conversions réelles.", hash: "features" },
      { icon: ShieldCheck, label: "Gardien de budget", desc: "Met en pause les pubs qui dérivent et redéploie le budget vers celles qui performent.", hash: "features" },
      { icon: Users, label: "Leads & ventes", desc: "Prospects unifiés (WhatsApp, Meta, Google, TikTok) avec scoring et suivi jusqu'à la vente.", hash: "features" },
    ],
  },
  {
    title: "Pour qui",
    items: [
      { icon: ShoppingBag, label: "Marques & e-commerce", desc: "ROAS, panier moyen et suivi des ventes reliés à vos campagnes.", hash: "sectors" },
      { icon: Briefcase, label: "Agences & médias", desc: "Portail multi-clients, rapports en marque blanche, approbations centralisées.", hash: "sectors" },
      { icon: Utensils, label: "Commerces locaux", desc: "Restaurants, salons, boutiques : ciblage géolocalisé et pics d'affluence pilotés.", hash: "sectors" },
      { icon: GraduationCap, label: "Services & formations", desc: "Coachs, écoles, SaaS : capture de leads qualifiés et relances automatisées.", hash: "sectors" },
    ],
  },
  {
    title: "Ressources",
    items: [
      { icon: Zap, label: "Comment ça marche", desc: "Connexion des comptes, objectif, validation, diffusion : le parcours en 4 étapes.", hash: "how" },
      { icon: Star, label: "Tarifs", desc: "Plans mensuels et annuels, formules dédiées pour les agences.", hash: "pricing" },
      { icon: Bell, label: "FAQ", desc: "Plateformes couvertes, contrôle humain, budgets minimum : les réponses claires.", hash: "faq" },
      { icon: Lock, label: "Sécurité & conformité", desc: "Hébergement UE, RGPD, chiffrement et journaux d'audit consultables.", hash: "security" },
    ],
  },
];

function MobileMenu({ onClose, onJump }: { onClose: () => void; onJump: (id: string) => void }) {
  const [openGroup, setOpenGroup] = useState<string | null>("Capacités");
  return (
    <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 top-0 max-h-[92vh] overflow-y-auto rounded-b-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4">
          <Logo />
          <button onClick={onClose} aria-label="Fermer le menu" className="grid h-10 w-10 place-items-center rounded-xl ring-1 ring-black/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 pb-6">
          {PRODUCT_GROUPS.map((g) => {
            const open = openGroup === g.title;
            return (
              <div key={g.title} className="border-t border-black/5">
                <button
                  className="flex w-full items-center justify-between px-2 py-4 text-left"
                  onClick={() => setOpenGroup(open ? null : g.title)}
                  aria-expanded={open}
                >
                  <span className="text-[15px] font-semibold text-ink">{g.title}</span>
                  <ChevronDown className={`h-5 w-5 text-ink/60 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <ul className="pb-3">
                    {g.items.map((it) => (
                      <li key={it.label}>
                        <a
                          href={`#${it.hash}`}
                          onClick={(e) => { e.preventDefault(); onJump(it.hash); }}
                          className="flex items-start gap-3 rounded-xl p-2 active:bg-[#fff3e8]"
                        >
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff6c02] to-[#ff8a3d] text-white">
                            <it.icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[14px] font-medium text-ink">{it.label}</span>
                            <span className="block text-[12px] leading-snug text-ink/60">{it.desc}</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          <div className="mt-4 border-t border-black/5 pt-4">
            <a href="#how" onClick={(e) => { e.preventDefault(); onJump("how"); }} className="block rounded-xl px-2 py-3 text-[15px] text-ink">Comment ça marche</a>
            <a href="#pricing" onClick={(e) => { e.preventDefault(); onJump("pricing"); }} className="block rounded-xl px-2 py-3 text-[15px] text-ink">Tarifs</a>
            <a href="#faq" onClick={(e) => { e.preventDefault(); onJump("faq"); }} className="block rounded-xl px-2 py-3 text-[15px] text-ink">FAQ</a>
            <button onClick={() => { onClose(); openContact(); }} className="block w-full rounded-xl px-2 py-3 text-left text-[15px] text-ink">Contact</button>
            <Link to="/auth" onClick={onClose} className="block rounded-xl px-2 py-3 text-[15px] text-ink">Connexion</Link>
          </div>

          <div className="mt-3 rounded-2xl bg-gradient-to-r from-[#fff3e8] to-white p-4 ring-1 ring-black/5">
            <div className="text-[14px] font-semibold text-ink">Essayez Orkestria gratuitement</div>
            <div className="text-[12px] text-ink/60">Configurez votre premier agent en quelques minutes.</div>
            <div className="mt-3">
              <SmartCta variant="primary" className="w-full justify-center">
                Commencer <ArrowRight className="ml-1 inline h-4 w-4" />
              </SmartCta>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductMenu() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => { if (timer.current) clearTimeout(timer.current); setOpen(true); };
  const hide = () => { timer.current = setTimeout(() => setOpen(false), 120); };

  const goto = (id: string) => { setOpen(false); scrollToId(id); };

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <button
        className="inline-flex items-center gap-1 hover:opacity-70"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Produit <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          className="absolute left-1/2 top-full z-30 mt-3 w-[min(880px,90vw)] -translate-x-1/2 rounded-2xl border border-black/5 bg-white/95 p-5 shadow-2xl ring-1 ring-black/5 backdrop-blur"
          role="menu"
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PRODUCT_GROUPS.map((g) => (
              <div key={g.title}>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink/50">{g.title}</div>
                <ul className="space-y-1">
                  {g.items.map((it) => (
                    <li key={it.label}>
                      <a
                        href={`#${it.hash}`}
                        onClick={(e) => { e.preventDefault(); goto(it.hash); }}
                        className="group flex w-full items-start gap-3 rounded-xl p-2 text-left hover:bg-[#fff3e8]"
                        role="menuitem"
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff6c02] to-[#ff8a3d] text-white shadow-sm">
                          <it.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[14px] font-medium text-ink">{it.label}</span>
                          <span className="block text-[12px] leading-snug text-ink/60">{it.desc}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between rounded-xl bg-gradient-to-r from-[#fff3e8] to-white p-4 ring-1 ring-black/5">
            <div>
              <div className="text-[14px] font-semibold text-ink">Essayez Orkestria gratuitement</div>
              <div className="text-[12px] text-ink/60">Configurez votre premier agent en quelques minutes.</div>
            </div>
            <SmartCta variant="primary" className="!px-4 !py-2 text-[13px]">
              Commencer <ArrowRight className="ml-1 inline h-4 w-4" />
            </SmartCta>
          </div>
        </div>
      )}
    </div>
  );
}

function Hero() {
  const navigate = useNavigate();
  const dest = useSmartCta();
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[820px] w-full">
        <img src={heroBg} alt="" className="h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white" />
      </div>

      <Header />

      <div className="mx-auto max-w-[1240px] px-6 pb-40 pt-32 text-center md:pt-36">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-[13px] text-ink shadow-sm ring-1 ring-black/5 backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-[#ff6c02]" />
          Nouveau · Votre publicité pilotée par une IA
        </div>

        <h1 className="mx-auto mt-6 max-w-5xl font-display text-[40px] font-semibold leading-[1.05] tracking-tight text-ink sm:text-[52px] md:text-[64px]">
          Plus de clients.<br />Sans y passer vos nuits.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-ink-soft md:text-[17px]">
          Dites simplement ce que vous voulez vendre. Orkestria lance vos publicités Facebook, Instagram, Google et TikTok, et vous ramène des commandes pendant que vous dormez.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); navigate({ to: dest }); }}
          className="mx-auto mt-10 max-w-3xl rounded-[28px] bg-white p-2.5 text-left shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)] ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-[#ff6c02]/40 transition"
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-5 top-[18px] h-5 w-[2px] animate-pulse rounded bg-[#ff6c02]" />
            <textarea
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
              className="block h-24 w-full resize-none rounded-2xl bg-white pl-10 pr-5 pt-4 text-[15px] leading-relaxed text-ink placeholder:text-ink/40 focus:outline-none"
              placeholder="Ex : je veux 100 nouvelles commandes ce mois-ci…"
            />
          </div>
          <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-1">
            <button type="button" className="chip-ghost">
              <Paperclip className="h-4 w-4" /> Ajouter une photo
            </button>
            <button type="submit" className="btn-primary">
              Trouver mes clients
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function BrandTicker() {
  const items = [...BRANDS, ...BRANDS];
  return (
    <section className="relative overflow-hidden border-y border-line/60 bg-white py-10">
      <div className="marquee flex w-max gap-16">
        {items.map((src, i) => (
          <img key={i} src={src} alt="" className="h-8 w-auto opacity-80" />
        ))}
      </div>
      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .marquee { animation: marquee 40s linear infinite; }
      `}</style>
    </section>
  );
}

function Intro() {
  return (
    <section className="mx-auto max-w-[1100px] px-6 py-28 text-center">
      <p className="font-display text-[32px] font-medium leading-tight tracking-tight text-ink md:text-[44px]">
        Vous êtes fait pour vendre, pas pour passer vos soirées à comprendre les paramètres Facebook. Orkestria s'en occupe et vous ramène des clients, en langage clair.
      </p>
    </section>
  );
}

function Features() {
  return (
    <section id="produit" className="mx-auto max-w-[1240px] px-6 pb-24">
      <div className="mb-12 max-w-2xl">
        <h2 className="font-display text-[40px] font-semibold leading-tight tracking-tight text-ink md:text-[52px]">
          Comme avoir un pro de la pub dans votre poche
        </h2>
        <p className="mt-4 text-[16px] text-ink-soft">
          Il crée vos pubs, choisit vos audiences, ajuste vos budgets et vous prévient dès qu'une action peut faire décoller vos ventes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-6">
        <div className="md:col-span-4 overflow-hidden rounded-3xl ring-1 ring-black/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_40px_-24px_rgba(20,20,20,0.18)] bg-[radial-gradient(120%_80%_at_0%_0%,rgba(255,140,60,0.10)_0%,rgba(255,140,60,0)_45%),linear-gradient(180deg,#fffaf3_0%,#f5efe4_100%)]">
          <div className="p-8">
            <p className="text-[13px] font-medium uppercase tracking-wider text-[#ff6c02]">Une stratégie sur-mesure</p>
            <h3 className="mt-2 font-display text-[26px] font-semibold text-ink">Vos clients trouvés là où ils sont</h3>
            <p className="mt-2 text-[14px] text-ink-soft">Orkestria repère qui achète, sur quel réseau, à quel moment.</p>
          </div>
          <MockupAudience />
        </div>

        <div className="md:col-span-2 overflow-hidden rounded-3xl ring-1 ring-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_48px_-24px_rgba(0,0,0,0.6)] bg-[radial-gradient(120%_90%_at_100%_0%,rgba(255,140,60,0.45)_0%,rgba(255,140,60,0)_55%),linear-gradient(180deg,#1a1a1a_0%,#0b0b0b_100%)] relative">
          <div className="p-8">
            <p className="text-[13px] font-medium uppercase tracking-wider text-[#ffb27a]">Votre argent protégé</p>
            <h3 className="mt-2 font-display text-[26px] font-semibold text-white">Alerté avant que ça coûte cher</h3>
          </div>
          <MockupGuardian />
        </div>

        <div className="md:col-span-3 overflow-hidden rounded-3xl ring-1 ring-black/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_40px_-24px_rgba(20,20,20,0.18)] bg-[radial-gradient(120%_80%_at_100%_100%,rgba(255,108,2,0.10)_0%,rgba(255,108,2,0)_50%),linear-gradient(180deg,#fdfaf4_0%,#f0e8d8_100%)]">
          <MockupBudget />
          <div className="p-8">
            <p className="text-[13px] font-medium uppercase tracking-wider text-[#ff6c02]">Le bon budget au bon endroit</p>
            <h3 className="mt-2 font-display text-[26px] font-semibold text-ink">Chaque euro va là où ça vend</h3>
          </div>
        </div>

        <div className="md:col-span-3 overflow-hidden rounded-3xl ring-1 ring-black/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_40px_-24px_rgba(20,20,20,0.18)] bg-[radial-gradient(120%_80%_at_0%_100%,rgba(16,185,129,0.10)_0%,rgba(16,185,129,0)_50%),linear-gradient(180deg,#f9fbf7_0%,#eef4ea_100%)]">
          <MockupSales />
          <div className="p-8">
            <p className="text-[13px] font-medium uppercase tracking-wider text-emerald-700">De vraies ventes</p>
            <h3 className="mt-2 font-display text-[26px] font-semibold text-ink">On compte les commandes, pas les clics</h3>
          </div>
        </div>
      </div>
    </section>
  );
}

function MockupAudience() {
  return (
    <div className="card-soft mx-6 mb-6 p-5">
      <div className="flex items-center justify-between text-[12px] text-ink-soft">
        <span className="font-medium text-ink">Audiences suggérées</span>
        <span className="chip-ghost !py-1 !px-2 !text-[11px]">Abidjan · 30 km</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { k: "Femmes 25–45", v: "42%" },
          { k: "Foodies", v: "23%" },
          { k: "Actifs midi", v: "18%" },
          { k: "Lookalike clients", v: "17%" },
        ].map((c) => (
          <span key={c.k} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#fff5ea] to-[#ffe6cf] px-3 py-1.5 text-[12px] font-medium text-[#a63d00] ring-1 ring-[#ff6c02]/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(166,61,0,0.08)]">
            {c.k} <span className="text-ink-soft">{c.v}</span>
          </span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { p: "Meta", v: 78, c: "#0866FF", logo: "https://cdn.simpleicons.org/meta/0866FF", bg: "#E7F0FF" },
          { p: "Google", v: 62, c: "#FBBC04", logo: "https://cdn.simpleicons.org/googleads/FBBC04", bg: "#FFF7DB" },
          { p: "TikTok", v: 44, c: "#111", logo: "https://cdn.simpleicons.org/tiktok/000000", bg: "#F1F1F1" },
        ].map((b) => (
          <div key={b.p} className="stat-card p-3">
            <div className="flex items-center gap-2 text-[11px] text-ink-soft">
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1 ring-black/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                style={{ background: b.bg }}
              >
                <img src={b.logo} alt={`${b.p} logo`} className="h-3 w-3 object-contain" loading="lazy" />
              </span>
              {b.p}
            </div>
            <div className="mt-1 text-[16px] font-semibold text-ink">{b.v}k</div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/5">
              <div className="h-full rounded-full" style={{ width: `${b.v}%`, background: b.c }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupGuardian() {
  return (
    <div className="card-ink mx-6 mb-6 p-5">
      <div className="flex items-center gap-2 text-[12px]">
        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[#ff6c02] shadow-[0_0_10px_rgba(255,108,2,0.9)]" />
        <span className="font-semibold text-white">Alerte budget</span>
      </div>
      <p className="mt-2 text-[13px] text-white/70">Meta — CPA en hausse de +38% ce matin.</p>
      <div className="mt-3 rounded-xl p-3 ring-1 ring-[#ff6c02]/30 bg-gradient-to-b from-[#2a1a10] to-[#1a0f08] shadow-[inset_0_1px_0_rgba(255,180,120,0.1)]">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[#ffb27a]">Suggestion</div>
        <div className="mt-1 text-[13px] text-white">Mettre en pause l'ad "Menu midi v2"</div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-primary !flex-1 !py-2 !text-[12px]">Approuver</button>
        <button type="button" className="chip-ghost !flex-1 !justify-center !py-2 !text-[12px] !bg-white/10 !text-white !border-white/15 hover:!bg-white/20 hover:!text-white">Ignorer</button>
      </div>
    </div>
  );
}

function MockupBudget() {
  const parts = [
    { p: "Meta", v: 45, c: "#0866FF", logo: "https://cdn.simpleicons.org/meta/0866FF", bg: "#E7F0FF" },
    { p: "Google", v: 35, c: "#FBBC04", logo: "https://cdn.simpleicons.org/googleads/FBBC04", bg: "#FFF7DB" },
    { p: "TikTok", v: 20, c: "#111", logo: "https://cdn.simpleicons.org/tiktok/000000", bg: "#F1F1F1" },
  ];
  return (
    <div className="card-soft mx-6 mt-6 p-5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink">Répartition budget</span>
        <span className="text-[12px] text-ink-soft">1 200 000 FCFA / mois</span>
      </div>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full ring-1 ring-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]">
        {parts.map((p) => (
          <div key={p.p} style={{ width: `${p.v}%`, background: `linear-gradient(180deg, ${p.c}, color-mix(in oklab, ${p.c} 78%, black))` }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {parts.map((p) => (
          <div key={p.p} className="stat-card p-3">
            <div className="flex items-center gap-2 text-[11px] text-ink-soft">
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1 ring-black/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                style={{ background: p.bg }}
              >
                <img src={p.logo} alt={`${p.p} logo`} className="h-3 w-3 object-contain" loading="lazy" />
              </span>
              {p.p}
            </div>
            <div className="mt-1 text-[15px] font-semibold text-ink">{p.v}%</div>
            <div className="text-[11px] text-emerald-600">ROAS 3.{p.v % 9}x</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupSales() {
  return (
    <div className="card-soft mx-6 mt-6 p-5">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[12px] text-ink-soft">Commandes ce mois</div>
          <div className="mt-1 font-display text-[32px] font-semibold text-ink">127</div>
        </div>
        <span className="rounded-full bg-gradient-to-b from-emerald-50 to-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">+23%</span>
      </div>
      <svg viewBox="0 0 300 70" className="mt-3 h-16 w-full">
        <defs>
          <linearGradient id="mkg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff6c02" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ff6c02" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,55 C40,45 60,25 100,30 C140,35 160,10 200,15 C240,20 270,8 300,12 L300,70 L0,70 Z" fill="url(#mkg)" />
        <path d="M0,55 C40,45 60,25 100,30 C140,35 160,10 200,15 C240,20 270,8 300,12" fill="none" stroke="#ff6c02" strokeWidth="2" />
      </svg>
      <div className="mt-3 space-y-1.5">
        {[
          { n: "Aïcha K.", a: "24 500" },
          { n: "Kouassi M.", a: "18 900" },
          { n: "Fatou D.", a: "32 000" },
        ].map((o) => (
          <div key={o.n} className="flex items-center justify-between rounded-lg bg-gradient-to-b from-white to-[#f7f4ef] px-3 py-2 text-[12px] ring-1 ring-black/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <span className="text-ink">{o.n}</span>
            <span className="font-semibold text-ink">{o.a} FCFA</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-[1240px] px-6 py-24">
      <div className="mb-12 max-w-2xl">
        <h2 className="font-display text-[40px] font-semibold leading-tight tracking-tight text-ink md:text-[52px]">
          Prêt à vendre en 15 minutes
        </h2>
        <p className="mt-4 text-[16px] text-ink-soft">
          Trois étapes, un café, et vos premières pubs tournent. Promis, personne ne vous parlera de « pixel » ni « d'audience lookalike ».
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.key} className="overflow-hidden rounded-3xl bg-surface-2 ring-1 ring-black/5">
            <div className="p-6">
              <StepVisual kind={s.key} />
            </div>
            <div className="px-8 pb-8">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#ff6c02] text-[13px] font-semibold text-white">
                {i + 1}
              </div>
              <h3 className="mt-4 font-display text-[22px] font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-[15px] text-ink-soft">{s.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StepVisual({ kind }: { kind: "connect" | "goal" | "launch" }) {
  if (kind === "connect") {
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
        <div className="text-[12px] font-medium text-ink">Connectez vos comptes</div>
        <div className="mt-3 space-y-2">
          {[
            { n: "Meta Business", logo: "https://cdn.simpleicons.org/meta/0866FF", bg: "#E7F0FF", s: "Connecté" },
            { n: "Google Ads", logo: "https://cdn.simpleicons.org/googleads/FBBC04", bg: "#FFF7DB", s: "Connecté" },
            { n: "TikTok Ads", logo: "https://cdn.simpleicons.org/tiktok/000000", bg: "#F1F1F1", s: "1 clic" },
          ].map((p) => (
            <div key={p.n} className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
              <div className="flex items-center gap-3">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ring-black/5"
                  style={{ background: p.bg }}
                >
                  <img src={p.logo} alt={`${p.n} logo`} className="h-5 w-5 object-contain" loading="lazy" />
                </span>
                <span className="text-[13px] font-medium text-ink">{p.n}</span>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">{p.s}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "goal") {
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
        <div className="rounded-xl bg-[#fff7ee] p-3 ring-1 ring-[#ff6c02]/20">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#a63d00]">Vous</div>
          <div className="mt-1 text-[13px] text-ink">« Je veux 100 commandes ce mois-ci. »</div>
        </div>
        <div className="mt-3 rounded-xl bg-ink p-3 text-white">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#ffb27a]">Orkestria</div>
          <div className="mt-1 text-[13px]">Plan proposé : 320k FCFA sur Meta + Google, ROAS visé 3.2×.</div>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-ink ring-1 ring-black/10">Meta 60%</span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-ink ring-1 ring-black/10">Google 40%</span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-ink ring-1 ring-black/10">30 jours</span>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink">Campagne prête</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
        </span>
      </div>
      <button className="mt-3 w-full rounded-xl bg-[#ff6c02] px-4 py-3 text-[13px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(255,108,2,0.6)]">Approuver & lancer</button>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-surface-2 p-2"><div className="text-[10px] text-ink-soft">Vues</div><div className="text-[13px] font-semibold text-ink">12.4k</div></div>
        <div className="rounded-lg bg-surface-2 p-2"><div className="text-[10px] text-ink-soft">Clics</div><div className="text-[13px] font-semibold text-ink">842</div></div>
        <div className="rounded-lg bg-surface-2 p-2"><div className="text-[10px] text-ink-soft">Ventes</div><div className="text-[13px] font-semibold text-emerald-600">27</div></div>
      </div>
    </div>
  );
}

function Testimonial() {
  return TestimonialInner();
}

function TestimonialVisual() {
  const photo = "/__l5e/assets-v1/2aaad3b9-5ced-4e6c-9219-e9765d18d18f/aicha-konate.png";
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-[#1a0f08] text-white ring-1 ring-black/10 sm:aspect-[3/4] md:aspect-auto md:min-h-[520px]">
      <img
        src={photo}
        alt="Aïcha Konaté, fondatrice d'une boutique de mode à Abidjan"
        className="absolute inset-0 h-full w-full object-cover object-[50%_20%] md:object-[50%_25%]"
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/5" />
      <div className="absolute inset-0 opacity-40 mix-blend-overlay" style={{ backgroundImage: "radial-gradient(circle at 15% 15%, rgba(255,170,90,0.55), transparent 45%), radial-gradient(circle at 85% 90%, rgba(0,0,0,0.5), transparent 45%)" }} />
      <div className="relative flex h-full min-h-[420px] flex-col justify-between gap-8 p-5 sm:p-6 md:p-8">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white/90 ring-1 ring-white/25 backdrop-blur">Cas client</span>
        </div>
        <div>
          <div className="mb-4">
            <div className="font-display text-[20px] font-semibold">Aïcha Konaté</div>
            <div className="text-[13px] text-white/80">Boutique de mode · Abidjan</div>
          </div>
          <div className="rounded-2xl bg-white/12 p-4 backdrop-blur ring-1 ring-white/20">
          <div className="text-[11px] font-medium uppercase tracking-wider text-white/80">Ce mois-ci</div>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <div className="font-display text-[36px] font-semibold">312</div>
              <div className="text-[12px] text-white/80">Commandes</div>
            </div>
            <div className="text-right">
              <div className="font-display text-[36px] font-semibold">4.1×</div>
              <div className="text-[12px] text-white/80">ROAS</div>
            </div>
          </div>
          <svg viewBox="0 0 200 40" className="mt-3 h-10 w-full">
            <path d="M0,32 C30,26 50,18 80,20 C110,22 130,8 160,10 C180,11 195,6 200,5" fill="none" stroke="white" strokeWidth="2" />
          </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function TestimonialInner() {
  return (
    <section id="cases" className="mx-auto max-w-[1240px] px-6 py-24">
      <div className="grid grid-cols-1 gap-10 rounded-3xl bg-surface-2 p-8 ring-1 ring-black/5 md:grid-cols-2 md:p-14">
        <TestimonialVisual />
        <div className="flex flex-col justify-between">
          <div>
            <p className="font-display text-[26px] font-medium leading-snug text-ink md:text-[32px]">
              « J'ai triplé mes ventes en deux mois. Le matin je dis à Orkestria ce que je veux, je pars servir mes clients, et le soir je vois les commandes tomber. »
            </p>
            <div className="mt-6">
              <p className="font-medium text-ink">Aïcha Konaté</p>
              <p className="text-[14px] text-ink-soft">Fondatrice, boutique de mode · Abidjan</p>
            </div>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-6">
            <div>
              <p className="font-display text-[44px] font-semibold text-[#ff6c02]">×3</p>
              <p className="text-[14px] text-ink-soft">De ventes en moyenne dès le 2e mois</p>
            </div>
            <div>
              <p className="font-display text-[44px] font-semibold text-[#ff6c02]">-40%</p>
              <p className="text-[14px] text-ink-soft">Coût par client vs. gestion à la main</p>
            </div>
          </div>
          <a href="#" className="mt-8 inline-flex items-center gap-2 text-[14px] font-medium text-ink hover:text-[#ff6c02]">
            Voir son histoire <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section className="mx-auto max-w-[1240px] px-6 py-24">
      <div className="mb-12 max-w-2xl">
        <h2 className="font-display text-[40px] font-semibold leading-tight tracking-tight text-ink md:text-[52px]">
          Fait pour vendre, tout simplement
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl bg-line/60 ring-1 ring-black/5 md:grid-cols-3">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="bg-white p-8">
            <Icon className="h-7 w-7 text-[#ff6c02]" strokeWidth={1.6} />
            <h3 className="mt-4 font-display text-[20px] font-semibold text-ink">{title}</h3>
            <p className="mt-2 text-[15px] text-ink-soft">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="mx-auto max-w-[1240px] px-6 py-24">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
        <div className="md:col-span-1">
          <h2 className="font-display text-[36px] font-semibold leading-tight tracking-tight text-ink md:text-[44px]">
            Des milliers d'entrepreneurs dorment mieux
          </h2>
          <p className="mt-4 text-[16px] text-ink-soft">
            Restaurants, boutiques, coachs, agences immobilières… Ils ont arrêté de bricoler leurs pubs et retrouvé du temps pour ce qu'ils aiment.
          </p>
        </div>
        <div className="rounded-3xl bg-surface-2 p-10 ring-1 ring-black/5">
          <p className="font-display text-[64px] font-semibold text-ink">24/7</p>
          <p className="mt-2 text-[15px] text-ink-soft">Vos campagnes sont pilotées en continu, même la nuit</p>
        </div>
        <div className="rounded-3xl bg-surface-2 p-10 ring-1 ring-black/5">
          <p className="font-display text-[64px] font-semibold text-ink">0 %</p>
          <p className="mt-2 text-[15px] text-ink-soft">Commission sur vos dépenses publicitaires — vous payez Orkestria, pas un pourcentage</p>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto max-w-[1240px] px-6 py-24">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
        <div>
          <h2 className="font-display text-[40px] font-semibold leading-tight tracking-tight text-ink md:text-[52px]">
            Vous hésitez encore ?
          </h2>
          <p className="mt-4 max-w-md text-[16px] text-ink-soft">
            On répond aux questions qu'on nous pose le plus souvent avant de démarrer.
          </p>
          <div className="mt-8 rounded-2xl bg-surface-2 p-6 ring-1 ring-black/5">
            <p className="text-[14px] text-ink-soft">Autre chose à savoir ?</p>
            <button
              type="button"
              onClick={() => openContact({ topic: "Question générale", step: "Avant démarrage", message: "Bonjour, j'aurais une question avant de démarrer :" })}
              className="mt-2 inline-flex items-center gap-2 font-medium text-ink hover:text-[#ff6c02]"
            >
              Parlez à un humain <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div role="region" aria-label="Questions fréquentes" className="space-y-3">
          {FAQ.map((f, i) => (
            <div key={i} className={"overflow-hidden rounded-2xl ring-1 transition " + (open === i ? "bg-white ring-[#ff6c02]/40 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.2)]" : "bg-surface-2 ring-black/5")}>
              <button
                id={`faq-btn-${i}`}
                aria-expanded={open === i}
                aria-controls={`faq-panel-${i}`}
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/50"
              >
                <span className="font-medium text-ink">{f.q}</span>
                <span className={"flex h-7 w-7 flex-none items-center justify-center rounded-full transition " + (open === i ? "bg-[#ff6c02] text-white rotate-180" : "bg-white text-ink ring-1 ring-black/5")}>
                  {open === i ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </span>
              </button>
              <div
                id={`faq-panel-${i}`}
                role="region"
                aria-labelledby={`faq-btn-${i}`}
                hidden={open !== i}
                className="px-6 pb-6 text-[15px] text-ink-soft"
              >
                {f.a}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => openContact({ topic: "Question générale", step: "FAQ", goal: f.q, message: `À propos de : « ${f.q} »\n\n` })}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-[#ff6c02] hover:underline"
                  >
                    Cette réponse ne suffit pas ? Parlez à un humain <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return <FinalCtaInner />;
}

function Compare() {
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const updateFromClient = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    setPos(p);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const x = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      updateFromClient(x);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [updateFromClient]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); setPos((p) => Math.max(0, p - 5)); }
    else if (e.key === "ArrowRight") { e.preventDefault(); setPos((p) => Math.min(100, p + 5)); }
    else if (e.key === "Home") { e.preventDefault(); setPos(0); }
    else if (e.key === "End") { e.preventDefault(); setPos(100); }
  };

  return (
    <section className="mx-auto max-w-[1240px] px-6 py-24">
      <div className="mb-10 max-w-2xl">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-[#ff6c02]">Avant / Après</p>
        <h2 className="mt-2 font-display text-[40px] font-semibold leading-tight tracking-tight text-ink md:text-[52px]">
          Glissez pour voir la différence
        </h2>
        <p className="mt-4 text-[16px] text-ink-soft">
          À gauche : gérer ses pubs seul. À droite : laisser Orkestria orchestrer. Faites glisser la poignée — ou utilisez les flèches du clavier.
        </p>
      </div>

      <div
        ref={wrapRef}
        className="relative select-none overflow-hidden rounded-3xl ring-1 ring-black/5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.25)]"
        style={{ touchAction: "none" }}
        onMouseDown={(e) => { dragging.current = true; updateFromClient(e.clientX); }}
        onTouchStart={(e) => { dragging.current = true; updateFromClient(e.touches[0].clientX); }}
      >
        {/* Base layer: AFTER (right side, dark) */}
        <div className="relative min-h-[380px] bg-ink p-6 text-white sm:p-10 md:min-h-[440px]">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#ff6c02]/25 blur-3xl" />
          <div className="relative flex items-start justify-end">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">
              <Sparkles className="h-3.5 w-3.5" /> Avec Orkestria
            </div>
          </div>
          <ul className="relative mt-6 space-y-4 sm:mt-8 md:max-w-[52%] md:ml-auto">
            {COMPARE.after.map((t) => (
              <li key={t} className="flex items-start gap-3 text-[14px] text-white/90 sm:text-[15px]">
                <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#ff6c02] text-white">
                  <Check className="h-3 w-3" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Overlay: BEFORE clipped to slider position */}
        <div
          aria-hidden
          className="absolute inset-0 bg-surface-2 p-6 text-ink sm:p-10"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <div className="flex items-start justify-start">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[12px] font-semibold uppercase tracking-wider text-ink-soft ring-1 ring-black/5">
              <X className="h-3.5 w-3.5 text-rose-500" /> Avant Orkestria
            </div>
          </div>
          <ul className="mt-6 space-y-4 sm:mt-8 md:max-w-[52%]">
            {COMPARE.before.map((t) => (
              <li key={t} className="flex items-start gap-3 text-[14px] text-ink-soft sm:text-[15px]">
                <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-rose-100 text-rose-500">
                  <X className="h-3 w-3" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Divider + Handle */}
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
          style={{ left: `${pos}%` }}
        />
        <button
          type="button"
          role="slider"
          aria-label="Comparateur Avant / Après"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          aria-valuetext={`${Math.round(pos)}% Avant, ${100 - Math.round(pos)}% Après`}
          tabIndex={0}
          onKeyDown={onKey}
          onMouseDown={(e) => { e.stopPropagation(); dragging.current = true; }}
          onTouchStart={(e) => { e.stopPropagation(); dragging.current = true; }}
          className="absolute top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-[0_8px_20px_-4px_rgba(0,0,0,0.35)] ring-2 ring-[#ff6c02] transition hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ff6c02]/40 cursor-ew-resize"
          style={{ left: `${pos}%` }}
        >
          <ArrowRight className="h-3.5 w-3.5 -translate-x-0.5 rotate-180" />
          <ArrowRight className="h-3.5 w-3.5 -translate-x-0.5" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between text-[12px] text-ink-soft">
        <span>← Avant</span>
        <span>Après →</span>
      </div>
    </section>
  );
}

function Sectors() {
  return (
    <section id="sectors" className="mx-auto max-w-[1240px] px-6 py-24 scroll-mt-24">
      <div className="mb-12 max-w-2xl">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-[#ff6c02]">Pour qui</p>
        <h2 className="mt-2 font-display text-[40px] font-semibold leading-tight tracking-tight text-ink md:text-[52px]">
          Quel que soit votre métier, on parle votre langue
        </h2>
        <p className="mt-4 text-[16px] text-ink-soft">
          Orkestria s'adapte à votre secteur : les mots, les objectifs, les canaux et les créations changent selon ce que vous vendez.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SECTORS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="group relative overflow-hidden rounded-3xl bg-surface-2 p-7 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.15)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#ff6c02] ring-1 ring-black/5">
              <Icon className="h-5 w-5" strokeWidth={1.7} />
            </div>
            <h3 className="mt-5 font-display text-[20px] font-semibold text-ink">{title}</h3>
            <p className="mt-2 text-[15px] text-ink-soft">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section id="security" className="mx-auto max-w-[1240px] px-6 py-24 scroll-mt-24">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wider text-[#ff6c02]">Sécurité</p>
          <h2 className="mt-2 font-display text-[36px] font-semibold leading-tight tracking-tight text-ink md:text-[44px]">
            Vos comptes pubs sont entre de bonnes mains
          </h2>
          <p className="mt-4 text-[16px] text-ink-soft">
            Vous restez propriétaire de tout : vos comptes, votre budget, vos données. Orkestria n'agit qu'avec vos règles et votre feu vert.
          </p>
        </div>
        <div className="md:col-span-2 grid grid-cols-1 gap-px overflow-hidden rounded-3xl bg-line/60 ring-1 ring-black/5 sm:grid-cols-2">
          {TRUST.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-white p-7">
              <Icon className="h-6 w-6 text-[#ff6c02]" strokeWidth={1.7} />
              <h3 className="mt-4 font-display text-[18px] font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-[14px] text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const [selected, setSelected] = useState<string>("business");
  return (
    <section id="pricing" className="mx-auto max-w-[1240px] px-6 py-24">
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-[#ff6c02]">Tarifs</p>
          <h2 className="mt-2 font-display text-[40px] font-semibold leading-tight tracking-tight text-ink md:text-[52px]">
            Un tarif clair. Zéro commission sur vos dépenses.
          </h2>
          <p className="mt-4 text-[16px] text-ink-soft">
            Vous payez Orkestria, pas un pourcentage de votre budget pub.
          </p>
        </div>
        <div role="tablist" aria-label="Choisir un plan" className="inline-flex items-center gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-black/5">
          {PLANS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={selected === p.id}
              onClick={() => setSelected(p.id)}
              className={
                "rounded-full px-4 py-2 text-[13px] font-medium transition " +
                (selected === p.id ? "bg-ink text-white shadow-sm" : "text-ink-soft hover:text-ink")
              }
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {PLANS.map((p) => {
          const isSelected = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              aria-pressed={isSelected}
              className={
                "group relative overflow-hidden rounded-3xl p-8 text-left transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6c02]/60 " +
                (isSelected
                  ? "-translate-y-1 bg-ink text-white shadow-[0_30px_60px_-25px_rgba(0,0,0,0.4)] ring-1 ring-black/10"
                  : "bg-surface-2 text-ink ring-1 ring-black/5 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-25px_rgba(0,0,0,0.25)]")
              }
            >
              {isSelected && (
                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#ff6c02]/30 blur-3xl" />
              )}
              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="font-display text-[22px] font-semibold">{p.name}</p>
                  <span
                    className={
                      isSelected
                        ? "rounded-full bg-[#ff6c02] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white"
                        : "rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-soft ring-1 ring-black/5"
                    }
                  >
                    {p.tag}
                  </span>
                </div>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-[44px] font-semibold">{p.price}</span>
                  {p.price !== "Sur devis" && (
                    <span className={isSelected ? "text-[13px] text-white/70" : "text-[13px] text-ink-soft"}>/mois</span>
                  )}
                </div>
                <p className={isSelected ? "mt-3 text-[14px] text-white/80" : "mt-3 text-[14px] text-ink-soft"}>{p.text}</p>
                <div className={"mt-5 grid grid-cols-3 gap-2 rounded-2xl p-3 " + (isSelected ? "bg-white/10" : "bg-white ring-1 ring-black/5")}>
                  {p.kpis.map((k) => (
                    <div key={k.label} className="text-center">
                      <p className={"font-display text-[15px] font-semibold " + (isSelected ? "text-white" : "text-ink")}>{k.value}</p>
                      <p className={"mt-0.5 text-[11px] uppercase tracking-wider " + (isSelected ? "text-white/60" : "text-ink-soft")}>{k.label}</p>
                    </div>
                  ))}
                </div>
                <ul className="mt-6 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[14px]">
                      <span className="mt-1 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[#ff6c02] text-white">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                {p.id === "agence" ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openContact({ topic: "Plan Agence", step: "Tarifs", goal: "Agence", message: "Bonjour, je souhaite en savoir plus sur le plan Agence." }); }}
                    className={(isSelected ? "btn-primary" : "btn-dark") + " mt-8 w-full justify-center"}
                  >
                    {p.cta}
                  </button>
                ) : (
                  <SmartCta variant={isSelected ? "primary" : "dark"} className="mt-8 w-full justify-center">
                    {p.cta}
                  </SmartCta>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FinalCtaInner() {
  return (
    <section id="contact" className="mx-auto max-w-[1240px] px-6 pb-24">
      <div
        className="relative overflow-hidden rounded-3xl px-8 py-20 text-center ring-1 ring-black/5 md:px-16 md:py-28"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-white/40" />
        <div className="relative">
          <h2 className="mx-auto max-w-3xl font-display text-[40px] font-semibold leading-tight tracking-tight text-ink md:text-[56px]">
            Vos prochains clients vous attendent
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] text-ink-soft">
            Lancez votre première campagne aujourd'hui. Sans carte bancaire, sans engagement, sans jargon.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <SmartCta variant="primary">Essayer gratuitement</SmartCta>
            <button type="button" onClick={() => openContact({ topic: "Démo produit", step: "Hero", message: "Bonjour, je souhaite voir une démo d'Orkestria." })} className="btn-dark">Voir une démo</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line/60 bg-white">
      <div className="mx-auto max-w-[1240px] px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <Logo />
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-ink-soft md:justify-end">
            <Link to="/privacy" className="hover:text-ink">Confidentialité</Link>
            <Link to="/terms" className="hover:text-ink">Conditions</Link>
            <Link to="/cookies" className="hover:text-ink">Cookies</Link>
            <Link to="/contact" className="hover:text-ink">Contact</Link>
            <a href="mailto:hello@orkestria.one" className="hover:text-ink">hello@orkestria.one</a>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-1 border-t border-line/60 pt-6 text-[12px] text-ink-soft md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Orkestria — Une plateforme éditée par KAMALOKA AI TECHNOLOGIES LLC.</p>
          <p className="text-ink-soft/80">Abidjan, Côte d'Ivoire · orkestria.one</p>
        </div>
      </div>
    </footer>
  );
}

function Index() {
  return (
    <main className="bg-white">
      <Hero />
      <BrandTicker />
      <Intro />
      <Features />
      <Compare />
      <HowItWorks />
      <Sectors />
      <Testimonial />
      <Benefits />
      <Trust />
      <Pricing />
      <Stats />
      <Faq />
      <FinalCta />
      <Footer />
      <ContactModal />
    </main>
  );
}
