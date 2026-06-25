const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function chatWithAI(messages: ChatMessage[], context: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    return 'OpenAI API-Schlüssel nicht konfiguriert. Bitte fügen Sie VITE_OPENAI_API_KEY in Ihrer .env-Datei hinzu.'
  }

  const systemMessage: ChatMessage = {
    role: 'system',
    content: `Du bist ein Datenanalyst für ${context}. Du analysierst ausschließlich die hochgeladenen historischen Kassendaten aus der Lightspeed G-Serie. Antworte nur auf Basis der vorhandenen Daten. Keine Halluzinationen. Keine erfundenen Zahlen. Jede Aussage muss auf den tatsächlichen Daten basieren. Antworte auf Deutsch. Sei präzise und konkret.`,
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [systemMessage, ...messages],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error?.message || 'OpenAI Fehler')
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export async function generateAIInsights(kpiData: string, customerName: string): Promise<{
  insights: string[]
  recommendations: string[]
  summary: string
}> {
  if (!OPENAI_API_KEY) {
    return {
      insights: ['KI-Analyse nicht verfügbar (API-Schlüssel fehlt).'],
      recommendations: ['Bitte VITE_OPENAI_API_KEY in .env konfigurieren.'],
      summary: 'Keine KI-Analyse verfügbar.',
    }
  }

  const prompt = `Analysiere folgende Kassendaten für ${customerName} und erstelle:
1. 5 konkrete Erkenntnisse (insights)
2. 4 handlungsorientierte Empfehlungen
3. Eine Zusammenfassung in 2 Sätzen

Daten: ${kpiData}

Antworte ausschließlich als JSON mit den Feldern: insights (Array), recommendations (Array), summary (String).`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  })

  if (!response.ok) throw new Error('KI-Analyse fehlgeschlagen')
  const data = await response.json()
  return JSON.parse(data.choices[0].message.content)
}
