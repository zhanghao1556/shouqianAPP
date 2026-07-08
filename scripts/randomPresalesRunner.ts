import { generateEngineeringOutputs } from "../src/features/classroom/lib/engineeringRules";
import type {
  AcousticEnvironment,
  AmplificationScope,
  CeilingType,
  ClassroomProfile,
  FloorMaterial,
  FurnishingDensity,
  Need,
  Scenario,
  SoftTreatment,
  WallMaterial
} from "../src/features/classroom/types";

type PickList<T> = readonly T[];

const pick = <T>(items: PickList<T>) => items[Math.floor(Math.random() * items.length)];
const maybe = (probability: number) => Math.random() < probability;
const oneDecimal = (value: number) => Math.round(value * 10) / 10;

const scenarioPools: Array<{
  scenario: Scenario;
  label: string;
  length: [number, number];
  width: [number, number];
  height: [number, number];
  defaultScope: AmplificationScope;
}> = [
  { scenario: "standardClassroom", label: "普通智慧教室", length: [8.5, 11.5], width: [6.2, 8.4], height: [3, 3.6], defaultScope: "full" },
  { scenario: "lectureClassroom", label: "阶梯教室", length: [11.5, 15], width: [8.5, 10.5], height: [3.6, 4.5], defaultScope: "full" },
  { scenario: "meetingRoom", label: "研讨会议室", length: [6.5, 9], width: [4.8, 6.8], height: [2.8, 3.4], defaultScope: "podium" },
  { scenario: "combinedClassroom", label: "合班教室", length: [13, 17], width: [8.8, 11.5], height: [3.5, 4.2], defaultScope: "full" }
];

const needPools: Need[][] = [
  ["interactiveClass", "localAmplification", "recording", "wirelessMic"],
  ["localAmplification", "recording", "remoteTeaching"],
  ["videoConference", "interactiveClass", "recording"],
  ["interactiveClass", "localAmplification"],
  ["videoConference", "localAmplification", "wirelessMic"]
];

const ceilings: CeilingType[] = ["suspended", "suspended", "suspended", "exposed"];
const floors: FloorMaterial[] = ["tile", "tile", "wood", "carpet"];
const walls: WallMaterial[] = ["painted", "painted", "hard", "acoustic"];
const softTreatments: SoftTreatment[] = ["curtains", "mixed", "none", "acousticPanels"];
const furnishing: FurnishingDensity[] = ["normal", "normal", "dense", "empty"];

const range = ([min, max]: [number, number]) => oneDecimal(min + Math.random() * (max - min));

const buildEnvironment = (): AcousticEnvironment => ({
  floorMaterial: pick(floors),
  wallMaterial: pick(walls),
  softTreatment: pick(softTreatments),
  furnishingDensity: pick(furnishing),
  hasGlassWall: maybe(0.35)
});

export const generateRandomPresalesCase = () => {
  const scenario = pick(scenarioPools);
  const needs = [...pick(needPools)];
  const hasRecording = needs.includes("recording") || needs.includes("remoteTeaching") || needs.includes("videoConference");
  const hasWireless = needs.includes("wirelessMic");
  const ceiling = pick(ceilings);
  const environment = buildEnvironment();
  const projectCode = Math.floor(1000 + Math.random() * 9000);
  const areaHint = scenario.scenario === "meetingRoom" ? "小型" : scenario.scenario === "combinedClassroom" ? "大型" : "标准";

  const profile: ClassroomProfile = {
    scenario: scenario.scenario,
    customScenario: "",
    customNeed: "",
    amplificationScope: maybe(0.75) ? scenario.defaultScope : "podium",
    projectName: `随机售前采集-${areaHint}${scenario.label}音频方案-${projectCode}`,
    customerName: pick(["某高校教务处", "某职业院校信息中心", "某实验教学中心", "某培训学院"]),
    needs,
    roomGeometry: {
      length: range(scenario.length),
      width: range(scenario.width),
      height: range(scenario.height),
      scale: 1,
      coordinateUnit: "meter"
    },
    existingDevices: {
      recordingHost: hasRecording ? pick(["录播主机", "教学一体机", "ClassIn 电脑", "远程互动主机"]) : "",
      computer: pick(["讲台电脑", "教师工作站", "笔记本电脑"]),
      legacySoundSystem: maybe(0.35) ? pick(["原有功放", "调音台+功放", "音频处理器+有源音箱"]) : "",
      legacyWirelessMic: hasWireless && maybe(0.25) ? pick(["原有无线手持麦", "无线领夹麦"]) : ""
    },
    engineeringConstraints: {
      ceiling,
      notes:
        ceiling === "suspended"
          ? "吊顶内可走弱电桥架，讲台侧有设备机柜，需复核空调出风口和检修口位置。"
          : "现场为裸顶或局部裸顶，优先考虑壁装音柱与明敷/桥架走线。"
    },
    acousticEnvironment: environment
  };

  const outputs = generateEngineeringOutputs(profile);

  return {
    profile,
    outputs,
    generatedAt: new Date().toISOString()
  };
};
