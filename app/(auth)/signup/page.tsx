'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { FiZap, FiMail, FiLock, FiUser, FiArrowRight } from 'react-icons/fi'
import { FcGoogle } from 'react-icons/fc'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) { toast.error(error.message); setLoading(false) }
    else {
      toast.success('Account created! Check your email to verify.')
      router.push('/dashboard')
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f11] relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative w-full max-w-md mx-4"
      >
        <div className="bg-[#17171a] border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-orange-500 flex items-center justify-center shadow-brand">
              <FiZap className="text-black" size={18} strokeWidth={2.5} />
            </div>
            <span className="font-display font-black text-xl tracking-tight">
              kexo <em className="not-italic text-brand-400">AI</em>
            </span>
          </div>

          <h1 className="font-display font-bold text-2xl text-white mb-1">Create your account</h1>
          <p className="text-white/40 text-sm mb-7">Free forever · No credit card required</p>

          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium transition-all mb-5"
          >
            <FcGoogle size={18} /> Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-white/30">or email</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="relative">
              <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={15} />
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Full name"
                required
                className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-brand-500/60 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors"
              />
            </div>
            <div className="relative">
              <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={15} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-brand-500/60 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors"
              />
            </div>
            <div className="relative">
              <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={15} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password (min 8 chars)"
                required
                className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-brand-500/60 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-orange-500 hover:opacity-90 text-black font-display font-bold rounded-xl py-3 text-sm transition-all shadow-brand disabled:opacity-60 mt-2"
            >
              {loading ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <>Create account <FiArrowRight size={15} /></>}
            </button>
          </form>

          <p className="text-center text-white/30 text-xs mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
