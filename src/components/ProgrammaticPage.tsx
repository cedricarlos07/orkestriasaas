import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export function ProgrammaticShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf7f2] text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" aria-label="Orkestria"><BrandLogo className="h-7 w-auto" /></Link>
        <nav className="flex items-center gap-4 text-sm text-ink/70">
          <Link to="/secteurs" className="hover:text-ink">Secteurs</Link>
          <Link to="/plateformes" className="hover:text-ink">Plateformes</Link>
          <Link to="/contact" className="rounded-full bg-[#ff6c02] px-4 py-2 text-white hover:brightness-110">Essayer</Link>
        </nav>
      </header>
      {children}
      <footer className="border-t border-black/[0.06] bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 text-sm text-ink/60 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} KAMALOKA AI TECHNOLOGIES LLC — Orkestria</span>
          <div className="flex flex-wrap gap-6">
            <Link to="/privacy" className="hover:text-ink">Confidentialité</Link>
            <Link to="/terms" className="hover:text-ink">Conditions</Link>
            <Link to="/cookies" className="hover:text-ink">Cookies</Link>
            <Link to="/contact" className="hover:text-ink">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function ProgrammaticHero({ eyebrow, h1, lede, cta = "Lancer ma première campagne" }: { eyebrow: string; h1: string; lede: string; cta?: string }) {
  return (
    <section className="mx-auto max-w-4xl px-6 pt-12 pb-8 md:pt-20">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff6c02]">{eyebrow}</p>
      <h1 className="mt-3 font-sora text-4xl font-semibold tracking-tight md:text-5xl">{h1}</h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink/75">{lede}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/auth" className="inline-flex items-center gap-2 rounded-full bg-[#ff6c02] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_-10px_rgba(255,108,2,0.7)] hover:brightness-110">
          <Sparkles className="h-4 w-4" />{cta}
        </Link>
        <Link to="/contact" className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold hover:bg-black/[0.03]">
          Réserver une démo <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export function BulletCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm">
      <h3 className="font-sora text-lg font-semibold">{title}</h3>
      <ul className="mt-4 space-y-2">
        {items.map((it) => (
          <li key={it} className="flex gap-2 text-[15px] text-ink/80">
            <Check className="mt-0.5 h-4 w-4 flex-none text-[#ff6c02]" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
