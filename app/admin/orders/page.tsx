"use client";
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Order, Drink, Event } from '@/lib/types'
import AuthGate from '@/components/AuthGate'

type OrderRow = Order & { drink: Drink | null, event: Event | null }

const STATUSES = ['pending', 'confirmed', 'completed'] as const
type Status = typeof STATUSES[number] | 'all'

export default function OrdersPage() {
  return (
    <AuthGate>
      <OrdersInner />
    </AuthGate>
  )
}

function OrdersInner() {
  const [events, setEvents] = useState<Event[]>([])
  const [eventId, setEventId] = useState<string>('')
  const [status, setStatus] = useState<Status>('all')
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const loadEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false })
    setEvents(data || [])
    if (!eventId && data && data.length) setEventId(data[0].id)
  }

  const loadOrders = async (opts?: { evId?: string; st?: Status }) => {
    const evId = opts?.evId ?? eventId
    const st = opts?.st ?? status
    setLoading(true)
    setError(null)
    let q = supabase.from('orders').select('*').order('order_date', { ascending: false }).limit(500)
    if (evId) q = q.eq('event_id', evId)
    if (st && st !== 'all') q = q.eq('status', st)
    const { data, error } = await q
    if (error) setError(error.message)
    // Enrich with joins (client-side for now)
    const drinkIds = Array.from(new Set((data || []).map(o => o.drink_id)))
    const eventIds = Array.from(new Set((data || []).map(o => o.event_id)))
    const { data: drinks } = await supabase.from('drinks').select('*').in('id', drinkIds)
    const { data: events } = await supabase.from('events').select('*').in('id', eventIds)
    const byDrink = new Map((drinks || []).map(d => [d.id, d]))
    const byEvent = new Map((events || []).map(e => [e.id, e]))
    const rows: OrderRow[] = (data || []).map(o => ({
      ...o,
      drink: byDrink.get(o.drink_id) || null,
      event: byEvent.get(o.event_id) || null,
    }))
    setOrders(rows)
    setLoading(false)
  }

  useEffect(() => { loadEvents() }, [])
  useEffect(() => { if (eventId) loadOrders({ evId: eventId }) }, [eventId])
  useEffect(() => { loadOrders({ st: status }) }, [status])

  const nextStatus = (s: string): Status => {
    const idx = STATUSES.indexOf(s as any)
    if (idx < 0 || idx === STATUSES.length - 1) return s as Status
    return STATUSES[idx + 1]
  }

  const updateStatus = async (id: string, newStatus: Status) => {
    if (newStatus === 'all') return
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id)
    if (error) setError(error.message)
    await loadOrders()
  }

  const exportCsv = async () => {
    try {
      setExporting(true)
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Not authenticated')
      if (!eventId) throw new Error('Select an event to export')
      const params = new URLSearchParams({ eventId, status })
      const res = await fetch(`/api/orders/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `Export failed: ${res.status}`)
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Attempt to pull filename from header
      const cd = res.headers.get('content-disposition') || ''
      const m = cd.match(/filename=(.+)$/)
      a.download = m ? m[1] : 'shopping_list.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const countByStatus = useMemo(() => {
    const c: Record<string, number> = {}
    for (const o of orders) c[o.status] = (c[o.status] || 0) + 1
    return c
  }, [orders])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-sm text-slate-600">Manage orders, update status, and export shopping list.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Event</label>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="px-3 py-2 border rounded">
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
        <label className="text-sm ml-4">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="px-3 py-2 border rounded">
          <option value="all">All</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={exportCsv} disabled={!eventId || exporting} className="px-3 py-2 bg-slate-900 text-white rounded text-sm">
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm">Loading...</p>}
      {!loading && (
        <div className="overflow-auto bg-white border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-2">When</th>
                <th className="text-left p-2">Event</th>
                <th className="text-left p-2">Person</th>
                <th className="text-left p-2">Drink</th>
                <th className="text-left p-2">Options</th>
                <th className="text-left p-2">Qty</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">{new Date(o.order_date).toLocaleString()}</td>
                  <td className="p-2">{o.event?.name || '—'}</td>
                  <td className="p-2">{o.person_name}</td>
                  <td className="p-2">{o.drink?.name || '—'}</td>
                  <td className="p-2 text-xs text-slate-500 whitespace-pre-wrap">{o.notes || '—'}</td>
                  <td className="p-2">{o.quantity}</td>
                  <td className="p-2">{o.status}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {o.status !== 'completed' && (
                        <button
                          onClick={() => updateStatus(o.id, nextStatus(o.status))}
                          className="px-2 py-1 border rounded text-xs hover:bg-slate-50"
                          title={`Advance to ${nextStatus(o.status)}`}
                        >Advance</button>
                      )}
                      <select
                        className="text-xs border rounded px-1 py-1"
                        value={o.status}
                        onChange={(e) => updateStatus(o.id, e.target.value as Status)}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <div className="text-xs text-slate-600">
          <span className="mr-3">Counts:</span>
          {['pending','confirmed','completed'].map(s => (
            <span key={s} className="mr-3">{s}: {countByStatus[s] || 0}</span>
          ))}
          <span>Total: {orders.length}</span>
        </div>
      )}
    </div>
  )
}
