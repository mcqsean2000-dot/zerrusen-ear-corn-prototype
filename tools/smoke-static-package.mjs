import { access, readFile, readdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { createContext, Script } from "node:vm";

const packageDir = process.argv[2] || path.join("dist", "godaddy-static");
const requiredFiles = [
  "index.html",
  "styles.css",
  "order-request.js",
  "checkout-config.js",
  "script.js",
  "robots.txt",
  "sitemap.xml",
];
const requiredAssets = [
  "assets/theos-20lb-bag.jpg",
  "assets/theos-40lb-bag.jpg",
  "assets/theos-both-bags.jpg",
];
const forbiddenPaths = [
  ".env",
  ".firebaserc",
  ".git",
  "admin.css",
  "admin.html",
  "admin.js",
  "docs",
  "firebase.json",
  "firestore.indexes.json",
  "firestore.rules",
  "functions",
  "package.json",
  "README.md",
  "ROADMAP.md",
  "tools",
];
const secretPatterns = [
  /sk_(live|test)_[A-Za-z0-9]/,
  /whsec_[A-Za-z0-9]/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /FIREBASE_PRIVATE_KEY/,
  /STRIPE_SECRET_KEY/,
  /STRIPE_WEBHOOK_SECRET/,
];
const allowedAssetExtensions = new Set([".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const allowedExternalUrlHosts = new Set([
  "checkout.stripe.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "schema.org",
  "theosfarm.com",
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function getRefs(html, attribute) {
  const refs = [];
  const pattern = new RegExp(`${attribute}=["']([^"']+)["']`, "gi");
  let match = pattern.exec(html);

  while (match) {
    refs.push(match[1]);
    match = pattern.exec(html);
  }

  return refs.filter((ref) => !/^(https?:|mailto:|tel:|#)/i.test(ref));
}

function getExternalUrls(contents) {
  return [...contents.matchAll(/https?:\/\/[^\s"'<>),]+/gi)].map((match) => match[0]);
}

function isSafePackageRef(ref) {
  return (
    ref &&
    !path.isAbsolute(ref) &&
    !ref.split(/[?#]/)[0].split(/[\\/]/).includes("..")
  );
}

function normalizePackagePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function isAllowedPackageFile(filePath) {
  const normalized = normalizePackagePath(filePath);

  if (requiredFiles.includes(normalized)) {
    return true;
  }

  return normalized.startsWith("assets/") && allowedAssetExtensions.has(path.extname(normalized).toLowerCase());
}

function isAllowedExternalUrl(rawUrl) {
  try {
    return allowedExternalUrlHosts.has(new URL(rawUrl).hostname);
  } catch (error) {
    return false;
  }
}

function shouldScanExternalUrls(filePath) {
  return [".css", ".html", ".js", ".svg"].includes(path.extname(filePath).toLowerCase());
}

async function collectPackageFiles(directory = packageDir, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    assert(!entry.name.startsWith("."), `Packaged output contains dotfile or dot directory ${entry.name}.`);

    const entryPath = path.join(directory, entry.name);
    const packagePath = path.join(prefix, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectPackageFiles(entryPath, packagePath));
      continue;
    }

    assert(entry.isFile(), `${normalizePackagePath(packagePath)} is not a regular package file.`);
    files.push(packagePath);
  }

  return files;
}

async function assertPackageShape() {
  const output = await stat(packageDir);
  assert(output.isDirectory(), `${packageDir} must exist. Run npm run package:static first.`);
  const packageFiles = await collectPackageFiles();

  for (const file of [...requiredFiles, ...requiredAssets]) {
    assert(await exists(path.join(packageDir, file)), `Packaged output is missing ${file}.`);
  }

  for (const file of packageFiles) {
    assert(isAllowedPackageFile(file), `Unexpected file in static deploy package: ${normalizePackagePath(file)}`);
  }

  for (const forbiddenPath of forbiddenPaths) {
    assert(
      !(await exists(path.join(packageDir, forbiddenPath))),
      `${forbiddenPath} must not be included in the static deploy package.`,
    );
  }
}

async function assertDeploySafeConfig() {
  const checkoutConfig = await readFile(path.join(packageDir, "checkout-config.js"), "utf8");
  const sandbox = {};
  new Script(checkoutConfig, { filename: "dist/godaddy-static/checkout-config.js" }).runInContext(
    createContext(sandbox),
  );

  assert(
    sandbox.TheosCheckoutConfig?.checkoutEndpoint === "/api/checkout-sessions",
    "Packaged checkout-config.js must use the trusted Firebase Functions checkout route.",
  );
}

async function assertNoSecretsInPackage() {
  for (const file of await collectPackageFiles()) {
    const contents = await readFile(path.join(packageDir, file), "utf8");
    for (const pattern of secretPatterns) {
      assert(!pattern.test(contents), `${normalizePackagePath(file)} contains a secret-looking value.`);
    }

    if (shouldScanExternalUrls(file)) {
      for (const url of getExternalUrls(contents)) {
        assert(
          isAllowedExternalUrl(url),
          `${normalizePackagePath(file)} contains an unapproved external URL: ${url}`,
        );
      }
    }
  }
}

async function assertIndexReferences() {
  const html = await readFile(path.join(packageDir, "index.html"), "utf8");
  const refs = [...getRefs(html, "src"), ...getRefs(html, "href")];
  const externalRefs = [
    ...[...html.matchAll(/src=["'](https?:\/\/[^"']+)["']/gi)].map((match) => match[1]),
    ...[...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)].map((match) => match[1]),
  ];

  assert(html.includes("Theo's Farm"), "Packaged index.html should contain Theo's Farm branding.");
  assert(html.includes("Farm to Feeder"), "Packaged index.html should contain Farm to Feeder messaging.");
  assert(
    html.indexOf("order-request.js") < html.indexOf("checkout-config.js") &&
      html.indexOf("checkout-config.js") < html.indexOf("script.js"),
    "Packaged scripts must load order-request.js, checkout-config.js, then script.js.",
  );

  for (const ref of refs) {
    assert(isSafePackageRef(ref), `index.html contains an unsafe package reference: ${ref}`);
    assert(await exists(path.join(packageDir, ref.split(/[?#]/)[0])), `index.html references missing file ${ref}.`);
  }

  for (const ref of externalRefs) {
    assert(isAllowedExternalUrl(ref), `index.html references an unapproved external URL: ${ref}`);
  }
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".css": "text/css",
    ".html": "text/html",
    ".jpg": "image/jpeg",
    ".js": "text/javascript",
    ".png": "image/png",
    ".txt": "text/plain",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".xml": "application/xml",
  }[extension] || "application/octet-stream";
}

async function createStaticServer(rootDir) {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      const pathname = decodeURIComponent(requestUrl.pathname);
      const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      assert(isSafePackageRef(relativePath), "Unsafe request path.");

      const filePath = path.join(rootDir, relativePath);
      const contents = await readFile(filePath);
      response.writeHead(200, { "content-type": contentTypeFor(filePath) });
      response.end(contents);
    } catch (error) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("Not found");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  return server;
}

async function fetchOk(url) {
  const response = await fetch(url);
  assert(response.ok, `Expected ${url} to return HTTP 200, got ${response.status}.`);
  return response;
}

async function assertLocalServerSmoke() {
  const server = await createStaticServer(packageDir);

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const indexResponse = await fetchOk(`${baseUrl}/`);
    const html = await indexResponse.text();
    const refs = [...getRefs(html, "src"), ...getRefs(html, "href")].filter(isSafePackageRef);

    assert(html.includes("checkout-config.js"), "Local server smoke did not return packaged index.html.");

    for (const ref of refs) {
      await fetchOk(`${baseUrl}/${ref.split(/[?#]/)[0]}`);
    }

    for (const forbiddenPath of forbiddenPaths) {
      const response = await fetch(`${baseUrl}/${forbiddenPath}`);
      assert(response.status === 404, `Local static server exposed forbidden path ${forbiddenPath}.`);
    }
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function main() {
  await assertPackageShape();
  await assertDeploySafeConfig();
  await assertNoSecretsInPackage();
  await assertIndexReferences();
  await assertLocalServerSmoke();

  console.log(`Static package smoke check passed for ${packageDir}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
