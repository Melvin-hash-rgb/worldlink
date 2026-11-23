# 🌍 WorldLink — mise en public GRATUITE

**WorldLink — « Faciliter la vie aux gens »**

Ce dossier contient la version publique de WorldLink, prête à mettre en ligne
**sans payer un seul dollar** :

- **GitHub Pages** héberge le site (gratuit).
- **Supabase** garde les comptes et les annonces (gratuit).

Tu as besoin de : ton ordinateur (ou ton téléphone), une connexion internet,
et environ 30 minutes. Suis les étapes dans l'ordre, calmement.

---

## Les fichiers

| Fichier | C'est quoi |
|---|---|
| `index.html` | La page de l'application (toutes les pièces) |
| `styles.css` | Le design bleu royal et or |
| `app.js` | Le fonctionnement de l'application |
| `config.js` | Le branchement à TA base de données (étape 2) |
| `supabase-schema.sql` | Les tables à créer dans Supabase (étape 1) |
| `README.md` | Ce guide |

---

## ÉTAPE 1 — Crée la base de données gratuite (Supabase)

1. Va sur **https://supabase.com** et clique **« Start your project »**.
2. Crée un compte gratuit (avec ton courriel ou ton compte GitHub).
3. Clique **« New project »** :
   - **Name** : `worldlink`
   - **Database Password** : choisis un mot de passe fort et **note-le dans un endroit sûr** (c'est le mot de passe de la base, pas celui des utilisateurs).
   - **Region** : choisis la région la plus proche (ex. *East US* ou *West Europe*).
4. Clique **« Create new project »** et attends 1 à 2 minutes.
5. Dans le menu de gauche, clique **« SQL Editor »**, puis **« New query »**.
6. Ouvre le fichier **`supabase-schema.sql`** (dans ce dossier), copie **tout** son contenu et colle-le dans la fenêtre SQL.
7. Clique **« Run »** (en bas à droite). Tu dois voir *« Success »* : les tables et les règles de sécurité sont créées. ✅

**Petit réglage conseillé (pour que les gens entrent tout de suite après l'inscription) :**
dans Supabase, menu **Authentication → Sign In / Providers → Email**, tu peux
décocher **« Confirm email »**. Sinon, chaque nouvel utilisateur devra d'abord
cliquer un lien reçu par courriel avant de pouvoir se connecter (ça marche
aussi, c'est juste une étape de plus pour eux).

---

## ÉTAPE 2 — Branche le site à ta base (config.js)

1. Dans ton projet Supabase, clique la roue dentée **« Settings »** (en bas à gauche), puis **« API »**.
2. Tu vois deux valeurs :
   - **Project URL** (ex. `https://abcdefgh.supabase.co`)
   - **Project API keys → `anon` `public`** (une longue clé qui commence par `eyJ…`)
3. Ouvre le fichier **`config.js`** (avec un éditeur de texte simple, ex. Bloc-notes ou Visual Studio Code) et colle les deux valeurs entre les guillemets :

```js
window.WORLDLINK_CONFIG = {
  SUPABASE_URL: "https://abcdefgh.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi... (la longue clé)"
};
```

4. **Enregistre** le fichier.

> 🔒 La clé `anon` est faite pour être publique : elle peut rester dans ce
> fichier sans danger, car les règles de sécurité (étape 1) protègent les
> données. Par contre, ne publie **jamais** la clé `service_role`.

---

## ÉTAPE 3 — Mets les fichiers sur GitHub

1. Va sur **https://github.com** et connecte-toi à ton compte.
2. Clique le **« + »** en haut à droite → **« New repository »** :
   - **Repository name** : `worldlink`
   - Choisis **Public**
   - Clique **« Create repository »**.
3. Sur la page du nouveau dépôt, clique **« uploading an existing file »**
   (ou *Add file → Upload files*).
4. Glisse-dépose **les 6 fichiers** de ce dossier :
   `index.html`, `styles.css`, `app.js`, `config.js`, `supabase-schema.sql`, `README.md`.
5. Clique **« Commit changes »**. ✅

---

## ÉTAPE 4 — Active GitHub Pages (le site devient public)

1. Dans ton dépôt GitHub `worldlink`, clique l'onglet **« Settings »**.
2. Dans le menu de gauche, clique **« Pages »**.
3. Sous **« Build and deployment » → Source** : choisis **« Deploy from a branch »**.
4. Choisis la branche **`main`** et le dossier **`/ (root)`**, puis **« Save »**.
5. Attends 1 à 3 minutes, puis recharge la page *Settings → Pages* :
   GitHub affiche ton adresse publique, du genre :

   **https://ton-nom.github.io/worldlink/**

6. Clique l'adresse : **WorldLink est en ligne, dans le monde entier.** 🎉

---

## ÉTAPE 5 — Crée le compte du fondateur

1. Ouvre ton adresse publique (celle de l'étape 4).
2. Sur l'écran d'entrée, clique **« Créer un compte »**.
3. Mets **ton nom**, **ton courriel** et **ton mot de passe** → **« Créer mon compte »**.
4. Si tu n'as pas décoché « Confirm email » à l'étape 1 : ouvre ta boîte
   courriel, clique le lien de confirmation de Supabase, puis reviens te connecter.
5. Connecte-toi : tu es **l'utilisateur n° 1 de WorldLink — le fondateur**. 👑
6. Teste tout, comme un client :
   - Inscris-toi comme **professionnel** (pièce Travail),
   - Publie un **logement**, une **annonce** du marché,
   - Pose une question à l'**Assistant**,
   - Appuie sur **Partager** sur une annonce et envoie-la à tes contacts.

---

## Après le lancement

- **Partage ton adresse partout** : c'est elle qui fait entrer les gens.
  Chaque personne qui publie peut partager SON annonce à ses contacts —
  c'est comme ça que WorldLink grandit, sans démarchage.
- **Première ville d'abord** : remplis une ville de vraies annonces
  (les professionnels et propriétaires publient gratuitement), puis la suivante.
- **Pour modifier le site plus tard** : change le fichier sur ton ordinateur,
  puis remplace-le dans le dépôt GitHub (*Add file → Upload files*, même nom) —
  GitHub Pages met le site à jour tout seul en quelques minutes.

## Si quelque chose ne marche pas

| Problème | Solution probable |
|---|---|
| Le site dit « WorldLink n'est pas encore branché » | L'étape 2 n'est pas finie : vérifie `config.js` (URL + clé `anon`, sans espaces). |
| « Success » n'apparaît pas à l'étape 1 | Re-colle tout le fichier SQL et clique *Run* à nouveau. |
| Impossible de se connecter après l'inscription | Vérifie le courriel de confirmation de Supabase, ou décoche « Confirm email » (étape 1). |
| La page GitHub Pages est blanche ou 404 | Attends 2 minutes de plus et recharge ; vérifie que `index.html` est bien à la racine du dépôt. |
| Les annonces ne s'enregistrent pas | Vérifie que le SQL de l'étape 1 a bien été exécuté dans le **même** projet Supabase que celui de `config.js`. |

---

*WorldLink — Faciliter la vie aux gens. Construit brique par brique : d'abord
la maquette, puis l'application, puis le monde.*
