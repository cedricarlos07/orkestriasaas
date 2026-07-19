import { createFileRoute } from "@tanstack/react-router";
import { Upload, Globe, Phone, MapPin, Image as ImageIcon, Palette } from "lucide-react";
import { StepHeader, inputCls } from "@/components/onboarding/StepHeader";
import { useOnboarding } from "@/lib/onboarding-store";

export const Route = createFileRoute("/onboarding/brand")({ component: Step });

function Step() {
  const { data, setField } = useOnboarding();
  const set = (k: keyof typeof data.brand, v: string) => setField("brand", { ...data.brand, [k]: v });

  return (
    <>
      <StepHeader eyebrow="Étape 5 · Marque" title="Importons votre marque" desc="Ces éléments serviront à créer automatiquement vos publicités. Vous pourrez tout modifier plus tard." />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="drop-zone">
          <span className="icon-relief relative z-10 mx-auto flex h-12 w-12"><ImageIcon className="h-5 w-5" /></span>
          <p className="relative z-10 mt-3 text-[14px] font-medium text-ink">Logo, photos et vidéos</p>
          <p className="relative z-10 mt-1 text-[13px] text-ink-soft">Glissez vos fichiers ici</p>
          <button className="btn-dark relative z-10 mt-4"><Upload className="h-4 w-4" /> Importer</button>
        </div>
        <div className="space-y-4">
          <Field label="Site web" icon={Globe} value={data.brand.site} onChange={(v) => set("site", v)} placeholder="https://votre-site.com" />
          <Field label="Numéro WhatsApp" icon={Phone} value={data.brand.whatsapp} onChange={(v) => set("whatsapp", v)} placeholder="+225 07 00 00 00 00" />
          <Field label="Adresse" icon={MapPin} value={data.brand.address} onChange={(v) => set("address", v)} placeholder="Cocody, Abidjan" />
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">Couleur principale</span>
            <div className="flex items-center gap-3">
              <input type="color" value={data.brand.colors} onChange={(e) => set("colors", e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-line" />
              <input className={inputCls} value={data.brand.colors} onChange={(e) => set("colors", e.target.value)} />
            </div>
          </label>
        </div>
      </div>
      <div className="hint-glass mt-6 flex items-center gap-3">
        <span className="icon-relief icon-relief-active h-8 w-8"><Palette className="h-4 w-4" /></span>
        <p className="text-[13px] text-ink">Nous pouvons détecter automatiquement vos informations depuis votre site — vous n'aurez qu'à confirmer.</p>
      </div>
    </>
  );
}

function Field({ label, icon: Icon, value, onChange, placeholder }: { label: string; icon: React.ComponentType<{ className?: string }>; value: string; onChange: (v: string) => void; placeholder?: string; }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <input className={inputCls + " pl-9"} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </label>
  );
}