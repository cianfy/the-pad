# 📌 The Pad — Bacheca Interattiva Online con Autenticazione & Bacheche Personali

**The Pad** è una Web Application moderna ed elegante stile **Padlet**, pubblicata su **GitHub Pages** e potenziata da **Supabase Auth** e **Realtime Database**.

Ora ciascun utente può:
- 🔐 Registrarsi con **Email e Password** e confermare l'account cliccando il link inviato via email.
- 📌 Creare e gestire **Bacheche Personali riservate** (es. "Idee", "Lavoro", "Appunti").
- 📸 Pubblicare note colorate con testo, immagini, reazioni ed il supporto Drag & Drop.
- 🛡️ Contare sulla **sicurezza RLS (Row Level Security)** che protegge i dati di ciascun utente.

---

## ⚡ Guida SQL: Configurare le Bacheche Personali su Supabase

Per attivare le bacheche personali e le autorizzazioni di sicurezza RLS, apri l'**SQL Editor** su Supabase ed esegui questo codice SQL:

```sql
-- 1. Tabella delle Bacheche Personali
create table boards (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  created_at bigint
);

-- 2. Aggiornamento Tabella dei Post
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

-- 3. Attiva Row Level Security (RLS) per isolare le bacheche dei singoli utenti
alter table boards enable row level security;
alter table posts enable row level security;

-- Policy per le Bacheche (Gli utenti vedono e modificano solo le proprie bacheche)
create policy "User Boards Policy" on boards 
  for all 
  using (auth.uid() = user_id) 
  with check (auth.uid() = user_id);

-- Policy per i Post (Gli utenti gestiscono i post delle proprie bacheche)
create policy "User Posts Policy" on posts 
  for all 
  using (auth.uid() = user_id) 
  with check (auth.uid() = user_id);

-- 4. Abilita la sincronizzazione Realtime
alter publication supabase_realtime add table boards;
alter publication supabase_realtime add table posts;
```

---

## 📧 Configurazione Email di Conferma su Supabase

Per la verifica via email all'atto della registrazione:
1. Su Supabase Console, vai in **Authentication** > **Providers** > **Email**.
2. Assicurati che **"Confirm email"** sia impostato su **ON**.
3. In **Authentication** > **URL Configuration**, imposta **Site URL** al tuo link di GitHub Pages:  
   `https://IL_TUO_USERNAME.github.io/the-pad/`

---

## 🚀 Guida al Deployment su GitHub Pages

### Aggiornare il Repository GitHub
Esegui questi comandi nel terminale per aggiornare l'applicazione su GitHub:

```bash
git add .
git commit -m "Aggiunta Autenticazione Utenti e Bacheche Personali"
git push
```

L'applicazione si aggiornerà automaticamente su:  
👉 **`https://IL_TUO_USERNAME.github.io/the-pad/`**
