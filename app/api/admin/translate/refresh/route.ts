import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { getSupabaseService } from '@/lib/supabaseService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseAllowed(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

type Lang = 'ja' | 'en'

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
  try { return JSON.parse(s) } catch {}
  const m = s.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch {} }
  return null
}

async function translateWithGemini(texts: string[], targetLang: string, sourceLang?: string): Promise<Record<string, string>> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY
  const model = process.env.TRANSLATE_MODEL || 'gemini-2.0-flash-exp'
  if (!apiKey) {
    const map: Record<string, string> = {}
    for (const t of texts) map[t] = t
    return map
  }
  const sys = `You are a professional translator. Translate from ${sourceLang || 'auto'} to ${targetLang}. ` +
    `Return ONLY compact JSON mapping without commentary, where keys are original strings and values are translations. ` +
    `Preserve brand/product names if they are proper nouns; do not add extra punctuation.`
  const body = {
    contents: [ { parts: [ { text: sys }, { text: JSON.stringify({ inputs: texts }, null, 0) } ] } ],
    generationConfig: { temperature: 0 }
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
  const data = await res.json().catch(() => null)
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const parsed = parseJsonFromString(text)
  if (!parsed || typeof parsed !== 'object') {
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
    const { eventId, lang } = await req.json()
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

    // Admin auth via Supabase token
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
    const { data: rows, error } = await svc
      .from('drinks')
      .select('name, category')
      .eq('event_id', eventId)
      .eq('is_available', true)
      .limit(5000)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const set = new Set<string>()
    for (const r of rows || []) { if ((r as any).name) set.add((r as any).name); if ((r as any).category) set.add((r as any).category) }
    set.add('Other')
    const texts = Array.from(set).sort()
    const sig = JSON.stringify(texts)
    const langs: Lang[] = (lang === 'ja' || lang === 'en') ? [lang] : ['ja', 'en']

    const refreshed: Record<string, number> = {}
    for (const L of langs) {
      const map = await translateWithGemini(texts, L, 'vi')
      await svc
        .from('translation_cache')
        .upsert({ event_id: eventId, lang: L, sig, map, updated_at: new Date().toISOString() })
      refreshed[L] = Object.keys(map).length
    }

    return NextResponse.json({ ok: true, refreshed, sig, count: texts.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

