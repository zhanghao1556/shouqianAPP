import { build } from "esbuild";

const testModule = `
import assert from "node:assert/strict";
import { createInitialProfile } from "./src/features/classroom/data/initialProfile.ts";
import { normalizeProfile } from "./src/features/classroom/lib/profileNormalization.ts";
import { generateEngineeringPoints } from "./src/features/classroom/lib/drawingEngine.ts";
import { generateEngineeringOutputs } from "./src/features/classroom/lib/engineeringRules.ts";
import { getCustomerPointValidationStatus, validatePointPlan } from "./src/features/classroom/lib/pointValidation.ts";
import { getLineArrayDecision, getProcessorCapacity, getTeacherActivityZone } from "./src/features/classroom/lib/lineArrayRules.ts";
import { getSpeakerProductId } from "./src/features/classroom/lib/speakerRules.ts";
import {
  getBrandExternalAmplifierCount,
  getBrandSystemCapability,
  getRequiredArrayMicCount,
  getShortestManhattanCascadeRoute
} from "./src/features/classroom/lib/systemCapabilities.ts";

function makeProfile({ scenario = "standardClassroom", length = 10, width = 8, height = 3, needs = ["localAmplification"], scope = "full", ceiling = "suspended", centralAir = [], microphoneSolution = "existingArray", teachingWidth = width, teachingDepth = 4, stageWidth = width, stageDepth = 3, computer = "", notes = "", podiumPosition = "frontCenter", hasPodium = true, speakerProductOverride = "auto", overheadSpeakerMounting = "unknown" } = {}) {
  const base = createInitialProfile();
  return normalizeProfile({
    ...base,
    scenario,
    needs,
    amplificationScope: scope,
    roomGeometry: { length, width, height },
    existingDevices: { ...base.existingDevices, computer },
    engineeringConstraints: {
      ...base.engineeringConstraints,
      microphoneSolution,
      speakerProductOverride,
      overheadSpeakerMounting,
      teachingAreaSize: { width: teachingWidth, depth: teachingDepth },
      stageSize: { width: stageWidth, depth: stageDepth },
      podiumPosition,
      hasPodium,
      notes,
      ceiling,
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

assert.equal(getTeacherActivityZone(makeProfile({ width: 10 })).width, 5);
assert.equal(getTeacherActivityZone(makeProfile({ width: 12 })).width, 6);
assert.equal(getTeacherActivityZone(makeProfile({ width: 10, podiumPosition: "frontLeft" })).width, 7.5);

const sidePodiumFit = getLineArrayDecision(makeProfile({ length: 8, width: 8, scope: "podium", microphoneSolution: "lineArray", podiumPosition: "frontLeft", computer: "讲台电脑" }));
assert.equal(sidePodiumFit.installation, "podium");
assert.equal(sidePodiumFit.position.x, 1);
assert.equal(sidePodiumFit.position.y, 1.9);
const centeredPodiumWithoutComputer = getLineArrayDecision(makeProfile({ length: 9.9, width: 10.4, scope: "podium", microphoneSolution: "lineArray", podiumPosition: "frontCenter" }));
assert.equal(centeredPodiumWithoutComputer.installation, "podium");
assert.equal(centeredPodiumWithoutComputer.position.y, 1.9);
const sidePodiumTooFar = getLineArrayDecision(makeProfile({ length: 8, width: 10, scope: "podium", microphoneSolution: "lineArray", podiumPosition: "frontLeft", computer: "讲台电脑" }));
assert.equal(sidePodiumTooFar.installation, "hanging");
assert.equal(sidePodiumTooFar.position.x, 3.8);
const centeredAllInOne = getLineArrayDecision(makeProfile({ length: 8, width: 10, scope: "podium", microphoneSolution: "lineArray", computer: "ClassIn 一体机", hasPodium: false }));
assert.equal(centeredAllInOne.installation, "hanging");
assert.equal(centeredAllInOne.position.x, 5);

const oneLineBoundary = generateEngineeringOutputs(makeProfile({ length: 8, width: 14, scope: "podium", microphoneSolution: "auto", podiumPosition: "frontLeft" }), {}, "yinyi");
assert.equal(oneLineBoundary.solutionSelection.microphone.recommended, "lineArray");
assert.equal(oneLineBoundary.generatedPoints.filter((point) => point.pickupKind === "lineArray").length, 1);
const automaticTwoLine = generateEngineeringOutputs(makeProfile({ length: 8, width: 14.2, scope: "podium", microphoneSolution: "auto", podiumPosition: "frontLeft" }), {}, "yinyi");
assert.equal(automaticTwoLine.solutionSelection.microphone.recommended, "existingArray");
assert.equal(automaticTwoLine.generatedPoints.some((point) => point.pickupKind === "lineArray"), false);
const forcedTwoLine = generateEngineeringOutputs(makeProfile({ length: 8, width: 14.2, scope: "podium", microphoneSolution: "lineArray", podiumPosition: "frontLeft" }), {}, "yinyi");
assert.equal(forcedTwoLine.generatedPoints.filter((point) => point.pickupKind === "lineArray").length, 2);
assert.equal(forcedTwoLine.solutionSelection.microphone.isNonRecommended, true);
assert.equal(forcedTwoLine.solutionSelection.drawingBlocked, false);
assert.equal(forcedTwoLine.pointValidation.findings.find((item) => item.code === "selection.line-array-non-recommended")?.severity, "warning");
const overWidth = generateEngineeringOutputs(makeProfile({ length: 8, width: 24.2, scope: "podium", microphoneSolution: "lineArray", podiumPosition: "frontLeft" }), {}, "yinyi");
assert.equal(overWidth.generatedPoints.some((point) => point.pickupKind === "lineArray"), false);
assert.equal(overWidth.generatedPoints.length, 0);
assert.equal(overWidth.connectionLines.length, 0);
assert.equal(overWidth.solutionSelection.drawingBlocked, true);
assert.equal(overWidth.solutionSelection.blockingMessage, "该方案无法完整覆盖，建议改选阵麦");
assert.ok(overWidth.riskItems.includes("该方案无法完整覆盖，建议改选阵麦"));
assert.equal(overWidth.pointValidation.findings.find((item) => item.code === "selection.line-array-coverage")?.severity, "hard");

const smallClassroomFull = generateEngineeringOutputs(makeProfile({ length: 8, width: 8, scope: "full", microphoneSolution: "auto" }), {}, "yinyi");
const smallClassroomLine = smallClassroomFull.generatedPoints.find((point) => point.pickupKind === "lineArray");
assert.equal(smallClassroomFull.solutionSelection.microphone.recommended, "lineArray");
assert.equal(smallClassroomLine?.pickupPattern, "front180");
assert.notEqual(smallClassroomLine?.position.y, 4);
const longClassroomFull = generateEngineeringOutputs(makeProfile({ length: 8.1, width: 8, scope: "full", microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(longClassroomFull.solutionSelection.microphone.recommended, "existingArray");
const interactiveClassroom = generateEngineeringOutputs(makeProfile({ length: 8, width: 8, scope: "full", needs: ["interactiveClass"], microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(interactiveClassroom.solutionSelection.microphone.recommended, "existingArray");

const lectureFit = generateEngineeringOutputs(makeProfile({ scenario: "lectureClassroom", length: 10, width: 10, teachingDepth: 5, microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(lectureFit.solutionSelection.microphone.recommended, "lineArray");
const lectureTooDeep = generateEngineeringOutputs(makeProfile({ scenario: "lectureClassroom", length: 10, width: 10, teachingDepth: 5.1, microphoneSolution: "lineArray" }), {}, "yinyi");
assert.equal(lectureTooDeep.solutionSelection.drawingBlocked, true);
const combinedFit = generateEngineeringOutputs(makeProfile({ scenario: "combinedClassroom", length: 12, width: 12, teachingWidth: 10, teachingDepth: 5, microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(combinedFit.solutionSelection.microphone.recommended, "lineArray");
const combinedTwo = generateEngineeringOutputs(makeProfile({ scenario: "combinedClassroom", length: 12, width: 12, teachingWidth: 10.1, teachingDepth: 5, microphoneSolution: "lineArray" }), {}, "yinyi");
assert.equal(combinedTwo.generatedPoints.filter((point) => point.pickupKind === "lineArray").length, 2);
assert.equal(combinedTwo.solutionSelection.microphone.recommended, "existingArray");

const meetingFiveMeter = generateEngineeringOutputs(makeProfile({ scenario: "meetingRoom", length: 8, width: 6, microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(meetingFiveMeter.solutionSelection.microphone.recommended, "lineArray");
assert.equal(meetingFiveMeter.generatedPoints.find((point) => point.pickupKind === "lineArray")?.installationMode, "tabletop");
const meetingOverFiveMeter = generateEngineeringOutputs(makeProfile({ scenario: "meetingRoom", length: 8.1, width: 6, microphoneSolution: "lineArray" }), {}, "yinyi");
assert.equal(meetingOverFiveMeter.solutionSelection.drawingBlocked, true);
const meetingLeader = generateEngineeringOutputs(makeProfile({ scenario: "meetingRoom", length: 20, width: 10, notes: "主位扩声", microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(meetingLeader.solutionSelection.microphone.recommended, "lineArray");
assert.equal(meetingLeader.generatedPoints.find((point) => point.pickupKind === "lineArray")?.installationMode, "tabletop");

const auditoriumStage = generateEngineeringOutputs(makeProfile({ scenario: "auditorium", length: 20, width: 14, needs: ["recording"], stageWidth: 10, stageDepth: 5, microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(auditoriumStage.solutionSelection.microphone.recommended, "lineArray");
const auditoriumConference = generateEngineeringOutputs(makeProfile({ scenario: "auditorium", length: 20, width: 14, needs: ["videoConference"], stageWidth: 10, stageDepth: 5, microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(auditoriumConference.solutionSelection.microphone.recommended, "existingArray");

const yinmanSingleLine = generateEngineeringOutputs(makeProfile({ length: 8, width: 8, scope: "podium", microphoneSolution: "lineArray" }), {}, "yinman");
const yinyiSingleLine = generateEngineeringOutputs(makeProfile({ length: 8, width: 8, scope: "podium", microphoneSolution: "lineArray" }), {}, "yinyi");
assert.equal(
  yinmanSingleLine.productSelection.find((item) => item.category === "processor")?.name,
  yinyiSingleLine.productSelection.find((item) => item.category === "processor")?.name
);
assert.equal(yinyiSingleLine.productSelection.find((item) => item.category === "processor")?.name, "双麦处理器");
assert.equal(getProcessorCapacity("twoMic"), 2);
assert.equal(getProcessorCapacity("sixMic"), 6);
const yinmanDoubleLine = generateEngineeringOutputs(makeProfile({ scenario: "combinedClassroom", length: 8, width: 14, scope: "podium", microphoneSolution: "lineArray", teachingWidth: 14, teachingDepth: 5 }), {}, "yinman");
assert.equal(yinmanDoubleLine.productSelection.find((item) => item.category === "processor")?.name, "六麦处理器");
assert.equal(yinmanDoubleLine.connectionLines.filter((line) => line.id.startsWith("array-mic-processor-network-")).length, 2);
assert.doesNotMatch(JSON.stringify([yinmanSingleLine, yinmanDoubleLine]), /SA110|AJ200|AJ600|AJ350/);
console.log("PASS line-array recommendation, teacher-zone inference, 8m/10m/15m/5m boundaries, forced two-line handling and model hiding");

const automaticChoice = generateEngineeringOutputs(makeProfile({ length: 8, width: 8, scope: "podium", microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(automaticChoice.solutionSelection.microphone.recommended, "lineArray");
assert.equal(automaticChoice.solutionSelection.microphone.selected, "lineArray");
assert.equal(automaticChoice.solutionSelection.microphone.userSelected, false);
const forcedArrayChoice = generateEngineeringOutputs(makeProfile({ length: 8, width: 8, scope: "podium", microphoneSolution: "existingArray" }), {}, "yinyi");
assert.equal(forcedArrayChoice.solutionSelection.microphone.recommended, "lineArray");
assert.equal(forcedArrayChoice.solutionSelection.microphone.selected, "existingArray");
assert.equal(forcedArrayChoice.solutionSelection.microphone.isNonRecommended, true);

const overheadUnavailableAuto = generateEngineeringOutputs(makeProfile({
  length: 12,
  width: 8,
  scope: "full",
  ceiling: "exposed",
  overheadSpeakerMounting: "unavailable"
}), {}, "yinyi");
assert.equal(overheadUnavailableAuto.solutionSelection.speaker.recommended, "wall");
assert.ok(overheadUnavailableAuto.generatedPoints.filter((point) => point.type === "speaker").every((point) => point.label.includes("壁挂")));
const forcedCeilingUnavailableProfile = makeProfile({
  length: 12,
  width: 8,
  scope: "full",
  ceiling: "exposed",
  speakerProductOverride: "ceiling",
  overheadSpeakerMounting: "unavailable"
});
const forcedCeilingUnavailable = generateEngineeringOutputs(forcedCeilingUnavailableProfile, {}, "yinyi");
assert.equal(forcedCeilingUnavailable.solutionSelection.speaker.selected, "ceiling");
assert.equal(forcedCeilingUnavailable.solutionSelection.speaker.requiresSpecialReview, true);
assert.ok(forcedCeilingUnavailable.generatedPoints.some((point) => point.type === "speaker" && point.label.includes("吸顶")));
assert.equal(forcedCeilingUnavailable.pointValidation.findings.find((item) => item.code === "selection.ceiling-installation")?.severity, "hard");
assert.equal(getCustomerPointValidationStatus(forcedCeilingUnavailable.pointValidation), "需专项复核");
const overheadAvailableExposed = generateEngineeringOutputs(makeProfile({
  length: 12,
  width: 8,
  scope: "full",
  ceiling: "exposed",
  overheadSpeakerMounting: "available"
}), {}, "yinyi");
assert.equal(overheadAvailableExposed.solutionSelection.speaker.recommended, "ceiling");
assert.ok(overheadAvailableExposed.generatedPoints.some((point) => point.type === "speaker" && point.label.includes("吸顶")));
const persistedSelectionProfile = normalizeProfile(JSON.parse(JSON.stringify(forcedCeilingUnavailableProfile)));
assert.equal(persistedSelectionProfile.engineeringConstraints.speakerProductOverride, "ceiling");
assert.equal(persistedSelectionProfile.engineeringConstraints.overheadSpeakerMounting, "unavailable");
assert.equal(persistedSelectionProfile.engineeringConstraints.microphoneSolution, "existingArray");
console.log("PASS automatic and forced choices, ceiling special review, generated ceiling points and selection persistence");

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
  "wall-speaker angle calibration must not move the approved wall-speaker points"
);
assert.deepEqual(edgeCoverageSpeakers.map((speaker) => speaker.horizontalAngle), [24, -24, 63, -63]);
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

const commentedFullRoomProfile = makeProfile({ length: 8.2, width: 6.9, scope: "full" });
const commentedFullRoomSpeakers = getWallSpeakers(commentedFullRoomProfile);
assert.deepEqual(commentedFullRoomSpeakers.map((speaker) => speaker.horizontalAngle), [28, -28, 66, -66]);
assert.ok(commentedFullRoomSpeakers.every((speaker) => speaker.responsibilityEdgeCoverage === undefined));

const wideFrontBackPodiumProfile = makeProfile({ length: 6, width: 9.6, scope: "podium", ceiling: "exposed" });
const wideFrontBackPodiumSpeakers = getWallSpeakers(wideFrontBackPodiumProfile);
assert.deepEqual(wideFrontBackPodiumSpeakers.map((speaker) => speaker.horizontalAngle), [27, -27, 68, -68]);
assert.deepEqual(
  [6, 9.6, 12].map((width) => getWallSpeakers(makeProfile({ length: 6, width, scope: "podium", ceiling: "exposed" }))[0].horizontalAngle),
  [33, 27, 19]
);
assert.deepEqual(
  [6, 8, 10].map((width) => getWallSpeakers(makeProfile({ length: 6, width, scope: "podium", ceiling: "suspended" }))[0].horizontalAngle),
  [33, 25, 14]
);
assert.equal(getSpeakerProductId(makeProfile({ length: 6, width: 12, scope: "podium", ceiling: "exposed" })), "COLUMN-SPEAKER");
assert.equal(getSpeakerProductId(makeProfile({ length: 6, width: 12.1, scope: "podium", ceiling: "exposed" })), "CEILING-SPEAKER");
assert.equal(getSpeakerProductId(makeProfile({ length: 6, width: 10, scope: "podium", ceiling: "suspended" })), "COLUMN-SPEAKER");
assert.equal(getSpeakerProductId(makeProfile({ length: 6, width: 10.1, scope: "podium", ceiling: "suspended" })), "CEILING-SPEAKER");

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
    assert.ok(Number.isFinite(speaker.horizontalAngle), "wall-speaker horizontal angle is missing");
    if (speaker.target) {
      const mountingAngle = getMountingAngle(profile, speaker);
      assert.ok(mountingAngle >= 36 && mountingAngle <= 144, "wall-speaker mounting angle escaped the supported range");
    }
    assert.equal(speaker.responsibilityEdgeCoverage, undefined);
  }
}
console.log("PASS scoped front/back-wall aiming preserves full-room and long-room boundaries");

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
