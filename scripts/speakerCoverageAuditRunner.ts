import { createHash } from "node:crypto";
import { createInitialProfile } from "../src/features/classroom/data/initialProfile";
import { generateEngineeringOutputs } from "../src/features/classroom/lib/engineeringRules";
import { getMeetingFurnitureLayout } from "../src/features/classroom/lib/meetingFurnitureRules";
import { normalizeProfile } from "../src/features/classroom/lib/profileNormalization";
import {
  auditSpeakerCoverage,
  getSpeakerCoverageHeatmap,
  getSpeakerPrimaryListeningArea,
  type SpeakerCoverageAuditResult
} from "../src/features/classroom/lib/speakerCoverageAudit";
import { generateBrandEngineeringPoints } from "../src/features/classroom/lib/systemCapabilities";
import type { AppBrandId } from "../src/features/classroom/brand";
import type {
  AmplificationScope,
  ClassroomProfile,
  GeneratedPoint,
  GeneratedOutputs,
  MicrophoneSolution,
  Point,
  PodiumPosition,
  Scenario,
  SpeakerProductOverride
} from "../src/features/classroom/types";

const DEFAULT_SEED = 20260717;

type SweepPhase = "formal" | "boundary" | "experimental" | "stress";
type SweepStatus = "pass" | "warning" | "fail" | "drawing-blocked" | "capacity-limited" | "special-design" | "experimental-normalized";

interface ScenarioRange {
  scenario: Scenario;
  scopes: AmplificationScope[];
  length: [number, number];
  width: [number, number];
  height: [number, number];
}

interface CaseSpec {
  id: string;
  phase: SweepPhase;
  brandId: AppBrandId;
  scenario: Scenario;
  requestedScope: AmplificationScope;
  microphoneSolution: Exclude<MicrophoneSolution, "auto">;
  speakerProductOverride: Exclude<SpeakerProductOverride, "auto">;
  length: number;
  width: number;
  height: number;
  podiumPosition?: PodiumPosition;
  centralAirPoints?: ClassroomProfile["engineeringConstraints"]["centralAirConditionerPoints"];
}

export interface SpeakerCoverageSweepCase {
  id: string;
  phase: SweepPhase;
  brandId: AppBrandId;
  scenario: Scenario;
  requestedScope: AmplificationScope;
  effectiveScope: AmplificationScope;
  microphoneSolution: Exclude<MicrophoneSolution, "auto">;
  speakerProductOverride: Exclude<SpeakerProductOverride, "auto">;
  room: { length: number; width: number; height: number };
  status: SweepStatus;
  statusReason: string;
  profile: ClassroomProfile;
  generatedPoints: GeneratedOutputs["generatedPoints"];
  speakerCount: number;
  activeSpeakerCount: number;
  validationCodes: string[];
  coverage?: SpeakerCoverageAuditResult;
}

export interface SpeakerCoverageSweepCluster {
  signature: string;
  status: "warning" | "fail";
  caseCount: number;
  brands: AppBrandId[];
  scenarios: Scenario[];
  minRoom: { length: number; width: number; height: number };
  maxRoom: { length: number; width: number; height: number };
  worstUncoveredRatio: number;
  worstTripleOverlapRatio: number;
  uncoveredSeatCount: number;
  representativeCaseId: string;
}

export interface SpeakerCoverageSweepResult {
  seed: number;
  summaryHash: string;
  caseCount: number;
  statusCounts: Record<SweepStatus, number>;
  phaseCounts: Record<SweepPhase, number>;
  cases: SpeakerCoverageSweepCase[];
  clusters: SpeakerCoverageSweepCluster[];
}

const scenarioRanges: ScenarioRange[] = [
  { scenario: "meetingRoom", scopes: ["full"], length: [4, 20], width: [4, 20], height: [2.4, 4.5] },
  { scenario: "standardClassroom", scopes: ["podium", "full"], length: [5, 24], width: [4, 18], height: [2.6, 5.5] },
  { scenario: "lectureClassroom", scopes: ["podium"], length: [8, 30], width: [6, 20], height: [3.2, 8] },
  { scenario: "combinedClassroom", scopes: ["podium"], length: [10, 30], width: [8, 22], height: [3.2, 8] },
  { scenario: "auditorium", scopes: ["podium"], length: [12, 40], width: [8, 30], height: [4, 12] }
];

const boundaryRooms: Array<{ scenario: Scenario; scope: AmplificationScope; length: number; width: number; height: number }> = [
  { scenario: "standardClassroom", scope: "podium", length: 5.9, width: 8, height: 3 },
  { scenario: "standardClassroom", scope: "podium", length: 6, width: 8, height: 3 },
  { scenario: "standardClassroom", scope: "podium", length: 6.1, width: 8, height: 3 },
  { scenario: "standardClassroom", scope: "podium", length: 6, width: 7.9, height: 3 },
  { scenario: "standardClassroom", scope: "podium", length: 6, width: 8.1, height: 3 },
  { scenario: "standardClassroom", scope: "podium", length: 9.9, width: 13, height: 3.2 },
  { scenario: "standardClassroom", scope: "podium", length: 10, width: 13, height: 3.2 },
  { scenario: "standardClassroom", scope: "podium", length: 10.1, width: 13, height: 3.2 },
  { scenario: "standardClassroom", scope: "podium", length: 10, width: 12.9, height: 3.2 },
  { scenario: "standardClassroom", scope: "podium", length: 10, width: 13.1, height: 3.2 },
  { scenario: "standardClassroom", scope: "full", length: 12, width: 13.9, height: 3.6 },
  { scenario: "standardClassroom", scope: "full", length: 12, width: 14, height: 3.6 },
  { scenario: "standardClassroom", scope: "full", length: 12, width: 14.1, height: 3.6 },
  { scenario: "standardClassroom", scope: "podium", length: 10, width: 15.9, height: 3.5 },
  { scenario: "standardClassroom", scope: "podium", length: 10, width: 16, height: 3.5 },
  { scenario: "standardClassroom", scope: "podium", length: 10, width: 16.1, height: 3.5 },
  { scenario: "standardClassroom", scope: "podium", length: 10, width: 17.9, height: 3.5 },
  { scenario: "standardClassroom", scope: "podium", length: 10, width: 18, height: 3.5 },
  { scenario: "standardClassroom", scope: "podium", length: 10, width: 18.1, height: 3.5 },
  { scenario: "meetingRoom", scope: "full", length: 11.9, width: 12, height: 3 },
  { scenario: "meetingRoom", scope: "full", length: 12, width: 11.9, height: 3 }
];

const brands: AppBrandId[] = ["yinyi", "yinman"];
const microphones: Array<Exclude<MicrophoneSolution, "auto">> = ["existingArray", "lineArray"];
const speakers: Array<Exclude<SpeakerProductOverride, "auto">> = ["wall", "ceiling"];

export function runSpeakerCoverageSweep(seed = DEFAULT_SEED): SpeakerCoverageSweepResult {
  const random = mulberry32(seed);
  const formalSpecs = buildFormalSpecs(random);
  const boundarySpecs = buildBoundarySpecs();
  const experimentalSpecs = buildExperimentalSpecs();
  const firstPass = [...formalSpecs, ...boundarySpecs, ...experimentalSpecs].map(runCase);
  const stressSpecs = buildStressSpecs(firstPass);
  const cases = [...firstPass, ...stressSpecs.map(runCase)];
  const clusters = buildClusters(cases);
  const stableSummary = {
    seed,
    cases: cases.map((item) => ({
      id: item.id,
      status: item.status,
      signature: item.coverage?.rootCauseSignature,
      uncovered: item.coverage?.primaryListeningArea.uncoveredRatio,
      overlap: item.coverage?.primaryListeningArea.triplePlusCoverageRatio,
      seats: item.coverage?.seatChecks.filter((seat) => !seat.covered).map((seat) => seat.id)
    })),
    clusters
  };
  return {
    seed,
    summaryHash: createHash("sha256").update(JSON.stringify(stableSummary)).digest("hex"),
    caseCount: cases.length,
    statusCounts: countBy(cases, (item) => item.status, ["pass", "warning", "fail", "drawing-blocked", "capacity-limited", "special-design", "experimental-normalized"]),
    phaseCounts: countBy(cases, (item) => item.phase, ["formal", "boundary", "experimental", "stress"]),
    cases,
    clusters
  };
}

export function evaluateSpeakerCountCandidates(caseId: string, counts: number[], seed = DEFAULT_SEED) {
  const source = runSpeakerCoverageSweep(seed).cases.find((item) => item.id === caseId);
  if (!source) throw new Error(`Unknown speaker coverage case: ${caseId}`);
  const speakerProductId = source.speakerProductOverride === "ceiling" ? "CEILING-SPEAKER" : "COLUMN-SPEAKER";
  return counts.map((speakerCount) => {
    const generatedPoints = generateBrandEngineeringPoints(source.profile, {
      speakerCount,
      speakerProductId,
      preserveSpeakerCount: true
    }, source.brandId);
    return {
      speakerCount,
      generatedPoints,
      coverage: auditSpeakerCoverage(source.profile, generatedPoints)
    };
  });
}

export function evaluatePatternCandidates(caseId: string, seed = DEFAULT_SEED) {
  const source = runSpeakerCoverageSweep(seed).cases.find((item) => item.id === caseId);
  if (!source) throw new Error(`Unknown speaker coverage case: ${caseId}`);
  return evaluatePatternCandidatesForCase(source);
}

export function evaluatePatternCandidatesForCase(source: SpeakerCoverageSweepCase) {
  const microphonesOnly = source.generatedPoints.filter((point) => point.type === "arrayMic");
  const currentSpeakers = source.generatedPoints.filter((point) => point.type === "speaker");
  const patterns = source.speakerProductOverride === "ceiling"
    ? [{ id: "ceiling-responsibility-grid", points: getCeilingResponsibilityGrid(source.profile, microphonesOnly, currentSpeakers) }]
    : source.scenario === "meetingRoom"
      ? [
          { id: "meeting-symmetric-side-pair", points: getMeetingSymmetricSidePair(source.profile, microphonesOnly) },
          { id: "meeting-symmetric-zoned-pairs", points: getOptimizedMeetingSymmetricPattern(source.profile, microphonesOnly) }
        ]
      : source.microphoneSolution === "lineArray"
        ? [
            { id: "line-side-rear-four", points: getLineArraySideRearPattern(source.profile, microphonesOnly, false) },
            { id: "line-side-rear-six", points: getLineArraySideRearPattern(source.profile, microphonesOnly, true) },
            { id: "line-two-side-pairs-center", points: getLineArrayTwoSidePairsAndCenter(source.profile, microphonesOnly) },
            { id: "line-optimized-responsibility", points: getOptimizedLineWallPattern(source.profile, microphonesOnly) }
          ]
        : [
            { id: "wall-symmetric-side-pair", points: getWallSymmetricSidePair(source.profile, microphonesOnly) },
            { id: "wall-front-back-four", points: getFrontBackWallPattern(source.profile, microphonesOnly, false) },
            { id: "wall-front-back-six", points: getFrontBackWallPattern(source.profile, microphonesOnly, true) },
            { id: "wall-side-pairs-center-fills", points: getWallSidePairsAndCenterFills(source.profile, microphonesOnly) },
            { id: "wall-optimized-responsibility", points: getOptimizedArrayWallPattern(source.profile, microphonesOnly) }
          ];
  return patterns.map((pattern) => ({
    ...pattern,
    coverage: auditSpeakerCoverage(source.profile, pattern.points)
  }));
}

export function getCoveragePreviewComparison(caseId: string, patternId: string, seed = DEFAULT_SEED) {
  const source = runSpeakerCoverageSweep(seed).cases.find((item) => item.id === caseId);
  if (!source || !source.coverage) throw new Error(`Unknown or non-audited speaker coverage case: ${caseId}`);
  return getCoveragePreviewComparisonForCase(source, patternId);
}

export function getCoveragePreviewComparisonForCase(source: SpeakerCoverageSweepCase, patternId: string) {
  if (!source.coverage) throw new Error(`Non-audited speaker coverage case: ${source.id}`);
  const candidate = evaluatePatternCandidatesForCase(source).find((item) => item.id === patternId);
  if (!candidate) throw new Error(`Unknown candidate pattern ${patternId} for ${source.id}`);
  return {
    caseId: source.id,
    profile: source.profile,
    meetingFurniture: source.scenario === "meetingRoom" ? getMeetingFurnitureLayout(source.profile) : undefined,
    current: {
      points: source.generatedPoints,
      coverage: source.coverage,
      heatmap: getSpeakerCoverageHeatmap(source.profile, source.generatedPoints)
    },
    candidate: {
      patternId,
      points: candidate.points,
      coverage: candidate.coverage,
      heatmap: getSpeakerCoverageHeatmap(source.profile, candidate.points)
    }
  };
}

function getCeilingResponsibilityGrid(
  profile: ClassroomProfile,
  microphonesOnly: GeneratedPoint[],
  currentSpeakers: GeneratedPoint[]
) {
  const area = getSpeakerPrimaryListeningArea(profile);
  if (!area.bounds) return [...microphonesOnly, ...currentSpeakers];
  const muted = currentSpeakers.filter((speaker) => speaker.speakerSignalMode === "withoutLineArrayAfc");
  const xValues = getCoverageAxisValues(area.bounds.minX, area.bounds.maxX);
  const yValues = getCoverageAxisValues(area.bounds.minY, area.bounds.maxY);
  const template = currentSpeakers.find((speaker) => speaker.speakerSignalMode !== "withoutLineArrayAfc") ?? currentSpeakers[0];
  const active = yValues.flatMap((y, row) => xValues.map((x, column): GeneratedPoint => ({
    ...(template ?? {
      type: "speaker" as const,
      label: "吸顶音箱",
      reason: "拟调整预览"
    }),
    id: `candidate-ceiling-${row + 1}-${column + 1}`,
    position: { x, y },
    horizontalAngle: undefined,
    downTiltAngle: undefined,
    target: undefined,
    coverageRadius: 2,
    speakerSignalMode: muted.length ? "afc" : undefined,
    reason: "拟调整预览：按主要听众责任区独立生成有效扩声网格。"
  })));
  return [...microphonesOnly, ...muted, ...active];
}

function getCoverageAxisValues(min: number, max: number) {
  const span = Math.max(0, max - min);
  if (span <= 3.6) return [roundOne((min + max) / 2)];
  if (span <= 5) return [roundOne(min + 1.5), roundOne(max - 1.5)];
  const start = min + 1.8;
  const end = max - 1.8;
  const count = Math.max(2, Math.ceil((end - start) / 3.6) + 1);
  return Array.from({ length: count }, (_, index) => roundOne(start + ((end - start) * index) / (count - 1)));
}

function getMeetingSymmetricSidePair(profile: ClassroomProfile, microphonesOnly: GeneratedPoint[]) {
  const { width, length } = profile.roomGeometry;
  const y = roundOne(length / 2);
  return [
    ...microphonesOnly,
    createCandidateWallSpeaker("candidate-meeting-left", { x: 0, y }, { x: width / 2, y }, 7),
    createCandidateWallSpeaker("candidate-meeting-right", { x: width, y }, { x: width / 2, y }, 7)
  ];
}

function getOptimizedMeetingSymmetricPattern(profile: ClassroomProfile, microphonesOnly: GeneratedPoint[]) {
  const { width, length } = profile.roomGeometry;
  const centerY = length / 2;
  const candidates: GeneratedPoint[][] = [getMeetingSymmetricSidePair(profile, microphonesOnly)];
  for (const sideYRatio of [0.35, 0.5, 0.65]) {
    const sideY = length * sideYRatio;
    const sidePair = [
      createCandidateWallSpeaker("candidate-meeting-left", { x: 0, y: sideY }, { x: width / 2, y: centerY }, 6),
      createCandidateWallSpeaker("candidate-meeting-right", { x: width, y: sideY }, { x: width / 2, y: centerY }, 6)
    ];
    const frontCenter = createCandidateWallSpeaker("candidate-meeting-front-center", { x: width / 2, y: 0 }, { x: width / 2, y: centerY }, 6);
    const rearCenter = createCandidateWallSpeaker("candidate-meeting-rear-center", { x: width / 2, y: length }, { x: width / 2, y: centerY }, 6);
    candidates.push(
      [...microphonesOnly, ...sidePair, frontCenter],
      [...microphonesOnly, ...sidePair, rearCenter],
      [...microphonesOnly, ...sidePair, frontCenter, rearCenter]
    );
  }
  for (const frontRatio of [0.18, 0.24, 0.3]) {
    for (const rearRatio of [0.7, 0.76, 0.82]) {
      for (const targetXRatio of [0.28, 0.36, 0.44]) {
        for (const centerPull of [0.25, 0.5, 0.75]) {
          const frontY = length * frontRatio;
          const rearY = length * rearRatio;
          const frontTargetY = frontY + (centerY - frontY) * centerPull;
          const rearTargetY = rearY + (centerY - rearY) * centerPull;
          candidates.push([
            ...microphonesOnly,
            createCandidateWallSpeaker("candidate-meeting-left-front", { x: 0, y: frontY }, { x: width * targetXRatio, y: frontTargetY }, 6),
            createCandidateWallSpeaker("candidate-meeting-right-front", { x: width, y: frontY }, { x: width * (1 - targetXRatio), y: frontTargetY }, 6),
            createCandidateWallSpeaker("candidate-meeting-left-rear", { x: 0, y: rearY }, { x: width * targetXRatio, y: rearTargetY }, 6),
            createCandidateWallSpeaker("candidate-meeting-right-rear", { x: width, y: rearY }, { x: width * (1 - targetXRatio), y: rearTargetY }, 6)
          ]);
        }
      }
    }
  }
  return chooseBestPattern(profile, candidates);
}

function getLineArraySideRearPattern(profile: ClassroomProfile, microphonesOnly: GeneratedPoint[], sixSpeakers: boolean) {
  const { width, length } = profile.roomGeometry;
  const primaryMicY = microphonesOnly[0]?.position.y ?? 2;
  const sideY = roundOne(Math.min(length - 2, primaryMicY + 1.1));
  const sideTargetY = roundOne(Math.min(length - 0.5, sideY + 5.5));
  const rearRatios = sixSpeakers ? [0.18, 0.5, 0.82] : [0.25, 0.75];
  return [
    ...microphonesOnly,
    createCandidateWallSpeaker("candidate-side-left", { x: 0, y: sideY }, { x: width * 0.22, y: sideTargetY }, 6, "afc"),
    createCandidateWallSpeaker("candidate-side-right", { x: width, y: sideY }, { x: width * 0.78, y: sideTargetY }, 6, "afc"),
    ...rearRatios.map((ratio, index) => createCandidateWallSpeaker(
      `candidate-rear-${index + 1}`,
      { x: roundOne(width * ratio), y: length },
      { x: roundOne(width * ratio), y: Math.max(0.5, length - 6) },
      6,
      "afc"
    ))
  ];
}

function getLineArrayTwoSidePairsAndCenter(profile: ClassroomProfile, microphonesOnly: GeneratedPoint[]) {
  const { width, length } = profile.roomGeometry;
  const primaryMicY = microphonesOnly[0]?.position.y ?? 2;
  const firstY = roundOne(Math.min(length - 3.8, primaryMicY + 1));
  const secondY = roundOne(Math.min(length - 1, Math.max(firstY + 3.3, length - 3)));
  const targetX = width * 0.24;
  return [
    ...microphonesOnly,
    createCandidateWallSpeaker("candidate-side-left-1", { x: 0, y: firstY }, { x: targetX, y: Math.min(length, firstY + 5.5) }, 6, "afc"),
    createCandidateWallSpeaker("candidate-side-right-1", { x: width, y: firstY }, { x: width - targetX, y: Math.min(length, firstY + 5.5) }, 6, "afc"),
    createCandidateWallSpeaker("candidate-side-left-2", { x: 0, y: secondY }, { x: targetX, y: length }, 6, "afc"),
    createCandidateWallSpeaker("candidate-side-right-2", { x: width, y: secondY }, { x: width - targetX, y: length }, 6, "afc"),
    createCandidateWallSpeaker("candidate-rear-center", { x: width / 2, y: length }, { x: width / 2, y: Math.max(0.5, length - 6) }, 6, "afc")
  ];
}

function getOptimizedLineWallPattern(profile: ClassroomProfile, microphonesOnly: GeneratedPoint[]) {
  const { width, length } = profile.roomGeometry;
  const primaryMicY = microphonesOnly[0]?.position.y ?? 2;
  const candidates: GeneratedPoint[][] = [];
  for (const firstOffset of [0.8, 1.2, 1.6]) {
      for (const secondRatio of [0.45, 0.52, 0.59, 0.66]) {
      for (const targetRatio of [0.12, 0.2, 0.28, 0.36]) {
        for (const firstTargetYRatio of [0.72, 0.84, 0.96]) {
          const firstY = Math.min(length - 3.8, primaryMicY + firstOffset);
          const secondY = Math.max(firstY + 3.3, length * secondRatio);
          if (secondY > length - 0.6) continue;
          candidates.push([
            ...microphonesOnly,
            createCandidateWallSpeaker("candidate-side-left-1", { x: 0, y: firstY }, { x: width * targetRatio, y: length * firstTargetYRatio }, 6, "afc"),
            createCandidateWallSpeaker("candidate-side-right-1", { x: width, y: firstY }, { x: width * (1 - targetRatio), y: length * firstTargetYRatio }, 6, "afc"),
            createCandidateWallSpeaker("candidate-side-left-2", { x: 0, y: secondY }, { x: width * targetRatio, y: length }, 6, "afc"),
            createCandidateWallSpeaker("candidate-side-right-2", { x: width, y: secondY }, { x: width * (1 - targetRatio), y: length }, 6, "afc"),
            createCandidateWallSpeaker("candidate-rear-center", { x: width / 2, y: length }, { x: width / 2, y: Math.max(0.5, length - 6) }, 6, "afc")
          ]);
        }
      }
    }
  }
  return chooseBestPattern(profile, candidates);
}

function getFrontBackWallPattern(profile: ClassroomProfile, microphonesOnly: GeneratedPoint[], sixSpeakers: boolean) {
  const { width, length } = profile.roomGeometry;
  const ratios = sixSpeakers ? [0.18, 0.5, 0.82] : [0.25, 0.75];
  return [
    ...microphonesOnly,
    ...ratios.flatMap((ratio, index) => {
      const x = roundOne(width * ratio);
      return [
        createCandidateWallSpeaker(`candidate-front-${index + 1}`, { x, y: 0 }, { x, y: Math.min(length, 6) }, 6),
        createCandidateWallSpeaker(`candidate-back-${index + 1}`, { x, y: length }, { x, y: Math.max(0, length - 6) }, 6)
      ];
    })
  ];
}

function getWallSymmetricSidePair(profile: ClassroomProfile, microphonesOnly: GeneratedPoint[]) {
  const { width, length } = profile.roomGeometry;
  const area = getSpeakerPrimaryListeningArea(profile);
  const minY = area.bounds?.minY ?? length * 0.25;
  const maxY = area.bounds?.maxY ?? length * 0.75;
  const center = { x: width / 2, y: (minY + maxY) / 2 };
  return [
    ...microphonesOnly,
    createCandidateWallSpeaker("candidate-symmetric-left", { x: 0, y: center.y }, center, 6),
    createCandidateWallSpeaker("candidate-symmetric-right", { x: width, y: center.y }, center, 6)
  ];
}

function getWallSidePairsAndCenterFills(profile: ClassroomProfile, microphonesOnly: GeneratedPoint[]) {
  const { width, length } = profile.roomGeometry;
  const firstY = roundOne(Math.max(1, length * 0.35));
  const secondY = roundOne(Math.min(length - 1, Math.max(firstY + 3.3, length * 0.72)));
  const targetInset = roundOne(Math.min(3, width * 0.25));
  return [
    ...microphonesOnly,
    createCandidateWallSpeaker("candidate-side-left-1", { x: 0, y: firstY }, { x: targetInset, y: firstY }, 6),
    createCandidateWallSpeaker("candidate-side-right-1", { x: width, y: firstY }, { x: width - targetInset, y: firstY }, 6),
    createCandidateWallSpeaker("candidate-side-left-2", { x: 0, y: secondY }, { x: targetInset, y: secondY }, 6),
    createCandidateWallSpeaker("candidate-side-right-2", { x: width, y: secondY }, { x: width - targetInset, y: secondY }, 6),
    createCandidateWallSpeaker("candidate-front-center", { x: width / 2, y: 0 }, { x: width / 2, y: Math.min(length, 6) }, 6),
    createCandidateWallSpeaker("candidate-back-center", { x: width / 2, y: length }, { x: width / 2, y: Math.max(0, length - 6) }, 6)
  ];
}

function getOptimizedArrayWallPattern(profile: ClassroomProfile, microphonesOnly: GeneratedPoint[]) {
  const { width, length } = profile.roomGeometry;
  const candidates: GeneratedPoint[][] = [];
  for (const firstRatio of [0.25, 0.32, 0.4]) {
    for (const secondRatio of [0.65, 0.75, 0.84]) {
      for (const targetRatio of [0.12, 0.2, 0.28, 0.36]) {
        const firstY = length * firstRatio;
        const secondY = Math.max(firstY + 3.3, length * secondRatio);
        if (secondY > length - 0.5) continue;
        candidates.push([
          ...microphonesOnly,
          createCandidateWallSpeaker("candidate-side-left-1", { x: 0, y: firstY }, { x: width * targetRatio, y: Math.min(length, firstY + 2.5) }, 6),
          createCandidateWallSpeaker("candidate-side-right-1", { x: width, y: firstY }, { x: width * (1 - targetRatio), y: Math.min(length, firstY + 2.5) }, 6),
          createCandidateWallSpeaker("candidate-side-left-2", { x: 0, y: secondY }, { x: width * targetRatio, y: length }, 6),
          createCandidateWallSpeaker("candidate-side-right-2", { x: width, y: secondY }, { x: width * (1 - targetRatio), y: length }, 6),
          createCandidateWallSpeaker("candidate-front-center", { x: width / 2, y: 0 }, { x: width / 2, y: Math.min(length, 6) }, 6),
          createCandidateWallSpeaker("candidate-back-center", { x: width / 2, y: length }, { x: width / 2, y: Math.max(0, length - 6) }, 6)
        ]);
      }
    }
  }
  return chooseBestPattern(profile, candidates);
}

function chooseBestPattern(profile: ClassroomProfile, candidates: GeneratedPoint[][]) {
  return candidates.reduce((best, candidate) => {
    const candidateAudit = auditSpeakerCoverage(profile, candidate);
    const bestAudit = auditSpeakerCoverage(profile, best);
    return getCandidateScore(candidateAudit, candidate) < getCandidateScore(bestAudit, best) ? candidate : best;
  }, candidates[0] ?? []);
}

function getCandidateScore(audit: SpeakerCoverageAuditResult, points: GeneratedPoint[]) {
  const statusPenalty = audit.status === "pass" ? 0 : audit.status === "warning" ? 100 : 1000;
  const region = audit.primaryListeningArea;
  return statusPenalty + region.uncoveredRatio * 300 + audit.seatChecks.filter((seat) => !seat.covered).length * 10 + points.filter((point) => point.type === "speaker").length * 0.01;
}

function createCandidateWallSpeaker(
  id: string,
  position: Point,
  target: Point,
  coverageRadius: number,
  speakerSignalMode?: GeneratedPoint["speakerSignalMode"]
): GeneratedPoint {
  return {
    id,
    type: "speaker",
    label: "壁挂音箱",
    position: { x: roundOne(position.x), y: roundOne(position.y) },
    target: { x: roundOne(target.x), y: roundOne(target.y) },
    coverageRadius,
    horizontalAngle: 0,
    speakerSignalMode,
    reason: "拟调整预览：按听众责任区分组覆盖。"
  };
}

function buildFormalSpecs(random: () => number): CaseSpec[] {
  const specs: CaseSpec[] = [];
  let index = 0;
  for (const range of scenarioRanges) {
    for (const requestedScope of range.scopes) {
      for (const brandId of brands) {
        for (const microphoneSolution of microphones) {
          for (const speakerProductOverride of speakers) {
            for (let sample = 0; sample < 9; sample += 1) {
              index += 1;
              specs.push({
                id: `formal-${String(index).padStart(3, "0")}`,
                phase: "formal",
                brandId,
                scenario: range.scenario,
                requestedScope,
                microphoneSolution,
                speakerProductOverride,
                length: randomRange(random, range.length),
                width: randomRange(random, range.width),
                height: randomRange(random, range.height)
              });
            }
          }
        }
      }
    }
  }
  return specs;
}

function buildBoundarySpecs(): CaseSpec[] {
  let index = 0;
  return boundaryRooms.flatMap((room) => brands.flatMap((brandId) => microphones.flatMap((microphoneSolution) => speakers.map((speakerProductOverride) => {
    index += 1;
    return {
      id: `boundary-${String(index).padStart(3, "0")}`,
      phase: "boundary" as const,
      brandId,
      scenario: room.scenario,
      requestedScope: room.scope,
      microphoneSolution,
      speakerProductOverride,
      length: room.length,
      width: room.width,
      height: room.height
    };
  }))));
}

function buildExperimentalSpecs(): CaseSpec[] {
  const rooms: Array<{ scenario: Scenario; length: number; width: number; height: number }> = [
    { scenario: "lectureClassroom", length: 16, width: 10, height: 4.5 },
    { scenario: "combinedClassroom", length: 20, width: 14, height: 4.5 },
    { scenario: "auditorium", length: 24, width: 16, height: 6 }
  ];
  let index = 0;
  return rooms.flatMap((room) => brands.flatMap((brandId) => microphones.flatMap((microphoneSolution) => speakers.map((speakerProductOverride) => {
    index += 1;
    return {
      id: `experimental-${String(index).padStart(3, "0")}`,
      phase: "experimental" as const,
      brandId,
      scenario: room.scenario,
      requestedScope: "full" as const,
      microphoneSolution,
      speakerProductOverride,
      length: room.length,
      width: room.width,
      height: room.height
    };
  }))));
}

function buildStressSpecs(cases: SpeakerCoverageSweepCase[]): CaseSpec[] {
  const baseCases = cases.filter((item) =>
    item.phase === "formal" &&
    item.scenario === "standardClassroom" &&
    item.requestedScope === "podium" &&
    item.microphoneSolution === "existingArray"
  );
  const selected = new Map<string, SpeakerCoverageSweepCase>();
  for (const item of baseCases) {
    const key = `${item.brandId}|${item.speakerProductOverride}`;
    if (!selected.has(key)) selected.set(key, item);
  }

  let index = 0;
  return Array.from(selected.values()).flatMap((baseCase) => {
    const primaryMic = baseCase.generatedPoints.find((point) => point.type === "arrayMic");
    const variants: Array<{ podiumPosition: PodiumPosition; centralAirPoints?: CaseSpec["centralAirPoints"] }> = [
      { podiumPosition: "frontLeft" },
      { podiumPosition: "frontRight" },
      {
        podiumPosition: "frontCenter",
        centralAirPoints: primaryMic ? [{
          id: "stress-ac-1",
          label: "中央空调1",
          position: primaryMic.position,
          size: { width: 0.8, depth: 0.8 }
        }] : []
      }
    ];
    return variants.map((variant) => {
      index += 1;
      return {
        id: `stress-${String(index).padStart(3, "0")}`,
        phase: "stress" as const,
        brandId: baseCase.brandId,
        scenario: baseCase.scenario,
        requestedScope: baseCase.requestedScope,
        microphoneSolution: baseCase.microphoneSolution,
        speakerProductOverride: baseCase.speakerProductOverride,
        length: baseCase.room.length,
        width: baseCase.room.width,
        height: baseCase.room.height,
        podiumPosition: variant.podiumPosition,
        centralAirPoints: variant.centralAirPoints
      };
    });
  });
}

function runCase(spec: CaseSpec): SpeakerCoverageSweepCase {
  const profile = createProfile(spec);
  if (spec.phase === "experimental" && profile.amplificationScope !== spec.requestedScope) {
    return createCaseResult(spec, profile, undefined, "experimental-normalized", "当前正式场景规则已把该全场扩声请求归一化为区域扩声。此实验组不生成假点位。 ");
  }

  const outputs = generateEngineeringOutputs(profile, {}, spec.brandId);
  if (outputs.solutionSelection.drawingBlocked) {
    return createCaseResult(spec, profile, outputs, "drawing-blocked", outputs.solutionSelection.blockingMessage ?? "麦克风方案能力不足，正式引擎已停止出图。");
  }
  const capacityFinding = outputs.pointValidation.findings.find((finding) =>
    (finding.code === "array.capacity" || finding.code === "speaker.system-capacity") && finding.severity === "hard"
  );
  if (capacityFinding) {
    return createCaseResult(spec, profile, outputs, "capacity-limited", capacityFinding.internalMessage);
  }
  if (profile.roomGeometry.length * profile.roomGeometry.width > 150) {
    return createCaseResult(spec, profile, outputs, "special-design", "房间面积超过150平方米，按现有业务边界归入专项声场设计，不作为普通点位规则失败。 ");
  }

  const coverage = auditSpeakerCoverage(profile, outputs.generatedPoints);
  return createCaseResult(spec, profile, outputs, coverage.status, getCoverageReason(coverage), coverage);
}

function createCaseResult(
  spec: CaseSpec,
  profile: ClassroomProfile,
  outputs: GeneratedOutputs | undefined,
  status: SweepStatus,
  statusReason: string,
  coverage?: SpeakerCoverageAuditResult
): SpeakerCoverageSweepCase {
  const generatedPoints = outputs?.generatedPoints ?? [];
  return {
    id: spec.id,
    phase: spec.phase,
    brandId: spec.brandId,
    scenario: spec.scenario,
    requestedScope: spec.requestedScope,
    effectiveScope: profile.amplificationScope,
    microphoneSolution: spec.microphoneSolution,
    speakerProductOverride: spec.speakerProductOverride,
    room: { length: spec.length, width: spec.width, height: spec.height },
    status,
    statusReason,
    profile,
    generatedPoints,
    speakerCount: generatedPoints.filter((point) => point.type === "speaker").length,
    activeSpeakerCount: coverage?.activeSpeakerIds.length ?? 0,
    validationCodes: outputs?.pointValidation.findings.filter((finding) => finding.severity !== "info").map((finding) => finding.code) ?? [],
    coverage
  };
}

function createProfile(spec: CaseSpec): ClassroomProfile {
  const base = createInitialProfile();
  const centralAirPoints = spec.centralAirPoints ?? [];
  const profile = {
    ...base,
    projectName: `覆盖审计-${spec.id}`,
    customerName: "内部规则校准",
    scenario: spec.scenario,
    needs: ["localAmplification" as const],
    amplificationScope: spec.requestedScope,
    roomGeometry: {
      length: spec.length,
      width: spec.width,
      height: spec.height,
      scale: 1,
      coordinateUnit: "meter" as const
    },
    existingDevices: {
      recordingHost: "",
      computer: "",
      legacySoundSystem: "",
      legacyWirelessMic: "",
      legacySpeakerPoints: []
    },
    engineeringConstraints: {
      ...base.engineeringConstraints,
      ceiling: "suspended" as const,
      overheadSpeakerMounting: "available" as const,
      auditoriumRearFillSpeakers: "absent" as const,
      speakerProductOverride: spec.speakerProductOverride,
      microphoneSolution: spec.microphoneSolution,
      lineArrayMode: "auto" as const,
      lineArrayInstallation: "auto" as const,
      processorTier: "auto" as const,
      podiumPosition: spec.podiumPosition ?? "frontCenter",
      hasPodium: spec.scenario !== "meetingRoom",
      stageSize: {
        width: roundOne(Math.min(spec.width - 0.1, Math.max(4, spec.width * 0.72))),
        depth: roundOne(Math.min(spec.length * 0.32, Math.max(2.4, spec.length * 0.18)))
      },
      teachingAreaSize: {
        width: roundOne(spec.width),
        depth: roundOne(Math.min(spec.length - 0.6, Math.max(4, spec.length * 0.5)))
      },
      hasCentralAirConditioner: centralAirPoints.length > 0,
      centralAirConditionerCount: centralAirPoints.length,
      centralAirConditionerPoints: centralAirPoints,
      notes: "后排过道约1.2m，两侧为座位。"
    },
    acousticEnvironment: {
      floorMaterial: "wood" as const,
      wallMaterial: "painted" as const,
      softTreatment: "mixed" as const,
      furnishingDensity: "normal" as const,
      hasGlassWall: false,
      ceilingAcousticTreatment: "partial" as const,
      glassCoverage: "none" as const,
      echoObservation: "none" as const
    }
  };
  return normalizeProfile(profile);
}

function buildClusters(cases: SpeakerCoverageSweepCase[]): SpeakerCoverageSweepCluster[] {
  const groups = new Map<string, SpeakerCoverageSweepCase[]>();
  for (const item of cases) {
    if (!item.coverage || item.coverage.status === "pass") continue;
    const group = groups.get(item.coverage.rootCauseSignature) ?? [];
    group.push(item);
    groups.set(item.coverage.rootCauseSignature, group);
  }
  return Array.from(groups.entries()).map(([signature, items]) => {
    const representative = items.reduce((worst, item) => scoreCase(item) > scoreCase(worst) ? item : worst, items[0]);
    return {
      signature,
      status: items.some((item) => item.status === "fail") ? "fail" : "warning",
      caseCount: items.length,
      brands: unique(items.map((item) => item.brandId)),
      scenarios: unique(items.map((item) => item.scenario)),
      minRoom: getRoomExtremes(items, Math.min),
      maxRoom: getRoomExtremes(items, Math.max),
      worstUncoveredRatio: Math.max(...items.map((item) => item.coverage?.primaryListeningArea.uncoveredRatio ?? 0)),
      worstTripleOverlapRatio: Math.max(...items.map((item) => item.coverage?.primaryListeningArea.triplePlusCoverageRatio ?? 0)),
      uncoveredSeatCount: Math.max(...items.map((item) => item.coverage?.seatChecks.filter((seat) => !seat.covered).length ?? 0)),
      representativeCaseId: representative.id
    };
  }).sort((a, b) => {
    if (a.status !== b.status) return a.status === "fail" ? -1 : 1;
    return b.worstUncoveredRatio - a.worstUncoveredRatio;
  });
}

function getCoverageReason(coverage: SpeakerCoverageAuditResult) {
  const uncovered = formatPercent(coverage.primaryListeningArea.uncoveredRatio);
  const seats = coverage.seatChecks.filter((seat) => !seat.covered).length;
  return `主要听众区未覆盖 ${uncovered}${seats ? `，未覆盖坐席 ${seats} 个` : ""}。`;
}

function scoreCase(item: SpeakerCoverageSweepCase) {
  const coverage = item.coverage;
  if (!coverage) return 0;
  return coverage.primaryListeningArea.uncoveredRatio * 3 + coverage.seatChecks.filter((seat) => !seat.covered).length;
}

function getRoomExtremes(items: SpeakerCoverageSweepCase[], compare: (...values: number[]) => number) {
  return {
    length: compare(...items.map((item) => item.room.length)),
    width: compare(...items.map((item) => item.room.width)),
    height: compare(...items.map((item) => item.room.height))
  };
}

function countBy<T, K extends string>(items: T[], getKey: (item: T) => K, keys: K[]) {
  const result = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const item of items) result[getKey(item)] += 1;
  return result;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function randomRange(random: () => number, [min, max]: [number, number]) {
  return roundOne(min + random() * (max - min));
}

function mulberry32(seed: number) {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
