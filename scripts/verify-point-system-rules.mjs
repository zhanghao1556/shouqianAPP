import { build } from "esbuild";

const testModule = `
import assert from "node:assert/strict";
import { createInitialProfile } from "./src/features/classroom/data/initialProfile.ts";
import { normalizeProfile } from "./src/features/classroom/lib/profileNormalization.ts";
import { generateEngineeringPoints } from "./src/features/classroom/lib/drawingEngine.ts";
import { generateEngineeringOutputs } from "./src/features/classroom/lib/engineeringRules.ts";
import { getCustomerPointValidationStatus, validatePointPlan } from "./src/features/classroom/lib/pointValidation.ts";
import {
  getBrandExternalAmplifierCount,
  getBrandSystemCapability,
  getRequiredArrayMicCount,
  getShortestManhattanCascadeRoute
} from "./src/features/classroom/lib/systemCapabilities.ts";

function makeProfile({ length = 10, width = 8, height = 3, needs = ["localAmplification"], scope = "full", centralAir = [] } = {}) {
  const base = createInitialProfile();
  return normalizeProfile({
    ...base,
    scenario: "standardClassroom",
    needs,
    amplificationScope: scope,
    roomGeometry: { length, width, height },
    engineeringConstraints: {
      ...base.engineeringConstraints,
      ceiling: "suspended",
      hasCentralAirConditioner: centralAir.length > 0,
      centralAirConditionerCount: centralAir.length,
      centralAirConditionerPoints: centralAir
    }
  });
}

function pointSnapshot(points) {
  return points.map((point) => ({
    id: point.id,
    type: point.type,
    label: point.label,
    x: point.position.x,
    y: point.position.y,
    horizontalAngle: point.horizontalAngle,
    downTiltAngle: point.downTiltAngle
  }));
}

const yinyiRegressionProfiles = [
  makeProfile({ length: 8, width: 6, scope: "podium" }),
  makeProfile({ length: 14, width: 10, needs: ["interactiveClass"], scope: "full" }),
  makeProfile({ length: 20, width: 12, needs: ["videoConference"], scope: "full" }),
  makeProfile({
    length: 13,
    width: 9,
    needs: ["interactiveClass"],
    centralAir: [{ id: "ac-1", label: "中央空调1", position: { x: 4.5, y: 3.2 }, size: { width: 0.8, depth: 0.8 } }]
  })
];
yinyiRegressionProfiles.forEach((profile, index) => {
  const original = generateEngineeringPoints(profile);
  const wrapped = generateEngineeringOutputs(profile, {}, "yinyi").generatedPoints;
  assert.deepEqual(pointSnapshot(wrapped), pointSnapshot(original), "Yinyi point output changed for regression profile " + (index + 1));
});
console.log("PASS Yinyi point count and coordinates remain unchanged");

function getWallSpeakers(profile, count = 4) {
  return generateEngineeringPoints(profile, { speakerProductId: "COLUMN-SPEAKER", speakerCount: count }).filter(
    (point) => point.type === "speaker" && point.label.includes("壁挂音柱")
  );
}

function getMountingAngle(profile, speaker) {
  assert.ok(speaker.target, speaker.id + " is missing its responsibility target");
  const vector = { x: speaker.target.x - speaker.position.x, y: speaker.target.y - speaker.position.y };
  const { width, length } = profile.roomGeometry;
  const distances = [
    ["left", Math.abs(speaker.position.x)],
    ["right", Math.abs(speaker.position.x - width)],
    ["front", Math.abs(speaker.position.y)],
    ["back", Math.abs(speaker.position.y - length)]
  ].sort((left, right) => left[1] - right[1]);
  const side = distances[0][0];
  if (side === "left") return Math.round(90 + Math.atan2(vector.y, vector.x) * 180 / Math.PI);
  if (side === "right") return Math.round(90 - Math.atan2(vector.y, -vector.x) * 180 / Math.PI);
  if (side === "front") return Math.round(90 - Math.atan2(vector.x, vector.y) * 180 / Math.PI);
  return Math.round(90 + Math.atan2(vector.x, -vector.y) * 180 / Math.PI);
}

const edgeCoverageProfile = makeProfile({ length: 6, width: 8.2, scope: "podium" });
const edgeCoveragePoints = generateEngineeringPoints(edgeCoverageProfile, { speakerProductId: "COLUMN-SPEAKER", speakerCount: 4 });
const edgeCoverageSpeakers = edgeCoveragePoints.filter((point) => point.type === "speaker" && point.label.includes("壁挂音柱"));
assert.deepEqual(
  edgeCoverageSpeakers.map((speaker) => speaker.position),
  [{ x: 1.2, y: 0 }, { x: 7, y: 0 }, { x: 1.2, y: 6 }, { x: 7, y: 6 }],
  "responsibility aiming must not move the approved wall-speaker points"
);
assert.deepEqual(edgeCoverageSpeakers.map((speaker) => speaker.horizontalAngle), [42, -42, 73, -73]);
assert.ok(edgeCoverageSpeakers.every((speaker) => speaker.responsibilityEdgeCoverage === undefined));
const edgeCoverageValidation = validatePointPlan({
  profile: edgeCoverageProfile,
  brandId: "yinyi",
  generatedPoints: edgeCoveragePoints,
  requiredArrayMicCount: edgeCoveragePoints.filter((point) => point.type === "arrayMic").length,
  requiredSpeakerCount: 4
});
assert.equal(edgeCoverageValidation.findings.find((finding) => finding.code === "speaker.wall-responsibility-edge"), undefined);

const longPodiumProfile = makeProfile({ length: 18.2, width: 9.1, scope: "podium" });
const longPodiumSideSpeakers = getWallSpeakers(longPodiumProfile).filter(
  (speaker) => speaker.position.x === 0 || speaker.position.x === longPodiumProfile.roomGeometry.width
);
assert.equal(longPodiumSideSpeakers.length, 2);
assert.deepEqual(longPodiumSideSpeakers.map((speaker) => speaker.horizontalAngle), [51, -51]);
assert.ok(longPodiumSideSpeakers.every((speaker) => speaker.target && speaker.target.y > speaker.position.y));

const insufficientWallCoverage = validatePointPlan({
  profile: edgeCoverageProfile,
  brandId: "yinyi",
  generatedPoints: [{
    id: "wall-edge-warning",
    type: "speaker",
    label: "壁挂音箱",
    position: { x: 0, y: 0 },
    responsibilityEdgeCoverage: { covered: 3, total: 5 },
    reason: "测试"
  }],
  requiredArrayMicCount: 0,
  requiredSpeakerCount: 1
});
assert.equal(insufficientWallCoverage.findings.find((finding) => finding.code === "speaker.wall-responsibility-edge")?.severity, "warning");
assert.equal(getCustomerPointValidationStatus(insufficientWallCoverage), undefined);

for (const profile of [
  makeProfile({ length: 6, width: 12, scope: "full" }),
  makeProfile({ length: 12, width: 6, scope: "full" }),
  makeProfile({ length: 10, width: 10, scope: "full" })
]) {
  const speakers = getWallSpeakers(profile);
  assert.equal(speakers.length, 4);
  for (const speaker of speakers) {
    const mountingAngle = getMountingAngle(profile, speaker);
    assert.ok(mountingAngle >= 36 && mountingAngle <= 144, "wall-speaker mounting angle escaped the supported range");
    assert.ok(speaker.responsibilityEdgeCoverage, "full-room wall speaker is missing responsibility coverage data");
  }
}
console.log("PASS original podium aiming and full-room responsibility aiming remain isolated");

const exactRoute = getShortestManhattanCascadeRoute([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }]);
const overRoute = getShortestManhattanCascadeRoute([{ x: 0, y: 0 }, { x: 20.1, y: 0 }, { x: 20.1, y: 20 }]);
assert.equal(exactRoute.lengthM, 40);
assert.equal(overRoute.lengthM, 40.1);
for (const [points, expectedSeverity] of [
  [[{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }], "info"],
  [[{ x: 0, y: 0 }, { x: 20.1, y: 0 }, { x: 20.1, y: 20 }], "hard"]
]) {
  const result = validatePointPlan({
    profile: makeProfile({ length: 25, width: 25 }),
    brandId: "yinyi",
    generatedPoints: points.map((position, index) => ({ id: "route-mic-" + index, type: "arrayMic", label: "阵麦", position, reason: "测试" })),
    requiredArrayMicCount: 3,
    requiredSpeakerCount: 0
  });
  assert.equal(result.findings.find((finding) => finding.code === "array.cascade-route")?.severity, expectedSeverity);
}
console.log("PASS Yinyi Manhattan cascade boundary 40m / 40.1m");

const candidateProfiles = Array.from({ length: 16 }, (_, index) => makeProfile({ length: 6 + index * 2, width: 8, needs: ["interactiveClass"], scope: "full" }));
const profileByNeed = new Map();
for (const profile of candidateProfiles) {
  const required = getRequiredArrayMicCount(profile, "yinman");
  if (!profileByNeed.has(required)) profileByNeed.set(required, profile);
}
const oneMicProfile = profileByNeed.get(1) ?? makeProfile({ length: 6, scope: "podium" });
const twoMicProfile = profileByNeed.get(2);
const threeMicProfile = candidateProfiles.find((profile) => getRequiredArrayMicCount(profile, "yinman") >= 3);
assert.ok(twoMicProfile, "A two-mic theoretical profile was not found");
assert.ok(threeMicProfile, "A three-mic theoretical profile was not found");

for (const [expectedRequired, profile] of [[1, oneMicProfile], [2, twoMicProfile], [3, threeMicProfile]]) {
  const required = getRequiredArrayMicCount(profile, "yinman");
  if (expectedRequired < 3) assert.equal(required, expectedRequired);
  else assert.ok(required >= expectedRequired);
  const outputs = generateEngineeringOutputs(profile, {}, "yinman");
  const generatedMicCount = outputs.generatedPoints.filter((point) => point.type === "arrayMic").length;
  assert.equal(generatedMicCount, Math.min(required, 2));
  const processor = outputs.productSelection.find((item) => item.category === "processor");
  assert.equal(processor?.name, "智能音频处理主机");
  assert.equal(processor?.quantity, 1);
  const directNetworkLines = outputs.connectionLines.filter((line) => line.id.startsWith("array-mic-processor-network-"));
  assert.equal(directNetworkLines.length, generatedMicCount);
  if (required > 2) assert.equal(outputs.pointValidation.status, "hard");
  assert.doesNotMatch(JSON.stringify(outputs), /RING08|AJ350/);
}
console.log("PASS Yinman 1/2/3 theoretical mic demand, two-mic cap and independent network links");

assert.equal(getBrandExternalAmplifierCount(8, "yinman"), 0);
assert.equal(getBrandExternalAmplifierCount(9, "yinman"), 1);
assert.equal(getBrandExternalAmplifierCount(16, "yinman"), 1);
assert.equal(getBrandExternalAmplifierCount(17, "yinman"), 1);

function syntheticPoints(speakerCount) {
  return [
    { id: "mic-1", type: "arrayMic", label: "阵麦", position: { x: 0, y: 0 }, reason: "测试" },
    ...Array.from({ length: Math.min(speakerCount, 16) }, (_, index) => ({
      id: "speaker-" + (index + 1),
      type: "speaker",
      label: "吸顶音箱" + (index + 1),
      position: { x: 4 + (index % 4) * 2, y: 4 + Math.floor(index / 4) * 2 },
      reason: "规则点位"
    }))
  ];
}

for (const speakerCount of [8, 9, 16, 17]) {
  const result = validatePointPlan({
    profile: makeProfile({ length: 12, width: 10 }),
    brandId: "yinman",
    generatedPoints: syntheticPoints(speakerCount),
    requiredArrayMicCount: 1,
    requiredSpeakerCount: speakerCount
  });
  const amplifierFinding = result.findings.find((finding) => finding.code === "speaker.external-amplifier");
  const capacityFinding = result.findings.find((finding) => finding.code === "speaker.system-capacity");
  if (speakerCount <= 8) assert.equal(amplifierFinding, undefined);
  if (speakerCount >= 9 && speakerCount <= 16) assert.equal(amplifierFinding?.severity, "info");
  if (speakerCount === 17) assert.equal(capacityFinding?.severity, "hard");
  assert.equal(getCustomerPointValidationStatus(result), speakerCount === 17 ? "需专项复核" : undefined);
}
console.log("PASS Yinman 8/9/16/17 speaker capacity and amplifier findings");

const lowRoom = makeProfile({ height: 3.4 });
const highRoom = makeProfile({ height: 3.6 });
assert.deepEqual(
  pointSnapshot(generateEngineeringOutputs(lowRoom, {}, "yinyi").generatedPoints).map(({ x, y, type }) => ({ x, y, type })),
  pointSnapshot(generateEngineeringOutputs(highRoom, {}, "yinyi").generatedPoints).map(({ x, y, type }) => ({ x, y, type }))
);
assert.ok(generateEngineeringOutputs(highRoom, {}, "yinyi").pointValidation.findings.some((finding) => finding.code === "array.install-height"));
console.log("PASS high suspended ceiling warns without moving points");

const teacherMonitorResult = validatePointPlan({
  profile: makeProfile(),
  brandId: "yinyi",
  generatedPoints: [
    { id: "mic", type: "arrayMic", label: "阵麦", position: { x: 4, y: 3 }, reason: "测试" },
    { id: "speaker", type: "speaker", label: "吸顶音箱", position: { x: 5.5, y: 3 }, reason: "老师区监听点位" }
  ],
  requiredArrayMicCount: 1,
  requiredSpeakerCount: 1
});
const distanceFinding = teacherMonitorResult.findings.find((finding) => finding.code === "speaker.mic-distance");
assert.equal(distanceFinding?.severity, "info");
assert.match(distanceFinding?.internalMessage ?? "", /老师区监听/);
console.log("PASS approved 1.5m teacher-monitor distance exception");

const centerBackfillResult = validatePointPlan({
  profile: makeProfile({ length: 10, width: 8 }),
  brandId: "yinyi",
  generatedPoints: [
    { id: "mic-front", type: "arrayMic", label: "前阵麦", position: { x: 4, y: 3 }, reason: "测试" },
    { id: "mic-rear", type: "arrayMic", label: "后阵麦", position: { x: 4, y: 6.6 }, reason: "测试" },
    { id: "speaker-center", type: "speaker", label: "中心吸顶音箱", position: { x: 4, y: 4.8 }, reason: "中心回填" }
  ],
  requiredArrayMicCount: 2,
  requiredSpeakerCount: 1
});
const centerDistanceFinding = centerBackfillResult.findings.find((finding) => finding.code === "speaker.mic-distance");
assert.equal(centerDistanceFinding?.severity, "info");
assert.match(centerDistanceFinding?.internalMessage ?? "", /中心列覆盖回填/);
console.log("PASS approved center-column backfill distance exception");

assert.equal(getBrandSystemCapability("yinyi").onlinePickupRadiusM, 8);
assert.equal(getBrandSystemCapability("yinman").onlinePickupRadiusM, 8);
assert.equal(getBrandSystemCapability("yinyi").localAmplificationRadiusM, 5);
assert.equal(getBrandSystemCapability("yinman").localAmplificationRadiusM, 5);
console.log("PASS shared 8m online / 5m local pickup radii");
`;

const result = await build({
  stdin: {
    contents: testModule,
    loader: "ts",
    resolveDir: process.cwd(),
    sourcefile: "point-system-rule-check.ts"
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  write: false,
  logLevel: "silent"
});

const bundledCode = result.outputFiles[0]?.text;
if (!bundledCode) throw new Error("Point-system rule test bundle was empty.");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundledCode).toString("base64")}`;
await import(moduleUrl);
