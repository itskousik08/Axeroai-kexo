'use client'
import { useCanvasStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'

function buildPath(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1
  const cx = Math.abs(dx) * 0.5
  return `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`
}

export function ConnectionsLayer() {
  const { boxes, connections, removeConnection } = useCanvasStore()
  const supabase = createClient()

  async function deleteConn(id: string) {
    removeConnection(id)
    await supabase.from('connections').delete().eq('id', id)
    toast.success('Connection removed')
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ width: '100%', height: '100%', zIndex: 1 }}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.3)" />
        </marker>
        <marker id="arrow-hover" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f5a623" />
        </marker>
      </defs>
      {connections.map(conn => {
        const from = boxes.find(b => b.id === conn.from_box_id)
        const to   = boxes.find(b => b.id === conn.to_box_id)
        if (!from || !to) return null

        const x1 = from.pos_x + (from.width || 240) / 2
        const y1 = from.pos_y + 60
        const x2 = to.pos_x   + (to.width   || 240) / 2
        const y2 = to.pos_y

        return (
          <g key={conn.id} className="pointer-events-auto group/conn">
            {/* Wider invisible hit area */}
            <path
              d={buildPath(x1, y1, x2, y2)}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              className="cursor-pointer"
              onDoubleClick={() => deleteConn(conn.id)}
            />
            {/* Visible path */}
            <path
              d={buildPath(x1, y1, x2, y2)}
              fill="none"
              className="connection-line group-hover/conn:stroke-brand-500 transition-colors"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
            {/* Delete on double click hint */}
            <title>Double-click to remove</title>
          </g>
        )
      })}
    </svg>
  )
}
