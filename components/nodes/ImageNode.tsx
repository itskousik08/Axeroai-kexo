'use client'
import Image from 'next/image'
import { NodeBase } from '../ui/NodeBase'
import { Box } from '@/lib/database.types'

export function ImageNode({ box }: { box: Box }) {
  return (
    <NodeBase box={box} headerLabel="Image" headerColor="text-rose-400" minWidth={200} disableResize>
      {box.url ? (
        <div className="relative w-full overflow-hidden rounded-xl bg-white/[0.03]" style={{ aspectRatio: '16/10' }}>
          <img
            src={box.url}
            alt={box.title || 'image'}
            className="w-full h-full object-cover rounded-xl"
          />
        </div>
      ) : (
        <div className="w-full h-32 rounded-xl bg-white/[0.04] flex items-center justify-center text-white/20 text-xs">
          No image
        </div>
      )}
      {box.title && (
        <p className="text-white/40 text-xs mt-2 truncate">{box.title}</p>
      )}
    </NodeBase>
  )
}
