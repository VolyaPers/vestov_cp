// Local macOS launcher. The MCP token is supplied by Keychain at each startup.
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const url = new URL('https://vestov-cp-prod.onrender.com/api/mcp');
const remote = new Client({ name: 'vestov-hub-codex', version: '1.0.0' });
let token;

try {
  token = execFileSync('/usr/bin/security', ['find-generic-password', '-a', process.env.USER || '', '-s', 'vestov-hub-mcp', '-w'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  console.error('Add the Vestov HUB MCP token to your login Keychain under vestov-hub-mcp.');
  process.exit(1);
}

if (!/^vh_mcp_[A-Za-z0-9_-]{43}$/.test(token)) {
  console.error('The Vestov HUB MCP token in Keychain has an invalid format.');
  process.exit(1);
}

try {
  await remote.connect(new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { Authorization: `Bearer ${token}` }, redirect: 'error' },
  }));
} catch {
  console.error('Could not connect to the authenticated Vestov HUB MCP endpoint.');
  process.exit(1);
}

const local = new Server(remote.getServerVersion() ?? { name: 'vestov-hub', version: '1.0.0' }, {
  capabilities: { tools: {} },
  instructions: remote.getInstructions(),
});
local.setRequestHandler(ListToolsRequestSchema, (request) => remote.listTools(request.params));
local.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    return await remote.callTool(request.params);
  } catch {
    throw new McpError(ErrorCode.InternalError, 'The Vestov HUB tool request failed.');
  }
});
local.onclose = () => { void remote.close().catch(() => {}); };
process.stdin.once('end', () => { void local.close().catch(() => {}); });
await local.connect(new StdioServerTransport());
