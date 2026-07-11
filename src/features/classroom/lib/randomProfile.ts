import type {
  AcousticEnvironment,
  AmplificationScope,
  CeilingAcousticTreatment,
  CeilingType,
  ClassroomProfile,
  EchoObservation,
  FloorMaterial,
  FurnishingDensity,
  GlassCoverage,
  Need,
  Scenario,
  SoftTreatment,
  WallMaterial
} from "../types";
import {
  getAllowedComputerOptions,
  getAllowedRecordingHostOptions,
  isAuditoriumScenario,
  isClassroomScenario,
  isMeetingScenario
} from "./scenarioRules";
import { externalDeviceOptions } from "../data/initialProfile";

const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
const maybe = (probability: number) => Math.random() < probability;
const oneDecimal = (value: number) => Math.round(value * 10) / 10;
const range = ([min, max]: [number, number]) => oneDecimal(min + Math.random() * (max - min));

const scenarioPools: Array<{
  scenario: Scenario;
  label: string;
  length: [number, number];
  width: [number, number];
  height: [number, number];
  defaultScope: AmplificationScope;
}> = [
  { scenario: "meetingRoom", label: "会议室", length: [5.8, 9], width: [4.2, 6.8], height: [2.7, 3.4], defaultScope: "full" },
  { scenario: "standardClassroom", label: "普通教室", length: [7.5, 11.5], width: [5.8, 8.4], height: [2.9, 3.6], defaultScope: "full" },
  { scenario: "lectureClassroom", label: "阶梯教室", length: [11.5, 15], width: [8.2, 10.5], height: [3.4, 4.5], defaultScope: "podium" },
  { scenario: "combinedClassroom", label: "合班教室", length: [13, 17], width: [8.8, 11.5], height: [3.5, 4.2], defaultScope: "podium" },
  { scenario: "auditorium", label: "报告厅", length: [16, 24], width: [10, 16], height: [4.2, 6.5], defaultScope: "podium" }
];

const generalNeedPools: Need[][] = [
  ["localAmplification"],
  ["localAmplification", "recording"],
  ["videoConference"],
  ["videoConference", "recording"],
  ["videoConference", "localAmplification"],
  ["localAmplification", "recording"]
];

const ceilings: CeilingType[] = ["suspended", "suspended", "suspended", "exposed", "unknown"];
const floors: FloorMaterial[] = ["tile", "tile", "wood", "carpet", "unknown"];
const walls: WallMaterial[] = ["painted", "painted", "hard", "acoustic", "unknown"];
const softTreatments: SoftTreatment[] = ["none", "curtains", "mixed", "acousticPanels", "unknown"];
const furnishing: FurnishingDensity[] = ["empty", "normal", "normal", "dense", "unknown"];
const ceilingAcoustics: CeilingAcousticTreatment[] = ["hard", "partial", "partial", "acoustic", "unknown"];
const glassCoverages: GlassCoverage[] = ["none", "none", "partial", "large", "unknown"];
const echoObservations: EchoObservation[] = ["none", "none", "tail", "obvious", "unknown"];
const podiumPositions: ClassroomProfile["engineeringConstraints"]["podiumPosition"][] = ["frontCenter", "frontCenter", "frontLeft", "frontRight", "unknown"];
const aisleNotes = ["后排过道约1.2m，两侧为座位。", "后排过道约1.2m，两侧过道。", "后排过道约1.2m，单侧过道。", "无后排过道，两侧为座位。"];

const buildEnvironment = (): AcousticEnvironment => {
  const glassCoverage = pick(glassCoverages);
  return {
    floorMaterial: pick(floors),
    wallMaterial: pick(walls),
    softTreatment: pick(softTreatments),
    furnishingDensity: pick(furnishing),
    ceilingAcousticTreatment: pick(ceilingAcoustics),
    glassCoverage,
    echoObservation: pick(echoObservations),
    hasGlassWall: glassCoverage === "large"
  };
};

export const createRandomProfile = (index = 1): ClassroomProfile => {
  const scenario = pick(scenarioPools);
  const needs = [...pick(getNeedPoolsForScenario(scenario.scenario))];
  const hasOnline = needs.some((need) => ["videoConference", "recording"].includes(need));
  const ceiling = pick(ceilings);
  const projectCode = Math.floor(1000 + Math.random() * 9000);
  const hasLocalAmplification = needs.includes("localAmplification");
  const amplificationScope =
    isMeetingScenario(scenario.scenario)
      ? "full"
      : isAuditoriumScenario(scenario.scenario) || scenario.scenario === "combinedClassroom" || scenario.scenario === "lectureClassroom"
        ? "podium"
        : hasLocalAmplification
          ? maybe(0.65)
            ? scenario.defaultScope
            : "podium"
          : "podium";
  const length = range(scenario.length);
  const width = range(scenario.width);
  const height = range(scenario.height);
  const hasCentralAirConditioner = maybe(0.45);
  const centralAirConditionerCount = hasCentralAirConditioner ? pick([1, 1, 2, 2, 3]) : 0;
  const legacySoundSystem = maybe(0.6) ? "原有音频系统" : "";
  const auditoriumRearFillSpeakers =
    scenario.scenario === "auditorium" ? pick(["present", "present", "absent", "unknown"] as const) : "unknown";

  return {
    scenario: scenario.scenario,
    customScenario: "",
    customNeed: needs.includes("other") ? "现场补充需求" : "",
    amplificationScope,
    projectName: `测试用例${String(index).padStart(2, "0")}-${scenario.label}音频方案-${projectCode}`,
    customerName: pick(["某高校教务处", "某职业院校信息中心", "某实验教学中心", "某培训学院", "某区教育局"]),
    needs,
    roomGeometry: {
      length,
      width,
      height,
      scale: 1,
      coordinateUnit: "meter"
    },
    existingDevices: {
      recordingHost: hasOnline || (isAuditoriumScenario(scenario.scenario) && maybe(0.35)) ? pick(getAllowedRecordingHostOptions(scenario.scenario, externalDeviceOptions.recordingHost)) : "",
      computer: pick(getAllowedComputerOptions(scenario.scenario, externalDeviceOptions.computer)),
      legacySoundSystem,
      legacyWirelessMic: maybe(0.35) ? pick(["有线麦克风", "无线手持麦"]) : "",
      legacySpeakerPoints: legacySoundSystem && maybe(0.55) ? buildLegacySpeakerPoints(width, length) : []
    },
    engineeringConstraints: {
      ceiling,
      podiumPosition: isMeetingScenario(scenario.scenario) || isAuditoriumScenario(scenario.scenario) ? "frontCenter" : pick(podiumPositions),
      stageSize: {
        width: Number(Math.min(Math.max(0.5, width - 0.1), Math.max(4, width * 0.72)).toFixed(1)),
        depth: Number(Math.min(length * 0.32, Math.max(2.4, length * 0.18)).toFixed(1))
      },
      teachingAreaSize: {
        width: Number((isClassroomScenario(scenario.scenario) ? width : Math.min(width, Math.max(4, width * 0.9))).toFixed(1)),
        depth: Number(Math.min(length * 0.62, Math.max(4, length * 0.48)).toFixed(1))
      },
      hasCentralAirConditioner,
      centralAirConditionerCount,
      centralAirConditionerPoints: [],
      auditoriumRearFillSpeakers,
      notes:
        hasCentralAirConditioner
          ? `${pick(aisleNotes)}现场有中央空调，需在点位图标记中央空调位置并避开阵麦。`
          : ceiling === "exposed"
          ? `${pick(aisleNotes)}现场为裸顶或局部裸顶，需复核壁装位置、明敷走线路径和音柱安装条件。`
          : `${pick(aisleNotes)}${isAuditoriumScenario(scenario.scenario) ? "舞台侧" : "讲台侧"}有设备机柜，需复核空调出风口、投影幕、灯具检修口和弱电桥架位置。`
    },
    acousticEnvironment: buildEnvironment()
  };
};

const buildLegacySpeakerPoints = (width: number, length: number): ClassroomProfile["existingDevices"]["legacySpeakerPoints"] => {
  const type = pick(["ceiling", "wall"] as const);
  const count = pick([2, 4] as const);
  const wallAdjustability = type === "wall" ? pick(["universal", "fixed", "unknown"] as const) : "unknown";
  return Array.from({ length: count }, (_, index) => {
    const isLeft = index % 2 === 0;
    const isBack = index >= 2;
    const y = Number((isBack ? length * 0.68 : length * 0.28).toFixed(1));
    return {
      id: `legacy-${Date.now()}-${index}`,
      label: `利旧音箱${index + 1}`,
      type,
      position: {
        x: type === "wall" ? (isLeft ? 0 : width) : Number((isLeft ? width * 0.25 : width * 0.75).toFixed(1)),
        y
      },
      wallAdjustability
    };
  });
};

const getNeedPoolsForScenario = (scenario: Scenario): Need[][] => {
  if (isClassroomScenario(scenario)) {
    return [["localAmplification"], ["recording"], ["interactiveClass"], ["localAmplification", "recording"], ["localAmplification", "interactiveClass"], ["other"]];
  }
  if (isMeetingScenario(scenario)) {
    return [["videoConference"], ["localAmplification"], ["videoConference", "localAmplification"], ["other"], ["videoConference", "other"]];
  }
  return generalNeedPools;
};
