"use client";
import { useEffect, useMemo, useRef, useState } from 'react'

export type Lang = 'vi' | 'ja' | 'en'

const STORAGE_KEY = 'ddos.lang'

export default function LanguageSwitch() {
  const [lang, setLang] = useState<Lang>('vi')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY)) as Lang | null
    if (saved === 'ja' || saved === 'vi' || saved === 'en') setLang(saved)
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as any)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  const label = useMemo(() => (lang === 'ja' ? '日本語' : lang === 'en' ? 'EN' : 'VI'), [lang])

  const setLanguage = (next: Lang) => {
    setLang(next)
    setOpen(false)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next)
      window.dispatchEvent(new CustomEvent('ddos:lang-change', { detail: { lang: next } }))
    }
  }

  return (
    <div ref={ref} className="relative mr-2">
      <button
        onClick={() => setOpen(v => !v)}
        title="Language"
        className="px-3 py-1.5 rounded-full text-xs font-medium border bg-white/60 text-slate-700 hover:bg-white transition"
      >
        {label}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-28 rounded-md border bg-white shadow-lg overflow-hidden z-30">
          <button onClick={() => setLanguage('vi')} className={`block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 ${lang==='vi'?'bg-slate-50':''}`}>VI</button>
          <button onClick={() => setLanguage('ja')} className={`block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 ${lang==='ja'?'bg-slate-50':''}`}>日本語</button>
          <button onClick={() => setLanguage('en')} className={`block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 ${lang==='en'?'bg-slate-50':''}`}>EN</button>
        </div>
      )}
    </div>
  )
}
