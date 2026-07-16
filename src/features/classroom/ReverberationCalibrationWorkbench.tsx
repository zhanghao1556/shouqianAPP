import { useMemo, useState } from "react";
import { Check, Download, RefreshCw, Trash2, X } from "lucide-react";
import {
  ceilingAcousticTreatmentLabels,
  echoObservationLabels,
  floorMaterialLabels,
  furnishingDensityLabels,
  glassCoverageLabels,
  scenarioLabels,
  softTreatmentLabels,
  wallMaterialLabels
} from "./data/initialProfile";
import { getArrayMicCentralAirRequiredClearance, getArrayMicInstallHeight } from "./lib/drawingEngine";
import { normalizeProfile } from "./lib/profileNormalization";
import { createRandomProfile } from "./lib/randomProfile";
import { getAcousticAssessment } from "./lib/reverberationRules";
import type {
  AcousticAssessment,
  ClassroomProfile,
  Need,
  ReverberationRisk,
} from "./types";

const storageVersion = 1;
const calibrationStorageKey = `yinyi-reverberation-calibration-v${storageVersion}`;

type CalibrationVerdict = "pending" | "pass" | "fail";

interface ReverberationCalibrationRecord {
  id: string;
  caseName: string;
  createdAt: string;
  updatedAt: string;
  profile: ClassroomProfile;
  assessment: AcousticAssessment;
  expectedRisk: ReverberationRisk;
  verdict: Exclude<CalibrationVerdict, "pending">;
  note: string;
}

interface CalibrationStoragePayload {
  version: number;
  savedAt: string;
  records: ReverberationCalibrationRecord[];
}

const ceilingLabels: Record<ClassroomProfile["engineeringConstraints"]["ceiling"], string> = {
  suspended: "有吊顶",
  exposed: "无吊顶 / 裸顶",
  unknown: "待确认"
};

const calibrationNeedOptions: Array<{ value: Need; label: string }> = [
  { value: "localAmplification", label: "普通授课 / 本地扩声" },
  { value: "videoConference", label: "视频会议" },
  { value: "interactiveClass", label: "互动课堂" },
  { value: "recording", label: "录播" },
  { value: "remoteTeaching", label: "远程教学" }
];

export function ReverberationCalibrationWorkbench() {
  const [profile, setProfile] = useState<ClassroomProfile>(() => createAutomaticCalibrationProfile(1));
  const [caseName, setCaseName] = useState(() => profileCaseName(profile));
  const [note, setNote] = useState("");
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [records, setRecords] = useState<ReverberationCalibrationRecord[]>(() => loadCalibrationRecords());
  const [statusText, setStatusText] = useState("");
  const assessment = useMemo(() => getAcousticAssessment(profile), [profile]);
  const centralAirClearance = useMemo(() => getArrayMicCentralAirRequiredClearance(profile), [profile]);
  const arrayMicInstallHeight = useMemo(() => getArrayMicInstallHeight(profile), [profile]);
  const stats = useMemo(() => getRecordStats(records), [records]);

  const startCase = (nextProfile: ClassroomProfile, nextCaseName = profileCaseName(nextProfile)) => {
    setProfile(normalizeProfile(nextProfile));
    setCaseName(nextCaseName);
    setNote("");
    setActiveRecordId(null);
    setStatusText("");
  };

  const createRandomCase = () => {
    const randomProfile = createAutomaticCalibrationProfile(records.length + 1);
    startCase(randomProfile);
  };

  const updateRecords = (updater: (current: ReverberationCalibrationRecord[]) => ReverberationCalibrationRecord[]) => {
    setRecords((current) => {
      const next = updater(current);
      try {
        const payload: CalibrationStoragePayload = {
          version: storageVersion,
          savedAt: new Date().toISOString(),
          records: next
        };
        localStorage.setItem(calibrationStorageKey, JSON.stringify(payload));
      } catch {
        setStatusText("记录已更新，但浏览器本地存储失败，请立即导出 JSON。");
      }
      return next;
    });
  };

  const saveCurrentRecord = (verdict: Exclude<CalibrationVerdict, "pending">) => {
    const now = new Date().toISOString();
    const id = activeRecordId ?? createRecordId();
    const existing = records.find((item) => item.id === id);
    const record: ReverberationCalibrationRecord = {
      id,
      caseName: caseName.trim() || "未命名案例",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      profile: normalizeProfile(profile),
      assessment,
      expectedRisk: existing?.expectedRisk ?? assessment.risk,
      verdict,
      note: note.trim()
    };
    updateRecords((current) => (existing ? current.map((item) => (item.id === id ? record : item)) : [record, ...current]));
    const nextProfile = createAutomaticCalibrationProfile(records.length + (existing ? 1 : 2));
    startCase(nextProfile);
    setStatusText(existing ? "记录已更新，已生成下一例。" : "判断已记录，已生成下一例。");
  };

  const loadRecord = (record: ReverberationCalibrationRecord) => {
    setProfile(normalizeProfile(record.profile));
    setCaseName(record.caseName);
    setNote(record.note);
    setActiveRecordId(record.id);
    setStatusText("已载入记录；右侧显示当前算法重算结果。");
  };

  const deleteRecord = (id: string) => {
    updateRecords((current) => current.filter((item) => item.id !== id));
    if (activeRecordId === id) setActiveRecordId(null);
    setStatusText("记录已删除。");
  };

  const clearRecords = () => {
    if (!records.length || !window.confirm("确认清空全部混响校准记录？")) return;
    updateRecords(() => []);
    setActiveRecordId(null);
    setStatusText("全部校准记录已清空。");
  };

  const exportRecords = () => {
    const payload = {
      schema: "yinyi-reverberation-calibration",
      version: storageVersion,
      exportedAt: new Date().toISOString(),
      rule: {
        classification: "RT60 <= target: low; target < RT60 <= target + 0.2s: medium; above: high",
        overrides: ["obvious echo or flutter echo => high", "audible tail => at least medium", "low confidence => not low"]
      },
      records
    };
    downloadJson(payload, `混响校准记录-${new Date().toISOString().slice(0, 10)}.json`);
    setStatusText(records.length ? `已导出 ${records.length} 条校准记录。` : "已导出空记录文件。");
  };

  return (
    <main className="engineeringShell yiouShell">
      <header className="engineeringHeader yiouHeader calibrationHeader reverberationHeader">
        <div>
          <span className="sectionBadge">5176</span>
          <h1 className="workspaceTitle">混响校准测试台</h1>
          <p className="workspaceSubTitle">会议室与教室 RT60 风险判定</p>
        </div>
        <div className="outputActions">
          <button type="button" onClick={createRandomCase}><RefreshCw size={16} /> 换一组用例</button>
        </div>
      </header>

      <section className="engineeringGrid calibrationWorkbenchGrid reverberationWorkbenchGrid">
        <section className="workPanel reverbInputPanel">
          <div className="panelHeader">
            <div>
              <span className="sectionBadge">输入</span>
              <h2>房间与声学条件</h2>
              <p>{caseName}</p>
            </div>
          </div>

          <div className="reverbCaseFacts" aria-label="自动生成用例参数">
            {getCaseFacts(profile).map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="workPanel reverbResultPanel">
          <div className="panelHeader">
            <div>
              <span className={`sectionBadge reverbRiskBadge ${assessment.risk}`}>{riskText(assessment.risk)}</span>
              <h2>{assessment.label}</h2>
              <p>{assessment.source === "measured" ? "实测 RT60 判定" : "体积与等效吸声估算"} · {confidenceText(assessment.confidence)}</p>
            </div>
          </div>

          <div className="reverbImpactGrid reverbMetricGrid">
            <Metric label="判定 RT60" value={`${assessment.estimatedRt.toFixed(2)}s`} />
            <Metric label="场景目标" value={`${assessment.targetRt.toFixed(1)}s`} />
            <Metric label="大风险分界" value={`${assessment.highRiskRt.toFixed(1)}s`} />
            <Metric label="房间体积" value={`${assessment.roomVolume.toFixed(1)}m³`} />
            <Metric label="估算范围" value={assessment.source === "measured" ? "实测值" : `${assessment.estimatedRtRange.min.toFixed(2)}-${assessment.estimatedRtRange.max.toFixed(2)}s`} compact />
            <Metric label="可信度" value={confidenceText(assessment.confidence)} compact />
          </div>

          <div className="reverbReferenceLine">
            <span>目标依据</span>
            <strong>{assessment.reference}</strong>
          </div>

          <div className="reverbFactorList">
            <h3>影响因素</h3>
            {assessment.factors.map((factor) => (
              <div key={factor.label} className={`reverbFactor ${factor.impact}`}>
                <div>
                  <strong>{factor.label}</strong>
                  <span>{impactText(factor.impact)}</span>
                </div>
                <p>{factor.detail}</p>
              </div>
            ))}
          </div>

          <div className="reverbNotes">
            <h3>判定记录</h3>
            <ul>
              {assessment.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>

          <div className="reverbImpactGrid reverbLinkedGrid">
            <Metric label="中央空调避让" value={`${centralAirClearance.toFixed(1)}m`} />
            <Metric label="阵麦安装高度" value={`${arrayMicInstallHeight.toFixed(1)}m`} />
            <Metric label="背景噪声" value="单独评估" compact />
          </div>

          <div className="reverbNotes">
            <h3>建议</h3>
            <ul>
              {assessment.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
            </ul>
          </div>
        </section>

        <section className="workPanel reverbCalibrationPanel">
          <div className="panelHeader">
            <div>
              <span className="sectionBadge">校准</span>
              <h2>判断系统结论</h2>
              <p>核对自动用例与系统结论，判断是否正确。</p>
            </div>
            <div className="outputActions">
              <button type="button" onClick={exportRecords}><Download size={16} /> 导出 JSON</button>
              <button type="button" onClick={clearRecords}><Trash2 size={16} /> 清空记录</button>
            </div>
          </div>

          <div className="reverbCounterGrid">
            <Counter label="总记录" value={stats.total} />
            <Counter label="结论正确" value={stats.pass} tone="pass" />
            <Counter label="结论不正确" value={stats.fail} tone="fail" />
          </div>

          <div className="reverbCalibrationBody">
            <div className="reverbReviewEditor">
              <div className="reverbCurrentConclusion">
                <span>系统结论</span>
                <strong>{assessment.label}</strong>
                <small>{caseName}</small>
              </div>

              <label>
                判断备注
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="不正确时记录正确结论或原因；正确时可留空" />
              </label>

              <div className="reverbDecisionActions">
                <button type="button" className="mark pass" onClick={() => saveCurrentRecord("pass")}><Check size={18} /> 结论正确</button>
                <button type="button" className="mark fail" onClick={() => saveCurrentRecord("fail")}><X size={18} /> 结论不正确</button>
              </div>

              <div className="reverbEditorActions">
                <span role="status">{statusText}</span>
              </div>
            </div>

            <div className="tableBox reverbRecordTable">
              {records.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>案例</th>
                      <th>系统结论</th>
                      <th>人工判断</th>
                      <th>备注</th>
                      <th>更新时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id} className={activeRecordId === record.id ? "active" : ""}>
                        <td>{record.caseName}</td>
                        <td>{record.assessment.label}</td>
                        <td>{record.verdict === "pass" ? "正确" : "不正确"}</td>
                        <td>{record.note || "-"}</td>
                        <td>{formatDate(record.updatedAt)}</td>
                        <td>
                          <div className="reverbRecordActions">
                            <button type="button" className="miniButton" onClick={() => loadRecord(record)}>载入</button>
                            <button type="button" className="miniButton danger" onClick={() => deleteRecord(record.id)}>删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="emptyState">暂无混响校准记录。</div>
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? "compact" : ""}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Counter({ label, value, tone = "" }: { label: string; value: number; tone?: "" | "pass" | "fail" | "warn" }) {
  return (
    <div className={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getCalibrationNeed(profile: ClassroomProfile): Need {
  return calibrationNeedOptions.find((item) => profile.needs.includes(item.value))?.value ?? "localAmplification";
}

function getCaseFacts(profile: ClassroomProfile) {
  const environment = profile.acousticEnvironment;
  const need = calibrationNeedOptions.find((item) => item.value === getCalibrationNeed(profile))?.label ?? "其他";
  return [
    { label: "使用场景", value: scenarioLabels[profile.scenario] },
    { label: "主要语音用途", value: need },
    { label: "房间尺寸", value: `${profile.roomGeometry.length}m × ${profile.roomGeometry.width}m × ${profile.roomGeometry.height}m` },
    { label: "吊顶结构", value: ceilingLabels[profile.engineeringConstraints.ceiling] },
    { label: "顶面吸声", value: ceilingAcousticTreatmentLabels[environment.ceilingAcousticTreatment ?? "unknown"] },
    { label: "地面材质", value: floorMaterialLabels[environment.floorMaterial] },
    { label: "墙面情况", value: wallMaterialLabels[environment.wallMaterial] },
    { label: "软装 / 吸音", value: softTreatmentLabels[environment.softTreatment] },
    { label: "玻璃比例", value: glassCoverageLabels[environment.glassCoverage ?? "unknown"] },
    { label: "家具布置", value: furnishingDensityLabels[environment.furnishingDensity] },
    { label: "拍手测试", value: echoObservationLabels[environment.echoObservation ?? "unknown"] }
  ];
}

function profileCaseName(profile: ClassroomProfile) {
  return profile.projectName || "自动生成用例";
}

function createAutomaticCalibrationProfile(index: number) {
  const profile = createRandomProfile(index);
  const ceiling = confirmedValue(profile.engineeringConstraints.ceiling, ["suspended", "exposed"] as const);
  const overheadSpeakerMounting = confirmedValue(profile.engineeringConstraints.overheadSpeakerMounting, ["available", "unavailable"] as const);
  const auditoriumRearFillSpeakers = confirmedValue(profile.engineeringConstraints.auditoriumRearFillSpeakers, ["present", "absent"] as const);
  const floorMaterial = confirmedValue(profile.acousticEnvironment.floorMaterial, ["tile", "wood", "carpet"] as const);
  const wallMaterial = confirmedValue(profile.acousticEnvironment.wallMaterial, ["painted", "hard", "acoustic"] as const);
  const softTreatment = confirmedValue(profile.acousticEnvironment.softTreatment, ["none", "curtains", "acousticPanels", "mixed"] as const);
  const furnishingDensity = confirmedValue(profile.acousticEnvironment.furnishingDensity, ["empty", "normal", "dense"] as const);
  const ceilingAcousticTreatment = confirmedValue(profile.acousticEnvironment.ceilingAcousticTreatment, ["hard", "partial", "acoustic"] as const);
  const resolvedGlassCoverage = confirmedValue(profile.acousticEnvironment.glassCoverage, ["partial", "large"] as const);
  const glassCoverage = resolvedGlassCoverage === "none" ? "partial" : resolvedGlassCoverage;
  const echoObservation = confirmedValue(profile.acousticEnvironment.echoObservation, ["none", "tail", "obvious"] as const);
  return normalizeProfile({
    ...profile,
    engineeringConstraints: {
      ...profile.engineeringConstraints,
      ceiling,
      overheadSpeakerMounting,
      auditoriumRearFillSpeakers
    },
    acousticEnvironment: {
      ...profile.acousticEnvironment,
      floorMaterial,
      wallMaterial,
      softTreatment,
      furnishingDensity,
      ceilingAcousticTreatment,
      glassCoverage,
      echoObservation,
      hasGlassWall: glassCoverage === "large",
      measuredRt60: undefined
    }
  });
}

function confirmedValue<T extends string>(value: T | undefined, values: readonly Exclude<T, "unknown">[]): Exclude<T, "unknown"> {
  if (value !== undefined && value !== "unknown") return value as Exclude<T, "unknown">;
  return values[Math.floor(Math.random() * values.length)];
}

function getRecordStats(records: ReverberationCalibrationRecord[]) {
  return records.reduce(
    (stats, record) => ({
      total: stats.total + 1,
      pass: stats.pass + (record.verdict === "pass" ? 1 : 0),
      fail: stats.fail + (record.verdict === "fail" ? 1 : 0)
    }),
    { total: 0, pass: 0, fail: 0 }
  );
}

function loadCalibrationRecords(): ReverberationCalibrationRecord[] {
  try {
    const raw = localStorage.getItem(calibrationStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<CalibrationStoragePayload>;
    if (parsed.version !== storageVersion || !Array.isArray(parsed.records)) return [];
    return parsed.records
      .filter((record) => record?.profile && isReverberationRisk(record.expectedRisk) && (record.verdict === "pass" || record.verdict === "fail"))
      .map((record) => {
        const profile = normalizeProfile(record.profile);
        return {
          ...record,
          profile,
          assessment: record.assessment ?? getAcousticAssessment(profile)
        };
      });
  } catch {
    return [];
  }
}

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function createRecordId() {
  return globalThis.crypto?.randomUUID?.() ?? `reverb-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isReverberationRisk(value: unknown): value is ReverberationRisk {
  return value === "low" || value === "medium" || value === "high";
}

function riskText(risk: ReverberationRisk) {
  if (risk === "high") return "大";
  if (risk === "medium") return "中";
  return "小";
}

function confidenceText(confidence: AcousticAssessment["confidence"]) {
  if (confidence === "high") return "高可信";
  if (confidence === "medium") return "中可信";
  return "低可信";
}

function impactText(impact: AcousticAssessment["factors"][number]["impact"]) {
  if (impact === "strongIncrease") return "明显增加";
  if (impact === "slightIncrease") return "小幅增加";
  if (impact === "strongDecrease") return "明显降低";
  if (impact === "slightDecrease") return "小幅降低";
  return "中性";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}
