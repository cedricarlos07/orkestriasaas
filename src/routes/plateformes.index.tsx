import { createFileRoute, Link } from "@tanstack/react-router";
import { PLATFORMS, SITE_URL } from "@/lib/seo-data";
import { ProgrammaticShell, ProgrammaticHero } from "@/components/ProgrammaticPage";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/plateformes/")({
  head: () => ({
    meta: [
      { title: "Automatiser Meta, Google et TikTok Ads — Orkestria" },
      { name: "description", content: "Un seul agent IA pour piloter Meta Ads, Google Ads et TikTok Ads. Choisissez votre plateforme pour voir comment Orkestria s'y prend." },
      { property: "og:title", content: "Automatiser Meta, Google et TikTok Ads — Orkestria" },
      { property: "og:description", content: "Meta, Google, TikTok : un agent IA, une conversation, trois plateformes pilotées." },
      { property: "og:url", content: `${SITE_URL}/plateformes` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/plateformes` }],
  }),
  component: PlatformsIndex,
});

function PlatformsIndex() {
  return (
    <ProgrammaticShell>
      <ProgrammaticHero eyebrow="Plateformes" h1="Meta, Google, TikTok — un seul agent" lede="Orkestria orchestre les trois plus grandes régies publicitaires depuis une seule conversation." />
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {PLATFORMS.map((p) => (
            <Link key={p.slug} to="/plateformes/$slug" params={{ slug: p.slug }} className="group rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm hover:border-[#ff6c02]/40">
              <h2 className="font-sora text-lg font-semibold">{p.name}</h2>
              <p className="mt-2 text-[14px] text-ink/70">{p.fullName}</p>
              <p className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-[#ff6c02]">Voir la page <ArrowRight className="h-3.5 w-3.5" /></p>
            </Link>
          ))}
        </div>
      </section>
    </ProgrammaticShell>
  );
}
