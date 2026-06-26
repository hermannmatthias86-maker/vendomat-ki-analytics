import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export type ReportType = 'sales' | 'products' | 'employees' | 'payments' | 'product_groups' | 'unknown'

export interface ParsedRow {
  [key: string]: string | number | null
}

// Longer/more specific aliases must come before shorter ones that are substrings
const COLUMN_ALIASES: Record<string, string> = {
  // Date
  buchungsdatum: 'date', 'verkauf datum': 'date', datum: 'date', date: 'date',
  // Revenue – ordered longest first to prevent short alias shadowing
  gesamtumsatz: 'total_amount', nettoumsatz: 'total_amount', bruttoumsatz: 'total_amount',
  'netto umsatz': 'total_amount', 'brutto umsatz': 'total_amount',
  umsatz: 'total_amount', revenue: 'total_amount', betrag: 'total_amount',
  netto: 'total_amount',
  // Transaction count
  'anzahl transaktionen': 'transaction_count', transaktionen: 'transaction_count',
  belege: 'transaction_count', bons: 'transaction_count',
  // Average receipt
  'ø bonwert': 'average_receipt', 'durchschnitt bon': 'average_receipt', bonwert: 'average_receipt',
  // Quantity – must come BEFORE 'artikel' so "anzahl" doesn't fall through to 'name'
  anzahl: 'total_quantity', menge: 'total_quantity', quantity: 'total_quantity',
  // Product name (longer ones first)
  artikelbezeichnung: 'name', 'artikel name': 'name', artikelname: 'name',
  bezeichnung: 'name', artikel: 'name',
  // Product group
  warengruppe: 'product_group', 'artikel gruppe': 'product_group',
  kategorie: 'product_group', category: 'product_group',
  // Employee
  mitarbeiter: 'name', kassier: 'name', kellner: 'name',
  // Payment type
  abrechnungsart: 'payment_type', zahlungsart: 'payment_type',
  'zahlungs art': 'payment_type', zahlung: 'payment_type',
  // Percentage
  anteil: 'percentage', prozent: 'percentage',
}

const HEADER_KEYWORDS = [
  'datum', 'date', 'name', 'bezeichnung', 'artikel', 'umsatz', 'gesamtumsatz',
  'menge', 'anzahl', 'mitarbeiter', 'zahlungsart', 'abrechnungsart', 'warengruppe',
  'netto', 'brutto', 'preis', 'transaktionen', 'betrag', 'bonwert',
]

const SKIP_ROW_PREFIXES = ['gesamt', 'total', 'summe', 'zwischensumme', 'subtotal', 'grand']

// Date patterns like 01.06.2026 or 2026-06-01 or 2026/06/01
const DATE_PATTERN = /^\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4}$|^\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}$/

// Fields that must always be stored as strings – never parsed as numbers
const STRING_FIELDS = new Set(['name', 'date', 'payment_type', 'product_group'])

function normalizeKey(key: unknown): string {
  const lower = String(key ?? '').toLowerCase().trim()
  const sorted = Object.entries(COLUMN_ALIASES).sort(([a], [b]) => b.length - a.length)
  for (const [alias, mapped] of sorted) {
    if (lower.includes(alias)) return mapped
  }
  return lower.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '') || '_'
}

function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return isNaN(raw) ? null : raw
  const raw_s = String(raw ?? '').trim()
  if (!raw_s) return null
  // Strip Swiss apostrophe thousands separator before validation: 1'234.56 → 1234.56
  const s = raw_s.replace(/'/g, '')
  // Only parse values that look like pure numbers (digits, separators, optional sign).
  // Prevents "1/2 AFFETTATO LEVENTINESE" or "01.06.2026" from being parsed as a number.
  if (!/^[-+]?[\d.,]+$/.test(s)) return null
  // German/Swiss format detection:
  // "1.234,56" → remove thousands sep '.', replace decimal ',' → '.'
  // "1234.56" or "1234,56" → straightforward
  let normalized: string
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot && s.indexOf('.') < s.indexOf(',')) {
    // German: 1.234,56
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma && !hasDot) {
    // 1234,56
    normalized = s.replace(',', '.')
  } else {
    // 1234.56 or 1234
    normalized = s
  }
  const n = parseFloat(normalized.replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? null : n
}

function isHeaderRow(row: unknown[]): boolean {
  const cells = row.map((c) => String(c ?? '').toLowerCase().trim())
  const matches = cells.filter((c) => HEADER_KEYWORDS.some((kw) => c.includes(kw)))
  return matches.length >= 2
}

function isSkipRow(row: unknown[], numHeaderCols: number): boolean {
  if (!row || !row.length) return true
  const cells = row.map((c) => String(c ?? '').trim())
  const first = String(cells[0] ?? '').toLowerCase()
  const nonEmpty = cells.filter((c) => c !== '').length

  if (nonEmpty === 0) return true
  // Subtotal / group footer rows
  if (SKIP_ROW_PREFIXES.some((p) => first.startsWith(p))) return true
  // Date-only rows that mark group headers (e.g. "01.06.2026")
  if (DATE_PATTERN.test(String(cells[0] ?? '').trim())) return true
  // Rows with only 1–2 filled cells are group headers / footers, not data
  if (numHeaderCols > 3 && nonEmpty <= 2 && cells.slice(2).every((c) => c === '')) return true

  return false
}

function detectReportType(headers: string[], filename = ''): ReportType {
  const n = headers.map((h) => String(h ?? '').toLowerCase())
  const fn = String(filename ?? '').toLowerCase()

  const hasDate = n.some((h) => h.includes('datum') || h.includes('date'))
  const hasProduct = n.some((h) =>
    h.includes('artikel') || h.includes('produkt') || h.includes('bezeichnung'),
  )
  const hasEmployee = n.some((h) => h.includes('mitarbeiter') || h.includes('kassier'))
  const hasPayment = n.some((h) =>
    h.includes('zahlungs') || h.includes('zahlung') || h.includes('abrechnungsart'),
  )
  const hasGroup = n.some((h) => h.includes('warengruppe') || h.includes('kategorie'))
  const hasQuantity = n.some((h) => h.includes('anzahl') || h.includes('menge'))
  const hasAmount = n.some((h) =>
    h.includes('umsatz') || h.includes('betrag') || h.includes('netto') || h.includes('brutto'),
  )

  if (hasDate && !hasProduct && !hasEmployee) return 'sales'
  if (hasProduct && !hasEmployee) return 'products'
  if (hasEmployee) return 'employees'
  if (hasPayment && !hasProduct) return 'payments'
  if (hasGroup) return 'product_groups'

  // Filename hints when headers are ambiguous
  if (fn.includes('artikel') || fn.includes('produkt')) return 'products'
  if (fn.includes('mitarbeiter')) return 'employees'
  if (fn.includes('warengruppe')) return 'product_groups'
  if (fn.includes('zahlung') || fn.includes('abrechnung')) return 'payments'

  // "Name + Anzahl/Menge + amount" without a date column = product report
  const hasName = n.some((h) => h === 'name' || h.includes('bezeichnung'))
  if (hasName && hasQuantity && hasAmount && !hasDate) return 'products'

  return 'unknown'
}

export async function parseFile(file: File): Promise<{
  type: ReportType
  rows: ParsedRow[]
  headers: string[]
  year?: number
  debugInfo?: string
}> {
  const ext = String(file.name ?? '').split('.').pop()?.toLowerCase() ?? ''

  let rawRows: Record<string, unknown>[] = []
  let headers: string[] = []
  let debugInfo = ''

  if (ext === 'csv') {
    const text = await file.text()
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    })
    rawRows = result.data as Record<string, unknown>[]
    headers = (result.meta.fields || []).map((f) => String(f ?? ''))
    debugInfo = `CSV: ${rawRows.length} Zeilen, Spalten: ${headers.join(', ')}`
  } else if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) throw new Error('Excel-Datei enthält keine Tabellen.')
    const sheet = workbook.Sheets[sheetName]

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    })

    // Find the actual data header row (first row with >= 2 known column keyword matches)
    let headerRowIdx = 0
    for (let i = 0; i < Math.min(matrix.length, 25); i++) {
      const row = matrix[i]
      if (Array.isArray(row) && isHeaderRow(row)) {
        headerRowIdx = i
        break
      }
    }

    const rawHeaderRow = Array.isArray(matrix[headerRowIdx]) ? (matrix[headerRowIdx] as unknown[]) : []
    headers = rawHeaderRow.map((c) => String(c ?? '').trim()).filter(Boolean)
    const headerStr = headers.map((h) => String(h ?? '').trim()).join('|')
    debugInfo = `XLS: Headerzeile ${headerRowIdx}, Spalten: ${headers.join(', ')}`

    for (let i = headerRowIdx + 1; i < matrix.length; i++) {
      const row = Array.isArray(matrix[i]) ? (matrix[i] as unknown[]) : []
      if (isSkipRow(row, headers.length)) continue
      const rowStr = row.slice(0, headers.length).map((c) => String(c ?? '').trim()).join('|')
      if (rowStr === headerStr) continue

      const obj: Record<string, unknown> = {}
      headers.forEach((h, j) => {
        obj[h] = row[j] ?? ''
      })
      rawRows.push(obj)
    }

    debugInfo += `, ${rawRows.length} Datenzeilen nach Filterung`
  } else {
    throw new Error(
      `Nicht unterstütztes Dateiformat ".${ext}". Bitte CSV, XLSX oder XLS verwenden.`,
    )
  }

  const type = detectReportType(headers, String(file.name ?? ''))

  const rows: ParsedRow[] = rawRows.map((row) => {
    const normalized: ParsedRow = {}
    for (const key in row) {
      const normKey = normalizeKey(key)
      const val = row[key]
      if (STRING_FIELDS.has(normKey)) {
        // Always store as string – article names like "1/2 AFFETTATO..." must not become 12
        normalized[normKey] = String(val ?? '').trim() || null
      } else {
        const num = parseNumber(val)
        normalized[normKey] = num !== null ? num : (String(val ?? '').trim() || null)
      }
    }
    return normalized
  })

  const yearMatch = String(file.name ?? '').match(/20\d{2}/)
  const year = yearMatch ? parseInt(yearMatch[0]) : undefined

  // Column mapping diagnostic: original header → normalized key
  const colMap = Object.fromEntries(headers.map((h) => [h, normalizeKey(h)]))
  console.info('[csvParser]', debugInfo, '| Typ:', type, '| Jahr:', year)
  console.info('[csvParser] Spalten-Mapping:', JSON.stringify(colMap))
  console.info('[csvParser] Erste 3 Zeilen:', JSON.stringify(rows.slice(0, 3)))

  return { type, rows, headers, year, debugInfo }
}
