import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="text-center animate-slide-up">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">Department Drink Ordering System</h1>
      <p className="mt-6 text-lg leading-8 text-slate-600 max-w-2xl mx-auto">
        Create events, build drink menus, and collect orders with ease. Start by
        visiting the admin dashboard to create an event and add drinks, or go to
        the order page to place an order for an active event.
      </p>
      <div className="mt-10 flex items-center justify-center gap-x-6">
        <Link href="/admin" className="btn btn-primary">Admin Dashboard</Link>
        <Link href="/order" className="btn btn-secondary">Place an Order</Link>
      </div>
    </div>
  )
}

