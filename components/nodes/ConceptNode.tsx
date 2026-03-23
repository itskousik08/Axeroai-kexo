'use client'
import { useState } from 'react'
import { NodeBase } from '../ui/NodeBase'
import { Box } from '@/lib/database.types'
import { useCanvasStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'

export function ConceptNode({ box }: { box: Box }) {
  const { updateBox } = useCanvasStore()
  const supabase = createClient()
  const [title, setTitle] = useState(box.title || '')
  const [content, setContent] = useState(box.content || '')

  const LABEL_COLOR: Record<string, string> = {
    concept:  'text-blue-400',
    question: 'text-violet-400',
    note:     'text-emerald-400',
    text:     'text-white/40',
  }

  async function save(field: 'title' | 'content', val: string) {
    updateBox(box.id, { [field]: val })
    await supabase.from('boxes').update({ [field]: val }).eq('id', box.id)
  }

  return (
    <NodeBase box={box} headerLabel={box.type} headerColor={LABEL_COLOR[box.type] || 'text-white/40'}>
      <input
        className="w-full bg-transparent text-white font-display font-bold text-sm outline-none placeholder-white/20 mb-2 border-b border-transparent focus:border-white/10 pb-1 transition-colors"
        placeholder="Title…"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onBlur={() => save('title', title)}
      />
      <textarea
        className="w-full bg-transparent text-white/60 text-xs outline-none placeholder-white/20 resize-none leading-relaxed min-h-[52px]"
        placeholder="Add notes…"
        value={content}
        onChange={e => setContent(e.target.value)}
        onBlur={() => save('content', content)}
        rows={3}
      />
    </NodeBase>
  )
}
