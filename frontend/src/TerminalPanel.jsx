import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { AttachAddon } from '@xterm/addon-attach'
import '@xterm/xterm/css/xterm.css'

// ─────────────────────────────────────────────────────────────────────────────
// TEAMMATE INTEGRATION POINT
// Set WS_ENDPOINT to your backend WebSocket URL that serves a node-pty session.
// e.g. 'ws://localhost:3001/terminal'
//
// When set:   clicking Generate opens a REAL interactive terminal running Claude Code.
// When unset: the panel shows log output + Claude API streaming instead.
// ─────────────────────────────────────────────────────────────────────────────
export const WS_ENDPOINT = 'ws://localhost:3001/ws/terminal'

// ANSI color helpers
export const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
  gray:    '\x1b[90m',
}

const BANNER = [
  `${c.cyan}  ╔══════════════════════════════════╗${c.reset}`,
  `${c.cyan}  ║  ${c.bold}🐕 Akita Agent Terminal${c.reset}${c.cyan}          ║${c.reset}`,
  `${c.cyan}  ╚══════════════════════════════════╝${c.reset}`,
]

const STATUS_COLORS = {
  idle:       '#334155',
  connecting: '#eab308',
  connected:  '#22c55e',
  error:      '#ef4444',
  streaming:  '#6366f1',
}

const TerminalPanel = forwardRef(({ isOpen }, ref) => {
  const containerRef   = useRef(null)
  const termRef        = useRef(null)
  const fitAddonRef    = useRef(null)
  const wsRef          = useRef(null)
  const partialLineRef = useRef('')
  const [wsStatus, setWsStatus] = useState('idle')

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

    // ResizeObserver handles the slide-in transition — re-fits every frame
    const ro = new ResizeObserver(() => { try { fitAddon.fit() } catch {} })
    ro.observe(containerRef.current)

    requestAnimationFrame(() => {
      try { fitAddon.fit() } catch {}
      BANNER.forEach(l => term.writeln(l))
      term.writeln('')
      if (WS_ENDPOINT) {
        term.writeln(`${c.gray}  Backend: ${WS_ENDPOINT}${c.reset}`)
        term.writeln(`${c.gray}  Click Generate to open Claude Code terminal.${c.reset}`)
      } else {
        term.writeln(`${c.gray}  Waiting for generate...${c.reset}`)
      }
    })

    return () => {
      ro.disconnect()
      wsRef.current?.close()
      term.dispose()
    }
  }, [])

  // ── Connect to backend WebSocket (real terminal) ──────────────────────────
  const connectWS = () => {
    const t = termRef.current
    if (!t || !WS_ENDPOINT) return false

    // Close any existing session
    wsRef.current?.close()

    t.options.disableStdin = false   // make interactive
    t.clear()
    BANNER.forEach(l => t.writeln(l))
    t.writeln('')
    setWsStatus('connecting')
    t.writeln(`${c.yellow}  Connecting to ${WS_ENDPOINT}...${c.reset}`)

    const ws = new WebSocket(WS_ENDPOINT)
    wsRef.current = ws

    ws.onopen = () => {
      setWsStatus('connected')
      const attachAddon = new AttachAddon(ws)
      t.loadAddon(attachAddon)
      try { fitAddonRef.current?.fit() } catch {}

      // Forward terminal resize to the PTY process
      t.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }))
        }
      })
    }

    ws.onerror = () => {
      setWsStatus('error')
      t.writeln(`${c.red}  Connection failed: ${WS_ENDPOINT}${c.reset}`)
      t.writeln(`${c.gray}  Is the backend server running?${c.reset}`)
      t.options.disableStdin = true
    }

    ws.onclose = () => {
      if (wsStatus === 'connected') {
        t.writeln(`\r\n${c.gray}  [session closed]${c.reset}`)
      }
      setWsStatus('idle')
      t.options.disableStdin = true
    }

    return true
  }

  useImperativeHandle(ref, () => ({
    // Returns true if WS_ENDPOINT is configured — App uses this to decide mode
    hasWS: () => !!WS_ENDPOINT,

    // Open a real WebSocket terminal (when WS_ENDPOINT is set)
    connectWS,

    // ── Log-mode helpers (used when WS_ENDPOINT is not set) ──────────────────
    log: (level, msg) => {
      const t = termRef.current
      if (!t) return
      const ts  = new Date().toLocaleTimeString('en', { hour12: false })
      const col = level === 'info'  ? c.cyan
                : level === 'ok'   ? c.green
                : level === 'warn' ? c.yellow
                : level === 'error'? c.red
                : c.gray
      const tag = level === 'info'  ? 'INFO '
                : level === 'ok'   ? 'DONE '
                : level === 'warn' ? 'WARN '
                : level === 'error'? 'ERR  '
                : 'LOG  '
      t.writeln(`  ${c.gray}${ts}${c.reset}  ${col}${c.bold}${tag}${c.reset}  ${msg}`)
    },

    writeChunk: (text) => {
      termRef.current?.write(text)
      partialLineRef.current += text
    },

    flushStream: () => {
      if (partialLineRef.current !== '') {
        termRef.current?.write('\r\n')
        partialLineRef.current = ''
      }
    },

    reset: () => {
      const t = termRef.current
      if (!t) return
      partialLineRef.current = ''
      t.clear()
      BANNER.forEach(l => t.writeln(l))
      t.writeln('')
    },
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
        {/* Live status dot */}
        <span
          className="terminal-ws-dot"
          style={{ background: dotColor }}
          title={wsStatus}
        />
        <span className="terminal-label">
          {wsStatus === 'connected'   ? 'live'
         : wsStatus === 'connecting' ? 'connecting…'
         : wsStatus === 'error'      ? 'error'
         : WS_ENDPOINT               ? 'ready'
         : 'read-only'}
        </span>
      </div>
      <div ref={containerRef} className="terminal-body" />
    </div>
  )
})

TerminalPanel.displayName = 'TerminalPanel'
export default TerminalPanel
