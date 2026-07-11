import { useMemo, useState } from "react";
import {
  ceilingAcousticTreatmentLabels,
  createInitialProfile,
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
  CeilingAcousticTreatment,
  CeilingType,
  ClassroomProfile,
  EchoObservation,
  FloorMaterial,
  FurnishingDensity,
  GlassCoverage,
  Need,
  ReverberationRisk,
  Scenario,
  SoftTreatment,
  WallMaterial
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

interface StandardCalibrationCase {
  id: string;
  label: string;
  expectedRisk: ReverberationRisk;
  profile: ClassroomProfile;
}

const ceilingLabels: Record<CeilingType, string> = {
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

const standardCases: StandardCalibrationCase[] = [
  {
    id: "estimated-low",
    label: "估算小",
    expectedRisk: "low",
    profile: createStandardProfile({
      projectName: "标准案例-估算小",
      scenario: "standardClassroom",
      needs: ["localAmplification"],
      room: { length: 8, width: 6, height: 3 },
      ceiling: "suspended",
      acoustic: {
        floorMaterial: "carpet",
        wallMaterial: "acoustic",
        softTreatment: "acousticPanels",
        furnishingDensity: "normal",
        ceilingAcousticTreatment: "acoustic",
        glassCoverage: "none",
        echoObservation: "none"
      }
    })
  },
  {
    id: "measured-medium",
    label: "实测中",
    expectedRisk: "medium",
    profile: createStandardProfile({
      projectName: "标准案例-实测中",
      scenario: "meetingRoom",
      needs: ["videoConference"],
      room: { length: 8, width: 5.8, height: 3 },
      ceiling: "suspended",
      acoustic: {
        floorMaterial: "tile",
        wallMaterial: "hard",
        softTreatment: "none",
        furnishingDensity: "normal",
        ceilingAcousticTreatment: "hard",
        glassCoverage: "large",
        echoObservation: "none",
        measuredRt60: 0.7
      }
    })
  },
  {
    id: "estimated-high",
    label: "估算大",
    expectedRisk: "high",
    profile: createStandardProfile({
      projectName: "标准案例-估算大",
      scenario: "standardClassroom",
      needs: ["interactiveClass"],
      room: { length: 10, width: 8, height: 3.8 },
      ceiling: "exposed",
      acoustic: {
        floorMaterial: "tile",
        wallMaterial: "hard",
        softTreatment: "none",
        furnishingDensity: "empty",
        ceilingAcousticTreatment: "hard",
        glassCoverage: "large",
        echoObservation: "none"
      }
    })
  },
  {
    id: "audible-tail",
    label: "拖尾保底中",
    expectedRisk: "medium",
    profile: createStandardProfile({
      projectName: "标准案例-拖尾保底中",
      scenario: "standardClassroom",
      needs: ["localAmplification"],
      room: { length: 8, width: 6, height: 3 },
      ceiling: "suspended",
      acoustic: {
        floorMaterial: "carpet",
        wallMaterial: "acoustic",
        softTreatment: "acousticPanels",
        furnishingDensity: "normal",
        ceilingAcousticTreatment: "acoustic",
        glassCoverage: "none",
        echoObservation: "tail"
      }
    })
  },
  {
    id: "obvious-echo",
    label: "回声强制大",
    expectedRisk: "high",
    profile: createStandardProfile({
      projectName: "标准案例-回声强制大",
      scenario: "meetingRoom",
      needs: ["videoConference"],
      room: { length: 7, width: 5, height: 2.9 },
      ceiling: "suspended",
      acoustic: {
        floorMaterial: "carpet",
        wallMaterial: "acoustic",
        softTreatment: "mixed",
        furnishingDensity: "normal",
        ceilingAcousticTreatment: "acoustic",
        glassCoverage: "partial",
        echoObservation: "obvious",
        measuredRt60: 0.5
      }
    })
  },
  {
    id: "incomplete",
    label: "信息缺失不判小",
    expectedRisk: "medium",
    profile: createStandardProfile({
      projectName: "标准案例-信息缺失",
      scenario: "standardClassroom",
      needs: ["localAmplification"],
      room: { length: 8, width: 6, height: 3 },
      ceiling: "unknown",
      acoustic: {
        floorMaterial: "unknown",
        wallMaterial: "unknown",
        softTreatment: "unknown",
        furnishingDensity: "unknown",
        ceilingAcousticTreatment: "unknown",
        glassCoverage: "unknown",
        echoObservation: "unknown"
      }
    })
  }
];

export function ReverberationCalibrationWorkbench() {
  const [profile, setProfile] = useState<ClassroomProfile>(() => normalizeProfile(createInitialProfile()));
  const [caseName, setCaseName] = useState("手动案例");
  const [expectedRisk, setExpectedRisk] = useState<ReverberationRisk | "">("");
  const [verdict, setVerdict] = useState<CalibrationVerdict>("pending");
  const [note, setNote] = useState("");
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [records, setRecords] = useState<ReverberationCalibrationRecord[]>(() => loadCalibrationRecords());
  const [statusText, setStatusText] = useState("");
  const assessment = useMemo(() => getAcousticAssessment(profile), [profile]);
  const centralAirClearance = useMemo(() => getArrayMicCentralAirRequiredClearance(profile), [profile]);
  const arrayMicInstallHeight = useMemo(() => getArrayMicInstallHeight(profile), [profile]);
  const currentMatch = expectedRisk ? assessment.risk === expectedRisk : null;
  const stats = useMemo(() => getRecordStats(records), [records]);

  const updateProfile = (patch: Partial<ClassroomProfile>) => {
    setProfile((current) => normalizeProfile({ ...current, ...patch }));
  };

  const updateRoom = (patch: Partial<ClassroomProfile["roomGeometry"]>) => {
    setProfile((current) => normalizeProfile({ ...current, roomGeometry: { ...current.roomGeometry, ...patch } }));
  };

  const updateConstraints = (patch: Partial<ClassroomProfile["engineeringConstraints"]>) => {
    setProfile((current) =>
      normalizeProfile({ ...current, engineeringConstraints: { ...current.engineeringConstraints, ...patch } })
    );
  };

  const updateAcoustic = (patch: Partial<ClassroomProfile["acousticEnvironment"]>) => {
    setProfile((current) =>
      normalizeProfile({ ...current, acousticEnvironment: { ...current.acousticEnvironment, ...patch } })
    );
  };

  const startCase = (nextProfile: ClassroomProfile, nextCaseName: string, nextExpected: ReverberationRisk | "" = "") => {
    setProfile(normalizeProfile(nextProfile));
    setCaseName(nextCaseName);
    setExpectedRisk(nextExpected);
    setVerdict("pending");
    setNote("");
    setActiveRecordId(null);
    setStatusText("");
  };

  const applyStandardCase = (item: StandardCalibrationCase) => {
    startCase(item.profile, item.label, item.expectedRisk);
  };

  const createRandomCase = () => {
    const randomProfile = normalizeProfile(createRandomProfile(records.length + 1));
    startCase(randomProfile, randomProfile.projectName || "随机案例");
  };

  const createManualCase = () => {
    startCase(normalizeProfile(createInitialProfile()), "手动案例");
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

  const saveCurrentRecord = () => {
    if (!expectedRisk) {
      setStatusText("请选择人工期望等级后再保存。");
      return;
    }
    if (verdict === "pending") {
      setStatusText("请选择通过或不通过后再保存。");
      return;
    }

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
      expectedRisk,
      verdict,
      note: note.trim()
    };
    updateRecords((current) => (existing ? current.map((item) => (item.id === id ? record : item)) : [record, ...current]));
    setActiveRecordId(id);
    setStatusText(existing ? "当前校准记录已更新。" : "当前校准记录已保存。");
  };

  const loadRecord = (record: ReverberationCalibrationRecord) => {
    setProfile(normalizeProfile(record.profile));
    setCaseName(record.caseName);
    setExpectedRisk(record.expectedRisk);
    setVerdict(record.verdict);
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
          <button type="button" onClick={createRandomCase}>随机案例</button>
          <button type="button" onClick={createManualCase}>新建手动案例</button>
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

          <div className="reverbPresetRow" aria-label="标准校准案例">
            {standardCases.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`deviceOption ${caseName === item.label ? "active" : ""}`}
                onClick={() => applyStandardCase(item)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="reverbFormGrid">
            <label>
              使用场景
              <select value={profile.scenario} onChange={(event) => updateProfile({ scenario: event.target.value as Scenario })}>
                {Object.entries(scenarioLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              主要语音用途
              <select
                value={getCalibrationNeed(profile)}
                onChange={(event) => updateProfile({ needs: [event.target.value as Need] })}
              >
                {calibrationNeedOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>
              吊顶结构
              <select
                value={profile.engineeringConstraints.ceiling}
                onChange={(event) => updateConstraints({ ceiling: event.target.value as CeilingType })}
              >
                {Object.entries(ceilingLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              顶面吸声
              <select
                value={profile.acousticEnvironment.ceilingAcousticTreatment ?? "unknown"}
                onChange={(event) => updateAcoustic({ ceilingAcousticTreatment: event.target.value as CeilingAcousticTreatment })}
              >
                {Object.entries(ceilingAcousticTreatmentLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              房间长度 m
              <input type="number" min="1" step="0.1" value={profile.roomGeometry.length} onChange={(event) => updateRoom({ length: Number(event.target.value) })} />
            </label>
            <label>
              房间宽度 m
              <input type="number" min="1" step="0.1" value={profile.roomGeometry.width} onChange={(event) => updateRoom({ width: Number(event.target.value) })} />
            </label>
            <label>
              房间高度 m
              <input type="number" min="2" step="0.1" value={profile.roomGeometry.height} onChange={(event) => updateRoom({ height: Number(event.target.value) })} />
            </label>
            <label>
              地面材质
              <select value={profile.acousticEnvironment.floorMaterial} onChange={(event) => updateAcoustic({ floorMaterial: event.target.value as FloorMaterial })}>
                {Object.entries(floorMaterialLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              墙面情况
              <select value={profile.acousticEnvironment.wallMaterial} onChange={(event) => updateAcoustic({ wallMaterial: event.target.value as WallMaterial })}>
                {Object.entries(wallMaterialLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              软装 / 吸音
              <select value={profile.acousticEnvironment.softTreatment} onChange={(event) => updateAcoustic({ softTreatment: event.target.value as SoftTreatment })}>
                {Object.entries(softTreatmentLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              玻璃比例
              <select
                value={profile.acousticEnvironment.glassCoverage ?? "unknown"}
                onChange={(event) => {
                  const glassCoverage = event.target.value as GlassCoverage;
                  updateAcoustic({ glassCoverage, hasGlassWall: glassCoverage === "large" });
                }}
              >
                {Object.entries(glassCoverageLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              家具布置
              <select value={profile.acousticEnvironment.furnishingDensity} onChange={(event) => updateAcoustic({ furnishingDensity: event.target.value as FurnishingDensity })}>
                {Object.entries(furnishingDensityLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              拍手测试
              <select
                value={profile.acousticEnvironment.echoObservation ?? "unknown"}
                onChange={(event) => updateAcoustic({ echoObservation: event.target.value as EchoObservation })}
              >
                {Object.entries(echoObservationLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              实测中频 RT60 s
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.01"
                placeholder="未测量"
                value={profile.acousticEnvironment.measuredRt60 ?? ""}
                onChange={(event) => updateAcoustic({ measuredRt60: event.target.value ? Number(event.target.value) : undefined })}
              />
            </label>
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
              <h2>人工复判与记录</h2>
              <p>{currentMatch === null ? "等待人工期望" : currentMatch ? "算法与人工期望一致" : "算法与人工期望不一致"}</p>
            </div>
            <div className="outputActions">
              <button type="button" onClick={exportRecords}>导出 JSON</button>
              <button type="button" onClick={clearRecords}>清空记录</button>
            </div>
          </div>

          <div className="reverbCounterGrid">
            <Counter label="总记录" value={stats.total} />
            <Counter label="通过" value={stats.pass} tone="pass" />
            <Counter label="不通过" value={stats.fail} tone="fail" />
            <Counter label="等级不一致" value={stats.mismatch} tone="warn" />
          </div>

          <div className="reverbCalibrationBody">
            <div className="reverbReviewEditor">
              <label>
                案例名称
                <input value={caseName} onChange={(event) => setCaseName(event.target.value)} />
              </label>

              <fieldset>
                <legend>人工期望等级</legend>
                <div className="reverbChoiceRow">
                  {(["low", "medium", "high"] as const).map((risk) => (
                    <button
                      key={risk}
                      type="button"
                      className={`deviceOption ${expectedRisk === risk ? "active" : ""}`}
                      aria-pressed={expectedRisk === risk}
                      onClick={() => setExpectedRisk(risk)}
                    >
                      {riskText(risk)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend>校准结论</legend>
                <div className="reverbChoiceRow verdict">
                  <button type="button" className={`mark pass ${verdict === "pass" ? "active" : ""}`} aria-pressed={verdict === "pass"} onClick={() => setVerdict("pass")}>通过</button>
                  <button type="button" className={`mark fail ${verdict === "fail" ? "active" : ""}`} aria-pressed={verdict === "fail"} onClick={() => setVerdict("fail")}>不通过</button>
                </div>
              </fieldset>

              <label>
                校准备注
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="记录现场判断、差异和后续规则建议" />
              </label>

              <div className={`reverbMatchNotice ${currentMatch === false ? "mismatch" : currentMatch ? "match" : "pending"}`}>
                <span>算法：{riskText(assessment.risk)}</span>
                <span>人工：{expectedRisk ? riskText(expectedRisk) : "未选"}</span>
                <strong>{currentMatch === null ? "待复判" : currentMatch ? "一致" : "不一致"}</strong>
              </div>

              <div className="reverbEditorActions">
                <button type="button" className="primaryAction" onClick={saveCurrentRecord}>{activeRecordId ? "更新记录" : "保存记录"}</button>
                <span role="status">{statusText}</span>
              </div>
            </div>

            <div className="tableBox reverbRecordTable">
              {records.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>案例</th>
                      <th>算法</th>
                      <th>人工</th>
                      <th>差异</th>
                      <th>结论</th>
                      <th>更新时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id} className={activeRecordId === record.id ? "active" : ""}>
                        <td>{record.caseName}</td>
                        <td>{riskText(record.assessment.risk)}</td>
                        <td>{riskText(record.expectedRisk)}</td>
                        <td>{record.assessment.risk === record.expectedRisk ? "一致" : "不一致"}</td>
                        <td>{record.verdict === "pass" ? "通过" : "不通过"}</td>
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

function createStandardProfile(input: {
  projectName: string;
  scenario: Scenario;
  needs: Need[];
  room: Pick<ClassroomProfile["roomGeometry"], "length" | "width" | "height">;
  ceiling: CeilingType;
  acoustic: Omit<ClassroomProfile["acousticEnvironment"], "hasGlassWall">;
}) {
  const base = createInitialProfile();
  const glassCoverage = input.acoustic.glassCoverage ?? "unknown";
  return normalizeProfile({
    ...base,
    projectName: input.projectName,
    scenario: input.scenario,
    needs: input.needs,
    customNeed: "",
    roomGeometry: { ...base.roomGeometry, ...input.room },
    engineeringConstraints: { ...base.engineeringConstraints, ceiling: input.ceiling },
    acousticEnvironment: {
      ...base.acousticEnvironment,
      ...input.acoustic,
      hasGlassWall: glassCoverage === "large"
    }
  });
}

function getCalibrationNeed(profile: ClassroomProfile): Need {
  return calibrationNeedOptions.find((item) => profile.needs.includes(item.value))?.value ?? "localAmplification";
}

function getRecordStats(records: ReverberationCalibrationRecord[]) {
  return records.reduce(
    (stats, record) => ({
      total: stats.total + 1,
      pass: stats.pass + (record.verdict === "pass" ? 1 : 0),
      fail: stats.fail + (record.verdict === "fail" ? 1 : 0),
      mismatch: stats.mismatch + (record.assessment.risk !== record.expectedRisk ? 1 : 0)
    }),
    { total: 0, pass: 0, fail: 0, mismatch: 0 }
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
  if (impact === "increase") return "增加风险";
  if (impact === "decrease") return "降低风险";
  return "中性 / 待确认";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}
