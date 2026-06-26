import { useEffect, useState } from 'react'
import { useCustomer } from '../hooks/useCustomer'
import { fetchSalesByYear, fetchSalesByMonth } from '../lib/queries'
import { formatCurrency } from '../lib/exports'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export default function UmsaetzePage() {
  const { customer } = useCustomer()
  const [yearData, setYearData] = useState<{ year: number; umsatz: number }[]>([])
  const [monthData, setMonthData] = useState<{ month: string; umsatz: number; transaktionen: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!customer) return
    load()
  }, [customer])

  async function load() {
    if (!customer) return
    setLoading(true)
    try {
      const [byYear, byMonth] = await Promise.all([
        fetchSalesByYear(customer.id),
        fetchSalesByMonth(customer.id),
      ])

      const yearMap: Record<number, number> = {}
      byYear.forEach((r) => { if (r.year) yearMap[r.year] = (yearMap[r.year] || 0) + (r.total_amount || 0) })
      setYearData(Object.entries(yearMap).map(([y, u]) => ({ year: Number(y), umsatz: u })).sort((a, b) => a.year - b.year))

      const monthMap: Record<number, { umsatz: number; t: number }> = {}
      byMonth.forEach((r) => {
        if (r.month) {
          if (!monthMap[r.month]) monthMap[r.month] = { umsatz: 0, t: 0 }
          monthMap[r.month].umsatz += r.total_amount || 0
          monthMap[r.month].t += r.transaction_count || 0
        }
      })
      setMonthData(MONTHS.map((m, i) => ({ month: m, umsatz: monthMap[i + 1]?.umsatz || 0, transaktionen: monthMap[i + 1]?.t || 0 })))
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSpinner />
  if (error) return <EmptyState message="Fehler beim Laden der Umsatzdaten." />
  if (!yearData.length) return <EmptyState />

  const totalRevenue = yearData.reduce((s, d) => s + d.umsatz, 0)
  const bestMonth = [...monthData].sort((a, b) => b.umsatz - a.umsatz)[0]
  const worstMonth = [...monthData].filter((m) => m.umsatz > 0).sort((a, b) => a.umsatz - b.umsatz)[0]
  const maxYear = Math.max(...yearData.map((d) => d.umsatz), 1)
  const maxMonth = Math.max(...monthData.map((d) => d.umsatz), 1)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Gesamtumsatz</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Stärkster Monat</p>
          <p className="text-2xl font-bold text-green-600">{bestMonth?.month || '—'}</p>
          <p className="text-xs text-gray-400">{bestMonth ? formatCurrency(bestMonth.umsatz) : ''}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Schwächster Monat</p>
          <p className="text-2xl font-bold text-red-500">{worstMonth?.month || '—'}</p>
          <p className="text-xs text-gray-400">{worstMonth ? formatCurrency(worstMonth.umsatz) : ''}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Umsatzentwicklung nach Jahr</h3>
        <div className="flex items-end gap-4 h-40">
          {yearData.map((d) => (
            <div key={d.year} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs text-gray-600 font-medium">{formatCurrency(d.umsatz)}</span>
              <div
                className="w-full bg-blue-500 rounded-t"
                style={{ height: `${Math.round((d.umsatz / maxYear) * 100)}%`, minHeight: '4px' }}
              />
              <span className="text-xs text-gray-500">{d.year}</span>
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

      <div className="card overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Jahresübersicht</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="pb-2">Jahr</th>
              <th className="pb-2 text-right">Umsatz</th>
              <th className="pb-2 text-right">Anteil</th>
            </tr>
          </thead>
          <tbody>
            {yearData.map((r) => (
              <tr key={r.year} className="border-b border-gray-50">
                <td className="py-2 font-medium">{r.year}</td>
                <td className="py-2 text-right">{formatCurrency(r.umsatz)}</td>
                <td className="py-2 text-right text-gray-400">{((r.umsatz / totalRevenue) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
