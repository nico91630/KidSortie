# KidSorties 🪁

Agenda mobile des sorties enfants autour de Brétigny-sur-Orge (rayon géographique de 40 km). Projet indépendant de TechPulse.

## Publication
Activer **Settings → Pages → Build and deployment → Deploy from a branch → main → / (root)**.
Adresse prévue : https://nico91630.github.io/KidSortie/

## Collecte automatique
1. Obtenir une clé de l'API OpenAgenda et l'ajouter à **Settings → Secrets and variables → Actions → Secrets** sous le nom `OPENAGENDA_API_KEY`.
2. Sélectionner les UID d'agendas OpenAgenda autorisés et pertinents pour les familles en Essonne, puis ajouter la variable Actions `OPENAGENDA_AGENDAS` contenant leurs UID séparés par des virgules.
3. Lancer **Actions → Collecte des événements → Run workflow**.
4. Le workflow est ensuite planifié toutes les six heures. GitHub peut décaler l'exécution.

Sans clé ou UID d'agenda, aucune donnée n'est inventée et l'agenda reste vide. Les tarifs non renseignés sont affichés comme inconnus. Le classement famille/enfant est heuristique et les informations doivent être vérifiées auprès de l'organisateur. Les calendriers locaux et les droits de réutilisation doivent être évalués avant ajout de nouvelles sources. GitHub Pages nécessite une activation dans les réglages du dépôt.
