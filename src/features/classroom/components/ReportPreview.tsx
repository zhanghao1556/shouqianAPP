import type { GeneratedOutputs } from "../types";

export function ReportPreview({ outputs }: { outputs: GeneratedOutputs }) {
  return (
    <div className="reportPages">
      {outputs.pdfReportModel.sections.map((section) => (
        <article className={section.type === "cover" ? "reportPage coverPage" : "reportPage"} key={section.id}>
          <h3>{section.title}</h3>
          {section.body && <p>{section.body}</p>}
          {section.bullets && (
            <ul>
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.rows && (
            <table>
              <tbody>
                {section.rows.map((row, index) => (
                  <tr key={index}>
                    {Object.entries(row).map(([key, value]) => (
                      <td key={key}>
                        <strong>{key}</strong>
                        <span>{value}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {section.drawingType && <div className="reportDrawingPlaceholder">{section.title} 可在页面预览，并导出 PNG 图片。</div>}
        </article>
      ))}
    </div>
  );
}
