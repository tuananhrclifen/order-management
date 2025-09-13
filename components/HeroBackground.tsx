"use client";
import { useEffect, useState } from 'react'

const DEFAULT_BG = "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03?q=80&w=2560&auto=format&fit=crop"

export default function HeroBackground() {
  const [bg, setBg] = useState<string>(DEFAULT_BG)

  useEffect(() => {
    let cancelled = false
    fetch('/hero.jpg', { method: 'HEAD' })
      .then(res => {
        if (!cancelled && res.ok) setBg('/hero.jpg')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <div
      className="absolute inset-0 bg-cover bg-center will-change-transform scale-105 animate-[bgZoom_10s_ease-in-out_forwards]"
      style={{ backgroundImage: `url(${bg})` }}
    />
  )
}

