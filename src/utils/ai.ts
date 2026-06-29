import { getSettings, defaultModel, type AIProvider } from './settings'

export interface AIMessage { role: 'user' | 'assistant'; content: string }

export class AIError extends Error {
  constructor(message: string) { super(message); this.name = 'AIError' }
}

export async function askAI(messages: AIMessage[], system?: string): Promise<string> {
  const s = getSettings()
  if (s.provider !== 'ollama' && !s.apiKey) {
    throw new AIError('No API key configured. Open Settings to add one.')
  }
  const model = s.model || defaultModel(s.provider)
  switch (s.provider) {
    case 'claude': return callClaude(messages, system, s.apiKey, model)
    case 'openai': return callOpenAI(messages, system, s.apiKey, model)
    case 'ollama': return callOllama(messages, system, s.ollamaUrl, model)
  }
}

async function callClaude(messages: AIMessage[], system: string | undefined, apiKey: string, model: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: 4096, system, messages }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText)
    throw new AIError(`Claude API error ${res.status}: ${txt}`)
  }
  const data = await res.json()
  return data.content[0].text as string
}

async function callOpenAI(messages: AIMessage[], system: string | undefined, apiKey: string, model: string): Promise<string> {
  const all = system ? [{ role: 'system' as const, content: system }, ...messages] : messages
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: all }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText)
    throw new AIError(`OpenAI API error ${res.status}: ${txt}`)
  }
  const data = await res.json()
  return data.choices[0].message.content as string
}

async function callOllama(messages: AIMessage[], system: string | undefined, ollamaUrl: string, model: string): Promise<string> {
  const base = ollamaUrl || 'http://localhost:11434'
  const all = system ? [{ role: 'system' as const, content: system }, ...messages] : messages
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: all, stream: false }),
  })
  if (!res.ok) {
    throw new AIError(`Ollama error ${res.status}. Is Ollama running at ${base}?`)
  }
  const data = await res.json()
  return data.message.content as string
}

export function hasAIConfigured(): boolean {
  const s = getSettings()
  return s.provider === 'ollama' || !!s.apiKey
}

export function truncateForContext(text: string, maxChars = 80000): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + `\n\n[Document truncated — ${Math.round(text.length / 1000)}k chars total, showing first ${Math.round(maxChars / 1000)}k]`
}
