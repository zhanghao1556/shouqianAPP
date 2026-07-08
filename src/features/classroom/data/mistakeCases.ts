import type { ClassroomProfile } from "../types";

export interface MistakeCaseSeed {
  note: string;
  profile: ClassroomProfile;
}

type ProfilePatch = Partial<Omit<ClassroomProfile, "roomGeometry" | "existingDevices" | "engineeringConstraints" | "acousticEnvironment">> & {
  roomGeometry?: Partial<ClassroomProfile["roomGeometry"]>;
  existingDevices?: Partial<ClassroomProfile["existingDevices"]>;
  engineeringConstraints?: Partial<ClassroomProfile["engineeringConstraints"]>;
  acousticEnvironment?: Partial<ClassroomProfile["acousticEnvironment"]>;
};

const defaultProfile: ClassroomProfile = {
  scenario: "standardClassroom",
  customScenario: "",
  customNeed: "",
  amplificationScope: "podium",
  projectName: "错题本复测案例",
  customerName: "校准测试",
  needs: ["localAmplification"],
  roomGeometry: { length: 8, width: 6, height: 3, scale: 1, coordinateUnit: "meter" },
  existingDevices: {
    recordingHost: "",
    computer: "",
    legacySoundSystem: "",
    legacyWirelessMic: "",
    legacySpeakerPoints: []
  },
  engineeringConstraints: {
    ceiling: "suspended",
    podiumPosition: "frontCenter",
    stageSize: {
      width: 8,
      depth: 3
    },
    teachingAreaSize: {
      width: 6,
      depth: 4
    },
    hasCentralAirConditioner: false,
    centralAirConditionerCount: 0,
    centralAirConditionerPoints: [],
    notes: ""
  },
  acousticEnvironment: {
    floorMaterial: "tile",
    wallMaterial: "painted",
    softTreatment: "none",
    furnishingDensity: "normal",
    hasGlassWall: false
  }
};

const baseProfile = (patch: ProfilePatch): ClassroomProfile => ({
  ...defaultProfile,
  ...patch,
  roomGeometry: { ...defaultProfile.roomGeometry, ...patch.roomGeometry },
  existingDevices: { ...defaultProfile.existingDevices, ...patch.existingDevices },
  engineeringConstraints: { ...defaultProfile.engineeringConstraints, ...patch.engineeringConstraints },
  acousticEnvironment: { ...defaultProfile.acousticEnvironment, ...patch.acousticEnvironment }
});

export const mistakeCaseSeeds: MistakeCaseSeed[] = [
  {
    note: "后排阵麦可以往前一米",
    profile: baseProfile({
      scenario: "combinedClassroom",
      needs: ["recording"],
      amplificationScope: "podium",
      roomGeometry: { length: 14.4, width: 8.9, height: 4 },
      engineeringConstraints: {
        ceiling: "suspended",
        podiumPosition: "frontCenter",
        hasCentralAirConditioner: true,
        centralAirConditionerCount: 1,
        notes: "后排过道约1.2m，单侧过道。现场有中央空调，需在点位图标记中央空调位置并避开阵麦。"
      }
    })
  },
  {
    note: "互动课堂需要后排加阵麦做学生区线上拾音",
    profile: baseProfile({
      scenario: "combinedClassroom",
      needs: ["interactiveClass"],
      amplificationScope: "podium",
      roomGeometry: { length: 16.2, width: 11.3, height: 4.1 },
      engineeringConstraints: {
        ceiling: "suspended",
        podiumPosition: "frontCenter",
        hasCentralAirConditioner: true,
        centralAirConditionerCount: 1,
        notes: "无后排过道，两侧为座位。现场有中央空调，需在点位图标记中央空调位置并避开阵麦。"
      }
    })
  },
  {
    note: "互动课堂需要后排加阵麦做学生区线上拾音",
    profile: baseProfile({
      scenario: "lectureClassroom",
      needs: ["interactiveClass"],
      amplificationScope: "podium",
      roomGeometry: { length: 14.3, width: 9.8, height: 4.5 },
      engineeringConstraints: {
        ceiling: "suspended",
        podiumPosition: "frontCenter",
        notes: "后排过道约1.2m，两侧过道。讲台侧有设备机柜，需复核空调出风口、投影幕、灯具检修口和弱电桥架位置。"
      }
    })
  },
  {
    note: "从麦有点太靠后了，可以往前移一点",
    profile: baseProfile({
      scenario: "combinedClassroom",
      needs: ["localAmplification", "recording"],
      amplificationScope: "full",
      roomGeometry: { length: 14.7, width: 8.8, height: 3.7 },
      engineeringConstraints: {
        ceiling: "exposed",
        podiumPosition: "unknown",
        notes: "无后排过道，两侧为座位。现场为裸顶或局部裸顶，需复核壁装位置、明敷走线路径和音柱安装条件。"
      }
    })
  },
  {
    note: "从麦还可以再往前移一移",
    profile: baseProfile({
      scenario: "lectureClassroom",
      needs: ["localAmplification", "interactiveClass"],
      amplificationScope: "full",
      roomGeometry: { length: 14.9, width: 8.8, height: 4.3 },
      engineeringConstraints: {
        ceiling: "suspended",
        podiumPosition: "frontCenter",
        hasCentralAirConditioner: true,
        centralAirConditionerCount: 1,
        notes: "无后排过道，两侧为座位。现场有中央空调，需在点位图标记中央空调位置并避开阵麦。"
      }
    })
  },
  {
    note: "长23.1米为什么只有两只麦",
    profile: baseProfile({
      scenario: "auditorium",
      needs: ["videoConference", "localAmplification"],
      amplificationScope: "podium",
      roomGeometry: { length: 23.1, width: 13.3, height: 5.4 },
      engineeringConstraints: {
        ceiling: "exposed",
        podiumPosition: "frontCenter",
        notes: "后排过道约1.2m，两侧为座位。现场为裸顶或局部裸顶，需复核壁装位置、明敷走线路径和音柱安装条件。"
      }
    })
  },
  {
    note: "有录播，为什么还是两麦不是三麦",
    profile: baseProfile({
      scenario: "auditorium",
      needs: ["localAmplification", "recording"],
      amplificationScope: "podium",
      roomGeometry: { length: 23.8, width: 11.9, height: 4.8 },
      engineeringConstraints: {
        ceiling: "unknown",
        podiumPosition: "frontCenter",
        hasCentralAirConditioner: true,
        centralAirConditionerCount: 1,
        notes: "无后排过道，两侧为座位。现场有中央空调，需在点位图标记中央空调位置并避开阵麦。"
      }
    })
  },
  {
    note: "这个长宽一支麦克风就够了，不需要从麦",
    profile: baseProfile({
      scenario: "standardClassroom",
      needs: ["localAmplification", "other"],
      customNeed: "现场补充需求",
      amplificationScope: "full",
      roomGeometry: { length: 9.3, width: 8.3, height: 3.2 },
      engineeringConstraints: {
        ceiling: "suspended",
        podiumPosition: "frontCenter",
        hasCentralAirConditioner: true,
        centralAirConditionerCount: 1,
        notes: "无后排过道，两侧为座位。现场有中央空调，需在点位图标记中央空调位置并避开阵麦。"
      }
    })
  },
  {
    note: "从麦可以往前0.5米左右",
    profile: baseProfile({
      scenario: "lectureClassroom",
      needs: ["localAmplification"],
      amplificationScope: "full",
      roomGeometry: { length: 12.3, width: 9.3, height: 3.5 },
      engineeringConstraints: {
        ceiling: "suspended",
        podiumPosition: "frontCenter",
        hasCentralAirConditioner: true,
        centralAirConditionerCount: 1,
        notes: "后排过道约1.2m，两侧过道。现场有中央空调，需在点位图标记中央空调位置并避开阵麦。"
      }
    })
  },
  {
    note: "从麦可以往前0.5米左右",
    profile: baseProfile({
      scenario: "lectureClassroom",
      needs: ["localAmplification"],
      amplificationScope: "full",
      roomGeometry: { length: 11.9, width: 8.2, height: 3.7 },
      engineeringConstraints: {
        ceiling: "suspended",
        podiumPosition: "frontCenter",
        hasCentralAirConditioner: true,
        centralAirConditionerCount: 1,
        notes: "无后排过道，两侧为座位。现场有中央空调，需在点位图标记中央空调位置并避开阵麦。"
      }
    })
  },
  {
    note: "不需要从麦",
    profile: baseProfile({
      scenario: "standardClassroom",
      needs: ["localAmplification", "recording"],
      amplificationScope: "full",
      roomGeometry: { length: 9.5, width: 7.6, height: 3.4 },
      engineeringConstraints: {
        ceiling: "suspended",
        podiumPosition: "frontCenter",
        notes: "无后排过道，两侧为座位。讲台侧有设备机柜，需复核空调出风口、投影幕、灯具检修口和弱电桥架位置。"
      }
    })
  },
  {
    note: "一支麦克风就够了；主麦优先前后策略",
    profile: baseProfile({
      scenario: "standardClassroom",
      needs: ["localAmplification", "other"],
      customNeed: "现场补充需求",
      amplificationScope: "podium",
      roomGeometry: { length: 8.8, width: 6, height: 3.4 },
      engineeringConstraints: {
        ceiling: "suspended",
        podiumPosition: "frontCenter",
        hasCentralAirConditioner: true,
        centralAirConditionerCount: 1,
        notes: "后排过道约1.2m，单侧过道。现场有中央空调，需在点位图标记中央空调位置并避开阵麦。"
      }
    })
  },
  {
    note: "阵麦进入空调 AFC / 混响风险避让区",
    profile: baseProfile({
      scenario: "lectureClassroom",
      needs: ["localAmplification"],
      amplificationScope: "podium",
      roomGeometry: { length: 12.3, width: 10.4, height: 4 },
      engineeringConstraints: {
        ceiling: "suspended",
        podiumPosition: "frontCenter",
        hasCentralAirConditioner: true,
        centralAirConditionerCount: 1,
        centralAirConditionerPoints: [
          { id: "mistake-ac-1", label: "中央空调1", position: { x: 5.2, y: 3.2 }, size: { width: 0.8, depth: 0.8 } }
        ],
        notes: "后排过道约1.2m，两侧为座位。现场有中央空调，需在点位图标记中央空调位置并避开阵麦。"
      }
    })
  },
  {
    note: "其他里的互动课堂为什么不加从麦",
    profile: baseProfile({
      scenario: "lectureClassroom",
      needs: ["other"],
      customNeed: "互动课堂 / 现场补充需求",
      amplificationScope: "podium",
      roomGeometry: { length: 12.8, width: 8.3, height: 3.8 },
      engineeringConstraints: {
        ceiling: "suspended",
        podiumPosition: "frontLeft",
        notes: "后排过道约1.2m，两侧为座位。讲台侧有设备机柜，需复核空调出风口、投影幕、灯具检修口和弱电桥架位置。"
      }
    })
  },
  {
    note: "三只阵麦离得太近，后面没有覆盖",
    profile: baseProfile({
      scenario: "auditorium",
      needs: ["videoConference", "localAmplification"],
      amplificationScope: "full",
      roomGeometry: { length: 21.1, width: 14, height: 5.8 },
      engineeringConstraints: {
        ceiling: "suspended",
        podiumPosition: "unknown",
        notes: "无后排过道，两侧为座位。讲台侧有设备机柜，需复核空调出风口、投影幕、灯具检修口和弱电桥架位置。"
      }
    })
  }
];
