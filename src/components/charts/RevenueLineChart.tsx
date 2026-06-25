import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../../lib/exports'

interface Props {
  data: { year: number; umsatz: number }[]
}

export default function RevenueLineChart({ data }: Props) {
  if (!data.length) return <p className="text-xs text-gray-400 text-center py-8">Keine Daten</p>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => formatCurrency(Number(v))} labelFormatter={(l) => `Jahr ${l}`} />
        <Line type="monotone" dataKey="umsatz" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Umsatz" />
      </LineChart>
    </ResponsiveContainer>
  )
}
