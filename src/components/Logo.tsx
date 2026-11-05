import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8 shrink-0', className)}>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#3a2b9e" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
      <path d="M9 11.5A2.5 2.5 0 0 1 11.5 9h9A2.5 2.5 0 0 1 23 11.5V12h-8.5a3 3 0 0 0 0 6H23v2.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 9 20.5Z" fill="#fff" />
      <path d="M14.5 13.5H23v3h-8.5a1.5 1.5 0 0 1 0-3Z" fill="#fff" fillOpacity=".55" />
      <circle cx="16.5" cy="15" r="1.4" fill="#fff" />
    </svg>
  )
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className={cn('text-[1.05rem] leading-none font-semibold tracking-tight', inverted && 'text-white')}>
        Billetera<span className={inverted ? 'text-white/70' : 'text-primary'}>.</span>
      </span>
    </span>
  )
}
