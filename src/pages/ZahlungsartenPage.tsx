import { useEffect, useState, Suspense, lazy } from 'react'
import { useCustomer } from '../hooks/useCustomer'
import { fetchPayments } from '../lib/queries'
import { formatCurrency } from '../lib/exports'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

const PaymentDonut = lazy(() => import('../components/charts/PaymentDonut'))

export default function ZahlungsartenPage() {
  const { customer } = useCustomer()
  const [payments, setPayments] = useState<{ payment_type: string | null; amount: number | null; percentage: number | null; year: number | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!customer) return
    fetchPayments(customer.id)
      .then((data) => setPayments(data))
      .catch((err) => { console.error(err); setError(true) })
      .finally(() => setLoading(false))
  }, [customer])

  if (loading) return <LoadingSpinner />
  if (error) return <EmptyState message="Fehler beim Laden der Zahlungsartendaten." />
  if (!payments.length) return <EmptyState message="Noch keine Zahlungsartendaten vorhanden." />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Zahlungsarten Verteilung</h3>
        <Suspense fallback={<LoadingSpinner />}>
          <PaymentDonut data={payments} />
        </Suspense>
      </div>
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Übersicht</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="pb-2">Zahlungsart</th>
              <th className="pb-2 text-right">Betrag</th>
              <th className="pb-2 text-right">Anteil</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-2 font-medium">{p.payment_type || '—'}</td>
                <td className="py-2 text-right">{formatCurrency(p.amount || 0)}</td>
                <td className="py-2 text-right text-gray-400">{(p.percentage || 0).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
