import type { ClassroomProfile, Point } from "../types";
import { normalizeProfileForScenario } from "./scenarioRules";

const defaultCentralAirConditionerSize = { width: 0.8, depth: 0.8 };

export function normalizeProfile(profile: ClassroomProfile): ClassroomProfile {
  const customNeedHasInteractive = profile.customNeed.includes("互动课堂");
  const hasInteractive = profile.needs.includes("interactiveClass") || customNeedHasInteractive;
  const centralAirTextHint = /中央空调|空调|出风口/.test(`${profile.engineeringConstraints.notes} ${profile.customNeed} ${profile.customScenario}`);
  const hasCentralAir = Boolean(profile.engineeringConstraints.hasCentralAirConditioner) || centralAirTextHint;
  const centralAirPoints = hasCentralAir ? (profile.engineeringConstraints.centralAirConditionerPoints ?? []) : [];
  const centralAirConditionerCount = hasCentralAir ? Math.max(1, profile.engineeringConstraints.centralAirConditionerCount ?? centralAirPoints.length, centralAirPoints.length) : 0;
  const stageSize = normalizeStageSize(profile);
  const teachingAreaSize = normalizeTeachingAreaSize(profile);
  const cleanedCustomNeed = customNeedHasInteractive
    ? profile.customNeed
        .split(/[、，,]/)
        .map((item) => item.trim())
        .filter((item) => item && item !== "互动课堂")
        .join("、")
    : profile.customNeed;
  const baseNeeds = profile.needs
    .filter((need) => need !== "remoteTeaching" && need !== "wirelessMic")
    .filter((need) => !(customNeedHasInteractive && need === "other" && !cleanedCustomNeed.trim()));
  const needs = baseNeeds
    .filter((need) => need !== "interactiveClass")
    .slice(0, 2);
  const normalizedNeeds = hasInteractive && needs.length < 2 ? [...needs, "interactiveClass" as const] : needs;
  const acousticEnvironment = normalizeAcousticEnvironment(profile);
  return normalizeProfileForScenario({
    ...profile,
    engineeringConstraints: {
      ...profile.engineeringConstraints,
      centralAirConditionerCount,
      auditoriumRearFillSpeakers: profile.engineeringConstraints.auditoriumRearFillSpeakers ?? "unknown",
      speakerProductOverride: profile.engineeringConstraints.speakerProductOverride ?? "auto",
      hasCentralAirConditioner: hasCentralAir,
      stageSize,
      teachingAreaSize,
      centralAirConditionerPoints: centralAirPoints.map((point, index) => ({
        ...point,
        id: point.id || `central-ac-${index + 1}`,
        label: point.label || `中央空调${index + 1}`,
        size: point.size ?? defaultCentralAirConditionerSize
      }))
    },
    existingDevices: {
      ...profile.existingDevices,
      legacySpeakerPoints: normalizeLegacySpeakerPoints(profile)
    },
    acousticEnvironment,
    needs: normalizedNeeds.length ? normalizedNeeds : ["localAmplification"],
    customNeed: normalizedNeeds.includes("other") && !cleanedCustomNeed.trim() ? "现场补充需求" : cleanedCustomNeed
  });
}

function normalizeAcousticEnvironment(profile: ClassroomProfile): ClassroomProfile["acousticEnvironment"] {
  const environment = profile.acousticEnvironment ?? {
    floorMaterial: "unknown",
    wallMaterial: "unknown",
    softTreatment: "unknown",
    furnishingDensity: "unknown",
    hasGlassWall: false
  };
  const glassCoverage = environment.glassCoverage ?? (environment.hasGlassWall ? "large" : "none");
  const measuredRt60 = Number(environment.measuredRt60);
  return {
    ...environment,
    floorMaterial: environment.floorMaterial ?? "unknown",
    wallMaterial: environment.wallMaterial ?? "unknown",
    softTreatment: environment.softTreatment ?? "unknown",
    furnishingDensity: environment.furnishingDensity ?? "unknown",
    ceilingAcousticTreatment: environment.ceilingAcousticTreatment ?? "unknown",
    glassCoverage,
    echoObservation: environment.echoObservation ?? "unknown",
    hasGlassWall: glassCoverage === "large",
    measuredRt60: Number.isFinite(measuredRt60) && measuredRt60 >= 0.1 && measuredRt60 <= 10 ? measuredRt60 : undefined
  };
}

function normalizeStageSize(profile: ClassroomProfile) {
  const stageSize = profile.engineeringConstraints.stageSize;
  const maxStageWidth = Math.max(0.5, profile.roomGeometry.width - 0.1);
  const defaultWidth = Number(Math.min(maxStageWidth, Math.max(4, profile.roomGeometry.width * 0.72)).toFixed(1));
  const defaultDepth = Number(Math.min(profile.roomGeometry.length * 0.32, Math.max(2.4, profile.roomGeometry.length * 0.18)).toFixed(1));
  return {
    width: Math.max(0.5, Math.min(maxStageWidth, Number(stageSize?.width) || defaultWidth)),
    depth: Math.max(0, Math.min(profile.roomGeometry.length, Number(stageSize?.depth) || defaultDepth))
  };
}

function normalizeTeachingAreaSize(profile: ClassroomProfile) {
  const teachingAreaSize = profile.engineeringConstraints.teachingAreaSize;
  const defaultWidth = Number(profile.roomGeometry.width.toFixed(1));
  const defaultDepth = Number(Math.min(profile.roomGeometry.length - 0.6, Math.max(4, profile.roomGeometry.length * 0.5)).toFixed(1));
  return {
    width: Math.max(0.5, Math.min(profile.roomGeometry.width, Number(teachingAreaSize?.width) || defaultWidth)),
    depth: Math.max(0.6, Math.min(Math.max(0.6, profile.roomGeometry.length - 0.6), Number(teachingAreaSize?.depth) || defaultDepth))
  };
}

function normalizeLegacySpeakerPoints(profile: ClassroomProfile): ClassroomProfile["existingDevices"]["legacySpeakerPoints"] {
  if (!profile.existingDevices.legacySoundSystem.trim()) return [];
  const points = profile.existingDevices.legacySpeakerPoints ?? [];
  const wallAdjustability = points.find((point) => point.type === "wall" && (point.wallAdjustability === "universal" || point.wallAdjustability === "fixed"))?.wallAdjustability ?? "unknown";
  return points.map((point, index) => {
    const sameTypePrevious = points.slice(0, index).filter((item) => item.type === point.type);
    const aligned = alignLegacySpeakerPosition(point.position, profile, sameTypePrevious);
    return {
      ...point,
      id: point.id || `legacy-speaker-${index + 1}`,
      label: point.label || `利旧音箱${index + 1}`,
      position: point.type === "wall" ? snapWallPointToNearestWall(aligned, profile) : aligned,
      wallAdjustability: point.type === "wall" ? wallAdjustability : "unknown"
    };
  });
}

function alignLegacySpeakerPosition(
  position: Point,
  profile: ClassroomProfile,
  existingPoints: ClassroomProfile["existingDevices"]["legacySpeakerPoints"]
) {
  const snapToleranceM = 0.45;
  let next = { ...position };
  for (const point of existingPoints) {
    next = {
      x: snapToValue(next.x, point.position.x, snapToleranceM),
      y: snapToValue(next.y, point.position.y, snapToleranceM)
    };
    next = {
      x: snapToValue(next.x, profile.roomGeometry.width - point.position.x, snapToleranceM),
      y: next.y
    };
  }
  return {
    x: roundOne(Math.max(0, Math.min(profile.roomGeometry.width, next.x))),
    y: roundOne(Math.max(0, Math.min(profile.roomGeometry.length, next.y)))
  };
}

function snapWallPointToNearestWall(position: Point, profile: ClassroomProfile) {
  const distances = [
    { side: "left" as const, value: Math.abs(position.x) },
    { side: "right" as const, value: Math.abs(profile.roomGeometry.width - position.x) },
    { side: "front" as const, value: Math.abs(position.y) },
    { side: "back" as const, value: Math.abs(profile.roomGeometry.length - position.y) }
  ].sort((a, b) => a.value - b.value);
  const side = distances[0]?.side ?? "left";
  if (side === "left") return { x: 0, y: position.y };
  if (side === "right") return { x: profile.roomGeometry.width, y: position.y };
  if (side === "front") return { x: position.x, y: 0 };
  return { x: position.x, y: profile.roomGeometry.length };
}

function snapToValue(value: number, target: number, tolerance: number) {
  return Math.abs(value - target) <= tolerance ? target : value;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
