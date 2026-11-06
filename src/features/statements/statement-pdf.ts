import type { jsPDF } from 'jspdf'

import { currencyName } from '@/components/CurrencyIcon'
import i18n from '@/i18n'
import { formatCalendarDate, formatDateTime, formatMoney, formatMonth, shortId } from '@/lib/format'
import { movementLabel } from '@/lib/labels'

import { lastDay, type Money, type WalletStatement } from './statement-data'

export interface StatementDocument {
  holder: { fullName: string; email: string }
  month: string
  /** One wallet for its own statement; every wallet for the general one. */
  wallets: WalletStatement[]
  general: boolean
}

type Rgb = [number, number, number]

// The printed statement's colors (Tailwind's indigo and slate), fixed so a dark theme never reaches the paper
const INK: Rgb = [30, 27, 75]
const ACCENT: Rgb = [99, 102, 241]
const TEXT: Rgb = [15, 23, 42]
const MUTED: Rgb = [100, 116, 139]
const SOFT: Rgb = [71, 85, 105]
const LINE: Rgb = [226, 232, 240]
const PANEL: Rgb = [248, 250, 252]
const IN: Rgb = [4, 120, 87]
const OUT: Rgb = [185, 28, 28]
const ON_INK: Rgb = [199, 210, 254]

const PAGE_MARGIN = 40
const HEADER_BOTTOM = 66

// The built-in PDF fonts only know Windows-1252: Intl's thin spaces and anything else outside it would print as junk
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
export function pdfText(value: string | undefined): string {
  return (value ?? '')
    .replace(/[\u00a0\u2007\u2009\u202f]/g, ' ')
    .replace(/\u2212/g, '-')
    .replace(/[^\n\u0020-\u007e\u00a0-\u00ff]/gu, (char) => (WIN_ANSI_EXTRA.includes(char) ? char : '?'))
}

const money = (value: Money | undefined) => pdfText(formatMoney(value))
// A currency without a name of its own would read "EUR (EUR)"
function currencyTitle(currency: string) {
  const name = currencyName(currency)
  return pdfText(name === currency ? currency : `${name} (${currency})`)
}
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** The statement's reference, printed on every page and named in the file: the month and whose it is. */
export function statementFolio(month: string, wallets: WalletStatement[], general: boolean): string {
  const owner = general ? 'GEN' : shortId(wallets[0]?.walletId).toUpperCase()
  return `EC-${month.replace('-', '')}-${owner}`
}

export function statementFileName(document: StatementDocument): string {
  const which = document.general ? i18n.t('statements.pdf.allFileName') : document.wallets[0]?.currency.toLowerCase()
  return `${i18n.t('statements.pdf.fileName')}-${which}-${document.month}.pdf`
}

class Writer {
  y = PAGE_MARGIN
  readonly doc: jsPDF
  readonly width: number
  readonly height: number

  constructor(doc: jsPDF) {
    this.doc = doc
    this.width = doc.internal.pageSize.getWidth()
    this.height = doc.internal.pageSize.getHeight()
  }

  get contentWidth() {
    return this.width - PAGE_MARGIN * 2
  }

  color(rgb: Rgb, kind: 'text' | 'fill' | 'draw' = 'text') {
    if (kind === 'text') this.doc.setTextColor(...rgb)
    else if (kind === 'fill') this.doc.setFillColor(...rgb)
    else this.doc.setDrawColor(...rgb)
  }

  font(size: number, style: 'normal' | 'bold' = 'normal', rgb: Rgb = TEXT) {
    this.doc.setFont('helvetica', style)
    this.doc.setFontSize(size)
    this.color(rgb)
  }

  /** Small capitals with room between letters, as the section titles of the printed documents. */
  label(text: string, x: number, y: number, rgb: Rgb = MUTED, align: 'left' | 'right' = 'left') {
    this.font(6.5, 'bold', rgb)
    const value = pdfText(text).toUpperCase()
    // jsPDF leaves the letter spacing out when it aligns right, so the text is placed by its real width
    const width = this.doc.getTextWidth(value) + 0.6 * (value.length - 1)
    this.doc.text(value, align === 'right' ? x - width : x, y, { charSpace: 0.6 })
  }

  ensureRoom(height: number) {
    if (this.y + height > this.height - 70) {
      this.doc.addPage()
      this.y = HEADER_BOTTOM + 20
    }
  }

  section(title: string) {
    this.ensureRoom(60)
    this.label(title, PAGE_MARGIN, this.y, INK)
    this.y += 8
  }
}

function drawLogo(w: Writer, x: number, y: number, size: number) {
  w.color(INK, 'fill')
  w.doc.roundedRect(x, y, size, size, size * 0.28, size * 0.28, 'F')
  w.font(size * 0.56, 'bold', [255, 255, 255])
  w.doc.text('B', x + size / 2, y + size * 0.62, { align: 'center' })
  w.color(ACCENT, 'fill')
  w.doc.roundedRect(x + size * 0.32, y + size * 0.74, size * 0.36, size * 0.08, size * 0.04, size * 0.04, 'F')
}

function accentBar(w: Writer, y: number, height: number) {
  const split = w.contentWidth * 0.66
  w.color(INK, 'fill')
  w.doc.rect(PAGE_MARGIN, y, split, height, 'F')
  w.color(ACCENT, 'fill')
  w.doc.rect(PAGE_MARGIN + split, y, w.contentWidth - split, height, 'F')
}

function drawFirstHeader(w: Writer, document: StatementDocument) {
  const { month } = document
  drawLogo(w, PAGE_MARGIN, w.y, 32)
  w.font(15, 'bold', INK)
  w.doc.text('Billetera', PAGE_MARGIN + 42, w.y + 15)
  w.font(8, 'normal', MUTED)
  w.doc.text(pdfText(i18n.t('print.tagline')), PAGE_MARGIN + 42, w.y + 27)

  const right = w.width - PAGE_MARGIN
  w.label(i18n.t(document.general ? 'statements.pdf.generalKind' : 'wallets.statement.kind'), right, w.y + 6, MUTED, 'right')
  w.font(15, 'bold', INK)
  w.doc.text(pdfText(capitalized(formatMonth(month))), right, w.y + 22, { align: 'right' })
  w.font(8.5, 'normal', SOFT)
  w.doc.text(pdfText(i18n.t('wallets.statement.period', {
    from: formatCalendarDate(`${month}-01`), to: formatCalendarDate(lastDay(month)),
  })), right, w.y + 34, { align: 'right' })
  w.y += 48
  accentBar(w, w.y, 3)
  w.y += 24
}

/** Label-and-value boxes, side by side. */
function drawFields(w: Writer, fields: { label: string; value: string }[]) {
  const gap = 8
  const boxWidth = (w.contentWidth - gap * (fields.length - 1)) / fields.length
  const height = 34
  fields.forEach((field, index) => {
    const x = PAGE_MARGIN + index * (boxWidth + gap)
    w.color(PANEL, 'fill')
    w.color(LINE, 'draw')
    w.doc.setLineWidth(0.6)
    w.doc.roundedRect(x, w.y, boxWidth, height, 4, 4, 'FD')
    w.label(field.label, x + 8, w.y + 12)
    w.font(9, 'bold', TEXT)
    const value = w.doc.splitTextToSize(pdfText(field.value || '—'), boxWidth - 16)[0] as string
    w.doc.text(value, x + 8, w.y + 25)
  })
  w.y += height + 20
}

/** The month of one wallet as four tiles, the closing balance standing out. */
function drawBalanceTiles(w: Writer, statement: WalletStatement) {
  const tiles: { label: string; value: Money | undefined; tone: Rgb; strong?: boolean }[] = [
    { label: i18n.t('wallets.statement.openingBalance'), value: statement.openingBalance, tone: TEXT },
    { label: i18n.t('wallets.statement.moneyIn'), value: statement.moneyIn, tone: IN },
    { label: i18n.t('wallets.statement.moneyOut'), value: statement.moneyOut, tone: OUT },
    { label: i18n.t('wallets.statement.closingBalance'), value: statement.closingBalance, tone: [255, 255, 255], strong: true },
  ]
  const gap = 8
  const tileWidth = (w.contentWidth - gap * 3) / 4
  const height = 42
  tiles.forEach((tile, index) => {
    const x = PAGE_MARGIN + index * (tileWidth + gap)
    if (tile.strong) {
      w.color(INK, 'fill')
      w.doc.roundedRect(x, w.y, tileWidth, height, 4, 4, 'F')
    } else {
      w.color(LINE, 'draw')
      w.doc.setLineWidth(0.6)
      w.doc.roundedRect(x, w.y, tileWidth, height, 4, 4, 'S')
    }
    w.label(tile.label, x + 8, w.y + 13, tile.strong ? ON_INK : MUTED)
    w.font(13, 'bold', tile.tone)
    w.doc.text(money(tile.value), x + 8, w.y + 31)
  })
  w.y += height + 22
}

type AutoTable = typeof import('jspdf-autotable').autoTable

/** The general statement's overview: one row per wallet, since amounts in different currencies don't add up. */
function drawWalletsTable(w: Writer, autoTable: AutoTable, wallets: WalletStatement[]) {
  autoTable(w.doc, {
    startY: w.y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: HEADER_BOTTOM + 10 },
    head: [[
      i18n.t('common.wallet'),
      i18n.t('wallets.statement.openingBalance'),
      i18n.t('wallets.statement.moneyIn'),
      i18n.t('wallets.statement.moneyOut'),
      i18n.t('wallets.statement.closingBalance'),
    ].map((text) => pdfText(text).toUpperCase())],
    body: wallets.map((wallet) => [
      currencyTitle(wallet.currency),
      money(wallet.openingBalance),
      `+${money(wallet.moneyIn)}`,
      `-${money(wallet.moneyOut)}`,
      money(wallet.closingBalance),
    ]),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, textColor: TEXT, cellPadding: { top: 6, bottom: 6, left: 7, right: 7 }, lineColor: LINE },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, cellPadding: { top: 7, bottom: 7, left: 7, right: 7 } },
    bodyStyles: { lineWidth: { bottom: 0.6 } },
    alternateRowStyles: { fillColor: PANEL },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' },
      2: { halign: 'right', textColor: IN },
      3: { halign: 'right', textColor: OUT },
      4: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (cell) => {
      if (cell.section === 'head' && cell.column.index > 0) cell.cell.styles.halign = 'right'
    },
  })
  w.y = (w.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24
}

function drawMovements(w: Writer, autoTable: AutoTable, statement: WalletStatement, withCurrency: boolean) {
  const count = i18n.t('wallets.statement.movementsCount', { count: statement.movements.length })
  w.section(withCurrency ? `${count} · ${currencyTitle(statement.currency)}` : count)
  if (statement.movements.length === 0) {
    w.color([203, 213, 225], 'draw')
    w.doc.setLineDashPattern([3, 2], 0)
    w.doc.roundedRect(PAGE_MARGIN, w.y, w.contentWidth, 40, 4, 4, 'S')
    w.doc.setLineDashPattern([], 0)
    w.font(9, 'normal', MUTED)
    w.doc.text(pdfText(i18n.t('wallets.statement.empty')), w.width / 2, w.y + 23, { align: 'center' })
    w.y += 62
    return
  }
  autoTable(w.doc, {
    startY: w.y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: HEADER_BOTTOM + 10, bottom: 64 },
    head: [[
      i18n.t('common.date'), i18n.t('common.concept'), i18n.t('common.folio'),
      i18n.t('wallets.statement.moneyOut'), i18n.t('wallets.statement.moneyIn'), i18n.t('common.balance'),
    ].map((text) => pdfText(text).toUpperCase())],
    body: statement.movements.map((m) => {
      const detail = [m.counterpartyName, m.description].filter(Boolean).join(' · ')
      return [
        pdfText(formatDateTime(m.createdAt)),
        pdfText(detail ? `${movementLabel(m.type, m.direction)}\n${detail}` : movementLabel(m.type, m.direction)),
        shortId(m.operationId).toUpperCase(),
        m.direction === 'IN' ? '' : `-${money(m.amount)}`,
        m.direction === 'IN' ? `+${money(m.amount)}` : '',
        money(m.balanceAfter),
      ]
    }),
    theme: 'plain',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 8, textColor: TEXT, cellPadding: { top: 5, bottom: 5, left: 6, right: 6 }, lineColor: LINE, valign: 'top' },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, cellPadding: { top: 6, bottom: 6, left: 6, right: 6 } },
    bodyStyles: { lineWidth: { bottom: 0.6 } },
    alternateRowStyles: { fillColor: PANEL },
    columnStyles: {
      0: { cellWidth: 92, textColor: SOFT },
      2: { cellWidth: 56, font: 'courier', fontSize: 7.5, textColor: MUTED },
      3: { cellWidth: 72, halign: 'right', textColor: OUT },
      4: { cellWidth: 72, halign: 'right', textColor: IN },
      5: { cellWidth: 76, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (cell) => {
      if (cell.section === 'head' && cell.column.index >= 3) cell.cell.styles.halign = 'right'
    },
    // The other party and the concept go under the movement's name, smaller and quieter
    willDrawCell: (cell) => {
      if (cell.section === 'body' && cell.column.index === 1 && cell.cell.text.length > 1) {
        cell.cell.text = [cell.cell.text[0]!]
      }
    },
    didDrawCell: (cell) => {
      const raw = cell.cell.raw
      if (cell.section !== 'body' || cell.column.index !== 1 || typeof raw !== 'string' || !raw.includes('\n')) return
      const detail = raw.slice(raw.indexOf('\n') + 1)
      w.font(7, 'normal', MUTED)
      const lines = w.doc.splitTextToSize(detail, cell.cell.width - 12) as string[]
      w.doc.text(lines, cell.cell.x + 6, cell.cell.y + 5 + 8 + 8.5)
    },
  })
  w.y = (w.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  if (statement.cut) {
    w.font(7.5, 'normal', MUTED)
    w.doc.text(pdfText(i18n.t('wallets.statement.cut')), PAGE_MARGIN, w.y + 4)
    w.y += 12
  }
  w.y += 14
}

/** Repeats who and what on every page after the first, and numbers them all with the folio and the fine print. */
function drawPageFrames(w: Writer, document: StatementDocument, folio: string) {
  const pages = w.doc.getNumberOfPages()
  const generated = pdfText(i18n.t('print.generatedAt', { date: formatDateTime(new Date().toISOString()) }))
  const currencies = [...new Set(document.wallets.map((wallet) => wallet.currency))].join(', ')
  const legal = pdfText(i18n.t('wallets.statement.legal', { currency: currencies || i18n.t('wallets.statement.walletCurrency') }))
  const title = pdfText(`${i18n.t(document.general ? 'statements.pdf.generalKind' : 'wallets.statement.kind')} · ${capitalized(formatMonth(document.month))}`)
  for (let page = 1; page <= pages; page++) {
    w.doc.setPage(page)
    if (page > 1) {
      drawLogo(w, PAGE_MARGIN, PAGE_MARGIN - 6, 20)
      w.font(10, 'bold', INK)
      w.doc.text('Billetera', PAGE_MARGIN + 27, PAGE_MARGIN + 8)
      w.font(8, 'normal', SOFT)
      w.doc.text(title, w.width - PAGE_MARGIN, PAGE_MARGIN + 3, { align: 'right' })
      w.doc.text(pdfText(document.holder.fullName), w.width - PAGE_MARGIN, PAGE_MARGIN + 13, { align: 'right' })
      accentBar(w, PAGE_MARGIN + 20, 2)
    }
    const footerTop = w.height - 52
    w.color(LINE, 'draw')
    w.doc.setLineWidth(0.6)
    w.doc.line(PAGE_MARGIN, footerTop, w.width - PAGE_MARGIN, footerTop)
    w.font(6.5, 'normal', MUTED)
    const legalLines = w.doc.splitTextToSize(legal, w.contentWidth) as string[]
    w.doc.text(legalLines, PAGE_MARGIN, footerTop + 10)
    const bottom = w.height - 22
    w.font(7, 'normal', MUTED)
    w.doc.text(`${generated} · ${i18n.t('statements.pdf.folio')} ${folio}`, PAGE_MARGIN, bottom)
    w.font(7, 'bold', INK)
    w.doc.text(pdfText(i18n.t('statements.pdf.page', { page, pages })), w.width - PAGE_MARGIN, bottom, { align: 'right' })
  }
}

/**
 * A statement as a real PDF file: the same design as the printed one, with the table's header on every page and
 * each page numbered. The PDF libraries load only when a statement is downloaded.
 */
export async function buildStatementPdf(document: StatementDocument): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true })
  const folio = statementFolio(document.month, document.wallets, document.general)
  doc.setProperties({
    title: pdfText(`${i18n.t(document.general ? 'statements.pdf.generalKind' : 'wallets.statement.kind')} ${formatMonth(document.month)}`),
    subject: folio,
    author: 'Billetera',
    creator: 'Billetera',
  })
  const w = new Writer(doc)

  drawFirstHeader(w, document)
  w.section(i18n.t('wallets.statement.accountData'))
  const only = document.wallets[0]
  drawFields(w, [
    { label: i18n.t('common.holder'), value: document.holder.fullName },
    { label: i18n.t('common.email'), value: document.holder.email },
    document.general
      ? { label: i18n.t('statements.pdf.wallets'), value: String(document.wallets.length) }
      : { label: i18n.t('common.currency'), value: only ? currencyTitle(only.currency) : '' },
    { label: i18n.t('statements.pdf.folio'), value: folio },
  ])

  w.section(i18n.t('wallets.statement.periodSummary'))
  if (document.general) {
    drawWalletsTable(w, autoTable, document.wallets)
  } else if (only) {
    drawBalanceTiles(w, only)
  }
  for (const statement of document.wallets) {
    drawMovements(w, autoTable, statement, document.general)
  }
  drawPageFrames(w, document, folio)
  return doc.output('blob')
}
