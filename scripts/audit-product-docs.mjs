import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const supportedExtensions = new Set([".doc", ".docx", ".pdf"]);

export function collectSourceDocuments(sourceRoot) {
  const documents = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith("~$")) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (!supportedExtensions.has(extension)) continue;
      const bytes = fs.readFileSync(fullPath);
      const stat = fs.statSync(fullPath);
      documents.push({
        path: normalizePath(path.relative(sourceRoot, fullPath)),
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        sha256: crypto.createHash("sha256").update(bytes).digest("hex")
      });
    }
  };
  visit(sourceRoot);
  return documents.sort((a, b) => a.path.localeCompare(b.path, "zh-CN"));
}

export function buildAuditState(currentDocuments, previousManifest, options = {}) {
  const previousByPath = new Map((previousManifest?.documents ?? []).map((item) => [item.path, item]));
  const baseline = Boolean(options.baseline);
  const markExtracted = new Set(options.markExtracted ?? []);
  const documents = currentDocuments.map((current) => {
    const previous = previousByPath.get(current.path);
    const sameContent = previous?.sha256 === current.sha256;
    const canReuseExtraction = previous?.extractedSha256 === current.sha256;
    const extractedSha256 = baseline || markExtracted.has(current.path)
      ? current.sha256
      : canReuseExtraction
        ? current.sha256
        : previous?.extractedSha256 ?? "";
    return {
      ...current,
      modifiedAt: sameContent ? previous.modifiedAt : current.modifiedAt,
      extractedSha256,
      extractionStatus: extractedSha256 === current.sha256 ? "current" : "pending",
      cacheKey: current.sha256.slice(0, 16)
    };
  });
  const currentPaths = new Set(documents.map((item) => item.path));
  const removed = (previousManifest?.documents ?? []).filter((item) => !currentPaths.has(item.path)).map((item) => item.path);
  const pending = documents.filter((item) => item.extractionStatus === "pending");
  return { documents, pending, removed };
}

function parseArgs(argv) {
  const args = {
    source: "docx_2",
    manifest: "docs/product-knowledge/source-manifest.json",
    queue: "work/product-doc-audit/incremental/changed-files.json",
    baseline: false,
    markExtracted: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--baseline") args.baseline = true;
    else if (value === "--source") args.source = argv[++index];
    else if (value === "--manifest") args.manifest = argv[++index];
    else if (value === "--queue") args.queue = argv[++index];
    else if (value === "--mark-extracted") args.markExtracted.push(normalizePath(argv[++index]));
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function runCli() {
  const root = process.cwd();
  const args = parseArgs(process.argv.slice(2));
  const sourceRoot = path.resolve(root, args.source);
  const manifestPath = path.resolve(root, args.manifest);
  const queuePath = path.resolve(root, args.queue);
  const previous = readJson(manifestPath, { documents: [] });
  const current = collectSourceDocuments(sourceRoot);
  const state = buildAuditState(current, previous, args);
  const generatedAt = new Date().toISOString();
  const sourcePriority = ["用户确认口径", "正式规格书与安装手册", "产品白皮书", "解决方案", "营销文案"];
  const manifestChanged =
    JSON.stringify(previous.documents ?? []) !== JSON.stringify(state.documents) ||
    JSON.stringify(previous.sourcePriority ?? []) !== JSON.stringify(sourcePriority) ||
    previous.sourceRoot !== normalizePath(path.relative(root, sourceRoot));
  const nextManifest = {
    schemaVersion: 1,
    generatedAt: manifestChanged ? generatedAt : previous.generatedAt ?? generatedAt,
    sourceRoot: normalizePath(path.relative(root, sourceRoot)),
    sourcePriority,
    documents: state.documents
  };
  if (manifestChanged || !fs.existsSync(manifestPath)) writeJson(manifestPath, nextManifest);
  writeJson(queuePath, {
    schemaVersion: 1,
    generatedAt,
    sourceRoot: normalizePath(path.relative(root, sourceRoot)),
    pendingCount: state.pending.length,
    pending: state.pending.map((item) => ({ path: item.path, sha256: item.sha256, cacheKey: item.cacheKey })),
    removed: state.removed
  });
  console.log(`Product document audit: ${state.documents.length} sources, ${state.pending.length} pending, ${state.removed.length} removed.`);
  if (state.pending.length) console.log(`Extraction queue: ${normalizePath(path.relative(root, queuePath))}`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) runCli();
