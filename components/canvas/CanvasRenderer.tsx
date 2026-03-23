'use client'
import { useRef, useCallback } from 'react'
import { useCanvasStore } from '@/lib/store'
import { Box } from '@/lib/database.types'
import { ConceptNode }  from '../nodes/ConceptNode'
import { ImageNode }    from '../nodes/ImageNode'
import { VoiceNode }    from '../nodes/VoiceNode'
import { YoutubeNode }  from '../nodes/YoutubeNode'
import { PdfNode }      from '../nodes/PdfNode'
import { ConnectionsLayer } from './ConnectionsLayer'

function renderBox(box: Box) {
  switch (box.type) {
    case 'image':                          return <ImageNode   key={box.id} box={box} />
    case 'voice':                          return <VoiceNode   key={box.id} box={box} />
    case 'youtube':                        return <YoutubeNode key={box.id} box={box} />
    case 'pdf':                            return <PdfNode     key={box.id} box={box} />
    case 'concept':
    case 'question':
    case 'note':
    case 'text':
    default:                               return <ConceptNode key={box.id} box={box} />
  }
}

interface CanvasRendererProps { workspaceId: string }

export function CanvasRenderer({ workspaceId }: CanvasRendererProps) {
  const { boxes, zoom, setSelectedBoxId, connectMode } = useCanvasStore()
  const canvasRef = useRef<HTMLDivElement>(null)

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).id === 'canvas-bg') {
      setSelectedBoxId(null)
    }
  }, [setSelectedBoxId])

  return (
    <div
      id="canvas-scroll"
      className="flex-1 overflow-auto canvas-scroll relative"
      style={{ cursor: connectMode ? 'crosshair' : 'default' }}
    >
      {/* Grid bg */}
      <div
        id="canvas-bg"
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          width: 4000,
          height: 3000,
          position: 'relative',
          transformOrigin: '0 0',
          transform: `scale(${zoom})`,
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)`,
          backgroundSize: '30px 30px',
          backgroundColor: '#0f0f11',
          flexShrink: 0,
        }}
      >
        {/* SVG connections rendered beneath nodes */}
        <ConnectionsLayer />

        {/* Nodes */}
        {boxes.map(box => renderBox(box))}
      </div>
    </div>
  )
}
