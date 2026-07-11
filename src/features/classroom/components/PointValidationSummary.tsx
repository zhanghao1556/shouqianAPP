import type { PointValidationFinding, PointValidationResult, PointValidationSeverity } from "../types";
import { getCustomerPointValidationStatus } from "../lib/pointValidation";

interface PointValidationSummaryProps {
  result: PointValidationResult;
  mode?: "compact" | "full";
  customerOnly?: boolean;
}

const severityLabels: Record<PointValidationSeverity, string> = {
  hard: "硬风险",
  error: "需修正",
  warning: "待复核",
  info: "已校核"
};

export function PointValidationSummary({
  result,
  mode = "compact",
  customerOnly = false
}: PointValidationSummaryProps) {
  if (customerOnly) {
    const customerStatus = getCustomerPointValidationStatus(result);
    if (!customerStatus) return null;
    return (
      <div className="pointValidationCustomerRisk" role="status">
        <strong>{customerStatus}</strong>
        <span>当前房间条件与系统能力需要进一步确认。</span>
      </div>
    );
  }

  if (mode === "full") return <FullValidationTable result={result} />;

  const priorityFindings = result.findings.filter((finding) => finding.severity !== "info");
  const visibleFindings = (priorityFindings.length ? priorityFindings : result.findings).slice(0, 3);
  return (
    <section className={`pointValidationSummary ${result.status}`} aria-label="点位校核摘要">
      <div className="pointValidationHeading">
        <div>
          <span>点位校核</span>
          <strong>{getStatusLabel(result)}</strong>
        </div>
        <div className="pointValidationCounts">
          <span>硬风险 {result.hardCount}</span>
          <span>需修正 {result.errorCount}</span>
          <span>待复核 {result.warningCount}</span>
        </div>
      </div>
      {visibleFindings.length > 0 && (
        <ul>
          {visibleFindings.map((finding) => (
            <li key={finding.code}>
              <b>{finding.title}</b>
              <span>{finding.internalMessage}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FullValidationTable({ result }: { result: PointValidationResult }) {
  return (
    <section className="pointValidationFull" aria-label="完整点位校核表">
      <div className="pointValidationHeading">
        <div>
          <span>统一校核结果</span>
          <strong>{getStatusLabel(result)}</strong>
        </div>
        <div className="pointValidationCounts">
          <span>硬风险 {result.hardCount}</span>
          <span>需修正 {result.errorCount}</span>
          <span>待复核 {result.warningCount}</span>
          <span>已校核 {result.infoCount}</span>
        </div>
      </div>
      <div className="pointValidationTableWrap">
        <table className="pointValidationTable">
          <thead>
            <tr>
              <th>状态</th>
              <th>规则</th>
              <th>实测 / 限制</th>
              <th>内部说明</th>
              <th>资料来源</th>
            </tr>
          </thead>
          <tbody>
            {result.findings.map((finding) => (
              <ValidationRow key={finding.code} finding={finding} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ValidationRow({ finding }: { finding: PointValidationFinding }) {
  const measurement = [finding.actual !== undefined ? `实测 ${finding.actual}` : "", finding.limit !== undefined ? `限制 ${finding.limit}` : ""]
    .filter(Boolean)
    .join(" / ");
  return (
    <tr>
      <td>
        <span className={`pointValidationBadge ${finding.severity}`}>{severityLabels[finding.severity]}</span>
      </td>
      <td>
        <strong>{finding.title}</strong>
        <small>{finding.code}</small>
      </td>
      <td>{measurement || "-"}</td>
      <td>{finding.internalMessage}</td>
      <td>{finding.sourceRefs.join("；") || "-"}</td>
    </tr>
  );
}

function getStatusLabel(result: PointValidationResult) {
  if (result.status === "hard") return "需专项复核";
  if (result.status === "review") return "存在待校核项";
  return "通过";
}
