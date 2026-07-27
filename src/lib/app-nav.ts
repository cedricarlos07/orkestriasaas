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

/** Primary nav — plain French for SME owners (no MCP / agent jargon). */
export const APP_NAV_GROUPS: NavGroup[] = [
  {
    title: "Mon espace",
    items: [
      { label: "Accueil", to: "/app", icon: Sun, desc: "Vue d'ensemble", kbd: "G" },
      { label: "Mes comptes", to: "/app/connections", icon: Cable, desc: "Comptes publicitaires liés", kbd: "N" },
      { label: "Campagnes", to: "/app/campaigns", icon: Rocket, desc: "Vos pubs Meta", kbd: "C" },
      { label: "Assistant", to: "/app/orkestria", icon: Sparkle, desc: "Posez vos questions pubs", kbd: "O" },
      { label: "Activité", to: "/app/runs", icon: Radio, desc: "Ce qui a été fait", kbd: "R" },
    ],
  },
  {
    title: "Résultats",
    items: [
      { label: "Bilan", to: "/app/audit", icon: Stethoscope, desc: "Ce qui marche, ce qui coûte" },
    ],
  },
  {
    title: "Compte",
    items: [
      { label: "Clés API", to: "/app/mcp", icon: Plug, desc: "Pour connecter un outil externe" },
      { label: "Paramètres", to: "/app/settings", icon: SlidersHorizontal, desc: "Entreprise et facturation" },
      { label: "À venir", to: "/app/roadmap", icon: Map, desc: "Prochaines fonctions", soon: true },
    ],
  },
];

export const APP_NAV: NavItem[] = APP_NAV_GROUPS.flatMap((g) => g.items);

/** Upcoming surfaces listed on /app/roadmap — not in primary nav. */
export const ROADMAP_ITEMS: { title: string; desc: string }[] = [
  { title: "Créations", desc: "Studio d’affiches, vidéos et textes publicitaires." },
  { title: "Automatisations", desc: "Règles qui protègent votre budget." },
  { title: "Leads & ventes", desc: "Prospects et suivi des commandes." },
  { title: "Rapports", desc: "Résumés hebdo / mensuel pour votre équipe." },
  { title: "Espace agence", desc: "Plusieurs clients dans un même compte." },
];
