import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

interface Props {
  data: { name: string | null; total_revenue: number | null }[]
}

const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']

const fmt = (v: number) =>
  v >= 1000 ? `CHF ${(v / 1000).toFixed(1)}k` : `CHF ${v.toFixed(0)}`

const truncate = (s: string | null, n = 16) =>
  s && s.length > n ? s.slice(0, n - 1) + '…' : (s ?? '—')

export default function TopProductsBar({ data }: Props) {
  const chartData = data
    .filter((d) => (d.total_revenue ?? 0) > 0)
    .map((d) => ({ name: truncate(d.name), fullName: d.name || '—', value: d.total_revenue ?? 0 }))

  if (chartData.length === 0) {
    return <div className="h-48 flex items-center justify-center text-xs text-gray-400">Keine Daten</div>
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} tickLine={false} width={90} />
        <Tooltip
          formatter={(v) => [fmt(Number(v)), 'Umsatz']}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
          contentStyle={{ fontSize: 11, borderRadius: 8 }}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
