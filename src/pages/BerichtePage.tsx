import { useState } from 'react'
import { Download, FileText, Table } from 'lucide-react'
import { useCustomer } from '../hooks/useCustomer'
import { fetchSalesByMonth, fetchTopProducts, fetchEmployees, fetchPayments, fetchProductGroups } from '../lib/queries'
import { exportToPDF, exportToExcel, formatCurrency } from '../lib/exports'

const REPORTS = [
  { id: 'sales', label: 'Umsatzbericht', description: 'Umsatz nach Monat und Jahr' },
  { id: 'products', label: 'Artikelbericht', description: 'Top-Artikel nach Umsatz und Menge' },
  { id: 'employees', label: 'Mitarbeiterbericht', description: 'Umsatz und Transaktionen je Mitarbeiter' },
  { id: 'payments', label: 'Zahlungsarten-Report', description: 'Aufschlüsselung der Zahlungsmethoden' },
  { id: 'groups', label: 'Warengruppen-Report', description: 'Umsatz nach Warengruppen' },
]

export default function BerichtePage() {
  const { customer } = useCustomer()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleExport(reportId: string, format: 'pdf' | 'excel') {
    if (!customer) return
    setLoading(`${reportId}-${format}`)
    try {
      let data: Record<string, unknown>[] = []
      let title = ''
      let columns: string[] = []

      if (reportId === 'sales') {
        const rows = await fetchSalesByMonth(customer.id)
        data = rows.map((r) => ({ Monat: r.month, Jahr: r.year, Umsatz: formatCurrency(r.total_amount || 0), Transaktionen: r.transaction_count }))
        title = 'Umsatzbericht'
        columns = ['Monat', 'Jahr', 'Umsatz', 'Transaktionen']
      } else if (reportId === 'products') {
        const rows = await fetchTopProducts(customer.id, undefined, 50)
        data = rows.map((r) => ({ Artikel: r.name, Umsatz: formatCurrency(r.total_revenue || 0), Menge: r.total_quantity, Jahr: r.year }))
        title = 'Artikelbericht'
        columns = ['Artikel', 'Umsatz', 'Menge', 'Jahr']
      } else if (reportId === 'employees') {
        const rows = await fetchEmployees(customer.id)
        data = rows.map((r) => ({ Mitarbeiter: r.name, Umsatz: formatCurrency(r.total_revenue || 0), Transaktionen: r.transaction_count, Jahr: r.year }))
        title = 'Mitarbeiterbericht'
        columns = ['Mitarbeiter', 'Umsatz', 'Transaktionen', 'Jahr']
      } else if (reportId === 'payments') {
        const rows = await fetchPayments(customer.id)
        data = rows.map((r) => ({ Zahlungsart: r.payment_type, Betrag: formatCurrency(r.amount || 0), Anteil: `${r.percentage || 0}%`, Jahr: r.year }))
        title = 'Zahlungsarten-Report'
        columns = ['Zahlungsart', 'Betrag', 'Anteil', 'Jahr']
      } else if (reportId === 'groups') {
        const rows = await fetchProductGroups(customer.id)
        data = rows.map((r) => ({ Warengruppe: r.name, Umsatz: formatCurrency(r.total_revenue || 0), Jahr: r.year }))
        title = 'Warengruppen-Report'
        columns = ['Warengruppe', 'Umsatz', 'Jahr']
      }

      if (format === 'pdf') exportToPDF(title, data, columns)
      else exportToExcel(title, data)
    } catch (err) {
      console.error(err)
      alert('Export fehlgeschlagen.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Berichte & Exporte</h2>
        <p className="text-sm text-gray-500">Exportieren Sie Ihre Daten als PDF oder Excel-Datei.</p>
      </div>

      {REPORTS.map((report) => (
        <div key={report.id} className="card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
              <FileText size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{report.label}</p>
              <p className="text-xs text-gray-400">{report.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport(report.id, 'pdf')}
              disabled={loading === `${report.id}-pdf`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Download size={12} />
              PDF
            </button>
            <button
              onClick={() => handleExport(report.id, 'excel')}
              disabled={loading === `${report.id}-excel`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              <Table size={12} />
              Excel
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
