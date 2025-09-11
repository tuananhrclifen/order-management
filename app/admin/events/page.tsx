"use client";
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Event } from '@/lib/types'
import AuthGate from '@/components/AuthGate'

export default function EventsPage() {
  return (
    <AuthGate>
      <EventsInner />
    </AuthGate>
  )
}

function EventsInner() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', description: '', start_date: '', end_date: '' })
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    setEvents(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const payload = {
      name: form.name,
      description: form.description || null,
      start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      is_active: true,
    }
    const { error } = await supabase.from('events').insert(payload)
    if (error) return setError(error.message)
    setForm({ name: '', description: '', start_date: '', end_date: '' })
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Events</h1>
        <p className="text-sm text-slate-600">Create and manage ordering events.</p>
      </div>

      <form onSubmit={createEvent} className="grid gap-3 max-w-xl p-4 border rounded bg-white">
        <h2 className="font-semibold">Create Event</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input className="px-3 py-2 border rounded" placeholder="Name" required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
        <textarea className="px-3 py-2 border rounded" placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
        <div className="grid sm:grid-cols-2 gap-3">
          <input type="date" className="px-3 py-2 border rounded" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} />
          <input type="date" className="px-3 py-2 border rounded" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))} />
        </div>
        <button className="px-3 py-2 bg-slate-900 text-white rounded text-sm w-fit">Create</button>
      </form>

      <div className="space-y-2">
        <h2 className="font-semibold">Existing Events</h2>
        {loading && <p className="text-sm">Loading...</p>}
        {!loading && events.length === 0 && <p className="text-sm text-slate-600">No events yet.</p>}
        <ul className="divide-y bg-white border rounded">
          {events.map(ev => (
            <li key={ev.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{ev.name}</p>
                <p className="text-xs text-slate-600">{ev.is_active ? 'Active' : 'Inactive'} • {new Date(ev.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs border rounded px-2 py-1">{ev.start_date ? new Date(ev.start_date).toLocaleDateString() : '—'} → {ev.end_date ? new Date(ev.end_date).toLocaleDateString() : '—'}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

