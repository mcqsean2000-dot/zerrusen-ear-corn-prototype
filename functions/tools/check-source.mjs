import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const functionsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(functionsRoot, "src");
const socialOnly = process.argv.includes("--social");

function isSocialFile(filePath) {
  const name = path.basename(filePath);
  return name.startsWith("social-post-") || name.startsWith("meta-graph-");
}

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScriptFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: functionsRoot,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const discoveredFiles = await collectJavaScriptFiles(sourceRoot);
const sourceFiles = socialOnly ? discoveredFiles.filter(isSocialFile) : discoveredFiles;
const testFiles = sourceFiles.filter((filePath) => filePath.endsWith(".test.js"));

if (!sourceFiles.length || !testFiles.length) {
  throw new Error(`No ${socialOnly ? "social " : ""}source and test files were discovered.`);
}

for (const filePath of sourceFiles) {
  runNode(["--check", filePath]);
}

runNode(["--test", ...testFiles]);

console.log(
  `Checked ${sourceFiles.length} JavaScript files and ran ${testFiles.length} test files${socialOnly ? " for social publishing" : ""}.`,
);
