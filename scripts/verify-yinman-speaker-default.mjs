import { build } from "esbuild";

const testModule = `
import { createInitialProfile } from "./src/features/classroom/data/initialProfile.ts";
import { normalizeProfile } from "./src/features/classroom/lib/profileNormalization.ts";
import { getCustomerSolutionSelection } from "./src/features/classroom/lib/solutionSelection.ts";
import { getSpeakerProductId, getSpeakerSelectionReason, getSpeakerSelectionResult } from "./src/features/classroom/lib/speakerRules.ts";

const base = createInitialProfile();
const profile = normalizeProfile({
  ...base,
  amplificationScope: "full",
  roomGeometry: { ...base.roomGeometry, length: 12, width: 8, height: 3.2 },
  engineeringConstraints: {
    ...base.engineeringConstraints,
    ceiling: "suspended",
    overheadSpeakerMounting: "available",
    speakerProductOverride: "auto"
  }
});

function expect(name, actual, expected) {
  if (actual !== expected) throw new Error(name + ": expected " + expected + ", received " + actual);
  console.log("PASS", name, actual);
}

expect("Yinyi keeps acoustic auto selection", getSpeakerProductId(profile, "yinyi"), "CEILING-SPEAKER");
expect("Yinman auto defaults to wall", getSpeakerProductId(profile, "yinman"), "COLUMN-SPEAKER");
expect("Yinman customer selection recommends wall", getCustomerSolutionSelection(profile, [], "yinman").speaker.recommended, "wall");

const manualCeiling = normalizeProfile({
  ...profile,
  engineeringConstraints: { ...profile.engineeringConstraints, speakerProductOverride: "ceiling" }
});
expect("Yinman manual ceiling remains available", getSpeakerProductId(manualCeiling, "yinman"), "CEILING-SPEAKER");

const legacyAuditorium = normalizeProfile({
  ...profile,
  scenario: "auditorium",
  engineeringConstraints: { ...profile.engineeringConstraints, auditoriumRearFillSpeakers: "present" }
});
expect("Yinman auditorium legacy system remains first", getSpeakerSelectionResult(legacyAuditorium, "yinman"), "NO_NEW_SPEAKER");

if (!getSpeakerSelectionReason(profile, "yinman").includes("默认采用壁挂音箱")) {
  throw new Error("Yinman automatic recommendation reason is missing.");
}
console.log("PASS", "Yinman recommendation reason");
`;

const result = await build({
  stdin: {
    contents: testModule,
    loader: "ts",
    resolveDir: process.cwd(),
    sourcefile: "yinman-speaker-default-check.ts"
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  write: false,
  logLevel: "silent"
});

const bundledCode = result.outputFiles[0]?.text;
if (!bundledCode) throw new Error("Yinman speaker default test bundle was empty.");
await import(`data:text/javascript;base64,${Buffer.from(bundledCode).toString("base64")}`);
