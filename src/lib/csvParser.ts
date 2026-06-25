import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export type ReportType = 'sales' | 'products' | 'employees' | 'payments' | 'product_groups' | 'unknown'

export interface ParsedRow {
  [key: string]: string | number | null
}

const COLUMN_ALIASES: Record<string, string> = {
  datum: 'date', date: 'date', 'verkauf datum': 'date',
  umsatz: 'total_amount', 'netto umsatz': 'total_amount', revenue: 'total_amount', betrag: 'total_amount',
  transaktionen: 'transaction_count', 'anzahl transaktionen': 'transaction_count', bons: 'transaction_count',
  bonwert: 'average_receipt', 'ø bonwert': 'average_receipt', 'durchschnitt bon': 'average_receipt',
  artikel: 'name', artikelname: 'name', 'artikel name': 'name',
  menge: 'total_quantity', anzahl: 'total_quantity', quantity: 'total_quantity',
  warengruppe: 'product_group', kategorie: 'product_group', category: 'product_group',
  mitarbeiter: 'name', kassier: 'name', kellner: 'name',
  zahlungsart: 'payment_type', zahlung: 'payment_type', 'zahlungs art': 'payment_type',
  anteil: 'percentage', '%': 'percentage', prozent: 'percentage',
}

function normalizeKey(key: string): string {
  const lower = key.toLowerCase().trim()
  for (const alias in COLUMN_ALIASES) {
    if (lower.includes(alias)) return COLUMN_ALIASES[alias]
  }
  return lower.replace(/\s+/g, '_')
}

function detectReportType(headers: string[]): ReportType {
  const normalized = headers.map((h) => h.toLowerCase())
  const hasDate = normalized.some((h) => h.includes('datum') || h.includes('date'))
  const hasProduct = normalized.some((h) => h.includes('artikel') || h.includes('produkt'))
  const hasEmployee = normalized.some((h) => h.includes('mitarbeiter') || h.includes('kassier'))
  const hasPayment = normalized.some((h) => h.includes('zahlungs') || h.includes('zahlung'))
  const hasGroup = normalized.some((h) => h.includes('warengruppe') || h.includes('kategorie'))

  if (hasDate && !hasProduct && !hasEmployee) return 'sales'
  if (hasProduct && !hasEmployee) return 'products'
  if (hasEmployee) return 'employees'
  if (hasPayment) return 'payments'
  if (hasGroup) return 'product_groups'
  return 'unknown'
}

export async function parseFile(file: File): Promise<{
  type: ReportType
  rows: ParsedRow[]
  headers: string[]
  year?: number
}> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  let rawRows: Record<string, string>[] = []
  let headers: string[] = []

  if (ext === 'csv') {
    const text = await file.text()
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    })
    rawRows = result.data
    headers = result.meta.fields || []
  } else if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })
    rawRows = jsonData
    headers = Object.keys(jsonData[0] || {})
  } else {
    throw new Error('Nicht unterstütztes Dateiformat. Bitte CSV oder Excel verwenden.')
  }

  const type = detectReportType(headers)
  const rows: ParsedRow[] = rawRows.map((row) => {
    const normalized: ParsedRow = {}
    for (const key in row) {
      const normKey = normalizeKey(key)
      const val = row[key]
      const num = parseFloat(val?.toString().replace(',', '.') || '')
      normalized[normKey] = isNaN(num) ? val : num
    }
    return normalized
  })

  // Extract year from filename or data
  const yearMatch = file.name.match(/20\d{2}/)
  const year = yearMatch ? parseInt(yearMatch[0]) : undefined

  return { type, rows, headers, year }
}
