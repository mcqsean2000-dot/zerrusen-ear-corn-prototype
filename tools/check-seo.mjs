import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile("seo-config.json", "utf8"));
const robots = await readFile("robots.txt", "utf8");
const sitemap = await readFile("sitemap.xml", "utf8");

function matches(html, pattern) {
  return Array.from(html.matchAll(pattern));
}

function singleContent(html, pattern, label) {
  const found = matches(html, pattern);
  assert.equal(found.length, 1, `${label} must appear exactly once.`);
  return String(found[0][1] || "").trim();
}

function canonicalFor(url) {
  return config.siteUrl + (url === "/" ? "/" : url);
}

function normalizeInternalHref(href, currentUrl) {
  if (!href || /^(?:https?:|mailto:|tel:|javascript:)/i.test(href)) return null;
  if (href.startsWith("#")) return currentUrl + href;
  const parsed = new URL(href, canonicalFor(currentUrl));
  if (parsed.origin !== config.siteUrl) return null;
  return parsed.pathname + parsed.hash;
}

function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function allJsonLd(html, file) {
  return matches(html, /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
    .map((entry) => {
      try {
        return JSON.parse(entry[1]);
      } catch (error) {
        assert.fail(`${file} contains invalid JSON-LD.`);
      }
    });
}

function collectProducts(value, products = []) {
  if (!value || typeof value !== "object") return products;
  if (value["@type"] === "Product") products.push(value);
  Object.values(value).forEach((child) => {
    if (child && typeof child === "object") collectProducts(child, products);
  });
  return products;
}

const titles = new Map();
const descriptions = new Map();
const pageHtml = new Map();
const inbound = new Map(config.indexablePages.map((page) => [page.url, new Set()]));

for (const page of config.indexablePages) {
  const html = await readFile(page.file, "utf8");
  pageHtml.set(page.url, html);

  assert(/<html\b[^>]*lang=["']en["']/i.test(html), `${page.file} must declare lang="en".`);
  const title = singleContent(html, /<title>([^<]+)<\/title>/gi, `${page.file} title`);
  const description = singleContent(
    html,
    /<meta\b[^>]*name="description"[^>]*content="([^"]+)"[^>]*>/gi,
    `${page.file} meta description`,
  );
  const canonical = singleContent(
    html,
    /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
    `${page.file} canonical`,
  );

  assert(title.length >= 20 && title.length <= 65, `${page.file} title must be 20–65 characters.`);
  assert(description.length >= 70 && description.length <= 170, `${page.file} description must be 70–170 characters.`);
  assert.equal(canonical, canonicalFor(page.url), `${page.file} canonical must match its configured URL.`);
  assert.equal(matches(html, /<h1\b[^>]*>/gi).length, 1, `${page.file} must contain exactly one h1.`);
  assert(!/<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html), `${page.file} must remain indexable.`);

  assert(!titles.has(title), `${page.file} duplicates the title in ${titles.get(title)}.`);
  assert(!descriptions.has(description), `${page.file} duplicates the description in ${descriptions.get(description)}.`);
  titles.set(title, page.file);
  descriptions.set(description, page.file);

  for (const image of matches(html, /<img\b([^>]*)>/gi)) {
    const alt = image[1].match(/\balt=["']([^"']*)["']/i);
    assert(alt && alt[1].trim(), `${page.file} contains an image without useful alt text.`);
  }

  const ids = new Set(matches(html, /\bid=["']([^"']+)["']/gi).map((entry) => entry[1]));
  for (const link of matches(html, /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = normalizeInternalHref(link[1], page.url);
    if (!href) continue;
    const [path, fragment] = href.split("#");
    if (fragment && path === page.url) {
      assert(ids.has(fragment), `${page.file} links to missing fragment #${fragment}.`);
    }
    if (inbound.has(path) && path !== page.url) inbound.get(path).add(page.url);
  }

  const jsonLd = allJsonLd(html, page.file);
  assert(jsonLd.length > 0, `${page.file} must contain valid JSON-LD.`);

  if (page.url === "/") {
    const products = jsonLd.flatMap((entry) => collectProducts(entry));
    const visible = visibleText(html);
    const buttons = matches(
      html,
      /data-sku=["']([^"']+)["'][^>]*data-name=["']([^"']+)["'][^>]*data-price-cents=["'](\d+)["']/gi,
    );
    assert.equal(products.length, buttons.length, "Structured Product count must match visible purchasable products.");
    for (const product of products) {
      const button = buttons.find((entry) => entry[1] === product.sku);
      assert(button, `Structured Product ${product.sku} must match a visible product SKU.`);
      assert.equal(product.name, button[2], `Structured Product ${product.sku} name must match visible product data.`);
      assert.equal(Number(product.offers?.price), Number(button[3]) / 100, `Structured Product ${product.sku} price must match visible product data.`);
      assert.equal(product.offers?.priceCurrency, "USD", `Structured Product ${product.sku} must use USD.`);
      assert.equal(product.offers?.availability, "https://schema.org/InStock", `Structured Product ${product.sku} availability must match the storefront.`);
      assert(product.image?.startsWith(`${config.siteUrl}/assets/`), `Structured Product ${product.sku} must use a first-party image.`);
      assert(visible.includes(product.name), `Structured Product ${product.sku} name must be visible.`);
    }
  }
}

for (const page of config.privatePages) {
  const html = await readFile(page.file, "utf8");
  assert(
    /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex[^"]*"[^>]*>/i.test(html),
    `${page.file} must declare noindex.`,
  );
  assert(robots.includes(`Disallow: ${page.url}`), `robots.txt must disallow ${page.url}.`);
}

for (const page of config.indexablePages) {
  if (!page.orphanExempt) {
    assert(inbound.get(page.url).size > 0, `${page.file} has no inbound link from another indexable page.`);
  }
}

const sitemapUrls = matches(sitemap, /<loc>([^<]+)<\/loc>/gi).map((entry) => entry[1].trim()).sort();
const configuredUrls = config.indexablePages.map((page) => canonicalFor(page.url)).sort();
assert.deepEqual(sitemapUrls, configuredUrls, "Sitemap URLs must exactly match configured indexable pages.");
assert(robots.includes(`Sitemap: ${config.siteUrl}/sitemap.xml`), "robots.txt must declare the canonical sitemap.");
assert(!sitemapUrls.some((url) => /admin|checkout|staging|preview|localhost/i.test(url)), "Sitemap must exclude private and non-production URLs.");

console.log(`Technical SEO audit passed for ${config.indexablePages.length} indexable and ${config.privatePages.length} private page(s).`);
