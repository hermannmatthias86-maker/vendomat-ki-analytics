import { Database } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function EmptyState({ message = 'Noch keine Daten vorhanden.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Database size={24} className="text-gray-400" />
      </div>
      <p className="text-gray-500 text-sm mb-4">{message}</p>
      <Link to="/upload" className="btn-primary text-sm">
        Daten hochladen
      </Link>
    </div>
  )
}
