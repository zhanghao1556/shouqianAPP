import type { Need, ProjectProfile, QuestionOption, QuestionStep, Scenario } from "../types";

export const scenarioOptions: QuestionOption<Scenario>[] = [
  { label: "会议室", value: "meeting", helper: "视频会议、远程协作、日常讨论" },
  { label: "普通教室", value: "classroom", helper: "互动课堂、常态化教学" },
  { label: "阶梯教室", value: "lecture", helper: "较大空间、座位有坡度" },
  { label: "报告厅", value: "auditorium", helper: "演讲、培训、会议扩声" },
  { label: "其他", value: "other", helper: "先采集信息，再人工确认方案" }
];

export const needOptions: QuestionOption<Need>[] = [
  { label: "视频会议", value: "videoConference" },
  { label: "互动课堂", value: "interactiveClass" },
  { label: "本地扩声", value: "localAmplification" },
  { label: "录播", value: "recording" },
  { label: "无线手持", value: "wirelessMic" },
  { label: "远程授课", value: "remoteTeaching" },
  { label: "其他", value: "other" }
];

export const questionFlow: QuestionStep[] = [
  {
    id: "scenario",
    title: "第一步：这个空间主要属于哪种使用场景？",
    type: "single",
    options: scenarioOptions,
    requiredFields: ["scenario"],
    next: () => "needs"
  },
  {
    id: "needs",
    title: "第二步：这次项目需要解决哪些使用需求？",
    type: "multiple",
    options: needOptions,
    requiredFields: ["needs"],
    next: () => "space"
  },
  {
    id: "space",
    title: "第三步：请补充空间尺寸和现场条件。",
    type: "spatial",
    requiredFields: ["space.length", "space.width", "space.height"],
    next: (profile: ProjectProfile) => {
      if (profile.needs.includes("recording") && profile.space.externalDevices.length === 0) {
        return "devices";
      }
      return "constraints";
    }
  },
  {
    id: "devices",
    title: "录播或会议系统需要确认外接设备。",
    type: "text",
    requiredFields: ["space.externalDevices"],
    next: () => "constraints"
  },
  {
    id: "constraints",
    title: "最后确认预算倾向和施工限制。",
    type: "text",
    requiredFields: ["constraints.budgetLevel"],
    next: () => null
  }
];

export const scenarioLabels: Record<Scenario, string> = {
  meeting: "会议室",
  classroom: "普通教室",
  lecture: "阶梯教室",
  auditorium: "报告厅",
  other: "其他"
};

export const needLabels: Record<Need, string> = {
  videoConference: "视频会议",
  interactiveClass: "互动课堂",
  localAmplification: "本地扩声",
  recording: "录播",
  wirelessMic: "无线手持",
  remoteTeaching: "远程授课",
  other: "其他"
};

export const initialProfile: ProjectProfile = {
  needs: [],
  space: {
    ceiling: "unknown",
    podium: "unknown",
    acPositions: [],
    glassWalls: [],
    externalDevices: []
  },
  constraints: {
    installLimitations: [],
    notes: ""
  }
};
