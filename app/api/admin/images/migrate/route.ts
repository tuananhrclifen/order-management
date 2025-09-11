import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { getSupabaseService } from '@/lib/supabaseService'
import { createHash } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseAllowed(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

const BUCKET = 'menu-images'

async function ensureBucket(svc: ReturnType<typeof getSupabaseService>) {
  const { error } = await svc.storage.createBucket(BUCKET, { public: true })
  if (error && !String(error.message || '').toLowerCase().includes('already exists')) {
    throw error
  }
}

function isStorageUrl(url: string | null | undefined) {
  if (!url) return false
  return url.includes('/storage/v1/object/public/')
}

function pickExt(contentType: string | null, srcUrl: string | null): string {
  const ct = (contentType || '').toLowerCase()
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
  if (srcUrl) {
    const m = srcUrl.toLowerCase().match(/\.(png|webp|gif|jpe?g)(\?|#|$)/)
    if (m) return m[1] === 'jpeg' ? 'jpg' : m[1]
  }
  return 'jpg'
}

async function fetchBuffer(url: string): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      },
    })
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    const buffer = Buffer.from(ab)
    const ct = res.headers.get('content-type')
    return { buffer, contentType: ct }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { eventId, limit } = await req.json().catch(() => ({}))

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
    try { await ensureBucket(svc) } catch {}

    let q = svc.from('drinks').select('id, event_id, name, image_url').order('created_at', { ascending: false })
    if (eventId) q = q.eq('event_id', eventId)
    const { data: rows, error } = await q.limit(Math.max(1, Math.min(5000, Number(limit) || 2000)))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const targets = (rows || []).filter(r => r.image_url && !isStorageUrl(r.image_url) && /^https?:\/\//i.test(r.image_url))

    const from = svc.storage.from(BUCKET)
    let migrated = 0
    let skipped = targets.length

    const concurrency = 5
    let index = 0
    async function worker() {
      while (index < targets.length) {
        const i = index++
        const row = targets[i]
        const got = await fetchBuffer(row.image_url as string)
        if (!got) continue
        const hash = createHash('sha1').update(got.buffer).digest('hex')
        const ext = pickExt(got.contentType, row.image_url as string)
        const path = `${row.event_id || 'misc'}/${hash}.${ext}`
        const { error: upErr } = await from.upload(path, got.buffer, { contentType: got.contentType || undefined, upsert: false })
        if (upErr && !String(upErr.message || '').toLowerCase().includes('exists')) {
          continue
        }
        const { data } = from.getPublicUrl(path)
        const publicUrl = data.publicUrl
        const { error: updErr } = await svc.from('drinks').update({ image_url: publicUrl }).eq('id', row.id)
        if (!updErr) { migrated++; skipped--; }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()))

    return NextResponse.json({ ok: true, migrated, skipped })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

