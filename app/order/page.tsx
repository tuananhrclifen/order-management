"use client";
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Drink, Event } from '@/lib/types'
import { formatPriceVND } from '@/lib/format'
import ChristmasDecor from '@/components/ChristmasDecor'

type OrderForm = { person_name: string }

type Cart = Record<string, number>

export default function OrderPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [eventId, setEventId] = useState<string>('')
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<OrderForm>({ person_name: '' })
  const [nameTouched, setNameTouched] = useState(false)
  const [cart, setCart] = useState<Cart>({})
  const [selectedOptions, setSelectedOptions] = useState<Record<string, { size: string, sugar: string }>>({})
  const [search, setSearch] = useState('')

  // Language and translations
  type Lang = 'vi' | 'ja' | 'en'
  const [lang, setLang] = useState<Lang>('vi')
  const [tmap, setTmap] = useState<Record<string, string>>({})
  const [tloading, setTloading] = useState(false)
  const nameError = nameTouched && !form.person_name.trim()
  const nameInputClasses = `px-3 py-2 border rounded max-w-md focus:outline-none focus:ring-2 ${nameError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'focus:ring-emerald-200 focus:border-emerald-400'}`

  // Cache helpers for translations
  const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days
  const cacheKey = useMemo(() => (evId: string, target: string) => `ddos.tmap.${evId || 'none'}.${target}`, [])
  const loadCache = useMemo(() => (evId: string, target: string, sig: string): Record<string, string> | null => {
    try {
      const raw = localStorage.getItem(cacheKey(evId, target))
      if (!raw) return null
      const obj = JSON.parse(raw)
      if (!obj || typeof obj !== 'object') return null
      if (obj.sig !== sig) return null
      if (typeof obj.ts !== 'number' || Date.now() - obj.ts > CACHE_TTL_MS) return null
      if (!obj.map || typeof obj.map !== 'object') return null
      return obj.map as Record<string, string>
    } catch { return null }
  }, [cacheKey, CACHE_TTL_MS])
  const saveCache = useMemo(() => (evId: string, target: string, sig: string, map: Record<string, string>) => {
    try { localStorage.setItem(cacheKey(evId, target), JSON.stringify({ ts: Date.now(), sig, map })) } catch {}
  }, [cacheKey])

  useEffect(() => {
    const loadEvents = async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      setEvents(data || [])
      if (!eventId && data && data.length) setEventId(data[0].id)
    }
    loadEvents()
  }, [eventId])

  // Listen to language changes from header switch
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && window.localStorage.getItem('ddos.lang')) as Lang | null
    if (saved === 'ja' || saved === 'vi' || saved === 'en') setLang(saved)
    const onChange = (e: any) => setLang((e?.detail?.lang as Lang) || 'vi')
    window.addEventListener('ddos:lang-change', onChange as any)
    return () => window.removeEventListener('ddos:lang-change', onChange as any)
  }, [])

  useEffect(() => {
    const loadDrinks = async () => {
      if (!eventId) return
      setLoading(true)
      const { data } = await supabase
        .from('drinks')
        .select('*')
        .eq('event_id', eventId)
        .eq('is_available', true)
        .order('name')
      setDrinks(data || [])
      setCart({})
      setSelectedOptions({})
      setLoading(false)
    }
    loadDrinks()
  }, [eventId])

  const getCompositeKey = (drinkId: string) => {
    const opts = selectedOptions[drinkId] || { size: 'M', sugar: '100%' }
    return `${drinkId}|${opts.size}|${opts.sugar}`
  }

  // When lang is JA/EN, fetch translations for names + categories (with local cache)
  useEffect(() => {
    const fetchTranslations = async () => {
      if ((lang !== 'ja' && lang !== 'en') || drinks.length === 0) { setTmap({}); return }
      // Build a stable signature of texts (names + categories + 'Other') to cache per event+lang
      const set: Set<string> = new Set()
      for (const d of drinks) { set.add(d.name); if (d.category) set.add(d.category) }
      set.add('Other')
      const texts = Array.from(set).sort()
      const sig = JSON.stringify(texts)

      // Try cache first
      try {
        const cached = loadCache(eventId, lang, sig)
        if (cached) { setTmap(cached); return }
      } catch {}

      try {
        setTloading(true)
        const res = await fetch('/api/translate', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ texts, sourceLang: 'vi', targetLang: lang, eventId, sig })
        })
        const j = await res.json()
        if (res.ok && j?.map) { setTmap(j.map); saveCache(eventId, lang, sig, j.map) }
        else setTmap({})
      } catch { setTmap({}) }
      finally { setTloading(false) }
    }
    fetchTranslations()
  }, [lang, drinks, eventId, loadCache, saveCache])

  const increment = (drinkId: string) => {
    const key = getCompositeKey(drinkId)
    setCart(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
    setMessage(null); setError(null)
  }

  const decrement = (drinkId: string) => {
    const key = getCompositeKey(drinkId)
    setCart(prev => {
      const current = prev[key] || 0
      const next = Math.max(0, current - 1)
      const clone = { ...prev }
      if (next === 0) delete clone[key]
      else clone[key] = next
      return clone
    })
    setMessage(null); setError(null)
  }

  const updateOption = (drinkId: string, type: 'size' | 'sugar', value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [drinkId]: {
        ...(prev[drinkId] || { size: 'M', sugar: '100%' }),
        [type]: value
      }
    }))
  }

  const cartItems = useMemo(() => {
    const list: { id: string; drinkId: string; drink: Drink; quantity: number; lineTotal: number; options: { size: string; sugar: string } }[] = []
    for (const [key, qty] of Object.entries(cart)) {
      const [drinkId, size, sugar] = key.split('|')
      const drink = drinks.find(d => d.id === drinkId)
      if (!drink || qty <= 0) continue
      list.push({ 
        id: key, 
        drinkId,
        drink, 
        quantity: qty, 
        lineTotal: qty * drink.price,
        options: { size, sugar }
      })
    }
    return list.sort((a, b) => a.drink.name.localeCompare(b.drink.name))
  }, [cart, drinks])

  const totals = useMemo(() => {
    const totalQty = cartItems.reduce((sum, it) => sum + it.quantity, 0)
    const totalPrice = cartItems.reduce((sum, it) => sum + it.lineTotal, 0)
    return { totalQty, totalPrice }
  }, [cartItems])

  const filteredDrinks = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return drinks
    return drinks.filter(d => {
      const nameVi = d.name.toLowerCase()
      const catVi = (d.category || '').toLowerCase()
      const nameT = (tmap[d.name] || '').toLowerCase()
      const catT = (d.category ? (tmap[d.category] || '') : '').toLowerCase()
      return nameVi.includes(q) || (!!catVi && catVi.includes(q)) || (!!nameT && nameT.includes(q)) || (!!catT && catT.includes(q))
    })
  }, [drinks, search, tmap])

  const grouped = useMemo(() => {
    const map = new Map<string, Drink[]>()
    for (const d of filteredDrinks) {
      const keyVi = (d.category?.trim() || 'Other')
      const key = (lang === 'ja' || lang === 'en') ? (tmap[keyVi] || keyVi) : keyVi
      const arr = map.get(key) || []
      arr.push(d)
      map.set(key, arr)
    }
    const entries = Array.from(map.entries())
    entries.sort((a, b) => {
      // Get original VI category from the first item in each group to ensure consistent sorting across languages
      const aCatVi = (a[1][0]?.category || 'Other').toLowerCase()
      const bCatVi = (b[1][0]?.category || 'Other').toLowerCase()

      const priorityCats = ['ưu đãi hôm nay', 'dành cho bạn', 'món mới', 'best seller', 'new', 'hot']
      const toppingCats = ['chọn topping thêm', 'topping']

      const aIsTopping = toppingCats.some(tc => aCatVi.includes(tc))
      const bIsTopping = toppingCats.some(tc => bCatVi.includes(tc))
      if (aIsTopping && !bIsTopping) return 1
      if (!aIsTopping && bIsTopping) return -1

      const aIsPriority = priorityCats.some(pc => aCatVi.includes(pc))
      const bIsPriority = priorityCats.some(pc => bCatVi.includes(pc))
      if (aIsPriority && !bIsPriority) return -1
      if (!aIsPriority && bIsPriority) return 1

      // Fallback to sorting by the displayed category name
      return a[0].localeCompare(b[0])
    })
    return entries
  }, [filteredDrinks, lang, tmap])

  const submitCart = async () => {
    setMessage(null)
    setError(null)
    setNameTouched(true)
    if (!eventId) return setError('Please select an event')
    if (!form.person_name.trim()) return setError('Please enter your name')
    if (cartItems.length === 0) return setError('Please add at least one item')

    const rows = cartItems.map(it => ({
      event_id: eventId,
      drink_id: it.drinkId,
      person_name: form.person_name.trim(),
      quantity: it.quantity,
      status: 'pending' as const,
      notes: `Size: ${it.options.size}, Sugar: ${it.options.sugar}`,
    }))

    setSubmitting(true)
    const { error } = await supabase.from('orders').insert(rows)
    setSubmitting(false)
    if (error) return setError(error.message)
    setMessage('Order submitted!')
    setCart({})
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-100 via-slate-50 to-emerald-50/30 p-4 sm:p-6 rounded-3xl relative overflow-hidden">
      <ChristmasDecor />
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-green-500 to-red-500" />
      
      <div className="space-y-6 relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-red-700 drop-shadow-sm flex items-center gap-2">
              <span>🎄</span> Place an Order
            </h1>
            <p className="text-sm text-slate-600 mt-1">Select an event, add quantities, and submit.</p>
          </div>
          <div className="text-2xl animate-bounce">🎅</div>
        </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Event</label>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="px-3 py-2 border rounded shadow-sm bg-white/80 backdrop-blur">
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or category"
            className="px-3 py-2 border rounded w-64 shadow-sm bg-white/80 backdrop-blur focus:ring-red-200"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-sm px-3 py-2 border rounded hover:bg-slate-50 bg-white/80">Clear</button>
          )}
        </div>
      </div>

      <div className="grid gap-3 p-4 border rounded-xl bg-white/90 shadow-sm backdrop-blur-sm border-red-100">
        {message && <p className="text-sm text-green-700 font-medium flex items-center gap-2">✅ {message}</p>}
        {error && <p className="text-sm text-red-600 font-medium flex items-center gap-2">⚠️ {error}</p>}
        {tloading && (lang === 'ja' || lang === 'en') && (
          <p className="text-sm text-slate-600 animate-pulse">Translating...</p>
        )}
        <input
          className={nameInputClasses}
          placeholder="Your name"
          required
          value={form.person_name}
          onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))}
          onBlur={() => setNameTouched(true)}
          aria-invalid={nameError ? 'true' : 'false'}
          aria-describedby="order-name-error"
        />
        {nameError && (
          <p id="order-name-error" className="text-xs text-red-600">Please enter your name.</p>
        )}
        <p className="text-xs text-slate-600">
          Use + / - to adjust quantities. Submit when ready.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px] pb-32 xl:pb-0">
        <div className="grid gap-4 order-2 xl:order-1">
          {loading && <p className="text-sm animate-pulse">Loading menu...</p>}
          {!loading && filteredDrinks.length === 0 && (
            <div className="text-center py-10">
               <p className="text-4xl mb-2">🎁</p>
               <p className="text-slate-600">No items match your search.</p>
            </div>
          )}
          {!loading && grouped.map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-lg font-bold text-green-800 border-b border-green-200 pb-1 flex items-center gap-2">
                <span className="text-red-500">❄</span> {category}
              </h3>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map(d => {
                  const key = getCompositeKey(d.id)
                  const qty = cart[key] || 0
                  const name = (lang === 'ja' || lang === 'en') ? (tmap[d.name] || d.name) : d.name
                  const currentOpts = selectedOptions[d.id] || { size: 'M', sugar: '100%' }
                  
                  return (
                    <div key={d.id} className="flex flex-col p-4 bg-white/95 rounded-xl border border-slate-100 hover:shadow-md transition-shadow hover:border-red-100 group">
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-24 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 relative">
                          {d.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={d.image_url} alt={d.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">No image</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium flex items-center gap-2 whitespace-normal break-words text-slate-800">
                            <span className="whitespace-normal break-words leading-tight">{name}</span>
                            {lang !== 'vi' && (
                              <span className="shrink-0 inline-flex items-center rounded bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider">
                                {lang === 'ja' ? 'JP' : 'EN'}
                              </span>
                            )}
                          </p>
                          <p className="text-red-600 mt-1 font-bold">{formatPriceVND(d.price)}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            onClick={() => decrement(d.id)}
                            className={`w-8 h-8 inline-flex items-center justify-center rounded-full border ${qty === 0 ? 'text-slate-300 border-slate-200 cursor-not-allowed' : 'text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                            aria-label={`Decrease ${d.name}`}
                            disabled={qty === 0}
                          >-</button>
                          <span className="min-w-[1.2rem] text-center font-medium">{qty}</span>
                          <button
                            onClick={() => increment(d.id)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-emerald-600 text-white text-xl hover:bg-emerald-700 shadow-sm hover:shadow"
                            aria-label={`Increase ${d.name}`}
                          >+</button>
                        </div>
                      </div>

                      {/* Options Selection */}
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-50">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chọn SIZE</label>
                          <select 
                            value={currentOpts.size}
                            onChange={(e) => updateOption(d.id, 'size', e.target.value)}
                            className="w-full text-xs bg-slate-50 border-none rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-200 outline-none"
                          >
                            <option value="M">Size M</option>
                            <option value="L">Size L</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mức đường</label>
                          <select 
                            value={currentOpts.sugar}
                            onChange={(e) => updateOption(d.id, 'sugar', e.target.value)}
                            className="w-full text-xs bg-slate-50 border-none rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-200 outline-none"
                          >
                            <option value="100%">100%</option>
                            <option value="70%">70%</option>
                            <option value="50%">50%</option>
                            <option value="30%">30%</option>
                            <option value="0%">0%</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="order-1 xl:order-2 w-full">
          <div className="grid gap-3 p-4 bg-white/95 border-t border-red-100 shadow-xl sticky bottom-0 z-30 sm:border sm:rounded-xl sm:shadow-lg xl:shadow-sm xl:sticky xl:top-4 xl:bottom-auto backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-3">
              <h2 className="font-bold text-slate-800">🎁 Cart Summary</h2>
              <div className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded-full">{totals.totalQty} items</div>
            </div>

            {cartItems.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <p className="text-2xl mb-1">🛒</p>
                <p className="text-sm">Your cart is empty.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                {cartItems.map(it => {
                  const name = (lang === 'ja' || lang === 'en') ? (tmap[it.drink.name] || it.drink.name) : it.drink.name
                  return (
                  <div key={it.id} className="flex flex-col text-sm border-b border-slate-50 pb-2 last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-medium text-slate-800 whitespace-normal break-words leading-tight">
                          {name}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {it.options.size} • {it.options.sugar} đường
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-xs text-slate-500 font-mono">x{it.quantity}</div>
                        <div className="font-medium">{formatPriceVND(it.lineTotal)}</div>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            )}
            
            {cartItems.length > 0 && (
              <div className="pt-3 mt-1 border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm text-slate-600 font-medium">Total</div>
                <div className="text-lg font-bold text-red-600">{formatPriceVND(totals.totalPrice)}</div>
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={submitCart}
                disabled={submitting || cartItems.length === 0 || !form.person_name.trim()}
                className={`flex-1 px-4 py-3 rounded-xl text-white font-bold shadow-md transition-all ${submitting || cartItems.length === 0 || !form.person_name.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 hover:shadow-lg hover:-translate-y-0.5'}`}
              >
                {submitting ? 'Sending to Santa...' : 'Submit Order 🎅'}
              </button>
              {cartItems.length > 0 && (
                <button
                  onClick={() => setCart({})}
                  disabled={submitting}
                  className="px-3 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  aria-label="Clear cart"
                >🗑️</button>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
