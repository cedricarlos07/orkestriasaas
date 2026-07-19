import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SECTORS, PLATFORMS, CITIES, SITE_URL } from "@/lib/seo-data";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date().toISOString().slice(0, 10);
        const staticPaths = [
          { p: "/", pr: "1.0", cf: "weekly" },
          { p: "/secteurs", pr: "0.9", cf: "weekly" },
          { p: "/plateformes", pr: "0.9", cf: "weekly" },
          { p: "/contact", pr: "0.7", cf: "monthly" },
          { p: "/privacy", pr: "0.3", cf: "yearly" },
          { p: "/terms", pr: "0.3", cf: "yearly" },
          { p: "/cookies", pr: "0.3", cf: "yearly" },
        ];
        const urls: string[] = [];
        for (const s of staticPaths) {
          urls.push(`<url><loc>${SITE_URL}${s.p}</loc><lastmod>${now}</lastmod><changefreq>${s.cf}</changefreq><priority>${s.pr}</priority></url>`);
        }
        for (const s of SECTORS) {
          urls.push(`<url><loc>${SITE_URL}/secteurs/${s.slug}</loc><lastmod>${now}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`);
        }
        for (const p of PLATFORMS) {
          urls.push(`<url><loc>${SITE_URL}/plateformes/${p.slug}</loc><lastmod>${now}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`);
        }
        for (const s of SECTORS) {
          for (const c of CITIES) {
            urls.push(`<url><loc>${SITE_URL}/publicite/${s.slug}/${c.slug}</loc><lastmod>${now}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`);
          }
        }
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
