import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Conditions d'utilisation — Orkestria" },
      { name: "description", content: "Conditions générales d'utilisation et de service de la plateforme Orkestria." },
      { property: "og:title", content: "Conditions d'utilisation — Orkestria" },
      { property: "og:description", content: "Règles d'usage, abonnements, responsabilités et engagements de service Orkestria." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-[#faf7f2] text-ink">
      <TopBar />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 md:pt-24">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff6c02]">Conditions d'utilisation</p>
        <h1 className="mt-2 font-sora text-4xl font-semibold tracking-tight md:text-5xl">Un cadre clair, sans mauvaise surprise</h1>
        <p className="mt-4 text-[15px] text-ink/70">Version en vigueur au 19 juillet 2026</p>

        <Section title="1. Objet">
          <p>Les présentes conditions régissent l'accès et l'utilisation d'Orkestria, plateforme publicitaire agentique éditée par KAMALOKA AI TECHNOLOGIES LLC (dirigée par ALLE OSSEY ANGE CEDRIC, siège à Abidjan, Côte d'Ivoire), accessible sur orkestria.one. En créant un compte, vous acceptez ces conditions sans réserve.</p>
        </Section>

        <Section title="2. Description du service">
          <p>Orkestria vous permet de piloter vos campagnes Meta Ads, Google Ads et TikTok Ads à partir d'une interface conversationnelle. Le service inclut la création de campagnes, l'audit continu, l'allocation budgétaire, la génération de rapports et des automatisations paramétrables.</p>
        </Section>

        <Section title="3. Compte et éligibilité">
          <p>Vous devez être majeur, agir dans un cadre professionnel et fournir des informations exactes. Vous êtes responsable de la confidentialité de vos identifiants et de toute action réalisée depuis votre compte. Prévenez-nous immédiatement en cas d'usage non autorisé.</p>
        </Section>

        <Section title="4. Abonnement et facturation">
          <ul className="list-disc space-y-2 pl-5">
            <li>Les plans sont facturés mensuellement ou annuellement, d'avance, en euros hors taxes.</li>
            <li>Le renouvellement est automatique, sauf résiliation avant l'échéance depuis les paramètres de facturation.</li>
            <li>Les dépenses publicitaires réelles sont facturées directement par Meta, Google et TikTok. Orkestria ne les avance pas.</li>
            <li>Un défaut de paiement peut entraîner la suspension du service après relance.</li>
          </ul>
        </Section>

        <Section title="5. Essai et remboursement">
          <p>Chaque nouveau compte bénéficie d'une période d'essai. Passé ce délai, les paiements ne sont pas remboursables au prorata, sauf obligation légale contraire ou geste commercial explicite du support.</p>
        </Section>

        <Section title="6. Vos engagements">
          <ul className="list-disc space-y-2 pl-5">
            <li>Respecter les règles des régies (Meta, Google, TikTok) et la législation applicable à vos publicités.</li>
            <li>Ne pas diffuser de contenus illégaux, trompeurs, discriminatoires ou portant atteinte à des droits de tiers.</li>
            <li>Ne pas contourner, revendre ou reverse-engineerer le service.</li>
            <li>Fournir des accès publicitaires légitimes, dont vous êtes propriétaire ou pour lesquels vous êtes mandaté.</li>
          </ul>
        </Section>

        <Section title="7. Rôle de l'IA et supervision humaine">
          <p>Les recommandations et actions automatiques proposées par l'agent Orkestria sont générées par des modèles d'intelligence artificielle. Elles constituent une aide à la décision. Vous restez responsable de la validation, de la mise en pause ou de la modification des campagnes. Les garde-fous configurés (budgets, plafonds, CPA cible) sont appliqués mais ne garantissent pas un résultat commercial.</p>
        </Section>

        <Section title="8. Propriété intellectuelle">
          <p>La plateforme, ses interfaces, algorithmes et contenus sont la propriété exclusive de KAMALOKA AI TECHNOLOGIES LLC. Vous conservez la pleine propriété de vos contenus, créations publicitaires et données de campagne. Vous nous concédez une licence limitée, non exclusive, pour les traiter dans le seul but de fournir le service.</p>
        </Section>

        <Section title="9. Disponibilité du service">
          <p>Nous visons une disponibilité mensuelle de 99,5 % hors maintenances planifiées. En cas d'incident majeur, un statut public et des communications produit sont mis à disposition. Aucune indemnité n'est due au-delà des engagements contractuels d'un plan Agence ou Entreprise, le cas échéant.</p>
        </Section>

        <Section title="10. Limitation de responsabilité">
          <p>Dans les limites autorisées par la loi, la responsabilité totale d'Orkestria envers vous, tous préjudices confondus, ne peut excéder le montant hors taxes payé au titre du service durant les 12 mois précédant le fait générateur. Orkestria ne peut être tenue responsable des pertes indirectes (chiffre d'affaires, image, opportunités).</p>
        </Section>

        <Section title="11. Suspension et résiliation">
          <p>Vous pouvez résilier à tout moment depuis les paramètres. Orkestria peut suspendre ou clôturer un compte en cas de manquement grave, d'impayé prolongé ou d'usage frauduleux, après notification lorsqu'elle est possible.</p>
        </Section>

        <Section title="12. Données personnelles">
          <p>Le traitement de vos données est décrit dans notre <Link to="/privacy" className="text-[#ff6c02] hover:underline">politique de confidentialité</Link>, qui fait partie intégrante des présentes.</p>
        </Section>

        <Section title="13. Modifications">
          <p>Les conditions peuvent évoluer. Toute modification substantielle sera notifiée dans l'application au moins 15 jours avant son application. La poursuite de l'utilisation vaut acceptation.</p>
        </Section>

        <Section title="14. Droit applicable">
          <p>Les présentes sont régies par le droit applicable au siège social de l'éditeur, KAMALOKA AI TECHNOLOGIES LLC, situé à Abidjan, Côte d'Ivoire. À défaut de résolution amiable, tout litige sera soumis aux tribunaux compétents de ce ressort.</p>
        </Section>

        <Section title="15. Éditeur">
          <p><b>KAMALOKA AI TECHNOLOGIES LLC</b> — Dirigée par ALLE OSSEY ANGE CEDRIC.<br />Siège : Abidjan, Côte d'Ivoire.<br />Site : orkestria.one · Contact : <a className="text-[#ff6c02] hover:underline" href="mailto:hello@orkestria.one">hello@orkestria.one</a></p>
        </Section>

        <div className="mt-16 flex flex-wrap gap-3">
          <Link to="/privacy" className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Confidentialité</Link>
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-ink/60">
        <span>© {new Date().getFullYear()} KAMALOKA AI TECHNOLOGIES LLC — Orkestria</span>
        <div className="flex gap-6">
          <Link to="/privacy" className="hover:text-ink">Confidentialité</Link>
          <Link to="/terms" className="hover:text-ink">Conditions</Link>
          <Link to="/cookies" className="hover:text-ink">Cookies</Link>
          <Link to="/contact" className="hover:text-ink">Contact</Link>
        </div>
      </div>
    </footer>
  );
}