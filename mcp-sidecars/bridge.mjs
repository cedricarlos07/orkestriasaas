/**
 * Minimal MCP Streamable HTTP bridge — forwards JSON-RPC tool calls.
 * Deploy official MCP servers (Google Ads, GA4, TikTok) behind this bridge
 * or leave MCP_*_URL unset to use Orkestria direct platform API clients.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MCP_BRIDGE_PORT ?? 3101);

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));

  // Forward to upstream MCP if configured (e.g. local stdio wrapper)
  const upstream = process.env.MCP_UPSTREAM_URL;
  if (upstream) {
    const up = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: req.headers.authorization ?? "",
      },
      body: JSON.stringify(body),
    });
    const text = await up.text();
    res.writeHead(up.status, { "Content-Type": "application/json" });
    res.end(text);
    return;
  }

  res.writeHead(503, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      id: body.id,
      error: {
        message:
          "MCP_UPSTREAM_URL not set. Configure official MCP server or use Orkestria direct API mode.",
      },
    }),
  );
});

server.listen(PORT, () => {
  console.log(`MCP bridge listening on :${PORT}`);
});
