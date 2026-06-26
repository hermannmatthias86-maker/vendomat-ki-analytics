import { useEffect, useState } from 'react'
import { Brain, RefreshCw, Lightbulb, TrendingUp, AlertCircle } from 'lucide-react'
import { useCustomer } from '../hooks/useCustomer'
import { fetchDashboardKPIs, fetchAIResults } from '../lib/queries'
import { generateAIInsights } from '../lib/openai'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/exports'
import LoadingSpinner from '../components/ui/LoadingSpinner'

interface AIResult {
  type: string
  content: string | null
}

export default function KIAnalysePage() {
  const { customer } = useCustomer()
  const [results, setResults] = useState<AIResult[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [kpiSummary, setKpiSummary] = useState('')
  const [analysisError, setAnalysisError] = useState('')

  useEffect(() => {
    if (!customer) return
    loadResults()
    buildKpiSummary()
  }, [customer])

  async function loadResults() {
    if (!customer) return
    setLoading(true)
    const data = await fetchAIResults(customer.id)
    setResults(data as AIResult[])
    setLoading(false)
  }

  async function buildKpiSummary() {
    if (!customer) return
    try {
      const kpis = await fetchDashboardKPIs(customer.id)
      setKpiSummary(
        `Gesamtumsatz: ${formatCurrency(kpis.totalRevenue)}, ` +
        `Transaktionen: ${kpis.totalTransactions}, ` +
        `Ø Bonwert: ${formatCurrency(kpis.avgReceipt)}, ` +
        `Jahre: ${kpis.years.join(', ')}`
      )
    } catch (err) {
      console.warn('[KIAnalysePage] KPI-Zusammenfassung nicht verfügbar:', err)
    }
  }

  async function runAIAnalysis() {
    if (!customer || !kpiSummary) return
    setGenerating(true)
    try {
      const { insights, recommendations, summary } = await generateAIInsights(kpiSummary, customer.name)

      // Delete old results and insert new
      await supabase.from('ai_results').delete().eq('customer_id', customer.id)

      const inserts = [
        ...insights.map((content: string) => ({ customer_id: customer.id, type: 'insight' as const, content })),
        ...recommendations.map((content: string) => ({ customer_id: customer.id, type: 'recommendation' as const, content })),
        { customer_id: customer.id, type: 'summary' as const, content: summary },
      ]

      await supabase.from('ai_results').insert(inserts)
      await loadResults()
    } catch (err: unknown) {
      console.error(err)
      setAnalysisError(err instanceof Error ? err.message : 'KI-Analyse fehlgeschlagen')
    } finally {
      setGenerating(false)
    }
  }

  const insights = results.filter((r) => r.type === 'insight')
  const recommendations = results.filter((r) => r.type === 'recommendation')
  const summaryResult = results.find((r) => r.type === 'summary')

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">KI-Erkenntnisse</h2>
          <p className="text-sm text-gray-500">Automatische Analyse Ihrer Kassendaten durch GPT-4o.</p>
        </div>
        <button
          onClick={runAIAnalysis}
          disabled={generating || !kpiSummary}
          className="btn-primary flex items-center gap-2 text-sm whitespace-nowrap"
        >
          <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
          {generating ? 'Analysiere…' : 'Neu analysieren'}
        </button>
      </div>

      {analysisError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{analysisError}</div>
      )}

      {loading ? <LoadingSpinner /> : (
        <>
          {summaryResult && (
            <div className="card bg-blue-50 border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={16} className="text-blue-600" />
                <h3 className="text-sm font-semibold text-blue-800">Zusammenfassung</h3>
              </div>
              <p className="text-sm text-blue-700">{summaryResult.content}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-purple-600" />
                <h3 className="text-sm font-semibold text-gray-700">Erkenntnisse</h3>
              </div>
              {insights.length === 0 ? (
                <p className="text-xs text-gray-400">Klicken Sie auf "Neu analysieren" um KI-Erkenntnisse zu generieren.</p>
              ) : (
                <ul className="space-y-3">
                  {insights.map((ins, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                      <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {ins.content}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb size={16} className="text-yellow-500" />
                <h3 className="text-sm font-semibold text-gray-700">Empfehlungen</h3>
              </div>
              {recommendations.length === 0 ? (
                <p className="text-xs text-gray-400">Noch keine Empfehlungen verfügbar.</p>
              ) : (
                <ul className="space-y-3">
                  {recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                      <AlertCircle size={16} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                      {rec.content}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
