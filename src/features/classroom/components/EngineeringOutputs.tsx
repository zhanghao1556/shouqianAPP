import { Download } from "lucide-react";
import { RotateCcw } from "lucide-react";
import type { ClassroomProfile, DrawingType, GeneratedOutputs, LegacySpeakerType, LegacyWallAdjustability, Point, ProcessorTier, ProductRecommendation, QuantityOverrides } from "../types";
import { downloadSvgAsPng } from "../lib/imageExporter";
import { getCustomerVisibleConnectionLines } from "../lib/customerOutput";
import { getProcessorTierName, getProcessorTiersForSelection, LINE_ARRAY_PRODUCT_ID } from "../lib/lineArrayRules";
import { AUDIO_PROCESSOR_HOST_PRODUCT_ID, LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID } from "../lib/systemCapabilities";
import {
  SMALL_DISC_01_PRODUCT_ID,
  SMALL_DISC_02_PRODUCT_ID,
  SMALL_DISC_03_PRODUCT_ID,
  SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID,
  SMALL_DISC_MAX_GENERATED_COUNT,
  SMALL_DISC_USB_CABLE_PRODUCT_ID
} from "../lib/yinmanSmallDiscRules";
import { formatBrandText, getAppBrand } from "../brand";
import { CustomerSolutionSelector, type SolutionChangeKind } from "./CustomerSolutionSelector";
import { DrawingCanvas } from "./DrawingCanvas";
import { PointValidationSummary } from "./PointValidationSummary";

interface EngineeringOutputsProps {
  profile: ClassroomProfile;
  outputs: GeneratedOutputs;
  quantityOverrides: QuantityOverrides;
  onQuantityOverride: React.Dispatch<React.SetStateAction<QuantityOverrides>>;
  onSolutionChange: (profile: ClassroomProfile, kind: SolutionChangeKind) => void;
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
  onSolutionChange,
  onCentralAirConditionerPointChange,
  onCentralAirConditionerCountChange,
  onLegacySpeakerPointAdd,
  onLegacySpeakerPointRemoveLast,
  onLegacySpeakerPointTargetChange
}: EngineeringOutputsProps) {
  const brand = getAppBrand();
  const interfaceWiringEnabled = brand.id === "yinman"
    ? __ENABLE_YINMAN_INTERFACE_WIRING__
    : __ENABLE_YINYI_INTERFACE_WIRING__;
  const readyOutputSummary = interfaceWiringEnabled
    ? "已生成设备清单、点位图、拓扑图、接口接线图和接口占用表。"
    : "已生成设备清单、点位图和拓扑图。";
  const selectedSpeakerProductId = outputs.solutionSelection.speaker.selected === "ceiling" ? "CEILING-SPEAKER" : "COLUMN-SPEAKER";
  const equipmentRows = getEquipmentRows(outputs.productSelection, brand.id, selectedSpeakerProductId, outputs.solutionSelection.microphone.selected);
  const hasManualEquipmentRecommendation = Object.keys(quantityOverrides).length > 0 ||
    (profile.engineeringConstraints.processorTier ?? "auto") !== "auto";
  const restoreAutomaticEquipmentRecommendation = () => {
    onQuantityOverride({});
    if ((profile.engineeringConstraints.processorTier ?? "auto") === "auto") return;
    onSolutionChange({
      ...profile,
      engineeringConstraints: { ...profile.engineeringConstraints, processorTier: "auto" }
    }, "processor");
  };
  const exportDrawingImage = (type: "installation" | "topology") => {
      const selector =
        type === "installation"
          ? `svg[aria-label="${brand.id === "yinman" ? "音曼" : "音翼"}阵列麦与音箱点位图"], svg[aria-label="${brand.id === "yinman" ? "音曼" : "音翼"}阵列麦点位图"], svg[aria-label="${brand.id === "yinman" ? "音曼" : "音翼"}线阵麦与音箱点位图"], svg[aria-label="${brand.id === "yinman" ? "音曼" : "音翼"}线阵麦点位图"], svg[aria-label="${brand.id === "yinman" ? "音曼" : "音翼"}吊麦与音箱点位图"], svg[aria-label="${brand.id === "yinman" ? "音曼" : "音翼"}吊麦点位图"], svg[aria-label="${brand.id === "yinman" ? "音曼" : "音翼"}小圆盘阵麦与音箱点位图"], svg[aria-label="${brand.id === "yinman" ? "音曼" : "音翼"}小圆盘阵麦点位图"]`
          : `svg[aria-label="${brand.id === "yinman" ? "音曼" : "音翼"}系统拓扑图"]`;
    const svg = document.querySelector<SVGSVGElement>(selector);
    if (!svg) {
      window.alert("当前图纸还没有生成，暂时无法导出图片。");
      return;
    }
    void downloadSvgAsPng(svg, `${profile.projectName || `${brand.id === "yinman" ? "音曼" : "音翼"}方案`}-${drawingLabel(type)}`);
  };

  return (
    <section className="workPanel outputWorkPanel">
      <div className="panelHeader">
        <div>
          <span className="panelStep">03</span>
          <h2>方案输出</h2>
          <p>{outputs.solutionSelection.drawingBlocked ? "已保留客户选型，点位图与拓扑待改选后生成。" : outputs.isFinalReady ? readyOutputSummary : "补齐关键信息后生成方案输出。"}</p>
        </div>
      </div>

      <PointValidationSummary
        result={outputs.pointValidation}
        customerOnly={Boolean(window.__YIOU_RELEASE_BUILD__)}
      />

      <CustomerSolutionSelector profile={profile} selection={outputs.solutionSelection} onChange={onSolutionChange} />

      <div className="stackedOutputs">
        <OutputSection
          title="设备清单"
          action={(
            <button
              type="button"
              className="equipmentRecommendationResetButton"
              onClick={restoreAutomaticEquipmentRecommendation}
              disabled={!hasManualEquipmentRecommendation}
              title="清除设备数量和处理器手动选择"
            >
              <RotateCcw size={15} /> 恢复自动推荐
            </button>
          )}
        >
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
                {equipmentRows.map(({ item, processorTier, lockedAutomatic }, index) => (
                  <tr key={item.productId}>
                    <td>{index + 1}</td>
                    <td>{formatBrandText(item.name)}</td>
                    <td>
                      <QuantityStepper
                        item={item}
                        lockedAutomatic={lockedAutomatic}
                        isOverridden={processorTier
                          ? item.quantity === 1 && (profile.engineeringConstraints.processorTier ?? "auto") !== "auto"
                          : quantityOverrides[item.productId] !== undefined}
                        onChange={(quantity) => {
                          if (processorTier) {
                            if (quantity > 0 && item.quantity === 0) {
                              onSolutionChange({
                                ...profile,
                                engineeringConstraints: { ...profile.engineeringConstraints, processorTier }
                              }, "processor");
                            }
                            return;
                          }
                          onQuantityOverride((current) => ({ ...current, [item.productId]: quantity }));
                        }}
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
            blockedMessage={outputs.solutionSelection.blockingMessage}
            onExport={() => exportDrawingImage("installation")}
          />
        </OutputSection>

        <OutputSection title="系统拓扑图">
          <DrawingBlock
            title="系统拓扑图"
            profile={profile}
            outputs={outputs}
            type="topology"
            blockedMessage={outputs.solutionSelection.blockingMessage}
            onExport={() => exportDrawingImage("topology")}
          />
        </OutputSection>
      </div>
    </section>
  );
}

function getEquipmentRows(
  selection: ProductRecommendation[],
  brandId: "yinyi" | "yinman",
  selectedSpeakerProductId: "CEILING-SPEAKER" | "COLUMN-SPEAKER",
  selectedMicrophone: GeneratedOutputs["solutionSelection"]["microphone"]["selected"]
): Array<{ item: ProductRecommendation; processorTier?: Exclude<ProcessorTier, "auto">; lockedAutomatic?: boolean }> {
  const usesHybridLineArray = selection.some((item) => item.productId === LINE_ARRAY_PRODUCT_ID && item.quantity > 0) &&
    selection.some((item) => item.productId === SMALL_DISC_02_PRODUCT_ID && item.quantity > 0);
  return selection.flatMap((item) => {
    if (item.category === "speaker" && item.productId !== selectedSpeakerProductId) return [];
    if (item.productId !== AUDIO_PROCESSOR_HOST_PRODUCT_ID) return [{
      item,
      lockedAutomatic: item.productId === LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID || (usesHybridLineArray && item.productId === SMALL_DISC_02_PRODUCT_ID)
    }];
    const hardLockedLargeArray = brandId === "yinman" && selectedMicrophone === "existingArray";
    const processorTiers = getProcessorTiersForSelection(brandId, selectedMicrophone, usesHybridLineArray);
    return processorTiers.map((processorTier) => ({
      processorTier: hardLockedLargeArray ? undefined : processorTier,
      lockedAutomatic: hardLockedLargeArray || usesHybridLineArray,
      item: {
        ...item,
        productId: `${AUDIO_PROCESSOR_HOST_PRODUCT_ID}-${processorTier}`,
        name: getProcessorTierName(processorTier),
        quantity: item.name === getProcessorTierName(processorTier) ? 1 : 0
      }
    }));
  });
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
  blockedMessage,
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
  blockedMessage?: string;
}) {
  const customerConnectionLines = getCustomerVisibleConnectionLines(outputs.connectionLines);
  return (
    <div className="drawingBlock">
      <div className="drawingBlockHeader">
        <h4>{title}</h4>
        {onExport && !blockedMessage && (
          <button className="drawingExportButton" type="button" onClick={onExport}>
            <Download size={16} /> 导出{title}
          </button>
        )}
      </div>
      {blockedMessage ? (
        <div className="drawingBlockedState">
          <strong>{blockedMessage}</strong>
          <span>当前未生成点位和连接关系。</span>
        </div>
      ) : (
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
      )}
      {type === "system" && (
        <div className="connectionList">
          {customerConnectionLines.map((line) => (
            <p key={line.id}>
              {line.fromDevice} [{line.fromPort}] → {line.toDevice} [{line.toPort}]：{line.cableType}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function OutputSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="outputSection">
      <div className="outputSectionHeader">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="emptyState">{text}</div>;
}

function QuantityStepper({
  item,
  lockedAutomatic = false,
  isOverridden,
  onChange
}: {
  item: ProductRecommendation;
  lockedAutomatic?: boolean;
  isOverridden: boolean;
  onChange: (quantity: number) => void;
}) {
  const min = 0;
  const brand = getAppBrand();
  const lockedProcessor = item.category === "processor";
  const lockedSmallDiscAccessory = item.productId === SMALL_DISC_01_PRODUCT_ID || item.productId === SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID || item.productId === SMALL_DISC_USB_CABLE_PRODUCT_ID;
  const effectiveMin = lockedProcessor || lockedSmallDiscAccessory || lockedAutomatic ? 1 : min;
  const max = item.category === "speaker"
    ? 16
    : item.productId === SMALL_DISC_02_PRODUCT_ID || item.productId === SMALL_DISC_03_PRODUCT_ID
      ? SMALL_DISC_MAX_GENERATED_COUNT
      : item.category === "pickup"
        ? item.productId === LINE_ARRAY_PRODUCT_ID || brand.id === "yinman" ? 2 : 5
        : item.category === "amplifier" || lockedProcessor || lockedSmallDiscAccessory ? 1 : 4;
  const decrement = () => onChange(Math.max(effectiveMin, item.quantity - 1));
  const increment = () => onChange(Math.min(max, item.quantity + 1));

  return (
    <div className="quantityStepper">
      <button type="button" onClick={decrement} disabled={lockedAutomatic || item.quantity <= effectiveMin} aria-label={`${formatBrandText(item.name)} 减少数量`}>
        -
      </button>
      <strong>{item.quantity}</strong>
      <button type="button" onClick={increment} disabled={lockedAutomatic || item.quantity >= max} aria-label={`${formatBrandText(item.name)} 增加数量`}>
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

