import './globals.css'
import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Department Drink Ordering System',
  description: 'Order management for department events',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b bg-white">
          <nav className="mx-auto container px-4 py-3 flex items-center gap-4">
            <Link href="/" className="font-semibold">DDOS</Link>
            <div className="ml-auto flex gap-3">
              <Link href="/order" className="text-sm hover:underline">Order</Link>
              <Link href="/admin" className="text-sm hover:underline">Admin</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto container px-4 py-6">{children}</main>
        <footer className="mx-auto container px-4 py-6 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Department Drink Ordering System</p>
        </footer>
      </body>
    </html>
  )
}

