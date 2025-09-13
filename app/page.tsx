import Link from 'next/link'
import HeroBackground from '@/components/HeroBackground'

export default function HomePage() {
  return (
    <div className="relative min-h-screen w-screen left-1/2 -translate-x-1/2 overflow-hidden rounded-none">
      <HeroBackground />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />

      <section className="relative z-10 container mx-auto px-6 sm:px-10 pt-28 sm:pt-36 pb-16 sm:pb-24 text-white">
        <p className="uppercase tracking-[0.35em] text-xs sm:text-sm text-white/80 animate-[fadeUpSmooth_.9s_ease-out_0s_both]">Let&apos;s take a</p>
        <h1 className="mt-2 text-5xl sm:text-7xl font-extrabold leading-[0.95] animate-[fadeUpSmooth_1.2s_ease-out_.05s_both]">
          <span className="gradient-text">Nice</span>
          <span className="ml-3 text-white drop-shadow">Break</span>
        </h1>
        <p className="mt-6 max-w-xl text-sm sm:text-base text-white/85 animate-[fadeUpSmooth_1.4s_ease-out_.1s_both]">
          Create events, build drink menus, and place orders effortlessly. Fresh, modern, and fast for your team.
        </p>

        <div className="mt-10 flex items-center gap-4 animate-[fadeUpSmooth_1.6s_ease-out_.15s_both]">
          <Link href="/order" className="btn-hero text-base sm:text-lg px-7 sm:px-8 py-3.5 sm:py-4">Place Order</Link>
        </div>
      </section>

      <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-primary-600/30 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-emerald-400/20 blur-3xl" />
    </div>
  )
}
