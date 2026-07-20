import fs from "node:fs";
import path from "node:path";
import {
  incrementPackageVersion,
  readPackageVersion,
  toReleaseVersion,
  writePackageVersion
} from "./release-version.mjs";

const root = process.cwd();
const outputsDir = path.join(root, "outputs");
const args = new Set(process.argv.slice(2));
const requestedBrand = getArgValue("--brand") || "all";
const bumpType = getArgValue("--bump") || process.env.RELEASE_BUMP || "minor";
const dryRun = args.has("--dry-run");
const forceBump = args.has("--force-bump");
const brands = [
  { id: "yinyi", appName: "音翼AI售前工具" },
  { id: "yinman", appName: "音曼AI售前工具" }
];
const selectedBrands = requestedBrand === "all"
  ? brands
  : brands.filter((brand) => brand.id === requestedBrand);

if (!selectedBrands.length) throw new Error(`Unsupported release brand: ${requestedBrand}`);
if (!["major", "minor", "patch"].includes(bumpType)) {
  throw new Error(`Unsupported release bump type: ${bumpType}`);
}

const currentPackageVersion = readPackageVersion(root);
const currentReleaseVersion = toReleaseVersion(currentPackageVersion);
const publicationState = Object.fromEntries(
  selectedBrands.map((brand) => [
    brand.id,
    hasPublishedRelease(brand.appName, currentReleaseVersion)
  ])
);
const currentVersionIsPublished = Object.values(publicationState).every(Boolean);
const shouldBump = forceBump || currentVersionIsPublished;
const nextPackageVersion = shouldBump
  ? incrementPackageVersion(currentPackageVersion, bumpType)
  : currentPackageVersion;
const nextReleaseVersion = toReleaseVersion(nextPackageVersion);

if (!dryRun && nextPackageVersion !== currentPackageVersion) {
  writePackageVersion(root, nextPackageVersion);
}

console.log(JSON.stringify({
  requestedBrand,
  bumpType,
  dryRun,
  forceBump,
  publicationState,
  action: shouldBump ? "bump" : "reuse",
  previousPackageVersion: currentPackageVersion,
  packageVersion: nextPackageVersion,
  releaseVersion: nextReleaseVersion
}, null, 2));

function hasPublishedRelease(appName, releaseVersion) {
  if (!fs.existsSync(outputsDir)) return false;
  const pattern = new RegExp(
    `^${escapeRegExp(appName)}-${escapeRegExp(releaseVersion)}-\\d{6}-\\d+$`
  );
  return fs.readdirSync(outputsDir, { withFileTypes: true })
    .some((entry) => {
      if (!entry.isDirectory() || !pattern.test(entry.name)) return false;
      const releaseDir = path.join(outputsDir, entry.name);
      return fs.existsSync(path.join(releaseDir, `${appName}-${releaseVersion}.html`))
        && fs.existsSync(path.join(outputsDir, `${entry.name}.zip`));
    });
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
