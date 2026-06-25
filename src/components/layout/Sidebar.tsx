import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, Package, Grid3x3, Users, CreditCard,
  Clock, Brain, MessageSquare, FileText, Database, Settings, LogOut,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useCustomer } from '../../hooks/useCustomer'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/umsaetze', icon: TrendingUp, label: 'Umsätze' },
  { to: '/artikel', icon: Package, label: 'Artikel' },
  { to: '/warengruppen', icon: Grid3x3, label: 'Warengruppen' },
  { to: '/mitarbeiter', icon: Users, label: 'Mitarbeiter' },
  { to: '/zahlungsarten', icon: CreditCard, label: 'Zahlungsarten' },
  { to: '/zeitanalyse', icon: Clock, label: 'Zeitanalyse' },
  { to: '/ki-analyse', icon: Brain, label: 'KI-Erkenntnisse' },
  { to: '/ki-chat', icon: MessageSquare, label: 'KI-Chat' },
  { to: '/berichte', icon: FileText, label: 'Berichte & Exporte' },
  { to: '/upload', icon: Database, label: 'Datenverwaltung' },
  { to: '/einstellungen', icon: Settings, label: 'Einstellungen' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { customer } = useCustomer()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <aside className="w-64 min-h-screen bg-dark-900 flex flex-col fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="text-white font-bold text-sm leading-tight">
          <span className="text-blue-400">vendomat</span>
          <br />
          <span className="text-xs font-semibold tracking-widest text-gray-300">KI ANALYTICS</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}`
            }
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {(customer?.name || user?.email || 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate">{customer?.name || 'Benutzer'}</p>
            <p className="text-gray-400 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-red-400 text-xs rounded-lg hover:bg-white/5 transition-colors"
        >
          <LogOut size={14} />
          Abmelden
        </button>
      </div>
    </aside>
  )
}
