import { create } from 'zustand'
import { Box, Connection, Workspace } from './database.types'

interface CanvasStore {
  // Workspace
  workspace: Workspace | null
  setWorkspace: (w: Workspace) => void

  // Boxes
  boxes: Box[]
  setBoxes: (boxes: Box[]) => void
  addBox: (box: Box) => void
  updateBox: (id: string, updates: Partial<Box>) => void
  removeBox: (id: string) => void

  // Connections
  connections: Connection[]
  setConnections: (c: Connection[]) => void
  addConnection: (c: Connection) => void
  removeConnection: (id: string) => void

  // Selection
  selectedBoxId: string | null
  setSelectedBoxId: (id: string | null) => void

  // UI
  zoom: number
  setZoom: (z: number) => void
  connectMode: boolean
  setConnectMode: (v: boolean) => void
  connectSourceId: string | null
  setConnectSourceId: (id: string | null) => void

  // AI sidebar
  aiSidebarOpen: boolean
  setAiSidebarOpen: (v: boolean) => void

  // Autosave
  isDirty: boolean
  setDirty: (v: boolean) => void
  lastSaved: Date | null
  setLastSaved: (d: Date) => void
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  workspace: null,
  setWorkspace: (workspace) => set({ workspace }),

  boxes: [],
  setBoxes: (boxes) => set({ boxes }),
  addBox: (box) => set((s) => ({ boxes: [...s.boxes, box], isDirty: true })),
  updateBox: (id, updates) =>
    set((s) => ({
      boxes: s.boxes.map((b) => (b.id === id ? { ...b, ...updates } : b)),
      isDirty: true,
    })),
  removeBox: (id) =>
    set((s) => ({
      boxes: s.boxes.filter((b) => b.id !== id),
      connections: s.connections.filter((c) => c.from_box_id !== id && c.to_box_id !== id),
      isDirty: true,
    })),

  connections: [],
  setConnections: (connections) => set({ connections }),
  addConnection: (c) => set((s) => ({ connections: [...s.connections, c], isDirty: true })),
  removeConnection: (id) =>
    set((s) => ({ connections: s.connections.filter((c) => c.id !== id), isDirty: true })),

  selectedBoxId: null,
  setSelectedBoxId: (selectedBoxId) => set({ selectedBoxId }),

  zoom: 1,
  setZoom: (zoom) => set({ zoom }),
  connectMode: false,
  setConnectMode: (connectMode) => set({ connectMode }),
  connectSourceId: null,
  setConnectSourceId: (connectSourceId) => set({ connectSourceId }),

  aiSidebarOpen: false,
  setAiSidebarOpen: (aiSidebarOpen) => set({ aiSidebarOpen }),

  isDirty: false,
  setDirty: (isDirty) => set({ isDirty }),
  lastSaved: null,
  setLastSaved: (lastSaved) => set({ lastSaved }),
}))
