import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { getSupabaseService } from '@/lib/supabaseService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseAllowed(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

function toCsvValue(v: any): string {
  const s = v === null || v === undefined ? '' : String(v)
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const eventId = url.searchParams.get('eventId') || ''
    const status = (url.searchParams.get('status') || 'confirmed').toLowerCase()
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

    // Admin auth via Supabase session token
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
    const { data: ev } = await svc.from('events').select('id,name').eq('id', eventId).single()
    if (!ev) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    let ordersQuery = svc.from('orders').select('id, event_id, drink_id, quantity, status').eq('event_id', eventId)
    if (status && status !== 'all') ordersQuery = ordersQuery.eq('status', status)
    const { data: orders, error: ordErr } = await ordersQuery.limit(5000)
    if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 })

    const drinkIds = Array.from(new Set((orders || []).map(o => o.drink_id)))
    const { data: drinks, error: drErr } = await svc.from('drinks').select('id, name, price, category').in('id', drinkIds)
    if (drErr) return NextResponse.json({ error: drErr.message }, { status: 500 })
    const byDrink = new Map((drinks || []).map(d => [d.id, d]))

    // Aggregate quantities per drink
    const agg = new Map<string, { name: string; category: string | null; price: number; qty: number }>()
    for (const o of orders || []) {
      const d = byDrink.get(o.drink_id)
      if (!d) continue
      const key = d.id
      const rec = agg.get(key) || { name: d.name, category: d.category ?? null, price: Number(d.price), qty: 0 }
      rec.qty += o.quantity
      agg.set(key, rec)
    }

    // Build CSV
    const rows = Array.from(agg.values()).sort((a, b) => a.name.localeCompare(b.name))
    const header = ['Drink', 'Category', 'Price', 'Quantity', 'Total']
    const csvLines = [header.map(toCsvValue).join(',')]
    for (const r of rows) {
      const total = r.price * r.qty
      csvLines.push([
        toCsvValue(r.name),
        toCsvValue(r.category || ''),
        toCsvValue(r.price),
        toCsvValue(r.qty),
        toCsvValue(total)
      ].join(','))
    }
    const csv = csvLines.join('\n') + '\n'

    const safeName = ev.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/-+/g, '-')
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const statusPart = status === 'all' ? 'all' : status
    const filename = `shopping_list_${safeName}_${statusPart}_${dateStr}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename=${filename}`,
        'cache-control': 'no-store',
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

