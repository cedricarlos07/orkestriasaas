import type { LucideIcon } from "lucide-react";
import {
  Sun,
  Sparkle,
  Radio,
  Rocket,
  Stethoscope,
  Cable,
  SlidersHorizontal,
  Plug,
  Map,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  desc: string;
  kbd?: string;
  /** Surface not fully shipped — show Bientôt badge, still navigable */
  soon?: boolean;
};
export type NavGroup = { title: string; items: NavItem[] };

/** Primary nav — only shipped product surfaces (+ single Roadmap for bientôt). */
export const APP_NAV_GROUPS: NavGroup[] = [
  {
    title: "Pilotage",
    items: [
      { label: "Aujourd'hui", to: "/app", icon: Sun, desc: "Vue synthétique", kbd: "G" },
      { label: "Connexions", to: "/app/connections", icon: Cable, desc: "Comptes publicitaires", kbd: "N" },
      { label: "Campagnes", to: "/app/campaigns", icon: Rocket, desc: "Meta Ads", kbd: "C" },
      { label: "Orkestria", to: "/app/orkestria", icon: Sparkle, desc: "Conversation centrale", kbd: "O" },
      { label: "Agent Runs", to: "/app/runs", icon: Radio, desc: "Cycle d'exécution", kbd: "R" },
    ],
  },
  {
    title: "Performance",
    items: [
      { label: "Audit", to: "/app/audit", icon: Stethoscope, desc: "Analyse complète" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Orkestria MCP", to: "/app/mcp", icon: Plug, desc: "Clés API, policies, audit agents" },
      { label: "Paramètres", to: "/app/settings", icon: SlidersHorizontal, desc: "Entreprise, usage, facturation" },
      { label: "Roadmap", to: "/app/roadmap", icon: Map, desc: "Fonctions à venir", soon: true },
    ],
  },
];

export const APP_NAV: NavItem[] = APP_NAV_GROUPS.flatMap((g) => g.items);

/** Upcoming surfaces listed on /app/roadmap — not in primary nav. */
export const ROADMAP_ITEMS: { title: string; desc: string }[] = [
  { title: "Créations", desc: "Studio d’affiches, vidéos et textes publicitaires." },
  { title: "Automatisations", desc: "Règles Ads Guardian et autonomie avancée." },
  { title: "Leads & ventes", desc: "Prospects et suivi des commandes." },
  { title: "Rapports", desc: "Exports hebdo / mensuel pour vos clients." },
  { title: "Espace agence", desc: "Multi-clients et approbations croisées." },
];
