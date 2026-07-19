import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { findSector, SECTORS, CITIES, SITE_URL } from "@/lib/seo-data";
import { ProgrammaticShell, ProgrammaticHero, BulletCard } from "@/components/ProgrammaticPage";

export const Route = createFileRoute("/secteurs/$slug")({
  loader: ({ params }) => {
    const sector = findSector(params.slug);
    if (!sector) throw notFound();
    return { sector };
  },
  head: ({ loaderData }) => {
    const s = loaderData?.sector;
    if (!s) return {};
    const nameLower = s.name.toLowerCase();
    const title = `Publicité IA ${nameLower} : ${s.intent} | Orkestria`;
    const desc = `Agent IA pour ${nameLower} : ${s.intent}. ${s.wins[0]}, ${s.wins[1].toLowerCase()}. Mix ${s.channelMix}, panier moyen ${s.avgTicket}.`.slice(0, 158);
    const ogTitle = `${s.h1} — ${s.channelMix}`;
    const ogDesc = `${s.intent.charAt(0).toUpperCase() + s.intent.slice(1)}. Orkestria pilote Meta, Google et TikTok pour ${nameLower} — sans jargon, sans configuration.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "keywords", content: `publicité ${nameLower}, marketing ${nameLower}, agence pub ${nameLower}, meta ads ${nameLower}, google ads ${nameLower}, tiktok ${nameLower}` },
        { property: "og:title", content: ogTitle },
        { property: "og:description", content: ogDesc },
        { property: "og:url", content: `${SITE_URL}/secteurs/${s.slug}` },
        { property: "og:type", content: "article" },
        { property: "og:locale", content: "fr_FR" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: ogTitle },
        { name: "twitter:description", content: ogDesc },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/secteurs/${s.slug}` }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org", "@type": "Service",
          name: s.h1, serviceType: `Publicité en ligne — ${s.name}`,
          provider: { "@type": "Organization", name: "Orkestria", url: SITE_URL },
          areaServed: "FR", description: desc,
        }),
      }],
    };
  },
  component: SectorPage,
  notFoundComponent: () => <div className="p-12 text-center">Secteur introuvable.</div>,
});

function SectorPage() {
  const { sector: s } = Route.useLoaderData();
  const related = SECTORS.filter((x) => x.slug !== s.slug).slice(0, 4);
  return (
    <ProgrammaticShell>
      <ProgrammaticHero
        eyebrow={`Secteur · ${s.name}`}
        h1={s.h1}
        lede={`Vous êtes ${s.name.toLowerCase()} ? Orkestria lance et pilote vos campagnes Meta, Google et TikTok pour ${s.intent}. Vous parlez en français, l'agent s'occupe des réglages.`}
      />
      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-8 md:grid-cols-2">
        <BulletCard title="Ce qui vous fait perdre du temps" items={s.painPoints} />
        <BulletCard title="Ce qu'Orkestria change dès la 1ʳᵉ semaine" items={s.wins} />
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm md:flex md:items-center md:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff6c02]">Repères</p>
            <p className="mt-2 text-[15px] text-ink/80">Panier moyen observé : <b>{s.avgTicket}</b> · Mix conseillé : <b>{s.channelMix}</b></p>
          </div>
          <Link to="/auth" className="mt-4 inline-flex rounded-full bg-[#ff6c02] px-5 py-2.5 text-sm font-semibold text-white md:mt-0">Lancer ma 1ʳᵉ campagne</Link>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="font-sora text-2xl font-semibold">{s.name} par ville</h2>
        <p className="mt-2 text-[14px] text-ink/70">Ciblage local activé automatiquement.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {CITIES.map((c) => (
            <Link key={c.slug} to="/publicite/$sector/$city" params={{ sector: s.slug, city: c.slug }} className="rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] hover:border-[#ff6c02]/40">
              {s.name} à {c.name}
            </Link>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-sora text-2xl font-semibold">Autres secteurs</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {related.map((r) => (
            <Link key={r.slug} to="/secteurs/$slug" params={{ slug: r.slug }} className="rounded-2xl border border-black/[0.06] bg-white p-5 text-[15px] font-semibold hover:border-[#ff6c02]/40">
              {r.name}
            </Link>
          ))}
        </div>
      </section>
    </ProgrammaticShell>
  );
}
