"use client";
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Drink, Event } from '@/lib/types'
import { formatPriceVND } from '@/lib/format'
import AuthGate from '@/components/AuthGate'

export default function DrinksPage() {
  return (
    <AuthGate>
      <DrinksInner />
    </AuthGate>
  )
}

function DrinksInner() {
  const [events, setEvents] = useState<Event[]>([])
  const [eventId, setEventId] = useState<string>('')
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({ name: '', price: '', category: '', description: '' })
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [opsLoading, setOpsLoading] = useState(false)
  const [opsMsg, setOpsMsg] = useState<string | null>(null)

  const selectedEvent = useMemo(() => events.find(e => e.id === eventId) || null, [events, eventId])

  const loadEvents = async () => {
    const { data } = await supabase.from('events').select('*').eq('is_active', true).order('created_at', { ascending: false })
    setEvents(data || [])
    if (!eventId && data && data.length) setEventId(data[0].id)
  }

  const loadDrinks = async (evId: string) => {
    setLoading(true)
    const { data, error } = await supabase.from('drinks').select('*').eq('event_id', evId).order('created_at', { ascending: false })
    if (error) setError(error.message)
    setDrinks(data || [])
    setLoading(false)
  }

  useEffect(() => { loadEvents() }, [])
  useEffect(() => { if (eventId) loadDrinks(eventId) }, [eventId])

  const addDrink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!eventId) return setError('Select an event')
    const payload = {
      event_id: eventId,
      name: form.name,
      price: Number(form.price),
      category: form.category || null,
      description: form.description || null,
      is_available: true,
    }
    const { error } = await supabase.from('drinks').insert(payload)
    if (error) return setError(error.message)
    setForm({ name: '', price: '', category: '', description: '' })
    await loadDrinks(eventId)
  }

  const importFromUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    setImportMsg(null)
    setError(null)
    if (!eventId) return setError('Select an event')
    try {
      setImporting(true)
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      const res = await fetch('/api/crawl/ingest', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: importUrl, eventId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Import failed')
      setImportMsg(`Imported ${data.inserted} items`)
      setImportUrl('')
      await loadDrinks(eventId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  const migrateImages = async () => {
    setOpsMsg(null)
    setError(null)
    if (!eventId) return setError('Select an event')
    try {
      setOpsLoading(true)
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      const res = await fetch('/api/admin/images/migrate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ eventId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Migration failed')
      setOpsMsg(`Migrated ${data.migrated} images; skipped ${data.skipped}.`)
      await loadDrinks(eventId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setOpsLoading(false)
    }
  }

  const clearAllDrinks = async () => {
    setOpsMsg(null)
    setError(null)
    if (!eventId) return setError('Select an event')
    const ack = window.prompt('Type DELETE to remove ALL drinks for this event. This also removes related orders. Type DELETE to confirm:')
    if (ack !== 'DELETE') return
    try {
      setOpsLoading(true)
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      const res = await fetch('/api/admin/drinks/clear', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ eventId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Delete failed')
      setOpsMsg(`Deleted ${data.deleted} drinks for the event.`)
      await loadDrinks(eventId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setOpsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Drinks</h1>
        <p className="text-sm text-slate-600">Add drinks to an event menu.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Event</label>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="px-3 py-2 border rounded">
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
      </div>

      <form onSubmit={addDrink} className="grid gap-3 max-w-xl p-4 border rounded bg-white">
        <h2 className="font-semibold">Add Drink</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input className="px-3 py-2 border rounded" placeholder="Name" required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
        <input className="px-3 py-2 border rounded" placeholder="Price" inputMode="decimal" required value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} />
        <div className="grid sm:grid-cols-2 gap-3">
          <input className="px-3 py-2 border rounded" placeholder="Category (optional)" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} />
          <input className="px-3 py-2 border rounded" placeholder="Description (optional)" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
        </div>
        <button className="px-3 py-2 bg-slate-900 text-white rounded text-sm w-fit">Add</button>
      </form>

      <form onSubmit={importFromUrl} className="grid gap-3 max-w-2xl p-4 border rounded bg-white">
        <h2 className="font-semibold">Import From URL</h2>
        <p className="text-xs text-slate-600">Paste a restaurant/menu URL (e.g., GrabFood). We will attempt to extract items and add them to the selected event.</p>
        {importMsg && <p className="text-sm text-green-700">{importMsg}</p>}
        {error && !importMsg && !opsMsg && <p className="text-sm text-red-600">{error}</p>}
        <div className="grid sm:grid-cols-5 gap-3">
          <input className="px-3 py-2 border rounded sm:col-span-4" placeholder="https://..." value={importUrl} onChange={e=>setImportUrl(e.target.value)} />
          <button disabled={importing} className="px-3 py-2 bg-slate-900 text-white rounded text-sm" >{importing ? 'Importing...' : 'Import'}</button>
        </div>
        <p className="text-xs text-slate-500">Note: Respect website terms. Only import data you have rights to use.</p>
      </form>

      <div className="grid gap-3 max-w-2xl p-4 border rounded bg-white">
        <h2 className="font-semibold">Utilities</h2>
        {opsMsg && <p className="text-sm text-green-700">{opsMsg}</p>}
        {error && !importMsg && !opsMsg && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button onClick={migrateImages} disabled={opsLoading || !eventId} className="px-3 py-2 border rounded text-sm hover:bg-slate-50">{opsLoading ? 'Working...' : 'Migrate Images to Storage'}</button>
          <button onClick={clearAllDrinks} disabled={opsLoading || !eventId} className="px-3 py-2 border rounded text-sm text-red-600 hover:bg-red-50">{opsLoading ? 'Working...' : 'Delete ALL Drinks'}</button>
        </div>
        <p className="text-xs text-slate-500">Delete ALL will also remove related orders via cascade. This cannot be undone.</p>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Menu</h2>
        {loading && <p className="text-sm">Loading...</p>}
        {!loading && drinks.length === 0 && <p className="text-sm text-slate-600">No drinks yet.</p>}
        <ul className="divide-y bg-white border rounded">
          {drinks.map(d => (
            <li key={d.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{d.name}</p>
                <p className="text-xs text-slate-600">{formatPriceVND(d.price)} {d.category ? `• ${d.category}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs border rounded px-2 py-1">{d.is_available ? 'Available' : 'Unavailable'}</span>
                <button
                  onClick={async () => { await supabase.from('drinks').delete().eq('id', d.id); if (eventId) await loadDrinks(eventId) }}
                  className="text-xs px-2 py-1 border rounded text-red-600 hover:bg-red-50"
                  title="Delete"
                >Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
