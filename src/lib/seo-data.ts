// Programmatic SEO data — sectors, platforms, cities.
export const SITE_URL = "https://orkestria.top";

export type Sector = {
  slug: string;
  name: string;
  h1: string;
  intent: string;
  painPoints: string[];
  wins: string[];
  avgTicket: string;
  channelMix: string;
};

export const SECTORS: Sector[] = [
  { slug: "restaurant", name: "Restaurant", h1: "Publicité IA pour restaurants", intent: "remplir votre salle chaque service", painPoints: ["Tables vides en semaine", "Livraison rentable difficile à cadrer", "Pas de temps pour poster"], wins: ["Réservations en direct sur Instagram", "Promotion du menu du jour en 1 clic", "Retour clients tous les vendredis"], avgTicket: "18 €", channelMix: "Meta 70 % · Google 30 %" },
  { slug: "salon-coiffure", name: "Salon de coiffure", h1: "Publicité IA pour salons de coiffure", intent: "remplir votre planning de rendez-vous", painPoints: ["Créneaux vides en journée", "Concurrence locale sur Instagram", "Pas de suivi des rendez-vous"], wins: ["Rendez-vous pris depuis la pub", "Promo balayage ciblée quartier par quartier", "Rappel automatique aux clientes fidèles"], avgTicket: "65 €", channelMix: "Meta 80 % · Google 20 %" },
  { slug: "coach-sportif", name: "Coach sportif", h1: "Publicité IA pour coachs sportifs", intent: "attirer 10 nouveaux clients par mois", painPoints: ["Prospects qui ne signent pas", "Coût par lead trop élevé", "Contenus qui ne convertissent pas"], wins: ["Séance découverte réservée depuis la pub", "Tunnel d'abonnement mensuel", "Témoignages clients réutilisés en créa"], avgTicket: "120 €", channelMix: "Meta 60 % · TikTok 25 % · Google 15 %" },
  { slug: "ecommerce-mode", name: "E-commerce mode", h1: "Publicité IA pour e-commerce mode", intent: "faire décoller vos ventes sans exploser le CAC", painPoints: ["ROAS qui s'effondre après scaling", "Créas qui fatiguent trop vite", "Stock mal aligné aux campagnes"], wins: ["Catalogue synchronisé Meta et Google", "Nouvelles créas testées chaque semaine", "Réallocation budget vers les best-sellers"], avgTicket: "72 €", channelMix: "Meta 55 % · Google 30 % · TikTok 15 %" },
  { slug: "immobilier", name: "Agence immobilière", h1: "Publicité IA pour agences immobilières", intent: "générer des mandats vendeurs qualifiés", painPoints: ["Leads acheteurs qui ne signent pas", "Estimations non contactées", "Portails saturés"], wins: ["Formulaire estimation en 30 s", "Ciblage propriétaires par quartier", "Relance automatique par SMS"], avgTicket: "3 500 €", channelMix: "Meta 65 % · Google 35 %" },
  { slug: "saas-b2b", name: "SaaS B2B", h1: "Publicité IA pour éditeurs SaaS", intent: "remplir votre pipeline de démos qualifiées", painPoints: ["Coût par démo élevé", "Attribution multi-touch chaotique", "Créas linéaires peu testées"], wins: ["Démo réservée depuis LinkedIn Ads", "Séquence de nurturing par email", "Signal d'achat détecté sur le site"], avgTicket: "480 €", channelMix: "Google 50 % · Meta 30 % · LinkedIn 20 %" },
  { slug: "artisan-btp", name: "Artisan BTP", h1: "Publicité IA pour artisans du bâtiment", intent: "recevoir des devis qualifiés chaque semaine", painPoints: ["Leads pas sérieux", "Bouche-à-oreille en baisse", "Devis non rappelés"], wins: ["Formulaire projet en 3 questions", "Ciblage par code postal", "Rappel automatique du prospect"], avgTicket: "2 800 €", channelMix: "Google 60 % · Meta 40 %" },
  { slug: "cabinet-medical", name: "Cabinet médical", h1: "Publicité IA pour cabinets et professions de santé", intent: "remplir votre agenda de nouveaux patients", painPoints: ["Créneaux libres non pourvus", "Règles publicitaires strictes", "Peu de temps pour communiquer"], wins: ["Prise de rendez-vous en ligne", "Créas conformes aux règles santé", "Suivi des rendez-vous honorés"], avgTicket: "80 €", channelMix: "Google 70 % · Meta 30 %" },
  { slug: "hotel", name: "Hôtel indépendant", h1: "Publicité IA pour hôtels indépendants", intent: "remplir vos chambres en direct, sans commissions OTA", painPoints: ["Dépendance à Booking", "Basse saison difficile", "Coût d'acquisition élevé"], wins: ["Réservation directe depuis la pub", "Ciblage voyageurs proches de la date", "Upsell petit-déjeuner intégré"], avgTicket: "180 €", channelMix: "Google 55 % · Meta 45 %" },
  { slug: "formation-ligne", name: "Formation en ligne", h1: "Publicité IA pour formateurs en ligne", intent: "vendre votre programme en continu", painPoints: ["Webinars peu remplis", "Créas qui saturent en 5 jours", "ROAS instable"], wins: ["Inscription webinar automatisée", "Séquence email post-inscription", "Retargeting sur les non-inscrits"], avgTicket: "290 €", channelMix: "Meta 60 % · TikTok 25 % · Google 15 %" },
];

export type Platform = { slug: string; name: string; fullName: string; h1: string; intent: string; strengths: string[]; };

export const PLATFORMS: Platform[] = [
  { slug: "meta-ads", name: "Meta Ads", fullName: "Facebook et Instagram Ads", h1: "Automatisez Meta Ads avec un agent IA", intent: "Piloter Facebook et Instagram sans ouvrir le Gestionnaire", strengths: ["Advantage+ orchestré par l'agent", "Créas générées et testées en continu", "Audiences lookalike auto-mises à jour"] },
  { slug: "google-ads", name: "Google Ads", fullName: "Google Search, Performance Max et YouTube", h1: "Automatisez Google Ads avec un agent IA", intent: "Capter la demande active sur Google et YouTube", strengths: ["Performance Max piloté par objectif", "Mots-clés négatifs enrichis chaque semaine", "Enchères intelligentes surveillées 24/7"] },
  { slug: "tiktok-ads", name: "TikTok Ads", fullName: "TikTok Ads Manager", h1: "Automatisez TikTok Ads avec un agent IA", intent: "Scaler sur TikTok sans y passer vos nuits", strengths: ["Spark Ads réactifs sur vos contenus", "Créas UGC générées et adaptées", "Budgets réalloués selon les hooks qui percent"] },
];

export type City = { slug: string; name: string; region: string; country: string; angle: string };
export const CITIES: City[] = [
  { slug: "paris", name: "Paris", region: "Île-de-France", country: "France", angle: "concurrence dense et coût par clic élevé" },
  { slug: "lyon", name: "Lyon", region: "Auvergne-Rhône-Alpes", country: "France", angle: "clientèle locale exigeante et forte saisonnalité" },
  { slug: "marseille", name: "Marseille", region: "PACA", country: "France", angle: "audiences très mobiles et pouvoir d'achat contrasté" },
  { slug: "toulouse", name: "Toulouse", region: "Occitanie", country: "France", angle: "bassin étudiant et jeunes actifs à capter" },
  { slug: "bordeaux", name: "Bordeaux", region: "Nouvelle-Aquitaine", country: "France", angle: "clientèle premium et flux touristique constant" },
  { slug: "nantes", name: "Nantes", region: "Pays de la Loire", country: "France", angle: "marché en croissance et forte concurrence digitale" },
  { slug: "lille", name: "Lille", region: "Hauts-de-France", country: "France", angle: "zone frontalière et audiences transfrontalières" },
  { slug: "strasbourg", name: "Strasbourg", region: "Grand Est", country: "France", angle: "double marché francophone et germanophone" },
  { slug: "abidjan", name: "Abidjan", region: "Lagunes", country: "Côte d'Ivoire", angle: "mobile-first et paiement Wave/Orange Money" },
  { slug: "dakar", name: "Dakar", region: "Dakar", country: "Sénégal", angle: "audiences jeunes et forte pénétration TikTok" },
  { slug: "casablanca", name: "Casablanca", region: "Casablanca-Settat", country: "Maroc", angle: "clientèle bilingue arabe-français et budgets serrés" },
  { slug: "bruxelles", name: "Bruxelles", region: "Région de Bruxelles-Capitale", country: "Belgique", angle: "ciblage bilingue français-néerlandais" },
  { slug: "geneve", name: "Genève", region: "Genève", country: "Suisse", angle: "panier moyen élevé et attentes premium" },
  { slug: "montreal", name: "Montréal", region: "Québec", country: "Canada", angle: "marché francophone nord-américain à fort CPC" },
];

export function findSector(slug: string) { return SECTORS.find((s) => s.slug === slug); }
export function findPlatform(slug: string) { return PLATFORMS.find((p) => p.slug === slug); }
export function findCity(slug: string) { return CITIES.find((c) => c.slug === slug); }
