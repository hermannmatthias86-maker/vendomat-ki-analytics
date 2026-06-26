interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// In production (Vercel), VITE_OPENAI_API_KEY is not set and all calls go through
// /api/chat and /api/analyze (server-side, key never exposed to browser).
// In local development, set VITE_OPENAI_API_KEY in .env to call OpenAI directly.
const DEV_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined

export async function chatWithAI(messages: ChatMessage[], context: string): Promise<string> {
  const systemContext = `Du bist ein Datenanalyst für ${context}. Du analysierst ausschließlich die hochgeladenen historischen Kassendaten aus der Lightspeed G-Serie. Antworte nur auf Basis der vorhandenen Daten. Keine Halluzinationen. Keine erfundenen Zahlen. Jede Aussage muss auf den tatsächlichen Daten basieren. Antworte auf Deutsch. Sei präzise und konkret.`

  if (DEV_KEY) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEV_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: systemContext }, ...messages],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    })
    if (!response.ok) {
      const err = await response.json() as { error?: { message?: string } }
      throw new Error(err.error?.message || 'OpenAI Fehler')
    }
    const data = await response.json() as { choices: [{ message: { content: string } }] }
    return data.choices[0].message.content
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemContext }),
  })
  if (!response.ok) {
    const err = await response.json() as { error?: string }
    throw new Error(err.error || 'OpenAI Fehler')
  }
  const data = await response.json() as { content: string }
  return data.content
}

export async function generateAIInsights(kpiData: string, customerName: string): Promise<{
  insights: string[]
  recommendations: string[]
  summary: string
}> {
  if (DEV_KEY) {
    const prompt = `Analysiere folgende Kassendaten für ${customerName} und erstelle:
1. 5 konkrete Erkenntnisse (insights)
2. 4 handlungsorientierte Empfehlungen
3. Eine Zusammenfassung in 2 Sätzen

Daten: ${kpiData}

Antworte ausschließlich als JSON mit den Feldern: insights (Array), recommendations (Array), summary (String).`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEV_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    })
    if (!response.ok) throw new Error('KI-Analyse fehlgeschlagen')
    const data = await response.json() as { choices: [{ message: { content: string } }] }
    return JSON.parse(data.choices[0].message.content) as {
      insights: string[]
      recommendations: string[]
      summary: string
    }
  }

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kpiData, customerName }),
  })
  if (!response.ok) throw new Error('KI-Analyse fehlgeschlagen')
  return await response.json() as {
    insights: string[]
    recommendations: string[]
    summary: string
  }
}
