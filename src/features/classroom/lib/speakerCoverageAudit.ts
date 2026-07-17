import type { ClassroomProfile, GeneratedPoint, Point } from "../types";
import { isPointCoveredByGeneratedSpeaker } from "./drawingEngine";
import { getMeetingFurnitureLayout } from "./meetingFurnitureRules";

export const SPEAKER_COVERAGE_SAMPLE_STEP_M = 0.25;
export const SPEAKER_COVERAGE_WARNING_RATIO = 0.05;
export const SPEAKER_COVERAGE_FAILURE_RATIO = 0.1;
export const SPEAKER_TRIPLE_OVERLAP_WARNING_RATIO = 0.2;
export const SPEAKER_TRIPLE_OVERLAP_FAILURE_RATIO = 0.35;
export const CEILING_SPEAKER_AUDIT_EDGE_TOLERANCE_M = 0.35;
export const SPEAKER_COVERAGE_WARNING_GAP_AREA_M2 = 2;
export const SPEAKER_COVERAGE_FAILURE_GAP_AREA_M2 = 4;

export type SpeakerCoverageAuditStatus = "pass" | "warning" | "fail";

export interface SpeakerCoverageRegion {
  sampleCount: number;
  uncoveredRatio: number;
  singleCoverageRatio: number;
  doubleCoverageRatio: number;
  triplePlusCoverageRatio: number;
  largestUncoveredRegion?: SpeakerCoverageConnectedRegion;
  largestTripleOverlapRegion?: SpeakerCoverageConnectedRegion;
}

export interface SpeakerCoverageConnectedRegion {
  sampleCount: number;
  areaM2: number;
  center: Point;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export interface SpeakerCoverageSeatCheck {
  id: string;
  position: Point;
  coverageCount: number;
  covered: boolean;
}

export interface SpeakerCoverageAuditResult {
  status: SpeakerCoverageAuditStatus;
  assessmentBasis: "coverage-grid" | "approved-line-array-short-room-layout";
  primaryListeningArea: SpeakerCoverageRegion;
  wholeRoom: SpeakerCoverageRegion;
  seatChecks: SpeakerCoverageSeatCheck[];
  activeSpeakerIds: string[];
  ignoredSpeakerIds: string[];
  issueCodes: string[];
  rootCauseSignature: string;
}

export interface SpeakerPrimaryListeningArea {
  kind: "seats" | "bounds";
  bounds?: { minX: number; maxX: number; minY: number; maxY: number };
  cornerCutM?: number;
  seats?: Array<{ id: string; position: Point }>;
}

interface CoverageSample {
  gridX: number;
  gridY: number;
  position: Point;
  coverageCount: number;
}

export interface SpeakerCoverageHeatmapSample {
  position: Point;
  coverageCount: number;
}

export function auditSpeakerCoverage(
  profile: ClassroomProfile,
  generatedPoints: GeneratedPoint[]
): SpeakerCoverageAuditResult {
  const speakers = generatedPoints.filter((point) => point.type === "speaker");
  const activeSpeakers = getActiveLocalAmplificationSpeakers(generatedPoints);
  const activeSpeakerIds = activeSpeakers.map((speaker) => speaker.id);
  const ignoredSpeakerIds = speakers.filter((speaker) => !activeSpeakerIds.includes(speaker.id)).map((speaker) => speaker.id);
  const primaryPredicate = getPrimaryListeningAreaPredicate(profile);
  const primaryListeningArea = auditRegion(profile, activeSpeakers, primaryPredicate);
  const wholeRoom = auditRegion(profile, activeSpeakers, () => true);
  const seatChecks = getSeatChecks(profile, activeSpeakers);
  const issueCodes: string[] = [];
  const usesApprovedLineArrayShortRoomLayout = isApprovedLineArrayShortRoomWallLayout(profile, generatedPoints, activeSpeakers);

  if (!usesApprovedLineArrayShortRoomLayout) {
    const largestGapArea = primaryListeningArea.largestUncoveredRegion?.areaM2 ?? 0;
    if (primaryListeningArea.uncoveredRatio > SPEAKER_COVERAGE_FAILURE_RATIO && largestGapArea >= SPEAKER_COVERAGE_FAILURE_GAP_AREA_M2) issueCodes.push("uncovered.fail");
    else if (primaryListeningArea.uncoveredRatio >= SPEAKER_COVERAGE_WARNING_RATIO && largestGapArea >= SPEAKER_COVERAGE_WARNING_GAP_AREA_M2) issueCodes.push("uncovered.warning");
    if (seatChecks.some((seat) => !seat.covered)) issueCodes.push("seat.uncovered");
  }

  const status: SpeakerCoverageAuditStatus = issueCodes.some((code) => code.endsWith(".fail") || code === "seat.uncovered")
    ? "fail"
    : issueCodes.length
      ? "warning"
      : "pass";

  return {
    status,
    assessmentBasis: usesApprovedLineArrayShortRoomLayout ? "approved-line-array-short-room-layout" : "coverage-grid",
    primaryListeningArea,
    wholeRoom,
    seatChecks,
    activeSpeakerIds,
    ignoredSpeakerIds,
    issueCodes,
    rootCauseSignature: getRootCauseSignature(profile, generatedPoints, activeSpeakers, issueCodes, primaryListeningArea)
  };
}

function isApprovedLineArrayShortRoomWallLayout(
  profile: ClassroomProfile,
  generatedPoints: GeneratedPoint[],
  activeSpeakers: GeneratedPoint[]
) {
  if (profile.roomGeometry.length > 10) return false;
  if (!generatedPoints.some((point) => point.type === "arrayMic" && point.pickupKind === "lineArray" && point.pickupPattern === "front180")) return false;
  if (activeSpeakers.some((speaker) => speaker.label.includes("吸顶音箱"))) return false;

  const { width, length } = profile.roomGeometry;
  const sidePair = activeSpeakers.filter((speaker) =>
    (Math.abs(speaker.position.x) <= 0.1 || Math.abs(speaker.position.x - width) <= 0.1) &&
    speaker.position.y > 0.1 && speaker.position.y < length - 0.1
  );
  if (sidePair.length !== 2 || Math.abs(sidePair[0].position.y - sidePair[1].position.y) > 0.1) return false;
  const rearFillCount = activeSpeakers.filter((speaker) => Math.abs(speaker.position.y - length) <= 0.1).length;
  const expectedRearFillCount = width < 13 ? 0 : width <= 18 ? 1 : 2;
  return activeSpeakers.length === 2 + expectedRearFillCount && rearFillCount === expectedRearFillCount;
}

export function getActiveLocalAmplificationSpeakers(generatedPoints: GeneratedPoint[]) {
  const speakers = generatedPoints.filter((point) => point.type === "speaker");
  const hasFrontLineArray = generatedPoints.some(
    (point) => point.type === "arrayMic" && point.pickupKind === "lineArray" && point.pickupPattern === "front180"
  );
  return hasFrontLineArray ? speakers.filter((speaker) => speaker.speakerSignalMode === "afc") : speakers;
}

export function getSpeakerCoverageHeatmap(
  profile: ClassroomProfile,
  generatedPoints: GeneratedPoint[]
): SpeakerCoverageHeatmapSample[] {
  const activeSpeakers = getActiveLocalAmplificationSpeakers(generatedPoints);
  const includesPoint = getPrimaryListeningAreaPredicate(profile);
  const columns = Math.max(1, Math.ceil(profile.roomGeometry.width / SPEAKER_COVERAGE_SAMPLE_STEP_M));
  const rows = Math.max(1, Math.ceil(profile.roomGeometry.length / SPEAKER_COVERAGE_SAMPLE_STEP_M));
  const samples: SpeakerCoverageHeatmapSample[] = [];
  for (let gridX = 0; gridX < columns; gridX += 1) {
    for (let gridY = 0; gridY < rows; gridY += 1) {
      const position = {
        x: Math.min(profile.roomGeometry.width - 0.0001, (gridX + 0.5) * SPEAKER_COVERAGE_SAMPLE_STEP_M),
        y: Math.min(profile.roomGeometry.length - 0.0001, (gridY + 0.5) * SPEAKER_COVERAGE_SAMPLE_STEP_M)
      };
      if (!includesPoint(position)) continue;
      samples.push({
        position,
        coverageCount: activeSpeakers.filter((speaker) => isPointCoveredForAudit(profile, speaker, position)).length
      });
    }
  }
  return samples;
}

function auditRegion(
  profile: ClassroomProfile,
  speakers: GeneratedPoint[],
  includesPoint: (point: Point) => boolean
): SpeakerCoverageRegion {
  const samples: CoverageSample[] = [];
  const columns = Math.max(1, Math.ceil(profile.roomGeometry.width / SPEAKER_COVERAGE_SAMPLE_STEP_M));
  const rows = Math.max(1, Math.ceil(profile.roomGeometry.length / SPEAKER_COVERAGE_SAMPLE_STEP_M));

  for (let gridX = 0; gridX < columns; gridX += 1) {
    for (let gridY = 0; gridY < rows; gridY += 1) {
      const position = {
        x: Math.min(profile.roomGeometry.width - 0.0001, (gridX + 0.5) * SPEAKER_COVERAGE_SAMPLE_STEP_M),
        y: Math.min(profile.roomGeometry.length - 0.0001, (gridY + 0.5) * SPEAKER_COVERAGE_SAMPLE_STEP_M)
      };
      if (!includesPoint(position)) continue;
      samples.push({
        gridX,
        gridY,
        position,
        coverageCount: speakers.reduce(
          (count, speaker) => count + (isPointCoveredForAudit(profile, speaker, position) ? 1 : 0),
          0
        )
      });
    }
  }

  const sampleCount = samples.length;
  if (!sampleCount) {
    return {
      sampleCount: 0,
      uncoveredRatio: 0,
      singleCoverageRatio: 0,
      doubleCoverageRatio: 0,
      triplePlusCoverageRatio: 0
    };
  }

  return {
    sampleCount,
    uncoveredRatio: ratio(samples, (sample) => sample.coverageCount === 0),
    singleCoverageRatio: ratio(samples, (sample) => sample.coverageCount === 1),
    doubleCoverageRatio: ratio(samples, (sample) => sample.coverageCount === 2),
    triplePlusCoverageRatio: ratio(samples, (sample) => sample.coverageCount >= 3),
    largestUncoveredRegion: getLargestConnectedRegion(samples.filter((sample) => sample.coverageCount === 0)),
    largestTripleOverlapRegion: getLargestConnectedRegion(samples.filter((sample) => sample.coverageCount >= 3))
  };
}

function ratio(samples: CoverageSample[], matches: (sample: CoverageSample) => boolean) {
  return samples.filter(matches).length / samples.length;
}

function getLargestConnectedRegion(samples: CoverageSample[]): SpeakerCoverageConnectedRegion | undefined {
  if (!samples.length) return undefined;
  const sampleByGrid = new Map(samples.map((sample) => [`${sample.gridX}:${sample.gridY}`, sample]));
  const visited = new Set<string>();
  let largest: CoverageSample[] = [];

  for (const sample of samples) {
    const startKey = `${sample.gridX}:${sample.gridY}`;
    if (visited.has(startKey)) continue;
    const queue = [sample];
    const connected: CoverageSample[] = [];
    visited.add(startKey);
    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;
      connected.push(current);
      for (const [nextX, nextY] of [
        [current.gridX - 1, current.gridY],
        [current.gridX + 1, current.gridY],
        [current.gridX, current.gridY - 1],
        [current.gridX, current.gridY + 1]
      ]) {
        const key = `${nextX}:${nextY}`;
        const next = sampleByGrid.get(key);
        if (!next || visited.has(key)) continue;
        visited.add(key);
        queue.push(next);
      }
    }
    if (connected.length > largest.length) largest = connected;
  }

  const xs = largest.map((sample) => sample.position.x);
  const ys = largest.map((sample) => sample.position.y);
  return {
    sampleCount: largest.length,
    areaM2: round(largest.length * SPEAKER_COVERAGE_SAMPLE_STEP_M ** 2, 2),
    center: {
      x: round(xs.reduce((sum, value) => sum + value, 0) / xs.length, 2),
      y: round(ys.reduce((sum, value) => sum + value, 0) / ys.length, 2)
    },
    bounds: {
      minX: round(Math.min(...xs) - SPEAKER_COVERAGE_SAMPLE_STEP_M / 2, 2),
      maxX: round(Math.max(...xs) + SPEAKER_COVERAGE_SAMPLE_STEP_M / 2, 2),
      minY: round(Math.min(...ys) - SPEAKER_COVERAGE_SAMPLE_STEP_M / 2, 2),
      maxY: round(Math.max(...ys) + SPEAKER_COVERAGE_SAMPLE_STEP_M / 2, 2)
    }
  };
}

function getPrimaryListeningAreaPredicate(profile: ClassroomProfile) {
  const area = getSpeakerPrimaryListeningArea(profile);
  if (area.kind === "seats") return (point: Point) => area.seats?.some((seat) => distance(point, seat.position) <= 0.38) ?? false;
  const bounds = area.bounds;
  return (point: Point) => {
    if (!bounds || point.x < bounds.minX || point.x > bounds.maxX || point.y < bounds.minY || point.y > bounds.maxY) return false;
    const cut = area.cornerCutM ?? 0;
    if (!cut) return true;
    const left = point.x - bounds.minX;
    const right = bounds.maxX - point.x;
    const front = point.y - bounds.minY;
    const rear = bounds.maxY - point.y;
    return !(
      left + front < cut || right + front < cut ||
      left + rear < cut || right + rear < cut
    );
  };
}

export function getSpeakerPrimaryListeningArea(profile: ClassroomProfile): SpeakerPrimaryListeningArea {
  const { width, length } = profile.roomGeometry;
  if (profile.scenario === "meetingRoom") {
    return {
      kind: "seats",
      seats: getMeetingFurnitureLayout(profile).seats.map((seat) => ({ id: seat.id, position: seat.position }))
    };
  }

  const sideMargin = Math.min(
    profile.scenario === "auditorium" ? 1.2 : profile.scenario === "standardClassroom" ? (width <= 6 ? 0.6 : width <= 10 ? 0.8 : 1) : 1,
    width / 4
  );
  const rearMargin = Math.min(profile.scenario === "auditorium" ? 1.2 : profile.scenario === "standardClassroom" ? 0.8 : 1, length / 4);
  const preferredStart = profile.scenario === "combinedClassroom"
    ? profile.engineeringConstraints.teachingAreaSize.depth
    : profile.scenario === "auditorium"
      ? profile.engineeringConstraints.stageSize.depth
      : profile.scenario === "lectureClassroom"
        ? 4.4
        : Math.min(4, Math.max(2.8, length * 0.3));
  const startY = Math.min(Math.max(0, preferredStart), Math.max(0, length - rearMargin - SPEAKER_COVERAGE_SAMPLE_STEP_M));
  const endY = Math.max(startY + SPEAKER_COVERAGE_SAMPLE_STEP_M, length - rearMargin);
  return {
    kind: "bounds",
    bounds: { minX: sideMargin, maxX: width - sideMargin, minY: startY, maxY: endY },
    cornerCutM: profile.scenario === "auditorium" ? 0.9 : 0.7
  };
}

function getSeatChecks(profile: ClassroomProfile, speakers: GeneratedPoint[]): SpeakerCoverageSeatCheck[] {
  if (profile.scenario !== "meetingRoom") return [];
  return getMeetingFurnitureLayout(profile).seats.map((seat) => {
    const coverageCount = speakers.filter((speaker) => isPointCoveredForAudit(profile, speaker, seat.position)).length;
    return {
      id: seat.id,
      position: seat.position,
      coverageCount,
      covered: coverageCount > 0
    };
  });
}

function isPointCoveredForAudit(profile: ClassroomProfile, speaker: GeneratedPoint, point: Point) {
  if (isPointCoveredByGeneratedSpeaker(profile, speaker, point)) return true;
  const isCeilingSpeaker = speaker.label.includes("吸顶音箱") || (speaker.horizontalAngle === undefined && speaker.downTiltAngle === undefined);
  if (!isCeilingSpeaker) return false;
  return isPointCoveredByGeneratedSpeaker(profile, {
    ...speaker,
    coverageRadius: (speaker.coverageRadius ?? 2) + CEILING_SPEAKER_AUDIT_EDGE_TOLERANCE_M
  }, point);
}

function getRootCauseSignature(
  profile: ClassroomProfile,
  points: GeneratedPoint[],
  speakers: GeneratedPoint[],
  issueCodes: string[],
  region: SpeakerCoverageRegion
) {
  const microphoneMode = points.some((point) => point.pickupKind === "lineArray")
    ? points.some((point) => point.pickupPattern === "front180") ? "line-front" : "line-full"
    : "array";
  const speakerMode = speakers.some((speaker) => speaker.horizontalAngle !== undefined || speaker.downTiltAngle !== undefined)
    ? "wall"
    : "ceiling";
  return [
    profile.scenario,
    profile.amplificationScope,
    microphoneMode,
    speakerMode,
    `count-${speakers.length}`,
    issueCodes.sort().join("+") || "pass",
    getRegionLocation(profile, region.largestUncoveredRegion)
  ].join("|");
}

function getRegionLocation(profile: ClassroomProfile, region?: SpeakerCoverageConnectedRegion) {
  if (!region) return "none";
  const xRatio = region.center.x / Math.max(profile.roomGeometry.width, 0.1);
  const yRatio = region.center.y / Math.max(profile.roomGeometry.length, 0.1);
  const horizontal = xRatio < 1 / 3 ? "left" : xRatio > 2 / 3 ? "right" : "center";
  const vertical = yRatio < 1 / 3 ? "front" : yRatio > 2 / 3 ? "rear" : "middle";
  return `${vertical}-${horizontal}`;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
