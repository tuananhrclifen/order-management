
import './globals.css'
import Link from 'next/link'
import type { ReactNode } from 'react'
import TopMenu from '@/components/TopMenu'
import BrandLogo from '@/components/BrandLogo'
import LanguageSwitch from '@/components/LanguageSwitch'

export const metadata = {
  title: 'Department Drink Ordering System',
  description: 'Order management for department events',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 animate-fade-in">
        <header className="border-b bg-white/60 backdrop-blur-md sticky top-0 z-20 transition-all duration-700 ease-[cubic-bezier(.22,.61,.36,1)]">
          <nav className="mx-auto container px-4 py-3 flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 group" aria-label="Home">
              <BrandLogo />
            </Link>
            <div className="ml-auto flex items-center">
              <LanguageSwitch />
              <TopMenu />
            </div>
          </nav>
        </header>
        <main className="mx-auto container px-0 sm:px-4 py-0 sm:py-10">{children}</main>
        <footer className="mx-auto container px-4 py-6 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Department Drink Ordering System. All rights reserved.</p>
        </footer>
      </body>
    </html>
  )
}
