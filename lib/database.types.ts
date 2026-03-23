export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type BoxType = 'concept' | 'question' | 'note' | 'image' | 'pdf' | 'voice' | 'youtube' | 'text'
export type BoxColor = 'default' | 'blue' | 'green' | 'amber' | 'rose' | 'violet'

export interface Box {
  id: string
  workspace_id: string
  user_id: string
  type: BoxType
  title: string | null
  content: string | null
  url: string | null
  cloudinary_id: string | null
  thumbnail_url: string | null
  duration: number | null
  metadata: Json
  pos_x: number
  pos_y: number
  width: number
  height: number | null
  color: BoxColor
  z_index: number
  created_at: string
  updated_at: string
}

export interface Workspace {
  id: string
  owner_id: string
  name: string
  description: string | null
  thumbnail_url: string | null
  is_public: boolean
  share_token: string
  settings: Json
  created_at: string
  updated_at: string
}

export interface Connection {
  id: string
  workspace_id: string
  from_box_id: string
  to_box_id: string
  label: string | null
  style: string
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  workspace_id: string
  user_id: string | null
  content: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      workspaces: { Row: Workspace; Insert: Partial<Workspace>; Update: Partial<Workspace> }
      boxes: { Row: Box; Insert: Partial<Box>; Update: Partial<Box> }
      connections: { Row: Connection; Insert: Partial<Connection>; Update: Partial<Connection> }
      notes: { Row: Note; Insert: Partial<Note>; Update: Partial<Note> }
    }
  }
}
