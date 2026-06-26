export const config = { runtime: 'edge' }

interface RequestBody {
  kpiData: string
  customerName: string
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { kpiData, customerName }: RequestBody = await req.json()
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API-Schlüssel nicht konfiguriert.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const prompt = `Analysiere folgende Kassendaten für ${customerName} und erstelle:
1. 5 konkrete Erkenntnisse (insights)
2. 4 handlungsorientierte Empfehlungen
3. Eine Zusammenfassung in 2 Sätzen

Daten: ${kpiData}

Antworte ausschließlich als JSON mit den Feldern: insights (Array), recommendations (Array), summary (String).`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: 'KI-Analyse fehlgeschlagen' }),
      { status: response.status, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const data = await response.json() as { choices: [{ message: { content: string } }] }
  const result = JSON.parse(data.choices[0].message.content) as {
    insights: string[]
    recommendations: string[]
    summary: string
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
}
