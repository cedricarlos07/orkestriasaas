import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Image as ImageIcon, Video, Upload, Wand2, Play, Download, Sparkles, Key } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/creations")({ component: Creations });

const FORMATS = ["1:1", "4:5", "9:16", "16:9"];

const VARIANT_GRADIENTS = [
  "from-[#ff6c02] via-[#ff8a3d] to-[#ffb04a]",
  "from-[#0f172a] via-[#1e293b] to-[#334155]",
  "from-[#065f46] via-[#10b981] to-[#6ee7b7]",
  "from-[#7c2d12] via-[#c2410c] to-[#fb923c]",
  "from-[#4c1d95] via-[#7c3aed] to-[#c4b5fd]",
  "from-[#0c4a6e] via-[#0284c7] to-[#7dd3fc]",
  "from-[#831843] via-[#db2777] to-[#f9a8d4]",
  "from-[#78350f] via-[#d97706] to-[#fcd34d]",
];

function Creations() {
  const [tab, setTab] = useState<"posters" | "videos">("posters");
  const [format, setFormat] = useState("9:16");

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white shadow-[0_10px_30px_-10px_rgba(255,108,2,0.6)]">
            <Wand2 className="h-5 w-5" />
            <span className="absolute inset-0 animate-ping rounded-2xl bg-[#ff6c02]/20" />
          </span>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Studio créatif</p>
            <h1 className="mt-0.5 font-display text-[26px] font-semibold text-ink">Créations</h1>
            <p className="text-[13px] text-ink-soft">Affiches et vidéos générées à partir de vos médias. Inclus dans votre abonnement.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="chip-ghost"><Upload className="h-4 w-4" /> Importer des médias</button>
          <button className="btn-primary btn-halo"><Wand2 className="h-4 w-4" /> Générer</button>
        </div>
      </header>

      <div className="card-soft flex flex-wrap items-center gap-2 rounded-2xl p-2">
        <button onClick={() => setTab("posters")} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition ${tab === "posters" ? "bg-gradient-to-br from-ink to-ink/80 text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.4)]" : "text-ink-soft hover:bg-white/70"}`}>
          <ImageIcon className="h-3.5 w-3.5" /> Affiches
        </button>
        <button onClick={() => setTab("videos")} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition ${tab === "videos" ? "bg-gradient-to-br from-ink to-ink/80 text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.4)]" : "text-ink-soft hover:bg-white/70"}`}>
          <Video className="h-3.5 w-3.5" /> Vidéos
        </button>
        <span className="mx-2 h-5 w-px bg-line" />
        <span className="text-[12px] uppercase tracking-wider text-ink-soft">Format</span>
        {FORMATS.map((f) => (
          <button key={f} onClick={() => setFormat(f)} className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition ${format === f ? "bg-gradient-to-br from-[#fff1e2] to-[#ffe1c4] text-[#ff6c02] ring-1 ring-[#ff6c02]/30 shadow-inner" : "text-ink-soft hover:bg-white/70"}`}>{f}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="group card-soft card-hover overflow-hidden rounded-2xl animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div className={`relative ${aspect(format)} bg-gradient-to-br ${VARIANT_GRADIENTS[i % VARIANT_GRADIENTS.length]}`}>
              <div className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.15 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")" }} />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <span className="absolute left-3 top-3 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white ring-1 ring-white/30 backdrop-blur">
                {format}
              </span>
              <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
                <p className="text-[10px] uppercase tracking-wider text-white/80">Menu du weekend</p>
                <p className="font-display text-[18px] font-semibold leading-tight drop-shadow">Livraison 30 min</p>
                <p className="mt-1 text-[10px] text-white/85">Dès 3 500 FCFA · Cocody</p>
              </div>
              {tab === "videos" && (
                <button aria-label="Lire" className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.4)] transition group-hover:opacity-100">
                  <Play className="h-4 w-4 text-ink" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between bg-gradient-to-br from-white to-[#fff6ec] px-3 py-2 text-[12px]">
              <span className="font-medium text-ink">Variante {i + 1}</span>
              <button className="chip-ghost !p-1.5" aria-label="Télécharger"><Download className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink via-[#141414] to-[#0b0b0b] p-6 text-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/5">
        <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-[#ff6c02]/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-[#ff8a3d]/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")" }} />
        <div className="relative flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white shadow-[0_8px_20px_-8px_rgba(255,108,2,0.6)]">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <p className="text-[12px] font-medium uppercase tracking-wider text-[#ff8a3d]">Génération IA premium</p>
        </div>
        <p className="relative mt-3 max-w-2xl text-[14px] leading-relaxed text-white/90">
          La génération d'images ou vidéos avec un modèle externe n'est pas incluse. Deux options : <b className="text-white">BYOK</b> (connectez votre clé API) ou <b className="text-white">paiement à l'usage</b> avant génération.
        </p>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <button className="btn-primary btn-halo !px-3.5 !py-2 !text-[12px]"><Key className="h-3.5 w-3.5" /> Connecter ma clé</button>
          <button className="rounded-full bg-white/10 px-3.5 py-2 text-[12px] font-medium text-white/90 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15">Voir la tarification</button>
        </div>
      </section>
    </div>
  );
}

function aspect(f: string) {
  return f === "1:1" ? "aspect-square" : f === "4:5" ? "aspect-[4/5]" : f === "9:16" ? "aspect-[9/16]" : "aspect-video";
}