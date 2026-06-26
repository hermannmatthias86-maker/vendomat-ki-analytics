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

// Known header keywords used to detect the actual data header row in grouped XLS files
const HEADER_KEYWORDS = [
  'datum', 'date', 'name', 'bezeichnung', 'artikel', 'umsatz', 'gesamtumsatz',
  'menge', 'anzahl', 'mitarbeiter', 'zahlungsart', 'abrechnungsart', 'warengruppe',
  'netto', 'brutto', 'preis', 'transaktionen', 'betrag', 'bonwert',
]

// Prefixes that indicate group-header / subtotal rows (not actual data)
const SKIP_ROW_PREFIXES = ['gesamt', 'total', 'summe', 'zwischensumme', 'subtotal', 'grand']

function normalizeKey(key: string): string {
  // Sort aliases longest-first so more specific ones match before shorter substrings
  const lower = key.toLowerCase().trim()
  const sorted = Object.entries(COLUMN_ALIASES).sort(([a], [b]) => b.length - a.length)
  for (const [alias, mapped] of sorted) {
    if (lower.includes(alias)) return mapped
  }
  return lower.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')
}

function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return isNaN(raw) ? null : raw
  const s = String(raw).trim()
  if (!s) return null
  // German format: "1.234,56" → remove '.', replace ',' → '.'
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  let normalized: string
  if (hasComma && hasDot && s.indexOf('.') < s.indexOf(',')) {
    // German: 1.234,56
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma && !hasDot) {
    // German decimal: 1,5
    normalized = s.replace(',', '.')
  } else {
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
  const cells = row.map((c) => String(c ?? '').trim())
  const first = cells[0].toLowerCase()
  const nonEmpty = cells.filter((c) => c !== '').length

  if (nonEmpty === 0) return true
  if (SKIP_ROW_PREFIXES.some((p) => first.startsWith(p))) return true
  // Group-header rows typically have a value only in the first 1-2 columns
  if (numHeaderCols > 3 && nonEmpty <= 2 && cells.slice(2).every((c) => c === '')) return true

  return false
}

function detectReportType(headers: string[], filename = ''): ReportType {
  const n = headers.map((h) => h.toLowerCase())
  const fn = filename.toLowerCase()

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

  // A "Name + Anzahl/Menge + amount" structure = product report
  const hasName = n.some((h) => h === 'name' || h.includes('bezeichnung'))
  if (hasName && hasQuantity && hasAmount) return 'products'

  return 'unknown'
}

export async function parseFile(file: File): Promise<{
  type: ReportType
  rows: ParsedRow[]
  headers: string[]
  year?: number
  debugInfo?: string
}> {
  const ext = file.name.split('.').pop()?.toLowerCase()

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
    headers = result.meta.fields || []
    debugInfo = `CSV: ${rawRows.length} Zeilen, Spalten: ${headers.join(', ')}`
  } else if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) throw new Error('Excel-Datei enthält keine Tabellen.')
    const sheet = workbook.Sheets[sheetName]

    // Read as raw array matrix so we can handle grouped/titled JasperReports layouts
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    })

    // Find the actual header row (first row with >= 2 known column keyword matches)
    let headerRowIdx = 0
    for (let i = 0; i < Math.min(matrix.length, 20); i++) {
      if (isHeaderRow(matrix[i] as unknown[])) {
        headerRowIdx = i
        break
      }
    }

    headers = (matrix[headerRowIdx] as unknown[]).map((c) => String(c ?? '').trim()).filter(Boolean)
    const headerStr = headers.join('|')
    debugInfo = `XLS: Headerzeile ${headerRowIdx}, Spalten: ${headers.join(', ')}`

    // Convert data rows, skipping group headers, subtotals, empty rows and repeated headers
    for (let i = headerRowIdx + 1; i < matrix.length; i++) {
      const row = matrix[i] as unknown[]
      if (isSkipRow(row, headers.length)) continue
      // Skip repeated header rows
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

  const type = detectReportType(headers, file.name)

  const rows: ParsedRow[] = rawRows.map((row) => {
    const normalized: ParsedRow = {}
    for (const key in row) {
      const normKey = normalizeKey(key)
      const val = row[key]
      const num = parseNumber(val)
      normalized[normKey] = num !== null ? num : (String(val ?? '').trim() || null)
    }
    return normalized
  })

  // Extract year from filename (e.g. 2026-06-01 or 2026)
  const yearMatch = file.name.match(/20\d{2}/)
  const year = yearMatch ? parseInt(yearMatch[0]) : undefined

  console.info('[csvParser]', debugInfo, '| Typ:', type, '| Jahr:', year)

  return { type, rows, headers, year, debugInfo }
}
