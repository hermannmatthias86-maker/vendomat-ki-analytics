import { supabase } from './supabase'
import { parseFile, type ParsedRow, type ReportType } from './csvParser'

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

  if (uploadError) throw uploadError
  const uploadRecord = upload as any
  onProgress?.(20)

  try {
    const { type, rows, year } = await parseFile(file)
    onProgress?.(50)

    if (type === 'unknown') {
      await supabase.from('uploads').update({ status: 'error' }).eq('id', uploadRecord.id)
      return { success: false, message: 'Unbekanntes Dateiformat', rowsImported: 0 }
    }

    const rowsImported = await insertRows(type, rows, customerId, uploadRecord.id, year)
    onProgress?.(90)

    await supabase
      .from('uploads')
      .update({ status: 'done', report_type: type, year: year || null })
      .eq('id', uploadRecord.id)

    onProgress?.(100)
    return { success: true, message: `${rowsImported} Datensätze importiert`, rowsImported }
  } catch (err) {
    await supabase.from('uploads').update({ status: 'error' }).eq('id', uploadRecord.id)
    throw err
  }
}

async function insertRows(
  type: ReportType,
  rows: ParsedRow[],
  customerId: string,
  uploadId: string,
  year?: number
): Promise<number> {
  const BATCH = 100

  if (type === 'sales') {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH).map((r) => ({
        customer_id: customerId,
        upload_id: uploadId,
        date: r.date as string || null,
        total_amount: r.total_amount as number || null,
        transaction_count: r.transaction_count as number || null,
        average_receipt: r.average_receipt as number || null,
        year: year || extractYear(r.date as string),
        month: extractMonth(r.date as string),
        weekday: extractWeekday(r.date as string),
      }))
      const { error } = await supabase.from('sales').insert(batch)
      if (error) throw new Error(error.message || JSON.stringify(error))
    }
  } else if (type === 'products') {
    // Aggregate by name – the same article can appear multiple times
    // (e.g. once per Zahlungsart in "Umsatz nach Artikel und Abrechnungsart")
    const agg = new Map<string, { name: string; total_revenue: number; total_quantity: number }>()
    for (const r of rows) {
      const name = ((r.name as string | null) ?? '').trim()
      if (!name) continue
      const existing = agg.get(name) ?? { name, total_revenue: 0, total_quantity: 0 }
      existing.total_revenue += (r.total_amount as number) || 0
      existing.total_quantity += (r.total_quantity as number) || 0
      agg.set(name, existing)
    }
    const aggregated = Array.from(agg.values()).map((a) => ({
      customer_id: customerId,
      name: a.name,
      total_revenue: a.total_revenue || null,
      total_quantity: a.total_quantity || null,
      year: year || null,
    }))
    for (let i = 0; i < aggregated.length; i += BATCH) {
      const { error } = await supabase.from('products').insert(aggregated.slice(i, i + BATCH))
      if (error) throw new Error(`Produktdaten-Import fehlgeschlagen: ${error.message}`)
    }
    return aggregated.length
  } else if (type === 'employees') {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH).map((r) => ({
        customer_id: customerId,
        name: r.name as string || null,
        total_revenue: r.total_amount as number || null,
        transaction_count: r.transaction_count as number || null,
        year: year || null,
      }))
      const { error } = await supabase.from('employees').insert(batch)
      if (error) throw new Error(error.message || JSON.stringify(error))
    }
  } else if (type === 'payments') {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH).map((r) => ({
        customer_id: customerId,
        payment_type: r.payment_type as string || null,
        amount: (r.total_amount as number) || (r.amount as number) || null,
        percentage: r.percentage as number || null,
        year: year || null,
      }))
      const { error } = await supabase.from('payments').insert(batch)
      if (error) throw new Error(error.message || JSON.stringify(error))
    }
  } else if (type === 'product_groups') {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH).map((r) => ({
        customer_id: customerId,
        name: (r.product_group as string) || (r.name as string) || null,
        total_revenue: r.total_amount as number || null,
        year: year || null,
      }))
      const { error } = await supabase.from('product_groups').insert(batch)
      if (error) throw new Error(error.message || JSON.stringify(error))
    }
  }

  return rows.length
}

function extractYear(date?: string): number | null {
  if (!date) return null
  const m = date.match(/(\d{4})/)
  return m ? parseInt(m[1]) : null
}

function extractMonth(date?: string): number | null {
  if (!date) return null
  const d = new Date(date)
  return isNaN(d.getTime()) ? null : d.getMonth() + 1
}

function extractWeekday(date?: string): number | null {
  if (!date) return null
  const d = new Date(date)
  return isNaN(d.getTime()) ? null : d.getDay()
}
