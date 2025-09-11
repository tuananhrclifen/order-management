export function formatPriceVND(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value
  if (!isFinite(num as number)) return ''
  try {
    return Math.round(Number(num)).toLocaleString('vi-VN')
  } catch {
    // Fallback formatting with dots
    const s = String(Math.round(Number(num)))
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }
}

