"use client";
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Drink, Event } from '@/lib/types'
import { formatPriceVND } from '@/lib/format'

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
  const [cart, setCart] = useState<Cart>({})
  const [search, setSearch] = useState('')

  // Language and translations
  type Lang = 'vi' | 'ja'
  const [lang, setLang] = useState<Lang>('vi')
  const [tmap, setTmap] = useState<Record<string, string>>({})

  const selectedEvent = useMemo(() => events.find(e => e.id === eventId) || null, [events, eventId])

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
  }, [])

  // Listen to language changes from header switch
  useEffect(() => {
    const saved = (typeof window !== 'undefined' && window.localStorage.getItem('ddos.lang')) as Lang | null
    if (saved === 'ja' || saved === 'vi') setLang(saved)
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
      setLoading(false)
    }
    loadDrinks()
  }, [eventId])

  // When lang is JA, fetch translations for names + categories
  useEffect(() => {
    const fetchTranslations = async () => {
      if (lang !== 'ja' || drinks.length === 0) { setTmap({}); return }
      const set: Set<string> = new Set()
      for (const d of drinks) { set.add(d.name); if (d.category) set.add(d.category) }
      set.add('Other')
      const texts = Array.from(set)
      try {
        const res = await fetch('/api/translate', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ texts, sourceLang: 'vi', targetLang: 'ja' })
        })
        const j = await res.json()
        if (res.ok && j?.map) setTmap(j.map)
        else setTmap({})
      } catch { setTmap({}) }
    }
    fetchTranslations()
  }, [lang, drinks])

  const increment = (drinkId: string) => {
    setCart(prev => ({ ...prev, [drinkId]: (prev[drinkId] || 0) + 1 }))
    setMessage(null); setError(null)
  }

  const decrement = (drinkId: string) => {
    setCart(prev => {
      const current = prev[drinkId] || 0
      const next = Math.max(0, current - 1)
      const clone = { ...prev }
      if (next === 0) delete clone[drinkId]
      else clone[drinkId] = next
      return clone
    })
    setMessage(null); setError(null)
  }

  const cartItems = useMemo(() => {
    const map: { id: string; drink: Drink; quantity: number; lineTotal: number }[] = []
    for (const [id, qty] of Object.entries(cart)) {
      const drink = drinks.find(d => d.id === id)
      if (!drink || qty <= 0) continue
      map.push({ id, drink, quantity: qty, lineTotal: qty * drink.price })
    }
    return map.sort((a, b) => a.drink.name.localeCompare(b.drink.name))
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
      const name = d.name.toLowerCase()
      const cat = (d.category || '').toLowerCase()
      return name.includes(q) || (!!cat && cat.includes(q))
    })
  }, [drinks, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Drink[]>()
    for (const d of filteredDrinks) {
      const keyVi = (d.category?.trim() || 'Other')
      const key = lang === 'ja' ? (tmap[keyVi] || keyVi) : keyVi
      const arr = map.get(key) || []
      arr.push(d)
      map.set(key, arr)
    }
    const entries = Array.from(map.entries())
    entries.sort((a, b) => {
      const aKey = a[0]
      const bKey = b[0]
      const aIsOther = aKey.toLowerCase() === 'other'
      const bIsOther = bKey.toLowerCase() === 'other'
      if (aIsOther && !bIsOther) return 1
      if (!aIsOther && bIsOther) return -1
      return aKey.localeCompare(bKey)
    })
    return entries
  }, [filteredDrinks, lang, tmap])

  const submitCart = async () => {
    setMessage(null)
    setError(null)
    if (!eventId) return setError('Please select an event')
    if (!form.person_name.trim()) return setError('Please enter your name')
    if (cartItems.length === 0) return setError('Please add at least one item')

    const rows = cartItems.map(it => ({
      event_id: eventId,
      drink_id: it.id,
      person_name: form.person_name.trim(),
      quantity: it.quantity,
      status: 'pending' as const,
      notes: null as string | null,
    }))

    setSubmitting(true)
    const { error } = await supabase.from('orders').insert(rows)
    setSubmitting(false)
    if (error) return setError(error.message)
    setMessage('Order submitted!')
    setCart({})
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Place an Order</h1>
        <p className="text-sm text-slate-600">Select an event, add quantities, and submit.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Event</label>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="px-3 py-2 border rounded">
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or category"
            className="px-3 py-2 border rounded w-64"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-sm px-3 py-2 border rounded hover:bg-slate-50">Clear</button>
          )}
        </div>
      </div>

      <div className="grid gap-3 p-4 border rounded bg-white">
        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          className="px-3 py-2 border rounded max-w-md"
          placeholder="Your name"
          required
          value={form.person_name}
          onChange={e=>setForm(f=>({...f,person_name:e.target.value}))}
        />
        <p className="text-xs text-slate-600">
          Use + / - to adjust quantities. Submit when ready.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="grid gap-4 order-2 xl:order-1">
          {loading && <p className="text-sm">Loading...</p>}
          {!loading && filteredDrinks.length === 0 && (
            <p className="text-sm text-slate-600">No items match your search.</p>
          )}
          {!loading && grouped.map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-700">{category}</h3>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map(d => {
                  const qty = cart[d.id] || 0
                  const name = lang === 'ja' ? (tmap[d.name] || d.name) : d.name
                  return (
                    <div key={d.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border hover:shadow-sm">
                      <div className="w-24 h-24 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                        {d.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={d.image_url} alt={d.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">No image</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{name}</p>
                        <p className="text-slate-600 mt-2 font-semibold">{formatPriceVND(d.price)}</p>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          onClick={() => decrement(d.id)}
                          className={`w-9 h-9 inline-flex items-center justify-center rounded-full border ${qty === 0 ? 'text-slate-300 border-slate-200 cursor-not-allowed' : 'text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                          aria-label={`Decrease ${d.name}`}
                          disabled={qty === 0}
                        >-</button>
                        <span className="min-w-[1.5rem] text-center font-medium">{qty}</span>
                        <button
                          onClick={() => increment(d.id)}
                          className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-emerald-500 text-white text-xl hover:bg-emerald-600"
                          aria-label={`Increase ${d.name}`}
                        >+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="order-1 xl:order-2">
          <div className="grid gap-3 p-4 border rounded bg-white xl:sticky xl:top-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Cart Summary</h2>
              <div className="text-sm text-slate-600">{totals.totalQty} items</div>
            </div>

            {cartItems.length === 0 ? (
              <p className="text-sm text-slate-500">Your cart is empty. Add some drinks.</p>
            ) : (
              <div className="space-y-2">
                {cartItems.map(it => {
                  const name = lang === 'ja' ? (tmap[it.drink.name] || it.drink.name) : it.drink.name
                  return (
                  <div key={it.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-slate-600">x{it.quantity}</div>
                      <div className="font-medium">{formatPriceVND(it.lineTotal)}</div>
                    </div>
                  </div>
                )})}
                <div className="pt-2 mt-2 border-t flex items-center justify-between">
                  <div className="text-sm text-slate-600">Total</div>
                  <div className="text-lg font-semibold">{formatPriceVND(totals.totalPrice)}</div>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={submitCart}
                disabled={submitting || cartItems.length === 0 || !form.person_name.trim()}
                className={`px-4 py-2 rounded text-white ${submitting || cartItems.length === 0 || !form.person_name.trim() ? 'bg-emerald-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
                {submitting ? 'Submitting...' : 'Submit Order'}
              </button>
              {cartItems.length > 0 && (
                <button
                  onClick={() => setCart({})}
                  disabled={submitting}
                  className="px-3 py-2 rounded border text-slate-700 hover:bg-slate-50"
                >Clear</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
