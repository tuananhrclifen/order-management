"use client";
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Drink, Event } from '@/lib/types'

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

  return (
    <div className="space-y-6 max-w-2xl">
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

      <form onSubmit={placeOrder} className="grid gap-3 p-4 border rounded bg-white">
        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input className="px-3 py-2 border rounded" placeholder="Your name" required value={form.person_name} onChange={e=>setForm(f=>({...f,person_name:e.target.value}))} />
        <div className="grid sm:grid-cols-2 gap-3">
          <select className="px-3 py-2 border rounded" value={form.drink_id} onChange={e=>setForm(f=>({...f,drink_id:e.target.value}))}>
            {drinks.map(d => (
              <option key={d.id} value={d.id}>{d.name} (${d.price.toFixed(2)})</option>
            ))}
          </select>
          <input className="px-3 py-2 border rounded" placeholder="Quantity" inputMode="numeric" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))} />
        </div>
        <input className="px-3 py-2 border rounded" placeholder="Notes (optional)" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
        <button className="px-3 py-2 bg-slate-900 text-white rounded text-sm w-fit" disabled={loading || drinks.length === 0}>Submit Order</button>
      </form>
    </div>
  )
}

