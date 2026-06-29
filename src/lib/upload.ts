import { supabase } from './supabase'
import { parseFile, type ParsedRow, type ReportType, type PaymentGroup } from './csvParser'
import { generateAIInsights } from './openai'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function uploadAndProcess(
  file: File,
  customerId: string,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; message: string; rowsImported: number }> {
  onProgress?.(10)

  const { data: upload, error: uploadError } = await supabase
    .from('uploads')
    .insert({
      customer_id: customerId,
      user_id: userId,
      filename: file.name,
      file_type: file.name.split('.').pop() || 'unknown',
      status: 'processing',
    })
    .select()
    .single()

  if (uploadError) throw new Error(uploadError.message || JSON.stringify(uploadError))
  const uploadRecord = upload as any
  onProgress?.(20)

  try {
    const { type, rows, year, debugInfo, paymentGroups } = await parseFile(file)
    onProgress?.(50)

    console.info('[upload] Datei geparst:', { type, year, debugInfo, rowCount: rows.length, customerId })
    if (rows.length > 0) {
      console.info('[upload] Beispiel-Zeile:', JSON.stringify(rows[0]))
    }

    if (type === 'unknown') {
      await supabase.from('uploads').update({ status: 'error' }).eq('id', uploadRecord.id)
      return { success: false, message: 'Unbekanntes Dateiformat', rowsImported: 0 }
    }

    const rowsImported = await insertRows(type, rows, customerId, uploadRecord.id, year, paymentGroups)
    onProgress?.(90)

    console.info('[upload] Import abgeschlossen:', { rowsImported, type })

    await supabase
      .from('uploads')
      .update({ status: 'done', report_type: type, year: year || null })
      .eq('id', uploadRecord.id)

    // Auto-trigger AI analysis after products or payments upload
    if (rowsImported > 0 && (type === 'products' || type === 'payments' || type === 'sales')) {
      triggerAutoAIAnalysis(customerId).catch((err) =>
        console.warn('[upload] Auto-KI-Analyse fehlgeschlagen:', err)
      )
    }

    onProgress?.(100)
    return { success: true, message: `${rowsImported} Datensätze importiert`, rowsImported }
  } catch (err) {
    console.error('[upload] Fehler:', err)
    await supabase.from('uploads').update({ status: 'error' }).eq('id', uploadRecord.id)
    throw err
  }
}

async function triggerAutoAIAnalysis(customerId: string): Promise<void> {
  const { data: salesData } = await supabase
    .from('sales')
    .select('total_amount, transaction_count, year')
    .eq('customer_id', customerId)

  const { data: productsData } = await supabase
    .from('products')
    .select('name, total_revenue')
    .eq('customer_id', customerId)
    .order('total_revenue', { ascending: false })
    .limit(5)

  const { data: customerData } = await supabase
    .from('customers')
    .select('name')
    .eq('id', customerId)
    .maybeSingle()

  const sales = (salesData as any[]) || []
  const products = (productsData as any[]) || []
  const customerName = (customerData as any)?.name || 'Kunde'

  const totalRevenue = sales.reduce((s: number, r: any) => s + (r.total_amount || 0), 0)
  const totalTransactions = sales.reduce((s: number, r: any) => s + (r.transaction_count || 0), 0)
  const avgReceipt = totalTransactions ? totalRevenue / totalTransactions : 0
  const years = [...new Set(sales.map((r: any) => r.year).filter(Boolean))]

  const top5 = products.map((p: any) => `${p.name}: CHF ${(p.total_revenue || 0).toFixed(2)}`).join(', ')

  const kpiData =
    `Gesamtumsatz: CHF ${totalRevenue.toFixed(2)}, ` +
    `Transaktionen: ${totalTransactions}, ` +
    `Ø Bonwert: CHF ${avgReceipt.toFixed(2)}, ` +
    `Jahre: ${years.join(', ')}, ` +
    `Top 5 Artikel: ${top5 || 'keine Daten'}`

  const { insights, recommendations, summary } = await generateAIInsights(kpiData, customerName)

  await supabase.from('ai_results').delete().eq('customer_id', customerId)

  const inserts = [
    ...insights.map((content: string) => ({ customer_id: customerId, type: 'insight' as const, content })),
    ...recommendations.map((content: string) => ({ customer_id: customerId, type: 'recommendation' as const, content })),
    { customer_id: customerId, type: 'summary' as const, content: summary },
  ]

  await supabase.from('ai_results').insert(inserts)
  console.info('[upload] Auto-KI-Analyse gespeichert:', inserts.length, 'Einträge')
}

async function insertRows(
  type: ReportType,
  rows: ParsedRow[],
  customerId: string,
  uploadId: string,
  year?: number,
  paymentGroups?: PaymentGroup[]
): Promise<number> {
  const BATCH = 100

  if (type === 'sales') {
    const prepared = rows.map((r) => ({
      customer_id: customerId,
      upload_id: uploadId,
      date: String(r.date ?? '').trim() || null,
      total_amount: Number(r.total_amount) || null,
      transaction_count: Number(r.transaction_count) || null,
      average_receipt: Number(r.average_receipt) || null,
      year: year || extractYear(r.date),
      month: extractMonth(r.date),
      weekday: extractWeekday(r.date),
    }))
    console.info('[upload] Sales-Zeilen vorbereitet:', prepared.length, '| Beispiel:', JSON.stringify(prepared[0]))
    for (let i = 0; i < prepared.length; i += BATCH) {
      const { data, error } = await supabase.from('sales').insert(prepared.slice(i, i + BATCH)).select('id')
      console.info('[upload] Sales insert batch', i / BATCH + 1, '→', error ? `FEHLER: ${error.message}` : `${data?.length} Zeilen eingefügt`)
      if (error) throw new Error(error.message || JSON.stringify(error))
    }
    return prepared.length
  } else if (type === 'products') {
    // Aggregate by name – each article appears once per Zahlungsart, sum them all
    const PAYMENT_NAMES = ['debitori', 'carte', 'contanti', 'bar ', 'karte', 'twint', 'reka']
    const agg = new Map<string, { name: string; total_revenue: number; total_quantity: number }>()
    for (const r of rows) {
      const name = String(r.name ?? '').trim()
      if (!name) continue
      // Skip rows whose Name cell contains a payment-type group header that slipped through
      if (PAYMENT_NAMES.some((p) => name.toLowerCase().startsWith(p))) continue
      const existing = agg.get(name) ?? { name, total_revenue: 0, total_quantity: 0 }
      existing.total_revenue += Number(r.total_amount) || 0
      existing.total_quantity += Number(r.total_quantity) || 0
      agg.set(name, existing)
    }
    const aggregated = Array.from(agg.values()).map((a) => ({
      customer_id: customerId,
      name: a.name,
      // Round to 2 decimals to eliminate floating-point accumulation errors
      total_revenue: Math.round(a.total_revenue * 100) / 100,
      total_quantity: Math.round(a.total_quantity * 100) / 100,
      year: year || null,
    }))
    console.info('[upload] Produkte aggregiert:', aggregated.length, '| Beispiel:', JSON.stringify(aggregated[0]))
    for (let i = 0; i < aggregated.length; i += BATCH) {
      const { data, error } = await supabase.from('products').insert(aggregated.slice(i, i + BATCH)).select('id')
      console.info('[upload] Products insert batch', i / BATCH + 1, '→', error ? `FEHLER: ${error.message}` : `${data?.length} Zeilen eingefügt`)
      if (error) throw new Error(`Produktdaten-Import fehlgeschlagen: ${error.message}`)
    }

    // Also save payment groups detected from "Umsatz nach Artikel und Abrechnungsart"
    if (paymentGroups && paymentGroups.length > 0) {
      const preparedPayments = paymentGroups.map((pg) => ({
        customer_id: customerId,
        payment_type: pg.payment_type,
        amount: pg.total || null,
        percentage: null,
        year: year || null,
      }))
      console.info('[upload] Zahlungsgruppen aus Artikel-Datei:', preparedPayments.length)
      const { error: payErr } = await supabase.from('payments').insert(preparedPayments)
      if (payErr) console.warn('[upload] Zahlungsgruppen-Insert fehlgeschlagen:', payErr.message)
    }

    return aggregated.length
  } else if (type === 'employees') {
    const prepared = rows.map((r) => ({
      customer_id: customerId,
      name: String(r.name ?? '').trim() || null,
      total_revenue: Number(r.total_amount) || null,
      transaction_count: Number(r.transaction_count) || null,
      year: year || null,
    }))
    console.info('[upload] Mitarbeiter vorbereitet:', prepared.length)
    for (let i = 0; i < prepared.length; i += BATCH) {
      const { data, error } = await supabase.from('employees').insert(prepared.slice(i, i + BATCH)).select('id')
      console.info('[upload] Employees insert batch', i / BATCH + 1, '→', error ? `FEHLER: ${error.message}` : `${data?.length} Zeilen eingefügt`)
      if (error) throw new Error(error.message || JSON.stringify(error))
    }
    return prepared.length
  } else if (type === 'payments') {
    const prepared = rows.map((r) => ({
      customer_id: customerId,
      payment_type: String(r.payment_type ?? '').trim() || null,
      amount: Number(r.total_amount) || Number(r.amount) || null,
      percentage: Number(r.percentage) || null,
      year: year || null,
    }))
    console.info('[upload] Zahlungsarten vorbereitet:', prepared.length)
    for (let i = 0; i < prepared.length; i += BATCH) {
      const { data, error } = await supabase.from('payments').insert(prepared.slice(i, i + BATCH)).select('id')
      console.info('[upload] Payments insert batch', i / BATCH + 1, '→', error ? `FEHLER: ${error.message}` : `${data?.length} Zeilen eingefügt`)
      if (error) throw new Error(error.message || JSON.stringify(error))
    }
    return prepared.length
  } else if (type === 'product_groups') {
    const prepared = rows.map((r) => ({
      customer_id: customerId,
      name: String(r.product_group ?? r.name ?? '').trim() || null,
      total_revenue: Number(r.total_amount) || null,
      year: year || null,
    }))
    console.info('[upload] Warengruppen vorbereitet:', prepared.length)
    for (let i = 0; i < prepared.length; i += BATCH) {
      const { data, error } = await supabase.from('product_groups').insert(prepared.slice(i, i + BATCH)).select('id')
      console.info('[upload] ProductGroups insert batch', i / BATCH + 1, '→', error ? `FEHLER: ${error.message}` : `${data?.length} Zeilen eingefügt`)
      if (error) throw new Error(error.message || JSON.stringify(error))
    }
    return prepared.length
  }

  return rows.length
}

// Parses DD.MM.YYYY, YYYY-MM-DD, DD/MM/YYYY and extracts year
function extractYear(date?: string | number | null): number | null {
  if (!date) return null
  const s = String(date)
  const m = s.match(/(\d{4})/)
  return m ? parseInt(m[1]) : null
}

// Parses DD.MM.YYYY and YYYY-MM-DD → returns 1-12
function extractMonth(date?: string | number | null): number | null {
  if (!date) return null
  const s = String(date).trim()
  // DD.MM.YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/)
  if (dmy) return parseInt(dmy[2])
  // YYYY-MM-DD or YYYY.MM.DD
  const ymd = s.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/)
  if (ymd) return parseInt(ymd[2])
  // Fallback: try JS Date (for ISO strings)
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.getMonth() + 1
}

// Returns 0=Sun, 1=Mon, ..., 6=Sat
function extractWeekday(date?: string | number | null): number | null {
  if (!date) return null
  const s = String(date).trim()
  // DD.MM.YYYY or DD/MM/YYYY → build ISO string YYYY-MM-DD for reliable parsing
  const dmy = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/)
  if (dmy) {
    const iso = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    const d = new Date(iso)
    return isNaN(d.getTime()) ? null : d.getDay()
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.getDay()
}
