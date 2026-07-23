import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { findPlatform, PLATFORMS, SITE_URL } from "@/lib/seo-data";
import { ProgrammaticShell, ProgrammaticHero, BulletCard } from "@/components/ProgrammaticPage";

export const Route = createFileRoute("/plateformes/$slug")({
  loader: ({ params }) => {
    const platform = findPlatform(params.slug);
    if (!platform) throw notFound();
    return { platform };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.platform;
    if (!p) return {};
    const title = `${p.h1} — Orkestria`;
    const desc = `${p.intent}. Orkestria orchestre ${p.fullName} pour vous : créas, ciblage, budgets et alertes, sans jargon.`;
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { property: "og:title", content: title }, { property: "og:description", content: desc },
        { property: "og:url", content: `${SITE_URL}/plateformes/${p.slug}` }, { property: "og:type", content: "article" },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/plateformes/${p.slug}` }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org", "@type": "SoftwareApplication",
          name: `Orkestria pour ${p.name}`, applicationCategory: "BusinessApplication",
          operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description: desc,
        }),
      }],
    };
  },
  component: PlatformPage,
});

function PlatformPage() {
  const { platform: p } = Route.useLoaderData();
  const others = PLATFORMS.filter((x) => x.slug !== p.slug);
  return (
    <ProgrammaticShell>
      <ProgrammaticHero eyebrow={`Plateforme · ${p.name}`} h1={p.h1} lede={`${p.intent}. Vous décrivez votre objectif en français, Orkestria s'occupe de ${p.fullName}.`} />
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <BulletCard title={`Ce qu'Orkestria fait sur ${p.name}`} items={p.strengths} />
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-sora text-2xl font-semibold">Autres plateformes</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {others.map((o) => (
            <Link key={o.slug} to="/plateformes/$slug" params={{ slug: o.slug }} className="rounded-2xl border border-black/[0.06] bg-white p-5 hover:border-[#ff6c02]/40">
              <p className="font-sora font-semibold">{o.name}</p>
              <p className="mt-1 text-[13px] text-ink/60">{o.fullName}</p>
            </Link>
          ))}
        </div>
      </section>
    </ProgrammaticShell>
  );
}
