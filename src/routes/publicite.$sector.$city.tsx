import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { findSector, findCity, CITIES, SITE_URL } from "@/lib/seo-data";
import { ProgrammaticShell, ProgrammaticHero, BulletCard } from "@/components/ProgrammaticPage";

export const Route = createFileRoute("/publicite/$sector/$city")({
  loader: ({ params }) => {
    const sector = findSector(params.sector);
    const city = findCity(params.city);
    if (!sector || !city) throw notFound();
    return { sector, city };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { sector: s, city: c } = loaderData;
    const nameLower = s.name.toLowerCase();
    const title = `Publicité ${nameLower} à ${c.name} : ${s.intent} | Orkestria`;
    const desc = `Vous êtes ${nameLower} à ${c.name} (${c.region}) ? Orkestria cible localement pour ${s.intent}. ${c.angle}, on s'en occupe.`.slice(0, 158);
    const ogTitle = `${s.name} à ${c.name} — pub IA pilotée par un agent`;
    const ogDesc = `Ciblage ${c.name} et alentours, créas adaptées au marché ${c.country}, budget surveillé 24/7. Objectif : ${s.intent}.`;
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { name: "keywords", content: `publicité ${nameLower} ${c.name}, agence pub ${c.name}, marketing digital ${c.name}, meta ads ${c.name}, google ads ${c.name}` },
        { property: "og:title", content: ogTitle },
        { property: "og:description", content: ogDesc },
        { property: "og:url", content: `${SITE_URL}/publicite/${s.slug}/${c.slug}` }, { property: "og:type", content: "article" },
        { property: "og:locale", content: "fr_FR" },
        { name: "geo.placename", content: c.name },
        { name: "geo.region", content: c.country },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: ogTitle },
        { name: "twitter:description", content: ogDesc },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/publicite/${s.slug}/${c.slug}` }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org", "@type": "Service",
          name: `Publicité IA — ${s.name} à ${c.name}`,
          areaServed: { "@type": "City", name: c.name, containedInPlace: { "@type": "AdministrativeArea", name: c.region } },
          provider: { "@type": "Organization", name: "Orkestria", url: SITE_URL },
          serviceType: `Publicité en ligne — ${s.name}`,
          audience: { "@type": "BusinessAudience", audienceType: s.name },
          description: desc,
        }),
      }],
    };
  },
  component: CityPage,
});

function CityPage() {
  const { sector: s, city: c } = Route.useLoaderData();
  return (
    <ProgrammaticShell>
      <ProgrammaticHero
        eyebrow={`${s.name} · ${c.name}`}
        h1={`Publicité IA pour ${s.name.toLowerCase()} à ${c.name}`}
        lede={`Vous êtes ${s.name.toLowerCase()} à ${c.name} ? Orkestria cible localement, adapte les créas au marché de ${c.name} et pilote Meta, Google et TikTok pour ${s.intent}.`}
      />
      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-16 md:grid-cols-2">
        <BulletCard title={`Défis locaux à ${c.name}`} items={s.painPoints} />
        <BulletCard title="Ce qu'Orkestria fait pour vous" items={s.wins} />
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-sora text-2xl font-semibold">{s.name} dans d'autres villes</h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {CITIES.filter((x) => x.slug !== c.slug).map((x) => (
            <Link key={x.slug} to="/publicite/$sector/$city" params={{ sector: s.slug, city: x.slug }} className="rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] hover:border-[#ff6c02]/40">
              {s.name} à {x.name}
            </Link>
          ))}
        </div>
      </section>
    </ProgrammaticShell>
  );
}
