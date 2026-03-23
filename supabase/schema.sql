-- ============================================================
-- KEXO AI — Supabase SQL Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- WORKSPACES
-- ============================================================
CREATE TABLE public.workspaces (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL DEFAULT 'Untitled Workspace',
  description   TEXT,
  thumbnail_url TEXT,
  is_public     BOOLEAN DEFAULT FALSE,
  share_token   TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  settings      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can CRUD their workspaces"
  ON public.workspaces FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Collaborators can view workspaces"
  ON public.workspaces FOR SELECT
  USING (
    auth.uid() = owner_id OR
    id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Public workspaces viewable by anyone"
  ON public.workspaces FOR SELECT
  USING (is_public = TRUE);

-- ============================================================
-- WORKSPACE MEMBERS (for collaboration)
-- ============================================================
CREATE TABLE public.workspace_members (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id  UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,            -- pending invite (no account yet)
  role          TEXT DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  invited_by    UUID REFERENCES auth.users(id),
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners manage members"
  ON public.workspace_members FOR ALL
  USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );

CREATE POLICY "Members can view themselves"
  ON public.workspace_members FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- BOXES (canvas nodes)
-- ============================================================
CREATE TABLE public.boxes (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id  UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES auth.users(id) NOT NULL,

  -- Type: concept | question | note | image | pdf | voice | youtube | text
  type          TEXT NOT NULL DEFAULT 'concept',

  -- Content
  title         TEXT,
  content       TEXT,           -- text / notes / youtube URL
  url           TEXT,           -- Cloudinary URL for media
  cloudinary_id TEXT,           -- Cloudinary public_id for deletion
  thumbnail_url TEXT,           -- for PDF/video previews
  duration      INTEGER,        -- audio duration in seconds
  metadata      JSONB DEFAULT '{}', -- extra: {videoId, timestamps, etc.}

  -- Canvas position & size
  pos_x         FLOAT DEFAULT 200,
  pos_y         FLOAT DEFAULT 200,
  width         FLOAT DEFAULT 280,
  height        FLOAT,
  color         TEXT DEFAULT 'default',
  z_index       INTEGER DEFAULT 0,

  -- Timestamps
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can CRUD boxes"
  ON public.boxes FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Public workspace boxes are viewable"
  ON public.boxes FOR SELECT
  USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE is_public = TRUE)
  );

-- ============================================================
-- CONNECTIONS (edges between boxes)
-- ============================================================
CREATE TABLE public.connections (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id  UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  from_box_id   UUID REFERENCES public.boxes(id) ON DELETE CASCADE NOT NULL,
  to_box_id     UUID REFERENCES public.boxes(id) ON DELETE CASCADE NOT NULL,
  label         TEXT,
  style         TEXT DEFAULT 'solid',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, from_box_id, to_box_id)
);

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage connections"
  ON public.connections FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- NOTES (sidebar notepad per workspace)
-- ============================================================
CREATE TABLE public.notes (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id  UUID REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE NOT NULL,
  user_id       UUID REFERENCES auth.users(id),
  content       TEXT DEFAULT '',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notes CRUD for workspace members"
  ON public.notes FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER boxes_updated_at      BEFORE UPDATE ON public.boxes      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER notes_updated_at      BEFORE UPDATE ON public.notes      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER profiles_updated_at   BEFORE UPDATE ON public.profiles   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- REALTIME (enable for live collab)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.boxes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces;
