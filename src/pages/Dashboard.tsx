import { useEffect, useState, lazy, Suspense } from 'react'
import { Euro, Receipt, TrendingUp, BarChart2, Brain, Lightbulb } from 'lucide-react'

const LazyMonthBarChart = lazy(() => import('../components/charts/MonthBarChart'))
const LazyTopProductsBar = lazy(() => import('../components/charts/TopProductsBar'))
const LazyPaymentDonut = lazy(() => import('../components/charts/PaymentDonut'))

const ChartSkeleton = () => (
  <div className="h-32 bg-gray-50 rounded animate-pulse" />
)
import { useCustomer } from '../hooks/useCustomer'
import { fetchDashboardKPIs, fetchSalesByMonth, fetchTopProducts, fetchProductGroups, fetchPayments, fetchSalesByWeekday, fetchAIResults } from '../lib/queries'
import { formatCurrency, formatNumber } from '../lib/exports'
import KPICard from '../components/ui/KPICard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

const NoDataPlaceholder = () => (
  <div className="h-32 bg-gray-50 rounded flex items-center justify-center text-gray-300 text-xs">
    Keine Daten vorhanden
  </div>
)

export default function Dashboard() {
  const { customer, loading: customerLoading } = useCustomer()
  const [kpis, setKpis] = useState<{
    totalRevenue: number
    totalTransactions: number
    avgYearRevenue: number
    avgReceipt: number
    years: number[]
  } | null>(null)
  const [monthData, setMonthData] = useState<{ month: string; umsatz: number }[]>([])
  const [weekdayData, setWeekdayData] = useState<{ tag: string; umsatz: number }[]>([])
  const [topProducts, setTopProducts] = useState<{ name: string | null; total_revenue: number | null }[]>([])
  const [productGroups, setProductGroups] = useState<{ name: string | null; total_revenue: number | null }[]>([])
  const [payments, setPayments] = useState<{ payment_type: string | null; amount: number | null; percentage: number | null }[]>([])
  const [aiInsights, setAiInsights] = useState<string[]>([])
  const [aiRecommendations, setAiRecommendations] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number | undefined>()

  useEffect(() => {
    if (!customer) return
    loadData()
  }, [customer, selectedYear])

  async function loadData() {
    if (!customer) return
    setLoading(true)
    setLoadError(false)
    try {
      const [kpiData, sales, products, groups, paymentsData, weekdays, aiData] = await Promise.all([
        fetchDashboardKPIs(customer.id, selectedYear),
        fetchSalesByMonth(customer.id, selectedYear),
        fetchTopProducts(customer.id, selectedYear, 5),
        fetchProductGroups(customer.id, selectedYear),
        fetchPayments(customer.id, selectedYear),
        fetchSalesByWeekday(customer.id),
        fetchAIResults(customer.id),
      ])

      setKpis(kpiData)

      const byMonth: Record<number, number> = {}
      sales.forEach((s) => {
        if (s.month) byMonth[s.month] = (byMonth[s.month] || 0) + (s.total_amount || 0)
      })
      setMonthData(MONTHS.map((m, i) => ({ month: m, umsatz: byMonth[i + 1] || 0 })))

      const byDay: Record<number, number> = {}
      weekdays.forEach((s) => {
        if (s.weekday !== null) byDay[s.weekday] = (byDay[s.weekday] || 0) + (s.total_amount || 0)
      })
      setWeekdayData(WEEKDAYS.map((d, i) => ({ tag: d, umsatz: byDay[i] || 0 })))

      setTopProducts(products)
      setProductGroups(groups)
      setPayments(paymentsData)

      const insights = aiData.filter((a) => a.type === 'insight').map((a) => a.content || '')
      const recs = aiData.filter((a) => a.type === 'recommendation').map((a) => a.content || '')
      setAiInsights(insights.slice(0, 5))
      setAiRecommendations(recs.slice(0, 4))
    } catch {
      // Handle the failure locally on the Dashboard route instead of emitting a
      // global console.error — the dashboard hook only runs while this page is
      // mounted, so errors should not surface from other routes.
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  if (customerLoading) return <LoadingSpinner />

  const hasSalesData = kpis && kpis.totalRevenue > 0
  const hasData = hasSalesData || topProducts.length > 0 || payments.length > 0 || productGroups.length > 0
  const maxDay = Math.max(...weekdayData.map((d) => d.umsatz), 1)
  const maxGroup = Math.max(...productGroups.map((g) => g.total_revenue || 0), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {customer?.name}{hasSalesData && kpis!.years.length ? ` · ${Math.min(...kpis!.years)}–${Math.max(...kpis!.years)}` : ''}
        </p>
        {kpis?.years.length ? (
          <select
            value={selectedYear || ''}
            onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : undefined)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Jahre</option>
            {[...kpis.years].sort((a, b) => b - a).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        ) : null}
      </div>

      {loading ? <LoadingSpinner /> : loadError ? (
        <EmptyState message="Daten konnten nicht geladen werden. Bitte versuchen Sie es später erneut." />
      ) : !hasData ? (
        <EmptyState message="Noch keine Verkaufsdaten vorhanden. Laden Sie Ihre Kassendaten hoch." />
      ) : (
        <>
          {hasSalesData && (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <KPICard title="Gesamtumsatz" value={formatCurrency(kpis!.totalRevenue)} icon={<Euro size={18} />} />
              <KPICard title="Ø Jahresumsatz" value={formatCurrency(kpis!.avgYearRevenue)} icon={<TrendingUp size={18} />} />
              <KPICard title="Transaktionen" value={formatNumber(kpis!.totalTransactions)} icon={<BarChart2 size={18} />} />
              <KPICard title="Ø Bonwert" value={formatCurrency(kpis!.avgReceipt)} icon={<Receipt size={18} />} />
            </div>
          )}

          {hasSalesData && <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Umsatz nach Monat</h3>
              {monthData.some((d) => d.umsatz > 0) ? (
                <Suspense fallback={<ChartSkeleton />}>
                  <LazyMonthBarChart data={monthData} />
                </Suspense>
              ) : (
                <NoDataPlaceholder />
              )}
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Umsatz nach Wochentag</h3>
              {weekdayData.some((d) => d.umsatz > 0) ? (
                <div className="flex items-end gap-2 h-32">
                  {weekdayData.map((d) => (
                    <div key={d.tag} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-blue-400 rounded-t"
                        style={{ height: `${Math.round((d.umsatz / maxDay) * 100)}%`, minHeight: d.umsatz > 0 ? '2px' : '0' }}
                      />
                      <span className="text-xs text-gray-400">{d.tag}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <NoDataPlaceholder />
              )}
            </div>
          </div>}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 5 Artikel</h3>
              {topProducts.length === 0 ? (
                <p className="text-xs text-gray-400">Keine Artikeldaten vorhanden.</p>
              ) : (
                <Suspense fallback={<ChartSkeleton />}>
                  <LazyTopProductsBar data={topProducts} />
                </Suspense>
              )}
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Warengruppen</h3>
              {productGroups.length === 0 ? (
                <p className="text-xs text-gray-400">Keine Warengruppendaten vorhanden.</p>
              ) : (
                <div className="space-y-2">
                  {productGroups.slice(0, 6).map((g, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" style={{ opacity: 1 - i * 0.12 }} />
                      <span className="text-xs text-gray-600 truncate flex-1">{g.name || '—'}</span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {Math.round(((g.total_revenue || 0) / maxGroup) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Zahlungsarten</h3>
              {payments.length === 0 ? (
                <p className="text-xs text-gray-400">Keine Zahlungsdaten vorhanden.</p>
              ) : (
                <Suspense fallback={<ChartSkeleton />}>
                  <LazyPaymentDonut data={payments} />
                </Suspense>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Brain size={16} className="text-purple-600" />
                <h3 className="text-sm font-semibold text-gray-700">KI-Erkenntnisse</h3>
              </div>
              {aiInsights.length === 0 ? (
                <p className="text-xs text-gray-400">Laden Sie Daten hoch, um KI-Erkenntnisse zu erhalten.</p>
              ) : (
                <ul className="space-y-2">
                  {aiInsights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                      {insight}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb size={16} className="text-yellow-500" />
                <h3 className="text-sm font-semibold text-gray-700">KI-Empfehlungen</h3>
              </div>
              {aiRecommendations.length === 0 ? (
                <p className="text-xs text-gray-400">Noch keine Empfehlungen verfügbar.</p>
              ) : (
                <ul className="space-y-2">
                  {aiRecommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
