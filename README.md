# 📌 The Pad — Bacheca Interattiva Online con Autenticazione & Bacheche Personali

**The Pad** è una Web Application moderna ed elegante stile **Padlet**, pubblicata su **GitHub Pages** e potenziata da **Supabase Auth** e **Realtime Database**.

---

## ✨ Funzionalità

- 🌐 **Bacheca della Community (Pubblica)**: Chiunque acceda al sito può subito leggere e pubblicare nella bacheca condivisa senza bisogno di registrarsi.
- 🔐 **Autenticazione Utenti & Email di Conferma**: Registrazione con Email/Password e conferma tramite link via posta elettronica.
- 📌 **Bacheche Personali Riservate**: Una volta loggato, l'utente può creare bacheche personali, selezionarle dal menu a tendina ed eliminarle con Soft-Delete.
- 👤 **Autore Automatico**: Quando l'utente loggato crea un post, il campo autore viene precompilato con il suo nickname (modificabile se desiderato).
- 🗑️ **Conservazione Sicura dei Dati**: L'eliminazione di una bacheca effettua un Soft-Delete (`is_archived = true`), lasciando i dati conservati su Supabase ma rimuovendoli dalla vista dell'utente.

---

## ⚡ Script SQL per Supabase

Apri l'**SQL Editor** su Supabase ed esegui questo codice SQL completo per aggiornare le tabelle e le regole RLS:

```sql
-- 0. Rimuovi le tabelle vecchie per aggiornare la struttura
drop table if exists posts cascade;
drop table if exists boards cascade;

-- 1. Tabella delle Bacheche Personali (con colonna is_archived per soft-delete)
create table boards (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  is_archived boolean default false,
  created_at bigint
);

-- 2. Tabella dei Post (Community e Personali)
create table posts (
  id text primary key,
  board_id text references boards(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  title text,
  content text,
  author text,
  color text,
  tag text,
  image text,
  reactions jsonb default '{}'::jsonb,
  comments jsonb default '[]'::jsonb,
  x bigint default 40,
  y bigint default 40,
  created_at bigint
);

-- Inserisci la bacheca pubblica della community
insert into boards (id, user_id, title, description, is_archived, created_at)
values ('public-community-board', null, 'Bacheca della Community', 'Bacheca condivisa pubblica', false, 0)
on conflict (id) do nothing;

-- 3. Attiva Row Level Security (RLS)
alter table boards enable row level security;
alter table posts enable row level security;

-- Policy per le Bacheche (Tutti vedono la bacheca pubblica, gli utenti vedono le proprie bacheche non archiviate)
create policy "Boards Select Policy" on boards 
  for select 
  using (id = 'public-community-board' or (auth.uid() = user_id and (is_archived is null or is_archived = false)));

create policy "Boards Insert Policy" on boards 
  for insert 
  with check (auth.uid() = user_id);

create policy "Boards Update Policy" on boards 
  for update 
  using (auth.uid() = user_id);

-- Policy per i Post (Tutti possono leggere/scrivere sulla bacheca pubblica; gli utenti gestiscono i propri post)
create policy "Posts Select Policy" on posts 
  for select 
  using (board_id = 'public-community-board' or auth.uid() = user_id);

create policy "Posts Insert Policy" on posts 
  for insert 
  with check (board_id = 'public-community-board' or auth.uid() = user_id);

create policy "Posts Update Policy" on posts 
  for update 
  using (board_id = 'public-community-board' or auth.uid() = user_id);

create policy "Posts Delete Policy" on posts 
  for delete 
  using (board_id = 'public-community-board' or auth.uid() = user_id);

-- 4. Abilita la sincronizzazione Realtime
alter publication supabase_realtime add table boards;
alter publication supabase_realtime add table posts;
```

---

## 📧 Configurazione Email di Conferma su Supabase

1. Su Supabase Console, vai in **Authentication** > **Providers** > **Email**.
2. Assicurati che **"Confirm email"** sia impostato su **ON**.
3. In **Authentication** > **URL Configuration**, imposta **Site URL** al tuo link di GitHub Pages:  
   `https://IL_TUO_USERNAME.github.io/the-pad/`

---

## 🚀 Deployment su GitHub Pages

```bash
git add .
git commit -m "Aggiunta bacheca pubblica di default, autore automatico e soft-delete bacheche"
git push
```
