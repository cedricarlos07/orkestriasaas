import fs from "node:fs";
import https from "node:https";

const [sessionId, ticket, filePath] = process.argv.slice(2);
if (!sessionId || !ticket || !filePath) {
  console.error("Usage: node scripts/upload-openship.mjs <sessionId> <ticket> <filePath>");
  process.exit(1);
}

const data = fs.readFileSync(filePath);
const req = https.request(
  {
    hostname: "openship.ossey.one",
    path: `/api/projects/folder/upload/${sessionId}`,
    method: "POST",
    headers: {
      "x-upload-ticket": ticket,
      "Content-Type": "application/gzip",
      "Content-Length": data.length,
    },
  },
  (res) => {
    let body = "";
    res.on("data", (chunk) => {
      body += chunk;
    });
    res.on("end", () => {
      console.log(`HTTP ${res.statusCode}`);
      if (body) console.log(body);
      process.exit(res.statusCode && res.statusCode >= 200 && res.statusCode < 300 ? 0 : 1);
    });
  },
);

req.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

req.write(data);
req.end();
