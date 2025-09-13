"use client";
import { useEffect, useMemo, useState } from 'react'

type Lang = 'vi' | 'ja'

const STORAGE_KEY = 'ddos.lang'

export default function LanguageSwitch() {
  const [lang, setLang] = useState<Lang>('vi')

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY)) as Lang | null
    if (saved === 'ja' || saved === 'vi') setLang(saved)
  }, [])

  const label = useMemo(() => (lang === 'ja' ? '日本語' : 'VI'), [lang])

  const toggle = () => {
    const next: Lang = lang === 'vi' ? 'ja' : 'vi'
    setLang(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next)
      window.dispatchEvent(new CustomEvent('ddos:lang-change', { detail: { lang: next } }))
    }
  }

  return (
    <button
      onClick={toggle}
      title={lang === 'ja' ? 'Switch to Vietnamese' : '日本語に切り替え'}
      className="px-3 py-1.5 rounded-full text-xs font-medium border bg-white/60 text-slate-700 hover:bg-white transition mr-2"
    >
      {label}
    </button>
  )
}

