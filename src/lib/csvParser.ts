import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ReportType =
  | 'revenue_by_payment'      // Umsatz_nach_Artikel_und_Abrechnungsart
  | 'orders_by_group_article' // Bestellungen_nach_Artikelgruppe_und_Artikel
  | 'orders_by_group'         // Bestellungen_nach_Artikelgruppe_
  | 'orders_by_article'       // Bestellungen_nach_Artikel_
  | 'stornos_by_employee'     // Stornos_pro_Mitarbeiter
  | 'unknown'

export interface FileMeta {
  reportName?: string
  exportDate?: string
  company?: string
  dateFrom?: string
  dateTo?: string
  year?: number
  month?: number
}

export interface ProductRow {
  name: string
  plu?: string | null
  price?: number | null
  total_revenue: number
  total_quantity: number
  netto?: number | null
  mwst?: number | null
  product_group?: string | null
  year?: number | null
  month?: number | null
}

export interface ProductGroupRow {
  name: string
  total_revenue: number
  total_quantity?: number | null
  netto?: number | null
  mwst?: number | null
  year?: number | null
  month?: number | null
}

export interface PaymentRow {
  payment_type: string
  amount: number
  transaction_count?: number | null
  percentage?: number | null
  year?: number | null
  month?: number | null
}

export interface SalesRow {
  total_amount: number
  transaction_count?: number | null
  date?: string | null
  date_from?: string | null
  date_to?: string | null
  year?: number | null
  month?: number | null
}

export interface EmployeeRow {
  name: string
  storno_count?: number | null
  storno_amount?: number | null
  year?: number | null
  month?: number | null
}

export interface ParsedFile {
  type: ReportType
  meta: FileMeta
  products: ProductRow[]
  productGroups: ProductGroupRow[]
  payments: PaymentRow[]
  sales: SalesRow[]
  employees: EmployeeRow[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DATE_RE = /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/
const YEAR_RE = /20\d{2}/

const SKIP_PREFIXES = ['gesamt', 'total', 'summe', 'zwischensumme', 'subtotal', 'grand']

const PAYMENT_PREFIXES = ['debitori', 'carte', 'contanti', 'bar ', 'karte', 'twint', 'reka']

// Branch suffixes to strip from group/article names
const BRANCH_TERMS = ['im haus', 'asporto', 'takeaway', 'terrasse', 'auslieferung', 'lieferung']

const HEADER_KEYWORDS = [
  'datum', 'date', 'name', 'bezeichnung', 'artikel', 'umsatz', 'gesamtumsatz',
  'menge', 'anzahl', 'mitarbeiter', 'zahlungsart', 'abrechnungsart', 'warengruppe',
  'netto', 'brutto', 'preis', 'plu', 'filiale', 'gruppe', 'storno',
]

// ─────────────────────────────────────────────────────────────────────────────
// Utility functions
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const str = String(val)
    .replace(/x$/i, '')           // "11x" → "11"
    .replace(/'/g, '')            // Swiss: 1'234.56 → 1234.56
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}[,.])/g, '') // German: 1.234,56 → remove thousands dot
    .replace(/\.(?=\d{3}$)/g, '')    // German: 1.234 (no decimal) → 1234
    .replace(',', '.')
  return parseFloat(str) || 0
}

function cellStr(row: unknown[], idx: number): string {
  return String(row?.[idx] ?? '').trim()
}

function findCol(headerRow: unknown[], ...keywords: string[]): number {
  const cells = headerRow.map(c => String(c ?? '').toLowerCase().trim())
  for (const kw of keywords) {
    const idx = cells.findIndex(c => c.includes(kw))
    if (idx >= 0) return idx
  }
  return -1
}

function col(headerRow: unknown[], fallback: number, ...keywords: string[]): number {
  const found = findCol(headerRow, ...keywords)
  return found >= 0 ? found : fallback
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Strip branch suffix like " Im Haus", " Asporto" from product/group names
function stripBranch(name: string): string {
  const lower = name.toLowerCase()
  for (const term of BRANCH_TERMS) {
    if (lower.endsWith(' ' + term)) {
      return name.slice(0, name.length - term.length - 1).trim()
    }
  }
  return name.trim()
}

function isBranchOnly(name: string): boolean {
  const lower = name.toLowerCase().trim()
  return BRANCH_TERMS.includes(lower)
}

function isSkipRow(firstCell: string): boolean {
  const lower = firstCell.toLowerCase()
  return SKIP_PREFIXES.some(p => lower.startsWith(p))
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata extraction (first 15 rows)
// ─────────────────────────────────────────────────────────────────────────────

function extractMeta(matrix: unknown[][], filename: string): FileMeta {
  const meta: FileMeta = {}
  const rows = matrix.slice(0, 15)

  for (let i = 0; i < rows.length; i++) {
    const row = Array.isArray(rows[i]) ? rows[i] as unknown[] : []
    const cells = row.map(c => String(c ?? '').trim())
    const joined = cells.join(' ')

    // Row 0: report name
    if (i === 0 && cells[0] && !meta.reportName) {
      meta.reportName = cells[0]
    }

    // Look for export date
    if (joined.toLowerCase().includes('exportiert')) {
      const m = joined.match(DATE_RE)
      if (m) meta.exportDate = m[0]
    }

    // Look for "Vom" / "Von" (dateFrom)
    const hasVom = cells.some(c => /^(vom|von)$/i.test(c))
    if (hasVom && !meta.dateFrom) {
      // Try adjacent cell first
      for (let j = 0; j < cells.length - 1; j++) {
        if (/^(vom|von)$/i.test(cells[j])) {
          const m = cells[j + 1].match(DATE_RE)
          if (m) { meta.dateFrom = m[0]; break }
        }
      }
      // Fallback: any date in this row
      if (!meta.dateFrom) {
        const m = joined.match(DATE_RE)
        if (m) meta.dateFrom = m[0]
      }
    }

    // Look for "Bis" (dateTo)
    const hasBis = cells.some(c => /^bis$/i.test(c))
    if (hasBis && !meta.dateTo) {
      for (let j = 0; j < cells.length - 1; j++) {
        if (/^bis$/i.test(cells[j])) {
          const m = cells[j + 1].match(DATE_RE)
          if (m) { meta.dateTo = m[0]; break }
        }
      }
      if (!meta.dateTo) {
        const m = joined.match(DATE_RE)
        if (m) meta.dateTo = m[0]
      }
    }

    // Company name: row 1-3, non-empty, no date, no known keywords
    if (i >= 1 && i <= 3 && cells[0] && !meta.company) {
      const low = cells[0].toLowerCase()
      if (!DATE_RE.test(cells[0]) && !low.includes('export') && !low.includes('vom') && !low.includes('bis')) {
        meta.company = cells[0]
      }
    }

    // Extract year/month from any date found in this row
    for (const cell of cells) {
      const m = cell.match(DATE_RE)
      if (m) {
        meta.year = meta.year ?? parseInt(m[3])
        meta.month = meta.month ?? parseInt(m[2])
      }
    }
  }

  // Fallback year from filename
  const yearM = filename.match(YEAR_RE)
  if (yearM) meta.year = meta.year ?? parseInt(yearM[0])

  return meta
}

// ─────────────────────────────────────────────────────────────────────────────
// Header row detection
// ─────────────────────────────────────────────────────────────────────────────

function findHeaderRow(matrix: unknown[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 25); i++) {
    const row = Array.isArray(matrix[i]) ? matrix[i] as unknown[] : []
    const cells = row.map(c => String(c ?? '').toLowerCase().trim())
    const matches = cells.filter(c => HEADER_KEYWORDS.some(kw => c.includes(kw)))
    if (matches.length >= 2) return i
  }
  return 8 // safe default: most Lightspeed exports have ~8 metadata rows
}

// ─────────────────────────────────────────────────────────────────────────────
// Report type detection (filename-based, more specific first)
// ─────────────────────────────────────────────────────────────────────────────

function detectReportType(filename: string): ReportType {
  const fn = filename.toLowerCase()
  if (fn.includes('umsatz_nach_artikel_und_abrechnung')) return 'revenue_by_payment'
  if (fn.includes('bestellungen_nach_artikelgruppe_und')) return 'orders_by_group_article'
  if (fn.includes('bestellungen_nach_artikelgruppe_')) return 'orders_by_group'
  if (fn.includes('bestellungen_nach_artikel_')) return 'orders_by_article'
  if (fn.includes('stornos_pro_mitarbeiter')) return 'stornos_by_employee'
  // Looser fallbacks
  if (fn.includes('umsatz') || fn.includes('abrechnung')) return 'revenue_by_payment'
  if (fn.includes('warengruppe') && fn.includes('und_artikel')) return 'orders_by_group_article'
  if (fn.includes('warengruppe')) return 'orders_by_group'
  if (fn.includes('storno')) return 'stornos_by_employee'
  if (fn.includes('artikel') || fn.includes('bestellung')) return 'orders_by_article'
  return 'unknown'
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser: revenue_by_payment
// Umsatz_nach_Artikel_und_Abrechnungsart
// Structure: payment-group sections (Debitori/Carte/Contanti Im Haus),
//            each containing article rows (Name, PLU, Anzahl, Netto, Brutto)
// ─────────────────────────────────────────────────────────────────────────────

function parseRevenueByPayment(
  matrix: unknown[][], headerIdx: number, meta: FileMeta
): { products: ProductRow[]; payments: PaymentRow[]; sales: SalesRow[] } {
  const hdr = Array.isArray(matrix[headerIdx]) ? matrix[headerIdx] as unknown[] : []

  // Use confirmed Lightspeed column layout with header-based overrides
  const cName   = col(hdr, 0,  'name', 'bezeichnung')
  const cPlu    = col(hdr, 1,  'plu')
  const cQty    = col(hdr, 5,  'anzahl', 'menge')
  const cNetto  = col(hdr, 10, 'netto')
  const cBrutto = col(hdr, 12, 'brutto', 'gesamtumsatz')

  const productMap = new Map<string, { name: string; plu: string | null; rev: number; qty: number; netto: number }>()
  const paymentMap = new Map<string, { amount: number; qty: number }>()
  let currentPayment: string | null = null

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = Array.isArray(matrix[i]) ? matrix[i] as unknown[] : []
    const cells = row.map(c => String(c ?? '').trim())
    const name = cellStr(row, cName) || cells[0] || ''
    if (!name) continue

    const lower = name.toLowerCase()
    const nonEmpty = cells.filter(c => c !== '').length

    if (isSkipRow(name)) continue
    // Skip date-only rows
    if (DATE_RE.test(name) && nonEmpty <= 2) continue

    // Payment group header: known prefix, and almost nothing else in the row
    const isPayment = PAYMENT_PREFIXES.some(p => lower.startsWith(p))
    if (isPayment && nonEmpty <= 3) {
      currentPayment = name
      continue
    }

    // Skip structural rows (only 1-2 cells filled, no article data)
    if (nonEmpty <= 2 && !isPayment) continue

    const brutto = parseNumber(row[cBrutto])
    if (brutto <= 0) continue

    const plu   = cellStr(row, cPlu) || null
    const qty   = parseNumber(row[cQty])
    const netto = parseNumber(row[cNetto])

    // Aggregate by product name
    const existing = productMap.get(name)
    if (existing) {
      existing.rev   += brutto
      existing.qty   += qty
      existing.netto += netto
    } else {
      productMap.set(name, { name, plu, rev: brutto, qty, netto })
    }

    // Accumulate per payment type
    if (currentPayment) {
      const ep = paymentMap.get(currentPayment) ?? { amount: 0, qty: 0 }
      ep.amount += brutto
      ep.qty    += qty
      paymentMap.set(currentPayment, ep)
    }
  }

  const products: ProductRow[] = Array.from(productMap.values()).map(p => ({
    name: p.name,
    plu: p.plu,
    total_revenue: round2(p.rev),
    total_quantity: round2(p.qty),
    netto: p.netto ? round2(p.netto) : null,
    year: meta.year ?? null,
    month: meta.month ?? null,
  }))

  const totalAmt = Array.from(paymentMap.values()).reduce((s, v) => s + v.amount, 0)
  const payments: PaymentRow[] = Array.from(paymentMap.entries()).map(([pt, d]) => ({
    payment_type: pt,
    amount: round2(d.amount),
    transaction_count: d.qty ? Math.round(d.qty) : null,
    percentage: totalAmt > 0 ? round2(d.amount / totalAmt * 100) : null,
    year: meta.year ?? null,
    month: meta.month ?? null,
  }))

  const grandTotal = round2(totalAmt)
  const sales: SalesRow[] = grandTotal > 0 ? [{
    total_amount: grandTotal,
    date_from: meta.dateFrom ?? null,
    date_to: meta.dateTo ?? null,
    year: meta.year ?? null,
    month: meta.month ?? null,
  }] : []

  return { products, payments, sales }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser: orders_by_group
// Bestellungen_nach_Artikelgruppe
// Each row = one group/branch: "ACQUA Im Haus;1594x;;7913,80;638,20;8552,00"
// Aggregate multiple branches under the base group name.
// ─────────────────────────────────────────────────────────────────────────────

function parseOrdersByGroup(
  matrix: unknown[][], headerIdx: number, meta: FileMeta
): { productGroups: ProductGroupRow[] } {
  const hdr = Array.isArray(matrix[headerIdx]) ? matrix[headerIdx] as unknown[] : []

  const cName   = col(hdr, 0, 'gruppe', 'artikel', 'name', 'bezeichnung')
  const cQty    = col(hdr, 1, 'anzahl', 'menge')
  const cNetto  = col(hdr, 3, 'netto')
  const cMwst   = col(hdr, 4, 'mwst', 'steuer')
  const cBrutto = col(hdr, 5, 'brutto')

  const groupMap = new Map<string, { rev: number; qty: number; netto: number; mwst: number }>()

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = Array.isArray(matrix[i]) ? matrix[i] as unknown[] : []
    const cells = row.map(c => String(c ?? '').trim())
    const rawName = cellStr(row, cName) || cells[0] || ''

    if (!rawName || cells.every(c => c === '')) continue
    if (isSkipRow(rawName)) continue

    const name = stripBranch(rawName)
    if (!name) continue

    const brutto = parseNumber(row[cBrutto])
    if (brutto <= 0) continue

    const existing = groupMap.get(name) ?? { rev: 0, qty: 0, netto: 0, mwst: 0 }
    existing.rev   += brutto
    existing.qty   += parseNumber(row[cQty])
    existing.netto += parseNumber(row[cNetto])
    existing.mwst  += parseNumber(row[cMwst])
    groupMap.set(name, existing)
  }

  const productGroups: ProductGroupRow[] = Array.from(groupMap.entries()).map(([name, g]) => ({
    name,
    total_revenue: round2(g.rev),
    total_quantity: g.qty ? round2(g.qty) : null,
    netto: g.netto ? round2(g.netto) : null,
    mwst: g.mwst ? round2(g.mwst) : null,
    year: meta.year ?? null,
    month: meta.month ?? null,
  }))

  return { productGroups }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser: orders_by_group_article
// Bestellungen_nach_Artikelgruppe_und_Artikel
// 3 levels: Group (no PLU) → Article (PLU present) → Branch (Im Haus/Asporto)
// ─────────────────────────────────────────────────────────────────────────────

function parseOrdersByGroupArticle(
  matrix: unknown[][], headerIdx: number, meta: FileMeta
): { products: ProductRow[]; productGroups: ProductGroupRow[] } {
  const hdr = Array.isArray(matrix[headerIdx]) ? matrix[headerIdx] as unknown[] : []

  const cName   = col(hdr, 0, 'name', 'bezeichnung', 'artikel')
  const cPlu    = col(hdr, 1, 'plu')
  const cQty    = col(hdr, 2, 'anzahl', 'menge')
  const cPrice  = col(hdr, 3, 'preis')
  const cNetto  = col(hdr, 5, 'netto')
  const cMwst   = col(hdr, 6, 'mwst')
  const cBrutto = col(hdr, 7, 'brutto', 'gesamtumsatz')

  const productMap = new Map<string, ProductRow & { _rev: number; _qty: number }>()
  const groupMap   = new Map<string, { rev: number; qty: number; netto: number; mwst: number }>()

  let currentGroup:   string | null = null
  let currentArticle: string | null = null

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = Array.isArray(matrix[i]) ? matrix[i] as unknown[] : []
    const cells = row.map(c => String(c ?? '').trim())
    const name = cellStr(row, cName) || cells[0] || ''

    if (!name || cells.every(c => c === '')) continue
    if (isSkipRow(name)) continue

    const plu    = cellStr(row, cPlu)
    const lower  = name.toLowerCase()
    const brutto = parseNumber(row[cBrutto])
    const qty    = parseNumber(row[cQty])
    const netto  = parseNumber(row[cNetto])
    const mwst   = parseNumber(row[cMwst])
    const price  = parseNumber(row[cPrice])

    if (plu) {
      // ── Level 2: Article (has PLU) ──────────────────────────────────────
      currentArticle = name
      const existing = productMap.get(name)
      if (existing) {
        existing._rev += brutto
        existing._qty += qty
        existing.total_revenue = round2(existing._rev)
        existing.total_quantity = round2(existing._qty)
      } else {
        productMap.set(name, {
          name,
          plu,
          price: price || null,
          total_revenue: round2(brutto),
          total_quantity: round2(qty),
          netto: netto ? round2(netto) : null,
          mwst: mwst ? round2(mwst) : null,
          product_group: currentGroup,
          year: meta.year ?? null,
          month: meta.month ?? null,
          _rev: brutto,
          _qty: qty,
        })
      }
    } else if (isBranchOnly(lower)) {
      // ── Level 3: Branch (Im Haus / Asporto) ─────────────────────────────
      // Aggregate branch numbers into the current article
      if (currentArticle && productMap.has(currentArticle)) {
        const p = productMap.get(currentArticle)!
        if (p._rev === 0 && brutto > 0) {
          // Article row had no numbers; accumulate from branch rows
          p._rev += brutto
          p._qty += qty
          p.total_revenue = round2(p._rev)
          p.total_quantity = round2(p._qty)
        }
      }
    } else {
      // ── Level 1: Group ────────────────────────────────────────────────────
      // May start with a numeric code like "1000 ACQUA" – strip it
      const groupName = name.replace(/^\d+\s+/, '').trim() || name
      currentGroup   = groupName
      currentArticle = null

      if (brutto > 0 || qty > 0) {
        const eg = groupMap.get(groupName) ?? { rev: 0, qty: 0, netto: 0, mwst: 0 }
        eg.rev   += brutto
        eg.qty   += qty
        eg.netto += netto
        eg.mwst  += mwst
        groupMap.set(groupName, eg)
      }
    }
  }

  const products: ProductRow[] = Array.from(productMap.values()).map(({ _rev, _qty, ...p }) => p)

  const productGroups: ProductGroupRow[] = Array.from(groupMap.entries()).map(([name, g]) => ({
    name,
    total_revenue: round2(g.rev),
    total_quantity: g.qty ? round2(g.qty) : null,
    netto: g.netto ? round2(g.netto) : null,
    mwst: g.mwst ? round2(g.mwst) : null,
    year: meta.year ?? null,
    month: meta.month ?? null,
  }))

  return { products, productGroups }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser: orders_by_article
// Bestellungen_nach_Artikel
// Columns: Name, PLU, Anzahl, Preis(CHF), Rabatt, Netto, MwSt, Brutto(CHF)
// Skip date rows like "01.05.2026 Im Haus"
// ─────────────────────────────────────────────────────────────────────────────

function parseOrdersByArticle(
  matrix: unknown[][], headerIdx: number, meta: FileMeta
): { products: ProductRow[] } {
  const hdr = Array.isArray(matrix[headerIdx]) ? matrix[headerIdx] as unknown[] : []

  const cName   = col(hdr, 0, 'name', 'bezeichnung')
  const cPlu    = col(hdr, 1, 'plu')
  const cQty    = col(hdr, 2, 'anzahl', 'menge')
  const cPrice  = col(hdr, 3, 'preis')
  const cNetto  = col(hdr, 5, 'netto')
  const cMwst   = col(hdr, 6, 'mwst')
  const cBrutto = col(hdr, 7, 'brutto', 'gesamtumsatz')

  const productMap = new Map<string, { rev: number; qty: number; plu: string | null; price: number | null; netto: number; mwst: number }>()

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = Array.isArray(matrix[i]) ? matrix[i] as unknown[] : []
    const cells = row.map(c => String(c ?? '').trim())
    const name = cellStr(row, cName) || cells[0] || ''

    if (!name || cells.every(c => c === '')) continue
    if (isSkipRow(name)) continue

    // Skip date rows: "01.05.2026 Im Haus" or standalone dates
    const firstWord = name.split(' ')[0]
    if (DATE_RE.test(firstWord) || DATE_RE.test(name)) continue

    const brutto = parseNumber(row[cBrutto])
    if (brutto <= 0) continue

    const existing = productMap.get(name)
    if (existing) {
      existing.rev   += brutto
      existing.qty   += parseNumber(row[cQty])
      existing.netto += parseNumber(row[cNetto])
      existing.mwst  += parseNumber(row[cMwst])
    } else {
      productMap.set(name, {
        rev: brutto,
        qty: parseNumber(row[cQty]),
        plu: cellStr(row, cPlu) || null,
        price: parseNumber(row[cPrice]) || null,
        netto: parseNumber(row[cNetto]),
        mwst: parseNumber(row[cMwst]),
      })
    }
  }

  const products: ProductRow[] = Array.from(productMap.entries()).map(([name, p]) => ({
    name,
    plu: p.plu,
    price: p.price,
    total_revenue: round2(p.rev),
    total_quantity: round2(p.qty),
    netto: p.netto ? round2(p.netto) : null,
    mwst: p.mwst ? round2(p.mwst) : null,
    year: meta.year ?? null,
    month: meta.month ?? null,
  }))

  return { products }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser: stornos_by_employee
// Stornos_pro_Mitarbeiter_und_Tag
// Level 1: Employee name row (text only, no numbers)
// Level 2: Date rows with storno amounts (negative brutto)
// ─────────────────────────────────────────────────────────────────────────────

function parseStornosByEmployee(
  matrix: unknown[][], headerIdx: number, meta: FileMeta
): { employees: EmployeeRow[] } {
  const hdr = Array.isArray(matrix[headerIdx]) ? matrix[headerIdx] as unknown[] : []

  const cQty    = col(hdr, 2, 'anzahl', 'menge')
  const cBrutto = col(hdr, 5, 'brutto')

  const employeeMap = new Map<string, { count: number; amount: number }>()
  let currentEmployee: string | null = null

  // Start from max(headerIdx+1, 0) to handle files with no clear header
  const startRow = Math.max(0, headerIdx + 1)

  for (let i = startRow; i < matrix.length; i++) {
    const row = Array.isArray(matrix[i]) ? matrix[i] as unknown[] : []
    const cells = row.map(c => String(c ?? '').trim())
    const name = cells[0] || ''

    if (!name || cells.every(c => c === '')) continue
    if (isSkipRow(name)) continue

    const nonEmpty   = cells.filter(c => c !== '').length
    const hasNumbers = cells.slice(1).some(c => /^-?[\d.,]+$/.test(c.replace(/'/g, '')))
    const isDate     = DATE_RE.test(name) || DATE_RE.test(name.split(' ')[0])

    if (!hasNumbers && !isDate && nonEmpty <= 2) {
      // Level 1: Employee name row
      currentEmployee = name
      if (!employeeMap.has(name)) {
        employeeMap.set(name, { count: 0, amount: 0 })
      }
    } else if (currentEmployee && (isDate || hasNumbers)) {
      // Level 2: Storno detail (date + branch + qty + amounts)
      const brutto = parseNumber(row[cBrutto])
      const qty    = Math.abs(parseNumber(row[cQty]))
      const ep     = employeeMap.get(currentEmployee)!
      ep.amount += brutto
      ep.count  += qty || 1
    }
  }

  const employees: EmployeeRow[] = Array.from(employeeMap.entries()).map(([name, d]) => ({
    name,
    storno_count: d.count || null,
    storno_amount: d.amount ? round2(d.amount) : null,
    year: meta.year ?? null,
    month: meta.month ?? null,
  }))

  return { employees }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = detectReportType(file.name)

  if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
    throw new Error(`Nicht unterstütztes Format ".${ext}". Bitte XLS, XLSX oder CSV verwenden.`)
  }

  let matrix: unknown[][] = []

  if (ext === 'csv') {
    const text = await file.text()
    const result = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false, delimiter: '' })
    matrix = result.data as unknown[][]
  } else {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) throw new Error('Excel-Datei enthält keine Tabellen.')
    matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1, defval: '', blankrows: false,
    })
  }

  const headerIdx = findHeaderRow(matrix)
  const meta      = extractMeta(matrix, file.name)

  console.info('[csvParser] Typ:', type, '| Headerzeile:', headerIdx, '| Meta:', JSON.stringify(meta))

  const empty: ParsedFile = { type, meta, products: [], productGroups: [], payments: [], sales: [], employees: [] }

  switch (type) {
    case 'revenue_by_payment': {
      const { products, payments, sales } = parseRevenueByPayment(matrix, headerIdx, meta)
      console.info('[csvParser] Produkte:', products.length, '| Zahlungsarten:', payments.length, '| Sales:', sales.length)
      return { ...empty, products, payments, sales }
    }
    case 'orders_by_group': {
      const { productGroups } = parseOrdersByGroup(matrix, headerIdx, meta)
      console.info('[csvParser] Warengruppen:', productGroups.length)
      return { ...empty, productGroups }
    }
    case 'orders_by_group_article': {
      const { products, productGroups } = parseOrdersByGroupArticle(matrix, headerIdx, meta)
      console.info('[csvParser] Produkte:', products.length, '| Warengruppen:', productGroups.length)
      return { ...empty, products, productGroups }
    }
    case 'orders_by_article': {
      const { products } = parseOrdersByArticle(matrix, headerIdx, meta)
      console.info('[csvParser] Produkte:', products.length)
      return { ...empty, products }
    }
    case 'stornos_by_employee': {
      const { employees } = parseStornosByEmployee(matrix, headerIdx, meta)
      console.info('[csvParser] Mitarbeiter:', employees.length)
      return { ...empty, employees }
    }
    default:
      console.warn('[csvParser] Unbekannter Berichtstyp für Datei:', file.name)
      return empty
  }
}
