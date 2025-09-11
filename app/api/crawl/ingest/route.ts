import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { getSupabaseService } from '@/lib/supabaseService'

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
  const direct = obj?.imageUrl || obj?.imgUrl || obj?.photoUrl || obj?.photoHref || obj?.image || null
  if (typeof direct === 'string' && direct) return direct
  // Common array field
  if (Array.isArray(obj?.images) && obj.images.length) {
    const c = obj.images[0]
    const src = c?.url || c?.imageUrl || c?.src || null
    if (typeof src === 'string' && src) return src
  }
  // Nested image object
  const nested = obj?.imageObject || obj?.imageObj || obj?.photo || null
  if (nested) {
    const src = nested?.url || nested?.src || nested?.imageUrl || null
    if (typeof src === 'string' && src) return src
  }
  return null
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

function extractGrabFoodItems(nextData: any): NormalizedDrink[] {
  const results: NormalizedDrink[] = []
  for (const { node } of walk(nextData)) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue
    // Common GrabFood fields observed:
    // name, priceInMinorUnit, description, imageUrl or images[0].url, isSoldOut/available
    const name = extractName(node)
    const price = extractPriceNumber(node)
    const soldOut = node?.isSoldOut === true || node?.available === false || node?.status === 'UNAVAILABLE'
    if (!name || price === null || soldOut) continue
    let image_url = extractImage(node)
    if (!image_url && Array.isArray(node?.images) && node.images.length) {
      image_url = node.images[0]?.url || node.images[0]?.imageUrl || null
    }
    const description = typeof node?.description === 'string' ? node.description : null
    results.push({ name, price, image_url, description })
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

function extractShopeeFoodItems(nextData: any): NormalizedDrink[] {
  const results: NormalizedDrink[] = []
  for (const { node, parents } of walk(nextData)) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue
    const name = extractName(node)
    const price = extractPriceNumber(node)
    const unavailable = node?.isSoldOut === true || node?.soldOut === true || node?.available === false || node?.isAvailable === false || node?.is_active === false
    if (!name || price === null || unavailable) continue
    const description = typeof node?.description === 'string' ? node.description : null
    let image_url = extractImage(node)
    if (!image_url && Array.isArray(node?.images) && node.images.length) {
      image_url = node.images[0]?.url || node.images[0]?.imageUrl || null
    }
    // Try to infer category name from parent-like objects
    let category: string | null = null
    for (let i = parents.length - 1; i >= 0; i--) {
      const p = parents[i]
      const pName = extractName(p) || p?.categoryName || p?.nameCategory || p?.title || null
      if (typeof pName === 'string' && pName && pName !== name) { category = pName; break }
    }
    results.push({ name, price, image_url, description, category })
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

function parseAllowed(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractImgTags(html: string): { alt: string; src: string }[] {
  const tags: { alt: string; src: string }[] = []
  const imgRe = /<img\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = imgRe.exec(html))) {
    const tag = m[0]
    const altM = tag.match(/\balt\s*=\s*(["'])(.*?)\1/i)
    const srcM = tag.match(/\b(?:data-src|src)\s*=\s*(["'])(.*?)\1/i)
    const alt = altM ? altM[2] : ''
    const src = srcM ? srcM[2] : ''
    if (src) tags.push({ alt, src })
  }
  return tags
}

function resolveUrlMaybe(u: string | null | undefined, base: string): string | null {
  if (!u) return null
  try { return new URL(u, base).toString() } catch { return null }
}

function fillMissingImagesFromHtml(html: string, pageUrl: string, items: NormalizedDrink[]) {
  if (!items.length) return
  const tags = extractImgTags(html)
  if (tags.length === 0) return
  for (const it of items) {
    if (it.image_url) continue
    const name = it.name.trim().toLowerCase()
    // Find a tag with alt containing the name (or vice versa) as a heuristic
    let best: { alt: string; src: string } | null = null
    for (const t of tags) {
      const alt = (t.alt || '').trim().toLowerCase()
      if (!alt) continue
      if (alt.includes(name) || name.includes(alt)) { best = t; break }
    }
    if (best) {
      it.image_url = resolveUrlMaybe(best.src, pageUrl) || best.src
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, eventId } = await req.json()
    // Require admin
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
    if (!url || !eventId) {
      return NextResponse.json({ error: 'Missing url or eventId' }, { status: 400 })
    }
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const svc = getSupabaseService()
    const { data: ev, error: evErr } = await svc.from('events').select('*').eq('id', eventId).single()
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
    const host = (() => { try { return new URL(url).host } catch { return '' } })()
    const items = host.includes('grab.com')
      ? (extractGrabFoodItems(nextData) || [])
      : (host.includes('shopeefood') || host.includes('foody.vn'))
        ? (extractShopeeFoodItems(nextData) || [])
        : (extractFromNextData(nextData) || [])
    // Basic sanity filter: names with price > 0, skip extremely high duplicates
    const normalized: NormalizedDrink[] = items
      .filter(i => i.price && i.price > 0 && i.name.length <= 120)
      .slice(0, 300)

    // Fallback: try to fill missing images by scanning HTML <img alt="name" ...>
    if (normalized.some(i => !i.image_url)) {
      fillMissingImagesFromHtml(html, url, normalized)
    }

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

    // Duplicate detection against DB by (lower(trim(name)), price) per event
    const { data: existing, error: existErr } = await svc
      .from('drinks')
      .select('name, price')
      .eq('event_id', eventId)
      .limit(5000)
    if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 })
    const norm = (s: string) => s.trim().toLowerCase()
    const existingSet = new Set<string>()
    for (const r of existing || []) {
      const k = `${norm((r as any).name)}|${Number((r as any).price)}`
      existingSet.add(k)
    }
    const toInsert = rows.filter(r => !existingSet.has(`${norm(r.name)}|${Number(r.price)}`))

    // Insert in chunks to avoid payload limits
    const chunkSize = 100
    let inserted = 0
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize)
      const { error } = await svc.from('drinks').insert(chunk)
      if (error) {
        return NextResponse.json({
          error: 'Insert failed',
          reason: error.message,
          attempted: i,
          sample: toInsert.slice(0, Math.min(5, toInsert.length))
        }, { status: 500 })
      }
      inserted += chunk.length
    }

    return NextResponse.json({
      ok: true,
      event: { id: ev.id, name: ev.name },
      inserted,
      skipped: rows.length - toInsert.length,
      sample: toInsert.slice(0, Math.min(5, toInsert.length))
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
