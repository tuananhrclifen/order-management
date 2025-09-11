"use client";
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Order, Drink, Event } from '@/lib/types'
import AuthGate from '@/components/AuthGate'

type OrderRow = Order & { drink: Drink | null, event: Event | null }

export default function OrdersPage() {
  return (
    <AuthGate>
      <OrdersInner />
    </AuthGate>
  )
}

function OrdersInner() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('order_date', { ascending: false })
      .limit(200)
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

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-sm text-slate-600">Recent orders across events.</p>
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
                <th className="text-left p-2">Qty</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">{new Date(o.order_date).toLocaleString()}</td>
                  <td className="p-2">{o.event?.name || '—'}</td>
                  <td className="p-2">{o.person_name}</td>
                  <td className="p-2">{o.drink?.name || '—'}</td>
                  <td className="p-2">{o.quantity}</td>
                  <td className="p-2">{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

