import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { AttachAddon } from '@xterm/addon-attach'
import '@xterm/xterm/css/xterm.css'

const WS_ENDPOINT = 'ws://localhost:3001/ws/terminal'

// ANSI color helpers
const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
  gray:    '\x1b[90m',
}

const STATUS_COLORS = {
  idle:       '#334155',
  connecting: '#eab308',
  connected:  '#22c55e',
  error:      '#ef4444',
}

const TerminalPanel = forwardRef(({ isOpen }, ref) => {
  const containerRef   = useRef(null)
  const termRef        = useRef(null)
  const fitAddonRef    = useRef(null)
  const wsRef          = useRef(null)
  const [wsStatus, setWsStatus] = useState('idle')

  // Connect to backend WebSocket
  const connectWS = (term) => {
    const t = term || termRef.current
    if (!t || !WS_ENDPOINT) return false

    wsRef.current?.close()

    t.options.disableStdin = false
    t.clear()
    setWsStatus('connecting')
    t.writeln(`${c.gray}  Connecting to backend...${c.reset}`)

    const ws = new WebSocket(WS_ENDPOINT)
    wsRef.current = ws

    ws.onopen = () => {
      setWsStatus('connected')
      const attachAddon = new AttachAddon(ws)
      t.loadAddon(attachAddon)
      try { fitAddonRef.current?.fit() } catch {}

      t.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }))
        }
      })
    }

    ws.onerror = () => {
      setWsStatus('error')
      t.writeln(`${c.red}  Connection failed${c.reset}`)
      t.writeln(`${c.gray}  Is the backend running? (npm run dev)${c.reset}`)
      t.options.disableStdin = true
    }

    ws.onclose = () => {
      setWsStatus('idle')
      t.options.disableStdin = true
    }

    return true
  }

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      disableStdin: true,
      cursorBlink: true,
      scrollback: 5000,
      convertEol: true,
      fontFamily: '"Source Code Pro", "Fira Code", "JetBrains Mono", monospace',
      fontSize: 12,
      lineHeight: 1.5,
      theme: {
        background:          '#080c14',
        foreground:          '#94a3b8',
        cursor:              '#6366f1',
        cursorAccent:        '#080c14',
        selectionBackground: 'rgba(99,102,241,0.25)',
        black:   '#1e293b', brightBlack:   '#475569',
        red:     '#ef4444', brightRed:     '#f87171',
        green:   '#22c55e', brightGreen:   '#4ade80',
        yellow:  '#eab308', brightYellow:  '#facc15',
        blue:    '#6366f1', brightBlue:    '#818cf8',
        magenta: '#a855f7', brightMagenta: '#c084fc',
        cyan:    '#0ea5e9', brightCyan:    '#38bdf8',
        white:   '#e2e8f0', brightWhite:   '#f8fafc',
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)

    termRef.current     = term
    fitAddonRef.current = fitAddon

    const ro = new ResizeObserver(() => { try { fitAddon.fit() } catch {} })
    ro.observe(containerRef.current)

    requestAnimationFrame(() => {
      try { fitAddon.fit() } catch {}
      // Auto-connect to backend terminal
      connectWS(term)
    })

    return () => {
      ro.disconnect()
      wsRef.current?.close()
      term.dispose()
    }
  }, [])

  useImperativeHandle(ref, () => ({
    connectWS: () => connectWS(),
  }))

  const dotColor = STATUS_COLORS[wsStatus] ?? STATUS_COLORS.idle

  return (
    <div className={`terminal-panel ${isOpen ? 'open' : ''}`}>
      <div className="terminal-header">
        <div className="terminal-dots">
          <span className="tdot tdot-red" />
          <span className="tdot tdot-yellow" />
          <span className="tdot tdot-green" />
        </div>
        <span className="terminal-title">akita-agent</span>
        <span
          className="terminal-ws-dot"
          style={{ background: dotColor }}
          title={wsStatus}
        />
        <span className="terminal-label">
          {wsStatus === 'connected'  ? 'live'
         : wsStatus === 'connecting' ? 'connecting…'
         : wsStatus === 'error'      ? 'error'
         : 'ready'}
        </span>
      </div>
      <div ref={containerRef} className="terminal-body" />
    </div>
  )
})

TerminalPanel.displayName = 'TerminalPanel'
export default TerminalPanel
