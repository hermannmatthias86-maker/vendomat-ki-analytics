import { useEffect, useState } from 'react'
import { useCustomer } from '../hooks/useCustomer'
import { fetchTopProducts } from '../lib/queries'
import { formatCurrency, formatNumber } from '../lib/exports'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

export default function ArtikelPage() {
  const { customer } = useCustomer()
  const [products, setProducts] = useState<{ name: string | null; total_revenue: number | null; total_quantity: number | null; year: number | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!customer) return
    fetchTopProducts(customer.id, undefined, 50)
      .then((data) => setProducts(data))
      .catch((err) => { console.error(err); setError(true) })
      .finally(() => setLoading(false))
  }, [customer])

  if (loading) return <LoadingSpinner />
  if (error) return <EmptyState message="Fehler beim Laden der Artikeldaten." />
  if (!products.length) return <EmptyState message="Noch keine Artikeldaten vorhanden." />

  const maxRevenue = Math.max(...products.map((p) => p.total_revenue || 0))

  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Artikel nach Umsatz</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="pb-2 w-8">#</th>
              <th className="pb-2">Artikel</th>
              <th className="pb-2 text-right">Umsatz</th>
              <th className="pb-2 text-right">Menge</th>
              <th className="pb-2">Anteil</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 text-gray-400 text-xs">{i + 1}</td>
                <td className="py-2 font-medium text-gray-800">{p.name || '—'}</td>
                <td className="py-2 text-right">{formatCurrency(p.total_revenue || 0)}</td>
                <td className="py-2 text-right text-gray-500">{formatNumber(p.total_quantity || 0)}</td>
                <td className="py-2 w-32">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${((p.total_revenue || 0) / maxRevenue) * 100}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right">
                      {((p.total_revenue || 0) / maxRevenue * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
