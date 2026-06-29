import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff, CheckCircle2, XCircle, Loader2, Bot, Cpu, Cloud } from 'lucide-react'
import { getSettings, saveSettings, defaultModel, type AIProvider } from '../utils/settings'
import { askAI, AIError } from '../utils/ai'

export default function Settings() {
  const navigate = useNavigate()
  const [s, setS] = useState(getSettings())
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testState, setTestState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')
  const [testMsg, setTestMsg] = useState('')

  function patch(p: Partial<typeof s>) {
    setS(prev => ({ ...prev, ...p }))
    setSaved(false)
    setTestState('idle')
  }

  function handleSave() {
    saveSettings(s)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTest() {
    saveSettings(s)
    setTestState('loading')
    setTestMsg('')
    try {
      const reply = await askAI([{ role: 'user', content: 'Reply with just the word "OK".' }])
      setTestState('ok')
      setTestMsg(`Connected! Model replied: "${reply.trim().slice(0, 60)}"`)
    } catch (e) {
      setTestState('fail')
      setTestMsg(e instanceof AIError ? e.message : String(e))
    }
  }

  const providers: { id: AIProvider; label: string; icon: React.ReactNode; hint: string }[] = [
    { id: 'claude', label: 'Anthropic Claude', icon: <Bot size={16} />, hint: 'api.anthropic.com — best quality' },
    { id: 'openai', label: 'OpenAI', icon: <Cloud size={16} />, hint: 'api.openai.com — GPT-4o / GPT-4o-mini' },
    { id: 'ollama', label: 'Ollama (Local)', icon: <Cpu size={16} />, hint: 'Runs on your machine — fully private, no key needed' },
  ]

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
          <ArrowLeft size={14} /> Back
        </motion.button>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Configure AI provider and API keys</p>
        </div>
      </div>

      {/* AI Provider */}
      <Section title="AI Provider">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {providers.map(p => (
            <motion.button key={p.id} whileHover={{ scale: 1.01 }} onClick={() => patch({ provider: p.id, model: '' })}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                border: `1px solid ${s.provider === p.id ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'}`,
                background: s.provider === p.id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
              }}>
              <span style={{ color: s.provider === p.id ? '#a5b4fc' : 'var(--text-muted)' }}>{p.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: s.provider === p.id ? '#a5b4fc' : 'var(--text-primary)' }}>{p.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.hint}</div>
              </div>
              {s.provider === p.id && <CheckCircle2 size={16} color="#6366f1" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
            </motion.button>
          ))}
        </div>
      </Section>

      {/* API Key */}
      {s.provider !== 'ollama' && (
        <Section title="API Key">
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={s.apiKey}
                onChange={e => patch({ apiKey: e.target.value })}
                placeholder={s.provider === 'claude' ? 'sk-ant-api03-…' : 'sk-…'}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'monospace' }}
              />
              <button onClick={() => setShowKey(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            {s.provider === 'claude'
              ? 'Get your key at console.anthropic.com — stored locally in app data only.'
              : 'Get your key at platform.openai.com — stored locally in app data only.'}
          </p>
        </Section>
      )}

      {/* Ollama URL */}
      {s.provider === 'ollama' && (
        <Section title="Ollama Server URL">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)' }}>
            <input
              value={s.ollamaUrl}
              onChange={e => patch({ ollamaUrl: e.target.value })}
              placeholder="http://localhost:11434"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'monospace' }}
            />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Default is http://localhost:11434. Make sure Ollama is running before testing.</p>
        </Section>
      )}

      {/* Model */}
      <Section title="Model (optional)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)' }}>
          <input
            value={s.model}
            onChange={e => patch({ model: e.target.value })}
            placeholder={`Default: ${defaultModel(s.provider)}`}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'monospace' }}
          />
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
          {s.provider === 'claude' && 'e.g. claude-sonnet-4-6, claude-haiku-4-5-20251001'}
          {s.provider === 'openai' && 'e.g. gpt-4o, gpt-4o-mini, gpt-4-turbo'}
          {s.provider === 'ollama' && 'e.g. llama3.2, mistral, codellama — must be pulled in Ollama first'}
        </p>
      </Section>

      {/* Test + Save */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleTest} disabled={testState === 'loading'}
          style={{ padding: '9px 20px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7 }}>
          {testState === 'loading' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          Test Connection
        </motion.button>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleSave}
          style={{ padding: '9px 20px', borderRadius: 9, border: '1px solid rgba(99,102,241,0.5)', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {saved ? 'Saved!' : 'Save Settings'}
        </motion.button>
        {testState === 'ok' && <span style={{ fontSize: 12, color: '#34d399', display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={14} />{testMsg}</span>}
        {testState === 'fail' && <span style={{ fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'center', gap: 5, maxWidth: 360 }}><XCircle size={14} />{testMsg}</span>}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass" style={{ borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{title}</div>
      {children}
    </div>
  )
}
