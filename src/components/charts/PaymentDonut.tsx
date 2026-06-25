import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../../lib/exports'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

interface Props {
  data: { payment_type: string | null; amount: number | null; percentage: number | null }[]
}

export default function PaymentDonut({ data }: Props) {
  const filtered = data.filter((d) => d.amount && d.amount > 0)
  if (!filtered.length) return <p className="text-xs text-gray-400 text-center py-8">Keine Daten</p>

  const chartData = filtered.map((d) => ({ name: d.payment_type || '—', value: d.amount || 0 }))

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
