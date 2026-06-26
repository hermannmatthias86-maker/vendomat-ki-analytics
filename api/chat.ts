export const config = { runtime: 'edge' }

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface RequestBody {
  messages: ChatMessage[]
  systemContext: string
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { messages, systemContext }: RequestBody = await req.json()
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API-Schlüssel nicht konfiguriert.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemContext }, ...messages],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  })

  if (!response.ok) {
    const err = await response.json() as { error?: { message?: string } }
    return new Response(
      JSON.stringify({ error: err.error?.message || 'OpenAI Fehler' }),
      { status: response.status, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const data = await response.json() as { choices: [{ message: { content: string } }] }
  return new Response(
    JSON.stringify({ content: data.choices[0].message.content }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}
