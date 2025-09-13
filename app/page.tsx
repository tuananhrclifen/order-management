import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="relative min-h-[80vh] sm:min-h-[86vh] w-full overflow-hidden rounded-none sm:rounded-2xl">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1510626176961-4b57d4fbad03?q=80&w=1920&auto=format&fit=crop')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />

      <section className="relative z-10 container mx-auto px-6 sm:px-10 py-20 sm:py-28 text-white">
        <p className="uppercase tracking-[0.35em] text-xs sm:text-sm text-white/80">Let&apos;s take a</p>
        <h1 className="mt-2 text-5xl sm:text-7xl font-extrabold leading-[0.95]">
          <span className="gradient-text">Nice</span>
          <span className="ml-3 text-white drop-shadow">Break</span>
        </h1>
        <p className="mt-6 max-w-xl text-sm sm:text-base text-white/80">
          Create events, build drink menus, and place orders effortlessly. Fresh, modern, and fast for your team.
        </p>

        <div className="mt-10 flex items-center gap-4">
          <Link href="/order" className="btn-hero">Place Order</Link>
          <Link href="#about" className="btn-ghost">Learn more</Link>
        </div>
      </section>

      <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-primary-600/30 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-emerald-400/20 blur-3xl" />
    </div>
  )
}
