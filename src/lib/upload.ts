import { supabase } from './supabase'
import { parseFile, type ParsedFile } from './csvParser'
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
  const uploadId = (upload as any).id
  onProgress?.(20)

  try {
    const parsed = await parseFile(file)
    onProgress?.(50)

    console.info('[upload] Datei geparst:', {
      type: parsed.type,
      meta: parsed.meta,
      products: parsed.products.length,
      productGroups: parsed.productGroups.length,
      payments: parsed.payments.length,
      sales: parsed.sales.length,
      employees: parsed.employees.length,
    })

    if (parsed.type === 'unknown') {
      await supabase.from('uploads').update({ status: 'error' }).eq('id', uploadId)
      return { success: false, message: 'Unbekanntes Dateiformat — Dateiname muss Berichtstyp enthalten (z.B. Bestellungen_nach_Artikel_...)', rowsImported: 0 }
    }

    const rowsImported = await insertAll(parsed, customerId, uploadId)
    onProgress?.(90)

    console.info('[upload] Import abgeschlossen:', rowsImported, 'Datensätze')

    await supabase
      .from('uploads')
      .update({ status: 'done', report_type: parsed.type, year: parsed.meta.year || null })
      .eq('id', uploadId)

    // Auto AI analysis after any upload with product or sales data
    if (rowsImported > 0) {
      triggerAutoAIAnalysis(customerId).catch((err) =>
        console.warn('[upload] Auto-KI-Analyse fehlgeschlagen:', err)
      )
    }

    onProgress?.(100)
    return { success: true, message: `${rowsImported} Datensätze importiert`, rowsImported }
  } catch (err) {
    console.error('[upload] Fehler:', err)
    await supabase.from('uploads').update({ status: 'error' }).eq('id', uploadId)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Insert all parsed data into the appropriate tables
// ─────────────────────────────────────────────────────────────────────────────

async function insertAll(parsed: ParsedFile, customerId: string, uploadId: string): Promise<number> {
  const BATCH = 100
  let total = 0

  // ── Products ─────────────────────────────────────────────────────────────
  if (parsed.products.length > 0) {
    const rows = parsed.products.map(p => ({
      customer_id: customerId,
      name: p.name,
      plu: p.plu ?? null,
      price: p.price ?? null,
      total_revenue: p.total_revenue,
      total_quantity: p.total_quantity,
      netto: p.netto ?? null,
      mwst: p.mwst ?? null,
      product_group: p.product_group ?? null,
      year: p.year ?? null,
      month: p.month ?? null,
    }))
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase.from('products').insert(rows.slice(i, i + BATCH))
      if (error) throw new Error(`Produkte: ${error.message}`)
    }
    total += rows.length
    console.info('[upload] Produkte gespeichert:', rows.length)
  }

  // ── Product groups ────────────────────────────────────────────────────────
  if (parsed.productGroups.length > 0) {
    const rows = parsed.productGroups.map(g => ({
      customer_id: customerId,
      name: g.name,
      total_revenue: g.total_revenue,
      total_quantity: g.total_quantity ?? null,
      netto: g.netto ?? null,
      mwst: g.mwst ?? null,
      year: g.year ?? null,
      month: g.month ?? null,
    }))
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase.from('product_groups').insert(rows.slice(i, i + BATCH))
      if (error) throw new Error(`Warengruppen: ${error.message}`)
    }
    total += rows.length
    console.info('[upload] Warengruppen gespeichert:', rows.length)
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  if (parsed.payments.length > 0) {
    const rows = parsed.payments.map(p => ({
      customer_id: customerId,
      payment_type: p.payment_type,
      amount: p.amount,
      transaction_count: p.transaction_count ?? null,
      percentage: p.percentage ?? null,
      year: p.year ?? null,
      month: p.month ?? null,
    }))
    const { error } = await supabase.from('payments').insert(rows)
    if (error) throw new Error(`Zahlungsarten: ${error.message}`)
    total += rows.length
    console.info('[upload] Zahlungsarten gespeichert:', rows.length)
  }

  // ── Sales ─────────────────────────────────────────────────────────────────
  if (parsed.sales.length > 0) {
    const today = new Date().toISOString().slice(0, 10)
    const rows = parsed.sales.map(s => ({
      customer_id: customerId,
      upload_id: uploadId,
      date: s.date ?? today,
      total_amount: s.total_amount,
      transaction_count: s.transaction_count ?? null,
      date_from: s.date_from ?? null,
      date_to: s.date_to ?? null,
      year: s.year ?? null,
      month: s.month ?? null,
      weekday: null,
    }))
    const { error } = await supabase.from('sales').insert(rows)
    if (error) throw new Error(`Umsätze: ${error.message}`)
    total += rows.length
    console.info('[upload] Umsätze gespeichert: CHF', rows[0]?.total_amount, '| Jahr:', rows[0]?.year, '| Monat:', rows[0]?.month)
  }

  // ── Employees (stornos) ───────────────────────────────────────────────────
  if (parsed.employees.length > 0) {
    const rows = parsed.employees.map(e => ({
      customer_id: customerId,
      name: e.name,
      storno_count: e.storno_count ?? null,
      storno_amount: e.storno_amount ?? null,
      year: e.year ?? null,
      month: e.month ?? null,
    }))
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase.from('employees').insert(rows.slice(i, i + BATCH))
      if (error) throw new Error(`Mitarbeiter: ${error.message}`)
    }
    total += rows.length
    console.info('[upload] Mitarbeiter/Stornos gespeichert:', rows.length)
  }

  return total
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto AI analysis after upload
// ─────────────────────────────────────────────────────────────────────────────

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

  const sales      = (salesData as any[]) || []
  const products   = (productsData as any[]) || []
  const customerName = (customerData as any)?.name || 'Kunde'

  const totalRevenue     = sales.reduce((s: number, r: any) => s + (r.total_amount || 0), 0)
  const totalTransactions = sales.reduce((s: number, r: any) => s + (r.transaction_count || 0), 0)
  const avgReceipt       = totalTransactions ? totalRevenue / totalTransactions : 0
  const years            = [...new Set(sales.map((r: any) => r.year).filter(Boolean))]
  const top5             = products.map((p: any) => `${p.name}: CHF ${(p.total_revenue || 0).toFixed(2)}`).join(', ')

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
