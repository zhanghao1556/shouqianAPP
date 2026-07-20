import fs from "node:fs";
import path from "node:path";

const semverPattern = /^(\d+)\.(\d+)\.(\d+)$/;

export function readPackageVersion(root = process.cwd()) {
  const packagePath = path.join(root, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  parsePackageVersion(packageJson.version);
  return packageJson.version;
}

export function getReleaseVersion(root = process.cwd()) {
  return toReleaseVersion(readPackageVersion(root));
}

export function toReleaseVersion(packageVersion) {
  const { major, minor, patch } = parsePackageVersion(packageVersion);
  return patch === 0 ? `${major}.${minor}` : `${major}.${minor}.${patch}`;
}

export function incrementPackageVersion(packageVersion, bumpType = "minor") {
  const { major, minor, patch } = parsePackageVersion(packageVersion);
  if (bumpType === "major") return `${major + 1}.0.0`;
  if (bumpType === "minor") return `${major}.${minor + 1}.0`;
  if (bumpType === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unsupported release bump type: ${bumpType}`);
}

export function writePackageVersion(root, nextVersion) {
  parsePackageVersion(nextVersion);
  const packagePath = path.join(root, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  packageJson.version = nextVersion;
  writeJsonPreservingFormat(packagePath, packageJson);

  const lockPath = path.join(root, "package-lock.json");
  if (!fs.existsSync(lockPath)) return;
  const lockJson = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  lockJson.version = nextVersion;
  if (lockJson.packages?.[""]) lockJson.packages[""].version = nextVersion;
  writeJsonPreservingFormat(lockPath, lockJson);
}

function parsePackageVersion(value) {
  const match = String(value ?? "").match(semverPattern);
  if (!match) {
    throw new Error(`package.json version must use major.minor.patch: ${value}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function writeJsonPreservingFormat(filePath, value) {
  const current = fs.readFileSync(filePath, "utf8");
  const eol = current.includes("\r\n") ? "\r\n" : "\n";
  const indent = current.match(/\r?\n([ \t]+)"/)?.[1] ?? "  ";
  const serialized = `${JSON.stringify(value, null, indent)}\n`.replaceAll("\n", eol);
  fs.writeFileSync(filePath, serialized, "utf8");
}
