import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { createClient } from '../supabase'

export function useAutoSave(workspaceId: string) {
  const { boxes, connections, isDirty, setDirty, setLastSaved } = useCanvasStore()
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!isDirty) return

    // Debounce 3 seconds
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        // Batch upsert all boxes
        if (boxes.length > 0) {
          await supabase.from('boxes').upsert(
            boxes.map((b) => ({ ...b, workspace_id: workspaceId })),
            { onConflict: 'id' }
          )
        }
        setDirty(false)
        setLastSaved(new Date())
      } catch (err) {
        console.error('Autosave failed:', err)
      }
    }, 3000)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [boxes, connections, isDirty])
}
