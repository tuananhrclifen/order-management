#!/usr/bin/env node
// Standalone crawler for menu pages (focus: GrabFood). Outputs JSON and optional SQL.
// Requires Node.js 18+ (global fetch available).

import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function parseArgs(argv) {
  const args = { format: 'json', limit: 300, downloadImages: false, storageUpload: false, headless: false, waitUntil: 'networkidle', timeoutMs: 30000 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--url') args.url = next()
    else if (a === '--out') args.out = next()
    else if (a === '--format') args.format = next()
    else if (a === '--event-id') args.eventId = next()
    else if (a === '--sql-out') args.sqlOut = next()
    else if (a === '--download-images') args.downloadImages = true
    else if (a === '--images-dir') args.imagesDir = next()
    else if (a === '--limit') args.limit = Number(next())
    else if (a === '--from-json') args.fromJson = next()
    else if (a === '--headless') args.headless = true
    else if (a === '--wait-until') args.waitUntil = next()
    else if (a === '--wait-selector') args.waitSelector = next()
    else if (a === '--timeout-ms') args.timeoutMs = Number(next())
    else if (a === '--ua') args.ua = next()
    else if (a === '--storage-upload') args.storageUpload = true
    else if (a === '--supabase-url') args.supabaseUrl = next()
    else if (a === '--supabase-key') args.supabaseKey = next()
    else if (a === '--storage-bucket') args.storageBucket = next()
    else if (a === '--help' || a === '-h') args.help = true
  }
  return args
}

function usage() {
  return `
Usage:
  node tools/crawl-menu.mjs --url <pageUrl> [--out out.json] [--format json|sql|both] [--event-id <uuid>] [--sql-out out.sql] [--download-images] [--images-dir dir] [--limit N]
  node tools/crawl-menu.mjs --from-json crawl.json --format sql --event-id <uuid> [--sql-out out.sql]

Notes:
  - When --format includes sql (sql or both), provide --event-id to generate INSERT statements for public.drinks.
  - Images: the tool extracts image URLs; use --download-images to save them locally too.
  - After SQL import, use the web app's Admin > Utilities > Migrate Images to move image URLs to Supabase Storage.

Optional: upload images directly to Supabase Storage and use Storage URLs in output/SQL
  --storage-upload [--supabase-url <url>] [--supabase-key <service_role_key>] [--storage-bucket menu-images]
  If not provided, supabase credentials are read from env: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.

Optional: render with a headless browser for JS-heavy pages
  --headless [--wait-until load|domcontentloaded|networkidle] [--wait-selector <css>] [--timeout-ms 30000] [--ua <user-agent>]
  Requires installing either 'playwright' (recommended) or 'puppeteer'.
`
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  return res.text()
}

async function fetchHtmlHeadless(url, { waitUntil = 'networkidle', waitSelector, timeoutMs = 30000, ua }) {
  let browserType = 'playwright'
  try {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ userAgent: ua || defaultUA() })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: mapWaitUntil(waitUntil), timeout: timeoutMs })
    if (waitSelector) {
      await page.waitForSelector(waitSelector, { timeout: timeoutMs })
    }
    const html = await page.content()
    await browser.close()
    return html
  } catch (e1) {
    try {
      const puppeteer = (await import('puppeteer')).default || (await import('puppeteer')).puppeteer || await import('puppeteer')
      const browser = await puppeteer.launch({ headless: 'new' })
      const page = await browser.newPage()
      await page.setUserAgent(ua || defaultUA())
      await page.goto(url, { waitUntil: mapPuppeteerWaitUntil(waitUntil), timeout: timeoutMs })
      if (waitSelector) {
        await page.waitForSelector(waitSelector, { timeout: timeoutMs })
      }
      const html = await page.content()
      await browser.close()
      browserType = 'puppeteer'
      return html
    } catch (e2) {
      throw new Error(`Headless fetch failed. Install 'playwright' (recommended) or 'puppeteer'.\nPlaywright error: ${e1?.message}\nPuppeteer error: ${e2?.message}`)
    }
  }
}

function mapWaitUntil(s) {
  if (s === 'load' || s === 'domcontentloaded' || s === 'networkidle') return s
  return 'networkidle'
}
function mapPuppeteerWaitUntil(s) {
  if (s === 'load' || s === 'domcontentloaded') return s
  if (s === 'networkidle') return 'networkidle0'
  return 'networkidle0'
}
function defaultUA() {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
}

function parseNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}

const asNumber = (v) => typeof v === 'number' && isFinite(v) ? v : null
function extractPriceNumber(obj) {
  const asStringPrice = (v) => {
    if (typeof v !== 'string') return null
    const digits = v.replace(/[^0-9]/g, '')
    if (!digits) return null
    const n = Number(digits)
    return isFinite(n) ? n : null
  }
  const direct = asNumber(obj?.price) ?? asNumber(obj?.unitPrice) ?? asNumber(obj?.basePrice)
  if (direct !== null) return direct
  const minor = asNumber(obj?.priceInMinorUnit) ?? asNumber(obj?.amountInMinor) ?? asNumber(obj?.valueInMinor)
  if (minor !== null) return minor >= 1000 ? minor : minor / 100
  const nested = asNumber(obj?.price?.value) ?? asNumber(obj?.price?.amount) ?? asNumber(obj?.price?.base)
  if (nested !== null) return nested
  const display = asStringPrice(obj?.displayPrice) ?? asStringPrice(obj?.priceText) ?? asStringPrice(obj?.formattedPrice)
  if (display !== null) return display
  return null
}

function extractImage(obj) {
  const prefer = (...vals) => {
    for (const v of vals) {
      if (typeof v === 'string' && v) return v
      if (v && typeof v === 'object') {
        const s = v.url || v.src || v.imageUrl || v.thumbUrl || v.thumbnailUrl || v.mediumUrl || v.largeUrl
        if (typeof s === 'string' && s) return s
      }
    }
    return null
  }
  // Common direct fields
  const direct = prefer(
    obj?.imageUrl, obj?.imageURL, obj?.imgUrl, obj?.imgURL, obj?.photoUrl, obj?.photoURL,
    obj?.photoHref, obj?.image, obj?.thumbnailUrl, obj?.thumbUrl, obj?.mediumUrl, obj?.largeUrl,
    obj?.portraitImageUrl, obj?.landscapeImageUrl
  )
  if (direct) return direct
  // Arrays of images/photos
  if (Array.isArray(obj?.images) && obj.images.length) {
    const c = obj.images.find(x => !!(x?.url || x?.imageUrl || x?.src)) || obj.images[0]
    const src = prefer(c)
    if (src) return src
  }
  if (Array.isArray(obj?.photos) && obj.photos.length) {
    const c = obj.photos.find(x => typeof x === 'string' || !!(x?.url || x?.imageUrl || x?.src)) || obj.photos[0]
    const src = typeof c === 'string' ? c : prefer(c)
    if (src) return src
  }
  // Nested image-like objects
  const nested = prefer(obj?.imageObject, obj?.imageObj, obj?.photo, obj?.picture)
  if (nested) return nested
  // Any property whose key looks image-ish and value is a url
  for (const k of Object.keys(obj || {})) {
    const v = obj[k]
    if (/image|img|photo|thumb|thumbnail|picture/i.test(k)) {
      const s = prefer(v)
      if (s) return s
      if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v
    }
    if (typeof v === 'string' && /^https?:\/\//i.test(v) && /(\.png|\.webp|\.jpg|\.jpeg|\.gif)(\?|#|$)/i.test(v)) return v
  }
  return null
}

function extractName(obj) {
  const cands = [obj?.name, obj?.itemName, obj?.title, obj?.displayName]
  for (const c of cands) if (typeof c === 'string' && c.trim().length > 1) return c.trim()
  return null
}

function* walk(value, parents = []) {
  yield { node: value, parents }
  if (Array.isArray(value)) {
    for (const v of value) yield* walk(v, parents)
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) yield* walk(value[k], parents.concat([value]))
  }
}

function extractFromNextData(nextData) {
  const results = []
  for (const { node, parents } of walk(nextData)) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue
    const name = extractName(node)
    const price = extractPriceNumber(node)
    if (name && price !== null) {
      let category = null
      for (let i = parents.length - 1; i >= 0; i--) {
        const pName = extractName(parents[i])
        if (pName && pName !== name) { category = pName; break }
      }
      const description = typeof node?.description === 'string' ? node.description : null
      const image_url = extractImage(node)
      results.push({ name, price, description, image_url, category })
    }
  }
  const seen = new Set()
  return results.filter(d => { const k = `${d.name}|${d.price}`; if (seen.has(k)) return false; seen.add(k); return true })
}

function extractGrabFoodItems(nextData) {
  const results = []
  for (const { node, parents } of walk(nextData)) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue
    const name = extractName(node)
    const price = extractPriceNumber(node)
    const soldOut = node?.isSoldOut === true || node?.available === false || node?.status === 'UNAVAILABLE'
    if (!name || price === null || soldOut) continue
    let image_url = extractImage(node)
    if (!image_url && Array.isArray(node?.images) && node.images.length) {
      image_url = node.images[0]?.url || node.images[0]?.imageUrl || null
    }
    const description = typeof node?.description === 'string' ? node.description : null
    let category = null
    for (let i = parents.length - 1; i >= 0; i--) {
      const p = parents[i]
      const pName = extractName(p) || p?.categoryName || p?.nameCategory || p?.title || null
      if (typeof pName === 'string' && pName && pName !== name) { category = pName; break }
    }
    results.push({ name, price, image_url, description, category })
  }
  const seen = new Set()
  return results.filter(d => { const k = `${d.name}|${d.price}`; if (seen.has(k)) return false; seen.add(k); return true })
}

function extractShopeeFoodItems(nextData) {
  const results = []
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
    let category = null
    for (let i = parents.length - 1; i >= 0; i--) {
      const p = parents[i]
      const pName = extractName(p) || p?.categoryName || p?.nameCategory || p?.title || null
      if (typeof pName === 'string' && pName && pName !== name) { category = pName; break }
    }
    results.push({ name, price, image_url, description, category })
  }
  const seen = new Set()
  return results.filter(d => { const k = `${d.name}|${d.price}`; if (seen.has(k)) return false; seen.add(k); return true })
}

function extractImgTags(html) {
  const tags = []
  const imgRe = /<img\b[^>]*>/gi
  let m
  while ((m = imgRe.exec(html))) {
    const tag = m[0]
    const altM = tag.match(/\balt\s*=\s*(["'])(.*?)\1/i)
    const srcM = tag.match(/\b(?:data-src|src)\s*=\s*(["'])(.*?)\1/i)
    const srcsetM = tag.match(/\bsrcset\s*=\s*(["'])(.*?)\1/i) || tag.match(/\bdata-srcset\s*=\s*(["'])(.*?)\1/i)
    const alt = altM ? altM[2] : ''
    let src = srcM ? srcM[2] : ''
    if (!src && srcsetM) {
      // pick the last (usually highest res) url from srcset
      const parts = srcsetM[2].split(',').map(s => s.trim().split(' ')[0]).filter(Boolean)
      if (parts.length) src = parts[parts.length - 1]
    }
    if (src) tags.push({ alt, src })
  }
  return tags
}

function resolveUrlMaybe(u, base) {
  if (!u) return null
  try { return new URL(u, base).toString() } catch { return null }
}

function fillMissingImagesFromHtml(html, pageUrl, items) {
  if (!items.length) return
  const tags = extractImgTags(html)
  if (tags.length === 0) return
  for (const it of items) {
    if (it.image_url) continue
    const name = it.name.trim().toLowerCase()
    let best = null
    for (const t of tags) {
      const alt = (t.alt || '').trim().toLowerCase()
      if (!alt) continue
      if (alt.includes(name) || name.includes(alt)) { best = t; break }
    }
    if (best) it.image_url = resolveUrlMaybe(best.src, pageUrl) || best.src
  }
}

async function downloadImage(url, imagesDir, baseUrl) {
  const abs = resolveUrlMaybe(url, baseUrl) || url
  const res = await fetch(abs, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'referer': baseUrl
    }
  })
  if (!res.ok) return null
  const ab = await res.arrayBuffer()
  const buffer = Buffer.from(ab)
  const ct = res.headers.get('content-type')?.toLowerCase() || ''
  const extFromCt = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : (ct.includes('jpeg') || ct.includes('jpg')) ? 'jpg' : null
  const m = abs.toLowerCase().match(/\.(png|webp|gif|jpe?g)(\?|#|$)/)
  const ext = extFromCt || (m ? (m[1] === 'jpeg' ? 'jpg' : m[1]) : 'jpg')
  const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 12)
  const file = `${hash}.${ext}`
  await fs.promises.mkdir(imagesDir, { recursive: true })
  const filePath = path.join(imagesDir, file)
  await fs.promises.writeFile(filePath, buffer)
  return filePath
}

function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-')
}

function sqlQuote(s) {
  if (s === null || s === undefined) return 'NULL'
  const str = String(s).replace(/'/g, "''")
  return `'$${1}$`.replace('$1', str).replace(/\$\$/g, "''") // fallback simple quoting
}

function sqlLit(s) {
  if (s === null || s === undefined) return 'NULL'
  const str = String(s).replace(/'/g, "''")
  return `'${str}'`
}

function generateSql(eventId, items, sourceUrl) {
  const lines = []
  lines.push('-- Insert crawled drinks')
  lines.push('BEGIN;')
  for (const it of items) {
    const name = sqlLit(it.name)
    const price = Number(it.price)
    const category = it.category ? sqlLit(it.category) : 'NULL'
    const description = it.description ? sqlLit(it.description) : 'NULL'
    const imageUrl = it.image_url ? sqlLit(it.image_url) : 'NULL'
    const src = sqlLit(sourceUrl)
    const ev = sqlLit(eventId)
    lines.push(
      `INSERT INTO public.drinks (event_id, name, price, category, description, image_url, source_url, is_available)`
      + ` SELECT ${ev}, ${name}, ${price}, ${category}, ${description}, ${imageUrl}, ${src}, true`
      + ` WHERE NOT EXISTS (SELECT 1 FROM public.drinks d WHERE d.event_id = ${ev} AND lower(trim(d.name)) = lower(trim(${name})) AND d.price = ${price});`
    )
  }
  lines.push('COMMIT;')
  return lines.join('\n') + '\n'
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || (!args.url && !args.fromJson)) {
    console.log(usage())
    process.exit(args.url || args.fromJson ? 0 : 1)
  }
  const outPath = args.out || 'crawl.json'
  const format = args.format || 'json'
  const imagesDir = args.imagesDir || 'crawl_images'
  const limit = Math.max(1, Math.min(1000, Number(args.limit) || 300))

  let url = args.url
  let host = ''
  let items = []
  let html = ''
  if (args.fromJson) {
    const raw = await fs.promises.readFile(args.fromJson, 'utf8')
    const payload = JSON.parse(raw)
    url = url || payload?.meta?.source_url || ''
    host = payload?.meta?.host || (url ? (new URL(url)).host : '')
    items = Array.isArray(payload?.items) ? payload.items : []
    if (!items.length) throw new Error('No items in JSON')
  } else {
    url = args.url
    console.error(`Fetching: ${url}${args.headless ? ' (headless)' : ''}`)
    html = args.headless
      ? await fetchHtmlHeadless(url, { waitUntil: args.waitUntil, waitSelector: args.waitSelector, timeoutMs: args.timeoutMs, ua: args.ua })
      : await fetchHtml(url)
    const nextData = parseNextData(html)
    if (!nextData) throw new Error('Could not locate embedded __NEXT_DATA__')
    host = (() => { try { return new URL(url).host } catch { return '' } })()
    items = host.includes('grab.com')
      ? (extractGrabFoodItems(nextData) || [])
      : ((host.includes('shopeefood') || host.includes('foody.vn')) ? (extractShopeeFoodItems(nextData) || []) : (extractFromNextData(nextData) || []))

    items = items.filter(i => i.price && i.price > 0 && i.name.length <= 120)
    if (items.length === 0) throw new Error('No menu items detected')

    if (items.some(i => !i.image_url)) {
      fillMissingImagesFromHtml(html, url, items)
    }
    // Resolve image URLs
    for (const i of items) if (i.image_url) i.image_url = resolveUrlMaybe(i.image_url, url) || i.image_url

    // Limit
    items = items.slice(0, limit)
  }

  // Optionally download images
  if (args.downloadImages) {
    console.error(`Downloading images to: ${imagesDir}`)
    let idx = 0
    const concurrency = 5
    async function worker() {
      while (idx < items.length) {
        const i = idx++
        const it = items[i]
        if (!it.image_url) continue
        try {
          const filePath = await downloadImage(it.image_url, imagesDir, url)
          if (filePath) it.local_image = filePath
        } catch {}
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  }

  // Optional: upload images directly to Supabase Storage and rewrite image_url
  if (args.storageUpload) {
    const supabaseUrl = args.supabaseUrl || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = args.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY
    const bucket = args.storageBucket || 'menu-images'
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials for --storage-upload. Provide --supabase-url/--supabase-key or set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env variables.')
    }
    console.error(`Uploading images to Supabase Storage bucket: ${bucket}`)
    const sb = createClient(supabaseUrl, supabaseKey)
    try {
      const { error } = await sb.storage.createBucket(bucket, { public: true })
      if (error && !String(error.message || '').toLowerCase().includes('already exists')) {
        throw error
      }
    } catch (e) {
      console.error(`Bucket ensure error (continuing): ${e?.message || e}`)
    }

    function pickExt(contentType, srcUrl) {
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

    async function fetchBufferForUpload(srcUrl) {
      try {
        const res = await fetch(srcUrl, {
          headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            ...(url ? { referer: url } : {})
          }
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

    const from = sb.storage.from(bucket)
    const eventFolder = args.eventId || 'misc'
    let idxUp = 0
    const concurrency = 5
    async function workerUpload() {
      while (idxUp < items.length) {
        const i = idxUp++
        const it = items[i]
        const src = it.image_url
        if (!src || !/^https?:\/\//i.test(src)) continue
        if (src.includes('/storage/v1/object/public/')) continue
        const got = await fetchBufferForUpload(src)
        if (!got) continue
        const hash = createHash('sha1').update(got.buffer).digest('hex')
        const ext = pickExt(got.contentType, src)
        const pathKey = `${eventFolder}/${hash}.${ext}`
        const { error: upErr } = await from.upload(pathKey, got.buffer, { contentType: got.contentType || undefined, upsert: false })
        if (upErr && !String(upErr.message || '').toLowerCase().includes('exists')) {
          continue
        }
        const { data } = from.getPublicUrl(pathKey)
        if (data?.publicUrl) {
          it.image_url = data.publicUrl
          it.storage_path = pathKey
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => workerUpload()))
  }

  if (!args.fromJson) {
    const payload = { meta: { source_url: url, host, crawled_at: new Date().toISOString(), count: items.length }, items }
    if (format === 'json' || format === 'both') {
      await fs.promises.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8')
      console.error(`Wrote JSON: ${outPath}`)
    }
  }

  if ((format === 'sql' || format === 'both') && args.eventId) {
    let sql = generateSql(args.eventId, items, url)
    if (args.storageUpload) {
      const ev = sqlLit(args.eventId)
      const updates = []
      updates.push('-- Update existing rows with Storage image URLs')
      updates.push('BEGIN;')
      for (const it of items) {
        if (!it.image_url) continue
        const name = sqlLit(it.name)
        const price = Number(it.price)
        const imageUrl = sqlLit(it.image_url)
        updates.push(`UPDATE public.drinks SET image_url = ${imageUrl} WHERE event_id = ${ev} AND lower(trim(name)) = lower(trim(${name})) AND price = ${price} AND (image_url IS NULL OR image_url NOT LIKE '%/storage/v1/object/public/%');`)
      }
      updates.push('COMMIT;')
      sql = updates.join('\n') + '\n' + sql
    }
    if (args.sqlOut) {
      await fs.promises.writeFile(args.sqlOut, sql, 'utf8')
      console.error(`Wrote SQL: ${args.sqlOut}`)
    } else {
      console.log(sql)
    }
  } else if (format !== 'json' && !args.eventId) {
    console.error('Note: --event-id is required to generate SQL inserts.')
  }

  // Summary to stderr
  const withImages = items.filter(i => !!i.image_url).length
  console.error(`Items: ${items.length} (with images: ${withImages})`)
}

main().catch(err => { console.error(err?.stack || String(err)); process.exit(1) })
