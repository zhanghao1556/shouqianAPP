import type {
  AuditoriumRearFillSpeakerStatus,
  CeilingAcousticTreatment,
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

export const yiouBrand = {
  name: "音翼科技",
  fullName: "音翼科技",
  slogan: "",
  primary: "#0b5cad",
  accent: "#00a6a6",
  ink: "#122033"
};

export const needLabels: Record<Need, string> = {
  videoConference: "视频会议",
  interactiveClass: "互动课堂",
  localAmplification: "本地扩声",
  recording: "录播",
  remoteTeaching: "远程授课",
  wirelessMic: "无线手持",
  other: "其他"
};

export const needOptions: Array<{ value: Need; label: string; helper: string }> = [
  { value: "videoConference", label: "视频会议", helper: "会议终端或远程协作" },
  { value: "interactiveClass", label: "互动课堂", helper: "学生区线上拾音与课堂互动" },
  { value: "localAmplification", label: "本地扩声", helper: "吸顶音箱或音柱覆盖" },
  { value: "recording", label: "录播", helper: "课堂录制或平台采集" },
  { value: "other", label: "其他等", helper: "现场补充说明" }
];

export const scenarioLabels: Record<Scenario, string> = {
  meetingRoom: "会议室",
  standardClassroom: "普通教室",
  lectureClassroom: "阶梯教室",
  auditorium: "报告厅",
  combinedClassroom: "合班教室",
  other: "其他"
};

export const scenarioOptions: Array<{ value: Scenario; label: string }> = [
  { value: "meetingRoom", label: "会议室" },
  { value: "standardClassroom", label: "普通教室" },
  { value: "lectureClassroom", label: "阶梯教室" },
  { value: "auditorium", label: "报告厅" },
  { value: "combinedClassroom", label: "合班教室" },
  { value: "other", label: "其他" }
];

export const floorMaterialLabels: Record<FloorMaterial, string> = {
  tile: "瓷砖 / 石材地面",
  wood: "木地板 / PVC 地面",
  carpet: "地毯 / 软质地面",
  unknown: "待确认"
};

export const wallMaterialLabels: Record<WallMaterial, string> = {
  painted: "普通粉刷墙",
  hard: "硬质墙面",
  acoustic: "有吸音墙面",
  unknown: "待确认"
};

export const softTreatmentLabels: Record<SoftTreatment, string> = {
  none: "基本无软装吸音",
  curtains: "有窗帘",
  acousticPanels: "有吸音板 / 声学装修",
  mixed: "窗帘与少量吸音混合",
  unknown: "待确认"
};

export const ceilingAcousticTreatmentLabels: Record<CeilingAcousticTreatment, string> = {
  hard: "硬质顶面 / 石膏板",
  partial: "局部吸声处理",
  acoustic: "大面积吸声吊顶",
  unknown: "待确认"
};

export const glassCoverageLabels: Record<GlassCoverage, string> = {
  none: "基本无玻璃墙",
  partial: "少量玻璃",
  large: "大面积玻璃",
  unknown: "待确认"
};

export const echoObservationLabels: Record<EchoObservation, string> = {
  none: "无明显拖尾",
  tail: "有明显拖尾",
  obvious: "有明显回声 / 颤动回声",
  unknown: "未测试"
};

export const furnishingDensityLabels: Record<FurnishingDensity, string> = {
  empty: "空房 / 家具很少",
  normal: "正常桌椅布置",
  dense: "家具布置密集",
  unknown: "待确认"
};

export const podiumPositionLabels = {
  frontCenter: "前墙居中",
  frontLeft: "前墙左侧",
  frontRight: "前墙右侧",
  unknown: "无讲台"
} as const;

export const auditoriumRearFillSpeakerLabels: Record<AuditoriumRearFillSpeakerStatus, string> = {
  present: "有后排补声 / 辅助音箱",
  absent: "无后排补声 / 辅助音箱",
  unknown: "后排补声 / 辅助音箱待确认"
};

export const externalDeviceOptions = {
  recordingHost: ["录播主机", "录播摄像机", "视频会议终端", "中控主机"],
  computer: ["讲台电脑", "笔记本电脑", "ClassIn 一体机", "会议一体机"],
  legacySoundSystem: ["原有音频系统"],
  legacyWirelessMic: ["有线麦克风", "无线手持麦"]
} as const;

export const createInitialProfile = (): ClassroomProfile => ({
  scenario: "standardClassroom",
  customScenario: "",
  customNeed: "",
  amplificationScope: "podium",
  projectName: "",
  customerName: "",
  needs: ["localAmplification"],
  roomGeometry: {
    length: 8,
    width: 6,
    height: 3,
    scale: 1,
    coordinateUnit: "meter"
  },
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
    centralAirConditionerCount: 1,
    centralAirConditionerPoints: [],
    auditoriumRearFillSpeakers: "unknown",
    speakerProductOverride: "auto",
    microphoneSolution: "auto",
    overheadSpeakerMounting: "unknown",
    hasPodium: true,
    lineArrayMode: "auto",
    lineArrayInstallation: "auto",
    processorTier: "auto",
    notes: ""
  },
  acousticEnvironment: {
    floorMaterial: "tile",
    wallMaterial: "painted",
    softTreatment: "none",
    furnishingDensity: "normal",
    hasGlassWall: false,
    ceilingAcousticTreatment: "unknown",
    glassCoverage: "none",
    echoObservation: "unknown"
  }
});
