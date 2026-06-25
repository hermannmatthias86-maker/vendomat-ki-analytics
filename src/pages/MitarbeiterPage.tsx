import { useEffect, useState } from 'react'
import { useCustomer } from '../hooks/useCustomer'
import { fetchEmployees } from '../lib/queries'
import { formatCurrency, formatNumber } from '../lib/exports'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

export default function MitarbeiterPage() {
  const { customer } = useCustomer()
  const [employees, setEmployees] = useState<{ name: string | null; total_revenue: number | null; transaction_count: number | null; year: number | null }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customer) return
    fetchEmployees(customer.id).then((data) => { setEmployees(data); setLoading(false) })
  }, [customer])

  if (loading) return <LoadingSpinner />
  if (!employees.length) return <EmptyState message="Noch keine Mitarbeiterdaten vorhanden." />

  return (
    <div className="card overflow-x-auto">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Mitarbeiter nach Umsatz</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
            <th className="pb-2 w-8">#</th>
            <th className="pb-2">Mitarbeiter</th>
            <th className="pb-2 text-right">Umsatz</th>
            <th className="pb-2 text-right">Transaktionen</th>
            <th className="pb-2 text-right">Ø Bon</th>
            <th className="pb-2 text-right">Jahr</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e, i) => {
            const avg = e.transaction_count && e.transaction_count > 0 ? (e.total_revenue || 0) / e.transaction_count : 0
            return (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 text-gray-400 text-xs">{i + 1}</td>
                <td className="py-2 font-medium">{e.name || '—'}</td>
                <td className="py-2 text-right">{formatCurrency(e.total_revenue || 0)}</td>
                <td className="py-2 text-right text-gray-500">{formatNumber(e.transaction_count || 0)}</td>
                <td className="py-2 text-right text-gray-500">{formatCurrency(avg)}</td>
                <td className="py-2 text-right text-gray-400">{e.year || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
