#!/usr/bin/env node
/**
 * Orkestria MCP — stdio server.
 *
 * Config:
 *   ORKESTRIA_API_KEY  (required)  ork_... key created in the Orkestria dashboard
 *   ORKESTRIA_API_URL  (optional)  defaults to https://orkestria.one
 *
 * All tools are fetched from the Orkestria API at startup and proxied through
 * the hosted policy engine (dry-run / approval / live + audit trail).
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_URL = (process.env.ORKESTRIA_API_URL ?? "https://orkestria.one").replace(/\/$/, "");
const API_KEY = process.env.ORKESTRIA_API_KEY;

if (!API_KEY) {
  console.error(
    "ORKESTRIA_API_KEY manquant.\n" +
      "Créez une clé dans le dashboard Orkestria (Clés API) puis relancez :\n" +
      '  { "env": { "ORKESTRIA_API_KEY": "ork_..." } }',
  );
  process.exit(1);
}

async function fetchTools() {
  const res = await fetch(`${API_URL}/api/mcp/tools`);
  if (!res.ok) throw new Error(`Impossible de charger les tools (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.tools ?? [];
}

async function callTool(name, args) {
  const res = await fetch(`${API_URL}/api/mcp/call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ tool: name, arguments: args ?? {} }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data.result;
}

const tools = await fetchTools();

const server = new Server(
  { name: "orkestria-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await callTool(name, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: typeof result === "object" && result !== null ? result : undefined,
    };
  } catch (e) {
    return {
      content: [{ type: "text", text: e instanceof Error ? e.message : "Erreur Orkestria" }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`orkestria-mcp connecté — ${tools.length} tools (${API_URL})`);
