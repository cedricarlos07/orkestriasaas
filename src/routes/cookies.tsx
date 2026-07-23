import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { openCookieSettings } from "../components/CookieBanner";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Politique cookies — Orkestria" },
      { name: "description", content: "Quels cookies Orkestria utilise, pourquoi, combien de temps et comment gérer vos préférences." },
      { property: "og:title", content: "Politique cookies — Orkestria" },
      { property: "og:description", content: "Détails sur les cookies utilisés par Orkestria et vos choix de consentement." },
      { property: "og:url", content: "/cookies" },
    ],
    links: [{ rel: "canonical", href: "/cookies" }],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <div className="min-h-screen bg-[#faf7f2] text-ink">
      <TopBar />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 md:pt-24">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff6c02]">Politique cookies</p>
        <h1 className="mt-2 font-sora text-4xl font-semibold tracking-tight md:text-5xl">Cookies : ce qu'on dépose, et pourquoi</h1>
        <p className="mt-4 text-[15px] text-ink/70">Dernière mise à jour : 19 juillet 2026</p>

        <Section title="1. C'est quoi, un cookie ?">
          <p>Un cookie est un petit fichier déposé par un site sur votre appareil. Il permet, par exemple, de garder votre session ouverte, de mémoriser vos préférences, ou de mesurer l'audience du site. Cette page décrit précisément ceux utilisés par orkestria.top et l'application Orkestria.</p>
        </Section>

        <Section title="2. Vos choix, à tout moment">
          <p>Lors de votre première visite, un bandeau vous permet d'accepter ou refuser les cookies non essentiels. Vous pouvez modifier vos choix à tout moment.</p>
          <button
            type="button"
            onClick={openCookieSettings}
            className="mt-3 inline-flex items-center rounded-full bg-[#ff6c02] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_10px_20px_-10px_rgba(255,108,2,0.7)] hover:brightness-110"
          >
            Gérer mes préférences cookies
          </button>
        </Section>

        <Section title="3. Les cookies que nous utilisons">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-black/10 text-left text-[12px] uppercase tracking-wide text-ink/60">
                  <th className="py-2 pr-3">Nom / famille</th>
                  <th className="py-2 pr-3">Finalité</th>
                  <th className="py-2 pr-3">Catégorie</th>
                  <th className="py-2 pr-3">Durée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                <tr>
                  <td className="py-2 pr-3"><code>orkestria.session</code></td>
                  <td className="py-2 pr-3">Maintien de session utilisateur</td>
                  <td className="py-2 pr-3">Essentiel</td>
                  <td className="py-2 pr-3">Session</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3"><code>orkestria.csrf</code></td>
                  <td className="py-2 pr-3">Protection contre les attaques CSRF</td>
                  <td className="py-2 pr-3">Essentiel</td>
                  <td className="py-2 pr-3">Session</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3"><code>orkestria.cookies.consent.v1</code></td>
                  <td className="py-2 pr-3">Mémoriser vos choix de cookies</td>
                  <td className="py-2 pr-3">Essentiel</td>
                  <td className="py-2 pr-3">6 mois</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3"><code>_analytics_*</code></td>
                  <td className="py-2 pr-3">Mesure d'audience anonymisée (pages vues, parcours)</td>
                  <td className="py-2 pr-3">Mesure d'audience</td>
                  <td className="py-2 pr-3">13 mois</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3"><code>_mkt_*</code></td>
                  <td className="py-2 pr-3">Personnalisation des communications produit</td>
                  <td className="py-2 pr-3">Marketing</td>
                  <td className="py-2 pr-3">6 mois</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[13px] text-ink/60">Les cookies essentiels sont indispensables au fonctionnement du service et ne peuvent pas être désactivés. Les autres ne sont déposés qu'après votre consentement explicite.</p>
        </Section>

        <Section title="4. Cookies déposés par des tiers">
          <p>Lorsque vous connectez un compte publicitaire (Meta, Google, TikTok), ces plateformes peuvent déposer leurs propres cookies techniques nécessaires à l'authentification OAuth. Elles sont responsables de ces cookies, régis par leurs propres politiques.</p>
        </Section>

        <Section title="5. Refuser sans conséquence sur l'accès">
          <p>Refuser les cookies non essentiels n'empêche pas d'utiliser Orkestria. Cela limite simplement notre capacité à mesurer l'usage pour améliorer le produit.</p>
        </Section>

        <Section title="6. Contact">
          <p>Question sur les cookies ou l'exercice de vos droits : <a className="text-[#ff6c02] hover:underline" href="mailto:privacy@orkestria.top">privacy@orkestria.top</a>.</p>
        </Section>

        <Section title="7. Éditeur">
          <p><b>KAMALOKA AI TECHNOLOGIES LLC</b> — Dirigée par ALLE OSSEY ANGE CEDRIC.<br />Siège : Abidjan, Côte d'Ivoire.<br />Site : orkestria.top</p>
        </Section>

        <div className="mt-16 flex flex-wrap gap-3">
          <Link to="/privacy" className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Confidentialité</Link>
          <Link to="/terms" className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Conditions</Link>
          <Link to="/contact" className="rounded-full bg-[#ff6c02] px-5 py-2.5 text-sm font-medium text-white hover:brightness-110">Nous contacter</Link>
        </div>
      </main>
      <FooterMini />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-sora text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink/80">{children}</div>
    </section>
  );
}

function TopBar() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <Link to="/" aria-label="Orkestria"><BrandLogo className="h-7 w-auto" /></Link>
      <Link to="/" className="text-sm text-ink/70 hover:text-ink">← Retour à l'accueil</Link>
    </header>
  );
}

function FooterMini() {
  return (
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
  );
}