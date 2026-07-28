---
name: campaign-manager
description: Launch Meta campaigns with precise geo (city/quartier), paused-first, media-buyer SOP.
---

# Campaign manager

## Steps

1. `validate_setup` — Meta OAuth + Page Facebook
2. Clarifier **objectif** (Trafic / Prospects / Ventes / Messages WhatsApp|Messenger)
3. Clarifier **géo précise** — pas seulement le pays :
   - Ville (ex. Abidjan, Dakar, Paris)
   - Quartier / zone si service local (Cocody, Plateau, Marcory…)
   - Rayon km si livraison / local
   - Ou « tout le pays » seulement si national
4. Budget / jour réaliste pour la taille d'audience
5. **Appareils** — mobile uniquement si marché mobile-first (CI, SN…) ou service local
6. Créas (image) ou boost d'un post Page
7. `create_meta_campaign` dry_run → confirmation « oui crée en pause » → activation explicite

## Notes

- Campagnes toujours **PAUSED** jusqu'à validation.
- Messages Ads = destination WhatsApp ou Messenger (pas WhatsApp Business API envoi).
- Ciblage Meta : préférer `cities` / radius via recherche géo plutôt qu'un pays entier pour un commerce local.
- Une seule régie connectée → rester dessus.
