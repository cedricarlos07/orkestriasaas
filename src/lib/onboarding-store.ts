import { createContext, useContext } from "react";

export type OnboardingData = {
  account: {
    name: string;
    contact: string;
    password: string;
    country: string;
    language: string;
    currency: string;
  };
  pitch: string;
  sector: string | null;
  goal: string | null;
  platforms: string[];
  selectedAccounts: string[];
  brand: { site: string; whatsapp: string; address: string; colors: string };
  budget: string | null;
  control: string;
};

export const defaultData: OnboardingData = {
  account: {
    name: "",
    contact: "",
    password: "",
    country: "Côte d'Ivoire",
    language: "Français",
    currency: "USD",
  },
  pitch: "",
  sector: null,
  goal: null,
  platforms: [],
  selectedAccounts: ["acc-1"],
  brand: { site: "", whatsapp: "", address: "", colors: "#ff6c02" },
  budget: null,
  control: "assistant",
};

export const STEPS = [
  { slug: "business", label: "Activité", path: "/onboarding/business" },
  { slug: "goal", label: "Objectif", path: "/onboarding/goal" },
  { slug: "connect", label: "Connexions", path: "/onboarding/connect" },
  { slug: "accounts", label: "Comptes", path: "/onboarding/accounts" },
  { slug: "brand", label: "Marque", path: "/onboarding/brand" },
  { slug: "budget", label: "Budget", path: "/onboarding/budget" },
  { slug: "control", label: "Contrôle", path: "/onboarding/control" },
  { slug: "audit", label: "Audit", path: "/onboarding/audit" },
  { slug: "summary", label: "Résultat", path: "/onboarding/summary" },
] as const;

export type StepSlug = (typeof STEPS)[number]["slug"];

type Ctx = {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  setField: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
};

export const OnboardingCtx = createContext<Ctx | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingCtx);
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingCtx");
  return ctx;
}