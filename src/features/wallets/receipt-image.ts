import i18n from '@/i18n'

/** What a receipt image shows, already formatted for reading. */
export interface ReceiptContent {
  title: string
  amount: string
  incoming: boolean
  rows: { label: string; value: string }[]
  reference: string
  footer: string
}

const WIDTH = 720
const PADDING = 56
const ROW_HEIGHT = 64
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

// Long values (names with emails, concepts) are cut so they never run over the label column
function fit(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && context.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1)
  return `${cut}…`
}

/**
 * Draws the receipt as a PNG, light whatever the app's theme, so it reads the same in a chat or a gallery. Built
 * in a canvas so sharing it needs no server or library.
 */
export function drawReceipt(content: ReceiptContent, scale = 2): Promise<Blob> {
  const height = PADDING * 2 + 210 + content.rows.length * ROW_HEIGHT + 120
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * scale
  canvas.height = height * scale
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Canvas 2D is not available'))
  context.scale(scale, scale)

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, WIDTH, height)
  context.fillStyle = '#4f46e5'
  context.fillRect(0, 0, WIDTH, 8)

  let y = PADDING + 24
  context.textBaseline = 'alphabetic'
  context.fillStyle = '#3a2b9e'
  context.font = `600 22px ${FONT}`
  context.fillText('Billetera.', PADDING, y)
  context.fillStyle = '#71717a'
  context.font = `400 16px ${FONT}`
  context.textAlign = 'right'
  context.fillText(i18n.t('wallets.receipt.kind'), WIDTH - PADDING, y)
  context.textAlign = 'left'

  y += 70
  context.fillStyle = '#52525b'
  context.font = `400 20px ${FONT}`
  context.fillText(content.title, PADDING, y)
  y += 62
  context.fillStyle = content.incoming ? '#15803d' : '#18181b'
  context.font = `700 46px ${FONT}`
  context.fillText(content.amount, PADDING, y)

  y += 30
  for (const row of content.rows) {
    context.strokeStyle = '#e4e4e7'
    context.beginPath()
    context.moveTo(PADDING, y)
    context.lineTo(WIDTH - PADDING, y)
    context.stroke()
    y += 40
    context.fillStyle = '#71717a'
    context.font = `400 17px ${FONT}`
    context.fillText(row.label, PADDING, y)
    context.fillStyle = '#18181b'
    context.font = `500 17px ${FONT}`
    context.textAlign = 'right'
    context.fillText(fit(context, row.value, WIDTH - PADDING * 2 - 200), WIDTH - PADDING, y)
    context.textAlign = 'left'
    y += ROW_HEIGHT - 40
  }

  y += 36
  context.fillStyle = '#f4f4f5'
  context.fillRect(PADDING, y - 26, WIDTH - PADDING * 2, 44)
  context.fillStyle = '#52525b'
  context.font = `400 15px ui-monospace, "Cascadia Mono", Menlo, monospace`
  context.fillText(fit(context, i18n.t('wallets.receipt.folioShort', { folio: content.reference }), WIDTH - PADDING * 2 - 32), PADDING + 16, y + 2)
  y += 58
  context.fillStyle = '#a1a1aa'
  context.font = `400 14px ${FONT}`
  context.fillText(content.footer, PADDING, y)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the receipt'))), 'image/png')
  })
}
