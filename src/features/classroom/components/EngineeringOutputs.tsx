import { Download } from "lucide-react";
import type { ClassroomProfile, DrawingType, GeneratedOutputs, LegacySpeakerType, LegacyWallAdjustability, Point, ProductRecommendation, QuantityOverrides } from "../types";
import { downloadSvgAsPng } from "../lib/imageExporter";
import { DrawingCanvas } from "./DrawingCanvas";

interface EngineeringOutputsProps {
  profile: ClassroomProfile;
  outputs: GeneratedOutputs;
  quantityOverrides: QuantityOverrides;
  onQuantityOverride: React.Dispatch<React.SetStateAction<QuantityOverrides>>;
  onCentralAirConditionerPointChange?: (position: Point, index: number) => void;
  onCentralAirConditionerCountChange?: (count: number) => void;
  onLegacySpeakerPointAdd?: (input: { position: Point; type: LegacySpeakerType; wallAdjustability: LegacyWallAdjustability }) => void;
  onLegacySpeakerPointRemoveLast?: () => void;
  onLegacySpeakerPointTargetChange?: (index: number, target: Point) => void;
}

export function EngineeringOutputs({
  profile,
  outputs,
  quantityOverrides,
  onQuantityOverride,
  onCentralAirConditionerPointChange,
  onCentralAirConditionerCountChange,
  onLegacySpeakerPointAdd,
  onLegacySpeakerPointRemoveLast,
  onLegacySpeakerPointTargetChange
}: EngineeringOutputsProps) {
  const exportDrawingImage = (type: "installation" | "topology") => {
      const selector =
        type === "installation"
          ? 'svg[aria-label="音翼阵列麦与音箱点位图"], svg[aria-label="音翼阵列麦点位图"]'
          : 'svg[aria-label="音翼系统拓扑图"]';
    const svg = document.querySelector<SVGSVGElement>(selector);
    if (!svg) {
      window.alert("当前图纸还没有生成，暂时无法导出图片。");
      return;
    }
    void downloadSvgAsPng(svg, `${profile.projectName || "音翼方案"}-${drawingLabel(type)}`);
  };

  return (
    <section className="workPanel outputWorkPanel">
      <div className="panelHeader">
        <div>
          <span className="panelStep">03</span>
          <h2>方案输出</h2>
          <p>{outputs.isFinalReady ? "已生成设备清单、点位图和拓扑图。" : "补齐关键信息后生成方案输出。"}</p>
        </div>
      </div>

      <div className="stackedOutputs">
        <OutputSection title="设备清单">
        <div className="tableBox">
          {outputs.productSelection.length ? (
            <table>
              <thead>
                <tr>
                  <th>序号</th>
                  <th>设备</th>
                  <th>数量</th>
                </tr>
              </thead>
              <tbody>
                {outputs.productSelection.map((item, index) => (
                  <tr key={item.productId}>
                    <td>{index + 1}</td>
                    <td>{item.name}</td>
                    <td>
                      <QuantityStepper
                        item={item}
                        isOverridden={quantityOverrides[item.productId] !== undefined}
                        onChange={(quantity) => onQuantityOverride((current) => ({ ...current, [item.productId]: quantity }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState text="缺少房间长宽高，暂无法计算数量和清单。" />
          )}
        </div>
        </OutputSection>

        <OutputSection title="点位图">
          <DrawingBlock
            title="点位图"
            profile={profile}
            outputs={outputs}
            type="installation"
            onCentralAirConditionerPointChange={onCentralAirConditionerPointChange}
            onCentralAirConditionerCountChange={onCentralAirConditionerCountChange}
            onLegacySpeakerPointAdd={onLegacySpeakerPointAdd}
            onLegacySpeakerPointRemoveLast={onLegacySpeakerPointRemoveLast}
            onLegacySpeakerPointTargetChange={onLegacySpeakerPointTargetChange}
            onExport={() => exportDrawingImage("installation")}
          />
        </OutputSection>

        <OutputSection title="系统拓扑图">
          <DrawingBlock title="系统拓扑图" profile={profile} outputs={outputs} type="topology" onExport={() => exportDrawingImage("topology")} />
        </OutputSection>
      </div>
    </section>
  );
}

function DrawingBlock({
  title,
  profile,
  outputs,
  type,
  onCentralAirConditionerPointChange,
  onCentralAirConditionerCountChange,
  onLegacySpeakerPointAdd,
  onLegacySpeakerPointRemoveLast,
  onLegacySpeakerPointTargetChange,
  onExport
}: {
  title: string;
  profile: ClassroomProfile;
  outputs: GeneratedOutputs;
  type: DrawingType;
  onExport?: () => void;
  onCentralAirConditionerPointChange?: (position: Point, index: number) => void;
  onCentralAirConditionerCountChange?: (count: number) => void;
  onLegacySpeakerPointAdd?: (input: { position: Point; type: LegacySpeakerType; wallAdjustability: LegacyWallAdjustability }) => void;
  onLegacySpeakerPointRemoveLast?: () => void;
  onLegacySpeakerPointTargetChange?: (index: number, target: Point) => void;
}) {
  return (
    <div className="drawingBlock">
      <div className="drawingBlockHeader">
        <h4>{title}</h4>
        {onExport && (
          <button className="drawingExportButton" type="button" onClick={onExport}>
            <Download size={16} /> 导出{title}
          </button>
        )}
      </div>
      <DrawingCanvas
        profile={profile}
        generatedPoints={outputs.generatedPoints}
        connectionLines={outputs.connectionLines}
        activeDrawing={type}
        onCentralAirConditionerPointChange={type === "installation" ? onCentralAirConditionerPointChange : undefined}
        onCentralAirConditionerCountChange={type === "installation" ? onCentralAirConditionerCountChange : undefined}
        onLegacySpeakerPointAdd={type === "installation" ? onLegacySpeakerPointAdd : undefined}
        onLegacySpeakerPointRemoveLast={type === "installation" ? onLegacySpeakerPointRemoveLast : undefined}
        onLegacySpeakerPointTargetChange={type === "installation" ? onLegacySpeakerPointTargetChange : undefined}
      />
      {type === "system" && (
        <div className="connectionList">
          {outputs.connectionLines.map((line) => (
            <p key={line.id}>
              {line.fromDevice} [{line.fromPort}] → {line.toDevice} [{line.toPort}]：{line.cableType}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function OutputSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="outputSection">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="emptyState">{text}</div>;
}

function QuantityStepper({
  item,
  isOverridden,
  onChange
}: {
  item: ProductRecommendation;
  isOverridden: boolean;
  onChange: (quantity: number) => void;
}) {
  const min = 0;
  const max = item.category === "speaker" ? 16 : item.category === "pickup" ? 5 : item.category === "amplifier" ? 1 : 4;
  const decrement = () => onChange(Math.max(min, item.quantity - 1));
  const increment = () => onChange(Math.min(max, item.quantity + 1));

  return (
    <div className="quantityStepper">
      <button type="button" onClick={decrement} disabled={item.quantity <= min} aria-label={`${item.name} 减少数量`}>
        -
      </button>
      <strong>{item.quantity}</strong>
      <button type="button" onClick={increment} disabled={item.quantity >= max} aria-label={`${item.name} 增加数量`}>
        +
      </button>
      {isOverridden && <span>手动</span>}
    </div>
  );
}

function drawingLabel(type: DrawingType) {
  if (type === "topology") return "系统拓扑图";
  return "点位图";
}

