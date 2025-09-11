import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Department Drink Ordering System</h1>
      <p className="text-slate-600 max-w-prose">
        Create events, build drink menus, and collect orders with ease. Start by
        visiting the admin dashboard to create an event and add drinks, or go to
        the order page to place an order for an active event.
      </p>
      <div className="flex gap-3">
        <Link href="/admin" className="px-3 py-2 rounded bg-slate-900 text-white text-sm">Admin Dashboard</Link>
        <Link href="/order" className="px-3 py-2 rounded border text-sm">Place an Order</Link>
      </div>
    </div>
  )
}

