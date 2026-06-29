export type AIProvider = 'claude' | 'openai' | 'ollama'

export interface AppSettings {
  provider: AIProvider
  apiKey: string
  model: string
  ollamaUrl: string
}

const KEY = 'pdf-studio-settings'

const DEFAULTS: AppSettings = {
  provider: 'claude',
  apiKey: '',
  model: '',
  ollamaUrl: 'http://localhost:11434',
}

export function getSettings(): AppSettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } }
  catch { return { ...DEFAULTS } }
}

export function saveSettings(patch: Partial<AppSettings>): void {
  localStorage.setItem(KEY, JSON.stringify({ ...getSettings(), ...patch }))
}

export function defaultModel(provider: AIProvider): string {
  if (provider === 'claude') return 'claude-haiku-4-5-20251001'
  if (provider === 'openai') return 'gpt-4o-mini'
  return 'llama3.2'
}
