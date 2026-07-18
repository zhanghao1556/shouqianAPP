import { build } from "esbuild";

const testModule = `
import assert from "node:assert/strict";
import { createInitialProfile } from "./src/features/classroom/data/initialProfile.ts";
import { normalizeProfile } from "./src/features/classroom/lib/profileNormalization.ts";
import { generateEngineeringPoints } from "./src/features/classroom/lib/drawingEngine.ts";
import { generateEngineeringOutputs, getCompleteness } from "./src/features/classroom/lib/engineeringRules.ts";
import { getCustomerPointValidationStatus, validatePointPlan } from "./src/features/classroom/lib/pointValidation.ts";
import { getLineArrayDecision, getLineArrayHangingFrontDistance, getProcessorCapacity, getProcessorTiersForBrand, getProcessorTiersForSelection, getTeacherActivityZone, LINE_ARRAY_LOCAL_RADIUS_M, LINE_ARRAY_ONLINE_RADIUS_M, LINE_ARRAY_PRODUCT_ID, YINMAN_LARGE_ARRAY_PROCESSOR_TIER } from "./src/features/classroom/lib/lineArrayRules.ts";
import { getMeetingFurnitureEndClearance, getMeetingFurnitureLayout } from "./src/features/classroom/lib/meetingFurnitureRules.ts";
import { getSpeakerProductId } from "./src/features/classroom/lib/speakerRules.ts";
import { getCustomerVisibleConnectionLines, getCustomerVisiblePoints } from "./src/features/classroom/lib/customerOutput.ts";
import { buildReport } from "./src/features/classroom/lib/reportBuilder.ts";
import { getTopologyLayoutSnapshot } from "./src/features/classroom/components/DrawingCanvas.tsx";
import { HANGING_MIC_PRODUCT_ID, HANGING_MIC_RADIUS_M } from "./src/features/classroom/lib/hangingMicRules.ts";
import {
  SMALL_DISC_01_PRODUCT_ID,
  SMALL_DISC_02_PRODUCT_ID,
  SMALL_DISC_03_PRODUCT_ID,
  SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID,
  SMALL_DISC_LINK_SEGMENT_LIMIT_M,
  SMALL_DISC_MAIN_NAME,
  SMALL_DISC_RECORDING_NAME,
  SMALL_DISC_SLAVE_NAME,
  SMALL_DISC_USB_CABLE_PRODUCT_ID
} from "./src/features/classroom/lib/yinmanSmallDiscRules.ts";
import {
  AUDIO_PROCESSOR_HOST_PRODUCT_ID,
  getBrandExternalAmplifierCount,
  getBrandSystemCapability,
  getRequiredArrayMicCount,
  getShortestManhattanCascadeRoute,
  LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID
} from "./src/features/classroom/lib/systemCapabilities.ts";

function makeProfile({ scenario = "standardClassroom", length = 10, width = 8, height = 3, needs = ["localAmplification"], scope = "full", ceiling = "suspended", centralAir = [], microphoneSolution = "existingArray", teachingWidth = width, teachingDepth = 4, stageWidth = width, stageDepth = 3, computer = "", legacyWirelessMic = "", recordingHost = "", notes = "", podiumPosition = "frontCenter", hasPodium = true, speakerProductOverride = "auto", overheadSpeakerMounting = "unknown", processorTier = "auto", smallDiscConnectionMode = "auto", measuredRt60 } = {}) {
  const base = createInitialProfile();
  return normalizeProfile({
    ...base,
    scenario,
    needs,
    amplificationScope: scope,
    roomGeometry: { length, width, height },
    acousticEnvironment: { ...base.acousticEnvironment, measuredRt60 },
    existingDevices: { ...base.existingDevices, computer, legacyWirelessMic, recordingHost },
    engineeringConstraints: {
      ...base.engineeringConstraints,
      microphoneSolution,
      processorTier,
      smallDiscConnectionMode,
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

function getLineArraySpeakerBaseline(profile) {
  const decision = getLineArrayDecision(profile);
  const positions = Array.from({ length: decision.count }, (_, index) => ({
    x: decision.count === 1 ? decision.position.x : decision.activityZone.left + decision.activityZone.width * (index === 0 ? 0.25 : 0.75),
    y: decision.position.y
  }));
  return generateEngineeringPoints(profile, {
    arrayMicCount: decision.count,
    lineArrayContext: { mode: decision.mode, position: decision.position, positions }
  }).filter((point) => point.type === "speaker");
}

function wallMountingAngle(point, profile) {
  const target = point.target;
  assert.ok(target, "Missing wall-speaker target for " + point.id);
  const vector = { x: target.x - point.position.x, y: target.y - point.position.y };
  if (Math.abs(point.position.y) <= 0.05) return Math.round(90 - (Math.atan2(vector.x, vector.y) * 180) / Math.PI);
  if (Math.abs(point.position.y - profile.roomGeometry.length) <= 0.05) return Math.round(90 + (Math.atan2(vector.x, -vector.y) * 180) / Math.PI);
  if (Math.abs(point.position.x) <= 0.05) return Math.round(90 + (Math.atan2(vector.y, vector.x) * 180) / Math.PI);
  return Math.round(90 - (Math.atan2(vector.y, -vector.x) * 180) / Math.PI);
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

const unconfirmedInstallation = getCompleteness(makeProfile({ overheadSpeakerMounting: "unknown" })).find((item) => item.key === "installation");
const confirmedInstallation = getCompleteness(makeProfile({ overheadSpeakerMounting: "available" })).find((item) => item.key === "installation");
assert.equal(unconfirmedInstallation?.complete, false);
assert.equal(unconfirmedInstallation?.blocking, true);
assert.equal(confirmedInstallation?.complete, true);
console.log("PASS presales installation conditions require an explicit customer choice");

const invalidYinmanRoom = generateEngineeringOutputs(makeProfile({ length: 0, width: 12, height: 2.6 }), {}, "yinman");
assert.equal(invalidYinmanRoom.isFinalReady, false);
assert.deepEqual(invalidYinmanRoom.productSelection, []);
assert.deepEqual(invalidYinmanRoom.generatedPoints, []);
assert.deepEqual(invalidYinmanRoom.connectionLines, []);
console.log("PASS invalid Yinman room returns no equipment or drawings");

assert.equal(getMeetingFurnitureEndClearance(6), 1.2);
assert.equal(getMeetingFurnitureEndClearance(11), 1.6);
assert.equal(getMeetingFurnitureEndClearance(16), 2);
assert.equal(getMeetingFurnitureEndClearance(20), 2);
const continuousMeetingFurniture = getMeetingFurnitureLayout(makeProfile({ scenario: "meetingRoom", width: 9.6, length: 12.8 }));
assert.equal(continuousMeetingFurniture.orientation, "top");
assert.equal(continuousMeetingFurniture.tableLength, 9.32);
assert.equal(continuousMeetingFurniture.tableWidth, 2.4);
assert.equal(continuousMeetingFurniture.seatsPerSide, 13);
assert.equal(continuousMeetingFurniture.seatCount, 27);
assert.equal(continuousMeetingFurniture.seats.filter((seat) => seat.leader).length, 1);
assert.equal(continuousMeetingFurniture.seats.some((seat) => seat.side === "top"), false);
const rotatedMeetingFurniture = getMeetingFurnitureLayout(makeProfile({ scenario: "meetingRoom", width: 12.8, length: 9.6 }));
assert.equal(rotatedMeetingFurniture.orientation, "left");
assert.equal(rotatedMeetingFurniture.tableLength, continuousMeetingFurniture.tableLength);
assert.equal(rotatedMeetingFurniture.tableWidth, continuousMeetingFurniture.tableWidth);
assert.equal(rotatedMeetingFurniture.seatCount, continuousMeetingFurniture.seatCount);
assert.equal(rotatedMeetingFurniture.seats.find((seat) => seat.leader)?.side, "right");
assert.equal(getMeetingFurnitureLayout(makeProfile({ scenario: "meetingRoom", width: 10, length: 10 })).orientation, "top");
assert.equal(getMeetingFurnitureLayout(makeProfile({ scenario: "meetingRoom", width: 10.1, length: 10 })).orientation, "left");
const mediumMeetingFurniture = getMeetingFurnitureLayout(makeProfile({ scenario: "meetingRoom", width: 4, length: 8 }));
assert.equal(mediumMeetingFurniture.tableWidth, 1.24);
assert.equal(mediumMeetingFurniture.requiresReview, false);
const smallMeetingFurniture = getMeetingFurnitureLayout(makeProfile({ scenario: "meetingRoom", width: 3, length: 3 }));
assert.equal(smallMeetingFurniture.seatCount, 4);
assert.equal(smallMeetingFurniture.shape, "round");
assert.equal(smallMeetingFurniture.seats.some((seat) => seat.leader), false);
assert.equal(smallMeetingFurniture.requiresReview, true);
assert.ok(smallMeetingFurniture.reviewReasons.includes("桌椅通道需现场复核"));
const legacyFurnitureProfile = JSON.parse(JSON.stringify(makeProfile({ scenario: "meetingRoom", width: 9.6, length: 12.8 })));
legacyFurnitureProfile.engineeringConstraints.meetingFurniture = { mode: "manual", seatCount: 8, tableLength: 2.4, tableWidth: 1.1 };
const legacyFurnitureLayout = getMeetingFurnitureLayout(normalizeProfile(legacyFurnitureProfile));
assert.equal(legacyFurnitureLayout.tableLength, continuousMeetingFurniture.tableLength);
assert.equal(legacyFurnitureLayout.seatCount, continuousMeetingFurniture.seatCount);
for (const profile of [
  makeProfile({ scenario: "meetingRoom", width: 9.6, length: 12.8 }),
  makeProfile({ scenario: "meetingRoom", width: 12.8, length: 9.6 })
]) {
  const pointsBeforeFurniture = pointSnapshot(generateEngineeringOutputs(profile, {}, "yinyi").generatedPoints);
  getMeetingFurnitureLayout(profile);
  const pointsAfterFurniture = pointSnapshot(generateEngineeringOutputs(profile, {}, "yinyi").generatedPoints);
  assert.deepEqual(pointsAfterFurniture, pointsBeforeFurniture);
}
console.log("PASS continuous meeting furniture sizing, 2.4m cap, 0.7m seat pitch, orientation, round fallback, legacy override ignore and unchanged device points");

const longMeetingAimProfile = makeProfile({ scenario: "meetingRoom", width: 9.6, length: 12.8, ceiling: "exposed", speakerProductOverride: "wall" });
const longMeetingAimPoints = generateEngineeringOutputs(longMeetingAimProfile, {}, "yinyi").generatedPoints;
const longMeetingMics = longMeetingAimPoints.filter((point) => point.type === "arrayMic").sort((a, b) => a.position.y - b.position.y);
const longMeetingFrontSpeakers = longMeetingAimPoints.filter((point) => point.type === "speaker" && Math.abs(point.position.y) <= 0.05).sort((a, b) => a.position.x - b.position.x);
const longMeetingBackSpeakers = longMeetingAimPoints.filter((point) => point.type === "speaker" && Math.abs(point.position.y - longMeetingAimProfile.roomGeometry.length) <= 0.05).sort((a, b) => a.position.x - b.position.x);
assert.equal(longMeetingMics.length, 2);
assert.equal(longMeetingFrontSpeakers.length, 2);
assert.equal(longMeetingBackSpeakers.length, 2);
assert.ok(longMeetingFrontSpeakers.every((point) => point.target?.y === longMeetingMics[1].position.y));
assert.ok(longMeetingBackSpeakers.every((point) => point.target?.y === longMeetingMics[0].position.y));
assert.deepEqual(longMeetingFrontSpeakers.map((point) => wallMountingAngle(point, longMeetingAimProfile)), [74, 106]);
assert.deepEqual(longMeetingBackSpeakers.map((point) => wallMountingAngle(point, longMeetingAimProfile)), [106, 74]);

const wideMeetingAimProfile = makeProfile({ scenario: "meetingRoom", width: 12.6, length: 10.1, ceiling: "exposed", speakerProductOverride: "wall" });
const wideMeetingSpeakers = generateEngineeringOutputs(wideMeetingAimProfile, {}, "yinyi").generatedPoints.filter((point) => point.type === "speaker");
const wideMeetingAngles = wideMeetingSpeakers
  .map((point) => ({ x: point.position.x, y: point.position.y, angle: wallMountingAngle(point, wideMeetingAimProfile) }))
  .sort((a, b) => a.y - b.y || a.x - b.x)
  .map(({ angle }) => angle);
assert.deepEqual(wideMeetingAngles, [124, 56, 57, 123]);
console.log("PASS long meeting front/back opposite-mic symmetry and wide meeting side-wall isolation");

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
const noPodiumProfile = makeProfile({ length: 9.9, width: 10.4, scope: "podium", microphoneSolution: "lineArray", podiumPosition: "unknown", hasPodium: true, measuredRt60: 1.3 });
assert.equal(noPodiumProfile.engineeringConstraints.hasPodium, false);
const noPodiumLineArray = getLineArrayDecision(noPodiumProfile);
assert.equal(noPodiumLineArray.installation, "hanging");
assert.equal(noPodiumLineArray.position.y, 2.5);
const noPodiumOutputs = generateEngineeringOutputs(noPodiumProfile, {}, "yinyi");
assert.equal(getTeacherActivityZone(noPodiumProfile, noPodiumOutputs.generatedPoints).depth, 2.4);
const sidePodiumTooFar = getLineArrayDecision(makeProfile({ length: 8, width: 10, scope: "podium", microphoneSolution: "lineArray", podiumPosition: "frontLeft", computer: "讲台电脑" }));
assert.equal(sidePodiumTooFar.installation, "hanging");
assert.equal(sidePodiumTooFar.position.x, 3.8);
assert.equal(getLineArrayHangingFrontDistance(makeProfile({ width: 6, measuredRt60: 0.8 })), 2.5);
assert.equal(getLineArrayHangingFrontDistance(makeProfile({ width: 8, measuredRt60: 0.8 })), 2.75);
assert.equal(getLineArrayHangingFrontDistance(makeProfile({ width: 10, measuredRt60: 0.8 })), 3);
assert.equal(getLineArrayHangingFrontDistance(makeProfile({ width: 10, measuredRt60: 1.1 })), 2.75);
assert.equal(getLineArrayHangingFrontDistance(makeProfile({ width: 10, measuredRt60: 1.3 })), 2.5);
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
assert.equal(forcedTwoLine.generatedPoints.filter((point) => point.pickupKind === "lineArray").length, 2, "forced two-line boundary");
assert.equal(forcedTwoLine.solutionSelection.microphone.isNonRecommended, true);
assert.equal(forcedTwoLine.solutionSelection.drawingBlocked, false);
assert.equal(forcedTwoLine.pointValidation.findings.find((item) => item.code === "selection.line-array-non-recommended")?.severity, "warning");
const overWidth = generateEngineeringOutputs(makeProfile({ length: 8, width: 24.2, scope: "podium", microphoneSolution: "lineArray", podiumPosition: "frontLeft" }), {}, "yinyi");
assert.equal(overWidth.generatedPoints.some((point) => point.pickupKind === "lineArray"), false);
assert.equal(overWidth.generatedPoints.length, 0);
assert.equal(overWidth.connectionLines.length, 0);
assert.equal(overWidth.solutionSelection.drawingBlocked, true, "front-mode line array beyond the 15m responsibility width must remain blocked");
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

assert.equal(LINE_ARRAY_LOCAL_RADIUS_M, 5);
assert.equal(LINE_ARRAY_ONLINE_RADIUS_M, 5);
const onlineBoundaryLine = generateEngineeringOutputs(makeProfile({ length: 9.6, width: 12.8, scope: "podium", needs: ["interactiveClass"], microphoneSolution: "lineArray" }), {}, "yinman");
assert.equal(onlineBoundaryLine.generatedPoints.find((point) => point.pickupKind === "lineArray")?.coverageRadius, 5);
assert.equal(onlineBoundaryLine.solutionSelection.microphone.lineArrayCoverageWarning, undefined);
const forcedOnlineLine = generateEngineeringOutputs(makeProfile({ length: 9.5, width: 14.9, scope: "podium", needs: ["interactiveClass"], microphoneSolution: "lineArray" }), {}, "yinman");
const forcedOnlineLinePoint = forcedOnlineLine.generatedPoints.find((point) => point.pickupKind === "lineArray");
assert.equal(forcedOnlineLine.solutionSelection.drawingBlocked, false);
assert.equal(forcedOnlineLine.solutionSelection.microphone.recommended, "existingArray");
assert.equal(forcedOnlineLinePoint?.coverageRadius, 5);
assert.equal(forcedOnlineLinePoint?.pickupPattern, "full360");
assert.ok(forcedOnlineLine.productSelection.length > 0, "forced online line-array selection must retain its equipment list");
assert.ok(forcedOnlineLine.drawings.length > 0, "forced online line-array selection must generate drawings");
assert.equal(forcedOnlineLine.solutionSelection.microphone.lineArrayCoverageWarning, undefined);
assert.equal(forcedOnlineLine.generatedPoints.filter((point) => point.pickupKind === "smallDisc02").length, 4);
assert.equal(forcedOnlineLine.pointValidation.findings.find((item) => item.code === "selection.line-array-online-coverage"), undefined);
assert.equal(forcedOnlineLine.pointValidation.findings.find((item) => item.code === "selection.line-array-non-recommended")?.severity, "warning");
assert.equal(forcedOnlineLine.riskItems.includes("线阵麦线上拾音无法全覆盖，需现场复核或补充拾音设备。"), false);

const narrowOnlineCeiling = generateEngineeringOutputs(makeProfile({
  length: 9.5,
  width: 7.2,
  scope: "podium",
  needs: ["interactiveClass"],
  microphoneSolution: "lineArray",
  speakerProductOverride: "ceiling"
}), {}, "yinman");
const narrowOnlineCeilingSpeakers = narrowOnlineCeiling.generatedPoints.filter((point) => point.type === "speaker");
const narrowOnlineCeilingMic = narrowOnlineCeiling.generatedPoints.find((point) => point.pickupKind === "lineArray");
const narrowOnlineFirstRow = narrowOnlineCeilingSpeakers.filter((point) => Math.abs(point.position.y - 2) <= 0.05);
assert.equal(narrowOnlineCeilingSpeakers.length, 6);
assert.deepEqual(narrowOnlineFirstRow.map((point) => point.position), [{ x: 2.05, y: 2 }, { x: 5.15, y: 2 }]);
assert.ok(narrowOnlineFirstRow.every((point) => point.speakerSignalMode === "withoutLineArrayAfc"));
assert.ok(narrowOnlineCeilingSpeakers.filter((point) => point.position.y > 2.05).every((point) => point.speakerSignalMode === "afc"));
assert.ok(narrowOnlineCeilingMic);
const narrowOnlineNearest = Math.min(...narrowOnlineFirstRow.map((point) => Math.hypot(point.position.x - narrowOnlineCeilingMic.position.x, point.position.y - narrowOnlineCeilingMic.position.y)));
assert.ok(narrowOnlineNearest >= 1.2 && narrowOnlineNearest < 2);
const narrowOnlineDistanceFinding = narrowOnlineCeiling.pointValidation.findings.find((item) => item.code === "speaker.mic-distance");
assert.equal(narrowOnlineDistanceFinding?.severity, "info");
assert.equal(narrowOnlineDistanceFinding?.limit, "1.2m");

const wideOnlineCeiling = generateEngineeringOutputs(makeProfile({
  length: 9.5,
  width: 14.9,
  scope: "podium",
  needs: ["interactiveClass"],
  microphoneSolution: "lineArray",
  speakerProductOverride: "ceiling"
}), {}, "yinman");
const wideOnlineCeilingSpeakers = wideOnlineCeiling.generatedPoints.filter((point) => point.type === "speaker");
const wideOnlineFirstRow = wideOnlineCeilingSpeakers.filter((point) => Math.abs(point.position.y - 2) <= 0.05);
assert.equal(wideOnlineCeilingSpeakers.length, 12);
assert.deepEqual(wideOnlineFirstRow.map((point) => Math.round(point.position.x * 10) / 10), [2.2, 5.7, 9.2, 12.7]);
assert.ok(wideOnlineFirstRow.every((point) => point.speakerSignalMode === "withoutLineArrayAfc"));
assert.ok(wideOnlineCeilingSpeakers.filter((point) => point.position.y > 2.05).every((point) => point.speakerSignalMode === "afc"));
assert.ok(getCustomerVisiblePoints(wideOnlineCeiling.generatedPoints).every((point) => point.speakerSignalMode === undefined));
assert.ok(getCustomerVisibleConnectionLines(wideOnlineCeiling.connectionLines).every((line) => line.speakerSignalMode === undefined));
assert.doesNotMatch(JSON.stringify(getCustomerVisibleConnectionLines(wideOnlineCeiling.connectionLines)), /AFC|1\.2m/);
console.log("PASS full360 non-AFC first-row 1.2m clearance restores 7.2m and 14.9m regular ceiling grids");

const lectureFit = generateEngineeringOutputs(makeProfile({ scenario: "lectureClassroom", length: 10, width: 10, teachingDepth: 5, microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(lectureFit.solutionSelection.microphone.recommended, "lineArray");
const lectureTooDeep = generateEngineeringOutputs(makeProfile({ scenario: "lectureClassroom", length: 10, width: 10, teachingDepth: 5.1, microphoneSolution: "lineArray" }), {}, "yinyi");
assert.equal(lectureTooDeep.solutionSelection.drawingBlocked, false);
assert.equal(lectureTooDeep.solutionSelection.microphone.recommended, "lineArray");
assert.equal(getTeacherActivityZone(makeProfile({ scenario: "lectureClassroom", length: 10, width: 10, teachingDepth: 5.1 }), lectureTooDeep.generatedPoints).depth, 1.8);
const airAdjustedArrayProfile = makeProfile({
  scenario: "standardClassroom",
  length: 13,
  width: 9,
  microphoneSolution: "existingArray",
  centralAir: [{ id: "ac-teacher-depth", label: "中央空调1", position: { x: 4.5, y: 3.2 }, size: { width: 0.8, depth: 0.8 } }]
});
const airAdjustedArrayOutputs = generateEngineeringOutputs(airAdjustedArrayProfile, {}, "yinyi");
const airAdjustedPrimaryMic = airAdjustedArrayOutputs.generatedPoints.filter((point) => point.type === "arrayMic").sort((a, b) => a.position.y - b.position.y)[0];
assert.equal(getTeacherActivityZone(airAdjustedArrayProfile, airAdjustedArrayOutputs.generatedPoints).depth, Math.round((airAdjustedPrimaryMic.position.y - 0.3) * 10) / 10);
const combinedFit = generateEngineeringOutputs(makeProfile({ scenario: "combinedClassroom", length: 12, width: 12, teachingWidth: 10, teachingDepth: 5, microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(combinedFit.solutionSelection.microphone.recommended, "lineArray");
assert.equal(getTeacherActivityZone(makeProfile({ scenario: "combinedClassroom", length: 12, width: 12, teachingWidth: 10, teachingDepth: 5 }), combinedFit.generatedPoints).depth, 5);
const combinedTwo = generateEngineeringOutputs(makeProfile({ scenario: "combinedClassroom", length: 12, width: 12, teachingWidth: 10.1, teachingDepth: 5, microphoneSolution: "lineArray" }), {}, "yinyi");
assert.equal(combinedTwo.generatedPoints.filter((point) => point.pickupKind === "lineArray").length, 2, "combined classroom two-line boundary");
assert.equal(combinedTwo.solutionSelection.microphone.recommended, "existingArray");

const meetingFiveMeter = generateEngineeringOutputs(makeProfile({ scenario: "meetingRoom", length: 8, width: 6, microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(meetingFiveMeter.solutionSelection.microphone.recommended, "lineArray");
assert.equal(meetingFiveMeter.generatedPoints.find((point) => point.pickupKind === "lineArray")?.installationMode, "tabletop");
const meetingOverFiveMeter = generateEngineeringOutputs(makeProfile({ scenario: "meetingRoom", length: 8.1, width: 6, microphoneSolution: "lineArray" }), {}, "yinyi");
assert.equal(meetingOverFiveMeter.solutionSelection.drawingBlocked, false);
assert.equal(meetingOverFiveMeter.generatedPoints.find((point) => point.pickupKind === "lineArray")?.coverageRadius, 5);
assert.match(meetingOverFiveMeter.solutionSelection.microphone.lineArrayCoverageWarning ?? "", /5m线上拾音半径/);
const meetingOverEightMeter = generateEngineeringOutputs(makeProfile({ scenario: "meetingRoom", length: 9.5, width: 14.9, microphoneSolution: "lineArray" }), {}, "yinyi");
assert.equal(meetingOverEightMeter.solutionSelection.drawingBlocked, false);
assert.ok(meetingOverEightMeter.generatedPoints.some((point) => point.pickupKind === "lineArray"));
assert.match(meetingOverEightMeter.solutionSelection.microphone.lineArrayCoverageWarning ?? "", /5m线上拾音半径/);
const meetingLeader = generateEngineeringOutputs(makeProfile({ scenario: "meetingRoom", length: 20, width: 10, notes: "主位扩声", microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(meetingLeader.solutionSelection.microphone.recommended, "lineArray");
assert.equal(meetingLeader.generatedPoints.find((point) => point.pickupKind === "lineArray")?.installationMode, "tabletop");

const auditoriumStage = generateEngineeringOutputs(makeProfile({ scenario: "auditorium", length: 20, width: 14, needs: ["recording"], stageWidth: 10, stageDepth: 4, microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(auditoriumStage.solutionSelection.microphone.recommended, "lineArray");
assert.equal(auditoriumStage.generatedPoints.find((point) => point.pickupKind === "lineArray")?.position.y, 2);
assert.equal(getTeacherActivityZone(makeProfile({ scenario: "auditorium", length: 20, width: 14, stageWidth: 10, stageDepth: 4 }), auditoriumStage.generatedPoints).depth, 4);
const auditoriumConference = generateEngineeringOutputs(makeProfile({ scenario: "auditorium", length: 20, width: 14, needs: ["videoConference"], stageWidth: 10, stageDepth: 5, microphoneSolution: "auto" }), {}, "yinyi");
assert.equal(auditoriumConference.solutionSelection.microphone.recommended, "existingArray");

const twoSpeakerOverrides = { "CEILING-SPEAKER": 2, "COLUMN-SPEAKER": 2 };
const yinmanSingleLine = generateEngineeringOutputs(makeProfile({ length: 8, width: 8, scope: "podium", microphoneSolution: "lineArray" }), twoSpeakerOverrides, "yinman");
const yinyiSingleLine = generateEngineeringOutputs(makeProfile({ length: 8, width: 8, scope: "podium", microphoneSolution: "lineArray" }), {}, "yinyi");
assert.equal(yinmanSingleLine.productSelection.find((item) => item.category === "processor")?.name, "高性能处理器");
assert.equal(yinyiSingleLine.productSelection.find((item) => item.category === "processor")?.name, "双麦处理器");
const yinyiExistingArray = generateEngineeringOutputs(makeProfile({ length: 8, width: 8, microphoneSolution: "existingArray" }), {}, "yinyi");
const yinmanExistingArray = generateEngineeringOutputs(makeProfile({ length: 8, width: 8, microphoneSolution: "existingArray" }), {}, "yinman");
assert.equal(yinyiExistingArray.productSelection.some((item) => item.category === "processor"), false);
assert.equal(yinmanExistingArray.productSelection.find((item) => item.category === "processor")?.quantity, 1);
assert.equal(yinmanExistingArray.productSelection.find((item) => item.category === "processor")?.name, "高性能处理器");
assert.match(yinmanExistingArray.audioPlan.summary, /大圆盘阵麦/);
assert.doesNotMatch(yinmanExistingArray.audioPlan.summary, /智能天花阵列麦克风/);
assert.deepEqual(getProcessorTiersForBrand("yinyi"), ["twoMic", "sixMic"]);
assert.deepEqual(getProcessorTiersForBrand("yinman"), ["twoMic", "sixMic", "highPerformance"]);
assert.equal(YINMAN_LARGE_ARRAY_PROCESSOR_TIER, "highPerformance");
assert.deepEqual(getProcessorTiersForSelection("yinman", "existingArray", false), ["highPerformance"]);
assert.deepEqual(getProcessorTiersForSelection("yinman", "lineArray", false), ["twoMic", "sixMic", "highPerformance"]);
const yinmanLargeArrayHardRuleProfile = makeProfile({
  length: 8,
  width: 8,
  microphoneSolution: "existingArray",
  processorTier: "twoMic",
  computer: "讲台电脑",
  recordingHost: "录播主机"
});
const yinmanLargeArrayHardRule = generateEngineeringOutputs(yinmanLargeArrayHardRuleProfile, {}, "yinman");
assert.equal(yinmanLargeArrayHardRule.productSelection.find((item) => item.category === "processor")?.name, "高性能处理器");
assert.doesNotMatch(JSON.stringify(yinmanLargeArrayHardRule.connectionLines), /双麦处理器|六麦处理器/);
assert.deepEqual(
  Array.from(new Set(yinmanLargeArrayHardRule.connectionLines
    .flatMap((line) => [line.fromDevice, line.toDevice])
    .filter((device) => device.includes("处理器")))),
  ["高性能处理器"]
);
const yinmanLargeArrayHardRuleTopology = getTopologyLayoutSnapshot(
  yinmanLargeArrayHardRuleProfile,
  yinmanLargeArrayHardRule.connectionLines,
  yinmanLargeArrayHardRule.generatedPoints
);
assert.equal(yinmanLargeArrayHardRuleTopology.nodes.some((node) => /双麦处理器|六麦处理器/.test(node.label)), false);
const yinyiRejectsYinmanProcessor = generateEngineeringOutputs(makeProfile({ length: 8, width: 8, scope: "podium", microphoneSolution: "lineArray", processorTier: "highPerformance" }), twoSpeakerOverrides, "yinyi");
assert.equal(yinyiRejectsYinmanProcessor.productSelection.find((item) => item.category === "processor")?.name, "双麦处理器");
assert.equal(yinmanSingleLine.solutionSelection.processor?.recommended, "highPerformance");
assert.equal(yinmanSingleLine.solutionSelection.processor?.selected, "highPerformance");
assert.equal(yinmanSingleLine.solutionSelection.processor?.alternative, "twoMic");
const yinmanEconomyLine = generateEngineeringOutputs(makeProfile({ length: 8, width: 8, scope: "podium", microphoneSolution: "lineArray", processorTier: "twoMic" }), twoSpeakerOverrides, "yinman");
assert.equal(yinmanEconomyLine.productSelection.find((item) => item.category === "processor")?.name, "双麦处理器");
assert.equal(yinmanEconomyLine.solutionSelection.processor?.isNonRecommended, true);
const yinmanInterfaceRichLine = generateEngineeringOutputs(makeProfile({ length: 8, width: 8, scope: "podium", microphoneSolution: "lineArray", legacyWirelessMic: "无线手持麦、无线手持麦、无线手持麦" }), twoSpeakerOverrides, "yinman");
assert.equal(yinmanInterfaceRichLine.productSelection.find((item) => item.category === "processor")?.name, "高性能处理器");
assert.equal(yinmanInterfaceRichLine.solutionSelection.processor?.alternative, "sixMic");
assert.equal(getProcessorCapacity("twoMic"), 2);
assert.equal(getProcessorCapacity("sixMic"), 6);
const yinmanDoubleLine = generateEngineeringOutputs(makeProfile({ scenario: "combinedClassroom", length: 8, width: 14, scope: "podium", microphoneSolution: "lineArray", teachingWidth: 14, teachingDepth: 5 }), {}, "yinman");
assert.equal(yinmanDoubleLine.productSelection.find((item) => item.category === "processor")?.name, "六麦处理器");
assert.equal(yinmanDoubleLine.connectionLines.filter((line) => line.id.startsWith("array-mic-processor-network-")).length, 2);
assert.doesNotMatch(JSON.stringify([yinmanSingleLine, yinmanEconomyLine, yinmanInterfaceRichLine, yinmanDoubleLine]), /SA110|AJ200|AJ600|AJ350/);

const hybridProfile12 = makeProfile({
  length: 12.4,
  width: 7.4,
  height: 3.1,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "lineArray",
  speakerProductOverride: "wall",
  overheadSpeakerMounting: "available"
});
const hybrid12 = generateEngineeringOutputs(hybridProfile12, {}, "yinman");
const hybrid12Mics = hybrid12.generatedPoints.filter((point) => point.type === "arrayMic");
assert.deepEqual(hybrid12Mics.map((point) => ({ kind: point.pickupKind, x: point.position.x, y: point.position.y, radius: point.coverageRadius })), [
  { kind: "lineArray", x: 3.7, y: 2.5, radius: 5 },
  { kind: "smallDisc02", x: 3.7, y: 7.3, radius: 5 }
]);
assert.deepEqual(pointSnapshot(hybrid12.generatedPoints.filter((point) => point.type === "speaker")), pointSnapshot(getLineArraySpeakerBaseline(hybridProfile12)));
assert.equal(hybrid12.productSelection.find((item) => item.productId === LINE_ARRAY_PRODUCT_ID)?.quantity, 1);
assert.equal(hybrid12.productSelection.find((item) => item.productId === SMALL_DISC_02_PRODUCT_ID)?.quantity, 1);
assert.equal(hybrid12.productSelection.find((item) => item.productId === LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID)?.quantity, 1);
assert.equal(hybrid12.productSelection.find((item) => item.productId === AUDIO_PROCESSOR_HOST_PRODUCT_ID)?.name, "六麦处理器");
assert.equal(hybrid12.solutionSelection.processor?.selected, "sixMic");
assert.equal(hybrid12.solutionSelection.microphone.lineArrayCoverageWarning, undefined);
assert.equal(hybrid12.pointValidation.findings.some((finding) => finding.code === "selection.line-array-online-coverage"), false);
assert.ok(hybrid12.connectionLines.some((line) => line.id === "line-array-converter-processor" && line.toPort === "MIC1 + MIC2"));
assert.ok(hybrid12.connectionLines.some((line) => line.id === "line-array-supplement-extmic" && line.toPort === "EXTMIC"));

const hybridEconomyProfile12 = makeProfile({
  length: 12.4,
  width: 7.4,
  height: 3.1,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "lineArray",
  speakerProductOverride: "wall",
  overheadSpeakerMounting: "available",
  measuredRt60: 0.4
});
const hybridEconomy12 = generateEngineeringOutputs(hybridEconomyProfile12, {}, "yinman");
assert.equal(hybridEconomy12.productSelection.find((item) => item.productId === AUDIO_PROCESSOR_HOST_PRODUCT_ID)?.name, "双麦处理器");
assert.equal(hybridEconomy12.solutionSelection.processor?.selected, "twoMic");

const hybrid12IgnoredOverride = generateEngineeringOutputs(hybridEconomyProfile12, { [SMALL_DISC_02_PRODUCT_ID]: 0 }, "yinman");
assert.equal(hybrid12IgnoredOverride.generatedPoints.filter((point) => point.pickupKind === "smallDisc02").length, 1);
assert.equal(hybrid12IgnoredOverride.productSelection.find((item) => item.productId === SMALL_DISC_02_PRODUCT_ID)?.quantity, 1);

const hybridProfile17 = makeProfile({
  length: 17,
  width: 7.4,
  height: 3.1,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "lineArray",
  speakerProductOverride: "wall",
  overheadSpeakerMounting: "available"
});
const hybrid17 = generateEngineeringOutputs(hybridProfile17, {}, "yinman");
assert.deepEqual(hybrid17.generatedPoints.filter((point) => point.type === "arrayMic").map((point) => ({ kind: point.pickupKind, x: point.position.x, y: point.position.y })), [
  { kind: "lineArray", x: 3.7, y: 2.5 },
  { kind: "smallDisc02", x: 3.7, y: 7.5 },
  { kind: "smallDisc02", x: 3.7, y: 11.7 }
]);
assert.deepEqual(pointSnapshot(hybrid17.generatedPoints.filter((point) => point.type === "speaker")), pointSnapshot(getLineArraySpeakerBaseline(hybridProfile17)));
assert.equal(hybrid17.connectionLines.filter((line) => line.id.startsWith("line-array-supplement-cascade-")).length, 1);
assert.equal(hybrid17.connectionLines.filter((line) => line.toPort === "EXTMIC").length, 1);
assert.equal(hybrid17.productSelection.find((item) => item.productId === AUDIO_PROCESSOR_HOST_PRODUCT_ID)?.name, "双麦处理器");

const hybridWithExtraMic = generateEngineeringOutputs({
  ...hybridEconomyProfile12,
  existingDevices: { ...hybridEconomyProfile12.existingDevices, legacyWirelessMic: "有线麦克风" },
  engineeringConstraints: { ...hybridEconomyProfile12.engineeringConstraints, processorTier: "highPerformance" }
}, {}, "yinman");
assert.equal(hybridWithExtraMic.productSelection.find((item) => item.productId === AUDIO_PROCESSOR_HOST_PRODUCT_ID)?.name, "六麦处理器");
assert.equal(hybridWithExtraMic.solutionSelection.processor?.selected, "sixMic");
assert.equal(hybridWithExtraMic.solutionSelection.processor?.userSelected, false);

const hybridWide = generateEngineeringOutputs(makeProfile({
  length: 9.5,
  width: 14.9,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "lineArray",
  speakerProductOverride: "wall",
  overheadSpeakerMounting: "available",
  measuredRt60: 0.4
}), {}, "yinman");
assert.deepEqual(hybridWide.generatedPoints.filter((point) => point.pickupKind === "smallDisc02").map((point) => point.position), [
  { x: 4.9, y: 3.2 },
  { x: 10, y: 3.2 },
  { x: 4.9, y: 7.2 },
  { x: 10, y: 7.2 }
]);
assert.equal(hybridWide.pointValidation.findings.find((finding) => finding.code === "line-array-supplement.recommended-count")?.severity, "hard");

const hybridLecture = generateEngineeringOutputs(makeProfile({
  scenario: "lectureClassroom",
  length: 17,
  width: 9,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "lineArray",
  overheadSpeakerMounting: "available",
  measuredRt60: 0.4
}), {}, "yinman");
assert.equal(hybridLecture.generatedPoints.filter((point) => point.pickupKind === "smallDisc02").length, 3);
assert.equal(hybridLecture.pointValidation.findings.some((finding) => finding.code === "array.back-wall-distance"), false);

const hybridCombined = generateEngineeringOutputs(makeProfile({
  scenario: "combinedClassroom",
  length: 18,
  width: 14,
  teachingWidth: 14,
  teachingDepth: 16,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "lineArray",
  overheadSpeakerMounting: "available",
  measuredRt60: 0.4
}), {}, "yinman");
const hybridCombinedSupplements = hybridCombined.generatedPoints.filter((point) => point.pickupKind === "smallDisc02");
assert.equal(hybridCombinedSupplements.length, 8);
assert.deepEqual(Array.from(new Set(hybridCombinedSupplements.map((point) => point.position.y))), [3.2, 7.2, 11.2, 15.2]);
assert.ok(Array.from(new Set(hybridCombinedSupplements.map((point) => point.position.y))).every((y) => hybridCombinedSupplements.filter((point) => point.position.y === y).length === 2));
assert.equal(hybridCombined.pointValidation.findings.some((finding) => finding.code === "array.back-wall-distance"), false);
assert.equal(hybridCombined.riskItems.some((item) => item.includes("阵麦全场扩声能力")), false);

const yinyiNoHybrid = generateEngineeringOutputs(hybridProfile17, {}, "yinyi");
assert.equal(yinyiNoHybrid.generatedPoints.some((point) => point.pickupKind === "smallDisc02"), false);
assert.equal(yinyiNoHybrid.productSelection.some((item) => item.productId === LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID), false);
const meetingNoHybrid = generateEngineeringOutputs(makeProfile({ scenario: "meetingRoom", length: 17, width: 8, needs: ["interactiveClass"], microphoneSolution: "lineArray" }), {}, "yinman");
assert.equal(meetingNoHybrid.generatedPoints.some((point) => point.pickupKind === "smallDisc02"), false);
assert.doesNotMatch(JSON.stringify([hybrid12, hybrid17, hybridWide, hybridLecture, hybridCombined]), /RING02|AJ200|AJ350|AJ600/);
console.log("PASS Yinman classroom hybrid line-array online pickup uses 5m array references, symmetric columns, automatic processor capacity and one EXTMIC chain");

const hybridTopologyProfile = makeProfile({
  length: 14.3,
  width: 7.4,
  height: 3.1,
  needs: ["localAmplification", "interactiveClass"],
  scope: "podium",
  microphoneSolution: "lineArray",
  speakerProductOverride: "wall",
  overheadSpeakerMounting: "available",
  computer: "讲台电脑"
});
const hybridTopologyOutputs = generateEngineeringOutputs(hybridTopologyProfile, {}, "yinman");
const hybridTopology = getTopologyLayoutSnapshot(
  hybridTopologyProfile,
  getCustomerVisibleConnectionLines(hybridTopologyOutputs.connectionLines),
  getCustomerVisiblePoints(hybridTopologyOutputs.generatedPoints)
);
const supplementTopologyNodes = hybridTopology.nodes.filter((node) => node.key === "lineArraySupplementGroup" || node.key.startsWith("smallDiscSlave-"));
assert.equal(supplementTopologyNodes.length, 1);
assert.equal(supplementTopologyNodes[0]?.key, "lineArraySupplementGroup");
assert.equal(supplementTopologyNodes[0]?.quantity, 2);
const findTopologyEdge = (left, right) => hybridTopology.edges.find((edge) =>
  (edge.from === left && edge.to === right) || (edge.from === right && edge.to === left)
);
const converterProcessorTopologyEdge = findTopologyEdge("lineArrayConverter", "processorHost");
const lineArrayConverterTopologyEdge = findTopologyEdge("arrayMic-1", "lineArrayConverter");
const supplementProcessorTopologyEdge = findTopologyEdge("lineArraySupplementGroup", "processorHost");
assert.equal(converterProcessorTopologyEdge?.visibleCableLength, 170);
assert.equal(lineArrayConverterTopologyEdge?.visibleCableLength, 120);
assert.equal(supplementProcessorTopologyEdge?.visibleCableLength, 170);
assert.equal(lineArrayConverterTopologyEdge?.label, "网线 ×1");
assert.equal(supplementProcessorTopologyEdge?.label, "网线 ×1");
assert.equal(hybridTopologyOutputs.connectionLines.filter((line) => line.id.startsWith("line-array-supplement-cascade-")).length, 1);
assert.doesNotMatch(JSON.stringify(hybridTopology.edges.map((edge) => edge.label)), /超五类|T568B/);
assert.match(JSON.stringify(hybridTopologyOutputs.connectionLines), /T568B/);
const directTopologyKeys = Array.from(new Set(hybridTopology.edges.flatMap((edge) => {
  if (edge.from === hybridTopology.mainDevice) return [edge.to];
  if (edge.to === hybridTopology.mainDevice) return [edge.from];
  return [];
})));
assert.ok(directTopologyKeys.length >= 4);
const mainTopologyCenter = hybridTopology.imageCenters[hybridTopology.mainDevice];
assert.ok(mainTopologyCenter);
const directTopologyAngles = directTopologyKeys.map((key) => {
  const center = hybridTopology.imageCenters[key];
  assert.ok(center, "Missing topology center for " + key);
  const angle = Math.atan2(center.y - mainTopologyCenter.y, center.x - mainTopologyCenter.x);
  return (angle + Math.PI * 2) % (Math.PI * 2);
}).sort((a, b) => a - b);
const expectedTopologyAngleGap = (Math.PI * 2) / directTopologyAngles.length;
const topologyAngleGaps = directTopologyAngles.map((angle, index) =>
  (directTopologyAngles[(index + 1) % directTopologyAngles.length] - angle + Math.PI * 2) % (Math.PI * 2)
);
assert.ok(topologyAngleGaps.every((gap) => Math.abs(gap - expectedTopologyAngleGap) < 0.000001));
console.log("PASS hybrid topology keeps fixed hierarchy lengths, aggregated supplements, generic network labels and even primary distribution");

const yinmanHanging = generateEngineeringOutputs(makeProfile({
  length: 8,
  width: 10,
  scope: "podium",
  podiumPosition: "frontLeft",
  microphoneSolution: "hangingMic"
}), twoSpeakerOverrides, "yinman");
const hangingPoints = yinmanHanging.generatedPoints.filter((point) => point.pickupKind === "hangingMic");
const hangingConnections = yinmanHanging.connectionLines.filter((line) => line.id.startsWith("hanging-mic-processor-"));
assert.equal(yinmanHanging.solutionSelection.microphone.selected, "hangingMic");
assert.equal(yinmanHanging.productSelection.find((item) => item.productId === HANGING_MIC_PRODUCT_ID)?.name, "吊麦");
assert.equal(yinmanHanging.productSelection.find((item) => item.productId === HANGING_MIC_PRODUCT_ID)?.quantity, 2);
assert.equal(yinmanHanging.productSelection.find((item) => item.category === "processor")?.name, "双麦处理器");
assert.equal(hangingPoints.length, 2);
assert.ok(hangingPoints.every((point) => point.coverageRadius === HANGING_MIC_RADIUS_M && point.label.startsWith("吊麦")));
assert.equal(hangingConnections.length, 2);
assert.ok(hangingConnections.every((line, index) => line.toPort === "MIC " + (index + 1) && line.note.includes("MIC口直接供电")));
assert.match(yinmanHanging.solutionSelection.microphone.advantages, /价格更低的双麦处理器/);
assert.match(yinmanHanging.solutionSelection.microphone.cautions, /利旧麦克风和新增无线接收机合计MIC占用/);

const yinmanHangingAfterHighPerformanceReset = generateEngineeringOutputs(makeProfile({
  length: 8,
  width: 10,
  scope: "podium",
  podiumPosition: "frontLeft",
  microphoneSolution: "hangingMic",
  processorTier: "auto",
  legacyWirelessMic: "有线麦克风"
}), twoSpeakerOverrides, "yinman");
const resetHangingProcessor = yinmanHangingAfterHighPerformanceReset.productSelection.find((item) => item.category === "processor");
assert.equal(resetHangingProcessor?.name, "六麦处理器");
assert.ok((resetHangingProcessor?.wiring ?? "").includes("独立触摸屏"));
assert.ok((resetHangingProcessor?.wiring ?? "").includes("音箱音量"));
assert.ok((resetHangingProcessor?.wiring ?? "").includes("麦克风静音/开音"));
assert.match(resetHangingProcessor?.wiring ?? "", /当前合计占用3路MIC输入/);
assert.match(yinmanHangingAfterHighPerformanceReset.solutionSelection.microphone.cautions, /超过2路时自动配置六麦处理器/);

const yinmanHangingMicLimited = generateEngineeringOutputs(makeProfile({
  length: 8,
  width: 10,
  scope: "podium",
  podiumPosition: "frontLeft",
  microphoneSolution: "hangingMic",
  processorTier: "twoMic",
  legacyWirelessMic: "有线麦克风"
}), { ...twoSpeakerOverrides, [HANGING_MIC_PRODUCT_ID]: 5 }, "yinman");
assert.equal(yinmanHangingMicLimited.productSelection.find((item) => item.productId === HANGING_MIC_PRODUCT_ID)?.quantity, 1);
assert.equal(yinmanHangingMicLimited.generatedPoints.filter((point) => point.pickupKind === "hangingMic").length, 1);
assert.match(yinmanHangingMicLimited.solutionSelection.microphone.hangingMicCapacityWarning ?? "", /需要2只.*仅支持1只/);

const yinmanHangingHighPerformance = generateEngineeringOutputs(makeProfile({
  length: 8,
  width: 8,
  scope: "podium",
  microphoneSolution: "hangingMic",
  processorTier: "highPerformance"
}), {}, "yinman");
assert.equal(yinmanHangingHighPerformance.solutionSelection.drawingBlocked, true);
assert.match(yinmanHangingHighPerformance.solutionSelection.blockingMessage ?? "", /双麦处理器或六麦处理器/);
assert.equal(yinmanHangingHighPerformance.generatedPoints.length, 0);

const yinmanHangingFullRoom = generateEngineeringOutputs(makeProfile({
  length: 8,
  width: 8,
  scope: "full",
  microphoneSolution: "hangingMic"
}), {}, "yinman");
assert.equal(yinmanHangingFullRoom.solutionSelection.drawingBlocked, true);
assert.match(yinmanHangingFullRoom.solutionSelection.blockingMessage ?? "", /仅用于讲台区域扩声/);

const yinyiHangingDraft = generateEngineeringOutputs(makeProfile({
  length: 8,
  width: 8,
  scope: "podium",
  microphoneSolution: "hangingMic"
}), {}, "yinyi");
assert.notEqual(yinyiHangingDraft.solutionSelection.microphone.selected, "hangingMic");
assert.equal(yinyiHangingDraft.productSelection.some((item) => item.productId === HANGING_MIC_PRODUCT_ID || item.name === "吊麦"), false);
assert.equal(yinyiHangingDraft.generatedPoints.some((point) => point.pickupKind === "hangingMic"), false);
console.log("PASS Yinman-only hanging microphone coverage, powered MIC capacity and processor boundaries");

const smallDisc01Profile = makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "smallDisc01",
  computer: "讲台电脑",
  overheadSpeakerMounting: "available",
  smallDiscConnectionMode: "usb"
});
const smallDisc01 = generateEngineeringOutputs(smallDisc01Profile, {}, "yinman");
const smallDisc01Points = smallDisc01.generatedPoints.filter((point) => point.pickupKind === "smallDisc01" || point.pickupKind === "smallDisc02");
assert.equal(smallDisc01.solutionSelection.microphone.selected, "smallDisc01");
assert.notEqual(smallDisc01.solutionSelection.microphone.recommended, "smallDisc01");
assert.equal(smallDisc01.productSelection.find((item) => item.productId === SMALL_DISC_01_PRODUCT_ID)?.quantity, 1);
assert.equal(smallDisc01.productSelection.find((item) => item.productId === SMALL_DISC_02_PRODUCT_ID)?.quantity, 3);
assert.equal(smallDisc01.productSelection.find((item) => item.productId === SMALL_DISC_01_PRODUCT_ID)?.name, SMALL_DISC_MAIN_NAME);
assert.equal(smallDisc01.productSelection.find((item) => item.productId === SMALL_DISC_02_PRODUCT_ID)?.name, SMALL_DISC_SLAVE_NAME);
assert.equal(smallDisc01.productSelection.find((item) => item.productId === SMALL_DISC_USB_CABLE_PRODUCT_ID)?.quantity, 1);
assert.equal(smallDisc01.productSelection.some((item) => item.productId === SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID), false);
assert.equal(smallDisc01.productSelection.some((item) => item.category === "processor" && item.quantity > 0), false);
assert.equal(smallDisc01.productSelection.some((item) => item.productId === "CEILING-SPEAKER" && item.quantity > 0), false);
assert.equal(smallDisc01.productSelection.some((item) => item.productId === "COLUMN-SPEAKER" && item.quantity > 0), true);
assert.equal(smallDisc01.productSelection.find((item) => item.category === "amplifier")?.quantity, 1);
assert.equal(smallDisc01Points.length, 4);
assert.equal(smallDisc01Points.filter((point) => point.pickupKind === "smallDisc01").length, 1, JSON.stringify(smallDisc01Points.map((point) => ({ id: point.id, pickupKind: point.pickupKind }))));
assert.equal(smallDisc01Points.filter((point) => point.pickupKind === "smallDisc02").length, 3);
assert.ok(smallDisc01Points.every((point) => point.label.startsWith(point.pickupKind === "smallDisc01" ? SMALL_DISC_MAIN_NAME : SMALL_DISC_SLAVE_NAME)));
assert.ok(smallDisc01Points.every((point) => point.coverageRadius === 3 && point.installationMode === "hanging"));
assert.equal(smallDisc01.connectionLines.filter((line) => line.id.startsWith("small-disc-01-cascade-")).length, 3);
assert.ok(smallDisc01.connectionLines.some((line) => line.id === "small-disc-01-usb-host" && line.cableType.includes("客户自购")));
assert.ok(smallDisc01.connectionLines.some((line) => line.id === "small-disc-01-amplifier" && line.fromPort === "AUDIO OUT / SPK-OUT"));
assert.equal(smallDisc01.pointValidation.findings.some((finding) => finding.code === "array.capacity" && finding.severity === "hard"), false);

const smallDisc01UsbRoutingProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "smallDisc01",
  computer: "讲台电脑",
  recordingHost: "录播主机、录播摄像机、中控主机",
  overheadSpeakerMounting: "available",
  smallDiscConnectionMode: "usb"
});
const smallDisc01UsbRouting = generateEngineeringOutputs(smallDisc01UsbRoutingProfile, {}, "yinman");
const smallDisc01UsbLine = smallDisc01UsbRouting.connectionLines.find((line) => line.id === "small-disc-01-usb-host");
assert.equal(smallDisc01UsbLine?.toDevice, "讲台电脑");
assert.equal(smallDisc01UsbRouting.solutionSelection.drawingBlocked, false);
assert.equal(smallDisc01UsbRouting.productSelection.find((item) => item.productId === SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID)?.quantity, 1);
assert.equal(smallDisc01UsbRouting.connectionLines.find((line) => line.id === "small-disc-01-link-extender")?.fromPort, "LINK");
assert.equal(smallDisc01UsbRouting.connectionLines.find((line) => line.id === "small-disc-01-extender-output-1")?.toDevice, "录播主机");
assert.equal(
  smallDisc01UsbRouting.connectionLines.some((line) =>
    line.cableType.includes("USB") && (line.toDevice.includes("录播") || line.toDevice.includes("摄像机") || line.toDevice.includes("中控"))
  ),
  false
);
const smallDisc01UsbTopology = getTopologyLayoutSnapshot(
  smallDisc01UsbRoutingProfile,
  smallDisc01UsbRouting.connectionLines,
  smallDisc01UsbRouting.generatedPoints
);
assert.equal(smallDisc01UsbTopology.mainDevice, "smallDiscMain");
assert.equal(smallDisc01UsbTopology.nodes.some((node) => node.label.includes("01拓展器")), true);
assert.equal(smallDisc01UsbTopology.nodes.some((node) => node.label.includes("录播主机")), true);
assert.equal(smallDisc01UsbTopology.nodes.some((node) => node.label.includes("录播摄像机") || node.label.includes("中控主机")), false);
const smallDisc01DirectKeys = Array.from(new Set(smallDisc01UsbTopology.edges.flatMap((edge) => {
  if (edge.from === smallDisc01UsbTopology.mainDevice) return [edge.to];
  if (edge.to === smallDisc01UsbTopology.mainDevice) return [edge.from];
  return [];
})));
const smallDisc01MainCenter = smallDisc01UsbTopology.imageCenters[smallDisc01UsbTopology.mainDevice];
assert.ok(smallDisc01MainCenter);
const smallDisc01DirectAngles = smallDisc01DirectKeys.map((key) => {
  const center = smallDisc01UsbTopology.imageCenters[key];
  assert.ok(center, "Missing small-disc topology center for " + key);
  return (Math.atan2(center.y - smallDisc01MainCenter.y, center.x - smallDisc01MainCenter.x) + Math.PI * 2) % (Math.PI * 2);
}).sort((a, b) => a - b);
const smallDisc01ExpectedAngleGap = (Math.PI * 2) / smallDisc01DirectAngles.length;
const smallDisc01AngleGaps = smallDisc01DirectAngles.map((angle, index) =>
  (smallDisc01DirectAngles[(index + 1) % smallDisc01DirectAngles.length] - angle + Math.PI * 2) % (Math.PI * 2)
);
assert.ok(
  smallDisc01AngleGaps.every((gap) => Math.abs(gap - smallDisc01ExpectedAngleGap) < 0.000001),
  JSON.stringify({ smallDisc01DirectKeys, smallDisc01DirectAngles, smallDisc01AngleGaps, smallDisc01ExpectedAngleGap })
);

const smallDisc01InterfaceBlocked = generateEngineeringOutputs(makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass", "recording"],
  scope: "full",
  microphoneSolution: "smallDisc01",
  computer: "讲台电脑、笔记本电脑",
  recordingHost: "录播主机、录播摄像机、中控主机",
  overheadSpeakerMounting: "available",
  smallDiscConnectionMode: "usb"
}), {}, "yinman");
assert.equal(smallDisc01InterfaceBlocked.solutionSelection.drawingBlocked, true);
assert.equal(smallDisc01InterfaceBlocked.solutionSelection.blockingCode, "smallDisc01Interfaces");
assert.match(smallDisc01InterfaceBlocked.solutionSelection.blockingMessage ?? "", /接口数量超过上限/);
assert.equal(smallDisc01InterfaceBlocked.generatedPoints.length, 0);
assert.equal(smallDisc01InterfaceBlocked.connectionLines.length, 0);
assert.equal(smallDisc01InterfaceBlocked.pointValidation.findings.find((finding) => finding.code === "selection.small-disc-01-interfaces")?.severity, "hard");

const smallDisc01Extender = generateEngineeringOutputs(makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "smallDisc01",
  computer: "讲台电脑",
  recordingHost: "录播主机",
  overheadSpeakerMounting: "available",
  smallDiscConnectionMode: "extender"
}), {}, "yinman");
assert.equal(smallDisc01Extender.productSelection.find((item) => item.productId === SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID)?.quantity, 1);
assert.equal(smallDisc01Extender.productSelection.some((item) => item.productId === SMALL_DISC_USB_CABLE_PRODUCT_ID), false);
assert.ok(smallDisc01Extender.connectionLines.some((line) => line.id === "small-disc-01-link-extender"));
assert.ok(smallDisc01Extender.connectionLines.some((line) => line.fromPort === "A OUT"));
assert.ok(smallDisc01Extender.connectionLines.some((line) => line.toPort === "A IN"));

const smallDisc03 = generateEngineeringOutputs(makeProfile({
  length: 10,
  width: 10,
  needs: ["recording"],
  scope: "podium",
  microphoneSolution: "auto",
  recordingHost: "录播主机",
  overheadSpeakerMounting: "available"
}), {}, "yinman");
assert.equal(smallDisc03.solutionSelection.microphone.recommended, "smallDisc03");
assert.equal(smallDisc03.solutionSelection.microphone.selected, "smallDisc03");
assert.equal(smallDisc03.productSelection.find((item) => item.productId === SMALL_DISC_03_PRODUCT_ID)?.quantity, 1);
assert.equal(smallDisc03.productSelection.find((item) => item.productId === SMALL_DISC_03_PRODUCT_ID)?.name, SMALL_DISC_RECORDING_NAME);
assert.equal(smallDisc03.productSelection.find((item) => item.productId === SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID)?.quantity, 1);
assert.equal(
  smallDisc03.productSelection.some((item) => item.quantity > 0 && (item.category === "processor" || item.category === "amplifier" || item.category === "speaker")),
  false,
  JSON.stringify(smallDisc03.productSelection.filter((item) => item.quantity > 0 && (item.category === "processor" || item.category === "amplifier" || item.category === "speaker")))
);
assert.ok(smallDisc03.generatedPoints.filter((point) => point.pickupKind === "smallDisc03").every((point) => point.coverageRadius === 5 && point.installationMode === "hanging"));
assert.ok(smallDisc03.generatedPoints.filter((point) => point.pickupKind === "smallDisc03").every((point) => point.label.startsWith(SMALL_DISC_RECORDING_NAME)));
assert.ok(smallDisc03.connectionLines.some((line) => line.id === "small-disc-03-link-extender"));
assert.doesNotMatch([smallDisc03.audioPlan.summary, smallDisc03.audioPlan.pickupGoal, smallDisc03.audioPlan.amplificationGoal].join(" "), /AFC|AEC/);
const smallDisc03Topology = getTopologyLayoutSnapshot(
  makeProfile({
    length: 10,
    width: 10,
    needs: ["recording"],
    scope: "podium",
    microphoneSolution: "auto",
    recordingHost: "录播主机",
    overheadSpeakerMounting: "available"
  }),
  smallDisc03.connectionLines,
  smallDisc03.generatedPoints
);
assert.equal(smallDisc03Topology.mainDevice, "smallDiscRecording-1");
assert.ok(
  smallDisc03Topology.edges.some((edge) =>
    (edge.from === "smallDiscRecording-1" && edge.to === "smallDiscExtender") ||
    (edge.to === "smallDiscRecording-1" && edge.from === "smallDiscExtender")
  ),
  JSON.stringify(smallDisc03Topology.edges)
);

const rejectedSmallDisc03 = generateEngineeringOutputs(makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  microphoneSolution: "smallDisc03"
}), {}, "yinman");
assert.notEqual(rejectedSmallDisc03.solutionSelection.microphone.selected, "smallDisc03");
assert.equal(rejectedSmallDisc03.productSelection.some((item) => item.productId === SMALL_DISC_03_PRODUCT_ID), false);

const smallDisc01OverLimit = generateEngineeringOutputs(smallDisc01Profile, { [SMALL_DISC_02_PRODUCT_ID]: 4 }, "yinman");
assert.equal(smallDisc01OverLimit.generatedPoints.filter((point) => point.pickupKind === "smallDisc01" || point.pickupKind === "smallDisc02").length, 5);
assert.equal(smallDisc01OverLimit.pointValidation.findings.find((finding) => finding.code === "small-disc.recommended-count")?.severity, "hard");
assert.equal(smallDisc01OverLimit.pointValidation.findings.some((finding) => finding.code === "array.capacity" && finding.severity === "hard"), false);

const smallDisc03OverLimit = generateEngineeringOutputs(makeProfile({
  length: 10,
  width: 10,
  needs: ["recording"],
  scope: "podium",
  microphoneSolution: "auto",
  recordingHost: "录播主机",
  overheadSpeakerMounting: "available"
}), { [SMALL_DISC_03_PRODUCT_ID]: 4 }, "yinman");
assert.equal(smallDisc03OverLimit.productSelection.find((item) => item.productId === SMALL_DISC_03_PRODUCT_ID)?.quantity, 4);
assert.equal(smallDisc03OverLimit.generatedPoints.filter((point) => point.pickupKind === "smallDisc03").length, 4);
assert.equal(smallDisc03OverLimit.pointValidation.findings.find((finding) => finding.code === "small-disc.recommended-count")?.severity, "hard");

const smallDiscNoTopMount = generateEngineeringOutputs(makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  microphoneSolution: "smallDisc01",
  computer: "讲台电脑",
  overheadSpeakerMounting: "unavailable"
}), {}, "yinman");
assert.equal(smallDiscNoTopMount.pointValidation.findings.find((finding) => finding.code === "small-disc.overhead-installation")?.severity, "hard");

const segmentProfile = makeProfile({ length: 8, width: 30, needs: ["recording"], microphoneSolution: "smallDisc03", overheadSpeakerMounting: "available" });
const longSegmentValidation = validatePointPlan({
  profile: segmentProfile,
  brandId: "yinman",
  generatedPoints: [
    { id: "segment-main", type: "arrayMic", label: "小圆盘阵麦03 1", position: { x: 1, y: 2 }, coverageRadius: 5, pickupKind: "smallDisc03", pickupPattern: "full360", installationMode: "hanging", reason: "测试单段" },
    { id: "segment-slave", type: "arrayMic", label: "小圆盘阵麦03 2", position: { x: 22, y: 2 }, coverageRadius: 5, pickupKind: "smallDisc03", pickupPattern: "full360", installationMode: "hanging", reason: "测试单段" }
  ],
  requiredArrayMicCount: 2,
  requiredSpeakerCount: 0
});
assert.equal(SMALL_DISC_LINK_SEGMENT_LIMIT_M, 20);
assert.equal(longSegmentValidation.findings.find((finding) => finding.code === "small-disc.link-segment")?.severity, "hard");

const yinyiSmallDiscDraft = generateEngineeringOutputs(smallDisc01Profile, {}, "yinyi");
assert.equal(yinyiSmallDiscDraft.productSelection.some((item) => [SMALL_DISC_01_PRODUCT_ID, SMALL_DISC_02_PRODUCT_ID, SMALL_DISC_03_PRODUCT_ID, SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID].includes(item.productId)), false);
assert.equal(yinyiSmallDiscDraft.generatedPoints.some((point) => point.pickupKind === "smallDisc01" || point.pickupKind === "smallDisc02" || point.pickupKind === "smallDisc03"), false);
console.log("PASS Yinman small-disc automatic/manual selection, wall-only output, USB/extender topology, recommendation and review boundaries");

const getOutputSpeakers = (outputs) => outputs.generatedPoints.filter((point) => point.type === "speaker");
const getOutputLineMic = (outputs) => outputs.generatedPoints.find((point) => point.pickupKind === "lineArray");
const wallOverride = { "COLUMN-SPEAKER": 2 };
const shortNarrowLineWall = generateEngineeringOutputs(makeProfile({ length: 6, width: 6, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), wallOverride, "yinyi");
const shortNarrowMic = getOutputLineMic(shortNarrowLineWall);
assert.deepEqual(getOutputSpeakers(shortNarrowLineWall).map((point) => point.position), [{ x: 0, y: Math.round((shortNarrowMic.position.y + 0.3) * 10) / 10 }, { x: 6, y: Math.round((shortNarrowMic.position.y + 0.3) * 10) / 10 }]);
assert.ok(getOutputSpeakers(shortNarrowLineWall).every((point) => point.speakerSignalMode === "afc" && point.target.y > point.position.y));

const shortWideLineWall = generateEngineeringOutputs(makeProfile({ length: 6, width: 7, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), wallOverride, "yinyi");
const shortWideMic = getOutputLineMic(shortWideLineWall);
assert.ok(shortWideMic);
assert.deepEqual(getOutputSpeakers(shortWideLineWall).map((point) => point.position), [{ x: 0, y: Math.round((shortWideMic.position.y + 0.3) * 10) / 10 }, { x: 7, y: Math.round((shortWideMic.position.y + 0.3) * 10) / 10 }]);
assert.ok(getOutputSpeakers(shortWideLineWall).every((point) => point.speakerSignalMode === "afc" && point.target.y > point.position.y));

const widthBoundaryModes = [6, 6.1, 8, 8.1].map((width) => {
  const outputs = generateEngineeringOutputs(makeProfile({ length: 6, width, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), wallOverride, "yinyi");
  const speakers = getOutputSpeakers(outputs);
  return speakers.every((point) => point.position.y === 6) ? "back" : speakers.every((point) => point.position.x === 0 || point.position.x === width) ? "side" : "original";
});
assert.deepEqual(widthBoundaryModes, ["side", "side", "side", "side"]);

const offsetBoundaryY = [6, 9, 12].map((length) => {
  const outputs = generateEngineeringOutputs(makeProfile({ length, width: 7, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), wallOverride, "yinyi");
  return {
    micY: getOutputLineMic(outputs).position.y,
    speakerY: getOutputSpeakers(outputs)[0].position.y
  };
});
assert.deepEqual(offsetBoundaryY.map(({ micY, speakerY }) => speakerY), [0.3, 0.65, 1].map((offset, index) => Math.round((offsetBoundaryY[index].micY + offset) * 10) / 10));

const shortRoomDefaultCases = [
  { length: 10, width: 12.9, expectedCount: 2 },
  { length: 10, width: 13, expectedCount: 3 },
  { length: 10, width: 16.1, expectedCount: 3 },
  { length: 10, width: 18, expectedCount: 3 },
  { length: 10, width: 18.1, expectedCount: 4 },
  { length: 10, width: 20, expectedCount: 4 }
].map(({ length, width, expectedCount }) => {
  const outputs = generateEngineeringOutputs(makeProfile({ length, width, teachingWidth: 6, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), {}, "yinyi");
  assert.equal(getOutputSpeakers(outputs).length, expectedCount);
  return outputs;
});
const shortRoomTwoSpeakers = getOutputSpeakers(shortRoomDefaultCases[0]);
assert.ok(shortRoomTwoSpeakers.every((point) => point.position.x === 0 || point.position.x === 12.9));
assert.ok(shortRoomTwoSpeakers.every((point) => 10 - point.position.y <= 7));
assert.equal(shortRoomDefaultCases[0].pointValidation.findings.some((finding) => finding.code === "speaker.line-array-two-wall-coverage"), false);
const shortRoomCenterFill = shortRoomDefaultCases[1];
const shortRoomCenterSpeakers = getOutputSpeakers(shortRoomCenterFill);
const rearCenterSpeaker = shortRoomCenterSpeakers.find((point) => point.label.includes("后墙中置"));
assert.ok(rearCenterSpeaker);
assert.deepEqual(rearCenterSpeaker.position, { x: 6.5, y: 10 });
assert.equal(rearCenterSpeaker.speakerSignalMode, "afc");
assert.equal(rearCenterSpeaker.afcSendLevelOffset, -3);
assert.equal(rearCenterSpeaker.horizontalAngle, 0);
assert.ok(rearCenterSpeaker.target.y > getOutputLineMic(shortRoomCenterFill).position.y + 0.5);
assert.doesNotMatch(rearCenterSpeaker.reason, /AFC|延时|-3dB/);
assert.equal(shortRoomCenterFill.pointValidation.findings.some((finding) => finding.code === "speaker.line-array-odd-wall-count"), false);
const shortRoomAfcConnections = shortRoomCenterFill.connectionLines.filter((line) => line.speakerSignalMode === "afc");
assert.equal(shortRoomAfcConnections.length, 2);
assert.ok(shortRoomAfcConnections.some((line) => line.afcSendLevelOffset === undefined && line.toDevice.includes("× 2")));
assert.ok(shortRoomAfcConnections.some((line) => line.afcSendLevelOffset === -3 && line.toDevice.includes("后墙中置") && line.toDevice.includes("× 1") && line.note.includes("延时和增益对齐")));
const customerVisiblePoints = getCustomerVisiblePoints(shortRoomCenterFill.generatedPoints);
const customerVisibleConnections = getCustomerVisibleConnectionLines(shortRoomCenterFill.connectionLines);
assert.ok(customerVisiblePoints.every((point) => point.speakerSignalMode === undefined && point.afcSendLevelOffset === undefined));
assert.equal(customerVisibleConnections.filter((line) => line.id === "processor-speaker-direct-customer").length, 1);
assert.ok(customerVisibleConnections.every((line) => line.speakerSignalMode === undefined && line.afcSendLevelOffset === undefined));
assert.doesNotMatch(JSON.stringify([customerVisiblePoints, customerVisibleConnections]), /正常AFC|不送线阵AFC|中置AFC|-3dB|延时校准|AFC分组/);
const customerReport = buildReport(makeProfile({ length: 10, width: 13, teachingWidth: 6, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), shortRoomCenterFill);
assert.doesNotMatch(customerReport.reportText, /正常AFC|不送线阵AFC|中置AFC|-3dB|延时校准|AFC分组/);
const yinmanShortRoomCenterFill = generateEngineeringOutputs(makeProfile({ length: 10, width: 13, teachingWidth: 6, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), {}, "yinman");
assert.deepEqual(pointSnapshot(getOutputSpeakers(yinmanShortRoomCenterFill)), pointSnapshot(shortRoomCenterSpeakers));
const shortRoomManualTwo = generateEngineeringOutputs(makeProfile({ length: 10, width: 13, teachingWidth: 6, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), wallOverride, "yinyi");
assert.equal(getOutputSpeakers(shortRoomManualTwo).length, 2);
assert.equal(shortRoomManualTwo.pointValidation.findings.find((finding) => finding.code === "speaker.line-array-center-fill-omitted")?.severity, "warning");
assert.equal(shortRoomManualTwo.pointValidation.findings.some((finding) => finding.code === "speaker.line-array-two-wall-coverage"), false);
const doubleCenterFill = shortRoomDefaultCases[5];
const doubleCenterFillSpeakers = getOutputSpeakers(doubleCenterFill);
assert.deepEqual(doubleCenterFillSpeakers.slice(0, 2).map((point) => point.position), [{ x: 0, y: 3 }, { x: 20, y: 3 }]);
assert.deepEqual(doubleCenterFillSpeakers.slice(2).map((point) => point.position), [{ x: 5, y: 10 }, { x: 15, y: 10 }]);
assert.deepEqual(doubleCenterFillSpeakers.slice(2).map((point) => point.target), [{ x: 7, y: 5 }, { x: 13, y: 5 }]);
assert.ok(doubleCenterFillSpeakers.slice(2).every((point) => point.afcSendLevelOffset === -3));
assert.ok(doubleCenterFillSpeakers.some((point) => point.label.includes("后墙左中区")));
assert.ok(doubleCenterFillSpeakers.some((point) => point.label.includes("后墙右中区")));
const doubleCenterFillConnections = doubleCenterFill.connectionLines.filter((line) => line.speakerSignalMode === "afc");
assert.ok(doubleCenterFillConnections.some((line) => line.afcSendLevelOffset === undefined && line.toDevice.includes("× 2")));
assert.ok(doubleCenterFillConnections.some((line) => line.afcSendLevelOffset === -3 && line.toDevice.includes("× 2")));
const wideManualTwo = generateEngineeringOutputs(makeProfile({ length: 10, width: 20, teachingWidth: 6, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), wallOverride, "yinyi");
assert.equal(wideManualTwo.pointValidation.findings.find((finding) => finding.code === "speaker.line-array-center-fill-omitted")?.limit, 4);
assert.deepEqual(pointSnapshot(getOutputSpeakers(generateEngineeringOutputs(makeProfile({ length: 10, width: 20, teachingWidth: 6, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), {}, "yinman"))), pointSnapshot(doubleCenterFillSpeakers));
const overLengthCenterFill = generateEngineeringOutputs(makeProfile({ length: 10.1, width: 13, teachingWidth: 6, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), {}, "yinyi");
assert.notEqual(getOutputSpeakers(overLengthCenterFill).length, 3);

const shortFourLineWall = generateEngineeringOutputs(makeProfile({ length: 8, width: 7, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), { "COLUMN-SPEAKER": 4 }, "yinyi");
const shortFourSpeakers = getOutputSpeakers(shortFourLineWall);
assert.ok(shortFourSpeakers.slice(0, 2).every((point) => point.position.x === 0 || point.position.x === 7));
assert.ok(shortFourSpeakers.slice(0, 2).every((point) => point.target.y > point.position.y));
assert.ok(shortFourSpeakers.slice(2).every((point) => point.position.y === 8 && point.target.y < point.position.y));

const longFourLineWall = generateEngineeringOutputs(makeProfile({ length: 12, width: 7, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), { "COLUMN-SPEAKER": 4 }, "yinyi");
const longFourSpeakers = getOutputSpeakers(longFourLineWall);
assert.ok(longFourSpeakers.every((point) => point.position.x === 0 || point.position.x === 7));
assert.ok(longFourSpeakers.every((point) => point.target.y > point.position.y));
assert.ok(longFourSpeakers[2].position.y - longFourSpeakers[0].position.y >= 3.3);
assert.ok(longFourSpeakers.every((point) => point.speakerSignalMode === "afc"));
assert.deepEqual(pointSnapshot(getOutputSpeakers(longFourLineWall)), pointSnapshot(getOutputSpeakers(generateEngineeringOutputs(makeProfile({ length: 12, width: 7, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), { "COLUMN-SPEAKER": 4 }, "yinman"))));

const wideFourLineWall = generateEngineeringOutputs(makeProfile({ length: 12, width: 9, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), { "COLUMN-SPEAKER": 4 }, "yinyi");
assert.ok(getOutputSpeakers(wideFourLineWall).slice(0, 2).every((point) => point.position.x === 0 || point.position.x === 9));
assert.ok(getOutputSpeakers(wideFourLineWall).slice(0, 2).every((point) => point.target.y > point.position.y));

const sixLineWallProfile = makeProfile({ length: 6, width: 7, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" });
const sixLineWall = generateEngineeringOutputs(sixLineWallProfile, { "COLUMN-SPEAKER": 6 }, "yinyi");
const oldSixWall = generateEngineeringPoints(sixLineWallProfile, { speakerProductId: "COLUMN-SPEAKER", speakerCount: 6 }).filter((point) => point.type === "speaker");
assert.deepEqual(pointSnapshot(getOutputSpeakers(sixLineWall)), pointSnapshot(oldSixWall));
assert.equal(getOutputSpeakers(sixLineWall).filter((point) => point.speakerSignalMode === "withoutLineArrayAfc").length, 2);

const ceilingLineProfile = makeProfile({ length: 8, width: 8, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "ceiling" });
const ceilingLine = generateEngineeringOutputs(ceilingLineProfile, { "CEILING-SPEAKER": 6 }, "yinyi");
const ceilingArray = generateEngineeringOutputs(makeProfile({ length: 8, width: 8, scope: "podium", microphoneSolution: "existingArray", speakerProductOverride: "ceiling" }), { "CEILING-SPEAKER": 6 }, "yinyi");
assert.deepEqual(getOutputSpeakers(ceilingLine).map((point) => point.position), [
  { x: 2.25, y: 2 }, { x: 5.75, y: 2 },
  { x: 2.25, y: 4 }, { x: 5.75, y: 4 },
  { x: 2.25, y: 6 }, { x: 5.75, y: 6 }
]);
assert.deepEqual(getOutputSpeakers(ceilingArray).map((point) => point.position), [
  { x: 2.25, y: 2 }, { x: 5.75, y: 2 },
  { x: 2.25, y: 4.2 }, { x: 5.75, y: 4.2 },
  { x: 2.25, y: 6 }, { x: 5.75, y: 6 }
]);
const firstCeilingY = Math.min(...getOutputSpeakers(ceilingLine).map((point) => point.position.y));
assert.ok(getOutputSpeakers(ceilingLine).filter((point) => Math.abs(point.position.y - firstCeilingY) <= 0.35).every((point) => point.speakerSignalMode === "withoutLineArrayAfc"));
assert.ok(getOutputSpeakers(ceilingLine).filter((point) => point.position.y - firstCeilingY > 0.35).every((point) => point.speakerSignalMode === "afc"));
assert.equal(ceilingLine.connectionLines.filter((line) => line.speakerSignalMode === "withoutLineArrayAfc").length, 1);
assert.equal(ceilingLine.connectionLines.filter((line) => line.speakerSignalMode === "afc").length, 1);

const currentCeilingGapProfile = makeProfile({
  length: 15.9,
  width: 10.8,
  height: 3.2,
  scope: "podium",
  microphoneSolution: "lineArray",
  speakerProductOverride: "ceiling",
  podiumPosition: "unknown",
  hasPodium: false
});
const currentCeilingGapOutputs = generateEngineeringOutputs(currentCeilingGapProfile, {}, "yinman");
const currentCeilingGapSpeakers = getOutputSpeakers(currentCeilingGapOutputs);
const currentCeilingGapMic = getOutputLineMic(currentCeilingGapOutputs);
assert.equal(currentCeilingGapSpeakers.length, 14);
assert.equal(currentCeilingGapOutputs.productSelection.find((item) => item.productId === "CEILING-SPEAKER")?.quantity, 14);
const currentCenterAxisSpeakers = currentCeilingGapSpeakers.filter((point) => Math.abs(point.position.x - 5.4) <= 0.05);
assert.deepEqual(currentCenterAxisSpeakers.map((point) => Math.round(point.position.y * 10) / 10), [5, 8, 10.9, 13.9]);
assert.ok(currentCeilingGapMic);
assert.ok(currentCenterAxisSpeakers.every((point) => Math.hypot(point.position.x - currentCeilingGapMic.position.x, point.position.y - currentCeilingGapMic.position.y) >= 2));
assert.deepEqual(
  pointSnapshot(currentCeilingGapSpeakers),
  pointSnapshot(getOutputSpeakers(generateEngineeringOutputs(currentCeilingGapProfile, {}, "yinyi")))
);

const horizontalOddAxisProfile = makeProfile({
  length: 10.8,
  width: 15.9,
  scope: "podium",
  microphoneSolution: "lineArray",
  speakerProductOverride: "ceiling",
  podiumPosition: "unknown",
  hasPodium: false,
  teachingWidth: 10
});
const horizontalOddAxisOutputs = generateEngineeringOutputs(horizontalOddAxisProfile, {}, "yinman");
const horizontalOddAxisSpeakers = getOutputSpeakers(horizontalOddAxisOutputs);
const horizontalOddAxisMic = getOutputLineMic(horizontalOddAxisOutputs);
assert.equal(horizontalOddAxisSpeakers.length, 15);
assert.ok(horizontalOddAxisMic);
assert.ok(Math.min(...horizontalOddAxisSpeakers.map((point) => Math.hypot(point.position.x - horizontalOddAxisMic.position.x, point.position.y - horizontalOddAxisMic.position.y))) >= 1.2);
assert.equal(horizontalOddAxisSpeakers.filter((point) => point.speakerSignalMode === "withoutLineArrayAfc").length, 5);
console.log("PASS ceiling odd-axis full-grid preservation, point-level clearance, 1.2m line-array non-AFC exception and brand parity");

const fullLine = generateEngineeringOutputs(makeProfile({ scenario: "meetingRoom", length: 6, width: 6, scope: "full", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), { "COLUMN-SPEAKER": 4 }, "yinyi");
assert.equal(getOutputLineMic(fullLine)?.pickupPattern, "full360");
assert.ok(getOutputSpeakers(fullLine).every((point) => point.speakerSignalMode === undefined));
const oddLineWall = generateEngineeringOutputs(makeProfile({ length: 8, width: 7, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), { "COLUMN-SPEAKER": 3 }, "yinyi");
assert.equal(oddLineWall.pointValidation.findings.find((finding) => finding.code === "speaker.line-array-odd-wall-count")?.severity, "hard");
const insufficientTwoLineWall = generateEngineeringOutputs(makeProfile({ length: 12, width: 7, scope: "podium", microphoneSolution: "lineArray", speakerProductOverride: "wall" }), wallOverride, "yinyi");
assert.equal(insufficientTwoLineWall.pointValidation.findings.find((finding) => finding.code === "speaker.line-array-two-wall-coverage")?.severity, "warning");
console.log("PASS line-array recommendation, processor tiers, short-room 2/3/4 defaults, 10/10.1m and 12.9/13/16.1/18/18.1/20m boundaries, front180 wall placement, AFC groups, ceiling first row, full360 and 6+ preservation");

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
  assert.equal(processor?.name, "高性能处理器");
  assert.equal(processor?.quantity, 1);
  const directNetworkLines = outputs.connectionLines.filter((line) => line.id.startsWith("array-mic-processor-network-"));
  assert.equal(directNetworkLines.length, generatedMicCount);
  if (required > 2) assert.equal(outputs.pointValidation.status, "hard");
  assert.doesNotMatch(JSON.stringify(outputs), /RING08|AJ350/);
}
console.log("PASS Yinman 1/2/3 theoretical mic demand, AJ350-only hard rule, two-mic cap and independent network links");

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

const lineArrayNonAfcResult = validatePointPlan({
  profile: makeProfile(),
  brandId: "yinyi",
  generatedPoints: [
    { id: "line-mic", type: "arrayMic", label: "线阵麦", position: { x: 4, y: 3 }, reason: "测试", pickupKind: "lineArray" },
    { id: "speaker", type: "speaker", label: "吸顶音箱", position: { x: 5.2, y: 3 }, reason: "普通点位", speakerSignalMode: "withoutLineArrayAfc" }
  ],
  requiredArrayMicCount: 1,
  requiredSpeakerCount: 1
});
const lineArrayNonAfcFinding = lineArrayNonAfcResult.findings.find((finding) => finding.code === "speaker.mic-distance");
assert.equal(lineArrayNonAfcFinding?.severity, "info");
assert.equal(lineArrayNonAfcFinding?.limit, "1.2m");
assert.match(lineArrayNonAfcFinding?.internalMessage ?? "", /非AFC音箱1.2m/);

const lineArrayNonAfcTooClose = validatePointPlan({
  profile: makeProfile(),
  brandId: "yinyi",
  generatedPoints: [
    { id: "line-mic", type: "arrayMic", label: "线阵麦", position: { x: 4, y: 3 }, reason: "测试", pickupKind: "lineArray" },
    { id: "speaker", type: "speaker", label: "吸顶音箱", position: { x: 5.1, y: 3 }, reason: "普通点位", speakerSignalMode: "withoutLineArrayAfc" }
  ],
  requiredArrayMicCount: 1,
  requiredSpeakerCount: 1
});
assert.equal(lineArrayNonAfcTooClose.findings.find((finding) => finding.code === "speaker.mic-distance")?.severity, "warning");
console.log("PASS line-array non-AFC 1.2m validation boundary and normal-AFC 2m separation");

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
  loader: { ".png": "dataurl" },
  logLevel: "silent"
});

const bundledCode = result.outputFiles[0]?.text;
if (!bundledCode) throw new Error("Point-system rule test bundle was empty.");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundledCode).toString("base64")}`;
try {
  await import(moduleUrl);
} catch (error) {
  const line = Number(String(error?.stack ?? "").match(/base64,[^:]+:(\d+):\d+/)?.[1]);
  if (Number.isFinite(line)) {
    const lines = bundledCode.split("\n");
    console.error(lines.slice(Math.max(0, line - 3), line + 2).join("\n"));
  }
  throw error;
}
