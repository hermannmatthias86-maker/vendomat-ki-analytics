import { useEffect, useState, Suspense, lazy } from 'react'
import { useCustomer } from '../hooks/useCustomer'
import { fetchSalesByMonth, fetchSalesByWeekday } from '../lib/queries'
import { formatCurrency } from '../lib/exports'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const WeekdayBarChart = lazy(() => import('../components/charts/WeekdayBarChart'))
const MonthBarChart = lazy(() => import('../components/charts/MonthBarChart'))

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export default function ZeitanalysePage() {
  const { customer } = useCustomer()
  const [weekdayData, setWeekdayData] = useState<{ tag: string; umsatz: number }[]>([])
  const [monthData, setMonthData] = useState<{ month: string; umsatz: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!customer) return
    load()
  }, [customer])

  async function load() {
    if (!customer) return
    try {
      const [weekdays, months] = await Promise.all([
        fetchSalesByWeekday(customer.id),
        fetchSalesByMonth(customer.id),
      ])

      const byDay: Record<number, number> = {}
      weekdays.forEach((s) => { if (s.weekday !== null) byDay[s.weekday] = (byDay[s.weekday] || 0) + (s.total_amount || 0) })
      setWeekdayData(['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'].map((d, i) => ({ tag: d, umsatz: byDay[i] || 0 })))

      const byMonth: Record<number, number> = {}
      months.forEach((s) => { if (s.month) byMonth[s.month] = (byMonth[s.month] || 0) + (s.total_amount || 0) })
      setMonthData(MONTHS.map((m, i) => ({ month: m, umsatz: byMonth[i + 1] || 0 })))
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSpinner />
  if (error) return <EmptyState message="Fehler beim Laden der Zeitdaten." />
  if (weekdayData.every((d) => d.umsatz === 0)) return <EmptyState message="Noch keine Zeitdaten vorhanden." />

  const bestDay = [...weekdayData].sort((a, b) => b.umsatz - a.umsatz)[0]
  const bestMonth = [...monthData].sort((a, b) => b.umsatz - a.umsatz)[0]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Stärkster Wochentag</p>
          <p className="text-2xl font-bold text-gray-900">{bestDay?.tag || '—'}</p>
          <p className="text-xs text-gray-400">{bestDay ? formatCurrency(bestDay.umsatz) : ''}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Stärkster Monat</p>
          <p className="text-2xl font-bold text-gray-900">{bestMonth?.month || '—'}</p>
          <p className="text-xs text-gray-400">{bestMonth ? formatCurrency(bestMonth.umsatz) : ''}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Umsatz nach Wochentag</h3>
        <Suspense fallback={<LoadingSpinner />}>
          <WeekdayBarChart data={weekdayData} />
        </Suspense>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Umsatz nach Monat</h3>
        <Suspense fallback={<LoadingSpinner />}>
          <MonthBarChart data={monthData} />
        </Suspense>
      </div>
    </div>
  )
}
