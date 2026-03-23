# Kexo AI — Next.js

A modern visual learning canvas built with Next.js, Supabase, and Cloudinary.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Auth + DB | Supabase |
| Storage | Cloudinary |
| State | Zustand |
| Animations | Framer Motion |

---

## Setup

### 1. Clone and install

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` → `.env.local` and fill in your keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Supabase database

1. Go to **Supabase → SQL Editor**
2. Paste and run the full contents of `supabase/schema.sql`
3. In **Authentication → Providers**, enable Google (optional)
4. In **Authentication → URL Configuration**, add:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

### 4. Cloudinary

1. Create a free account at [cloudinary.com](https://cloudinary.com)
2. Copy your **Cloud Name**, **API Key**, and **API Secret** from the dashboard
3. Paste them into `.env.local`

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Features

- **Canvas** — infinite drag-and-drop canvas with zoom
- **7 node types** — Concept, Question, Note, Image, PDF, Voice, YouTube
- **Voice notes** — record or upload audio, stored in Cloudinary
- **Auto-save** — debounced 3s save to Supabase, no manual save needed
- **Export / Import** — full JSON export including all Cloudinary URLs and YouTube links
- **Share** — invite collaborators by email OR generate a public read-only link
- **AI Sidebar** — coming soon placeholder with feature preview
- **Auth** — email/password + Google OAuth via Supabase
- **Realtime** — live collaboration via Supabase Realtime

## Project structure

```
app/
  (auth)/login/        # Login page
  (auth)/signup/       # Signup page
  auth/callback/       # OAuth redirect handler
  dashboard/           # Project dashboard
  workspace/[id]/      # Main canvas workspace
  share/[token]/       # Public read-only view
  api/
    upload/            # Cloudinary upload/delete
    export/            # Full JSON export
    workspaces/import/ # JSON import

components/
  canvas/              # CanvasRenderer, ConnectionsLayer, FloatingActionBar
  nodes/               # ConceptNode, ImageNode, VoiceNode, YoutubeNode, PdfNode
  sidebar/             # AiSidebar, ShareModal
  layout/              # WorkspaceHeader
  ui/                  # NodeBase (shared node wrapper)

lib/
  supabase.ts          # Browser + server Supabase clients
  cloudinary.ts        # Upload/delete/optimize helpers
  store.ts             # Zustand global state
  database.types.ts    # TypeScript types
  hooks/
    useAutoSave.ts     # 3s debounced auto-save
    useAuth.ts         # Auth state hook

supabase/
  schema.sql           # Full DB schema with RLS policies
```
