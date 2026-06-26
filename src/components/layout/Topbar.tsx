import { useLocation } from 'react-router-dom'
import { Bell, Menu } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/umsaetze': 'Umsätze',
  '/artikel': 'Artikel',
  '/warengruppen': 'Warengruppen',
  '/mitarbeiter': 'Mitarbeiter',
  '/zahlungsarten': 'Zahlungsarten',
  '/zeitanalyse': 'Zeitanalyse',
  '/ki-analyse': 'KI-Erkenntnisse',
  '/ki-chat': 'KI-Chat',
  '/berichte': 'Berichte & Exporte',
  '/upload': 'Datenverwaltung',
  '/einstellungen': 'Einstellungen',
  '/admin': 'Administration',
}

interface TopbarProps {
  onMenuToggle: () => void
}

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] || 'vendomat KI Analytics'

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          aria-label="Menü öffnen"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
          <Bell size={18} />
        </button>
        <div className="hidden sm:block text-xs text-gray-400">
          {new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
    </header>
  )
}
