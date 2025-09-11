"use client";
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Drink, Event } from '@/lib/types'
import { formatPriceVND } from '@/lib/format'

type OrderForm = { person_name: string; drink_id: string; quantity: string; notes: string }

export default function OrderPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [eventId, setEventId] = useState<string>('')
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<OrderForm>({ person_name: '', drink_id: '', quantity: '1', notes: '' })

  const selectedEvent = useMemo(() => events.find(e => e.id === eventId) || null, [events, eventId])

  useEffect(() => {
    const loadEvents = async () => {
      const { data } = await supabase.from('events').select('*').eq('is_active', true).order('created_at', { ascending: false })
      setEvents(data || [])
      if (!eventId && data && data.length) setEventId(data[0].id)
    }
    loadEvents()
  }, [])

  useEffect(() => {
    const loadDrinks = async () => {
      if (!eventId) return
      setLoading(true)
      const { data } = await supabase.from('drinks').select('*').eq('event_id', eventId).eq('is_available', true).order('name')
      setDrinks(data || [])
      if (data && data.length) setForm(f => ({ ...f, drink_id: f.drink_id || data[0].id }))
      setLoading(false)
    }
    loadDrinks()
  }, [eventId])

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setError(null)
    if (!eventId || !form.drink_id) return setError('Please select a drink')
    const payload = {
      event_id: eventId,
      drink_id: form.drink_id,
      person_name: form.person_name,
      quantity: Number(form.quantity || '1'),
      status: 'pending',
      notes: form.notes || null,
    }
    const { error } = await supabase.from('orders').insert(payload)
    if (error) return setError(error.message)
    setMessage('Order submitted!')
    setForm({ person_name: '', drink_id: drinks[0]?.id || '', quantity: '1', notes: '' })
  }

  const quickAdd = async (drinkId: string) => {
    setError(null); setMessage(null)
    if (!form.person_name) return setError('Please enter your name first')
    const payload = {
      event_id: eventId,
      drink_id: drinkId,
      person_name: form.person_name,
      quantity: 1,
      status: 'pending' as const,
      notes: null as string | null,
    }
    const { error } = await supabase.from('orders').insert(payload)
    if (error) return setError(error.message)
    setMessage('Added to orders!')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Place an Order</h1>
        <p className="text-sm text-slate-600">Select an event and choose your drink.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Event</label>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="px-3 py-2 border rounded">
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 p-4 border rounded bg-white">
        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input className="px-3 py-2 border rounded max-w-md" placeholder="Your name" required value={form.person_name} onChange={e=>setForm(f=>({...f,person_name:e.target.value}))} />
        <p className="text-xs text-slate-600">Tap + to add an item (1 quantity).</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {drinks.map(d => (
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
              <p className="font-medium truncate">{d.name}</p>
              <p className="text-slate-600 mt-2 font-semibold">{formatPriceVND(d.price)}</p>
            </div>
            <button
              onClick={() => quickAdd(d.id)}
              className="ml-auto inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500 text-white text-xl hover:bg-emerald-600"
              aria-label={`Add ${d.name}`}
            >+</button>
          </div>
        ))}
      </div>
    </div>
  )
}
