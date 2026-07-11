import { BookOpen, Download, Plus, RotateCcw } from "lucide-react";
import {
  auditoriumRearFillSpeakerLabels,
  ceilingAcousticTreatmentLabels,
  echoObservationLabels,
  floorMaterialLabels,
  furnishingDensityLabels,
  glassCoverageLabels,
  podiumPositionLabels,
  scenarioLabels,
  softTreatmentLabels,
  wallMaterialLabels
} from "../data/initialProfile";
import { getAmplificationScopeText, getLegacySoundSystemText, getNeedText } from "../lib/profileText";
import { generateEngineeringOutputs } from "../lib/engineeringRules";
import { generateEngineeringPoints, getDefaultSpeakerCount, getEffectiveAmplificationScope, shouldGenerateNewSpeakers } from "../lib/drawingEngine";
import { isAuditoriumScenario } from "../lib/scenarioRules";
import { getSpeakerSelectionReason, getSpeakerSelectionResult } from "../lib/speakerRules";
import { ruleChangePolicy } from "../data/ruleGovernance";
import type { ClassroomProfile, GeneratedPoint, LegacySpeakerPoint, Point } from "../types";
import type { AppBrandId } from "../brand";

export type CalibrationStatus = "untested" | "pass" | "fail";

export interface CalibrationCase {
  id: string;
  profile: ClassroomProfile;
  createdAt: string;
  status: CalibrationStatus;
  note: string;
  manualArrayMicPoints?: Point[];
  manualSpeakerPoints?: LegacySpeakerPoint[];
  manualSpeakerVariants?: {
    ceiling?: LegacySpeakerPoint[];
    wall?: LegacySpeakerPoint[];
  };
  ruleChangeApproval?: {
    required: boolean;
    policyVersion: string;
    state: "notRequested" | "requested" | "approved" | "rejected";
    note: string;
  };
}

interface TestConsoleProps {
  brandId: AppBrandId;
  cases: CalibrationCase[];
  activeCaseId: string | null;
  onGenerateOne: () => void;
  onGenerateBatch: () => void;
  onLoadMistakeBook?: () => void;
  onReset: () => void;
  onLoadCase: (item: CalibrationCase) => void;
  onMarkCase: (id: string, status: CalibrationStatus) => void;
  onNoteCase: (id: string, note: string) => void;
  onExport: () => void;
  exportStatus?: string;
  speakerCalibrationMode?: "default" | "ceilingOnly";
}

export function TestConsole({
  brandId,
  cases,
  activeCaseId,
  onGenerateOne,
  onGenerateBatch,
  onLoadMistakeBook,
  onReset,
  onLoadCase,
  onMarkCase,
  onNoteCase,
  onExport,
  exportStatus,
  speakerCalibrationMode = "default"
}: TestConsoleProps) {
  const passed = cases.filter((item) => item.status === "pass").length;
  const failed = cases.filter((item) => item.status === "fail").length;

  return (
    <section className="workPanel testConsole">
      <div className="panelHeader">
        <div>
          <span className="panelStep">00</span>
          <h2>方案校准测试台</h2>
          <p>随机生成售前采集，点选用例后在当前方案输出中手动标注结果。</p>
        </div>
        <div className="outputActions">
          <button type="button" onClick={onGenerateOne}>
            <Plus size={16} /> 生成 1 条
          </button>
          <button type="button" onClick={onGenerateBatch}>
            <Plus size={16} /> 批量 5 条
          </button>
          {onLoadMistakeBook && (
            <button type="button" onClick={onLoadMistakeBook}>
              <BookOpen size={16} /> 加载错题本
            </button>
          )}
          <button type="button" onClick={onExport}>
            <Download size={16} /> 导出记录
          </button>
          <button type="button" onClick={onReset}>
            <RotateCcw size={16} /> 清空
          </button>
        </div>
      </div>
      <div className="ruleGuardNotice">
        <strong>规则变更锁</strong>
        <span>{ruleChangePolicy.summary}</span>
      </div>
      {exportStatus && <div className="exportStatus">{exportStatus}</div>}

      <div className="testStats">
        <span>共 {cases.length}</span>
        <span className="pass">通过 {passed}</span>
        <span className="fail">不通过 {failed}</span>
      </div>

      <div className="testTable">
        <div className="testHeader">
          <span>序号</span>
          <span>随机售前采集 / 阵麦判断</span>
        </div>
        {cases.length ? (
          cases.map((item, index) => {
            const audit = getCaseAudit(item.profile, brandId);
            const ruleTrace = getRuleTrace(item.profile, speakerCalibrationMode, brandId);
            return (
              <article className={activeCaseId === item.id ? "testRow active" : "testRow"} key={item.id}>
                <strong>{index + 1}</strong>
                <button type="button" className="testCaseLoadButton" onClick={() => onLoadCase(item)}>
                  <b>{item.profile.projectName}</b>
                  <span>
                    {scenarioLabels[item.profile.scenario]} / {getNeedText(item.profile)}
                  </span>
                  {item.profile.needs.includes("localAmplification") && <span>扩声范围：{getAmplificationScopeText(item.profile)}</span>}
                  <span>
                    {item.profile.roomGeometry.length}m x {item.profile.roomGeometry.width}m x {item.profile.roomGeometry.height}m
                  </span>
                  <span>现场条件：{siteConditionText(item.profile)}</span>
                  <span>声学因素：{acousticText(item.profile)}</span>
                  <span>外接设备：{externalDeviceText(item.profile)}</span>
                  <span className="micAuditLine">阵麦：{audit.micSummary}</span>
                  <span className="ruleTraceLine">人工阵麦：{item.manualArrayMicPoints?.length ?? 0} 个</span>
                  <span className="ruleTraceLine">人工音箱：{item.manualSpeakerPoints?.length ?? 0} 个</span>
                  <span className="ruleTraceLine">阵麦规则：{ruleTrace.arrayMic}</span>
                  <span className="ruleTraceLine">音箱规则：{ruleTrace.speaker}</span>
                  <span className={audit.verdict === "待判断" ? "micAuditLine uncertain" : audit.verdict === "可疑" ? "micAuditLine fail" : "micAuditLine pass"}>
                    自检：{audit.verdict}；{audit.reason}
                  </span>
                </button>
                <div className="markButtons">
                  <button className={item.status === "pass" ? "mark pass active" : "mark pass"} type="button" onClick={() => onMarkCase(item.id, "pass")}>
                    通过
                  </button>
                  <button className={item.status === "fail" ? "mark fail active" : "mark fail"} type="button" onClick={() => onMarkCase(item.id, "fail")}>
                    不通过
                  </button>
                </div>
                <textarea value={item.note} onChange={(event) => onNoteCase(item.id, event.target.value)} placeholder="写下要校准的问题点" />
              </article>
            );
          })
        ) : (
          <div className="emptyState">先生成随机售前采集，再点选用例查看下方方案输出。</div>
        )}
      </div>
    </section>
  );
}

function getCaseAudit(profile: ClassroomProfile, brandId: AppBrandId) {
  const outputs = generateEngineeringOutputs(profile, {}, brandId);
  const mics = outputs.generatedPoints.filter((point) => point.type === "arrayMic");
  const micSummary = mics.length
    ? `${mics.length} 只；${mics.map((mic) => `${mic.label}@前墙${mic.position.y.toFixed(1)}m`).join("、")}`
    : "0 只";
  const existingAuditOrder = [
    "array.capacity",
    "site.central-air-position",
    "site.central-air-clearance",
    "site.central-air-quality-zone",
    "site.central-air-direction-priority",
    "array.back-wall-distance",
    "array.podium-multi-mic",
    "array.short-room-multi-mic",
    "array.mid-depth-review",
    "array.long-room-review"
  ];
  const finding = existingAuditOrder
    .map((code) => outputs.pointValidation.findings.find((item) => item.code === code && item.severity !== "info"))
    .find(Boolean);
  if (finding) {
    return {
      verdict: finding.severity === "warning" ? "待判断" : "可疑",
      reason: finding.internalMessage,
      micSummary
    };
  }
  return { verdict: "初判通过", reason: "未触发当前已知矛盾规则", micSummary };
}

function getRuleTrace(
  profile: ClassroomProfile,
  speakerCalibrationMode: "default" | "ceilingOnly" = "default",
  brandId: AppBrandId = "yinyi"
) {
  const outputs = generateEngineeringOutputs(profile, {}, brandId);
  const mics = outputs.generatedPoints.filter((point) => point.type === "arrayMic").sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  if (speakerCalibrationMode === "ceilingOnly") {
    const points = generateEngineeringPoints(profile, {
      arrayMicCount: mics.length,
      speakerCount: getDefaultSpeakerCount(profile, false) || undefined,
      speakerProductId: "CEILING-SPEAKER"
    });
    const ceilingSpeakers = points.filter((point) => point.type === "speaker").sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
    return {
      arrayMic: getArrayMicRuleTrace(profile, mics),
      speaker: `吸顶音箱校准；${ceilingSpeakers.length} 只；当前仅显示吸顶方案，用于校准吸顶音箱数量与选点。${getSpeakerPointTrace(ceilingSpeakers)}`
    };
  }
  const speakers = outputs.generatedPoints.filter((point) => point.type === "speaker").sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  if (!shouldGenerateNewSpeakers(profile)) {
    const legacySound = profile.existingDevices.legacySoundSystem.trim();
    const reason = legacySound
      ? `已填写${getLegacySoundSystemText(profile)}，按利旧音频链路处理，暂不新增音箱点位。`
      : "当前不满足新增音箱生成条件，暂不新增音箱点位。";
    return {
      arrayMic: getArrayMicRuleTrace(profile, mics),
      speaker: `利旧原系统 / 不新增音箱；${speakers.length} 只；${reason}`
    };
  }
  const speakerProduct = getSpeakerSelectionTraceLabel(profile);
  return {
    arrayMic: getArrayMicRuleTrace(profile, mics),
    speaker: `${speakerProduct}；${speakers.length} 只；${getSpeakerSelectionReason(profile)}${getSpeakerPointTrace(speakers)}`
  };
}

function getSpeakerSelectionTraceLabel(profile: ClassroomProfile) {
  const result = getSpeakerSelectionResult(profile);
  if (result === "CEILING-SPEAKER") return "吸顶音箱";
  if (result === "BOTH_ACCEPTABLE") return "吸顶/壁挂都可";
  if (result === "NO_NEW_SPEAKER") return "无需新增/利旧原系统";
  return "壁挂音柱";
}

function getArrayMicRuleTrace(profile: ClassroomProfile, mics: GeneratedPoint[]) {
  const length = profile.roomGeometry.length;
  const hasOnline = hasOnlinePickupNeed(profile);
  const scope = getEffectiveAmplificationScope(profile);
  const reason =
    profile.scenario === "combinedClassroom"
      ? "合班教室只按上课区计算拾音和扩声目标"
      : hasOnline && length >= 18
      ? "全场线上拾音且长度 >=18m，优先 3 麦"
      : scope === "podium" && !hasOnline
      ? "仅区域扩声且无线上拾音，优先主麦"
      : length <= 16
      ? "长度 <=16m，优先 2 麦或更少"
      : "按 5m 扩声半径 / 8m 线上拾音半径计算";
  return `${mics.length} 只；${reason}${getPointYTrace(mics)}`;
}

function getSpeakerPointTrace(speakers: GeneratedPoint[]) {
  if (!speakers.length) return "；未生成新增音箱点位";
  const angleTrace = speakers.some((speaker) => speaker.horizontalAngle !== undefined)
    ? `；水平角 ${speakers.map((speaker) => `${speaker.label}:${speaker.horizontalAngle ?? 0}°`).join(" / ")}`
    : "";
  return `${getPointYTrace(speakers)}${angleTrace}`;
}

function getPointYTrace(points: GeneratedPoint[]) {
  if (!points.length) return "";
  return `；距前墙 ${points.map((point) => `${point.position.y.toFixed(1)}m`).join(" / ")}`;
}

function siteConditionText(profile: ClassroomProfile) {
  const ceilingMap = {
    suspended: "有吊顶",
    exposed: "无吊顶 / 裸顶",
    unknown: "吊顶待确认"
  };
  const stage = profile.engineeringConstraints.stageSize;
  const teachingArea = profile.engineeringConstraints.teachingAreaSize;
  const frontArea = profile.scenario === "combinedClassroom"
    ? `上课区 ${teachingArea?.width ?? 0}m x ${teachingArea?.depth ?? 0}m`
    : isAuditoriumScenario(profile.scenario)
    ? `居中舞台 ${stage?.width ?? 0}m x ${stage?.depth ?? 0}m`
    : `讲台${podiumPositionLabels[profile.engineeringConstraints.podiumPosition ?? "frontCenter"]}`;
  const rearFill = isAuditoriumScenario(profile.scenario)
    ? `；${auditoriumRearFillSpeakerLabels[profile.engineeringConstraints.auditoriumRearFillSpeakers ?? "unknown"]}`
    : "";
  return `${ceilingMap[profile.engineeringConstraints.ceiling]}；${frontArea}${rearFill}；${profile.engineeringConstraints.notes || "无备注"}`;
}

function hasOnlinePickupNeed(profile: ClassroomProfile) {
  const siteText = `${profile.customNeed} ${profile.customScenario} ${profile.engineeringConstraints.notes}`;
  return (
    profile.needs.some((need) => ["recording", "videoConference", "interactiveClass"].includes(need)) ||
    (profile.needs.includes("other") && /互动课堂|学生区.*线上拾音|线上拾音|学生.*拾音/.test(siteText))
  );
}

function acousticText(profile: ClassroomProfile) {
  return [
    floorMaterialLabels[profile.acousticEnvironment.floorMaterial],
    wallMaterialLabels[profile.acousticEnvironment.wallMaterial],
    ceilingAcousticTreatmentLabels[profile.acousticEnvironment.ceilingAcousticTreatment ?? "unknown"],
    softTreatmentLabels[profile.acousticEnvironment.softTreatment],
    furnishingDensityLabels[profile.acousticEnvironment.furnishingDensity],
    glassCoverageLabels[profile.acousticEnvironment.glassCoverage ?? (profile.acousticEnvironment.hasGlassWall ? "large" : "none")],
    echoObservationLabels[profile.acousticEnvironment.echoObservation ?? "unknown"],
    profile.acousticEnvironment.measuredRt60 ? `实测 RT60 ${profile.acousticEnvironment.measuredRt60.toFixed(2)}s` : "未实测 RT60"
  ].join("；");
}

function externalDeviceText(profile: ClassroomProfile) {
  const items = [
    profile.existingDevices.recordingHost ? `录播/平台：${profile.existingDevices.recordingHost}` : "",
    profile.existingDevices.computer ? `电脑/一体机：${profile.existingDevices.computer}` : "",
    profile.existingDevices.legacySoundSystem ? `扩声/处理：${profile.existingDevices.legacySoundSystem}` : "",
    profile.existingDevices.legacyWirelessMic ? `麦克风：${profile.existingDevices.legacyWirelessMic}` : ""
  ].filter(Boolean);
  return items.length ? items.join("；") : "无";
}
