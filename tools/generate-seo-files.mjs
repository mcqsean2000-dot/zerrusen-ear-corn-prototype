import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const checkOnly = process.argv.includes("--check");
const config = JSON.parse(await readFile("seo-config.json", "utf8"));

assert(/^https:\/\/[a-z0-9.-]+$/i.test(config.siteUrl), "siteUrl must be one canonical HTTPS origin without a trailing slash.");
assert(Array.isArray(config.indexablePages) && config.indexablePages.length, "At least one indexable page is required.");
assert(Array.isArray(config.robotsDisallow), "robotsDisallow must be an array.");

const urls = config.indexablePages.map((page) => {
  assert(page && typeof page.file === "string", "Every indexable page requires a file.");
  assert(/^\/(?:[a-z0-9-]+\/)*$/i.test(page.url), `Indexable URL ${page.url} must be root or a lowercase trailing-slash route.`);
  return config.siteUrl + (page.url === "/" ? "/" : page.url);
});

assert.equal(new Set(urls).size, urls.length, "Indexable URLs must be unique.");
for (const path of config.robotsDisallow) {
  assert(/^\/[A-Za-z0-9._/-]+$/.test(path), `Unsafe robots disallow path: ${path}`);
  assert(!urls.includes(config.siteUrl + path), `Indexable URL cannot also be disallowed: ${path}`);
}

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.flatMap((url) => [
    "  <url>",
    `    <loc>${url}</loc>`,
    "    <changefreq>weekly</changefreq>",
    "    <priority>1.0</priority>",
    "  </url>",
  ]),
  "</urlset>",
  "",
].join("\n");

const robots = [
  "User-agent: *",
  "Allow: /",
  ...config.robotsDisallow.map((path) => `Disallow: ${path}`),
  "",
  `Sitemap: ${config.siteUrl}/sitemap.xml`,
  "",
].join("\n");

async function sync(file, expected) {
  if (!checkOnly) {
    await writeFile(file, expected, "utf8");
    return;
  }
  const current = await readFile(file, "utf8");
  assert.equal(current, expected, `${file} has drifted; run npm run build:seo.`);
}

await sync("sitemap.xml", sitemap);
await sync("robots.txt", robots);
console.log(checkOnly ? "Generated SEO files are current." : "Generated sitemap.xml and robots.txt.");
