import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { getSupabaseService } from '@/lib/supabaseService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseAllowed(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

export async function POST(req: NextRequest) {
  try {
    const authz = req.headers.get('authorization') || ''
    const m = authz.match(/^Bearer\s+(.+)$/i)
    if (!m) return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
    const token = m[1]

    const anon = getSupabaseServer()
    const { data, error } = await anon.auth.getUser(token)
    if (error || !data?.user?.email) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    const email = data.user.email.toLowerCase()
    const allowed = parseAllowed()
    if (!allowed.includes(email)) return NextResponse.json({ error: 'Not an admin' }, { status: 403 })

    const svc = getSupabaseService()
    const { error: upErr } = await svc
      .from('admin_users')
      .upsert({ email })
      .eq('email', email)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, email })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

