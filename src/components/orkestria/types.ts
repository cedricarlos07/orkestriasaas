export type ToolCall = {
  name: string;
  label: string;
  status: "running" | "done" | "error";
  detail?: string;
};

export type Msg = {
  id: string;
  role: "user" | "agent";
  text: string;
  tools?: ToolCall[];
  suggestions?: { label: string; value: string }[];
  createdAt: number;
};

export type Thread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Msg[];
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const WELCOME =
  "Bonjour. Je peux auditer vos pubs, faire un rapport, ou préparer une campagne Meta en pause. Par quoi on commence ?";

export function newThread(): Thread {
  return {
    id: uid(),
    title: "Nouvelle conversation",
    updatedAt: Date.now(),
    messages: [{ id: uid(), role: "agent", text: WELCOME, createdAt: Date.now() }],
  };
}

export type IntentKey = "audit" | "report" | "campaign";

export type FormState = {
  intent: IntentKey;
  scope: string;
  detail: string;
};

export type CampaignObjective = "traffic" | "leads" | "sales" | "whatsapp" | "messenger";

export type CampaignWizardState = {
  businessType: "saas" | "ecommerce" | "local" | "media" | "custom" | null;
  businessCustom: string;
  objective: CampaignObjective | null;
  countries: string[];
  /** country = tout le pays ; city = ville/quartier + rayon optionnel */
  geoScope: "country" | "city";
  /** Ville, quartier ou zone libre (ex. Cocody, Abidjan) */
  cityText: string;
  /** null = non précisé ; 0 = ville entière */
  radiusKm: number | null;
  dailyBudget: number | null;
  detail: string;
  images: { preview: string; dataUrl: string; name: string }[];
};
