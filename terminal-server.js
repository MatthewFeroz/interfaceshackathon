// Minimal PTY bridge — connects xterm.js in the browser to a real local terminal
// Usage: node terminal-server.js
// Then set WS_ENDPOINT = 'ws://localhost:3001/terminal' in TerminalPanel.jsx

const pty  = require('node-pty')
const { WebSocketServer } = require('ws')

const PORT  = 3001
const SHELL = process.env.SHELL || '/bin/zsh'

const wss = new WebSocketServer({ port: PORT })
console.log(`[akita terminal-server] Listening on ws://localhost:${PORT}/terminal`)
console.log(`[akita terminal-server] Shell: ${SHELL}`)

wss.on('connection', (ws) => {
  console.log('[akita terminal-server] Client connected — spawning terminal')

  // Strip CLAUDECODE env var so claude can launch without nesting errors
  const cleanEnv = { ...process.env }
  delete cleanEnv.CLAUDECODE

  const ptyProcess = pty.spawn(SHELL, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: process.cwd(),
    env: cleanEnv,
  })

  // pty → browser
  ptyProcess.onData(data => {
    if (ws.readyState === ws.OPEN) ws.send(data)
  })

  // Auto-launch Claude Code once the shell is ready
  setTimeout(() => {
    if (ptyProcess) {
      console.log('[akita terminal-server] Auto-launching claude')
      ptyProcess.write('claude\n')
    }
  }, 800)

  // browser → pty (skip JSON resize messages)
  ws.on('message', raw => {
    const str = typeof raw === 'string' ? raw : raw.toString()
    try {
      const msg = JSON.parse(str)
      if (msg.type === 'resize') {
        ptyProcess.resize(msg.cols, msg.rows)
        return
      }
    } catch {}
    ptyProcess.write(str)
  })

  ws.on('close', () => {
    console.log('[akita terminal-server] Client disconnected — killing pty')
    ptyProcess.kill()
  })

  ptyProcess.onExit(() => {
    console.log('[akita terminal-server] pty exited')
    ws.close()
  })
})
