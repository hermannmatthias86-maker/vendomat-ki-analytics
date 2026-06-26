import { useEffect, useState } from 'react'
import { useCustomer } from '../hooks/useCustomer'
import { fetchSalesByMonth, fetchSalesByWeekday } from '../lib/queries'
import { formatCurrency } from '../lib/exports'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

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
  const maxDay = Math.max(...weekdayData.map((d) => d.umsatz), 1)
  const maxMonth = Math.max(...monthData.map((d) => d.umsatz), 1)

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
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Umsatz nach Monat</h3>
        <div className="flex items-end gap-1 h-32">
          {monthData.map((d) => (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-blue-500 rounded-t"
                style={{ height: `${Math.round((d.umsatz / maxMonth) * 100)}%`, minHeight: d.umsatz > 0 ? '2px' : '0' }}
              />
              <span className="text-gray-400" style={{ fontSize: '9px' }}>{d.month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
