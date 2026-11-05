import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

/** A QR code drawn in the browser, dark on white so any camera reads it in either theme. */
export function QrImage({ value, alt, className }: { value: string; alt: string; className?: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(value, { margin: 1, width: 440, errorCorrectionLevel: 'M' })
      .then((url) => !cancelled && setSrc(url))
    return () => {
      cancelled = true
    }
  }, [value])
  return src
    ? <img src={src} alt={alt} className={cn('size-44 rounded-xl border bg-white p-2', className)} />
    : <div className={cn('size-44 animate-pulse rounded-xl bg-muted', className)} />
}
