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
import { generateEngineeringPoints, getArrayMicCentralAirRequiredClearance, getDefaultSpeakerCount, getEffectiveAmplificationScope, shouldGenerateNewSpeakers } from "../lib/drawingEngine";
import { isAuditoriumScenario } from "../lib/scenarioRules";
import { getSpeakerSelectionReason, getSpeakerSelectionResult } from "../lib/speakerRules";
import { ruleChangePolicy } from "../data/ruleGovernance";
import type { ClassroomProfile, GeneratedPoint, LegacySpeakerPoint, Point } from "../types";

const ARRAY_MIC_CENTRAL_AIR_RISK_CLEARANCE_M = 1;

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
            const audit = getCaseAudit(item.profile);
            const ruleTrace = getRuleTrace(item.profile, speakerCalibrationMode);
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

function getCaseAudit(profile: ClassroomProfile) {
  const outputs = generateEngineeringOutputs(profile);
  const mics = outputs.generatedPoints.filter((point) => point.type === "arrayMic");
  const scope = getEffectiveAmplificationScope(profile);
  const length = profile.roomGeometry.length;
  const hasOnline = hasOnlinePickupNeed(profile);
  const isCombinedClassroom = profile.scenario === "combinedClassroom";
  const centralAirPoints = profile.engineeringConstraints.centralAirConditionerPoints ?? [];
  const micSummary = mics.length
    ? `${mics.length} 只；${mics.map((mic) => `${mic.label}@前墙${mic.position.y.toFixed(1)}m`).join("、")}`
    : "0 只";

  if (mics.length > 5) return { verdict: "可疑", reason: "超过一主四从 5 只上限", micSummary };
  if (profile.engineeringConstraints.hasCentralAirConditioner && centralAirPoints.length === 0) {
    return { verdict: "待判断", reason: "现场有中央空调，需先在点位图手动标注位置，再校准阵麦避让", micSummary };
  }
  const requiredCentralAirClearance = getArrayMicCentralAirRequiredClearance(profile);
  const centralAirViolation = mics.find((mic) => centralAirPoints.some((air) => getArrayMicClearanceToCentralAir(mic.position, air) < requiredCentralAirClearance));
  if (centralAirViolation) {
    return { verdict: "可疑", reason: `${centralAirViolation.label} 距中央空调本体小于 ${requiredCentralAirClearance.toFixed(1)}m，当前 AFC / 混响风险下需要继续避让`, micSummary };
  }
  const centralAirRisk = mics.find((mic) => centralAirPoints.some((air) => getArrayMicClearanceToCentralAir(mic.position, air) < ARRAY_MIC_CENTRAL_AIR_RISK_CLEARANCE_M));
  if (centralAirRisk) {
    return { verdict: "待判断", reason: `${centralAirRisk.label} 距中央空调本体小于 1m，降噪算法会更多介入，扩声和线上拾音还原度会降低`, micSummary };
  }
  const lateralPriorityIssue = getCentralAirLateralPriorityIssue(profile);
  if (lateralPriorityIssue) {
    return { verdict: "可疑", reason: lateralPriorityIssue, micSummary };
  }
  const lastMicBackWallIssue = getLastMicBackWallIssue(profile);
  if (lastMicBackWallIssue) {
    return { verdict: "可疑", reason: lastMicBackWallIssue, micSummary };
  }
  if (scope === "podium" && !hasOnline && mics.length > 1) {
    const localArea = profile.scenario === "auditorium" ? "舞台区域扩声" : "讲台区域扩声";
    return { verdict: "可疑", reason: `${localArea}且无线上拾音需求，却推荐多麦`, micSummary };
  }
  if (length <= 9 && !hasOnline && mics.length > 1) return { verdict: "可疑", reason: "长度 <=9m 且无线上拾音需求，通常应单麦优先", micSummary };
  if (!isCombinedClassroom && length > 9 && length <= 16 && scope === "full") return { verdict: "待判断", reason: "9-16m 全场扩声需重点看后排发言和听感，适合人工校准", micSummary };
  if (length > 16 && scope === "full" && mics.length < 3) return { verdict: "待判断", reason: "长度 >16m 全场扩声但少于三麦，需要确认是否接受", micSummary };
  return { verdict: "初判通过", reason: "未触发当前已知矛盾规则", micSummary };
}

function getRuleTrace(profile: ClassroomProfile, speakerCalibrationMode: "default" | "ceilingOnly" = "default") {
  const outputs = generateEngineeringOutputs(profile);
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

function getLastMicBackWallIssue(profile: ClassroomProfile) {
  const outputs = generateEngineeringOutputs(profile);
  const mics = outputs.generatedPoints.filter((point) => point.type === "arrayMic").sort((a, b) => a.position.y - b.position.y);
  if (mics.length <= 1) return "";
  const lastMic = mics[mics.length - 1];
  const backWallDistance = profile.roomGeometry.length - lastMic.position.y;
  const minimumBackWallDistance = mics.length === 2 && profile.roomGeometry.length <= 16 ? (profile.roomGeometry.length > 12 ? 5 : 4) : 3;
  if (backWallDistance >= minimumBackWallDistance) return "";
  return `${lastMic.label} 距后墙仅 ${backWallDistance.toFixed(1)}m，应把最后一支往前移到距后墙至少 ${minimumBackWallDistance}m，减少中前区学生背向从麦说话的情况`;
}

function getCentralAirLateralPriorityIssue(profile: ClassroomProfile) {
  const centralAirPoints = profile.engineeringConstraints.centralAirConditionerPoints ?? [];
  if (!centralAirPoints.length) return "";

  const outputs = generateEngineeringOutputs(profile);
  const mics = outputs.generatedPoints.filter((point) => point.type === "arrayMic");
  const baseProfile: ClassroomProfile = {
    ...profile,
    engineeringConstraints: {
      ...profile.engineeringConstraints,
      hasCentralAirConditioner: false,
      centralAirConditionerCount: 0,
      centralAirConditionerPoints: []
    }
  };
  const baseMics = generateEngineeringOutputs(baseProfile).generatedPoints.filter((point) => point.type === "arrayMic");

  for (const mic of mics) {
    const baseMic = baseMics.find((item) => item.id === mic.id);
    if (!baseMic) continue;
    const lateralMove = Math.abs(mic.position.x - baseMic.position.x);
    const depthMove = Math.abs(mic.position.y - baseMic.position.y);
    const prefersDepthMove = profile.roomGeometry.length >= profile.roomGeometry.width;
    if (prefersDepthMove && lateralMove > 0.05 && depthMove <= 0.05 && canMoveForwardOrBackwardClearOfCentralAir(profile, baseMic.position)) {
      return `${mic.label} 因中央空调避让发生左右偏移，但当前房间长大于等于宽，前后方向存在可用点；应优先前后避让`;
    }
    if (!prefersDepthMove && depthMove > 0.05 && lateralMove <= 0.05 && canMoveLeftOrRightClearOfCentralAir(profile, baseMic.position)) {
      return `${mic.label} 因中央空调避让发生前后偏移，但当前房间长小于宽，左右方向存在可用点；应优先左右避让`;
    }
  }
  return "";
}

function canMoveForwardOrBackwardClearOfCentralAir(profile: ClassroomProfile, position: { x: number; y: number }) {
  const centralAirPoints = profile.engineeringConstraints.centralAirConditionerPoints ?? [];
  const roomLength = profile.roomGeometry.length;
  return centralAirPoints.some((air) => {
    const requiredClearance = getArrayMicCentralAirRequiredClearance(profile);
    const halfDepth = (air.size?.depth ?? 0.8) / 2 + requiredClearance + 0.3;
    const frontY = roundOne(air.position.y - halfDepth);
    const backY = roundOne(air.position.y + halfDepth);
    return [frontY, backY].some((y) => y >= 1.2 && y <= roomLength - 0.8 && centralAirPoints.every((item) => getArrayMicClearanceToCentralAir({ x: position.x, y }, item) >= requiredClearance));
  });
}

function canMoveLeftOrRightClearOfCentralAir(profile: ClassroomProfile, position: { x: number; y: number }) {
  const centralAirPoints = profile.engineeringConstraints.centralAirConditionerPoints ?? [];
  const roomWidth = profile.roomGeometry.width;
  return centralAirPoints.some((air) => {
    const requiredClearance = getArrayMicCentralAirRequiredClearance(profile);
    const halfWidth = (air.size?.width ?? 0.8) / 2 + requiredClearance + 0.3;
    const leftX = roundOne(air.position.x - halfWidth);
    const rightX = roundOne(air.position.x + halfWidth);
    return [leftX, rightX].some((x) => x >= 0.8 && x <= roomWidth - 0.8 && centralAirPoints.every((item) => getArrayMicClearanceToCentralAir({ x, y: position.y }, item) >= requiredClearance));
  });
}

function getArrayMicClearanceToCentralAir(
  mic: { x: number; y: number },
  air: ClassroomProfile["engineeringConstraints"]["centralAirConditionerPoints"][number]
) {
  const micHalfSize = 0.3;
  const halfWidth = (air.size?.width ?? 0.8) / 2 + micHalfSize;
  const halfDepth = (air.size?.depth ?? 0.8) / 2 + micHalfSize;
  const dx = Math.max(Math.abs(mic.x - air.position.x) - halfWidth, 0);
  const dy = Math.max(Math.abs(mic.y - air.position.y) - halfDepth, 0);
  return Math.hypot(dx, dy);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
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
