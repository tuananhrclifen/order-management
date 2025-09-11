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
    const { eventId } = await req.json()
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

    const authz = req.headers.get('authorization') || ''
    const m = authz.match(/^Bearer\s+(.+)$/i)
    if (!m) return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
    const token = m[1]
    const anon = getSupabaseServer()
    const { data: authData, error: authErr } = await anon.auth.getUser(token)
    if (authErr || !authData?.user?.email) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    const email = authData.user.email.toLowerCase()
    const allowed = parseAllowed()
    if (!allowed.includes(email)) return NextResponse.json({ error: 'Not an admin' }, { status: 403 })

    const svc = getSupabaseService()
    const { data: deleted, error } = await svc
      .from('drinks')
      .delete()
      .eq('event_id', eventId)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const deletedCount = (deleted || []).length
    return NextResponse.json({ ok: true, deleted: deletedCount })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

