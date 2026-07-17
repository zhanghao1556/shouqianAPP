import { build } from "esbuild";

const testModule = `
import assert from "node:assert/strict";
import { createInitialProfile } from "./src/features/classroom/data/initialProfile.ts";
import { normalizeProfile } from "./src/features/classroom/lib/profileNormalization.ts";
import { isPointCoveredByGeneratedSpeaker } from "./src/features/classroom/lib/drawingEngine.ts";
import {
  auditSpeakerCoverage,
  CEILING_SPEAKER_AUDIT_EDGE_TOLERANCE_M,
  SPEAKER_COVERAGE_FAILURE_RATIO,
  SPEAKER_COVERAGE_FAILURE_GAP_AREA_M2,
  SPEAKER_COVERAGE_SAMPLE_STEP_M,
  SPEAKER_COVERAGE_WARNING_GAP_AREA_M2,
  SPEAKER_TRIPLE_OVERLAP_FAILURE_RATIO
} from "./src/features/classroom/lib/speakerCoverageAudit.ts";
import { evaluatePatternCandidatesForCase, runSpeakerCoverageSweep } from "./scripts/speakerCoverageAuditRunner.ts";

function makeProfile({ scenario = "standardClassroom", length = 8, width = 8 } = {}) {
  const base = createInitialProfile();
  return normalizeProfile({
    ...base,
    scenario,
    needs: ["localAmplification"],
    amplificationScope: scenario === "meetingRoom" ? "full" : "podium",
    roomGeometry: { length, width, height: 3, scale: 1, coordinateUnit: "meter" },
    existingDevices: { recordingHost: "", computer: "", legacySoundSystem: "", legacyWirelessMic: "", legacySpeakerPoints: [] },
    engineeringConstraints: {
      ...base.engineeringConstraints,
      ceiling: "suspended",
      overheadSpeakerMounting: "available",
      auditoriumRearFillSpeakers: "absent",
      podiumPosition: "frontCenter",
      stageSize: { width: Math.max(1, width * 0.7), depth: Math.max(1, length * 0.2) },
      teachingAreaSize: { width, depth: Math.max(1, length * 0.5) },
      hasCentralAirConditioner: false,
      centralAirConditionerCount: 0,
      centralAirConditionerPoints: [],
      notes: ""
    },
    acousticEnvironment: {
      floorMaterial: "wood",
      wallMaterial: "painted",
      softTreatment: "mixed",
      furnishingDensity: "normal",
      hasGlassWall: false,
      ceilingAcousticTreatment: "partial",
      glassCoverage: "none",
      echoObservation: "none"
    }
  });
}

function ceiling(id, x, y, radius = 20, signal) {
  return { id, type: "speaker", label: "吸顶音箱", position: { x, y }, coverageRadius: radius, speakerSignalMode: signal, reason: "test" };
}

const profile = makeProfile();
const wall = {
  id: "wall",
  type: "speaker",
  label: "壁挂音箱",
  position: { x: 0, y: 4 },
  target: { x: 6, y: 4 },
  horizontalAngle: 0,
  coverageRadius: 6,
  reason: "test"
};
assert.equal(isPointCoveredByGeneratedSpeaker(profile, wall, { x: 4, y: 4 }), true);
assert.equal(isPointCoveredByGeneratedSpeaker(profile, wall, { x: 0.5, y: 0.5 }), false);
assert.equal(isPointCoveredByGeneratedSpeaker(profile, ceiling("circle", 4, 4, 2), { x: 5.9, y: 4 }), true);
assert.equal(isPointCoveredByGeneratedSpeaker(profile, ceiling("circle", 4, 4, 2), { x: 6.1, y: 4 }), false);

const emptyAudit = auditSpeakerCoverage(profile, []);
assert.equal(emptyAudit.status, "fail");
assert.equal(emptyAudit.primaryListeningArea.uncoveredRatio, 1);

const coveredAudit = auditSpeakerCoverage(profile, [ceiling("all", 4, 4)]);
assert.equal(coveredAudit.status, "pass");
assert.equal(coveredAudit.primaryListeningArea.uncoveredRatio, 0);

const overlapAudit = auditSpeakerCoverage(profile, [ceiling("a", 4, 4), ceiling("b", 4, 4), ceiling("c", 4, 4)]);
assert.equal(overlapAudit.status, "pass");
assert.equal(overlapAudit.primaryListeningArea.triplePlusCoverageRatio, 1);
assert.deepEqual(overlapAudit.issueCodes, []);

const lineMic = {
  id: "line",
  type: "arrayMic",
  label: "线阵麦",
  position: { x: 4, y: 2 },
  pickupKind: "lineArray",
  pickupPattern: "front180",
  reason: "test"
};
const filteredAudit = auditSpeakerCoverage(profile, [
  lineMic,
  ceiling("muted", 4, 4, 20, "withoutLineArrayAfc"),
  ceiling("afc", 4, 7, 1, "afc")
]);
assert.deepEqual(filteredAudit.ignoredSpeakerIds, ["muted"]);
assert.deepEqual(filteredAudit.activeSpeakerIds, ["afc"]);
assert.ok(filteredAudit.primaryListeningArea.uncoveredRatio > 0.5);

const meeting = makeProfile({ scenario: "meetingRoom", length: 7, width: 8 });
const meetingAudit = auditSpeakerCoverage(meeting, [ceiling("meeting-all", 4, 3.5)]);
assert.equal(meetingAudit.seatChecks.length > 0, true);
assert.equal(meetingAudit.seatChecks.every((seat) => seat.covered), true);

assert.equal(SPEAKER_COVERAGE_SAMPLE_STEP_M, 0.25);
assert.equal(SPEAKER_COVERAGE_FAILURE_RATIO, 0.1);
assert.equal(CEILING_SPEAKER_AUDIT_EDGE_TOLERANCE_M, 0.35);
assert.equal(SPEAKER_COVERAGE_WARNING_GAP_AREA_M2, 2);
assert.equal(SPEAKER_COVERAGE_FAILURE_GAP_AREA_M2, 4);
assert.equal(SPEAKER_TRIPLE_OVERLAP_FAILURE_RATIO, 0.35);

const firstSweep = runSpeakerCoverageSweep(20260717);
const secondSweep = runSpeakerCoverageSweep(20260717);
assert.equal(firstSweep.caseCount, 636);
assert.equal(firstSweep.summaryHash, secondSweep.summaryHash);
assert.deepEqual(firstSweep.phaseCounts, secondSweep.phaseCounts);
assert.equal(firstSweep.phaseCounts.experimental, 24);
assert.ok(firstSweep.clusters.length > 0);
const approvedShortRoom = firstSweep.cases.find((item) => item.id === "boundary-051");
assert.equal(approvedShortRoom?.status, "pass");
assert.equal(approvedShortRoom?.coverage?.assessmentBasis, "approved-line-array-short-room-layout");

function assertSymmetricCandidate(caseId, patternId) {
  const source = firstSweep.cases.find((item) => item.id === caseId);
  assert.ok(source, "missing source case " + caseId);
  const candidate = evaluatePatternCandidatesForCase(source).find((item) => item.id === patternId);
  assert.ok(candidate, "missing candidate " + patternId);
  const speakers = candidate.points.filter((point) => point.type === "speaker");
  const width = source.profile.roomGeometry.width;
  for (const speaker of speakers) {
    const mirror = speakers.find((item) =>
      Math.abs(item.position.x - (width - speaker.position.x)) <= 0.11 &&
      Math.abs(item.position.y - speaker.position.y) <= 0.11
    );
    assert.ok(mirror, caseId + "/" + patternId + " has an unpaired speaker " + speaker.id);
    if (speaker.target && mirror.target) {
      assert.ok(Math.abs(mirror.target.x - (width - speaker.target.x)) <= 0.11);
      assert.ok(Math.abs(mirror.target.y - speaker.target.y) <= 0.11);
    }
  }
}

assertSymmetricCandidate("formal-106", "ceiling-responsibility-grid");
assertSymmetricCandidate("formal-236", "line-optimized-responsibility");
assertSymmetricCandidate("formal-008", "meeting-symmetric-zoned-pairs");
assertSymmetricCandidate("boundary-073", "wall-optimized-responsibility");
console.log("PASS speaker coverage geometry, thresholds, AFC filtering, seats and deterministic sweep");
`;

const result = await build({
  stdin: {
    contents: testModule,
    loader: "ts",
    resolveDir: process.cwd(),
    sourcefile: "speaker-coverage-audit-check.ts"
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  write: false,
  logLevel: "silent"
});

const bundledCode = result.outputFiles[0]?.text;
if (!bundledCode) throw new Error("Speaker coverage audit test bundle was empty.");
await import(`data:text/javascript;base64,${Buffer.from(bundledCode).toString("base64")}`);
