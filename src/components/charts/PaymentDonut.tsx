import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Props {
  data: { payment_type: string | null; amount: number | null }[]
}

const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']

const fmt = (v: number) => `CHF ${v.toFixed(2)}`

export default function PaymentDonut({ data }: Props) {
  const chartData = data
    .filter((d) => (d.amount ?? 0) > 0)
    .map((d) => ({ name: d.payment_type || '—', value: d.amount ?? 0 }))

  if (chartData.length === 0) {
    return <div className="h-48 flex items-center justify-center text-xs text-gray-400">Keine Daten</div>
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={65}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => [fmt(Number(v)), 'Betrag']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
