import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type NormalizedDrink = {
  name: string
  price: number
  description?: string | null
  image_url?: string | null
  category?: string | null
}

function parseNextData(html: string): any | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

function extractPriceNumber(obj: any): number | null {
  const asNumber = (v: any) => typeof v === 'number' && isFinite(v) ? v : null
  const asStringPrice = (v: any) => {
    if (typeof v !== 'string') return null
    const digits = v.replace(/[^0-9]/g, '')
    if (!digits) return null
    const n = Number(digits)
    if (!isFinite(n)) return null
    return n
  }
  // Common fields observed across menu schemas
  const direct = asNumber(obj?.price) ?? asNumber(obj?.unitPrice) ?? asNumber(obj?.basePrice)
  if (direct !== null) return direct
  const minor = asNumber(obj?.priceInMinorUnit) ?? asNumber(obj?.amountInMinor) ?? asNumber(obj?.valueInMinor)
  if (minor !== null) {
    // Heuristic: for currencies with 2 decimals, divide by 100. For VND (0 minor), keep as is.
    // We cannot reliably know currency; prefer large integers (>= 1000) as VND whole units.
    return minor >= 1000 ? minor : minor / 100
  }
  const nested = asNumber(obj?.price?.value) ?? asNumber(obj?.price?.amount) ?? asNumber(obj?.price?.base)
  if (nested !== null) return nested
  const display = asStringPrice(obj?.displayPrice) ?? asStringPrice(obj?.priceText) ?? asStringPrice(obj?.formattedPrice)
  if (display !== null) return display
  return null
}

function extractImage(obj: any): string | null {
  return obj?.imageUrl || obj?.imgUrl || obj?.photoUrl || obj?.photoHref || obj?.image || null
}

function extractName(obj: any): string | null {
  const cands = [obj?.name, obj?.itemName, obj?.title, obj?.displayName]
  for (const c of cands) if (typeof c === 'string' && c.trim().length > 1) return c.trim()
  return null
}

function* walk(value: any, parents: any[] = []): Generator<{ node: any; parents: any[] }> {
  yield { node: value, parents }
  if (Array.isArray(value)) {
    for (const v of value) yield* walk(v, parents)
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) yield* walk(value[k], parents.concat([value]))
  }
}

function extractFromNextData(nextData: any): NormalizedDrink[] {
  const results: NormalizedDrink[] = []
  for (const { node, parents } of walk(nextData)) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue
    const name = extractName(node)
    const price = extractPriceNumber(node)
    if (name && price !== null) {
      // Try to infer category from nearest parent with a name-like field
      let category: string | null = null
      for (let i = parents.length - 1; i >= 0; i--) {
        const pName = extractName(parents[i])
        if (pName && pName !== name) { category = pName; break }
      }
      const description = typeof node?.description === 'string' ? node.description : null
      const image_url = extractImage(node)
      results.push({ name, price, description, image_url, category })
    }
  }
  // Deduplicate by name+price
  const seen = new Set<string>()
  return results.filter(d => {
    const key = `${d.name}|${d.price}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function POST(req: NextRequest) {
  try {
    const { url, eventId } = await req.json()
    if (!url || !eventId) {
      return NextResponse.json({ error: 'Missing url or eventId' }, { status: 400 })
    }
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: ev, error: evErr } = await supabase.from('events').select('*').eq('id', eventId).single()
    if (evErr || !ev) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9'
      }
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 502 })
    }
    const html = await res.text()
    const nextData = parseNextData(html)
    if (!nextData) {
      return NextResponse.json({ error: 'Could not locate embedded data on page' }, { status: 422 })
    }
    const items = extractFromNextData(nextData)
    // Basic sanity filter: names with price > 0, skip extremely high duplicates
    const normalized: NormalizedDrink[] = items
      .filter(i => i.price && i.price > 0 && i.name.length <= 120)
      .slice(0, 300)

    if (normalized.length === 0) {
      return NextResponse.json({ error: 'No menu items detected' }, { status: 422 })
    }

    // Map to DB rows
    const rows = normalized.map(d => ({
      event_id: eventId,
      name: d.name,
      price: Number(d.price),
      category: d.category ?? null,
      description: d.description ?? null,
      image_url: d.image_url ?? null,
      source_url: url,
      is_available: true,
    }))

    // Insert in chunks to avoid payload limits
    const chunkSize = 100
    let inserted = 0
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const { error } = await supabase.from('drinks').insert(chunk)
      if (error) {
        // Stop on first failure, but return context
        return NextResponse.json({
          error: 'Insert failed',
          reason: error.message,
          attempted: i,
          sample: rows.slice(0, Math.min(5, rows.length))
        }, { status: 500 })
      }
      inserted += chunk.length
    }

    return NextResponse.json({
      ok: true,
      event: { id: ev.id, name: ev.name },
      inserted,
      sample: rows.slice(0, Math.min(5, rows.length))
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

