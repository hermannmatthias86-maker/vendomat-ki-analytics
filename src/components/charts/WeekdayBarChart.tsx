import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../../lib/exports'

interface Props {
  data: { tag: string; umsatz: number }[]
}

export default function WeekdayBarChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="tag" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
        <Bar dataKey="umsatz" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Umsatz" />
      </BarChart>
    </ResponsiveContainer>
  )
}
