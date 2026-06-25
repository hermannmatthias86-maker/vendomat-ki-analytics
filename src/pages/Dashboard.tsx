import { useEffect, useState, Suspense, lazy } from 'react'
import { Euro, Receipt, TrendingUp, BarChart2, Brain, Lightbulb } from 'lucide-react'
import { useCustomer } from '../hooks/useCustomer'
import { fetchDashboardKPIs, fetchSalesByMonth, fetchTopProducts, fetchProductGroups, fetchPayments, fetchSalesByWeekday, fetchAIResults } from '../lib/queries'
import { formatCurrency, formatNumber } from '../lib/exports'
import KPICard from '../components/ui/KPICard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const MonthBarChart = lazy(() => import('../components/charts/MonthBarChart'))
const WeekdayBarChart = lazy(() => import('../components/charts/WeekdayBarChart'))
const ProductGroupDonut = lazy(() => import('../components/charts/ProductGroupDonut'))
const PaymentDonut = lazy(() => import('../components/charts/PaymentDonut'))

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

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
  const [selectedYear, setSelectedYear] = useState<number | undefined>()

  useEffect(() => {
    if (!customer) return
    loadData()
  }, [customer, selectedYear])

  async function loadData() {
    if (!customer) return
    setLoading(true)
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

      // Aggregate by month
      const byMonth: Record<number, number> = {}
      sales.forEach((s) => {
        if (s.month) byMonth[s.month] = (byMonth[s.month] || 0) + (s.total_amount || 0)
      })
      setMonthData(MONTHS.map((m, i) => ({ month: m, umsatz: byMonth[i + 1] || 0 })))

      // Weekday aggregation
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
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (customerLoading) return <LoadingSpinner />

  const hasData = kpis && kpis.totalRevenue > 0

  return (
    <div className="space-y-6">
      {/* Year filter */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {customer?.name} · {hasData && kpis?.years.length ? `${Math.min(...kpis.years)}–${Math.max(...kpis.years)}` : 'Keine Daten'}
        </p>
        {kpis?.years.length ? (
          <select
            value={selectedYear || ''}
            onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : undefined)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Jahre</option>
            {kpis.years.sort((a, b) => b - a).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        ) : null}
      </div>

      {loading ? <LoadingSpinner /> : !hasData ? <EmptyState message="Noch keine Verkaufsdaten vorhanden. Laden Sie Ihre Kassendaten hoch." /> : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard
              title="Gesamtumsatz"
              value={formatCurrency(kpis.totalRevenue)}
              icon={<Euro size={18} />}
            />
            <KPICard
              title="Ø Jahresumsatz"
              value={formatCurrency(kpis.avgYearRevenue)}
              icon={<TrendingUp size={18} />}
            />
            <KPICard
              title="Transaktionen"
              value={formatNumber(kpis.totalTransactions)}
              icon={<BarChart2 size={18} />}
            />
            <KPICard
              title="Ø Bonwert"
              value={formatCurrency(kpis.avgReceipt)}
              icon={<Receipt size={18} />}
            />
          </div>

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Umsatz nach Monat (Durchschnitt)</h3>
              <Suspense fallback={<LoadingSpinner />}>
                <MonthBarChart data={monthData} />
              </Suspense>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Umsatz nach Wochentag</h3>
              <Suspense fallback={<LoadingSpinner />}>
                <WeekdayBarChart data={weekdayData} />
              </Suspense>
            </div>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Top Artikel */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 5 Artikel</h3>
              {topProducts.length === 0 ? (
                <p className="text-xs text-gray-400">Keine Artikeldaten vorhanden.</p>
              ) : (
                <ol className="space-y-2">
                  {topProducts.map((p, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{p.name || '—'}</p>
                        <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
                          <div
                            className="bg-blue-500 h-1 rounded-full"
                            style={{ width: `${((p.total_revenue || 0) / (topProducts[0]?.total_revenue || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                        {formatCurrency(p.total_revenue || 0)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Warengruppen Donut */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Warengruppen</h3>
              <Suspense fallback={<LoadingSpinner />}>
                <ProductGroupDonut data={productGroups} />
              </Suspense>
            </div>

            {/* Zahlungsarten Donut */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Zahlungsarten</h3>
              <Suspense fallback={<LoadingSpinner />}>
                <PaymentDonut data={payments} />
              </Suspense>
            </div>
          </div>

          {/* AI Section */}
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
