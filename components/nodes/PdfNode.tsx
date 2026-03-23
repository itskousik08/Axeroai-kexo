'use client'
import { NodeBase } from '../ui/NodeBase'
import { Box } from '@/lib/database.types'
import { FiFileText, FiExternalLink } from 'react-icons/fi'

export function PdfNode({ box }: { box: Box }) {
  return (
    <NodeBase box={box} headerLabel="PDF" headerColor="text-orange-400" minWidth={220} disableResize>
      <div className="bg-white/[0.04] rounded-xl overflow-hidden">
        {box.thumbnail_url ? (
          <img src={box.thumbnail_url} alt="PDF preview" className="w-full object-cover" style={{ maxHeight: 180 }} />
        ) : (
          <div className="h-28 flex flex-col items-center justify-center text-white/20 gap-2">
            <FiFileText size={28} />
            <span className="text-xs">PDF Document</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <div>
          <p className="text-white/70 text-xs font-medium truncate max-w-[160px]">{box.title || 'Document'}</p>
          <p className="text-white/30 text-[10px]">PDF</p>
        </div>
        {box.url && (
          <a
            href={box.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-7 h-7 flex items-center justify-center bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-400 rounded-lg transition-all"
          >
            <FiExternalLink size={12} />
          </a>
        )}
      </div>
    </NodeBase>
  )
}
