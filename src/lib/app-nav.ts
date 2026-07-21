import type { LucideIcon } from "lucide-react";
import {
  Sun,
  Sparkle,
  Radio,
  Rocket,
  Wand2,
  ShieldCheck,
  Target,
  Stethoscope,
  LineChart,
  Briefcase,
  Cable,
  SlidersHorizontal,
  Plug,
} from "lucide-react";

export type NavItem = { label: string; to: string; icon: LucideIcon; desc: string; kbd?: string };
export type NavGroup = { title: string; items: NavItem[] };

export const APP_NAV_GROUPS: NavGroup[] = [
  {
    title: "Pilotage",
    items: [
      { label: "Aujourd'hui", to: "/app", icon: Sun, desc: "Vue synthétique", kbd: "G" },
      { label: "Orkestria", to: "/app/orkestria", icon: Sparkle, desc: "Conversation centrale", kbd: "O" },
      { label: "Agent Runs", to: "/app/runs", icon: Radio, desc: "Cycle d'exécution & streaming", kbd: "R" },
    ],
  },
  {
    title: "Diffusion",
    items: [
      { label: "Campagnes", to: "/app/campaigns", icon: Rocket, desc: "Meta · Google · TikTok", kbd: "C" },
      { label: "Créations", to: "/app/creations", icon: Wand2, desc: "Affiches, vidéos, textes" },
      { label: "Automatisations", to: "/app/automations", icon: ShieldCheck, desc: "Règles et Ads Guardian" },
    ],
  },
  {
    title: "Performance",
    items: [
      { label: "Leads & ventes", to: "/app/leads", icon: Target, desc: "Prospects et revenus" },
      { label: "Audit", to: "/app/audit", icon: Stethoscope, desc: "Analyse complète" },
      { label: "Rapports", to: "/app/reports", icon: LineChart, desc: "Hebdo, mensuel, client" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Agence", to: "/app/agency", icon: Briefcase, desc: "Clients et approbations" },
      { label: "Connexions", to: "/app/connections", icon: Cable, desc: "Comptes publicitaires" },
      { label: "Orkestria MCP", to: "/app/mcp", icon: Plug, desc: "Clés API, policies, audit agents" },
      { label: "Paramètres", to: "/app/settings", icon: SlidersHorizontal, desc: "Entreprise, équipe, facturation" },
    ],
  },
];

export const APP_NAV: NavItem[] = APP_NAV_GROUPS.flatMap((g) => g.items);