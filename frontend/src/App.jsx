import { useState, useRef, useCallback, useEffect } from 'react'
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

const API_BASE = 'http://localhost:3001'
const UI_WS = 'ws://localhost:3001/ws/ui'

// ─── Component block definitions ────────────────────────────────────────────

const COMPONENT_GROUPS = [
  {
    label: 'Navigation',
    blocks: [
      { id: 'navbar',       label: 'Navbar' },
      { id: 'sidebar-nav',  label: 'Sidebar Nav' },
      { id: 'breadcrumb',   label: 'Breadcrumb' },
      { id: 'tabs',         label: 'Tabs' },
    ],
  },
  {
    label: 'Buttons',
    blocks: [
      { id: 'primary-btn',   label: 'Primary Button' },
      { id: 'secondary-btn', label: 'Secondary Button' },
      { id: 'icon-btn',      label: 'Icon Button' },
      { id: 'cta-btn',       label: 'CTA' },
    ],
  },
  {
    label: 'Content',
    blocks: [
      { id: 'hero',        label: 'Hero' },
      { id: 'card',        label: 'Card' },
      { id: 'testimonial', label: 'Testimonial' },
      { id: 'pricing',     label: 'Pricing Table' },
      { id: 'faq',         label: 'FAQ' },
      { id: 'blog',        label: 'Blog Grid' },
    ],
  },
  {
    label: 'Media',
    blocks: [
      { id: 'image-gallery', label: 'Gallery' },
      { id: 'video-embed',   label: 'Video' },
      { id: 'carousel',      label: 'Carousel' },
      { id: 'avatar',        label: 'Avatar' },
    ],
  },
  {
    label: 'Forms',
    blocks: [
      { id: 'contact-form', label: 'Contact Form' },
      { id: 'newsletter',   label: 'Newsletter' },
      { id: 'search-bar',   label: 'Search' },
      { id: 'login-form',   label: 'Login' },
    ],
  },
  {
    label: 'Layout',
    blocks: [
      { id: 'footer',  label: 'Footer' },
      { id: 'sidebar', label: 'Sidebar' },
      { id: 'grid',    label: 'Grid' },
      { id: 'divider', label: 'Divider' },
    ],
  },
  {
    label: 'E-Commerce',
    blocks: [
      { id: 'product-card', label: 'Product Card' },
      { id: 'cart',         label: 'Cart' },
      { id: 'checkout',     label: 'Checkout' },
      { id: 'reviews',      label: 'Reviews' },
    ],
  },
  {
    label: 'Memecoin',
    blocks: [
      { id: 'tokenomics',   label: 'Tokenomics' },
      { id: 'roadmap',      label: 'Roadmap' },
      { id: 'community',    label: 'Community' },
      { id: 'buy-now',      label: 'Buy CTA' },
      { id: 'whitepaper',   label: 'Whitepaper' },
      { id: 'socials',      label: 'Socials' },
    ],
  },
]

const TECH_STACKS = [
  { id: 'react',      label: 'React' },
  { id: 'nextjs',     label: 'Next.js' },
  { id: 'vue',        label: 'Vue' },
  { id: 'svelte',     label: 'Svelte' },
  { id: 'html',       label: 'HTML/CSS' },
  { id: 'tailwind',   label: 'Tailwind' },
  { id: 'typescript', label: 'TypeScript' },
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
    label: 'Akita',
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

// App-level UI themes (affects the Akita app itself)
const APP_THEMES = [
  { id: 'dark',  label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'vapor', label: 'Vapor' },
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
    return <div className="drop-zone-hint">Drop blocks here</div>
  }
  return (
    <div className="dropped-blocks">
      {blocks.map(b => (
        <span key={b.id} className="dropped-block">
          {b.label}
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
        <div className="image-upload-text">Drop files or click to upload</div>
        <div className="image-upload-hint">PNG, JPG, GIF, WebP</div>
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

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [appTheme, setAppTheme] = useState('dark')
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

  // Backend state
  const [previewHtml,    setPreviewHtml]    = useState('')
  const [feedback,       setFeedback]       = useState('')
  const [loading,        setLoading]        = useState(false)
  const [toast,          setToast]          = useState('')
  const [previewExpanded, setPreviewExpanded] = useState(false)

  // Terminal
  const terminalRef = useRef(null)

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

  // ── Build PageLayout JSON for the backend (/api/state/layout) ───────────────
  const buildPageLayout = useCallback(() => {
    let counter = 0
    const blocks = Object.values(droppedBlocks)
      .flat()
      .map(b => ({
        id: `${b.id}-${++counter}`,
        type: b.id,
        props: {},
      }))

    const themeObj = FUNNEL_THEMES.find(t => t.id === selectedTheme)
    const techLabels = TECH_STACKS.filter(t => selectedTech.includes(t.id)).map(t => t.label)

    return {
      blocks,
      theme: themeObj?.label || selectedTheme,
      accentColor,
      techStack: techLabels.length ? techLabels : undefined,
      businessDescription: productDetails || undefined,
    }
  }, [droppedBlocks, selectedTheme, accentColor, selectedTech, productDetails])

  // ── Sync layout to backend (debounced) ──────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      const layout = buildPageLayout()
      fetch(`${API_BASE}/api/state/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layout),
      }).catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [buildPageLayout])

  // ── UI WebSocket for preview updates ────────────────────────────────────────
  useEffect(() => {
    let ws
    let retryTimer

    function connect() {
      ws = new WebSocket(UI_WS)

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'preview:updated' && msg.payload?.html) {
            setPreviewHtml(msg.payload.html)
          }
          if (msg.type === 'init' && msg.payload?.previewHtml) {
            setPreviewHtml(msg.payload.previewHtml)
          }
        } catch {}
      }

      ws.onclose = () => {
        retryTimer = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      clearTimeout(retryTimer)
      ws?.close()
    }
  }, [])


  // ── Generate handler ────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setLoading(true)
    try {
      // Sync layout first
      await fetch(`${API_BASE}/api/state/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPageLayout()),
      })

      const res = await fetch(`${API_BASE}/api/generate`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error || 'Generate failed')
      } else {
        showToast('Generating — watch the terminal')
      }
    } catch {
      showToast('Cannot reach backend')
    } finally {
      setLoading(false)
    }
  }

  // ── Revise handler ──────────────────────────────────────────────────────────
  const handleRevise = async () => {
    if (!feedback.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error || 'Revise failed')
      } else {
        setFeedback('')
        showToast('Revising — watch the terminal')
      }
    } catch {
      showToast('Cannot reach backend')
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
            <div>
              <div className="header-title">akita</div>
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

          </div>
        </header>

        <div className="main-layout">

          {/* ── Left Sidebar ── */}
          <aside className="sidebar">
            <div className="sidebar-header">
              <div className="sidebar-title">Components</div>
              <div className="sidebar-hint">Drag into sections</div>
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
              <h1 className="funnel-title">Build your site</h1>
              <p className="funnel-desc">
                Pick a stack, choose a look, describe your business, and drop in components.
              </p>

              {/* ── 1: Tech Stack ── */}
              <DroppableSection id="tech">
                <div className="funnel-section-header">
                  <div className="funnel-section-info">
                    <div className="funnel-section-title">Tech Stack</div>
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
                        {tech.label}
                      </button>
                    ))}
                  </div>
                  <DroppedBlocks section="tech" blocks={droppedBlocks.tech} onRemove={removeDroppedBlock} />
                </div>
              </DroppableSection>

              {/* ── 2: Theme ── */}
              <DroppableSection id="theme">
                <div className="funnel-section-header">
                  <div className="funnel-section-info">
                    <div className="funnel-section-title">Theme & Colors</div>
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
                  <div className="funnel-section-info">
                    <div className="funnel-section-title">About your business</div>
                  </div>
                  <div className="funnel-section-step">3</div>
                </div>
                <div className="funnel-section-body">
                  <textarea
                    className="product-textarea"
                    placeholder="What does your business do? Who are your customers?"
                    value={productDetails}
                    onChange={e => setProductDetails(e.target.value)}
                  />
                  <DroppedBlocks section="product" blocks={droppedBlocks.product} onRemove={removeDroppedBlock} />
                </div>
              </DroppableSection>

              {/* ── 4: Images ── */}
              <DroppableSection id="images">
                <div className="funnel-section-header">
                  <div className="funnel-section-info">
                    <div className="funnel-section-title">Images</div>
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

          {/* ── Right Panel: Preview + Terminal ── */}
          <div className={`right-panel ${previewExpanded ? 'preview-expanded' : ''}`}>
            {/* Preview iframe */}
            <div className={`preview-panel ${previewHtml ? 'has-preview' : ''}`}>
              {previewHtml && (
                <button
                  className="preview-toggle"
                  onClick={() => setPreviewExpanded(prev => !prev)}
                  title={previewExpanded ? 'Collapse preview' : 'Expand preview'}
                >
                  {previewExpanded ? '⤡' : '⤢'}
                </button>
              )}
              {previewHtml ? (
                <iframe
                  className="preview-iframe"
                  srcDoc={previewHtml}
                  title="Preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <div className="preview-empty">
                  <div className="preview-empty-text">Preview will appear here</div>
                  <div className="preview-empty-hint">Drop blocks and click Generate</div>
                </div>
              )}

              {/* Revision bar */}
              {previewHtml && (
                <div className="revision-bar">
                  <input
                    className="revision-input"
                    placeholder="Describe changes..."
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRevise()}
                  />
                  <button
                    className="btn-revise"
                    onClick={handleRevise}
                    disabled={loading || !feedback.trim()}
                  >
                    Revise
                  </button>
                </div>
              )}
            </div>

            {/* Terminal */}
            <TerminalPanel ref={terminalRef} isOpen={true} />
          </div>
        </div>

        {/* ── Bottom Bar ── */}
        <div className="bottom-bar">
          <div className="bottom-status">
            {totalItems > 0
              ? `${totalItems} selected`
              : 'Ready when you are'}
          </div>
          <div className="bottom-actions">
            <button
              className="btn-generate"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading
                ? <><div className="spinner" /> Generating…</>
                : 'Generate'}
            </button>
          </div>
        </div>

      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeBlock && (
          <div className="drag-overlay-item">
            <span>{activeBlock.label}</span>
          </div>
        )}
      </DragOverlay>

      {toast && <div className="toast">{toast}</div>}
    </DndContext>
  )
}
