import { useState, useRef, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import TerminalPanel from './TerminalPanel'
import './App.css'

// ─────────────────────────────────────────────────────────────────────────────
// TEAMMATE INTEGRATION POINT
// Your backend should expose:
//   POST /api/save-prompt   { markdown: string } → writes temp-prompt.md
//   GET  /api/prompt        → returns the current temp-prompt.md content
//
// Set SAVE_ENDPOINT to your server URL, e.g. 'http://localhost:3001/api/save-prompt'
// When undefined the app still works — it just won't persist the file to disk.
// ─────────────────────────────────────────────────────────────────────────────
const SAVE_ENDPOINT = undefined // e.g. 'http://localhost:3001/api/save-prompt'

// ─── Component block definitions ────────────────────────────────────────────

const COMPONENT_GROUPS = [
  {
    label: 'Navigation',
    blocks: [
      { id: 'navbar',       icon: '🧭', label: 'Navbar' },
      { id: 'sidebar-nav',  icon: '📋', label: 'Sidebar Nav' },
      { id: 'breadcrumb',   icon: '›',  label: 'Breadcrumb' },
      { id: 'tabs',         icon: '🗂️', label: 'Tabs' },
    ],
  },
  {
    label: 'Buttons',
    blocks: [
      { id: 'primary-btn',   icon: '🔵', label: 'Primary Button' },
      { id: 'secondary-btn', icon: '⬜', label: 'Secondary Button' },
      { id: 'icon-btn',      icon: '🔘', label: 'Icon Button' },
      { id: 'cta-btn',       icon: '⚡', label: 'CTA Button' },
    ],
  },
  {
    label: 'Content',
    blocks: [
      { id: 'hero',        icon: '🦸', label: 'Hero Section' },
      { id: 'card',        icon: '🃏', label: 'Card' },
      { id: 'testimonial', icon: '💬', label: 'Testimonial' },
      { id: 'pricing',     icon: '💲', label: 'Pricing Table' },
      { id: 'faq',         icon: '❓', label: 'FAQ Section' },
      { id: 'blog',        icon: '📝', label: 'Blog Grid' },
    ],
  },
  {
    label: 'Media',
    blocks: [
      { id: 'image-gallery', icon: '🖼️', label: 'Image Gallery' },
      { id: 'video-embed',   icon: '▶️', label: 'Video Embed' },
      { id: 'carousel',      icon: '🎠', label: 'Carousel' },
      { id: 'avatar',        icon: '👤', label: 'Avatar' },
    ],
  },
  {
    label: 'Forms',
    blocks: [
      { id: 'contact-form', icon: '📧', label: 'Contact Form' },
      { id: 'newsletter',   icon: '📨', label: 'Newsletter' },
      { id: 'search-bar',   icon: '🔍', label: 'Search Bar' },
      { id: 'login-form',   icon: '🔐', label: 'Login Form' },
    ],
  },
  {
    label: 'Layout',
    blocks: [
      { id: 'footer',  icon: '⬇️', label: 'Footer' },
      { id: 'sidebar', icon: '▫️', label: 'Sidebar Panel' },
      { id: 'grid',    icon: '⊞',  label: 'Grid Layout' },
      { id: 'divider', icon: '─',   label: 'Divider' },
    ],
  },
  {
    label: 'E-Commerce',
    blocks: [
      { id: 'product-card', icon: '🛍️', label: 'Product Card' },
      { id: 'cart',         icon: '🛒', label: 'Cart Widget' },
      { id: 'checkout',     icon: '💳', label: 'Checkout Form' },
      { id: 'reviews',      icon: '⭐', label: 'Reviews' },
    ],
  },
  {
    label: 'Memecoin 🐕',
    blocks: [
      { id: 'tokenomics',   icon: '📊', label: 'Tokenomics' },
      { id: 'roadmap',      icon: '🗺️', label: 'Roadmap' },
      { id: 'community',    icon: '🐶', label: 'Community' },
      { id: 'buy-now',      icon: '🚀', label: 'Buy Now CTA' },
      { id: 'whitepaper',   icon: '📄', label: 'Whitepaper' },
      { id: 'socials',      icon: '🌐', label: 'Socials / Links' },
    ],
  },
]

const TECH_STACKS = [
  { id: 'react',      icon: '⚛️', label: 'React' },
  { id: 'nextjs',     icon: '▲',  label: 'Next.js' },
  { id: 'vue',        icon: '🟩', label: 'Vue' },
  { id: 'svelte',     icon: '🔥', label: 'Svelte' },
  { id: 'html',       icon: '🌐', label: 'HTML/CSS' },
  { id: 'tailwind',   icon: '🎨', label: 'Tailwind' },
  { id: 'typescript', icon: '🔷', label: 'TypeScript' },
]

// Funnel themes — what the USER'S WEBSITE will look like
const FUNNEL_THEMES = [
  {
    id: 'dark',
    label: 'Dark',
    bg: '#0f1117',
    text: '#e2e8f0',
    accent: '#6366f1',
    bar: '#6366f1',
  },
  {
    id: 'light',
    label: 'Light',
    bg: '#ffffff',
    text: '#1e293b',
    accent: '#6366f1',
    bar: '#6366f1',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    bg: '#fafafa',
    text: '#111111',
    accent: '#000000',
    bar: '#222',
  },
  {
    id: 'vibrant',
    label: 'Vibrant',
    bg: '#0d0d0d',
    text: '#ffffff',
    accent: '#f43f5e',
    bar: '#f43f5e',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    bg: '#0a1628',
    text: '#bae6fd',
    accent: '#0ea5e9',
    bar: '#0ea5e9',
  },
  {
    id: 'akita',
    label: 'Akita 🐕',
    bg: '#0D0500',
    text: '#FFF3E0',
    accent: '#F7931A',
    bar: '#F7931A',
    isMemecoin: true,
  },
]

const ACCENT_COLORS = [
  '#6366f1', '#a855f7', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#0ea5e9',
  '#F7931A', '#FFD700',
]

// App-level UI themes (affects the PromptForge / Akita app itself)
const APP_THEMES = [
  { id: 'dark',  label: '🌙 Dark' },
  { id: 'light', label: '☀️ Light' },
  { id: 'akita', label: '🐕 Akita' },
]

// ─── Draggable block in sidebar ──────────────────────────────────────────────

function DraggableBlock({ block }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-${block.id}`,
    data: { block },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`block-item ${isDragging ? 'dragging' : ''}`}
    >
      <span className="block-icon">{block.icon}</span>
      <span>{block.label}</span>
    </div>
  )
}

// ─── Droppable funnel section ─────────────────────────────────────────────────

function DroppableSection({ id, children }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`funnel-section ${isOver ? 'drag-over' : ''}`}>
      {children}
    </div>
  )
}

// ─── Dropped block tags ───────────────────────────────────────────────────────

function DroppedBlocks({ section, blocks, onRemove }) {
  if (blocks.length === 0) {
    return <div className="drop-zone-hint">Drop component blocks here</div>
  }
  return (
    <div className="dropped-blocks">
      {blocks.map(b => (
        <span key={b.id} className="dropped-block">
          {b.icon} {b.label}
          <button className="dropped-block-remove" onClick={() => onRemove(section, b.id)}>×</button>
        </span>
      ))}
    </div>
  )
}

// ─── Image section ────────────────────────────────────────────────────────────

function ImageSection({ images, onAddUrl, onUpload, onRemove }) {
  const [urlInput, setUrlInput] = useState('')
  const fileRef = useRef()

  const handleAdd = () => {
    const trimmed = urlInput.trim()
    if (trimmed) { onAddUrl(trimmed); setUrlInput('') }
  }

  return (
    <>
      <div className="image-url-input">
        <input
          className="image-url-field"
          placeholder="Paste image URL from the web…"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn-add-url" onClick={handleAdd}>Add URL</button>
      </div>

      <div
        className="image-upload-area"
        onClick={() => fileRef.current.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault()
          Array.from(e.dataTransfer.files)
            .filter(f => f.type.startsWith('image/'))
            .forEach(onUpload)
        }}
      >
        <div className="image-upload-icon">📁</div>
        <div className="image-upload-text">Drop images here or click to upload</div>
        <div className="image-upload-hint">PNG, JPG, GIF, WebP supported</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => Array.from(e.target.files).forEach(onUpload)}
        />
      </div>

      {images.length > 0 && (
        <div className="image-previews">
          {images.map((img, i) => (
            <div key={i} className="image-preview-item">
              <img className="image-preview-img" src={img.src} alt={img.name} />
              <button className="image-remove-btn" onClick={() => onRemove(i)}>×</button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── Output Modal ─────────────────────────────────────────────────────────────

function OutputModal({ content, onClose }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'akita-prompt.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">📄 Generated Prompt Spec — akita-prompt.md</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <pre className="modal-code">{content}</pre>
        </div>
        <div className="modal-footer">
          <button className="btn-copy" onClick={handleCopy}>
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
          <button className="btn-download-modal" onClick={handleDownload}>
            ⬇ Download akita-prompt.md
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [appTheme, setAppTheme] = useState('dark')
  const [apiKey, setApiKey]     = useState('')
  const [activeBlock, setActiveBlock] = useState(null)

  // Funnel state
  const [selectedTech,   setSelectedTech]   = useState([])
  const [selectedTheme,  setSelectedTheme]  = useState('dark')
  const [accentColor,    setAccentColor]    = useState('#6366f1')
  const [customHex,      setCustomHex]      = useState('#6366f1')
  const [productDetails, setProductDetails] = useState('')
  const [images,         setImages]         = useState([])

  // Blocks dropped into each funnel section
  const [droppedBlocks, setDroppedBlocks] = useState({
    tech: [], theme: [], product: [], images: [],
  })

  // Output / UI state
  const [output,    setOutput]    = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [toast,     setToast]     = useState('')
  const [savedToServer, setSavedToServer] = useState(false)

  // Terminal
  const terminalRef  = useRef(null)
  const [terminalOpen, setTerminalOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const handleDragStart = ({ active }) => {
    setActiveBlock(active.data.current?.block ?? null)
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveBlock(null)
    if (!over) return
    const block = active.data.current?.block
    if (!block) return
    const sectionId = over.id
    setDroppedBlocks(prev => {
      if (prev[sectionId]?.some(b => b.id === block.id)) return prev
      return { ...prev, [sectionId]: [...(prev[sectionId] || []), block] }
    })
  }

  const removeDroppedBlock = (section, blockId) => {
    setDroppedBlocks(prev => ({
      ...prev,
      [section]: prev[section].filter(b => b.id !== blockId),
    }))
  }

  const toggleTech = id =>
    setSelectedTech(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])

  const addImageUrl  = url  => setImages(prev => [...prev, { src: url, name: url, type: 'url' }])
  const removeImage  = idx  => setImages(prev => prev.filter((_, i) => i !== idx))
  const addImageFile = file => {
    const reader = new FileReader()
    reader.onload = e => setImages(prev => [...prev, { src: e.target.result, name: file.name, type: 'file' }])
    reader.readAsDataURL(file)
  }

  // ── Build the markdown spec ─────────────────────────────────────────────────
  const buildMarkdown = useCallback(() => {
    const techList = TECH_STACKS.filter(t => selectedTech.includes(t.id)).map(t => t.label)
    const themeObj = FUNNEL_THEMES.find(t => t.id === selectedTheme)
    const allDropped = Object.entries(droppedBlocks)
      .flatMap(([, blocks]) => blocks.map(b => b.label))
    const imageLines = images.map(img =>
      img.type === 'url' ? `- URL: ${img.src}` : `- Uploaded file: ${img.name}`
    )
    const componentSection = allDropped.length
      ? `## Components to Include\n${allDropped.map(l => `- ${l}`).join('\n')}`
      : ''
    const imageSection = imageLines.length
      ? `## Images\n${imageLines.join('\n')}`
      : ''
    const memecoinNote = themeObj?.isMemecoin
      ? '\n## Memecoin / Akita Theme Notes\n- Use orange (#F7931A) and gold (#FFD700) as primary brand colors\n- Include dog/paw imagery or ASCII art where appropriate\n- Playful, energetic tone for community-driven feel\n- Add subtle crypto/web3 UI patterns (gradient buttons, glow effects)'
      : ''

    return `# Akita — Frontend Prompt Specification
> Generated by Akita Prompt Builder

## Tech Stack
${techList.length ? techList.map(t => `- ${t}`).join('\n') : '- Not specified'}

## Theme & Visual Style
- Theme: ${themeObj?.label || selectedTheme}
- Background: ${themeObj?.bg || '#0f1117'}
- Text Color: ${themeObj?.text || '#e2e8f0'}
- Accent Color: ${accentColor}
${memecoinNote}

## Product / Business Details
${productDetails || 'Not provided.'}

${componentSection}

${imageSection}

## Implementation Notes
- Design for non-technical users (mom & pop / small business / community)
- Responsive design: mobile-first, works on all screen sizes
- Keep navigation simple and intuitive
- Use the specified accent color for all CTAs and key highlights
- Prioritize clear visual hierarchy and readability
`.trim()
  }, [selectedTech, selectedTheme, accentColor, productDetails, images, droppedBlocks])

  // ── Save prompt to server (teammate integration point) ──────────────────────
  const saveToServer = async (markdown) => {
    if (!SAVE_ENDPOINT) return false
    try {
      const res = await fetch(SAVE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown }),
      })
      return res.ok
    } catch {
      return false
    }
  }

  // ── Main generate handler (streaming) ─────────────────────────────────────
  const handleGenerate = async () => {
    const term = terminalRef.current
    const md   = buildMarkdown()

    // Open terminal and reset it
    setTerminalOpen(true)
    term?.reset()
    term?.log('info', 'Collecting form data...')
    term?.log('info', `Built spec — ${md.length} chars`)

    // Persist to server (teammate integration)
    if (SAVE_ENDPOINT) {
      term?.log('info', `Saving to server: ${SAVE_ENDPOINT}`)
      const saved = await saveToServer(md)
      if (saved) {
        setSavedToServer(true)
        term?.log('ok', 'Saved to server as akita-prompt.md')
      } else {
        term?.log('warn', 'Server save failed — check SAVE_ENDPOINT')
      }
    }

    if (!apiKey.trim()) {
      term?.log('warn', 'No Claude API key — outputting local markdown')
      term?.log('ok',   'Done. Click "View Output" to see the spec.')
      setOutput(md)
      setShowModal(true)
      return
    }

    setLoading(true)
    term?.log('info', 'Calling Claude API (streaming)...')
    term?.log('stream', '')

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-calls': 'true',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 4096,
          stream: true,
          system: `You are a senior frontend developer assistant. A non-technical user has filled out a prompt specification form to describe the website they want. Your job is to take their input and produce a clear, detailed, well-structured markdown specification file that a developer (or a Claude Code agent) can use to one-shot build the frontend. Expand on the user's ideas, infer sensible defaults, and add helpful implementation notes. Output ONLY the markdown content — no preamble, no explanation.`,
          messages: [{
            role: 'user',
            content: `Here is my website specification:\n\n${md}\n\nPlease expand this into a comprehensive developer-ready markdown prompt specification.`,
          }],
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || `HTTP ${res.status}`)
      }

      // ── Parse SSE stream ──────────────────────────────────────────────────
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let resultText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const raw = decoder.decode(value, { stream: true })
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (!data || data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              const chunk = parsed.delta.text
              resultText += chunk
              term?.writeChunk(chunk)
            }
          } catch { /* skip malformed chunks */ }
        }
      }

      term?.flushStream()

      // Save expanded spec to server too
      if (SAVE_ENDPOINT) await saveToServer(resultText)

      term?.log('ok', `Streaming complete — ${resultText.length} chars written`)
      term?.log('ok', 'Spec saved as akita-prompt.md  ·  Press Ctrl+G in Claude Code to build UI')

      setOutput(resultText || md)
      setShowModal(true)
      showToast('✓ Spec generated — view output or press Ctrl+G')
    } catch (err) {
      term?.flushStream()
      term?.log('error', err.message)
      setOutput(md)
      setShowModal(true)
      showToast(`Claude error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const totalItems =
    selectedTech.length +
    (productDetails ? 1 : 0) +
    images.length +
    Object.values(droppedBlocks).flat().length

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="app" data-theme={appTheme}>

        {/* ── Header ── */}
        <header className="header">
          <div className="header-brand">
            <span className="header-logo">🐕</span>
            <div>
              <div className="header-title">Akita</div>
              <div className="header-subtitle">Prompt builder, no code needed</div>
            </div>
          </div>

          <div className="header-controls">
            {/* App UI theme switcher */}
            <div className="theme-switcher">
              {APP_THEMES.map(t => (
                <button
                  key={t.id}
                  className={`theme-switch-btn ${appTheme === t.id ? 'active' : ''}`}
                  onClick={() => setAppTheme(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="api-key-wrapper">
              <span className="api-key-label">Claude API Key</span>
              <input
                type="password"
                className="api-key-input"
                placeholder="sk-ant-api03-… (optional)"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
            </div>
          </div>
        </header>

        <div className="main-layout">

          {/* ── Left Sidebar ── */}
          <aside className="sidebar">
            <div className="sidebar-header">
              <div className="sidebar-title">Component Blocks</div>
              <div className="sidebar-hint">Drag blocks into the funnel →</div>
            </div>
            <div className="sidebar-body">
              {COMPONENT_GROUPS.map(group => (
                <div key={group.label} className="sidebar-group">
                  <div className="sidebar-group-label">{group.label}</div>
                  {group.blocks.map(block => (
                    <DraggableBlock key={block.id} block={block} />
                  ))}
                </div>
              ))}
            </div>
          </aside>

          {/* ── Funnel ── */}
          <main className="content-area">
            <div className="funnel-wrapper">
              <h1 className="funnel-title">Website Builder Funnel</h1>
              <p className="funnel-desc">
                Fill in each section. Drag component blocks from the left into any section to include them in your spec.
              </p>

              {savedToServer && (
                <div className="agent-banner">
                  <span className="agent-banner-icon">🤖</span>
                  <span>
                    <strong>akita-prompt.md saved to server</strong> — your teammate can now run
                    the Claude agent (or press <kbd style={{
                      padding: '1px 5px',
                      border: '1px solid currentColor',
                      borderRadius: 4,
                      fontSize: 11,
                    }}>Ctrl+G</kbd> in Claude Code).
                  </span>
                </div>
              )}

              {/* ── 1: Tech Stack ── */}
              <DroppableSection id="tech">
                <div className="funnel-section-header">
                  <span className="funnel-section-icon">⚙️</span>
                  <div className="funnel-section-info">
                    <div className="funnel-section-title">Tech Stack</div>
                    <div className="funnel-section-subtitle">What technologies should be used?</div>
                  </div>
                  <div className="funnel-section-step">1</div>
                </div>
                <div className="funnel-section-body">
                  <div className="tech-grid">
                    {TECH_STACKS.map(tech => (
                      <button
                        key={tech.id}
                        className={`tech-pill ${selectedTech.includes(tech.id) ? 'selected' : ''}`}
                        onClick={() => toggleTech(tech.id)}
                      >
                        <span>{tech.icon}</span>
                        <span>{tech.label}</span>
                        {selectedTech.includes(tech.id) && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                  <DroppedBlocks section="tech" blocks={droppedBlocks.tech} onRemove={removeDroppedBlock} />
                </div>
              </DroppableSection>

              {/* ── 2: Theme ── */}
              <DroppableSection id="theme">
                <div className="funnel-section-header">
                  <span className="funnel-section-icon">🎨</span>
                  <div className="funnel-section-info">
                    <div className="funnel-section-title">Theme & Colors</div>
                    <div className="funnel-section-subtitle">Choose the visual style for your website</div>
                  </div>
                  <div className="funnel-section-step">2</div>
                </div>
                <div className="funnel-section-body">
                  <div className="theme-options">
                    {FUNNEL_THEMES.map(theme => (
                      <div
                        key={theme.id}
                        className={`theme-card ${selectedTheme === theme.id ? 'selected' : ''}`}
                        onClick={() => setSelectedTheme(theme.id)}
                      >
                        <div className="theme-preview" style={{ background: theme.bg }}>
                          <div className="theme-preview-bar" style={{ background: theme.bar }} />
                          <div className="theme-preview-line" style={{ background: theme.text }} />
                          <div className="theme-preview-line" style={{ background: theme.text }} />
                        </div>
                        <div className="theme-name">{theme.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="color-row">
                    <span className="color-label">Accent color</span>
                    {ACCENT_COLORS.map(c => (
                      <div
                        key={c}
                        className={`color-swatch ${accentColor === c ? 'selected' : ''}`}
                        style={{ background: c }}
                        onClick={() => { setAccentColor(c); setCustomHex(c) }}
                      />
                    ))}
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        className="color-input"
                        value={accentColor}
                        onChange={e => { setAccentColor(e.target.value); setCustomHex(e.target.value) }}
                      />
                      <input
                        className="custom-hex-input"
                        value={customHex}
                        onChange={e => {
                          setCustomHex(e.target.value)
                          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setAccentColor(e.target.value)
                        }}
                        placeholder="#6366f1"
                      />
                    </div>
                  </div>

                  <DroppedBlocks section="theme" blocks={droppedBlocks.theme} onRemove={removeDroppedBlock} />
                </div>
              </DroppableSection>

              {/* ── 3: Product Details ── */}
              <DroppableSection id="product">
                <div className="funnel-section-header">
                  <span className="funnel-section-icon">📋</span>
                  <div className="funnel-section-info">
                    <div className="funnel-section-title">Product / Business Details</div>
                    <div className="funnel-section-subtitle">Describe your business, product, or service</div>
                  </div>
                  <div className="funnel-section-step">3</div>
                </div>
                <div className="funnel-section-body">
                  <textarea
                    className="product-textarea"
                    placeholder="e.g. I run a small bakery called Sweet Crumbs. We sell artisan breads and pastries. I want a homepage with our story, a menu section, and a contact form. My audience is local families aged 30–60."
                    value={productDetails}
                    onChange={e => setProductDetails(e.target.value)}
                  />
                  <DroppedBlocks section="product" blocks={droppedBlocks.product} onRemove={removeDroppedBlock} />
                </div>
              </DroppableSection>

              {/* ── 4: Images ── */}
              <DroppableSection id="images">
                <div className="funnel-section-header">
                  <span className="funnel-section-icon">🖼️</span>
                  <div className="funnel-section-info">
                    <div className="funnel-section-title">Images</div>
                    <div className="funnel-section-subtitle">Upload or link reference images for your site</div>
                  </div>
                  <div className="funnel-section-step">4</div>
                </div>
                <div className="funnel-section-body">
                  <ImageSection
                    images={images}
                    onAddUrl={addImageUrl}
                    onUpload={addImageFile}
                    onRemove={removeImage}
                  />
                  <DroppedBlocks section="images" blocks={droppedBlocks.images} onRemove={removeDroppedBlock} />
                </div>
              </DroppableSection>

            </div>
          </main>

          {/* ── Terminal Panel (right side) ── */}
          <TerminalPanel ref={terminalRef} isOpen={terminalOpen} />
        </div>

        {/* ── Bottom Bar ── */}
        <div className="bottom-bar">
          <div className="bottom-status">
            {totalItems > 0
              ? `${totalItems} item${totalItems !== 1 ? 's' : ''} in your spec`
              : 'Fill in the sections above to build your prompt'}
          </div>
          <div className="bottom-actions">
            {output && (
              <button className="btn-secondary" onClick={() => setShowModal(true)}>
                📄 View Output
              </button>
            )}
            <button
              className="btn-generate"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading
                ? <><div className="spinner" /> Generating…</>
                : '🐕 Generate Prompt'}
            </button>
          </div>
        </div>

      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeBlock && (
          <div className="drag-overlay-item">
            <span className="block-icon">{activeBlock.icon}</span>
            <span>{activeBlock.label}</span>
          </div>
        )}
      </DragOverlay>

      {showModal && <OutputModal content={output} onClose={() => setShowModal(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </DndContext>
  )
}
