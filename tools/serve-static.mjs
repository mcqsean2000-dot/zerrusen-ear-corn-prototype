import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultPort = 4173;
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".xml", "application/xml; charset=utf-8"],
]);

function optionValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function rootDirectory() {
  const resolvedRoot = path.resolve(repoRoot, optionValue("--root", "."));
  const allowedRoots = new Set([
    repoRoot,
    path.resolve(repoRoot, "dist", "godaddy-static"),
  ]);
  if (!allowedRoots.has(resolvedRoot)) {
    throw new Error("--root must be either the repo root or dist/godaddy-static.");
  }
  return resolvedRoot;
}

function portNumber() {
  const raw = optionValue("--port", String(defaultPort));
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid --port value: ${raw}`);
  }
  return port;
}

function filePathForRequest(root, requestUrl = "/") {
  const url = new URL(requestUrl, "http://localhost");
  const decodedPath = decodeURIComponent(url.pathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const resolvedPath = path.resolve(root, relativePath);

  if (resolvedPath !== root && !resolvedPath.startsWith(root + path.sep)) {
    return null;
  }

  return resolvedPath;
}

async function existingFile(root, requestUrl) {
  const requestedPath = filePathForRequest(root, requestUrl);
  if (!requestedPath) return null;

  try {
    const details = await stat(requestedPath);
    if (details.isDirectory()) {
      const indexPath = path.join(requestedPath, "index.html");
      await access(indexPath);
      return indexPath;
    }
    if (details.isFile()) return requestedPath;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (path.extname(requestedPath)) return null;
  return path.join(root, "index.html");
}

function sendNotFound(response) {
  response.writeHead(404, {
    "content-type": "text/plain; charset=utf-8",
  });
  response.end("Not found");
}

async function main() {
  const root = rootDirectory();
  const port = portNumber();
  await access(path.join(root, "index.html"));

  const server = createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" });
      response.end();
      return;
    }

    try {
      const filePath = await existingFile(root, request.url);
      if (!filePath) {
        sendNotFound(response);
        return;
      }

      response.writeHead(200, {
        "cache-control": "no-cache",
        "content-type": mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
      });

      if (request.method === "HEAD") {
        response.end();
        return;
      }

      createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(500, {
        "content-type": "text/plain; charset=utf-8",
      });
      response.end("Local preview failed.");
    }
  });

  server.listen(port, () => {
    console.log(`Theo's Farm local preview: http://localhost:${port}/`);
    console.log(`Serving: ${root}`);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
