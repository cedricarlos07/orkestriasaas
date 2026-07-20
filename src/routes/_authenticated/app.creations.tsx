import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Image as ImageIcon, Video, Upload, Wand2, Sparkles, Key } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/creations")({ component: Creations });

const FORMATS = ["1:1", "4:5", "9:16", "16:9"];

function Creations() {
  const [tab, setTab] = useState<"posters" | "videos">("posters");
  const [format, setFormat] = useState("9:16");

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white">
            <Wand2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Studio créatif</p>
            <h1 className="mt-0.5 font-display text-[26px] font-semibold text-ink">Créations</h1>
            <p className="text-[13px] text-ink-soft">Aucune création mock — branchez AdKit Studio ou une clé IA pour générer.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="chip-ghost" disabled title="Bientôt">
            <Upload className="h-4 w-4" /> Importer
          </button>
          <button type="button" className="btn-primary" disabled title="Bientôt">
            <Wand2 className="h-4 w-4" /> Générer
          </button>
        </div>
      </header>

      <div className="card-soft flex flex-wrap items-center gap-2 rounded-2xl p-2">
        <button type="button" onClick={() => setTab("posters")} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition ${tab === "posters" ? "bg-gradient-to-br from-ink to-ink/80 text-white" : "text-ink-soft hover:bg-white/70"}`}>
          <ImageIcon className="h-3.5 w-3.5" /> Affiches
        </button>
        <button type="button" onClick={() => setTab("videos")} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition ${tab === "videos" ? "bg-gradient-to-br from-ink to-ink/80 text-white" : "text-ink-soft hover:bg-white/70"}`}>
          <Video className="h-3.5 w-3.5" /> Vidéos
        </button>
        <span className="mx-2 h-5 w-px bg-line" />
        <span className="text-[12px] uppercase tracking-wider text-ink-soft">Format</span>
        {FORMATS.map((f) => (
          <button key={f} type="button" onClick={() => setFormat(f)} className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition ${format === f ? "bg-gradient-to-br from-[#fff1e2] to-[#ffe1c4] text-[#ff6c02] ring-1 ring-[#ff6c02]/30" : "text-ink-soft hover:bg-white/70"}`}>{f}</button>
        ))}
      </div>

      <section className="card-soft flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Sparkles className="h-10 w-10 text-ink-soft/40" />
        <p className="font-display text-[18px] font-semibold text-ink">Bibliothèque vide</p>
        <p className="max-w-md text-[14px] text-ink-soft">
          Format sélectionné : {format} ({tab === "posters" ? "affiches" : "vidéos"}). Aucune variante fictive affichée.
        </p>
        <button type="button" className="btn-primary mt-2" disabled>
          <Key className="h-4 w-4" /> Connecter une clé IA
        </button>
      </section>
    </div>
  );
}
