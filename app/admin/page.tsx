"use client";
import Link from 'next/link'
import AuthGate from '@/components/AuthGate'

export default function AdminPage() {
  return (
    <AuthGate>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/admin/events" className="p-4 border rounded hover:bg-slate-50">
            <h3 className="font-semibold">Events</h3>
            <p className="text-sm text-slate-600">Create and manage events.</p>
          </Link>
          <Link href="/admin/drinks" className="p-4 border rounded hover:bg-slate-50">
            <h3 className="font-semibold">Drinks</h3>
            <p className="text-sm text-slate-600">Add drinks and manage menus.</p>
          </Link>
          <Link href="/admin/orders" className="p-4 border rounded hover:bg-slate-50">
            <h3 className="font-semibold">Orders</h3>
            <p className="text-sm text-slate-600">View incoming orders (basic).</p>
          </Link>
        </div>
      </div>
    </AuthGate>
  )
}

