# Ahlam Immobilier — version finale

## Installation
1. Installer Node.js 20 ou plus récent.
2. Ouvrir un terminal dans ce dossier.
3. Lancer `npm install` puis `npm start`.
4. Ouvrir http://localhost:3000

## Admin
Ouvrir http://localhost:3000/?admin=1
- utilisateur initial : `admin`
- mot de passe initial : `admin123`

Après connexion, vous pouvez gérer sans toucher au code :
- projets / immeubles / résidences
- appartements, villas, bureaux et locaux
- plusieurs photos par projet et par bien, directement depuis le PC
- image principale, suppression et réorganisation des photos
- logo du site
- nom, slogan, téléphone, WhatsApp, email, ville, textes et couleur
- statuts Disponible / Réservé / Vendu
- demandes clients
- changement du mot de passe admin local

Les données sont enregistrées dans `data/db.json` et les images dans `uploads/`.

## Important
Pour une publication Internet réelle, utilisez HTTPS, un vrai secret JWT et des identifiants d'administration forts via variables d'environnement. Le changement de mot de passe intégré fonctionne pour le mode local par défaut; si `ADMIN_PASSWORD_HASH` est défini, il est géré par cette variable.
