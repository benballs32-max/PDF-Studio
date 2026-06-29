import { Routes, Route } from 'react-router-dom'
import TitleBar from './components/TitleBar'
import Home from './pages/Home'
import Editor from './pages/Editor'
import Converter from './pages/Converter'
import ImportPDF from './pages/ImportPDF'
import Batch from './pages/Batch'
import Compare from './pages/Compare'
import Settings from './pages/Settings'
import AIStudio from './pages/AIStudio'
import './styles/glass.css'

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(145deg, #060412 0%, #0d0820 50%, #080614 100%)' }}>
      {/* Ambient depth blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 900, height: 900, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.34) 0%, transparent 62%)', top: '-260px', left: '-220px', filter: 'blur(100px)' }} />
        <div style={{ position: 'absolute', width: 750, height: 750, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.28) 0%, transparent 62%)', bottom: '-160px', right: '-80px', filter: 'blur(100px)' }} />
        <div style={{ position: 'absolute', width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.20) 0%, transparent 65%)', top: '38%', right: '-100px', filter: 'blur(90px)' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.14) 0%, transparent 65%)', top: '16%', left: '40%', filter: 'blur(110px)' }} />
      </div>

      <TitleBar />

      <div style={{ flex: 1, position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/convert" element={<Converter />} />
          <Route path="/import" element={<ImportPDF />} />
          <Route path="/batch" element={<Batch />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/ai-studio" element={<AIStudio />} />
        </Routes>
      </div>
    </div>
  )
}
