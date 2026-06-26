import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader } from 'lucide-react'
import { chatWithAI } from '../lib/openai'
import { fetchChatHistory, saveChatMessage, fetchDashboardKPIs } from '../lib/queries'
import { useCustomer } from '../hooks/useCustomer'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency } from '../lib/exports'

interface Message {
  role: 'user' | 'assistant'
  content: string
  id?: string
}

const QUICK_PROMPTS = [
  'Wie war mein umsatzstärkster Monat?',
  'Welche Artikel verkaufen sich am besten?',
  'Gibt es saisonale Muster in meinen Daten?',
  'Wie entwickelt sich mein Durchschnittsbonwert?',
]

export default function KIChatPage() {
  const { customer } = useCustomer()
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [kpiContext, setKpiContext] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!customer) return
    loadChat()
    buildContext()
  }, [customer])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadChat() {
    if (!customer) return
    const history = await fetchChatHistory(customer.id)
    setMessages(history.map((h) => ({ role: h.role, content: h.content || '', id: h.id })))
  }

  async function buildContext() {
    if (!customer) return
    try {
      const kpis = await fetchDashboardKPIs(customer.id)
      setKpiContext(
        `Kunde: ${customer.name}. ` +
        `Gesamtumsatz: ${formatCurrency(kpis.totalRevenue)}. ` +
        `Transaktionen gesamt: ${kpis.totalTransactions}. ` +
        `Durchschnittlicher Bonwert: ${formatCurrency(kpis.avgReceipt)}. ` +
        `Jahre im System: ${kpis.years.join(', ')}.`
      )
    } catch (err) {
      console.warn('[KIChatPage] KPI-Kontext nicht verfügbar:', err)
    }
  }

  async function sendMessage(text?: string) {
    const content = text || input.trim()
    if (!content || loading || !customer || !user) return
    setInput('')

    const userMsg: Message = { role: 'user', content }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      await saveChatMessage(customer.id, user.id, 'user', content)

      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
      history.push({ role: 'user', content })

      const systemContext = kpiContext
        ? `${customer.name} Daten-Kontext: ${kpiContext}`
        : customer.name

      const reply = await chatWithAI(history, systemContext)
      const assistantMsg: Message = { role: 'assistant', content: reply }
      setMessages((prev) => [...prev, assistantMsg])
      await saveChatMessage(customer.id, user.id, 'assistant', reply)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Fehler'
      setMessages((prev) => [...prev, { role: 'assistant', content: `Fehler: ${errMsg}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl">
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Bot size={28} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">KI-Datenanalyst</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
              Stellen Sie Fragen zu Ihren Kassendaten. Der Assistent antwortet ausschließlich auf Basis Ihrer hochgeladenen Daten.
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="text-xs text-left px-3 py-2.5 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 text-gray-600 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id || i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'assistant' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>
              {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
            </div>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-white border border-gray-100 text-gray-700 rounded-tl-sm shadow-sm'
            }`}>
              {msg.content.split('\n').map((line, j) => (
                <span key={j}>{line}{j < msg.content.split('\n').length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot size={16} className="text-blue-600" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <Loader size={16} className="text-gray-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex gap-2 items-end shadow-sm">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Frage zu Ihren Daten stellen…"
          rows={1}
          className="flex-1 resize-none text-sm outline-none text-gray-700 placeholder-gray-400 max-h-28 overflow-y-auto"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 rounded-lg flex items-center justify-center text-white transition-colors flex-shrink-0"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
