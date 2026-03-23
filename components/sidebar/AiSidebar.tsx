'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useCanvasStore } from '@/lib/store'
import { FiX, FiZap, FiClock, FiMessageSquare } from 'react-icons/fi'

export function AiSidebar() {
  const { aiSidebarOpen, setAiSidebarOpen } = useCanvasStore()

  return (
    <AnimatePresence>
      {aiSidebarOpen && (
        <>
          {/* Backdrop on mobile */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setAiSidebarOpen(false)}
          />
          <motion.aside
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            className="fixed right-0 top-0 h-full w-80 bg-[#17171a] border-l border-white/[0.07] z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                  <FiZap className="text-white" size={13} strokeWidth={2.5} />
                </div>
                <span className="font-display font-bold text-sm text-white">AI Assistant</span>
              </div>
              <button onClick={() => setAiSidebarOpen(false)} className="text-white/30 hover:text-white transition-colors">
                <FiX size={18} />
              </button>
            </div>

            {/* Coming soon content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
                className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-blue-500/10 border border-violet-500/20 flex items-center justify-center mb-6"
              >
                <FiZap size={32} className="text-violet-400" />
              </motion.div>

              <h2 className="font-display font-black text-xl text-white mb-2">AI Assistant</h2>
              <div className="inline-flex items-center gap-1.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full px-3 py-1 text-xs font-bold mb-4">
                <FiClock size={10} /> Coming Soon 🚀
              </div>
              <p className="text-white/40 text-sm leading-relaxed">
                We're building something powerful. The AI Assistant will help you summarize notes, generate mind map ideas, and answer questions about your content.
              </p>

              {/* Feature preview pills */}
              <div className="mt-8 space-y-2.5 w-full">
                {[
                  { icon: FiMessageSquare, text: 'Chat with your notes' },
                  { icon: FiZap,          text: 'Auto-generate concepts' },
                  { icon: FiZap,          text: 'Voice → Text transcription' },
                  { icon: FiZap,          text: 'PDF summarization' },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-2.5">
                    <Icon size={13} className="text-violet-400 flex-shrink-0" />
                    <span className="text-white/40 text-sm">{text}</span>
                    <span className="ml-auto text-[9px] text-white/20 font-bold uppercase tracking-widest">Soon</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/[0.07]">
              <div className="bg-gradient-to-r from-violet-500/10 to-blue-500/10 border border-violet-500/20 rounded-xl px-4 py-3">
                <p className="text-white/50 text-xs text-center">
                  We'll notify you when AI features launch 🔔
                </p>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
