"use client";
import { useEffect, useState } from 'react'

export default function BrandLogo() {
  const [hidden, setHidden] = useState(false)

  // Attempt to detect 404 quickly
  useEffect(() => {
    const img = new Image()
    img.src = '/logo.png'
    img.onload = () => setHidden(false)
    img.onerror = () => setHidden(true)
  }, [])

  return (
    <div className="flex items-center gap-3 select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="ESUTECH"
        className={`h-8 w-auto ${hidden ? 'hidden' : 'block'} transition-opacity duration-500 opacity-90`}
        onError={() => setHidden(true)}
      />
      {hidden && <span className="font-bold text-primary-700 tracking-tight">ESUTECH</span>}
      <span className="sr-only">Department Drink Ordering System</span>
    </div>
  )
}

