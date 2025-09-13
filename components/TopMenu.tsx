"use client";
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export default function TopMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as any)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Menu"
        onClick={() => setOpen(v => !v)}
        className="p-2 rounded-md hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
        title="Menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-md border bg-white shadow-lg overflow-hidden z-30">
          <Link href="/order" className="block px-3 py-2 text-sm hover:bg-slate-50">Place Order</Link>
          <Link href="/admin" className="block px-3 py-2 text-sm hover:bg-slate-50">Admin</Link>
        </div>
      )}
    </div>
  )
}

