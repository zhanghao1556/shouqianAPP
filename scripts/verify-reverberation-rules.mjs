import { build } from "esbuild";

const testModule = `
import { createInitialProfile } from "./src/features/classroom/data/initialProfile.ts";
import { normalizeProfile } from "./src/features/classroom/lib/profileNormalization.ts";
import { getAcousticAssessment } from "./src/features/classroom/lib/reverberationRules.ts";
import { hasHighCeilingReverberationRisk } from "./src/features/classroom/lib/speakerRules.ts";

const completeAcoustic = {
  floorMaterial: "carpet",
  wallMaterial: "acoustic",
  softTreatment: "acousticPanels",
  furnishingDensity: "normal",
  hasGlassWall: false,
  ceilingAcousticTreatment: "acoustic",
  glassCoverage: "none",
  echoObservation: "none"
};

function makeProfile({ scenario = "standardClassroom", needs = ["localAmplification"], room = {}, ceiling = "suspended", acoustic = {}, centralAir = false } = {}) {
  const base = createInitialProfile();
  return normalizeProfile({
    ...base,
    scenario,
    needs,
    roomGeometry: { ...base.roomGeometry, length: 8, width: 6, height: 3, ...room },
    engineeringConstraints: {
      ...base.engineeringConstraints,
      ceiling,
      hasCentralAirConditioner: centralAir,
      centralAirConditionerCount: centralAir ? 1 : 0
    },
    acousticEnvironment: { ...base.acousticEnvironment, ...completeAcoustic, ...acoustic }
  });
}

function expectRisk(name, profile, expected) {
  const assessment = getAcousticAssessment(profile);
  if (assessment.risk !== expected) {
    throw new Error(name + ": expected " + expected + ", received " + assessment.risk + " (RT60 " + assessment.estimatedRt + "s)");
  }
  console.log("PASS", name, assessment.risk, assessment.estimatedRt + "s");
}

expectRisk("meeting target boundary", makeProfile({ scenario: "meetingRoom", needs: ["videoConference"], acoustic: { measuredRt60: 0.6 } }), "low");
expectRisk("meeting medium boundary", makeProfile({ scenario: "meetingRoom", needs: ["videoConference"], acoustic: { measuredRt60: 0.8 } }), "medium");
expectRisk("meeting above boundary", makeProfile({ scenario: "meetingRoom", needs: ["videoConference"], acoustic: { measuredRt60: 0.81 } }), "high");
expectRisk("measured RT60 overrides hard surfaces", makeProfile({ scenario: "meetingRoom", needs: ["videoConference"], acoustic: { ...completeAcoustic, floorMaterial: "tile", wallMaterial: "hard", softTreatment: "none", ceilingAcousticTreatment: "hard", glassCoverage: "large", hasGlassWall: true, measuredRt60: 0.5 } }), "low");
expectRisk("audible tail is at least medium", makeProfile({ acoustic: { echoObservation: "tail" } }), "medium");
expectRisk("obvious echo forces high", makeProfile({ acoustic: { measuredRt60: 0.4, echoObservation: "obvious" } }), "high");
expectRisk("missing critical data cannot be low", makeProfile({ acoustic: { floorMaterial: "unknown", wallMaterial: "unknown", softTreatment: "unknown", furnishingDensity: "unknown", ceilingAcousticTreatment: "unknown", glassCoverage: "unknown", echoObservation: "unknown" } }), "medium");
expectRisk("missing room volume cannot be low", makeProfile({ room: { length: 0, width: 0, height: 0 }, acoustic: { measuredRt60: 0.4 } }), "medium");

const tallAbsorptiveRoom = makeProfile({ room: { height: 4.2 } });
expectRisk("four-meter absorptive room is not forced high", tallAbsorptiveRoom, "low");
const noGlassRt = getAcousticAssessment(makeProfile({ acoustic: { glassCoverage: "none" } })).estimatedRt;
const littleGlassRt = getAcousticAssessment(makeProfile({ acoustic: { glassCoverage: "partial" } })).estimatedRt;
if (noGlassRt !== littleGlassRt) throw new Error("merged basic/no glass option must use one acoustic range");
console.log("PASS", "basic/no glass and little glass share one acoustic range");
if (!hasHighCeilingReverberationRisk(tallAbsorptiveRoom)) {
  throw new Error("speaker-specific high-ceiling selector changed unexpectedly");
}
console.log("PASS", "speaker-specific high-ceiling selector remains active");

const quietProfile = makeProfile({ centralAir: false });
const hvacProfile = makeProfile({ centralAir: true });
const quietRisk = getAcousticAssessment(quietProfile).risk;
const hvacRisk = getAcousticAssessment(hvacProfile).risk;
if (quietRisk !== hvacRisk) throw new Error("HVAC presence changed reverberation risk");
console.log("PASS", "HVAC remains outside reverberation classification");
`;

const result = await build({
  stdin: {
    contents: testModule,
    loader: "ts",
    resolveDir: process.cwd(),
    sourcefile: "reverberation-rule-check.ts"
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  write: false,
  logLevel: "silent"
});

const bundledCode = result.outputFiles[0]?.text;
if (!bundledCode) throw new Error("Reverberation rule test bundle was empty.");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundledCode).toString("base64")}`;
await import(moduleUrl);
