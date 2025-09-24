import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseService } from '@/lib/supabaseService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Payload = {
  texts: string[]
  sourceLang?: 'vi' | 'ja' | 'en' | string
  targetLang: 'ja' | 'vi' | 'en' | string
  eventId?: string
  sig?: string
}

function normalizeTexts(texts: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of texts || []) {
    const s = (t ?? '').toString()
    if (!s) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

function parseJsonFromString(s: string): any | null {
  // Try strict JSON first
  try { return JSON.parse(s) } catch {}
  // Try to find first {...}
  const m = s.match(/\{[\s\S]*\}/)
  if (m) {
    try { return JSON.parse(m[0]) } catch {}
  }
  return null
}

async function translateWithGemini(texts: string[], targetLang: string, sourceLang?: string): Promise<Record<string, string>> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY
  const model = process.env.TRANSLATE_MODEL || 'gemini-2.0-flash-exp'
  if (!apiKey) {
    // No key: return identity mapping
    const map: Record<string, string> = {}
    for (const t of texts) map[t] = t
    return map
  }

  const sys = [
    `You are a professional menu translator specialising in beverages (coffee, tea, juices, smoothies, toppings, fruits).`,
    `Translate each entry from ${sourceLang || 'auto'} to ${targetLang} using natural ${targetLang} wording while keeping the meaning precise.`,
    `Preserve brand or trademark names, keep units/size codes (ml, L, size S/M/L), and retain add-on indicators such as "extra" or "with pearls".`,
    `Aim for concise drink menu phrasing and avoid adding explanations or punctuation that was not in the original.`,
    `Return ONLY compact JSON with the original strings as keys and their translations as values; no commentary or markdown.`
  ].join(' ')

  const body = {
    contents: [
      {
        parts: [
          { text: sys },
          { text: JSON.stringify({ inputs: texts }, null, 0) }
        ]
      }
    ],
    generationConfig: { temperature: 0 }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
  const data = await res.json().catch(() => null)
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const parsed = parseJsonFromString(text)
  if (!parsed || typeof parsed !== 'object') {
    // Fallback identity mapping
    const map: Record<string, string> = {}
    for (const t of texts) map[t] = t
    return map
  }
  const out: Record<string, string> = {}
  for (const t of texts) out[t] = String(parsed[t] ?? t)
  return out
}

export async function POST(req: NextRequest) {
  try {
    const { texts, sourceLang, targetLang, eventId, sig } = (await req.json()) as Payload
    if (!Array.isArray(texts) || !texts.length) {
      return NextResponse.json({ error: 'texts required' }, { status: 400 })
    }
    if (!targetLang) {
      return NextResponse.json({ error: 'targetLang required' }, { status: 400 })
    }
    const uniq = normalizeTexts(texts).slice(0, 500)

    // Server-side cache in Supabase (optional if eventId & sig are provided)
    const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days
    if (eventId && sig) {
      try {
        const svc = getSupabaseService()
        const { data: row } = await svc
          .from('translation_cache')
          .select('sig, map, updated_at')
          .eq('event_id', eventId)
          .eq('lang', targetLang)
          .single()
        if (row && row.sig === sig && row.updated_at && (Date.now() - new Date(row.updated_at).getTime()) <= CACHE_TTL_MS) {
          return NextResponse.json({ map: row.map })
        }
      } catch {}
    }

    const map = await translateWithGemini(uniq, targetLang, sourceLang)

    if (eventId && sig) {
      try {
        const svc = getSupabaseService()
        await svc
          .from('translation_cache')
          .upsert({ event_id: eventId, lang: targetLang, sig, map, updated_at: new Date().toISOString() })
      } catch {}
    }
    return NextResponse.json({ map })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
