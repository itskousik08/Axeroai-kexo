import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Kexo AI — Visual Learning Canvas',
  description: 'Build visual mind maps, take notes, record voice memos, and learn smarter.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0f0f11] text-[#f0eff4] antialiased">
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: '#22222a',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#f0eff4',
            },
          }}
        />
      </body>
    </html>
  )
}
