import { Check, RotateCcw, X } from "lucide-react";
import { formatBrandText } from "../brand";
import type { ClassroomProfile, GeneratedOutputs } from "../types";

export const outputCalibrationKeys = [
  "readiness",
  "microphoneSelection",
  "speakerSelection",
  "equipmentList",
  "arrayMicPoints",
  "speakerPoints",
  "wiring",
  "topology",
  "installationGuide",
  "audioPlan",
  "validation",
  "report"
] as const;

export type OutputCalibrationKey = (typeof outputCalibrationKeys)[number];
export type OutputCalibrationStatus = "untested" | "pass" | "fail";
export interface OutputCalibrationMark {
  status: OutputCalibrationStatus;
  note: string;
}
export type OutputCalibrationChecks = Partial<Record<OutputCalibrationKey, OutputCalibrationMark>>;

interface OutputCalibrationPanelProps {
  profile: ClassroomProfile;
  outputs: GeneratedOutputs;
  checks?: OutputCalibrationChecks;
  enabled: boolean;
  onChange: (key: OutputCalibrationKey, patch: Partial<OutputCalibrationMark>) => void;
}

interface OutputCalibrationItem {
  key: OutputCalibrationKey;
  title: string;
  summary: string;
  details: string[];
}

export function OutputCalibrationPanel({ profile, outputs, checks = {}, enabled, onChange }: OutputCalibrationPanelProps) {
  const items = getOutputCalibrationItems(profile, outputs);
  const passed = items.filter((item) => checks[item.key]?.status === "pass").length;
  const failed = items.filter((item) => checks[item.key]?.status === "fail").length;

  return (
    <section className="outputCalibrationPanel" aria-label="全部方案输出校准">
      <div className="outputCalibrationHeader">
        <div>
          <span>全部方案输出校准</span>
          <h3>逐项确认输出结果</h3>
        </div>
        <div className="outputCalibrationStats">
          <span>通过 {passed}</span>
          <span>不通过 {failed}</span>
          <span>待校准 {items.length - passed - failed}</span>
        </div>
      </div>
      {!enabled ? <div className="outputCalibrationDisabled">请先从左侧选择一个校准用例。</div> : null}
      <div className="outputCalibrationList">
        {items.map((item, index) => {
          const mark = checks[item.key] ?? { status: "untested" as const, note: "" };
          return (
            <article className={`outputCalibrationRow ${mark.status}`} key={item.key}>
              <div className="outputCalibrationRowHeader">
                <span className="outputCalibrationIndex">{String(index + 1).padStart(2, "0")}</span>
                <div className="outputCalibrationTitle">
                  <strong>{item.title}</strong>
                  <span>{item.summary}</span>
                </div>
                <div className="outputCalibrationActions" role="group" aria-label={`${item.title}校准状态`}>
                  <button
                    type="button"
                    className={mark.status === "pass" ? "pass active" : "pass"}
                    aria-pressed={mark.status === "pass"}
                    disabled={!enabled}
                    onClick={() => onChange(item.key, { status: "pass" })}
                    title="标记通过"
                  >
                    <Check size={14} /> 通过
                  </button>
                  <button
                    type="button"
                    className={mark.status === "fail" ? "fail active" : "fail"}
                    aria-pressed={mark.status === "fail"}
                    disabled={!enabled}
                    onClick={() => onChange(item.key, { status: "fail" })}
                    title="标记不通过"
                  >
                    <X size={14} /> 不通过
                  </button>
                  <button
                    type="button"
                    className="reset"
                    disabled={!enabled || mark.status === "untested"}
                    onClick={() => onChange(item.key, { status: "untested" })}
                    title="恢复待校准"
                    aria-label={`${item.title}恢复待校准`}
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>
              <details className="outputCalibrationDetails">
                <summary>查看当前输出</summary>
                {item.details.length ? (
                  <ul>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                ) : (
                  <p>当前没有生成此项输出。</p>
                )}
                <textarea
                  value={mark.note}
                  disabled={!enabled}
                  onChange={(event) => onChange(item.key, { note: event.target.value })}
                  placeholder={`${item.title}校准备注`}
                />
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function getOutputCalibrationCaseStatus(checks: OutputCalibrationChecks): OutputCalibrationStatus {
  if (outputCalibrationKeys.some((key) => checks[key]?.status === "fail")) return "fail";
  if (outputCalibrationKeys.every((key) => checks[key]?.status === "pass")) return "pass";
  return "untested";
}

export function getOutputCalibrationProgress(checks?: OutputCalibrationChecks) {
  const passed = outputCalibrationKeys.filter((key) => checks?.[key]?.status === "pass").length;
  const failed = outputCalibrationKeys.filter((key) => checks?.[key]?.status === "fail").length;
  return { passed, failed, total: outputCalibrationKeys.length };
}

function getOutputCalibrationItems(profile: ClassroomProfile, outputs: GeneratedOutputs): OutputCalibrationItem[] {
  const mics = outputs.generatedPoints.filter((point) => point.type === "arrayMic");
  const speakers = outputs.generatedPoints.filter((point) => point.type === "speaker");
  const nonReverbRisks = [...outputs.riskItems, ...outputs.reviewItems].filter((item) => !isReverberationText(item));
  const nonReverbFindings = outputs.pointValidation.findings.filter((item) => !isReverberationText(`${item.title} ${item.internalMessage}`));
  const items: OutputCalibrationItem[] = [
    {
      key: "readiness",
      title: "方案完整性",
      summary: outputs.isFinalReady ? "方案已具备正式输出条件" : "仍有采集信息待补充",
      details: outputs.completeness
        .map((item) => `${item.complete ? "已完成" : "待补充"}：${item.label}${item.complete ? "" : `；${item.hint}`}`)
        .filter((item) => !isReverberationText(item))
    },
    {
      key: "microphoneSelection",
      title: "麦克风推荐与客户选择",
      summary: `推荐${outputs.solutionSelection.microphone.recommendedLabel}；采用${outputs.solutionSelection.microphone.selectedLabel}`,
      details: [
        outputs.solutionSelection.microphone.recommendationReason,
        ...outputs.solutionSelection.microphone.decisionFactors,
        `优势：${outputs.solutionSelection.microphone.advantages}`,
        `注意：${outputs.solutionSelection.microphone.cautions}`
      ]
    },
    {
      key: "speakerSelection",
      title: "音箱推荐与客户选择",
      summary: `推荐${outputs.solutionSelection.speaker.recommendedLabel}；采用${outputs.solutionSelection.speaker.selectedLabel}`,
      details: [
        outputs.solutionSelection.speaker.recommendationReason,
        `优势：${outputs.solutionSelection.speaker.advantages}`,
        `注意：${outputs.solutionSelection.speaker.cautions}`,
        outputs.solutionSelection.speaker.requiresSpecialReview ? "当前选择需要专项复核。" : "当前未触发强制选择专项复核。"
      ]
    },
    {
      key: "equipmentList",
      title: "设备清单",
      summary: `${outputs.productSelection.filter((item) => item.quantity > 0).length} 类设备`,
      details: outputs.productSelection.filter((item) => item.quantity > 0).map((item) => `${formatBrandText(item.name)} ×${item.quantity}`)
    },
    {
      key: "arrayMicPoints",
      title: "阵麦 / 线阵麦点位",
      summary: `${mics.length} 只；${mics.map((point) => `前墙${point.position.y.toFixed(1)}m`).join("、") || "未生成"}`,
      details: mics.map((point) => `${point.label}：(${point.position.x.toFixed(1)}m, ${point.position.y.toFixed(1)}m)；${point.reason}`)
    },
    {
      key: "speakerPoints",
      title: "音箱点位与角度",
      summary: `${speakers.length} 只${speakers.some((point) => point.horizontalAngle !== undefined) ? "；含壁挂角度" : ""}${speakers.some((point) => point.speakerSignalMode) ? "；含AFC分组" : ""}`,
      details: speakers.map((point) =>
        `${point.label}：(${point.position.x.toFixed(1)}m, ${point.position.y.toFixed(1)}m)` +
        `${point.horizontalAngle === undefined ? "" : `；水平摆角${point.horizontalAngle}°`}` +
        `${point.speakerSignalMode === "withoutLineArrayAfc" ? "；不送线阵AFC" : point.speakerSignalMode === "afc" ? "；正常AFC扩声" : ""}` +
        `${point.label.includes("后墙中置") && point.afcSendLevelOffset !== undefined ? `；AFC初始${point.afcSendLevelOffset}dB；需延时校准` : ""}` +
        `；${point.reason}`
      )
    },
    {
      key: "wiring",
      title: "接线关系",
      summary: `${outputs.connectionLines.length} 条连接`,
      details: outputs.connectionLines.map((line) => `${line.fromDevice}[${line.fromPort}] → ${line.toDevice}[${line.toPort}]；${line.cableType}；${line.note}`)
    },
    {
      key: "topology",
      title: "系统拓扑图",
      summary: outputs.solutionSelection.drawingBlocked ? "当前选型阻断拓扑生成" : `按${outputs.connectionLines.length}条连接生成`,
      details: outputs.drawings.filter((drawing) => drawing.type === "topology" || drawing.type === "system").flatMap((drawing) => [drawing.title, ...drawing.notes])
    },
    {
      key: "installationGuide",
      title: "安装指导",
      summary: `${outputs.installationGuide.length} 个安装点说明`,
      details: outputs.installationGuide.map((item) => `${item.point}：${item.location}；${item.installHeight}；${item.orientation}`)
    },
    {
      key: "audioPlan",
      title: "音频方案说明",
      summary: outputs.audioPlan.mode,
      details: [outputs.audioPlan.summary, outputs.audioPlan.pickupGoal, outputs.audioPlan.amplificationGoal, outputs.audioPlan.areaBoundary, outputs.audioPlan.environmentBoundary, ...outputs.audioPlan.tuning]
        .filter((item) => !isReverberationText(item))
    },
    {
      key: "validation",
      title: "其他风险与统一校核",
      summary: `${nonReverbFindings.length} 条校核；${nonReverbRisks.length} 条风险 / 复勘信息`,
      details: [
        ...nonReverbFindings.map((item) => `${item.title}：${item.internalMessage}`),
        ...nonReverbRisks
      ]
    },
    {
      key: "report",
      title: "报告结构与内容",
      summary: `${outputs.pdfReportModel.sections.length} 个报告章节；${outputs.drawings.length} 张图纸模型`,
      details: [
        `项目：${profile.projectName || "未填写"}`,
        ...outputs.pdfReportModel.sections.map((section) => `${section.title}（${section.type}）`).filter((item) => !isReverberationText(item)),
        ...outputs.drawings.map((drawing) => `${drawing.title}（${drawing.type}）`)
      ]
    }
  ];
  return items.map((item) => ({
    ...item,
    details: item.details.filter((detail) => !isReverberationText(detail))
  }));
}

function isReverberationText(value: string) {
  return /混响|RT60|声学|拍手回声|拖尾/.test(value);
}
