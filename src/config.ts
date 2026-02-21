import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const WORKSPACE_DIR = path.join(PROJECT_ROOT, 'workspace');
export const MCP_SERVER_DIR = path.join(PROJECT_ROOT, 'mcp-server');
export const MCP_CONFIG_PATH = path.join(PROJECT_ROOT, 'mcp-config.json');

export const PORT = parseInt(process.env.PORT || '3001', 10);
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'haiku';
