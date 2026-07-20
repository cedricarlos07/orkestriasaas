/**
 * MCP Streamable HTTP bridge — forwards JSON-RPC to AdKit (or another upstream).
 *
 * Default upstream when ADKIT_API_KEY is set: https://mcp.adkit.so
 * Override with MCP_UPSTREAM_URL.
 *
 * Auth: uses ADKIT_API_KEY as Bearer when calling AdKit; otherwise forwards inbound Authorization.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MCP_BRIDGE_PORT ?? 3101);
const ADKIT_DEFAULT = "https://mcp.adkit.so";

function resolveUpstream() {
  if (process.env.MCP_UPSTREAM_URL?.trim()) return process.env.MCP_UPSTREAM_URL.trim().replace(/\/$/, "");
  if (process.env.ADKIT_API_KEY?.trim()) return ADKIT_DEFAULT;
  return null;
}

function resolveAuth(inbound) {
  const key = process.env.ADKIT_API_KEY?.trim();
  if (key) return `Bearer ${key}`;
  return inbound ?? "";
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    const upstream = resolveUpstream();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        upstream: upstream ?? null,
        adkit: Boolean(process.env.ADKIT_API_KEY?.trim()),
      }),
    );
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const upstream = resolveUpstream();
  if (upstream) {
    try {
      const up = await fetch(`${upstream}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: resolveAuth(req.headers.authorization),
        },
        body: JSON.stringify(body),
      });
      const text = await up.text();
      res.writeHead(up.status, { "Content-Type": "application/json" });
      res.end(text);
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          error: { message: e instanceof Error ? e.message : "Upstream failed" },
        }),
      );
    }
    return;
  }

  res.writeHead(503, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      id: body.id,
      error: {
        message:
          "Set ADKIT_API_KEY (forwards to https://mcp.adkit.so) or MCP_UPSTREAM_URL. Or leave MCP_*_URL unset for Orkestria direct API mode.",
      },
    }),
  );
});

server.listen(PORT, () => {
  console.log(`MCP bridge listening on :${PORT} → ${resolveUpstream() ?? "(no upstream)"}`);
});
