import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

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

const TerminalPanel = forwardRef(({ isOpen }, ref) => {
  const containerRef   = useRef(null)
  const termRef        = useRef(null)
  const fitAddonRef    = useRef(null)
  const partialLineRef = useRef('')

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      disableStdin: true,
      cursorBlink: false,
      scrollback: 5000,
      convertEol: true,           // auto-convert \n → \r\n
      fontFamily: '"Fira Code", "JetBrains Mono", "Courier New", monospace',
      fontSize: 12,
      lineHeight: 1.5,
      letterSpacing: 0,
      theme: {
        background:          '#080c14',
        foreground:          '#94a3b8',
        cursor:              '#6366f1',
        cursorAccent:        '#080c14',
        selectionBackground: 'rgba(99,102,241,0.25)',
        black:               '#1e293b',
        brightBlack:         '#475569',
        red:                 '#ef4444',
        brightRed:           '#f87171',
        green:               '#22c55e',
        brightGreen:         '#4ade80',
        yellow:              '#eab308',
        brightYellow:        '#facc15',
        blue:                '#6366f1',
        brightBlue:          '#818cf8',
        magenta:             '#a855f7',
        brightMagenta:       '#c084fc',
        cyan:                '#0ea5e9',
        brightCyan:          '#38bdf8',
        white:               '#e2e8f0',
        brightWhite:         '#f8fafc',
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)

    termRef.current     = term
    fitAddonRef.current = fitAddon

    // ResizeObserver re-fits on every animation frame of the slide-in transition
    // This is the correct fix — avoids stale column calculations at width≈0
    const ro = new ResizeObserver(() => {
      try { fitAddon.fit() } catch {}
    })
    ro.observe(containerRef.current)

    // Initial fit + banner (deferred so DOM has dimensions)
    requestAnimationFrame(() => {
      try { fitAddon.fit() } catch {}
      BANNER.forEach(l => term.writeln(l))
      term.writeln('')
      term.writeln(`${c.gray}  Waiting for generate...${c.reset}`)
    })

    return () => {
      ro.disconnect()
      term.dispose()
    }
  }, [])

  useImperativeHandle(ref, () => ({
    log: (level, msg) => {
      const t = termRef.current
      if (!t) return
      const ts  = new Date().toLocaleTimeString('en', { hour12: false })
      const col = level === 'info'   ? c.cyan
                : level === 'ok'    ? c.green
                : level === 'warn'  ? c.yellow
                : level === 'error' ? c.red
                : c.gray
      const tag = level === 'info'   ? 'INFO '
                : level === 'ok'    ? 'DONE '
                : level === 'warn'  ? 'WARN '
                : level === 'error' ? 'ERR  '
                : 'LOG  '
      t.writeln(`  ${c.gray}${ts}${c.reset}  ${col}${c.bold}${tag}${c.reset}  ${msg}`)
    },

    // Write streaming markdown chunk — convertEol:true handles \n→\r\n
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

  return (
    <div className={`terminal-panel ${isOpen ? 'open' : ''}`}>
      <div className="terminal-header">
        <div className="terminal-dots">
          <span className="tdot tdot-red" />
          <span className="tdot tdot-yellow" />
          <span className="tdot tdot-green" />
        </div>
        <span className="terminal-title">akita-agent</span>
        <span className="terminal-label">read-only</span>
      </div>
      <div ref={containerRef} className="terminal-body" />
    </div>
  )
})

TerminalPanel.displayName = 'TerminalPanel'
export default TerminalPanel
