import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Confidentialité — Orkestria" },
      { name: "description", content: "Comment Orkestria collecte, utilise et protège vos données personnelles et publicitaires." },
      { property: "og:title", content: "Confidentialité — Orkestria" },
      { property: "og:description", content: "Politique de confidentialité d'Orkestria : données collectées, usages, partages, droits et sécurité." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#faf7f2] text-ink">
      <TopBar />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 md:pt-24">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff6c02]">Politique de confidentialité</p>
        <h1 className="mt-2 font-sora text-4xl font-semibold tracking-tight md:text-5xl">Vos données, sous contrôle</h1>
        <p className="mt-4 text-[15px] text-ink/70">Dernière mise à jour : 19 juillet 2026</p>

        <Section title="1. À propos de ce document">
          <p>Cette politique explique quelles informations Orkestria collecte lorsque vous utilisez notre plateforme, pourquoi nous les utilisons, avec qui elles sont partagées et comment vous pouvez exercer vos droits. Elle s'applique à orkestria.top, à l'application web et aux intégrations publicitaires connectées (Meta Ads, Google Ads, TikTok Ads).</p>
        </Section>

        <Section title="2. Responsable de traitement">
          <p>KAMALOKA AI TECHNOLOGIES LLC, société éditrice de la plateforme Orkestria (dirigée par ALLE OSSEY ANGE CEDRIC, siège à Abidjan, Côte d'Ivoire), agit en qualité de responsable de traitement pour les données de compte, de facturation et d'usage. Pour les données de campagne provenant de vos comptes publicitaires, Orkestria intervient en tant que sous-traitant : vous en restez propriétaire.</p>
        </Section>

        <Section title="3. Données que nous collectons">
          <ul className="list-disc space-y-2 pl-5">
            <li><b>Compte</b> : nom, e-mail professionnel, entreprise, rôle, préférences de langue.</li>
            <li><b>Facturation</b> : raison sociale, adresse, TVA, historique d'abonnement (traité par notre prestataire de paiement).</li>
            <li><b>Comptes publicitaires connectés</b> : jetons OAuth chiffrés, identifiants de comptes, campagnes, ensembles d'annonces, créations, statistiques agrégées.</li>
            <li><b>Usage produit</b> : pages visitées, actions dans l'application, messages échangés avec l'agent, journaux techniques.</li>
            <li><b>Support</b> : contenus des messages envoyés via le formulaire « Parlez à un humain ».</li>
          </ul>
        </Section>

        <Section title="4. Pourquoi nous les utilisons">
          <ul className="list-disc space-y-2 pl-5">
            <li>Fournir le service : orchestrer vos campagnes, générer audits, recommandations et rapports.</li>
            <li>Sécuriser la plateforme : détection d'anomalies, prévention de la fraude, journaux d'audit.</li>
            <li>Améliorer le produit : mesure d'usage agrégée, débogage, priorisation des évolutions.</li>
            <li>Vous contacter : réponses au support, notifications produit essentielles, communications commerciales avec option de désinscription.</li>
            <li>Respecter la loi : obligations comptables, fiscales et réponses aux autorités compétentes.</li>
          </ul>
        </Section>

        <Section title="5. Bases légales (RGPD)">
          <p>Nous traitons vos données sur les bases suivantes : exécution du contrat (fourniture du service), intérêt légitime (sécurité, amélioration produit), consentement (cookies non essentiels, communications marketing) et obligation légale (facturation, conservation comptable).</p>
        </Section>

        <Section title="6. Partage avec des tiers">
          <p>Nous ne vendons pas vos données. Nous partageons uniquement le nécessaire avec des sous-traitants soumis à des engagements de confidentialité : hébergement cloud, envoi d'e-mails transactionnels, paiement, outils d'analyse produit, et régies publicitaires que vous connectez explicitement (Meta, Google, TikTok). La liste détaillée est disponible sur demande.</p>
        </Section>

        <Section title="7. Transferts internationaux">
          <p>Certains prestataires peuvent traiter des données en dehors de l'Espace économique européen. Dans ce cas, nous utilisons des Clauses Contractuelles Types de la Commission européenne et des mesures complémentaires (chiffrement, pseudonymisation) pour garantir un niveau de protection équivalent.</p>
        </Section>

        <Section title="8. Durée de conservation">
          <ul className="list-disc space-y-2 pl-5">
            <li>Données de compte : pendant toute la durée du contrat, puis 3 ans à des fins de prospection.</li>
            <li>Données de facturation : 10 ans (obligation légale).</li>
            <li>Journaux techniques et de sécurité : 12 mois.</li>
            <li>Jetons OAuth : révoqués immédiatement à la déconnexion d'un compte publicitaire.</li>
          </ul>
        </Section>

        <Section title="9. Sécurité">
          <p>Chiffrement en transit (TLS 1.2+) et au repos (AES-256), cloisonnement des environnements, revues d'accès régulières, journaux d'audit, sauvegardes chiffrées, tests d'intrusion annuels. Les jetons publicitaires sont stockés dans un coffre dédié et ne sont jamais exposés à des tiers.</p>
        </Section>

        <Section title="10. Vos droits">
          <p>Conformément au RGPD et aux lois locales applicables sur la protection des données, vous disposez à tout moment des droits suivants sur vos données personnelles :</p>
          <ul className="list-disc space-y-2 pl-5">
            <li><b>Accès</b> : obtenir une copie des données que nous détenons sur vous.</li>
            <li><b>Rectification</b> : corriger toute information inexacte ou incomplète.</li>
            <li><b>Effacement</b> : demander la suppression de votre compte et de vos données, dans les limites de nos obligations légales.</li>
            <li><b>Limitation</b> : restreindre temporairement le traitement de vos données.</li>
            <li><b>Portabilité</b> : recevoir vos données dans un format structuré et lisible par machine.</li>
            <li><b>Opposition</b> : refuser un traitement fondé sur notre intérêt légitime ou à des fins de prospection.</li>
            <li><b>Retrait du consentement</b> : à tout moment, sans que cela affecte les traitements passés.</li>
            <li><b>Directives post-mortem</b> : définir le sort de vos données après votre décès.</li>
          </ul>
          <p><b>Comment exercer vos droits.</b> Écrivez à <a className="text-[#ff6c02] hover:underline" href="mailto:privacy@orkestria.top">privacy@orkestria.top</a> depuis l'adresse associée à votre compte, ou utilisez le formulaire de la page <Link to="/contact" className="text-[#ff6c02] hover:underline">contact</Link>. Nous répondons sous 30 jours maximum. Une pièce d'identité peut être demandée en cas de doute raisonnable sur votre identité. La suppression de compte est également accessible directement depuis les paramètres de l'application.</p>
          <p><b>Réclamation.</b> Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir l'autorité de protection des données compétente : l'ARTCI en Côte d'Ivoire (siège de l'éditeur), ou l'autorité de contrôle de votre pays de résidence (CNIL en France, APD en Belgique, etc.).</p>
        </Section>

        <Section title="11. Cookies">
          <p>Nous utilisons des cookies strictement nécessaires (session, sécurité) et, sous réserve de votre consentement, des cookies de mesure d'audience. Vous pouvez modifier vos choix à tout moment depuis le pied de page.</p>
        </Section>

        <Section title="12. Modifications">
          <p>Cette politique peut évoluer. Toute modification substantielle sera notifiée dans l'application au moins 15 jours avant son entrée en vigueur.</p>
        </Section>

        <Section title="13. Éditeur du site">
          <p><b>KAMALOKA AI TECHNOLOGIES LLC</b> — Dirigée par ALLE OSSEY ANGE CEDRIC.<br />Siège : Abidjan, Côte d'Ivoire.<br />Site : orkestria.top · Contact : <a className="text-[#ff6c02] hover:underline" href="mailto:hello@orkestria.top">hello@orkestria.top</a></p>
        </Section>

        <div className="mt-16 flex flex-wrap gap-3">
          <Link to="/terms" className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Conditions d'utilisation</Link>
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