import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Upload, BarChart3, Brain, FileText, Eye, EyeOff } from 'lucide-react'
import { signIn, signUp, resetPassword } from '../lib/auth'
import { isSupabaseConfigured } from '../lib/supabase'

type Mode = 'login' | 'register' | 'forgot'

function translateSupabaseError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-Mail oder Passwort falsch.'
  if (msg.includes('Email not confirmed')) return 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.'
  if (msg.includes('User already registered')) return 'Diese E-Mail-Adresse ist bereits registriert.'
  if (msg.includes('Password should be at least')) return 'Das Passwort muss mindestens 6 Zeichen lang sein.'
  if (msg.includes('Invalid URL') || msg.includes('Invalid path') || msg.includes('Failed to fetch'))
    return 'Verbindung zu Supabase fehlgeschlagen. Bitte Umgebungsvariablen prüfen.'
  if (msg.includes('rate limit')) return 'Zu viele Versuche. Bitte warten Sie kurz.'
  return msg
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
        navigate('/dashboard')
      } else if (mode === 'register') {
        await signUp(email, password, name)
        setSuccess('Registrierung erfolgreich! Bitte prüfen Sie Ihre E-Mail.')
      } else {
        await resetPassword(email)
        setSuccess('Passwort-Reset-Link wurde gesendet.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten.'
      setError(translateSupabaseError(msg))
    } finally {
      setLoading(false)
    }
  }

  const FEATURES = [
    'Lightspeed G-Serie Kassendaten automatisch analysiert',
    'KI-gestützte Erkenntnisse und Empfehlungen',
    'Jahresvergleiche und Trendanalysen',
    'DSGVO-konforme Datenspeicherung',
    'PDF & Excel Export auf Knopfdruck',
  ]

  const HOW_IT_WORKS = [
    { icon: Upload, title: 'Daten hochladen', desc: 'CSV oder Excel aus der Lightspeed G-Serie' },
    { icon: Brain, title: 'KI analysiert', desc: 'Automatische Auswertung aller Kennzahlen' },
    { icon: BarChart3, title: 'Dashboard', desc: 'Übersichtliche Visualisierungen und KPIs' },
    { icon: FileText, title: 'Berichte', desc: 'PDF/Excel-Export auf Knopfdruck' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Main Hero */}
      <div className="flex flex-1">
        {/* Left – Dark */}
        <div className="hidden lg:flex flex-col justify-between w-1/2 bg-dark-900 p-12 relative overflow-hidden">
          {/* Logo */}
          <div>
            <div className="text-2xl font-bold text-white">
              <span className="text-blue-400">vendomat</span>
            </div>
            <div className="text-xs font-semibold tracking-widest text-gray-300 uppercase mt-0.5">
              KI Analytics
            </div>
          </div>

          {/* Hero */}
          <div className="z-10">
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Ihre G-Serie Daten.<br />
              <span className="text-blue-400">Unsere KI.</span><br />
              Ihr Erfolg.
            </h1>
            <p className="text-gray-300 text-lg mb-8">
              Verwandeln Sie Ihre Kassendaten in wertvolle Erkenntnisse.
            </p>
            <ul className="space-y-3">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-3 text-gray-200 text-sm">
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <Check size={11} />
                  </div>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Decorative mountain shape */}
          <div className="absolute bottom-0 left-0 right-0 h-32 opacity-10">
            <svg viewBox="0 0 400 120" className="w-full h-full" preserveAspectRatio="none">
              <polygon points="0,120 100,40 160,80 250,20 350,70 400,30 400,120" fill="#3b82f6" />
            </svg>
          </div>

          <div className="z-10 text-xs text-gray-500">
            © {new Date().getFullYear()} vendomat KI Analytics · DSGVO-konform
          </div>
        </div>

        {/* Right – Light */}
        <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
          <div className="w-full max-w-sm">
            <div className="lg:hidden mb-8 text-center">
              <span className="text-2xl font-bold text-blue-600">vendomat</span>
              <span className="text-xs block font-semibold tracking-widest text-gray-400 uppercase">KI Analytics</span>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {mode === 'login' ? 'Anmelden' : mode === 'register' ? 'Registrieren' : 'Passwort zurücksetzen'}
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                {mode === 'login' ? 'Melden Sie sich in Ihrem Konto an.' : mode === 'register' ? 'Erstellen Sie Ihr kostenloses Konto.' : 'Wir senden Ihnen einen Reset-Link.'}
              </p>

              {!isSupabaseConfigured && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg">
                  ⚠️ Supabase nicht konfiguriert. Bitte <code className="font-mono">VITE_SUPABASE_URL</code> und <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> in den Umgebungsvariablen setzen.
                </div>
              )}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
              )}
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg">{success}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-field"
                      placeholder="Max Mustermann"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">E-Mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="name@beispiel.de"
                    required
                  />
                </div>

                {mode !== 'forgot' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Passwort</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-field pr-10"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                  {loading ? 'Bitte warten…' : mode === 'login' ? 'Anmelden' : mode === 'register' ? 'Registrieren' : 'Link senden'}
                </button>
              </form>

              <div className="mt-4 space-y-2 text-center text-sm">
                {mode === 'login' && (
                  <>
                    <button onClick={() => setMode('forgot')} className="text-blue-600 hover:underline block w-full">
                      Passwort vergessen?
                    </button>
                    <button onClick={() => setMode('register')} className="text-gray-500 hover:text-gray-700">
                      Noch kein Konto? <span className="text-blue-600 font-medium">Jetzt registrieren</span>
                    </button>
                  </>
                )}
                {mode !== 'login' && (
                  <button onClick={() => setMode('login')} className="text-blue-600 hover:underline">
                    Zurück zur Anmeldung
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white py-14 px-8 border-t border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">So funktioniert es</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {HOW_IT_WORKS.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="text-center">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mx-auto mb-3">
                <Icon size={22} />
              </div>
              <div className="text-xs font-semibold text-blue-600 mb-0.5">Schritt {i + 1}</div>
              <div className="font-semibold text-gray-900 text-sm mb-1">{title}</div>
              <div className="text-gray-400 text-xs">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-dark-900 text-gray-400 text-xs py-4 px-8 flex flex-wrap justify-between items-center gap-2">
        <span>© 2024 vendomat KI Analytics</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>Alle Systeme betriebsbereit</span>
          <span>DSGVO-konform · TLS-verschlüsselt · Supabase RLS</span>
        </div>
      </footer>
    </div>
  )
}
