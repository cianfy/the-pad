# 📌 The Pad — Bacheca Interattiva Online (con Supabase)

**The Pad** è una Web Application moderna ed elegante stile **Padlet**, progettata per essere distribuita gratuitamente su **GitHub Pages** (sia come app a sé stante che affiancata al tuo portfolio esistente).

Permette a chiunque si colleghi al tuo sito di visualizzare, pubblicare ed interagire in tempo reale con **post di testo, immagini, note colorate, reazioni ed immagini**, salvando tutto su **Supabase**!

---

## ✨ Caratteristiche Principali

- ⚡ **Backend Cloud Supabase**: Database PostgreSQL + Realtime integrati con SDK JavaScript nativo per il browser.
- 📐 **3 Modalità di Visualizzazione**:
  - **Griglia Dinamica (Masonry)**: Layout pulito ed automatico.
  - **Bacheca Libera (Drag & Drop)**: Trascina liberamente le note post-it sullo schermo con trascinamento fluido.
  - **Vista Lista**: Formato compatto a scorrimento verticale.
- 🎨 **Note Personalizzabili**: Colori pastello/neon (Viola, Rosa, Blu, Smeraldo, Ambra, Verde), autore, tag ed allegati immagine.
- 📸 **Supporto Immagini**: Caricamento diretto da file (drag & drop) oppure tramite URL.
- ❤️ **Reazioni & Commenti**: Emoji interattive (❤️, 🔥, 👍, 💡, 🚀) e sezione commenti sotto ogni post.
- 🔍 **Ricerca Live**: Filtro istantaneo per parole chiave, tag, autore o testo.
- 🌙 **Design Moderno Glassmorphism**: Temi Scuro e Chiaro con animazioni fluide.

---

## ⚡ Guida Rapida: Configurare Supabase in 2 Minuti

1. Vai su **[supabase.com](https://supabase.com)** e crea un account / nuovo progetto gratuito.
2. Una volta creato il progetto:
   - Vai nel menu **Project Settings** > **API**.
   - Copia la **Project URL** (es. `https://xxxxxxxxx.supabase.co`) e la **anon public key** (`eyJhbGciOi...`).
3. Nel menu a sinistra di Supabase, apri l'**SQL Editor** e clicca su **New Query**.
4. Incolla ed esegui questo codice SQL per creare la tabella ed attivare le autorizzazioni di lettura/scrittura pubbliche:

```sql
-- 1. Crea la tabella dei post
create table posts (
  id text primary key,
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

-- 2. Attiva la sicurezza RLS e la lettura/scrittura pubblica per la bacheca
alter table posts enable row level security;
create policy "Public Select" on posts for select using (true);
create policy "Public Insert" on posts for insert with check (true);
create policy "Public Update" on posts for update using (true);
create policy "Public Delete" on posts for delete using (true);

-- 3. Attiva Supabase Realtime per gli aggiornamenti live
alter publication supabase_realtime add table posts;
```

5. Clicca **Run**.
6. Apri la tua web app su GitHub Pages (o in locale), clicca sull'icona della fulmine (⚡) in alto a destra, incolla la **Project URL** e la **Anon Key** e clicca **Salva e Connetti**!

🎉 **Fatto! Da questo momento tutti i post pubblicati da qualsiasi utente sul web saranno salvati su Supabase e sincronizzati in tempo reale per tutti i visitatori.**

---

## 🚀 Guida alla Pubblicazione su GitHub Pages

Hai due modalità semplici per pubblicare **The Pad** al fianco del tuo portfolio:

### Opzione 1: Repository Separato (Consigliata per mantenere il portfolio pulito)
1. Vai su GitHub e crea un **nuovo repository** pubblico chiamato `the-pad`.
2. Apri il terminale nella cartella del progetto e carica i file:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of The Pad with Supabase"
   git branch -M main
   git remote add origin https://github.com/IL_TUO_USERNAME/the-pad.git
   git push -u origin main
   ```
3. Su GitHub, vai in **Settings** > **Pages** del repository `the-pad`.
4. Sotto **Build and deployment**, seleziona `Source: Deploy from a branch` e scegli il branch `main` (folder `/root`).
5. Clicca **Save**. Il tuo sito sarà visibile su:  
   👉 **`https://IL_TUO_USERNAME.github.io/the-pad/`**

---

### Opzione 2: Dentro la cartella del tuo Portfolio esistente
1. Se il tuo portfolio è nel repository `IL_TUO_USERNAME.github.io`, crea al suo interno una cartella chiamata `pad` (o `the-pad`).
2. Copia i file di questa applicazione (`index.html`, `styles.css`, cartella `js/`) dentro quella cartella.
3. Fai il push delle modifiche sul tuo repository:
   ```bash
   git add .
   git commit -m "Aggiunta app The Pad"
   git push
   ```
4. L'applicazione sarà raggiungibile su:  
   👉 **`https://IL_TUO_USERNAME.github.io/pad/`**

---

## 🛠️ Tecnologie Utilizzate

- **Supabase Client SDK v2** (Database PostgreSQL Cloud & Realtime WebSockets)
- **HTML5 & CSS3 Vanilla** (Variabili CSS, Flexbox, CSS Grid, Glassmorphism, Micro-interazioni)
- **JavaScript ES Modules** (Architettura pulita e modulare senza build tool)
- **BroadcastChannel API** (Sincronizzazione istantanea tra schede dello stesso browser)
