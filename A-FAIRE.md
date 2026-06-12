# ✅ Guide de mise en service — Les Petites Herbes

3 étapes pour que tout fonctionne en production. Comptez ~30 minutes.

---

## ⚠️ Étape 0 — Déployer (sinon le téléphone garde l'ancien affichage)

Tant que les changements ne sont pas **déployés sur Vercel**, votre téléphone
affiche forcément l'ancienne version (celle qui est en ligne).

1. Envoyez le code sur GitHub (commit + push), ou laissez Vercel se redéployer
   automatiquement si le projet est connecté à votre dépôt.
2. Sur [vercel.com](https://vercel.com) → votre projet → vérifiez que le dernier
   déploiement est bien **Ready** (vert).
3. Sur votre téléphone : la nouvelle version se chargera toute seule.
   - L'app a été corrigée pour **se rafraîchir automatiquement** à chaque mise à jour.
   - Si jamais l'ancien écran persiste (rare) : fermez complètement l'app, ou dans
     le navigateur faites un rechargement, ou retirez puis réinstallez le raccourci.

> 💡 Le problème "ancien affichage" venait d'un cache trop agressif (service worker).
> C'est corrigé : désormais l'app privilégie toujours la version en ligne.

---

## Étape 1 — Base de données (5 min) 🔴 OBLIGATOIRE

1. Ouvrez [supabase.com](https://supabase.com) → votre projet → **SQL Editor**
2. Ouvrez le fichier `supabase/A_APPLIQUER.sql` de ce projet
3. Copiez tout son contenu, collez-le dans l'éditeur SQL, cliquez **Run**
4. En bas, une ligne de vérification s'affiche avec les compteurs — si pas d'erreur rouge, c'est bon ✅

Sans cette étape : les jours de livraison, commandes habituelles, templates de messages et récolte réelle ne fonctionnent pas.

---

## Étape 2 — Rappels clients : WhatsApp & SMS (0 min, déjà prêt !) ✅

Vous n'envoyez **plus rien par email** aux clients. Les rappels se font par **WhatsApp ou SMS**,
gratuitement, depuis l'app :

1. Onglet **Commandes** → section **Envoyer rappels** → choisissez le jour (Mardi/Jeudi/Vendredi)
2. Rédigez un petit message du moment (optionnel) — la liste des produits dispo est ajoutée automatiquement
3. Pour chaque client : un bouton **WhatsApp** ou **SMS** ouvre l'app avec le message déjà écrit + son lien personnel
4. La **pastille verte** coche le client une fois contacté → vous savez qui reste à faire
   (le suivi est **partagé entre votre téléphone et celui de Lucas**)
5. Pour aller plus vite : bouton **« Copier le message groupé »** → collez-le dans une
   **liste de diffusion WhatsApp** (envoi à tous d'un coup, en privé)

> 💡 Les compteurs en haut du panneau (à contacter / contactés / restants) se remettent à zéro
> chaque semaine, automatiquement.

---

## Étape 3 — Emails (OPTIONNEL) 🟡

Vous pouvez ignorer cette étape : sans clé Resend, **aucun email n'est envoyé**, et c'est très bien
puisque vous passez par WhatsApp/SMS.

Si un jour vous voulez aussi des emails (confirmation de commande avec BL en PDF, par exemple) :
1. Compte gratuit sur [resend.com](https://resend.com) → **API Keys** → copiez la clé `re_...`
2. Vérifiez un domaine (Resend → **Domains**) — l'adresse de test n'envoie qu'à vous-même
3. Sur Vercel → **Settings → Environment Variables** :

| Variable | Valeur |
|---|---|
| `RESEND_API_KEY` | votre clé `re_...` |
| `EMAIL_FROM` | `GAEC Les Petites Herbes <contact@votre-domaine.fr>` |
| `NEXT_PUBLIC_APP_URL` | l'URL de votre app, ex `https://petites-herbes.vercel.app` |

---

## Récapitulatif des nouveautés de cette mise à jour

| Nouveauté | Où la trouver |
|---|---|
| 🔔 Badge rouge nouvelles commandes | Barre de navigation, onglet Commandes |
| 📅 Choix du jour de livraison par le client | Boutique client, avant le bouton Commander |
| 🛒 Demande clients (totaux hebdo) | Page Semis, étape 2, bandeau violet |
| 📥 Saisie récolte réelle | Historique → détail d'un semis → bouton sous chaque ligne |
| 💶 Statistiques de ventes | Page Coûts → onglet "Ventes" (CA/mois, top clients, top produits) |
| 🤖 Rappels automatiques | Tous les jours 17h-18h (voir étape 3) |
| 🎨 Nouvelle identité visuelle | Partout : vert sauge chaleureux, fond crème, titres élégants |
| 🛍️ Boutique refondue | Grandes photos, accueil personnalisé, sans la barre admin |
| ✏️ Modifier un semis | Historique → détail → bouton "Modifier" |
| 👁 Voir la boutique d'un client | Fiche client → bouton "Voir" |
| 💬 Rappels WhatsApp / SMS + suivi | Commandes → Envoyer rappels (pastilles de suivi partagées) |
| 📢 Envoi groupé | Bouton "Copier le message groupé" → liste de diffusion WhatsApp |
| 🔄 Bascule vue gestion ↔ vue chef | Bouton flottant "👁 Vue chef" → boutique → "← Mode gestion" |
