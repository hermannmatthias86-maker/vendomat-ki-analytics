import { useEffect, useState } from 'react'
import { useCustomer } from '../hooks/useCustomer'
import { fetchProductGroups } from '../lib/queries'
import { formatCurrency } from '../lib/exports'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const BAR_COLORS = ['bg-blue-500', 'bg-blue-400', 'bg-indigo-400', 'bg-blue-300', 'bg-indigo-300', 'bg-blue-200', 'bg-gray-300', 'bg-gray-200']

export default function WarengruppenPage() {
  const { customer } = useCustomer()
  const [groups, setGroups] = useState<{ name: string | null; total_revenue: number | null; year: number | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!customer) return
    fetchProductGroups(customer.id)
      .then((data) => setGroups(data))
      .catch((err) => { console.error(err); setError(true) })
      .finally(() => setLoading(false))
  }, [customer])

  if (loading) return <LoadingSpinner />
  if (error) return <EmptyState message="Fehler beim Laden der Warengruppen." />
  if (!groups.length) return <EmptyState message="Noch keine Warengruppen-Daten vorhanden." />

  const total = groups.reduce((s, g) => s + (g.total_revenue || 0), 0) || 1

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Verteilung</h3>
          <div className="space-y-3">
            {groups.slice(0, 8).map((g, i) => {
              const pct = ((g.total_revenue || 0) / total) * 100
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 truncate">{g.name || '—'}</span>
                    <span className="text-gray-500 ml-2">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`${BAR_COLORS[i] || 'bg-gray-300'} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Warengruppen</h3>
          <div className="space-y-3">
            {groups.map((g, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-gray-700 truncate">{g.name || '—'}</span>
                    <span className="text-xs text-gray-500 ml-2">{formatCurrency(g.total_revenue || 0)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${((g.total_revenue || 0) / total) * 100}%` }} />
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-10 text-right">
                  {(((g.total_revenue || 0) / total) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
