"use client";
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Props = {
  children: React.ReactNode
}

export default function AuthGate({ children }: Props) {
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const allowedAdmins = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
    return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  }, [])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSessionEmail(data.session?.user?.email ?? null)
      setLoading(false)
    }
    init()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const isAdmin = useMemo(() => {
    if (!sessionEmail) return false
    if (allowedAdmins.length === 0) return false
    return allowedAdmins.includes(sessionEmail.toLowerCase())
  }, [allowedAdmins, sessionEmail])

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setNotice(null)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    if (error) setNotice(error.message)
    else setNotice('Check your email for a magic link to sign in.')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) return <div>Loading...</div>

  if (!sessionEmail) {
    return (
      <div className="max-w-md">
        <h2 className="text-xl font-semibold mb-4">Admin Sign In</h2>
        <form onSubmit={signIn} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
          <button className="px-3 py-2 bg-slate-900 text-white rounded text-sm">Send magic link</button>
        </form>
        {notice && <p className="mt-3 text-sm text-slate-600">{notice}</p>}
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md space-y-3">
        <p className="text-sm">Signed in as {sessionEmail}</p>
        <p className="text-red-600 text-sm">You are not authorized to access the admin area.</p>
        <button onClick={signOut} className="text-sm underline">Sign out</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Signed in as {sessionEmail}</p>
        <button onClick={signOut} className="text-xs underline">Sign out</button>
      </div>
      {children}
    </div>
  )
}

