-- ============================================================
--  WorldLink — Schéma de la base de données (Supabase / PostgreSQL)
--  ------------------------------------------------------------
--  Comment l'utiliser :
--  1. Ouvre ton projet gratuit sur https://supabase.com
--  2. Menu de gauche : « SQL Editor » → « New query »
--  3. Colle TOUT ce fichier, puis clique « Run ».
--  C'est tout : les tables et les règles de sécurité sont créées.
--
--  Règles de sécurité (RLS) :
--  - Tout le monde peut LIRE les contenus publiés.
--  - Seul un utilisateur connecté peut PUBLIER.
--  - Chacun ne peut MODIFIER ou SUPPRIMER que SES publications
--    (auth.uid() = user_id). Personne ne touche au compte d'un autre.
-- ============================================================

-- ---------- Table : professionnels (pièce Travail) ----------
create table if not exists public.professionals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  trade      text not null,               -- métier : plombier, infirmière, avocat...
  age        integer,
  city       text not null,
  country    text not null,
  phone      text not null,               -- numéro de contact affiché aux clients
  photo_url  text,                        -- lien d'une photo (optionnel)
  created_at timestamptz not null default now()
);

-- ---------- Table : offres d'emploi (pièce Travail) ----------
create table if not exists public.job_offers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  author_name text,                       -- nom de la personne qui publie
  title       text not null,              -- intitulé du poste
  company     text not null,              -- entreprise / employeur
  city        text not null,
  country     text not null,
  job_type    text not null default 'Temps plein',  -- Temps plein / Temps partiel
  description text,
  contact     text not null,              -- où envoyer son CV / qui contacter
  created_at  timestamptz not null default now()
);

-- ---------- Table : logements (pièce Logement) ----------
create table if not exists public.housing (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  author_name text,
  title       text not null,
  city        text not null,
  country     text not null,
  price       numeric not null,           -- prix affiché (loyer), dans la monnaie du pays
  description text,
  photo_url   text,
  contact     text,                       -- contact du propriétaire (optionnel)
  created_at  timestamptz not null default now()
);

-- ---------- Table : annonces du marché (pièce Marché & Livraison) ----------
create table if not exists public.market_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  seller_name text,
  title       text not null,
  price       numeric,
  city        text not null,
  country     text,
  description text,
  photo_url   text,
  contact     text not null,              -- contact du vendeur (bouton « Commander »)
  created_at  timestamptz not null default now()
);

-- ---------- Table : « J'aime » des annonces ----------
create table if not exists public.market_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.market_posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)               -- un seul « J'aime » par personne et par annonce
);

-- ---------- Table : commentaires des annonces ----------
create table if not exists public.market_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.market_posts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  author_name text,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- Index pour des recherches rapides ----------
create index if not exists idx_professionals_city    on public.professionals (city);
create index if not exists idx_job_offers_city       on public.job_offers (city);
create index if not exists idx_housing_city          on public.housing (city);
create index if not exists idx_housing_price         on public.housing (price);
create index if not exists idx_market_posts_city     on public.market_posts (city);
create index if not exists idx_market_likes_post     on public.market_likes (post_id);
create index if not exists idx_market_comments_post  on public.market_comments (post_id);

-- ============================================================
--  SÉCURITÉ (Row Level Security)
-- ============================================================

alter table public.professionals   enable row level security;
alter table public.job_offers      enable row level security;
alter table public.housing         enable row level security;
alter table public.market_posts    enable row level security;
alter table public.market_likes    enable row level security;
alter table public.market_comments enable row level security;

-- ----- professionals -----
create policy "Lecture publique des professionnels"
  on public.professionals for select using (true);
create policy "Publier son profil professionnel"
  on public.professionals for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Modifier son propre profil"
  on public.professionals for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Supprimer son propre profil"
  on public.professionals for delete to authenticated
  using (auth.uid() = user_id);

-- ----- job_offers -----
create policy "Lecture publique des offres d'emploi"
  on public.job_offers for select using (true);
create policy "Publier sa propre offre"
  on public.job_offers for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Modifier sa propre offre"
  on public.job_offers for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Supprimer sa propre offre"
  on public.job_offers for delete to authenticated
  using (auth.uid() = user_id);

-- ----- housing -----
create policy "Lecture publique des logements"
  on public.housing for select using (true);
create policy "Publier son propre logement"
  on public.housing for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Modifier son propre logement"
  on public.housing for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Supprimer son propre logement"
  on public.housing for delete to authenticated
  using (auth.uid() = user_id);

-- ----- market_posts -----
create policy "Lecture publique des annonces"
  on public.market_posts for select using (true);
create policy "Publier sa propre annonce"
  on public.market_posts for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Modifier sa propre annonce"
  on public.market_posts for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Supprimer sa propre annonce"
  on public.market_posts for delete to authenticated
  using (auth.uid() = user_id);

-- ----- market_likes : lecture publique, écriture connectée (les siennes) -----
create policy "Lecture publique des j'aime"
  on public.market_likes for select using (true);
create policy "Aimer avec son propre compte"
  on public.market_likes for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Retirer son propre j'aime"
  on public.market_likes for delete to authenticated
  using (auth.uid() = user_id);

-- ----- market_comments : lecture publique, écriture connectée -----
create policy "Lecture publique des commentaires"
  on public.market_comments for select using (true);
create policy "Commenter avec son propre compte"
  on public.market_comments for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Supprimer son propre commentaire"
  on public.market_comments for delete to authenticated
  using (auth.uid() = user_id);

-- ============================================================
--  Fin du schéma WorldLink.
-- ============================================================
