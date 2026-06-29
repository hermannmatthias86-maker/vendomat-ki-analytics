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
  // Revenue – Gesamtumsatz is the definitive total; netto/brutto are separate columns
  gesamtumsatz: 'total_amount', nettoumsatz: 'total_amount', bruttoumsatz: 'total_amount',
  'netto umsatz': 'total_amount', 'brutto umsatz': 'total_amount',
  umsatz: 'total_amount', revenue: 'total_amount', betrag: 'total_amount',
  // Brutto = Gesamtumsatz in this file layout
  brutto: 'total_amount',
  // Per-row subtotals stored under own keys
  netto: 'netto', mwst: 'mwst', rabatt: 'rabatt',
  // Price
  'preis(chf)': 'price', preis: 'price', price: 'price',
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const str = String(val).replace(/'/g, '').replace(/\s/g, '')
  if (!str || !/^[-+]?[\d.,]+$/.test(str)) return 0
  // German format: 1.234,56 (dot before comma = thousands sep)
  if (str.includes(',') && str.includes('.') && str.indexOf('.') < str.indexOf(',')) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0
  }
  return parseFloat(str.replace(',', '.')) || 0
}

function isPaymentGroupHeader(row: unknown[], numHeaderCols: number): boolean {
  if (numHeaderCols <= 3) return false
  const cells = row.map((c) => String(c ?? '').trim())
  const nonEmpty = cells.filter((c) => c !== '').length
  if (nonEmpty === 0 || nonEmpty > 2) return false
  if (!cells.slice(1).every((c) => c === '')) return false
  const first = cells[0]
  if (!first) return false
  if (SKIP_ROW_PREFIXES.some((p) => first.toLowerCase().startsWith(p))) return false
  if (DATE_PATTERN.test(first)) return false
  return true
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
    h.includes('artikel') || h.includes('produkt') || h.includes('bezeichnung') || h === 'name',
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

export interface PaymentGroup {
  payment_type: string
  total: number
}

export async function parseFile(file: File): Promise<{
  type: ReportType
  rows: ParsedRow[]
  headers: string[]
  year?: number
  month?: number
  debugInfo?: string
  paymentGroups?: PaymentGroup[]
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

    // Build header map preserving ORIGINAL column indices (filter(Boolean) would break index alignment)
    const headerMapping: { name: string; colIdx: number }[] = []
    rawHeaderRow.forEach((c, idx) => {
      const h = String(c ?? '').trim()
      if (h) headerMapping.push({ name: h, colIdx: idx })
    })
    headers = headerMapping.map((m) => m.name)
    const totalCols = rawHeaderRow.length  // full width including empty columns

    // headerStr for duplicate-row detection uses only non-empty header names
    const headerStr = headers.join('|')
    debugInfo = `XLS: Headerzeile ${headerRowIdx}, Spalten: ${headers.join(', ')} (total cols: ${totalCols})`

    // Resolve which raw column index holds the total_amount (Brutto/Gesamtumsatz)
    // Primary: from header mapping; Fallback: col 12 per confirmed file layout
    let totalColIdx = headerMapping.find((m) => normalizeKey(m.name) === 'total_amount')?.colIdx ?? -1
    if (totalColIdx < 0 && totalCols >= 13) totalColIdx = 12

    // Same for quantity (Anzahl = col 5) and netto (col 10)
    const quantityColIdx = headerMapping.find((m) => normalizeKey(m.name) === 'total_quantity')?.colIdx
      ?? (totalCols >= 6 ? 5 : -1)
    const nettoColIdx = headerMapping.find((m) => normalizeKey(m.name) === 'netto')?.colIdx
      ?? (totalCols >= 11 ? 10 : -1)

    let currentPaymentType: string | null = null
    const paymentGroupMap = new Map<string, number>()
    // Known payment type prefixes
    const PAYMENT_PREFIXES = ['debitori', 'carte', 'contanti', 'bar ', 'karte', 'twint', 'reka']

    for (let i = headerRowIdx + 1; i < matrix.length; i++) {
      const row = Array.isArray(matrix[i]) ? (matrix[i] as unknown[]) : []
      const cells = row.map((c) => String(c ?? '').trim())
      const firstName = cells[0] ?? ''
      const firstLower = firstName.toLowerCase()

      // Payment group header: first cell has text, everything else empty, not a data row
      // Also catch known payment type keywords explicitly
      const isKnownPayment = PAYMENT_PREFIXES.some((p) => firstLower.startsWith(p))
      if (isKnownPayment || isPaymentGroupHeader(row, totalCols)) {
        currentPaymentType = firstName
        continue
      }

      // Skip total/summary rows and empty rows
      if (isSkipRow(row, totalCols)) continue

      // Skip repeated header rows
      const rowStr = headerMapping.map((m) => String(row[m.colIdx] ?? '').trim()).join('|')
      if (rowStr === headerStr) continue

      // Skip rows where col 0 (Name) is empty – these are filler/structure rows
      if (!firstName) continue

      const obj: Record<string, unknown> = {}
      // Map using ORIGINAL column indices to avoid empty-column offset bugs
      headerMapping.forEach(({ name, colIdx }) => { obj[name] = row[colIdx] ?? '' })

      // Index-based fallbacks for sparse files where header detection may miss columns
      if (obj['Anzahl'] === '' || obj['Anzahl'] === undefined) {
        const v = row[quantityColIdx]
        if (v !== '' && v !== undefined) obj['Anzahl'] = v
      }
      if (obj['Brutto'] === '' || obj['Brutto'] === undefined) {
        const v = row[totalColIdx]
        if (v !== '' && v !== undefined) obj['Brutto'] = v
      }
      if (obj['Netto'] === '' || obj['Netto'] === undefined) {
        const v = row[nettoColIdx]
        if (v !== '' && v !== undefined) obj['Netto'] = v
      }

      if (currentPaymentType) obj.__payment_type = currentPaymentType
      rawRows.push(obj)

      // Accumulate payment group total from the Brutto/Gesamtumsatz column
      if (currentPaymentType && totalColIdx >= 0) {
        const amount = parseNumber(row[totalColIdx])
        if (amount > 0) {
          paymentGroupMap.set(currentPaymentType, (paymentGroupMap.get(currentPaymentType) ?? 0) + amount)
        }
      }
    }

    if (paymentGroupMap.size > 0) {
      const groups: PaymentGroup[] = Array.from(paymentGroupMap.entries()).map(([pt, total]) => ({
        payment_type: pt,
        total,
      }))
      ;(rawRows as unknown as { __paymentGroups?: PaymentGroup[] }).__paymentGroups = groups
    }

    // Scan pre-header title rows for a date range like "01.06.2026 - 30.06.2026"
    const preHeaderText = matrix
      .slice(0, headerRowIdx + 1)
      .flatMap((r) => (Array.isArray(r) ? r : []))
      .map((c) => String(c ?? ''))
      .join(' ')
    ;(rawRows as unknown as { __preHeaderText?: string }).__preHeaderText = preHeaderText

    debugInfo += `, ${rawRows.length} Datenzeilen nach Filterung`
  } else {
    throw new Error(
      `Nicht unterstütztes Dateiformat ".${ext}". Bitte CSV, XLSX oder XLS verwenden.`,
    )
  }

  const type = detectReportType(headers, String(file.name ?? ''))

  // Extract paymentGroups that were attached during XLS parsing
  const attachedGroups = (rawRows as unknown as { __paymentGroups?: PaymentGroup[] }).__paymentGroups
  const paymentGroups: PaymentGroup[] | undefined = attachedGroups

  const rows: ParsedRow[] = rawRows.map((row) => {
    const normalized: ParsedRow = {}
    for (const key in row) {
      if (key === '__paymentGroups') continue
      const normKey = normalizeKey(key)
      const val = row[key]
      if (STRING_FIELDS.has(normKey)) {
        normalized[normKey] = String(val ?? '').trim() || null
      } else if (typeof val === 'number') {
        // SheetJS returns real JS numbers for numeric Excel cells – use directly
        normalized[normKey] = isNaN(val) ? null : val
      } else {
        const rawStr = String(val ?? '').trim()
        if (!rawStr) {
          normalized[normKey] = null
        } else {
          const num = parseNumber(rawStr)
          // Only store as number if it actually parsed; otherwise keep as string
          normalized[normKey] = (num !== 0 || rawStr === '0') ? num : (rawStr || null)
        }
      }
    }
    return normalized
  })

  const yearMatch = String(file.name ?? '').match(/20\d{2}/)
  let year = yearMatch ? parseInt(yearMatch[0]) : undefined
  let month: number | undefined

  // Extract month/year from pre-header title rows (e.g. "01.06.2026 - 30.06.2026")
  const preHeaderText = (rawRows as unknown as { __preHeaderText?: string }).__preHeaderText ?? ''
  const scanText = preHeaderText + ' ' + String(file.name ?? '')
  // DD.MM.YYYY pattern
  const dmyMatch = scanText.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/)
  if (dmyMatch) {
    month = parseInt(dmyMatch[2])
    year = year ?? parseInt(dmyMatch[3])
  }
  // YYYY-MM-DD fallback
  if (!month) {
    const ymdMatch = scanText.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (ymdMatch) { year = year ?? parseInt(ymdMatch[1]); month = parseInt(ymdMatch[2]) }
  }

  const colMap = Object.fromEntries(headers.map((h) => [h, normalizeKey(h)]))
  console.info('[csvParser]', debugInfo, '| Typ:', type, '| Jahr:', year, '| Monat:', month)
  console.info('[csvParser] Spalten-Mapping:', JSON.stringify(colMap))
  console.info('[csvParser] Erste 3 Zeilen:', JSON.stringify(rows.slice(0, 3)))
  if (paymentGroups?.length) console.info('[csvParser] Zahlungsgruppen:', JSON.stringify(paymentGroups))

  return { type, rows, headers, year, month, debugInfo, paymentGroups }
}
