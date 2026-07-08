import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createContext, Script } from "node:vm";

const defaultOutputDir = path.join("dist", "godaddy-static");
const storefrontFiles = [
  "index.html",
  "styles.css",
  "order-request.js",
  "checkout-config.js",
  "script.js",
  "robots.txt",
  "sitemap.xml",
];
const assetDir = "assets";
const allowedAssetExtensions = new Set([".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const disallowedOutputPaths = [
  ".env",
  ".firebaserc",
  ".firebaserc.example",
  ".firebase",
  ".git",
  "admin.css",
  "admin-config.js",
  "admin.html",
  "admin.js",
  "admin-live.js",
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

function isCheckOnly() {
  return process.argv.includes("--check");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function mustExist(filePath) {
  await access(filePath);
}

async function assertCheckoutConfigIsBlank() {
  const checkoutConfig = await readFile("checkout-config.js", "utf8");
  const sandbox = {};
  new Script(checkoutConfig, { filename: "checkout-config.js" }).runInContext(createContext(sandbox));

  assert(
    sandbox.TheosCheckoutConfig?.checkoutEndpoint === "",
    "checkout-config.js must stay blank until a trusted backend checkout URL exists.",
  );
}

async function assertNoSecretsInPublicSources() {
  for (const file of storefrontFiles) {
    const contents = await readFile(file, "utf8");
    for (const pattern of secretPatterns) {
      assert(!pattern.test(contents), `${file} contains a secret-looking value and must not be packaged.`);
    }
  }
}

async function collectPublicAssets(directory = assetDir) {
  const entries = await readdir(directory, { withFileTypes: true });
  const assets = [];

  for (const entry of entries) {
    assert(!entry.name.startsWith("."), `${directory} contains a dotfile and must not be packaged.`);

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      assets.push(...await collectPublicAssets(entryPath));
      continue;
    }

    assert(entry.isFile(), `${entryPath} is not a regular file and must not be packaged.`);
    assert(
      allowedAssetExtensions.has(path.extname(entry.name).toLowerCase()),
      `${entryPath} is not an approved public image asset type.`,
    );
    assets.push(entryPath);
  }

  return assets;
}

async function copyStaticPackage(outputDir) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  for (const file of storefrontFiles) {
    await cp(file, path.join(outputDir, file));
  }

  for (const asset of await collectPublicAssets()) {
    await mkdir(path.dirname(path.join(outputDir, asset)), { recursive: true });
    await cp(asset, path.join(outputDir, asset));
  }
}

async function assertPackageOutputSafe(outputDir) {
  for (const file of storefrontFiles) {
    await mustExist(path.join(outputDir, file));
  }

  const assets = await stat(path.join(outputDir, assetDir));
  assert(assets.isDirectory(), "Packaged output must include the assets directory.");

  for (const unsafePath of disallowedOutputPaths) {
    try {
      await access(path.join(outputDir, unsafePath));
      throw new Error(`${unsafePath} must not be included in the static deploy package.`);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

async function main() {
  for (const file of storefrontFiles) {
    await mustExist(file);
  }
  await mustExist(assetDir);
  await assertCheckoutConfigIsBlank();
  await assertNoSecretsInPublicSources();
  await collectPublicAssets();

  if (isCheckOnly()) {
    const tempDir = await mkdtemp(path.join(tmpdir(), "theos-static-package-"));
    try {
      const checkOutputDir = path.join(tempDir, "godaddy-static");
      await copyStaticPackage(checkOutputDir);
      await assertPackageOutputSafe(checkOutputDir);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
    console.log("Static deploy package check passed.");
    return;
  }

  await copyStaticPackage(defaultOutputDir);
  await assertPackageOutputSafe(defaultOutputDir);

  console.log(`Static deploy package written to ${defaultOutputDir}`);
  console.log("Upload the contents of that folder to the approved static host.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
