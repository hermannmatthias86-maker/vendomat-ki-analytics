import { useState } from 'react'
import { User, Building2, Shield, Key } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useCustomer } from '../hooks/useCustomer'
import { supabase } from '../lib/supabase'

type Tab = 'user' | 'firma' | 'datenschutz' | 'api'

export default function EinstellungenPage() {
  const { user } = useAuth()
  const { customer } = useCustomer()
  const [tab, setTab] = useState<Tab>('user')
  const [name, setName] = useState(user?.user_metadata?.name || '')
  const [password, setPassword] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await supabase.auth.updateUser({ data: { name } })
      if (password) await supabase.auth.updateUser({ password })
      setSuccess('Profil erfolgreich aktualisiert.')
      setPassword('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler')
    } finally {
      setLoading(false)
    }
  }

  const TABS = [
    { id: 'user' as Tab, label: 'Benutzer', icon: User },
    { id: 'firma' as Tab, label: 'Firma', icon: Building2 },
    { id: 'datenschutz' as Tab, label: 'Datenschutz', icon: Shield },
    { id: 'api' as Tab, label: 'API', icon: Key },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Einstellungen</h2>
        <p className="text-sm text-gray-500">Verwalten Sie Ihr Konto und Ihre Präferenzen.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium flex-1 transition-colors ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* User Tab */}
      {tab === 'user' && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Profil bearbeiten</h3>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg">{success}</div>}
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-Mail</label>
              <input type="email" value={user?.email || ''} disabled className="input-field bg-gray-50 text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Neues Passwort (leer lassen = unverändert)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="••••••••" minLength={6} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Speichern…' : 'Speichern'}</button>
          </form>
        </div>
      )}

      {tab === 'firma' && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Firmendaten</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Firmenname</label>
              <input type="text" value={customer?.name || ''} disabled className="input-field bg-gray-50 text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kontakt-E-Mail</label>
              <input type="email" value={customer?.contact_email || ''} disabled className="input-field bg-gray-50 text-gray-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4">Firmendaten können nur vom vendomat Support geändert werden.</p>
        </div>
      )}

      {tab === 'datenschutz' && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Datenschutzeinstellungen</h3>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">DSGVO-konform</p>
            <p>Alle Daten werden verschlüsselt gespeichert. Jeder Kunde hat ausschließlich Zugriff auf seine eigenen Daten (Row Level Security).</p>
          </div>
          <p className="text-xs text-gray-500">Ihre Daten werden auf EU-Servern gespeichert. Wir teilen Ihre Daten nicht mit Dritten.</p>
        </div>
      )}

      {tab === 'api' && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">API-Konfiguration</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Supabase URL</label>
              <input type="text" value={import.meta.env.VITE_SUPABASE_URL || 'Nicht konfiguriert'} disabled className="input-field bg-gray-50 text-gray-400 font-mono text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Supabase ANON Key</label>
              <input type="text" value={import.meta.env.VITE_SUPABASE_ANON_KEY ? '••••••••••••••••' : 'Nicht konfiguriert'} disabled className="input-field bg-gray-50 text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">OpenAI API (Produktion: server-seitig)</label>
              <input type="text" value={import.meta.env.VITE_OPENAI_API_KEY ? '••••••••••••••••  (lokal)' : 'Server-seitig via /api/chat'} disabled className="input-field bg-gray-50 text-gray-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400">In der Produktion wird der OpenAI-Key server-seitig über Vercel-Umgebungsvariablen verwaltet (nicht im Browser sichtbar).</p>
        </div>
      )}
    </div>
  )
}
