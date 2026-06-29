import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Props {
  data: { month: string; umsatz: number }[]
}

const fmt = (v: number) =>
  v >= 1000 ? `CHF ${(v / 1000).toFixed(1)}k` : `CHF ${v.toFixed(0)}`

export default function MonthBarChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={128}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={32} />
        <Tooltip formatter={(v) => [fmt(Number(v)), 'Umsatz']} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Bar dataKey="umsatz" fill="#3b82f6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
