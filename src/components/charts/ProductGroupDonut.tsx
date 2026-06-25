import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../../lib/exports'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16']

interface Props {
  data: { name: string | null; total_revenue: number | null }[]
}

export default function ProductGroupDonut({ data }: Props) {
  const filtered = data.filter((d) => d.total_revenue && d.total_revenue > 0)
  if (!filtered.length) return <p className="text-xs text-gray-400 text-center py-8">Keine Daten</p>

  const chartData = filtered.map((d) => ({ name: d.name || '—', value: d.total_revenue || 0 }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value">
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
