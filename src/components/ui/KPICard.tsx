import { TrendingUp, TrendingDown } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string
  trend?: number
  icon?: React.ReactNode
  subtitle?: string
}

export default function KPICard({ title, value, trend, icon, subtitle }: KPICardProps) {
  const trendPositive = trend !== undefined && trend >= 0

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0 ml-3">
            {icon}
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${trendPositive ? 'text-green-600' : 'text-red-500'}`}>
          {trendPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{trendPositive ? '+' : ''}{trend.toFixed(1)}% ggü. Vorjahr</span>
        </div>
      )}
    </div>
  )
}
