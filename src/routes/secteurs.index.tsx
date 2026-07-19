import { createFileRoute, Link } from "@tanstack/react-router";
import { SECTORS, SITE_URL } from "@/lib/seo-data";
import { ProgrammaticShell, ProgrammaticHero } from "@/components/ProgrammaticPage";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/secteurs/")({
  head: () => ({
    meta: [
      { title: "Publicité IA par secteur — Orkestria" },
      { name: "description", content: "Orkestria pilote vos campagnes Meta, Google et TikTok selon les codes de votre secteur : restaurant, e-commerce, immobilier, coaching, SaaS et plus." },
      { property: "og:title", content: "Publicité IA par secteur — Orkestria" },
      { property: "og:description", content: "Un agent IA qui parle le langage de votre métier. 10 secteurs déjà couverts." },
      { property: "og:url", content: `${SITE_URL}/secteurs` },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/secteurs` }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Publicité IA par secteur",
        url: `${SITE_URL}/secteurs`,
        hasPart: SECTORS.map((s) => ({ "@type": "WebPage", name: s.h1, url: `${SITE_URL}/secteurs/${s.slug}` })),
      }),
    }],
  }),
  component: SectorsIndex,
});

function SectorsIndex() {
  return (
    <ProgrammaticShell>
      <ProgrammaticHero eyebrow="Secteurs" h1="Un agent qui connaît votre métier" lede="Orkestria adapte ses plans, ses créas et son ciblage aux codes de chaque secteur. Choisissez le vôtre pour voir un exemple concret." />
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SECTORS.map((s) => (
            <Link key={s.slug} to="/secteurs/$slug" params={{ slug: s.slug }} className="group rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm hover:border-[#ff6c02]/40">
              <h2 className="font-sora text-lg font-semibold">{s.name}</h2>
              <p className="mt-2 text-[14px] text-ink/70">Objectif type : {s.intent}.</p>
              <p className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-[#ff6c02]">Voir la page <ArrowRight className="h-3.5 w-3.5" /></p>
            </Link>
          ))}
        </div>
      </section>
    </ProgrammaticShell>
  );
}
