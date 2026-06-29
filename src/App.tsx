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
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 45%, #24243e 100%)' }}>
      {/* Ambient blobs for depth */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)', top: '-100px', left: '-100px', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%)', bottom: '-80px', right: '10%', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', top: '40%', right: '-60px', filter: 'blur(60px)' }} />
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
