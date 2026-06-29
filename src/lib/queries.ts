import { supabase } from './supabase'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function fetchDashboardKPIs(customerId: string, year?: number) {
  let query = supabase
    .from('sales')
    .select('total_amount, transaction_count, average_receipt, year, month')
    .eq('customer_id', customerId)

  if (year) query = query.eq('year', year) as typeof query

  const { data, error } = await query
  if (error) throw error

  const rows = (data as any[]) || []
  const totalRevenue = rows.reduce((s: number, r: any) => s + (r.total_amount || 0), 0)
  const totalTransactions = rows.reduce((s: number, r: any) => s + (r.transaction_count || 0), 0)
  const years = [...new Set(rows.map((r: any) => r.year).filter(Boolean))] as number[]
  const avgYearRevenue = years.length ? totalRevenue / years.length : 0
  const avgReceipt = totalTransactions ? totalRevenue / totalTransactions : 0

  return { totalRevenue, totalTransactions, avgYearRevenue, avgReceipt, years }
}

export async function fetchSalesByYear(customerId: string) {
  const { data, error } = await supabase
    .from('sales')
    .select('total_amount, year, month')
    .eq('customer_id', customerId)
    .order('year', { ascending: true })
  if (error) throw error
  return (data as any[]) || []
}

export async function fetchSalesByMonth(customerId: string, year?: number) {
  let query = supabase
    .from('sales')
    .select('total_amount, transaction_count, month, year')
    .eq('customer_id', customerId)
  if (year) query = query.eq('year', year) as typeof query
  const { data, error } = await query
  if (error) throw error
  return (data as any[]) || []
}

export async function fetchSalesByWeekday(customerId: string) {
  const { data, error } = await supabase
    .from('sales')
    .select('total_amount, weekday')
    .eq('customer_id', customerId)
  if (error) throw error
  return (data as any[]) || []
}

export async function fetchTopProducts(customerId: string, year?: number, limit = 5) {
  // Diagnostic: count ALL products for this customer_id (ignoring revenue filter)
  // to distinguish "no data inserted" from "data exists but filter too strict"
  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customerId)
  console.info('[queries] products Gesamtanzahl für customer_id', customerId, '→', count ?? 'NULL (RLS blockiert oder keine Daten)')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from('products')
    .select('name, total_revenue, total_quantity, year')
    .eq('customer_id', customerId)
    .not('name', 'is', null)
    .gt('total_revenue', 0)
    .order('total_revenue', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (year) q = q.eq('year', year)
  const { data, error } = await q
  if (error) throw error
  return (data as any[]) || []
}

export async function fetchProductGroups(customerId: string, year?: number) {
  let query = supabase
    .from('product_groups')
    .select('name, total_revenue, year')
    .eq('customer_id', customerId)
    .order('total_revenue', { ascending: false })
  if (year) query = query.eq('year', year) as typeof query
  const { data, error } = await query
  if (error) throw error
  return (data as any[]) || []
}

export async function fetchPayments(customerId: string, year?: number) {
  let query = supabase
    .from('payments')
    .select('payment_type, amount, percentage, year')
    .eq('customer_id', customerId)
  if (year) query = query.eq('year', year) as typeof query
  const { data, error } = await query
  if (error) throw error
  return (data as any[]) || []
}

export async function fetchEmployees(customerId: string, year?: number) {
  let query = supabase
    .from('employees')
    .select('name, total_revenue, transaction_count, year')
    .eq('customer_id', customerId)
    .order('total_revenue', { ascending: false })
  if (year) query = query.eq('year', year) as typeof query
  const { data, error } = await query
  if (error) throw error
  return (data as any[]) || []
}

export async function fetchAIResults(customerId: string) {
  const { data, error } = await supabase
    .from('ai_results')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as any[]) || []
}

export async function fetchChatHistory(customerId: string) {
  const { data, error } = await supabase
    .from('chat_history')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) throw error
  return (data as any[]) || []
}

export async function saveChatMessage(customerId: string, userId: string, role: 'user' | 'assistant', content: string) {
  const { error } = await supabase.from('chat_history').insert({
    customer_id: customerId,
    user_id: userId,
    role,
    content,
  })
  if (error) throw error
}

export async function fetchUploads(customerId: string) {
  const { data, error } = await supabase
    .from('uploads')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as any[]) || []
}

export async function fetchCustomerProfile(customerId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()
  if (error) throw error
  return data as any
}
