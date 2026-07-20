import type { AppBrandId } from "../brand";
import type {
  ClassroomProfile,
  ConnectionLine,
  DeviceInterfacePanel,
  DevicePortCapability,
  DevicePortTerminal,
  GeneratedOutputs,
  InterfacePortDirection,
  InterfaceWiringConductor,
  InterfaceWiringEdge,
  InterfaceWiringFinding,
  InterfaceWiringModel,
  InterfaceWiringNode,
  InterfaceWiringPort
} from "../types";
import { filterUsbExclusiveAudioLines, WIRED_MIC_LINE_IN_POWER_NOTE } from "./connectionRules";
import { getExistingMicInputDemand, HANGING_MIC_PRODUCT_ID } from "./hangingMicRules";
import { getYinmanProcessorDirectSpeakerCapacity, LINE_ARRAY_PRODUCT_ID } from "./lineArrayRules";
import {
  EXTERNAL_AMPLIFIER_PRODUCT_ID,
  getExternalAmplifierChannelCountForSpeakers,
  MAX_SPEAKERS_PER_DT
} from "./speakerRules";
import {
  getDevicePortCapability,
  getDevicePortProfile,
  getDevicePortsByPrefix,
  COMPUTER_REAR_PANEL_PORT_PROFILE_ID,
  CONTROL_HOST_PORT_PROFILE_ID,
  EXTERNAL_WIRED_MICROPHONE_PORT_PROFILE_ID,
  HEADSET_SPLITTER_PORT_PROFILE_ID,
  LEGACY_WIRELESS_RECEIVER_PORT_PROFILE_ID,
  LAPTOP_PORT_PROFILE_ID,
  OPS_ALL_IN_ONE_PORT_PROFILE_ID,
  PASSIVE_SPEAKER_PORT_PROFILE_ID,
  PROCESSOR_AJ200_PORT_PROFILE_ID,
  PROCESSOR_AJ350_PORT_PROFILE_ID,
  PROCESSOR_AJ600_PORT_PROFILE_ID,
  RECORDING_CAMERA_PORT_PROFILE_ID,
  RECORDING_HOST_PORT_PROFILE_ID,
  VIDEO_CONFERENCE_TERMINAL_PORT_PROFILE_ID,
  WIRELESS_RECEIVER_PORT_PROFILE_ID,
  YINYI_DT2_PRO_PORT_PROFILE_ID,
  YINYI_DT2_PRO_SLAVE_PORT_PROFILE_ID
} from "./devicePortCatalog";
import {
  AUDIO_PROCESSOR_HOST_PRODUCT_ID,
  getYinmanHybridProcessorTier,
  LINE_ARRAY_MIC_CONVERTER_NAME,
  LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID,
  PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID
} from "./systemCapabilities";
import {
  SMALL_DISC_01_PRODUCT_ID,
  SMALL_DISC_02_PRODUCT_ID,
  SMALL_DISC_03_PRODUCT_ID,
  SMALL_DISC_AUDIO_EXTENDER_NAME,
  SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID,
  SMALL_DISC_MAIN_NAME,
  SMALL_DISC_RECORDING_NAME,
  SMALL_DISC_SLAVE_NAME
} from "./yinmanSmallDiscRules";

type CandidateProcessor = NonNullable<InterfaceWiringModel["candidateProcessor"]>;
export type RecordingInputMode = "balanced" | "lrg" | "trs35";
export type RecordingInputSelections = Partial<Record<string, RecordingInputMode>>;
type ExternalAudioPortForm = "balanced" | "stereo" | "mono";

export interface InterfaceWiringBuildInput {
  profile: ClassroomProfile;
  outputs: GeneratedOutputs;
  brandId: AppBrandId;
  recordingInputSelections?: RecordingInputSelections;
}

interface SystemState {
  yinyiDtCount: number;
  ring08Count: number;
  lineArrayCount: number;
  supplementCount: number;
  hangingCount: number;
  smallDisc01Count: number;
  smallDisc02Count: number;
  smallDisc03Count: number;
}

interface NodeSeed {
  id: string;
  productId: string;
  label: string;
  internalModel?: string;
  category: InterfaceWiringNode["category"];
  quantity: number;
}

interface ConnectionSeed {
  id: string;
  kind?: InterfaceWiringEdge["kind"];
  jumperRoute?: InterfaceWiringEdge["jumperRoute"];
  jumperBulge?: InterfaceWiringEdge["jumperBulge"];
  conductorDisplay?: InterfaceWiringEdge["conductorDisplay"];
  fromNode: InterfaceWiringNode;
  fromPort: DevicePortCapability;
  fromPortInstanceId?: string;
  allowOccupiedFromPort?: boolean;
  toNode: InterfaceWiringNode;
  toPort: DevicePortCapability;
  toPortInstanceId?: string;
  allowOccupiedToPort?: boolean;
  cableType: string;
  connectionMethod: string;
  signalDirection?: InterfaceWiringEdge["signalDirection"];
  quantity?: number;
  conductors?: InterfaceWiringConductor[];
  fromDeviceSequenceRange?: InterfaceWiringPort["deviceSequenceRange"];
  toDeviceSequenceRange?: InterfaceWiringPort["deviceSequenceRange"];
}

const COMPACT_SPEAKER_NODE_WIDTH = 112;
const HEADSET_SPLITTER_NODE_WIDTH = 180;
const CONTROL_HOST_NODE_WIDTH = 307;
const CONTROL_HOST_NODE_HEIGHT = 138;
const COMPACT_SPEAKER_GAP = 0;
const LEVEL_TWO_NODE_GAP = 24;
const LEVEL_TWO_MAX_NODE_WIDTH = 420;
const LEVEL_TWO_MAX_WIDE_NODE_WIDTH = 460;
const LEVEL_TWO_MAX_WIDE_NODES_PER_ROW = 2;
const GENERIC_BALANCED_AUDIO_TERMINALS: DevicePortTerminal[] = [
  { id: "positive", label: "+", role: "positive", color: "#dc2626" },
  { id: "negative", label: "-", role: "negative", color: "#ffffff" },
  { id: "ground", label: "G", role: "ground", color: "#64748b" }
];

export const LEGACY_AUDIO_SYSTEM_WIRING_FINDING_CODE = "legacy-audio-system.fae-required";
export const LEGACY_AUDIO_SYSTEM_WIRING_NOTICE = "接入原有音频系统较为复杂，建议联系对应FAE处理。";

interface MutableLayoutPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface InterfaceWiringLayout {
  width: number;
  height: number;
  positions: Record<string, MutableLayoutPosition>;
}

export interface InterfacePanelImageRect {
  x: number;
  y: number;
  width: number;
  height: number;
  unitRects?: Array<{ x: number; y: number; width: number; height: number }>;
}

const LINE_ARRAY_CONVERTER_PORTS_PER_UNIT = 3;
const REPEATED_INTERFACE_PANEL_GAP_RATIO = 0.08;

const processorProductIds: Record<CandidateProcessor, string> = {
  AJ200: PROCESSOR_AJ200_PORT_PROFILE_ID,
  AJ350: PROCESSOR_AJ350_PORT_PROFILE_ID,
  AJ600: PROCESSOR_AJ600_PORT_PROFILE_ID
};

const candidateOwnedConnectionPrefixes = [
  "dt-array-cascade-",
  "array-mic-processor-network-",
  "line-array-converter-",
  "line-array-supplement-",
  "hanging-mic-processor-",
  "small-disc-01-cascade-",
  "small-disc-03-cascade-"
];

const generatedSpeakerConnectionPrefixes = [
  "dt-speaker-",
  "dt-lineout-amplifier",
  "amplifier-speaker-",
  "small-disc-01-wall-speakers",
  "processor-speaker-direct",
  "processor-amplifier-speakers"
];

export function buildInterfaceWiringModel(input: InterfaceWiringBuildInput): InterfaceWiringModel {
  return new CandidateWiringBuilder(
    input.profile,
    input.outputs,
    input.brandId,
    input.recordingInputSelections ?? {}
  ).build();
}

class CandidateWiringBuilder {
  private readonly nodes = new Map<string, InterfaceWiringNode>();
  private readonly edges: InterfaceWiringEdge[] = [];
  private readonly findings: InterfaceWiringFinding[] = [];
  private readonly findingKeys = new Set<string>();
  private readonly occupiedPorts = new Set<string>();
  private readonly explicitParents = new Map<string, string>();
  private rootHint?: string;
  private processorProductId?: string;
  private candidateProcessor?: CandidateProcessor;

  constructor(
    private readonly profile: ClassroomProfile,
    private readonly outputs: GeneratedOutputs,
    private readonly brandId: AppBrandId,
    private readonly recordingInputSelections: RecordingInputSelections
  ) {}

  build(): InterfaceWiringModel {
    const state = this.getSystemState();
    if (this.brandId === "yinyi" && state.yinyiDtCount > 0) {
      this.prepareYinyiArrayMicrophones(state);
    } else {
      this.prepareCandidateMicrophoneSystem(state);
      if (this.brandId === "yinman") this.prepareSmallDiscSystem(state);
    }
    this.ensureSelectedExternalNodes();
    this.addFormalConnections();
    this.addManagedExternalConnections();
    this.addComputerFallbackConnections();
    this.addSpeakerRoutes(state);
    this.addLegacyAudioSystemFinding();
    this.addKnownBlockingFindings();
    const rootNodeId = this.finalizeHierarchy();
    this.addMissingInterfacePanelFindings();
    const status = this.findings.some((item) => item.severity === "hard")
      ? "blocked"
      : this.findings.some((item) => item.severity === "review")
        ? "review"
        : "ready";
    return {
      title: "接口接线图",
      status,
      rootNodeId,
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      findings: this.findings,
      candidateProcessor: this.candidateProcessor,
      generatedFrom: "calibrationCandidate"
    };
  }

  private getSystemState(): SystemState {
    const quantity = (productId: string) => this.outputs.productSelection.find((item) => item.productId === productId)?.quantity ?? 0;
    const pointCount = (pickupKind: string) => this.outputs.generatedPoints.filter((item) => item.pickupKind === pickupKind).length;
    const lineArrayCount = Math.max(quantity(LINE_ARRAY_PRODUCT_ID), pointCount("lineArray"));
    const supplementCount = lineArrayCount > 0 ? Math.max(quantity(SMALL_DISC_02_PRODUCT_ID), pointCount("smallDisc02")) : 0;
    return {
      yinyiDtCount: quantity("DT2-Pro"),
      ring08Count: Math.max(quantity(PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID), pointCount("existingArray")),
      lineArrayCount,
      supplementCount,
      hangingCount: Math.max(quantity(HANGING_MIC_PRODUCT_ID), pointCount("hangingMic")),
      smallDisc01Count: quantity(SMALL_DISC_01_PRODUCT_ID),
      smallDisc02Count: lineArrayCount > 0 ? 0 : Math.max(quantity(SMALL_DISC_02_PRODUCT_ID), pointCount("smallDisc02")),
      smallDisc03Count: Math.max(quantity(SMALL_DISC_03_PRODUCT_ID), pointCount("smallDisc03"))
    };
  }

  private prepareYinyiArrayMicrophones(state: SystemState) {
    if (state.yinyiDtCount <= 0) return;
    const mainProfile = getDevicePortProfile(YINYI_DT2_PRO_PORT_PROFILE_ID)!;
    const main = this.ensureNode({
      id: "dt-main",
      productId: YINYI_DT2_PRO_PORT_PROFILE_ID,
      label: `${mainProfile.customerName}（主麦）`,
      internalModel: mainProfile.internalModel,
      category: "microphone",
      quantity: 1
    });
    this.rootHint = main.id;
    let parent = main;
    for (let index = 1; index < state.yinyiDtCount; index += 1) {
      const slaveProfile = getDevicePortProfile(YINYI_DT2_PRO_SLAVE_PORT_PROFILE_ID)!;
      const slave = this.ensureNode({
        id: `dt-slave-${index}`,
        productId: YINYI_DT2_PRO_SLAVE_PORT_PROFILE_ID,
        label: `${slaveProfile.customerName}（从麦 ${index}）`,
        internalModel: slaveProfile.internalModel,
        category: "microphone",
        quantity: 1
      });
      this.explicitParents.set(slave.id, parent.id);
      this.addConnection({
        id: `dt-array-cascade-${index}`,
        fromNode: slave,
        fromPort: this.requirePort(slave.productId, "extMicOut"),
        toNode: parent,
        toPort: this.requirePort(parent.productId, "extMicIn"),
        cableType: "配套阵麦级联网线",
        connectionMethod: "从麦EXT MIC OUT接上一级EXT MIC IN；单段不超过10m；插拔后重启主麦",
        signalDirection: "bidirectional"
      });
      parent = slave;
    }
  }

  private prepareCandidateMicrophoneSystem(state: SystemState) {
    const requiresProcessor = state.ring08Count > 0 || state.lineArrayCount > 0 || state.hangingCount > 0;
    if (!requiresProcessor) return;
    this.candidateProcessor = this.selectCandidateProcessor(state);
    this.processorProductId = processorProductIds[this.candidateProcessor];
    const processorProfile = getDevicePortProfile(this.processorProductId)!;
    const processor = this.ensureNode({
      id: "processor",
      productId: this.processorProductId,
      label: processorProfile.customerName,
      internalModel: processorProfile.internalModel,
      category: "processor",
      quantity: 1
    });
    this.rootHint = processor.id;
    this.recordProcessorDifference();
    if (state.ring08Count > 0) this.addRing08Connections(processor, state.ring08Count);
    if (state.lineArrayCount > 0) this.addLineArrayConnections(processor, state);
    if (state.hangingCount > 0) this.addHangingMicrophoneConnections(processor, state.hangingCount);
  }

  private selectCandidateProcessor(state: SystemState): CandidateProcessor {
    if (this.brandId === "yinyi") {
      if (state.lineArrayCount > 1) return "AJ600";
      return this.getFormalProcessorModel() === "AJ600" ? "AJ600" : "AJ200";
    }
    if (state.ring08Count > 0) return "AJ350";
    if (state.lineArrayCount > 1) return "AJ600";
    if (state.lineArrayCount === 1 && state.supplementCount > 0) {
      const speakerCount = this.outputs.productSelection.find((item) => item.category === "speaker" && item.quantity > 0)?.quantity ?? 0;
      return getYinmanHybridProcessorTier(this.profile, speakerCount) === "sixMic" ? "AJ600" : "AJ200";
    }
    const formalProcessor = this.getFormalProcessorModel();
    if (state.lineArrayCount === 1) return formalProcessor ?? "AJ350";
    return formalProcessor ?? "AJ200";
  }

  private getFormalProcessorModel(): CandidateProcessor | undefined {
    const formalName = this.getFormalProcessorName() ?? "";
    return formalName.includes("高性能")
      ? "AJ350"
      : formalName.includes("六麦")
        ? "AJ600"
        : formalName.includes("双麦")
          ? "AJ200"
          : undefined;
  }

  private getFormalProcessorName() {
    return this.outputs.productSelection.find((item) => item.productId === AUDIO_PROCESSOR_HOST_PRODUCT_ID)?.name;
  }

  private recordProcessorDifference() {
    const formalModel = this.getFormalProcessorModel();
    if (!formalModel || !this.candidateProcessor) return;
    if (formalModel && formalModel !== this.candidateProcessor) {
      this.addFinding({
        code: "processor.candidate-difference",
        severity: "info",
        title: "处理器接口校核调整",
        message: "设备清单与接口校核采用的处理器能力不一致，请按接口校核结果复核设备清单。",
        nodeId: "processor"
      });
    }
  }

  private addRing08Connections(processor: InterfaceWiringNode, count: number) {
    const micProfile = getDevicePortProfile(PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID)!;
    const supported = Math.min(2, count);
    const microphones = Array.from({ length: supported }, (_, index) => {
      const sequence = index + 1;
      const microphone = this.ensureNode({
        id: supported === 1 ? "ring08" : `ring08-${sequence}`,
        productId: PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID,
        label: supported === 1 ? micProfile.customerName : `${micProfile.customerName} ${sequence}`,
        internalModel: micProfile.internalModel,
        category: "microphone",
        quantity: 1
      });
      this.explicitParents.set(microphone.id, processor.id);
      return microphone;
    });
    for (let index = 1; index <= supported; index += 1) {
      const microphone = microphones[index - 1];
      const source = this.requirePort(PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID, "lan");
      const target = this.requirePort(this.processorProductId!, index === 1 ? "a1" : "a2");
      this.addConnection({
        id: `ring08-aj350-${index}`,
        fromNode: microphone,
        fromPort: source,
        toNode: processor,
        toPort: target,
        cableType: "网线（T568B）",
        connectionMethod: "RJ45直连；禁止接PoE"
      });
    }
    if (count > 2) {
      this.addFinding({
        code: "ring08.a1-a2-capacity",
        severity: "hard",
        title: "大圆盘阵麦接口超过上限",
        message: `高性能处理器只有A1、A2两个大圆盘阵麦接口，当前${count}只无法由一台主机接入，建议更换设备或拆分系统。`,
        nodeId: processor.id
      });
    }
  }

  private addLineArrayConnections(processor: InterfaceWiringNode, state: SystemState) {
    const lineProfile = getDevicePortProfile(LINE_ARRAY_PRODUCT_ID)!;
    const lineMics = Array.from({ length: state.lineArrayCount }, (_, index) => {
      const sequence = index + 1;
      return this.ensureNode({
        id: state.lineArrayCount === 1 ? "line-array" : `line-array-${sequence}`,
        productId: LINE_ARRAY_PRODUCT_ID,
        label: state.lineArrayCount === 1 ? lineProfile.customerName : `${lineProfile.customerName} ${sequence}`,
        internalModel: lineProfile.internalModel,
        category: "microphone",
        quantity: 1
      });
    });
    const directCount = state.supplementCount > 0 ? 0 : Math.min(1, state.lineArrayCount);
    const convertedCount = Math.max(0, state.lineArrayCount - directCount);
    let converter: InterfaceWiringNode | undefined;
    if (convertedCount > 0) {
      converter = this.ensureNode({
        id: "line-array-converter",
        productId: LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID,
        label: LINE_ARRAY_MIC_CONVERTER_NAME,
        category: "extender",
        quantity: convertedCount
      });
      this.explicitParents.set(converter.id, processor.id);
    }

    if (directCount > 0) {
      const directLineMic = lineMics[0];
      this.explicitParents.set(directLineMic.id, processor.id);
      const processorPortId = this.candidateProcessor === "AJ350" ? "amic" : "extmic";
      this.addConnection({
        id: "line-array-direct-1",
        fromNode: directLineMic,
        fromPort: this.requirePort(LINE_ARRAY_PRODUCT_ID, "rj45"),
        toNode: processor,
        toPort: this.requirePort(this.processorProductId!, processorPortId),
        cableType: "网线（T568B）",
        connectionMethod: "阵麦接口直连；禁止接PoE"
      });
    }

    if (converter) {
      const micPorts = getDevicePortsByPrefix(this.processorProductId!, "mic");
      for (let converterIndex = 1; converterIndex <= convertedCount; converterIndex += 1) {
        const lineUnitIndex = directCount + converterIndex;
        const convertedLineMic = lineMics[lineUnitIndex - 1];
        this.explicitParents.set(convertedLineMic.id, converter.id);
        this.addConnection({
          id: `line-array-converter-link-${converterIndex}`,
          fromNode: convertedLineMic,
          fromPort: this.requirePort(LINE_ARRAY_PRODUCT_ID, "rj45"),
          toNode: converter,
          toPort: this.unitPort(LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID, "link", converterIndex, convertedCount),
          cableType: "网线（T568B）",
          connectionMethod: "LINK直连；禁止接PoE"
        });
        for (let outputIndex = 1; outputIndex <= 2; outputIndex += 1) {
          const processorMicIndex = (converterIndex - 1) * 2 + outputIndex;
          const target = micPorts[processorMicIndex - 1];
          if (!target) {
            this.addFinding({
              code: `processor.mic-capacity.${converterIndex}.${outputIndex}`,
              severity: "hard",
              title: "处理器MIC接口超过上限",
              message: "线阵拓展器需要占用两个MIC口，当前处理器接口不足，建议更换设备。",
              nodeId: processor.id
            });
            continue;
          }
          const baseOutput = this.requirePort(
            LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID,
            outputIndex === 1 ? "micOut1" : "micOut2"
          );
          this.addConnection({
            id: `line-array-converter-mic-${converterIndex}-${outputIndex}`,
            fromNode: converter,
            fromPort: this.indexedPort(baseOutput, converterIndex, convertedCount),
            toNode: processor,
            toPort: target,
            cableType: "麦克风音频线",
            connectionMethod: "转换后接处理器MIC输入"
          });
        }
      }
    }

    if (state.supplementCount > 0) {
      const supplementProfile = getDevicePortProfile(SMALL_DISC_02_PRODUCT_ID)!;
      const supplements = this.ensureNode({
        id: "line-array-supplements",
        productId: SMALL_DISC_02_PRODUCT_ID,
        label: supplementProfile.customerName,
        internalModel: supplementProfile.internalModel,
        category: "microphone",
        quantity: state.supplementCount
      });
      this.explicitParents.set(supplements.id, processor.id);
      if (state.supplementCount > 1) {
        const segments = state.supplementCount - 1;
        supplements.cascade = {
          segments,
          label: segments === 1 ? "级联" : `级联 ×${segments}`,
          fromPortLabel: "MIC",
          toPortLabel: "LINK",
          cableType: "网线（T568B）"
        };
      }
      this.addConnection({
        id: "line-array-supplement-extmic",
        fromNode: supplements,
        fromPort: this.unitPort(SMALL_DISC_02_PRODUCT_ID, "link", 1, state.supplementCount),
        toNode: processor,
        toPort: this.requirePort(this.processorProductId!, "extmic"),
        cableType: "网线（T568B）",
        connectionMethod: "整条02级联链共用EXTMIC"
      });
    }

    const micCapacity = getDevicePortsByPrefix(this.processorProductId!, "mic").length;
    const directWiredMicDemand = micCapacity > 0 ? getExistingMicInputDemand(this.profile) : 0;
    const totalMicDemand = convertedCount * 2 + directWiredMicDemand;
    if (totalMicDemand > micCapacity) {
      this.addFinding({
        code: "processor.total-mic-capacity",
        severity: "hard",
        title: "处理器MIC总需求超过上限",
        message: `当前需要${totalMicDemand}个MIC输入，当前处理器只有${micCapacity}个，无法生成超额接口连线，建议更换设备。`,
        nodeId: processor.id
      });
    }
  }

  private addHangingMicrophoneConnections(processor: InterfaceWiringNode, count: number) {
    const profile = getDevicePortProfile(HANGING_MIC_PRODUCT_ID)!;
    const microphones = Array.from({ length: count }, (_, index) => {
      const sequence = index + 1;
      const microphone = this.ensureNode({
        id: count === 1 ? "hanging-microphones" : `hanging-microphone-${sequence}`,
        productId: HANGING_MIC_PRODUCT_ID,
        label: count === 1 ? profile.customerName : `${profile.customerName} ${sequence}`,
        internalModel: profile.internalModel,
        category: "microphone",
        quantity: 1
      });
      this.explicitParents.set(microphone.id, processor.id);
      return microphone;
    });
    const micPorts = getDevicePortsByPrefix(this.processorProductId!, "mic");
    for (let index = 1; index <= count; index += 1) {
      const microphone = microphones[index - 1];
      const targetCapability = micPorts[index - 1];
      if (!targetCapability) {
        this.addFinding({
          code: `hanging-mic.capacity.${index}`,
          severity: "hard",
          title: "吊麦接口超过上限",
          message: `第${index}只吊麦没有可用MIC输入，建议更换设备。`,
          nodeId: processor.id
        });
        continue;
      }
      const target = { ...targetCapability, panelLabel: `MIC IN ${index}` };
      this.addConnection({
        id: `hanging-mic-${index}`,
        fromNode: microphone,
        fromPort: this.requirePort(HANGING_MIC_PRODUCT_ID, "xlr"),
        toNode: processor,
        toPort: target,
        cableType: "音频线",
        connectionMethod: "线缆卡侬母头插接吊麦卡侬公口，按2=+、3=-、1=G接处理器MIC IN"
      });
    }
  }

  private prepareSmallDiscSystem(state: SystemState) {
    if (state.smallDisc01Count > 0) {
      const mainProfile = getDevicePortProfile(SMALL_DISC_01_PRODUCT_ID)!;
      const main = this.ensureNode({
        id: "small-disc-01",
        productId: SMALL_DISC_01_PRODUCT_ID,
        label: mainProfile.customerName,
        internalModel: mainProfile.internalModel,
        category: "microphone",
        quantity: 1
      });
      this.rootHint = main.id;
      if (state.smallDisc02Count > 0) {
        const slaveProfile = getDevicePortProfile(SMALL_DISC_02_PRODUCT_ID)!;
        const slaves = this.ensureNode({
          id: "small-disc-02",
          productId: SMALL_DISC_02_PRODUCT_ID,
          label: slaveProfile.customerName,
          internalModel: slaveProfile.internalModel,
          category: "microphone",
          quantity: state.smallDisc02Count
        });
        this.explicitParents.set(slaves.id, main.id);
        const cascadeLabel = state.smallDisc02Count === 1 ? "级联" : `级联 ×${state.smallDisc02Count}`;
        slaves.cascade = {
          segments: state.smallDisc02Count,
          label: cascadeLabel,
          fromPortLabel: "MIC",
          toPortLabel: "LINK",
          cableType: "网线（T568B）"
        };
        this.addConnection({
          id: "small-disc-01-02-cascade",
          fromNode: main,
          fromPort: this.requirePort(SMALL_DISC_01_PRODUCT_ID, "mic"),
          toNode: slaves,
          toPort: this.unitPort(SMALL_DISC_02_PRODUCT_ID, "link", 1, state.smallDisc02Count),
          cableType: "网线（T568B）",
          connectionMethod: cascadeLabel,
          quantity: 1,
          signalDirection: "bidirectional"
        });
      }
    }
    if (state.smallDisc03Count > 0) {
      const recordingProfile = getDevicePortProfile(SMALL_DISC_03_PRODUCT_ID)!;
      const recording = this.ensureNode({
        id: "small-disc-03",
        productId: SMALL_DISC_03_PRODUCT_ID,
        label: recordingProfile.customerName,
        internalModel: recordingProfile.internalModel,
        category: "microphone",
        quantity: state.smallDisc03Count
      });
      this.rootHint = recording.id;
      if (state.smallDisc03Count > 1) {
        const segments = state.smallDisc03Count - 1;
        recording.cascade = {
          segments,
          label: segments === 1 ? "级联" : `级联 ×${segments}`,
          fromPortLabel: "MIC",
          toPortLabel: "LINK",
          cableType: "网线（T568B）"
        };
      }
    }
  }

  private getRecordingDevices() {
    return splitExternalDeviceText(this.profile.existingDevices.recordingHost);
  }

  private getComputerDevices() {
    return splitExternalDeviceText(this.profile.existingDevices.computer);
  }

  private hasLegacyAudioSystem() {
    return Boolean(this.profile.existingDevices.legacySoundSystem.trim());
  }

  private isLegacyAudioSystemConnection(line: ConnectionLine) {
    if (!this.hasLegacyAudioSystem()) return false;
    if (line.id.includes("legacy")) return true;
    const legacyDevices = splitExternalDeviceText(this.profile.existingDevices.legacySoundSystem)
      .filter((device) => !/原有音频系统|原有扩声系统/.test(device));
    return [line.fromDevice, line.toDevice].some((endpoint) =>
      legacyDevices.includes(stripQuantity(endpoint).trim())
    );
  }

  private isExternalDeviceRoutedToLegacyAudio(device: string) {
    const normalizedDevice = stripQuantity(device).trim();
    return this.outputs.connectionLines.some((line) =>
      this.isLegacyAudioSystemConnection(line) &&
      [line.fromDevice, line.toDevice].some((endpoint) => stripQuantity(endpoint).trim() === normalizedDevice)
    );
  }

  private ensureSelectedExternalNodes() {
    [...this.getRecordingDevices(), ...this.getComputerDevices()].forEach((device) => {
      if (this.isExternalDeviceRoutedToLegacyAudio(device)) return;
      this.ensureNode(this.describeDevice(device));
    });
  }

  private isManagedExternalConnection(line: ConnectionLine) {
    return [line.fromDevice, line.toDevice].some((device) =>
      isRecordingInputDevice(device) || isControlHost(device) || isVideoConferenceTerminal(device)
    );
  }

  private addFormalConnections() {
    filterUsbExclusiveAudioLines(this.outputs.connectionLines).forEach((line) => {
      if (candidateOwnedConnectionPrefixes.some((prefix) => line.id.startsWith(prefix))) return;
      if (generatedSpeakerConnectionPrefixes.some((prefix) => line.id.startsWith(prefix))) return;
      if (this.isLegacyAudioSystemConnection(line)) return;
      if (this.isPowerConnection(line)) return;
      if (this.isWirelessAirLink(line)) return;
      if (this.isManagedExternalConnection(line)) return;
      const fromNode = this.ensureNode(this.describeDevice(line.fromDevice));
      const toNode = this.ensureNode(this.describeDevice(line.toDevice));
      const preferredAudioForm = getExternalAudioPortForm(line);
      const fromPort = this.resolvePort(fromNode, line.fromPort, "output", line.id, preferredAudioForm);
      const toPort = this.resolvePort(toNode, line.toPort, "input", line.id, preferredAudioForm);
      if (!fromPort || !toPort) return;
      if (fromPort.id === "usb" && !this.isComputerNode(toNode)) {
        this.addFinding({
          code: `usb.invalid-target.${line.id}`,
          severity: "hard",
          title: "USB目标设备不支持",
          message: "USB音频只能连接电脑或一体机，当前连线已停止生成，建议改用模拟音频接口。",
          nodeId: toNode.id
        });
        return;
      }
      this.addConnection({
        id: `candidate-${line.id}`,
        fromNode,
        fromPort,
        toNode,
        toPort,
        cableType: normalizeCableType(line.cableType),
        connectionMethod: getConnectionMethod(line, fromPort, toPort, toNode.productId),
        signalDirection: line.cableType.includes("USB") ? "bidirectional" : "fromTo",
        conductors: getYinyiFormalConductorMappings(fromNode, fromPort, toNode, toPort)
      });
    });
  }

  private addManagedExternalConnections() {
    this.getRecordingDevices().forEach((device) => {
      if (this.isExternalDeviceRoutedToLegacyAudio(device)) return;
      const node = this.ensureNode(this.describeDevice(device));
      if (isRecordingInputDevice(device)) {
        this.connectRecordingInputDevice(node);
      } else if (isControlHost(device)) {
        this.connectControlHost(node);
      } else if (isVideoConferenceTerminal(device)) {
        this.connectVideoConferenceTerminal(node);
      }
    });
  }

  private connectRecordingInputDevice(node: InterfaceWiringNode) {
    const mode = this.recordingInputSelections[node.id] ?? "balanced";
    const source = this.allocateExternalHubPort(
      "output",
      `${node.label} AEC输入`,
      this.nodes.has("dt-main") ? "mono" : mode === "balanced" ? "balanced" : "stereo"
    );
    if (!source) return;
    const inputPortId = mode === "trs35" ? "lineIn35" : mode === "lrg" ? "lineInLrg" : "lineInBalanced";
    const inputPort = this.requirePort(node.productId, inputPortId);
    const usesAj200HpOut = source.port.id === "hpOut";
    const usesYinyiArrayMic = source.node.productId === YINYI_DT2_PRO_PORT_PROFILE_ID;
    this.explicitParents.set(node.id, source.node.id);
    this.addConnection({
      id: `external-recording-input-${node.id}`,
      fromNode: source.node,
      fromPort: source.port,
      toNode: node,
      toPort: inputPort,
      cableType: mode === "trs35" ? usesAj200HpOut ? "3.5mm成品音频线" : "3.5mm音频线" : "音频线",
      connectionMethod: usesYinyiArrayMic
        ? mode === "balanced"
          ? "AEC信号：主麦端红白并接LINE OUT同一个L或R，屏蔽接同组G；录播端红白并接+，屏蔽接G，-悬空；禁止接MIC IN"
          : mode === "trs35"
            ? "AEC信号：主麦端红白并接LINE OUT同一个L或R，屏蔽接同组G；3.5mm端红接L、白接R、屏蔽接G；禁止接MIC IN"
            : "AEC信号：主麦端红白并接LINE OUT同一个L或R，屏蔽接同组G；录播凤凰端红接L、白接R、屏蔽接G，三个端子全部接线；禁止接MIC IN"
        : mode === "balanced"
        ? "AEC信号：LINE OUT的+/-/G直连LINE IN的+/-/G；禁止接MIC IN"
        : usesAj200HpOut
          ? mode === "trs35"
            ? "AEC信号：HP OUT与3.5mm LINE IN使用成品双头3.5mm线，L/R/G一一对应；禁止接MIC IN"
            : "AEC信号：HP OUT的L/R/G与凤凰端子L/R/G一一对应；禁止接MIC IN"
          : "AEC信号：LINE OUT +并接L/R，G接G，LINE OUT -悬空；禁止接MIC IN",
      conductors: usesYinyiArrayMic
        ? mode === "balanced"
          ? getYinyiMonoToBalancedConductors(source.port, inputPort)
          : getYinyiMonoToStereoConductors(source.port, inputPort)
        : mode === "balanced"
        ? undefined
        : usesAj200HpOut
          ? getStereoToStereoConductors(source.port, inputPort)
          : getBalancedToStereoConductors(source.port, inputPort)
    });
  }

  private connectControlHost(node: InterfaceWiringNode) {
    const yinyiMain = this.nodes.get("dt-main");
    const controller = yinyiMain ?? this.nodes.get("processor");
    if (!controller) {
      this.addFinding({
        code: "external.control.rs232-unavailable",
        severity: "hard",
        title: "中控RS232接口不可用",
        message: "当前主设备没有已确认的RS232控制接口，无法生成中控连线，建议更换设备或专项复核。",
        nodeId: node.id
      });
      return;
    }
    const controllerPort = this.requireAvailablePort(
      controller,
      yinyiMain ? "extMicOut" : "rs232",
      "中控主机RS232"
    );
    if (!controllerPort) return;
    const controlPort = this.requirePort(node.productId, "rs232");
    this.explicitParents.set(node.id, controller.id);
    this.addConnection({
      id: `external-control-rs232-${node.id}`,
      fromNode: controller,
      fromPort: controllerPort,
      toNode: node,
      toPort: controlPort,
      cableType: "232线",
      connectionMethod: yinyiMain
        ? "RJ45白橙TX接中控RX，橙RX接中控TX，白绿/绿GND并接中控GND；115200、8N1"
        : "处理器TX接中控RX，处理器RX接中控TX，GND对接GND",
      signalDirection: "bidirectional",
      conductors: yinyiMain
        ? getYinyiRs232Conductors(controllerPort, controlPort)
        : getRs232Conductors(controllerPort, controlPort)
    });
  }

  private connectVideoConferenceTerminal(node: InterfaceWiringNode) {
    const hubOutput = this.allocateExternalHubPort("output", `${node.label} LINE IN`, "stereo");
    const hubInput = this.allocateExternalHubPort("input", `${node.label} LINE OUT`, "stereo");
    if (!hubOutput || !hubInput) return;
    const terminalInput = this.requirePort(node.productId, "audioIn");
    const terminalOutput = this.requirePort(node.productId, "audioOut");
    const directOutput = hubOutput.port.id === "hpOut";
    const directInput = hubInput.port.id === "hpIn";
    const stereoHubOutput = isStereoPortCapability(hubOutput.port);
    const stereoHubInput = isStereoPortCapability(hubInput.port);
    this.explicitParents.set(node.id, hubOutput.node.id);
    this.addConnection({
      id: `external-conference-input-${node.id}`,
      fromNode: hubOutput.node,
      fromPort: hubOutput.port,
      toNode: node,
      toPort: terminalInput,
      cableType: directOutput ? "3.5mm成品音频线" : "3.5mm音频线",
      connectionMethod: directOutput
        ? "HP OUT与终端LINE IN使用成品双头3.5mm线，L/R/G一一对应"
        : stereoHubOutput
          ? "主麦LINE OUT的L/R/G与终端LINE IN的L/R/G一一对应"
        : "终端L/R并接我方LINE OUT +，屏蔽接G，我方LINE OUT -悬空",
      conductors: directOutput || stereoHubOutput
        ? getStereoToStereoConductors(hubOutput.port, terminalInput)
        : getBalancedToStereoConductors(hubOutput.port, terminalInput)
    });
    this.addConnection({
      id: `external-conference-output-${node.id}`,
      fromNode: node,
      fromPort: terminalOutput,
      toNode: hubInput.node,
      toPort: hubInput.port,
      cableType: directInput ? "3.5mm成品音频线" : "3.5mm音频线",
      connectionMethod: directInput
        ? "终端LINE OUT与HP IN使用成品双头3.5mm线，L/R/G一一对应"
        : stereoHubInput
          ? "终端LINE OUT的L/R/G与主麦LINE IN的L/R/G一一对应"
        : "终端L/R并接我方LINE IN +，屏蔽接G，我方LINE IN -悬空",
      conductors: directInput || stereoHubInput
        ? getStereoToStereoConductors(terminalOutput, hubInput.port)
        : getStereoToBalancedConductors(terminalOutput, hubInput.port)
    });
  }

  private addComputerFallbackConnections() {
    this.getComputerDevices().forEach((device) => {
      if (this.isExternalDeviceRoutedToLegacyAudio(device)) return;
      const node = this.ensureNode(this.describeDevice(device));
      if (this.edges.some((edge) => edge.fromNodeId === node.id || edge.toNodeId === node.id)) return;
      const hubInput = this.allocateExternalHubPort("input", `${node.label}音频输出`, "stereo");
      const hubOutput = this.allocateExternalHubPort("output", `${node.label}音频输入`, "stereo");
      if (!hubInput || !hubOutput) return;
      this.explicitParents.set(node.id, hubOutput.node.id);
      if (node.productId === LAPTOP_PORT_PROFILE_ID) {
        this.connectLaptopThroughSplitter(node, hubInput, hubOutput);
        return;
      }
      const computerOutput = this.requirePort(node.productId, "audioOut");
      const computerInput = this.requirePort(node.productId, "audioIn");
      const directInput = hubInput.port.id === "hpIn";
      const directOutput = hubOutput.port.id === "hpOut";
      const stereoHubInput = isStereoPortCapability(hubInput.port);
      const stereoHubOutput = isStereoPortCapability(hubOutput.port);
      this.addConnection({
        id: `external-computer-output-${node.id}`,
        fromNode: node,
        fromPort: computerOutput,
        toNode: hubInput.node,
        toPort: hubInput.port,
        cableType: directInput ? "3.5mm成品音频线" : "3.5mm音频线",
        connectionMethod: directInput
          ? "电脑LINE OUT与HP IN使用成品双头3.5mm线，L/R/G一一对应"
          : stereoHubInput
            ? "电脑LINE OUT的L/R/G与主麦LINE IN的L/R/G一一对应"
          : "电脑L/R并接我方LINE IN +，屏蔽接G，我方LINE IN -悬空",
        conductors: directInput || stereoHubInput
          ? getStereoToStereoConductors(computerOutput, hubInput.port)
          : getStereoToBalancedConductors(computerOutput, hubInput.port)
      });
      this.addConnection({
        id: `external-computer-input-${node.id}`,
        fromNode: hubOutput.node,
        fromPort: hubOutput.port,
        toNode: node,
        toPort: computerInput,
        cableType: directOutput ? "3.5mm成品音频线" : "3.5mm音频线",
        connectionMethod: directOutput
          ? "HP OUT与电脑LINE IN使用成品双头3.5mm线，L/R/G一一对应"
          : stereoHubOutput
            ? "主麦LINE OUT的L/R/G与电脑LINE IN的L/R/G一一对应"
          : "我方LINE OUT +并接电脑L/R，G接屏蔽，我方LINE OUT -悬空",
        conductors: directOutput || stereoHubOutput
          ? getStereoToStereoConductors(hubOutput.port, computerInput)
          : getBalancedToStereoConductors(hubOutput.port, computerInput)
      });
    });
  }

  private connectLaptopThroughSplitter(
    laptop: InterfaceWiringNode,
    hubInput: { node: InterfaceWiringNode; port: DevicePortCapability },
    hubOutput: { node: InterfaceWiringNode; port: DevicePortCapability }
  ) {
    const splitter = this.ensureNode({
      id: `headset-splitter-${laptop.id}`,
      productId: HEADSET_SPLITTER_PORT_PROFILE_ID,
      label: "耳麦分线器",
      category: "extender",
      quantity: 1
    });
    this.explicitParents.set(splitter.id, laptop.id);
    this.addConnection({
      id: `external-laptop-splitter-${laptop.id}`,
      fromNode: laptop,
      fromPort: this.requirePort(laptop.productId, "headset"),
      toNode: splitter,
      toPort: this.requirePort(splitter.productId, "trrs"),
      cableType: "音频线",
      connectionMethod: "3.5mm TRRS复合口必须先拆分，禁止直接接普通3.5mm口"
    });
    const headphoneOutput = this.requirePort(splitter.productId, "headphoneOut");
    const directInput = hubInput.port.id === "hpIn";
    const stereoHubInput = isStereoPortCapability(hubInput.port);
    this.addConnection({
      id: `external-laptop-output-${laptop.id}`,
      fromNode: splitter,
      fromPort: headphoneOutput,
      toNode: hubInput.node,
      toPort: hubInput.port,
      cableType: directInput ? "3.5mm成品音频线" : "3.5mm音频线",
      connectionMethod: directInput
        ? "分线器耳机输出与HP IN使用成品双头3.5mm线，L/R/G一一对应"
        : stereoHubInput
          ? "分线器耳机输出L/R/G与主麦LINE IN的L/R/G一一对应"
        : "耳机L/R并接我方LINE IN +，屏蔽接G，我方LINE IN -悬空",
      conductors: directInput || stereoHubInput
        ? getStereoToStereoConductors(headphoneOutput, hubInput.port)
        : getStereoToBalancedConductors(headphoneOutput, hubInput.port)
    });
    const microphoneInput = this.requirePort(splitter.productId, "micIn");
    const directOutput = hubOutput.port.id === "hpOut";
    const stereoHubOutput = isStereoPortCapability(hubOutput.port);
    this.addConnection({
      id: `external-laptop-input-${laptop.id}`,
      fromNode: hubOutput.node,
      fromPort: hubOutput.port,
      toNode: splitter,
      toPort: microphoneInput,
      cableType: directOutput ? "3.5mm成品音频线" : "3.5mm音频线",
      connectionMethod: directOutput
        ? "HP OUT L/R并接分线器MIC IN信号，G接G"
        : stereoHubOutput
          ? "主麦LINE OUT的L/R并接分线器MIC IN信号，G接G"
        : "我方LINE OUT +接红白两芯并接分线器MIC IN信号，G接屏蔽线，LINE OUT -悬空",
      conductors: directOutput || stereoHubOutput
        ? getStereoToMonoConductors(hubOutput.port, microphoneInput)
        : getBalancedToMonoConductors(hubOutput.port, microphoneInput)
    });
  }

  private allocateExternalHubPort(
    direction: "input" | "output",
    responsibility: string,
    preferredAudioForm: ExternalAudioPortForm = "balanced"
  ) {
    const yinyiMain = this.nodes.get("dt-main");
    if (yinyiMain) {
      const port = this.allocateYinyiAudioPort(yinyiMain, direction, responsibility, preferredAudioForm);
      return port ? { node: yinyiMain, port } : undefined;
    }
    const processor = this.nodes.get("processor");
    if (processor) {
      const port = this.allocateProcessorAudioPort(processor, direction, responsibility, preferredAudioForm);
      return port ? { node: processor, port } : undefined;
    }
    const extender = this.nodes.get("small-disc-extender");
    const main = this.nodes.get("small-disc-01");
    const smallDiscCandidates: Array<{ node: InterfaceWiringNode; portId: string }> = [];
    if (extender) {
      smallDiscCandidates.push({ node: extender, portId: direction === "input" ? "aIn" : "aOut" });
    }
    if (main && direction === "output") {
      smallDiscCandidates.push({ node: main, portId: "audioOut" });
    }
    for (const candidate of smallDiscCandidates) {
      const port = this.requirePort(candidate.node.productId, candidate.portId);
      if (!this.isPortOccupied(candidate.node.id, port.id)) return { node: candidate.node, port };
    }
    this.addFinding({
      code: `external.hub-${direction}.${stableHash(responsibility)}`,
      severity: "hard",
      title: "外接设备音频接口不足",
      message: `当前主设备没有可用音频${direction === "input" ? "输入" : "输出"}接口，无法为“${responsibility}”生成虚假连线，建议更换设备。`
    });
    return undefined;
  }

  private allocateYinyiAudioPort(
    main: InterfaceWiringNode,
    direction: "input" | "output",
    responsibility: string,
    preferredAudioForm: ExternalAudioPortForm
  ) {
    const suffix = direction === "input" ? "In" : "Out";
    const prefix = preferredAudioForm === "stereo"
      ? `stereo${suffix}`
      : `line${suffix}`;
    return this.allocatePort(main, prefix, responsibility);
  }

  private allocateProcessorAudioPort(
    processor: InterfaceWiringNode,
    direction: "input" | "output",
    responsibility: string,
    preferredAudioForm: ExternalAudioPortForm
  ) {
    if (processor.productId === PROCESSOR_AJ200_PORT_PROFILE_ID && preferredAudioForm === "stereo") {
      const hpPort = this.requirePort(processor.productId, direction === "input" ? "hpIn" : "hpOut");
      if (!this.isPortOccupied(processor.id, hpPort.id)) return hpPort;
    }
    return this.allocatePort(processor, direction === "input" ? "lineIn" : "lineOut", responsibility);
  }

  private requireAvailablePort(node: InterfaceWiringNode, portId: string, responsibility: string) {
    const port = this.requirePort(node.productId, portId);
    if (!this.isPortOccupied(node.id, port.id)) return port;
    this.addFinding({
      code: `port-capacity.${node.id}.${port.id}.${stableHash(responsibility)}`,
      severity: "hard",
      title: "接口数量超过上限",
      message: `${node.label}的${port.panelLabel}已被占用，无法为“${responsibility}”生成虚假连线，建议更换设备。`,
      nodeId: node.id
    });
    return undefined;
  }

  private addYinyiSpeakerRoutes(
    speakerSelection: GeneratedOutputs["productSelection"][number],
    amplifierSelection: GeneratedOutputs["productSelection"][number] | undefined
  ) {
    const main = this.nodes.get("dt-main");
    if (!main) return;
    const directCount = Math.min(MAX_SPEAKERS_PER_DT, speakerSelection.quantity);
    const amplifierSpeakerCount = Math.max(0, speakerSelection.quantity - directCount);
    let nextSpeaker = this.connectSpeakerOutputs(
      main,
      speakerSelection.name,
      directCount,
      "dt-main-speakers",
      1
    );
    if (amplifierSpeakerCount <= 0) return;

    const amplifier = this.ensureNode({
      id: "amplifier",
      productId: EXTERNAL_AMPLIFIER_PRODUCT_ID,
      label: amplifierSelection?.name ?? "教学模拟功放主机",
      category: "amplifier",
      quantity: 1
    });
    this.explicitParents.set(amplifier.id, main.id);
    const activeChannels = getExternalAmplifierChannelCountForSpeakers(speakerSelection.quantity);
    for (let pairIndex = 0; pairIndex < Math.ceil(activeChannels / 2); pairIndex += 1) {
      const channelsInPair = Math.min(2, activeChannels - pairIndex * 2);
      const firstChannel = pairIndex * 2 + 1;
      const lastChannel = firstChannel + channelsInPair - 1;
      const source = this.allocatePort(main, "lineOut", `功放通道${firstChannel}-${lastChannel}`);
      if (!source) continue;
      const target = this.requireAvailablePort(amplifier, `lineIn${firstChannel}`, "阵麦主麦音频输出");
      if (!target) continue;
      this.addConnection({
        id: `dt-main-amplifier-input-${pairIndex + 1}`,
        fromNode: main,
        fromPort: source,
        toNode: amplifier,
        toPort: target,
        cableType: "音频线",
        connectionMethod: `阵麦LINE OUT所选L或R接功放LINE IN ${firstChannel}正端，共地G并接该通道负端和地端；LINE IN ${firstChannel}驱动SPK${firstChannel}`,
        conductors: getYinyiMonoToAmplifierConductors(source, target)
      });
      if (channelsInPair > 1) {
        this.addAmplifierInputJumper(
          amplifier,
          firstChannel - 1,
          lastChannel - 1,
          pairIndex === 0 ? "left" : "right",
          18
        );
      }
    }
    nextSpeaker = this.connectSpeakerOutputs(
      amplifier,
      speakerSelection.name,
      amplifierSpeakerCount,
      "amplifier-speakers",
      nextSpeaker
    );
    void nextSpeaker;
  }

  private addSpeakerRoutes(state: SystemState) {
    const speakerSelection = this.outputs.productSelection.find((item) => item.category === "speaker" && item.quantity > 0);
    if (!speakerSelection) return;
    const amplifierSelection = this.outputs.productSelection.find((item) => item.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID && item.quantity > 0);
    if (this.brandId === "yinyi" && this.nodes.has("dt-main")) {
      this.addYinyiSpeakerRoutes(speakerSelection, amplifierSelection);
      return;
    }
    const usesSmallDisc01 = state.smallDisc01Count > 0;
    const processorTier = this.candidateProcessor === "AJ200"
      ? "twoMic"
      : this.candidateProcessor === "AJ600" ? "sixMic" : "highPerformance";
    const directCapacity = getYinmanProcessorDirectSpeakerCapacity(processorTier);
    const directCount = usesSmallDisc01 ? 0 : Math.min(directCapacity, speakerSelection.quantity);
    const amplifierCount = usesSmallDisc01 ? speakerSelection.quantity : Math.max(0, speakerSelection.quantity - directCount);
    let nextSpeaker = 1;
    if (directCount > 0) {
      const processor = this.nodes.get("processor");
      if (processor) {
        nextSpeaker = this.connectSpeakerOutputs(
          processor,
          speakerSelection.name,
          directCount,
          "processor-speakers",
          nextSpeaker
        );
      }
    }
    if (amplifierCount > 0 || (usesSmallDisc01 && amplifierSelection)) {
      const amp = this.ensureNode({
        id: "amplifier",
        productId: EXTERNAL_AMPLIFIER_PRODUCT_ID,
        label: amplifierSelection?.name ?? "教学模拟功放主机",
        category: "amplifier",
        quantity: 1
      });
      const root = this.rootHint ? this.nodes.get(this.rootHint) : undefined;
      if (root) this.explicitParents.set(amp.id, root.id);
      if (root && !this.hasEdgeBetween(root.id, amp.id)) {
        const sourcePort = root.productId === SMALL_DISC_01_PRODUCT_ID
          ? this.requirePort(SMALL_DISC_01_PRODUCT_ID, "audioOut")
          : this.allocatePort(root, "lineOut", "功放音频输入");
        const ampInput = this.allocatePort(amp, "lineIn", "主设备音频输出");
        if (sourcePort && ampInput) {
          this.addConnection({
            id: "candidate-root-amplifier",
            fromNode: root,
            fromPort: sourcePort,
            toNode: amp,
            toPort: ampInput,
            cableType: "音频线",
            connectionMethod: "模拟音频输出接功放LINE IN 1；LINE IN 1驱动SPK1"
          });
        }
      }
      const amplifierInputEdge = root ? this.edges.find((edge) =>
        (edge.fromNodeId === root.id && edge.toNodeId === amp.id) ||
        (edge.fromNodeId === amp.id && edge.toNodeId === root.id)
      ) : undefined;
      if (amplifierInputEdge) {
        const connectionMethod = "模拟音频输出接功放LINE IN 1；LINE IN 1驱动SPK1";
        amplifierInputEdge.connectionMethod = connectionMethod;
        [root, amp].forEach((node) => node?.ports.forEach((port) => {
          if (port.id === amplifierInputEdge.fromPortId || port.id === amplifierInputEdge.toPortId) {
            port.connectionMethod = connectionMethod;
          }
        }));
      }
      const amplifierSpeakerCount = amplifierCount || speakerSelection.quantity;
      const activeAmplifierChannels = Math.min(
        amplifierSpeakerCount,
        getDevicePortsByPrefix(amp.productId, "spk").length
      );
      if (this.isPortOccupied(amp.id, "lineIn1")) {
        this.addAmplifierInputJumpers(amp, activeAmplifierChannels);
      }
      this.connectSpeakerOutputs(
        amp,
        speakerSelection.name,
        amplifierSpeakerCount,
        "amplifier-speakers",
        nextSpeaker
      );
    }
  }

  private addAmplifierInputJumpers(amplifier: InterfaceWiringNode, activeChannelCount: number) {
    const lineInputs = getDevicePortsByPrefix(amplifier.productId, "lineIn")
      .slice(0, Math.min(activeChannelCount, 4));
    const routes = lineInputs.length >= 4
      ? [
          { fromIndex: 0, toIndex: 1, route: "left" as const },
          { fromIndex: 1, toIndex: 3, route: "bottom" as const },
          { fromIndex: 3, toIndex: 2, route: "right" as const }
        ]
      : lineInputs.length === 3
        ? [
            { fromIndex: 0, toIndex: 1, route: "left" as const },
            { fromIndex: 1, toIndex: 2, route: "bottom" as const }
          ]
        : lineInputs.length === 2
          ? [{ fromIndex: 0, toIndex: 1, route: "left" as const }]
          : [];
    routes.forEach(({ fromIndex, toIndex, route }) => {
      this.addAmplifierInputJumper(amplifier, fromIndex, toIndex, route);
    });
  }

  private addAmplifierInputJumper(
    amplifier: InterfaceWiringNode,
    fromIndex: number,
    toIndex: number,
    route: NonNullable<InterfaceWiringEdge["jumperRoute"]>,
    jumperBulge?: number
  ) {
    const lineInputs = getDevicePortsByPrefix(amplifier.productId, "lineIn").slice(0, 4);
    const fromInput = lineInputs[fromIndex];
    const toInput = lineInputs[toIndex];
    if (!fromInput || !toInput) return;
    const fromChannel = fromIndex + 1;
    const toChannel = toIndex + 1;
    this.addConnection({
      id: `amplifier-input-jumper-${fromChannel}-${toChannel}`,
      kind: "jumper",
      jumperRoute: route,
      jumperBulge,
      fromNode: amplifier,
      fromPort: fromInput,
      fromPortInstanceId: `${fromInput.id}-jumper-to-${toChannel}`,
      allowOccupiedFromPort: true,
      toNode: amplifier,
      toPort: toInput,
      toPortInstanceId: `${toInput.id}-jumper-from-${fromChannel}`,
      cableType: "音频跳线",
      connectionMethod: `LINE IN ${fromChannel}跳接LINE IN ${toChannel}，+/-/G一一对应；LINE IN ${toChannel}驱动SPK${toChannel}`
    });
  }

  private connectSpeakerOutputs(
    source: InterfaceWiringNode,
    speakerName: string,
    quantity: number,
    idPrefix: string,
    firstSpeakerIndex: number
  ) {
    if (quantity <= 0) return firstSpeakerIndex;
    const available = getDevicePortsByPrefix(source.productId, "spk").filter((port) => !this.isPortOccupied(source.id, port.id));
    if (!available.length) {
      this.addFinding({
        code: `${idPrefix}.no-output`,
        severity: "hard",
        title: "音箱输出接口不足",
        message: "当前设备没有可用功放输出，无法生成音箱连线，建议更换设备。",
        nodeId: source.id
      });
      return firstSpeakerIndex;
    }
    const usedPortCount = Math.min(quantity, available.length);
    const base = Math.floor(quantity / usedPortCount);
    const remainder = quantity % usedPortCount;
    let firstSpeaker = firstSpeakerIndex;
    for (let index = 0; index < usedPortCount; index += 1) {
      const channelQuantity = base + (index < remainder ? 1 : 0);
      const lastSpeaker = firstSpeaker + channelQuantity - 1;
      const terminalLabel = channelQuantity === 1
        ? `+ / -（第${firstSpeaker}只）`
        : `+ / -（第${firstSpeaker}-${lastSpeaker}只）`;
      const terminal = this.syntheticPort(
        `terminals-${idPrefix}-${index + 1}`,
        terminalLabel,
        "扬声器接线端子",
        "input",
        true,
        this.requirePort(PASSIVE_SPEAKER_PORT_PROFILE_ID, "terminals").terminals
      );
      const speakerGroup = this.ensureNode({
        id: `${idPrefix}-group-${index + 1}`,
        productId: PASSIVE_SPEAKER_PORT_PROFILE_ID,
        label: speakerName,
        category: "speaker",
        quantity: channelQuantity
      });
      this.explicitParents.set(speakerGroup.id, source.id);
      this.addConnection({
        id: `${idPrefix}-${index + 1}`,
        fromNode: source,
        fromPort: available[index],
        toNode: speakerGroup,
        toPort: terminal,
        cableType: channelQuantity > 1 ? `音箱线 ×${channelQuantity}` : "音箱线",
        connectionMethod: "保持正负极一致",
        quantity: channelQuantity,
        toDeviceSequenceRange: { start: firstSpeaker, end: lastSpeaker }
      });
      if (channelQuantity > 2) {
        this.addFinding({
          code: `${idPrefix}.parallel-load.${index + 1}`,
          severity: "review",
          title: "音箱通道负载需复核",
          message: `${available[index].panelLabel}当前分配${channelQuantity}只音箱，现场需复核阻抗和通道负载。`,
          nodeId: source.id
        });
      }
      firstSpeaker = lastSpeaker + 1;
    }
    return firstSpeaker;
  }

  private addKnownBlockingFindings() {
    if (this.outputs.solutionSelection.blockingCode === "smallDisc01Interfaces") {
      this.addFinding({
        code: "small-disc-01.interface-capacity",
        severity: "hard",
        title: "小圆盘阵麦01接口数量超过上限",
        message: this.outputs.solutionSelection.blockingMessage ?? "超过接口上限，无法生成超额连线，建议更换设备。",
        nodeId: "small-disc-01"
      });
    }
  }

  private describeDevice(device: string): NodeSeed {
    const quantity = getQuantityFromText(device) ?? 1;
    const clean = stripQuantity(device).trim();
    if (this.brandId === "yinyi" && clean.includes("智能天花阵列麦克风")) {
      const profile = getDevicePortProfile(YINYI_DT2_PRO_PORT_PROFILE_ID)!;
      return {
        id: "dt-main",
        productId: YINYI_DT2_PRO_PORT_PROFILE_ID,
        label: `${profile.customerName}（主麦）`,
        internalModel: profile.internalModel,
        category: "microphone",
        quantity: 1
      };
    }
    if (isProcessorName(clean)) {
      const processorProductId = this.processorProductId ?? (
        this.brandId === "yinyi"
          ? clean.includes("六麦") ? PROCESSOR_AJ600_PORT_PROFILE_ID : PROCESSOR_AJ200_PORT_PROFILE_ID
          : PROCESSOR_AJ350_PORT_PROFILE_ID
      );
      const profile = getDevicePortProfile(processorProductId);
      if (this.brandId === "yinyi" && !this.processorProductId) {
        this.processorProductId = processorProductId;
        this.candidateProcessor = processorProductId === PROCESSOR_AJ600_PORT_PROFILE_ID ? "AJ600" : "AJ200";
      }
      return {
        id: "processor",
        productId: processorProductId,
        label: profile?.customerName ?? "智能音频处理主机",
        internalModel: profile?.internalModel,
        category: "processor",
        quantity: 1
      };
    }
    if (clean.includes(SMALL_DISC_MAIN_NAME)) return this.catalogSeed("small-disc-01", SMALL_DISC_01_PRODUCT_ID, 1);
    if (clean.includes(SMALL_DISC_SLAVE_NAME)) return this.catalogSeed("small-disc-02", SMALL_DISC_02_PRODUCT_ID, quantity);
    if (clean.includes(SMALL_DISC_RECORDING_NAME)) return this.catalogSeed("small-disc-03", SMALL_DISC_03_PRODUCT_ID, quantity);
    if (clean.includes(SMALL_DISC_AUDIO_EXTENDER_NAME) || clean === "音频扩展器") {
      return this.catalogSeed("small-disc-extender", SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID, 1, "extender");
    }
    if (clean.includes(LINE_ARRAY_MIC_CONVERTER_NAME)) {
      return this.catalogSeed("line-array-converter", LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID, quantity, "extender");
    }
    if (clean.includes("智能线阵麦克风")) return this.catalogSeed("line-array", LINE_ARRAY_PRODUCT_ID, quantity);
    if (clean.includes("大圆盘阵麦") || clean.includes("智能天花阵列麦克风")) {
      return this.catalogSeed("ring08", PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID, quantity);
    }
    if (clean === "吊麦" || clean.startsWith("吊麦 ")) return this.catalogSeed("hanging-microphones", HANGING_MIC_PRODUCT_ID, quantity);
    const wiredMicrophoneMatch = /^(?:利旧)?有线麦克风(?:\s+(\d+))?$/.exec(clean);
    if (wiredMicrophoneMatch) {
      const sequence = wiredMicrophoneMatch[1];
      return {
        ...this.catalogSeed(
          sequence ? `existing-wired-microphone-${sequence}` : "existing-wired-microphone",
          EXTERNAL_WIRED_MICROPHONE_PORT_PROFILE_ID,
          1
        ),
        label: clean
      };
    }
    if (clean.includes("录播主机")) return { ...this.catalogSeed("recording-host", RECORDING_HOST_PORT_PROFILE_ID, quantity, "external"), label: clean };
    if (clean.includes("录播摄像机")) return { ...this.catalogSeed("recording-camera", RECORDING_CAMERA_PORT_PROFILE_ID, quantity, "external"), label: clean };
    if (clean.includes("中控主机")) return { ...this.catalogSeed("control-host", CONTROL_HOST_PORT_PROFILE_ID, quantity, "external"), label: clean };
    if (clean.includes("视频会议终端")) return { ...this.catalogSeed("video-conference-terminal", VIDEO_CONFERENCE_TERMINAL_PORT_PROFILE_ID, quantity, "external"), label: clean };
    if (clean === "讲台电脑") return { ...this.catalogSeed("podium-computer", COMPUTER_REAR_PANEL_PORT_PROFILE_ID, quantity, "external"), label: clean };
    if (clean.includes("笔记本电脑")) return { ...this.catalogSeed("laptop-computer", LAPTOP_PORT_PROFILE_ID, quantity, "external"), label: clean };
    if (/ClassIn|会议一体机/i.test(clean)) {
      const id = clean.includes("ClassIn") ? "classin-all-in-one" : "meeting-all-in-one";
      return { ...this.catalogSeed(id, OPS_ALL_IN_ONE_PORT_PROFILE_ID, quantity, "external"), label: clean };
    }
    if (clean.includes("功放主机") || clean === "功放") {
      return {
        id: "amplifier",
        productId: EXTERNAL_AMPLIFIER_PRODUCT_ID,
        label: clean.includes("功放主机") ? clean : "教学模拟功放主机",
        category: "amplifier",
        quantity
      };
    }
    if (isSpeakerName(clean)) {
      const selected = this.outputs.productSelection.find((item) => item.category === "speaker" && item.quantity > 0);
      return {
        id: "speakers",
        productId: PASSIVE_SPEAKER_PORT_PROFILE_ID,
        label: selected?.name ?? clean.replace(/主机直驱分组|扩展分组|AFC扩声分组|不送线阵AFC分组|后墙中置AFC补声分组/g, "").trim(),
        category: "speaker",
        quantity: selected?.quantity ?? quantity
      };
    }
    if (clean.includes("无线接收机")) {
      const isLegacy = clean.startsWith("利旧");
      return {
        id: "wireless-receiver",
        productId: isLegacy ? LEGACY_WIRELESS_RECEIVER_PORT_PROFILE_ID : WIRELESS_RECEIVER_PORT_PROFILE_ID,
        label: clean,
        category: "external",
        quantity
      };
    }
    if (clean.includes("无线手持麦") || clean === "手持麦" || clean.startsWith("利旧手持")) {
      return {
        id: "wireless-microphones",
        productId: "WIRELESS-MICROPHONE",
        label: "无线手持麦克风",
        category: "microphone",
        quantity
      };
    }
    return {
      id: `external-${stableHash(clean)}`,
      productId: usesSharedComputerRearPanel(clean)
        ? COMPUTER_REAR_PANEL_PORT_PROFILE_ID
        : `EXTERNAL-${stableHash(clean)}`,
      label: clean || "外接设备",
      category: "external",
      quantity
    };
  }

  private catalogSeed(
    id: string,
    productId: string,
    quantity: number,
    category: InterfaceWiringNode["category"] = "microphone"
  ): NodeSeed {
    const profile = getDevicePortProfile(productId)!;
    return {
      id,
      productId,
      label: profile.customerName,
      internalModel: profile.internalModel,
      category,
      quantity
    };
  }

  private getTopologyAlignedNodeLabel(seed: NodeSeed) {
    if (seed.productId === YINYI_DT2_PRO_PORT_PROFILE_ID) {
      return this.getSystemState().yinyiDtCount > 1 ? "主麦" : "阵麦";
    }
    if (seed.productId === YINYI_DT2_PRO_SLAVE_PORT_PROFILE_ID) {
      const sequence = /-(\d+)$/.exec(seed.id)?.[1];
      return sequence ? `从麦 ${sequence}` : "从麦";
    }
    if (seed.id === "processor") return this.getFormalProcessorName() ?? seed.label;
    if (seed.productId === PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID) {
      const sequence = /-(\d+)$/.exec(seed.id)?.[1];
      return sequence ? `阵麦 ${sequence}` : "阵麦";
    }
    if (seed.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID) return "功放";
    if (seed.productId === EXTERNAL_WIRED_MICROPHONE_PORT_PROFILE_ID) return "有线麦";
    if (seed.productId === "WIRELESS-MICROPHONE") return "手持麦";
    if (seed.productId === LAPTOP_PORT_PROFILE_ID) return "笔记本";
    if (seed.productId === VIDEO_CONFERENCE_TERMINAL_PORT_PROFILE_ID) return "会议终端";
    if (seed.productId === OPS_ALL_IN_ONE_PORT_PROFILE_ID) {
      if (seed.label.includes("ClassIn")) return "ClassIn";
      if (seed.label.includes("会议")) return "会议屏";
      return "一体机";
    }
    return seed.label;
  }

  private ensureNode(seed: NodeSeed): InterfaceWiringNode {
    const existing = this.nodes.get(seed.id);
    if (existing) {
      existing.quantity = Math.max(existing.quantity, seed.quantity);
      if (!existing.internalModel && seed.internalModel) existing.internalModel = seed.internalModel;
      return existing;
    }
    const node: InterfaceWiringNode = {
      ...seed,
      label: this.getTopologyAlignedNodeLabel(seed),
      level: 1,
      ports: []
    };
    this.nodes.set(node.id, node);
    return node;
  }

  private resolvePort(
    node: InterfaceWiringNode,
    originalPort: string,
    direction: Exclude<InterfacePortDirection, "bidirectional">,
    edgeId: string,
    preferredAudioForm: ExternalAudioPortForm = "balanced"
  ): DevicePortCapability | undefined {
    const normalized = originalPort.toUpperCase();
    if (node.productId === YINYI_DT2_PRO_PORT_PROFILE_ID) {
      if (normalized.includes("USB")) return this.requirePort(node.productId, "usb");
      if (normalized.includes("EXT MIC OUT") || /网络|控制/.test(originalPort)) return this.requirePort(node.productId, "extMicOut");
      if (normalized.includes("EXT MIC IN")) return this.requirePort(node.productId, "extMicIn");
      if (/SPK|功放输出/i.test(originalPort)) return this.allocatePort(node, "spk", originalPort);
      if (/LINE OUT|模拟输出|音频输出/i.test(originalPort)) {
        return this.allocateYinyiAudioPort(node, "output", originalPort, preferredAudioForm);
      }
      if (/LINE IN|模拟输入|音频输入/i.test(originalPort)) {
        return this.allocateYinyiAudioPort(node, "input", originalPort, preferredAudioForm);
      }
    }
    if (node.productId === EXTERNAL_WIRED_MICROPHONE_PORT_PROFILE_ID) {
      return this.requirePort(node.productId, "xlr");
    }
    if (node.category === "processor") {
      if (normalized.includes("USB")) return this.requirePort(node.productId, "usb");
      if (/网络|控制|LAN/.test(originalPort)) return this.requirePort(node.productId, "lan");
      if (/MIC\s*IN/i.test(originalPort)) {
        const target = this.allocatePort(node, "mic", originalPort);
        if (!target) return undefined;
        const sequence = /^mic(\d+)$/i.exec(target.id)?.[1];
        return sequence ? { ...target, panelLabel: `MIC IN ${sequence}` } : target;
      }
      if (/LINE OUT|模拟输出|音频输出/i.test(originalPort)) return this.allocateProcessorAudioPort(node, "output", originalPort, preferredAudioForm);
      if (/LINE IN|模拟输入|音频输入/i.test(originalPort)) return this.allocateProcessorAudioPort(node, "input", originalPort, preferredAudioForm);
      const micMatch = /MIC\s*(\d+)/i.exec(originalPort);
      if (micMatch) return getDevicePortCapability(node.productId, `mic${micMatch[1]}`);
    }
    if (node.productId === SMALL_DISC_01_PRODUCT_ID) {
      if (normalized.includes("USB")) return this.requirePort(node.productId, "usb");
      if (normalized.includes("AUDIO OUT") || normalized.includes("SPK-OUT")) return this.requirePort(node.productId, "audioOut");
      if (normalized === "MIC") return this.requirePort(node.productId, "mic");
      if (normalized === "LINK") return this.requirePort(node.productId, "link");
    }
    if (node.productId === SMALL_DISC_02_PRODUCT_ID || node.productId === SMALL_DISC_03_PRODUCT_ID) {
      if (normalized === "MIC") return this.requirePort(node.productId, "mic");
      if (normalized === "LINK") return this.requirePort(node.productId, "link");
      if (normalized.includes("MIC-OUT")) return this.requirePort(node.productId, "micOut");
    }
    if (node.productId === SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID) {
      if (normalized === "LINK") return this.requirePort(node.productId, "link");
      if (normalized.includes("A IN")) return this.requirePort(node.productId, "aIn");
      if (normalized.includes("A OUT")) return this.requirePort(node.productId, "aOut");
    }
    if (node.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID) {
      if (/输入|LINE IN/i.test(originalPort)) return this.allocatePort(node, "lineIn", originalPort);
      if (/输出|CH\d|SPK/i.test(originalPort)) return this.allocatePort(node, "spk", originalPort);
    }
    if (node.productId === WIRELESS_RECEIVER_PORT_PROFILE_ID || node.productId === LEGACY_WIRELESS_RECEIVER_PORT_PROFILE_ID) {
      if (normalized.includes("BAL OUT")) return this.requirePort(node.productId, "balOut");
      if (normalized.includes("LINE OUT")) return this.requirePort(node.productId, "lineOut");
      if (normalized.includes("MIC OUT 1")) return this.requirePort(node.productId, "micOut1");
      if (normalized.includes("MIC OUT 2")) return this.requirePort(node.productId, "micOut2");
      if (normalized.includes("MIC OUT")) return this.requirePort(node.productId, "micOut");
      if (normalized.includes("无线接收")) return this.syntheticPort("wirelessReceive", "无线接收", "无线", "input");
    }
    if (node.productId === "WIRELESS-MICROPHONE") {
      return this.syntheticPort(`wireless-${edgeId}`, "无线发射", "无线", "output");
    }
    if (node.productId === COMPUTER_REAR_PANEL_PORT_PROFILE_ID) {
      if (normalized.includes("USB")) return this.requirePort(node.productId, "usbAudio");
      if (/音频输入|LINE\s*IN/i.test(originalPort)) return this.requirePort(node.productId, "audioIn");
      if (/音频输出|LINE\s*OUT/i.test(originalPort)) return this.requirePort(node.productId, "audioOut");
      if (/HEADSET|耳机.*麦克风|复合/i.test(originalPort)) return this.requirePort(node.productId, "headset");
    }
    if (node.productId === RECORDING_HOST_PORT_PROFILE_ID || node.productId === RECORDING_CAMERA_PORT_PROFILE_ID) {
      const mode = this.recordingInputSelections[node.id] ?? "balanced";
      return this.requirePort(node.productId, mode === "trs35" ? "lineIn35" : mode === "lrg" ? "lineInLrg" : "lineInBalanced");
    }
    if (node.productId === CONTROL_HOST_PORT_PROFILE_ID) return this.requirePort(node.productId, "rs232");
    if (node.productId === LAPTOP_PORT_PROFILE_ID) {
      if (normalized.includes("USB")) return this.requirePort(node.productId, "usbAudio");
      return this.requirePort(node.productId, "headset");
    }
    if (node.productId === OPS_ALL_IN_ONE_PORT_PROFILE_ID) {
      if (normalized.includes("USB")) return this.requirePort(node.productId, "usbAudio");
      if (/音频输入|LINE\s*IN/i.test(originalPort)) return this.requirePort(node.productId, "audioIn");
      if (/音频输出|LINE\s*OUT/i.test(originalPort)) return this.requirePort(node.productId, "audioOut");
    }
    if (node.productId === VIDEO_CONFERENCE_TERMINAL_PORT_PROFILE_ID) {
      if (/音频输入|LINE\s*IN/i.test(originalPort)) return this.requirePort(node.productId, "audioIn");
      if (/音频输出|LINE\s*OUT/i.test(originalPort)) return this.requirePort(node.productId, "audioOut");
    }
    if (this.isComputerNode(node) && normalized.includes("USB")) {
      return this.syntheticPort("usbAudio", "USB Audio", "USB", "bidirectional");
    }
    if (node.productId === PASSIVE_SPEAKER_PORT_PROFILE_ID) return this.requirePort(node.productId, "terminals");

    const isAudio = /音频|LINE|RCA|3\.5|6\.35/i.test(originalPort);
    const label = isAudio
      ? direction === "input" ? "音频输入（接口形式需复核）" : "音频输出（接口形式需复核）"
      : /网络|控制|LAN/i.test(originalPort)
        ? "网络接口（接口形式需复核）"
        : `${originalPort || (direction === "input" ? "输入" : "输出")}（接口形式需复核）`;
    this.addFinding({
      code: `external-port.${node.id}.${direction}`,
      severity: "review",
      title: "外接设备接口需复核",
      message: `${node.label}的${direction === "input" ? "输入" : "输出"}接口形式未确认，图中保留通用标注，不阻断方案。`,
      nodeId: node.id
    });
    return this.syntheticPort(
      `unconfirmed-${direction}-${edgeId}`,
      label,
      "接口形式待复核",
      direction,
      false,
      isAudio ? GENERIC_BALANCED_AUDIO_TERMINALS : []
    );
  }

  private allocatePort(node: InterfaceWiringNode, prefix: string, responsibility: string) {
    const available = getDevicePortsByPrefix(node.productId, prefix).find((port) => !this.isPortOccupied(node.id, port.id));
    if (!available) {
      this.addFinding({
        code: `port-capacity.${node.id}.${prefix}.${stableHash(responsibility)}`,
        severity: "hard",
        title: "接口数量超过上限",
        message: `${node.label}没有剩余${prefix.startsWith("mic") ? "MIC输入" : prefix.startsWith("lineIn") ? "音频输入" : prefix.startsWith("lineOut") ? "音频输出" : "可用"}接口，无法为“${responsibility}”生成虚假连线，建议更换设备。`,
        nodeId: node.id
      });
    }
    return available;
  }

  private addConnection(seed: ConnectionSeed) {
    const fromPortOccupied = this.isPortOccupied(seed.fromNode.id, seed.fromPort.id);
    const toPortOccupied = this.isPortOccupied(seed.toNode.id, seed.toPort.id);
    const fromPortConflict = fromPortOccupied && !seed.allowOccupiedFromPort;
    const toPortConflict = toPortOccupied && !seed.allowOccupiedToPort;
    if (fromPortConflict || toPortConflict) {
      const occupiedNode = fromPortConflict ? seed.fromNode : seed.toNode;
      const occupiedPort = occupiedNode === seed.fromNode ? seed.fromPort : seed.toPort;
      this.addFinding({
        code: `duplicate-port.${occupiedNode.id}.${occupiedPort.id}.${seed.id}`,
        severity: "hard",
        title: "接口重复占用",
        message: `${occupiedNode.label}的${occupiedPort.panelLabel}已被其他连线占用，本条连线未生成。`,
        nodeId: occupiedNode.id
      });
      return;
    }
    const fromPortId = `${seed.fromNode.id}:${seed.fromPortInstanceId ?? seed.fromPort.id}`;
    const toPortId = `${seed.toNode.id}:${seed.toPortInstanceId ?? seed.toPort.id}`;
    seed.fromNode.ports.push({
      id: fromPortId,
      capabilityId: seed.fromPort.id,
      label: seed.fromPort.panelLabel,
      interfaceType: seed.fromPort.interfaceType,
      direction: seed.fromPort.direction,
      peerNodeId: seed.toNode.id,
      peerPortLabel: seed.toPort.panelLabel,
      cableType: seed.cableType,
      connectionMethod: seed.connectionMethod,
      confirmed: seed.fromPort.confirmed,
      terminals: seed.fromPort.terminals,
      physicalGroupId: seed.fromPort.physicalGroupId,
      deviceSequenceRange: seed.fromDeviceSequenceRange
    });
    seed.toNode.ports.push({
      id: toPortId,
      capabilityId: seed.toPort.id,
      label: seed.toPort.panelLabel,
      interfaceType: seed.toPort.interfaceType,
      direction: seed.toPort.direction,
      peerNodeId: seed.fromNode.id,
      peerPortLabel: seed.fromPort.panelLabel,
      cableType: seed.cableType,
      connectionMethod: seed.connectionMethod,
      confirmed: seed.toPort.confirmed,
      terminals: seed.toPort.terminals,
      physicalGroupId: seed.toPort.physicalGroupId,
      deviceSequenceRange: seed.toDeviceSequenceRange
    });
    this.occupiedPorts.add(`${seed.fromNode.id}:${seed.fromPort.id}`);
    this.occupiedPorts.add(`${seed.toNode.id}:${seed.toPort.id}`);
    this.edges.push({
      id: seed.id,
      kind: seed.kind ?? "field",
      jumperRoute: seed.jumperRoute,
      ...(seed.jumperBulge !== undefined ? { jumperBulge: seed.jumperBulge } : {}),
      ...(seed.conductorDisplay ? { conductorDisplay: seed.conductorDisplay } : {}),
      fromNodeId: seed.fromNode.id,
      fromPortId,
      toNodeId: seed.toNode.id,
      toPortId,
      cableType: seed.cableType,
      connectionMethod: seed.connectionMethod,
      signalDirection: seed.signalDirection ?? (seed.fromPort.direction === "bidirectional" || seed.toPort.direction === "bidirectional" ? "bidirectional" : "fromTo"),
      quantity: seed.quantity ?? 1,
      conductors: seed.conductors ?? getConductorMappings(seed.fromPort, seed.toPort, seed.cableType)
    });
    if (!seed.fromPort.confirmed || !seed.toPort.confirmed) {
      this.addFinding({
        code: `unconfirmed-port.${seed.id}`,
        severity: "review",
        title: "接口面板标识待补录",
        message: `${!seed.fromPort.confirmed ? seed.fromNode.label : seed.toNode.label}存在尚未确认的面板原始接口名称。`,
        nodeId: !seed.fromPort.confirmed ? seed.fromNode.id : seed.toNode.id
      });
    }
  }

  private requirePort(productId: string, portId: string) {
    const capability = getDevicePortCapability(productId, portId);
    if (!capability) throw new Error(`Missing interface port ${productId}:${portId}`);
    return capability;
  }

  private unitPort(productId: string, portId: string, index: number, total: number) {
    return this.indexedPort(this.requirePort(productId, portId), index, total);
  }

  private indexedPort(port: DevicePortCapability, index: number, total: number): DevicePortCapability {
    return {
      ...port,
      id: `${port.id}-${index}`,
      panelLabel: total > 1 ? `${port.panelLabel}（第${index}只）` : port.panelLabel
    };
  }

  private syntheticPort(
    id: string,
    panelLabel: string,
    interfaceType: string,
    direction: InterfacePortDirection,
    confirmed = true,
    terminals: DevicePortTerminal[] = []
  ): DevicePortCapability {
    return {
      id,
      panelLabel,
      interfaceType,
      direction,
      maxConnections: 1,
      confirmed,
      source: confirmed ? "当前方案连接关系" : "接口资料待用户补录",
      terminals
    };
  }

  private addMissingInterfacePanelFindings() {
    this.nodes.forEach((node) => {
      if (!node.ports.length) return;
      const profile = getDevicePortProfile(node.productId);
      if (profile?.interfacePanel?.confirmed) return;
      const hasPartialPanel = Boolean(profile?.interfacePanel);
      this.addFinding({
        code: `interface-panel.missing.${node.id}`,
        severity: "review",
        title: hasPartialPanel ? "完整接口图待补充" : "设备接口图待补充",
        message: hasPartialPanel
          ? `${node.label}当前资料只确认了部分接口面，未确认位置继续使用文字标注，不伪造接口位置。`
          : `${node.label}尚无已确认的完整背面或接口面板图，接线图仅保留接口文字，不借用正面实物图。`,
        nodeId: node.id
      });
    });
  }

  private isPortOccupied(nodeId: string, portId: string) {
    if (this.occupiedPorts.has(`${nodeId}:${portId}`)) return true;
    const node = this.nodes.get(nodeId);
    if (node?.productId !== YINYI_DT2_PRO_PORT_PROFILE_ID) return false;
    const capability = getDevicePortCapability(node.productId, portId);
    if (!capability?.physicalGroupId?.startsWith("line-")) return false;
    const usedInGroup = node.ports.filter((port) => port.physicalGroupId === capability.physicalGroupId);
    if (!usedInGroup.length) return false;
    const independentChannel = /^line(?:In|Out)\d+$/.test(capability.id);
    return !independentChannel || usedInGroup.some((port) => !/^line(?:In|Out)\d+$/.test(port.capabilityId));
  }

  private isPowerConnection(line: ConnectionLine) {
    return /电源|POWER|AC\s*220|DC\s*12|适配器/i.test(`${line.fromPort} ${line.toPort} ${line.cableType}`);
  }

  private isWirelessAirLink(line: ConnectionLine) {
    return /无线信号/i.test(line.cableType) ||
      (/无线发射/i.test(line.fromPort) && /无线接收/i.test(line.toPort));
  }

  private isComputerNode(node: InterfaceWiringNode) {
    return /电脑|一体机|会议屏|CLASSIN|笔记本/i.test(node.label);
  }

  private hasEdgeBetween(left: string, right: string) {
    return this.edges.some((edge) =>
      (edge.fromNodeId === left && edge.toNodeId === right) ||
      (edge.fromNodeId === right && edge.toNodeId === left)
    );
  }

  private addFinding(finding: InterfaceWiringFinding) {
    const key = `${finding.code}:${finding.nodeId ?? ""}`;
    if (this.findingKeys.has(key)) return;
    this.findingKeys.add(key);
    this.findings.push(finding);
  }

  private addLegacyAudioSystemFinding() {
    if (!this.hasLegacyAudioSystem()) return;
    this.addFinding({
      code: LEGACY_AUDIO_SYSTEM_WIRING_FINDING_CODE,
      severity: "review",
      title: "原有音频系统接线暂不生成",
      message: LEGACY_AUDIO_SYSTEM_WIRING_NOTICE
    });
  }

  private finalizeHierarchy() {
    const rootNodeId = this.rootHint ?? (this.nodes.has("processor") ? "processor" : this.nodes.keys().next().value);
    if (!rootNodeId) return undefined;
    const adjacency = new Map<string, string[]>();
    this.nodes.forEach((_, id) => adjacency.set(id, []));
    this.edges.forEach((edge) => {
      adjacency.get(edge.fromNodeId)?.push(edge.toNodeId);
      adjacency.get(edge.toNodeId)?.push(edge.fromNodeId);
    });
    const discoveredParents = new Map<string, string>();
    const queue = [rootNodeId];
    const visited = new Set(queue);
    while (queue.length) {
      const current = queue.shift()!;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        discoveredParents.set(neighbor, current);
        queue.push(neighbor);
      }
    }
    this.nodes.forEach((node) => {
      if (node.id === rootNodeId) {
        node.level = 1;
        delete node.parentId;
        return;
      }
      node.parentId = this.explicitParents.get(node.id) ?? discoveredParents.get(node.id) ?? rootNodeId;
    });
    const resolveLevel = (node: InterfaceWiringNode, stack = new Set<string>()): 1 | 2 | 3 => {
      if (node.id === rootNodeId || !node.parentId) return 1;
      if (stack.has(node.id)) return 2;
      const parent = this.nodes.get(node.parentId);
      if (!parent) return 2;
      stack.add(node.id);
      return Math.min(3, resolveLevel(parent, stack) + 1) as 1 | 2 | 3;
    };
    this.nodes.forEach((node) => { node.level = resolveLevel(node); });
    return rootNodeId;
  }
}

function splitExternalDeviceText(value: string) {
  return Array.from(new Set(value
    .split(/[、,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean)));
}

function getExternalAudioPortForm(line: ConnectionLine): ExternalAudioPortForm {
  const description = `${line.fromPort} ${line.toPort} ${line.cableType}`;
  if (/XLR|卡侬|BAL\s*OUT|差分|平衡/i.test(description)) return "balanced";
  if (/6\.35|RCA|TS\b/i.test(description)) return "mono";
  return /3\.5|L\s*\/\s*R\s*\/\s*G|LRG/i.test(description) ? "stereo" : "balanced";
}

function isRecordingInputDevice(device: string) {
  return device.includes("录播主机") || device.includes("录播摄像机");
}

function isControlHost(device: string) {
  return device.includes("中控主机");
}

function isVideoConferenceTerminal(device: string) {
  return device.includes("视频会议终端");
}

function getTerminalLabel(port: DevicePortCapability, terminalId: string, fallback: string) {
  return port.terminals.find((terminal) => terminal.id === terminalId)?.label ?? fallback;
}

function mappedConductor(
  id: string,
  label: string,
  color: string,
  fromPort: DevicePortCapability,
  fromTerminalId: string,
  toPort: DevicePortCapability,
  toTerminalId: string
): InterfaceWiringConductor {
  return {
    id,
    label,
    color,
    fromTerminalId,
    fromTerminalLabel: getTerminalLabel(fromPort, fromTerminalId, fromTerminalId),
    toTerminalId,
    toTerminalLabel: getTerminalLabel(toPort, toTerminalId, toTerminalId),
    confirmed: fromPort.confirmed && toPort.confirmed
  };
}

function getBalancedToStereoConductors(fromPort: DevicePortCapability, toPort: DevicePortCapability) {
  return [
    mappedConductor("positive-left", "红线", "#dc2626", fromPort, "positive", toPort, "left"),
    mappedConductor("positive-right", "白线", "#ffffff", fromPort, "positive", toPort, "right"),
    mappedConductor("ground-ground", "屏蔽线", "#6b7280", fromPort, "ground", toPort, "ground")
  ];
}

function getStereoToBalancedConductors(fromPort: DevicePortCapability, toPort: DevicePortCapability) {
  return [
    mappedConductor("left-positive", "红线", "#dc2626", fromPort, "left", toPort, "positive"),
    mappedConductor("right-positive", "白线", "#ffffff", fromPort, "right", toPort, "positive"),
    mappedConductor("ground-ground", "屏蔽线", "#6b7280", fromPort, "ground", toPort, "ground")
  ];
}

function getStereoToStereoConductors(fromPort: DevicePortCapability, toPort: DevicePortCapability) {
  return [
    mappedConductor("left-left", "红线", "#dc2626", fromPort, "left", toPort, "left"),
    mappedConductor("right-right", "白线", "#ffffff", fromPort, "right", toPort, "right"),
    mappedConductor("ground-ground", "屏蔽线", "#6b7280", fromPort, "ground", toPort, "ground")
  ];
}

function getStereoToMonoConductors(fromPort: DevicePortCapability, toPort: DevicePortCapability) {
  return [
    mappedConductor("left-signal", "红线", "#dc2626", fromPort, "left", toPort, "signal"),
    mappedConductor("right-signal", "白线", "#ffffff", fromPort, "right", toPort, "signal"),
    mappedConductor("ground-ground", "屏蔽线", "#6b7280", fromPort, "ground", toPort, "ground")
  ];
}

function getBalancedToMonoConductors(fromPort: DevicePortCapability, toPort: DevicePortCapability) {
  return [
    mappedConductor("positive-signal-red", "红线", "#dc2626", fromPort, "positive", toPort, "signal"),
    mappedConductor("positive-signal-white", "白线", "#ffffff", fromPort, "positive", toPort, "signal"),
    mappedConductor("ground-ground", "屏蔽线", "#6b7280", fromPort, "ground", toPort, "ground")
  ];
}

function isStereoPortCapability(port: DevicePortCapability) {
  return ["left", "right", "ground"].every((terminalId) => port.terminals.some((terminal) => terminal.id === terminalId));
}

function getYinyiMonoToBalancedConductors(fromPort: DevicePortCapability, toPort: DevicePortCapability) {
  return [
    mappedConductor("signal-positive-red", "红线：信号接+", "#dc2626", fromPort, "signal", toPort, "positive"),
    mappedConductor("signal-positive-white", "白线：并接同一信号与+", "#ffffff", fromPort, "signal", toPort, "positive"),
    mappedConductor("ground-ground", "屏蔽接G", "#64748b", fromPort, "ground", toPort, "ground")
  ];
}

function getYinyiMonoToStereoConductors(fromPort: DevicePortCapability, toPort: DevicePortCapability) {
  return [
    mappedConductor("signal-left", "红线：单声道接L", "#dc2626", fromPort, "signal", toPort, "left"),
    mappedConductor("signal-right", "白线：同一单声道接R", "#ffffff", fromPort, "signal", toPort, "right"),
    mappedConductor("ground-ground", "屏蔽接G", "#64748b", fromPort, "ground", toPort, "ground")
  ];
}

function getBalancedToYinyiMonoConductors(fromPort: DevicePortCapability, toPort: DevicePortCapability) {
  const positive = fromPort.terminals.find((terminal) => terminal.role === "positive")?.id ?? "positive";
  const ground = fromPort.terminals.find((terminal) => terminal.role === "ground")?.id ?? "ground";
  return [
    mappedConductor("positive-signal-red", "红线：正相接阵麦信号", "#dc2626", fromPort, positive, toPort, "signal"),
    mappedConductor("ground-ground", "屏蔽接共地", "#64748b", fromPort, ground, toPort, "ground")
  ];
}

function getConnectorToYinyiMonoConductors(fromPort: DevicePortCapability, toPort: DevicePortCapability) {
  const signal = fromPort.terminals.find((terminal) => terminal.role === "signal")?.id ?? "connector";
  const ground = fromPort.terminals.find((terminal) => terminal.role === "ground")?.id ?? "connector";
  return [
    mappedConductor("signal-signal-red", "红线：信号端接阵麦信号", "#dc2626", fromPort, signal, toPort, "signal"),
    mappedConductor("ground-ground", "屏蔽接共地", "#64748b", fromPort, ground, toPort, "ground")
  ];
}

function getYinyiFormalConductorMappings(
  fromNode: InterfaceWiringNode,
  fromPort: DevicePortCapability,
  toNode: InterfaceWiringNode,
  toPort: DevicePortCapability
) {
  const toYinyiMono = toNode.productId === YINYI_DT2_PRO_PORT_PROFILE_ID &&
    toPort.terminals.some((terminal) => terminal.id === "signal");
  if (toYinyiMono) {
    return fromPort.terminals.some((terminal) => terminal.role === "positive")
      ? getBalancedToYinyiMonoConductors(fromPort, toPort)
      : getConnectorToYinyiMonoConductors(fromPort, toPort);
  }
  const fromYinyiMono = fromNode.productId === YINYI_DT2_PRO_PORT_PROFILE_ID &&
    fromPort.terminals.some((terminal) => terminal.id === "signal");
  const toBalanced = toPort.terminals.some((terminal) => terminal.role === "positive") &&
    toPort.terminals.some((terminal) => terminal.role === "negative");
  return fromYinyiMono && toBalanced ? getYinyiMonoToBalancedConductors(fromPort, toPort) : undefined;
}

function getYinyiMonoToAmplifierConductors(
  fromPort: DevicePortCapability,
  toPort: DevicePortCapability
) {
  return [
    mappedConductor("signal-positive", "所选L/R信号接+", "#dc2626", fromPort, "signal", toPort, "positive"),
    mappedConductor("ground-negative", "共地G接-", "#ffffff", fromPort, "ground", toPort, "negative"),
    mappedConductor("ground-ground", "共地G接G", "#64748b", fromPort, "ground", toPort, "ground")
  ];
}

function getRs232Conductors(fromPort: DevicePortCapability, toPort: DevicePortCapability) {
  return [
    mappedConductor("tx-rx", "TX", "#eab308", fromPort, "tx", toPort, "rx"),
    mappedConductor("rx-tx", "RX", "#22c55e", fromPort, "rx", toPort, "tx"),
    mappedConductor("ground-ground", "GND", "#111827", fromPort, "ground", toPort, "ground")
  ];
}

function getYinyiRs232Conductors(fromPort: DevicePortCapability, toPort: DevicePortCapability) {
  return [
    mappedConductor("pin1-rx", "白橙 TX", "#fbbf24", fromPort, "pin1", toPort, "rx"),
    mappedConductor("pin2-tx", "橙 RX", "#f97316", fromPort, "pin2", toPort, "tx"),
    mappedConductor("pin3-ground", "白绿 GND", "#86efac", fromPort, "pin3", toPort, "ground"),
    mappedConductor("pin6-ground", "绿 GND", "#16a34a", fromPort, "pin6", toPort, "ground")
  ];
}

function getConductorMappings(
  fromPort: DevicePortCapability,
  toPort: DevicePortCapability,
  cableType: string
): InterfaceWiringConductor[] {
  const mappings = fromPort.terminals.flatMap((fromTerminal) => {
    const toTerminal = toPort.terminals.find((candidate) => candidate.id === fromTerminal.id) ??
      (fromTerminal.role !== "pin"
        ? toPort.terminals.find((candidate) => candidate.role === fromTerminal.role)
        : undefined);
    if (!toTerminal) return [];
    return [{
      id: `${fromTerminal.id}-${toTerminal.id}`,
      label: getConductorLabel(fromTerminal, cableType),
      color: fromTerminal.color,
      fromTerminalId: fromTerminal.id,
      fromTerminalLabel: fromTerminal.label,
      toTerminalId: toTerminal.id,
      toTerminalLabel: toTerminal.label,
      confirmed: fromPort.confirmed && toPort.confirmed
    } satisfies InterfaceWiringConductor];
  });
  if (mappings.length) return mappings;
  if (!/USB/i.test(cableType) && /音频线|话筒线/i.test(cableType)) {
    return GENERIC_BALANCED_AUDIO_TERMINALS.map((fallbackTerminal) => {
      const fromTerminal = fromPort.terminals.find((terminal) => terminal.role === fallbackTerminal.role) ?? fallbackTerminal;
      const toTerminal = toPort.terminals.find((terminal) => terminal.role === fallbackTerminal.role) ?? fallbackTerminal;
      return {
        id: `${fromTerminal.id}-${toTerminal.id}`,
        label: getConductorLabel(fromTerminal, cableType),
        color: fallbackTerminal.color,
        fromTerminalId: fromTerminal.id,
        fromTerminalLabel: fromTerminal.label,
        toTerminalId: toTerminal.id,
        toTerminalLabel: toTerminal.label,
        confirmed: fromPort.confirmed && toPort.confirmed
      };
    });
  }
  return [{
    id: "assembled-cable",
    label: "成品线",
    color: "#0b5cad",
    fromTerminalId: "connector",
    fromTerminalLabel: fromPort.panelLabel,
    toTerminalId: "connector",
    toTerminalLabel: toPort.panelLabel,
    confirmed: fromPort.confirmed && toPort.confirmed
  }];
}

const logicalTerminalRoleOrder: Record<DevicePortTerminal["role"], number> = {
  positive: 0,
  negative: 1,
  ground: 2,
  signal: 3,
  pin: 4
};

export function getInterfaceWiringLogicalTerminals(terminals: DevicePortTerminal[]) {
  return terminals
    .filter((terminal) => terminal.role !== "pin")
    .slice()
    .sort((left, right) => logicalTerminalRoleOrder[left.role] - logicalTerminalRoleOrder[right.role]);
}

export function getInterfaceWiringLogicalTerminalOffset(
  terminals: DevicePortTerminal[],
  terminalId: string,
  peerDelta: { x: number; y: number },
  spacing = 12
) {
  const logicalTerminals = getInterfaceWiringLogicalTerminals(terminals);
  const terminalIndex = logicalTerminals.findIndex((terminal) => terminal.id === terminalId);
  if (terminalIndex < 0) return { x: 0, y: 0 };
  const centeredOffset = (terminalIndex - (logicalTerminals.length - 1) / 2) * spacing;
  return Math.abs(peerDelta.x) >= Math.abs(peerDelta.y)
    ? { x: 0, y: centeredOffset }
    : { x: centeredOffset, y: 0 };
}

function getConductorLabel(terminal: DevicePortTerminal, cableType: string) {
  if (cableType.includes("音箱线")) {
    if (terminal.role === "positive") return "红线";
    if (terminal.role === "negative") return "白线";
  }
  if (terminal.role === "positive") return "红线";
  if (terminal.role === "negative") return "白线";
  if (terminal.role === "ground") return "屏蔽线";
  return terminal.label;
}

export function getInterfaceWiringLayout(
  model: InterfaceWiringModel,
  availableWidth = 1120,
  bottomPaddingOverride?: number
): InterfaceWiringLayout {
  const width = Math.max(320, Math.floor(availableWidth));
  if (!model.rootNodeId || !model.nodes.length) return { width, height: 560, positions: {} };
  const sidePadding = width < 560 ? 60 : width < 720 ? 48 : 72;
  const nodeMap = new Map(model.nodes.map((node) => [node.id, node]));
  const root = nodeMap.get(model.rootNodeId)!;
  const preferredDimensions = new Map(model.nodes.map((node) => {
    const nodeWidth = getPreferredNodeWidth(node, node.id === root.id, width, sidePadding);
    return [node.id, getNodeDimensions(node, nodeWidth)];
  }));
  const bottomPadding = bottomPaddingOverride ?? (model.edges.length ? 340 : 44);
  return buildCompactInterfaceWiringLayout({
    model,
    root,
    width,
    sidePadding,
    bottomPadding,
    preferredDimensions
  });
}

export function expandInterfaceWiringLayoutRoutingChannels(
  layout: InterfaceWiringLayout,
  rootNodeId: string | undefined,
  channelGap: number
): InterfaceWiringLayout {
  const rootPosition = rootNodeId ? layout.positions[rootNodeId] : undefined;
  if (!rootPosition || channelGap <= 0) return layout;
  const rowCenters = Array.from(new Set(Object.values(layout.positions).map((position) => position.centerY)));
  const topRows = rowCenters.filter((centerY) => centerY < rootPosition.centerY).sort((left, right) => right - left);
  const bottomRows = rowCenters.filter((centerY) => centerY > rootPosition.centerY).sort((left, right) => left - right);
  const rowRank = new Map<number, number>();
  topRows.forEach((centerY, index) => rowRank.set(centerY, -(index + 1)));
  bottomRows.forEach((centerY, index) => rowRank.set(centerY, index + 1));
  const maxDepth = Math.max(topRows.length, bottomRows.length);
  const centerShift = maxDepth * channelGap;
  const positions = Object.fromEntries(Object.entries(layout.positions).map(([id, position]) => {
    const rank = rowRank.get(position.centerY) ?? 0;
    const shift = centerShift + Math.sign(rank) * Math.abs(rank) * channelGap;
    return [id, {
      ...position,
      y: position.y + shift,
      centerY: position.centerY + shift
    }];
  }));
  return {
    width: layout.width,
    height: layout.height + centerShift * 2,
    positions
  };
}

export function getInterfaceWiringPortReferenceNumbers(model: InterfaceWiringModel) {
  const references: Record<string, number> = {};
  model.edges.forEach((edge, index) => {
    const referenceNumber = index + 1;
    references[edge.fromPortId] = referenceNumber;
    references[edge.toPortId] = referenceNumber;
  });
  let nextReference = model.edges.length + 1;
  model.nodes.forEach((node) => {
    node.ports.forEach((port) => {
      if (references[port.id]) return;
      references[port.id] = nextReference;
      nextReference += 1;
    });
  });
  return references;
}

export function getInterfaceWiringUsageDeviceLabel(node: InterfaceWiringNode, port: InterfaceWiringPort) {
  if (node.category === "speaker" && port.deviceSequenceRange) {
    const { start, end } = port.deviceSequenceRange;
    const sequence = start === end ? `${start}` : `${start}-${end}`;
    return `${node.label} ${sequence}${node.quantity > 1 ? ` ×${node.quantity}` : ""}`;
  }
  return `${node.label}${node.quantity > 1 ? ` ×${node.quantity}` : ""}`;
}

export function getInterfaceWiringTableCableLabel(cableType: string) {
  return cableType.replace(/(?:\s*[×xX]\s*\d+)+\s*$/, "").trim();
}

export interface InterfaceWiringUsageRow {
  edgeId: string;
  referenceNumber: number;
  fromDevice: string;
  toDevice: string;
  fromPort: string;
  toPort: string;
  fromInterfaceType: string;
  toInterfaceType: string;
  cableType: string;
  connectionMethod: string;
  confirmed: boolean;
}

export function getInterfaceWiringUsageRows(
  model: InterfaceWiringModel,
  portReferenceNumbers = getInterfaceWiringPortReferenceNumbers(model)
): InterfaceWiringUsageRow[] {
  const nodeMap = new Map(model.nodes.map((node) => [node.id, node]));
  return model.edges.flatMap((edge, index) => {
    const fromNode = nodeMap.get(edge.fromNodeId);
    const toNode = nodeMap.get(edge.toNodeId);
    const fromPort = fromNode?.ports.find((port) => port.id === edge.fromPortId);
    const toPort = toNode?.ports.find((port) => port.id === edge.toPortId);
    if (!fromNode || !toNode || !fromPort || !toPort) return [];
    return [{
      edgeId: edge.id,
      referenceNumber: portReferenceNumbers[edge.fromPortId] ?? portReferenceNumbers[edge.toPortId] ?? index + 1,
      fromDevice: getInterfaceWiringUsageDeviceLabel(fromNode, fromPort),
      toDevice: getInterfaceWiringUsageDeviceLabel(toNode, toPort),
      fromPort: fromPort.label,
      toPort: toPort.label,
      fromInterfaceType: fromPort.interfaceType,
      toInterfaceType: toPort.interfaceType,
      cableType: getInterfaceWiringTableCableLabel(edge.cableType),
      connectionMethod: edge.connectionMethod,
      confirmed: fromPort.confirmed && toPort.confirmed
    }];
  });
}

const COMPACT_LAYOUT_ROW_GAP = 32;
const COMPACT_LAYOUT_ROOT_GAP = 64;
const COMPACT_LAYOUT_TITLE_BAND = 104;
const COMPACT_LAYOUT_MIN_HEIGHT = 620;

interface CompactLayoutItem {
  key: string;
  nodes: InterfaceWiringNode[];
  speakerBlock: boolean;
  wide: boolean;
}

interface CompactLayoutRow {
  items: CompactLayoutItem[];
}

interface FittedCompactLayoutRow {
  row: CompactLayoutRow;
  itemWidths: Map<string, number>;
  nodeDimensions: Map<string, { width: number; height: number }>;
  width: number;
  height: number;
  availableWidth: number;
  shrinkPenalty: number;
}

interface CompactLayoutBand {
  id: string;
  rows: FittedCompactLayoutRow[];
  nodeIds: Set<string>;
  height: number;
}

interface CompactLayoutSideAssignment {
  top: CompactLayoutBand[];
  bottom: CompactLayoutBand[];
  order: number;
}

function buildCompactInterfaceWiringLayout(input: {
  model: InterfaceWiringModel;
  root: InterfaceWiringNode;
  width: number;
  sidePadding: number;
  bottomPadding: number;
  preferredDimensions: Map<string, { width: number; height: number }>;
}): InterfaceWiringLayout {
  const { model, root, width, sidePadding, bottomPadding, preferredDimensions } = input;
  const rootSize = preferredDimensions.get(root.id)!;
  const packedRows = packCompactLayoutRows(model, root, width, sidePadding, preferredDimensions);
  const fittedRows = packedRows.map((row) => fitCompactLayoutRow(row, width, sidePadding, preferredDimensions)!);
  const bands = getCompactLayoutBands(fittedRows);
  const assignments = getCompactLayoutSideAssignments(bands, rootSize, bottomPadding);
  let best: {
    height: number;
    positions: Record<string, MutableLayoutPosition>;
    score: number[];
  } | undefined;

  assignments.forEach((assignment) => {
    const relativePositions = placeCompactLayoutRows({ model, root, rootSize, width, assignment });
    const rawPositions = Array.from(relativePositions.values());
    const minY = Math.min(...rawPositions.map((position) => position.y));
    const maxY = Math.max(...rawPositions.map((position) => position.y + position.height));
    const halfHeight = Math.max(
      COMPACT_LAYOUT_MIN_HEIGHT / 2,
      Math.ceil(COMPACT_LAYOUT_TITLE_BAND - minY),
      Math.ceil(maxY + bottomPadding)
    );
    const height = halfHeight * 2;
    const translated = new Map(Array.from(relativePositions, ([id, position]) => [id, {
      ...position,
      y: position.y + halfHeight,
      centerY: position.centerY + halfHeight
    }]));
    const routeMetrics = getCompactLayoutRouteMetrics(model, translated);
    const affinityPenalty = getCompactLayoutAffinityPenalty(model, translated);
    const score = [height, routeMetrics.crossings, routeMetrics.length, affinityPenalty, assignment.order];
    if (best && compareCompactLayoutScores(best.score, score) <= 0) return;
    best = {
      height,
      positions: Object.fromEntries(translated),
      score
    };
  });

  if (best) return { width, height: best.height, positions: best.positions };
  const height = COMPACT_LAYOUT_MIN_HEIGHT;
  return {
    width,
    height,
    positions: {
      [root.id]: {
        x: width / 2 - rootSize.width / 2,
        y: height / 2 - rootSize.height / 2,
        width: rootSize.width,
        height: rootSize.height,
        centerX: width / 2,
        centerY: height / 2
      }
    }
  };
}

function packCompactLayoutRows(
  model: InterfaceWiringModel,
  root: InterfaceWiringNode,
  width: number,
  sidePadding: number,
  preferredDimensions: Map<string, { width: number; height: number }>
) {
  const speakerUsableWidth = width - Math.min(sidePadding, COMPACT_SPEAKER_SIDE_PADDING) * 2;
  const speakerRows = getCompactSpeakerRows(
    model.nodes.filter(isCompactSpeakerGroup).sort(compareCompactSpeakerSequence),
    preferredDimensions,
    speakerUsableWidth
  );
  let rows: CompactLayoutRow[] = speakerRows.map((nodes, index) => ({
    items: [{
      key: `speaker-block-${index}`,
      nodes,
      speakerBlock: true,
      wide: false
    }]
  }));
  const modelOrder = new Map(model.nodes.map((node, index) => [node.id, index]));
  const unplaced = model.nodes
    .filter((node) => node.id !== root.id && !isCompactSpeakerGroup(node))
    .map((node) => ({
      key: node.id,
      nodes: [node],
      speakerBlock: false,
      wide: isWideInterfacePanelNode(node)
    } satisfies CompactLayoutItem));

  while (unplaced.length) {
    let best: {
      itemIndex: number;
      rows: CompactLayoutRow[];
      score: number[];
    } | undefined;
    unplaced.forEach((item, itemIndex) => {
      for (let targetIndex = 0; targetIndex <= rows.length; targetIndex += 1) {
        const targetRow = rows[targetIndex];
        const candidateRows = rows.map((row) => ({ items: [...row.items] }));
        if (targetRow) candidateRows[targetIndex].items.push(item);
        else candidateRows.push({ items: [item] });
        const fitted = candidateRows.map((row) => fitCompactLayoutRow(row, width, sidePadding, preferredDimensions));
        if (fitted.some((row) => !row)) continue;
        const validRows = fitted as FittedCompactLayoutRow[];
        const stackHeight = validRows.reduce((sum, row) => sum + row.height, 0) +
          COMPACT_LAYOUT_ROW_GAP * Math.max(0, validRows.length - 1);
        const shrinkPenalty = validRows.reduce((sum, row) => sum + row.shrinkPenalty, 0);
        const unusedArea = validRows.reduce(
          (sum, row) => sum + (row.availableWidth - row.width) * row.height,
          0
        );
        const targetNodes = targetRow?.items.flatMap((candidate) => candidate.nodes) ?? [];
        const connectionCount = getCompactLayoutConnectionCount(model, item.nodes, targetNodes);
        const affinityMatch = getCompactLayoutAffinityMatch(item.nodes, targetNodes);
        const score = [
          stackHeight,
          validRows.length,
          shrinkPenalty,
          unusedArea,
          -connectionCount,
          -affinityMatch,
          modelOrder.get(item.nodes[0].id) ?? itemIndex,
          targetIndex
        ];
        if (best && compareCompactLayoutScores(best.score, score) <= 0) continue;
        best = { itemIndex, rows: candidateRows, score };
      }
    });
    if (!best) break;
    rows = best.rows;
    unplaced.splice(best.itemIndex, 1);
  }
  return rows;
}

function fitCompactLayoutRow(
  row: CompactLayoutRow,
  canvasWidth: number,
  sidePadding: number,
  preferredDimensions: Map<string, { width: number; height: number }>
): FittedCompactLayoutRow | undefined {
  const speakerItems = row.items.filter((item) => item.speakerBlock);
  if (speakerItems.length > 1) return undefined;
  const wideItemCount = row.items.filter((item) => item.wide).length;
  const maxItemsWithWidePanel = canvasWidth < 560 ? 1 : LEVEL_TWO_MAX_WIDE_NODES_PER_ROW;
  if (wideItemCount && row.items.length > maxItemsWithWidePanel) return undefined;
  const pureSpeakerRow = speakerItems.length === 1 && row.items.length === 1;
  const availableWidth = canvasWidth - (pureSpeakerRow
    ? Math.min(sidePadding, COMPACT_SPEAKER_SIDE_PADDING)
    : sidePadding) * 2;
  const gapWidth = LEVEL_TWO_NODE_GAP * Math.max(0, row.items.length - 1);
  const preferredWidths = row.items.map((item) => item.nodes.reduce(
    (sum, node) => sum + preferredDimensions.get(node.id)!.width,
    0
  ));
  const minimumWidths = row.items.map((item, index) => item.speakerBlock
    ? preferredWidths[index]
    : getCompactLayoutMinimumNodeWidth(item.nodes[0], preferredWidths[index], canvasWidth));
  if (minimumWidths.reduce((sum, value) => sum + value, gapWidth) > availableWidth + 0.001) return undefined;

  const assignedWidths = [...preferredWidths];
  let overflow = assignedWidths.reduce((sum, value) => sum + value, gapWidth) - availableWidth;
  while (overflow > 0.001) {
    const capacities = assignedWidths.map((value, index) => Math.max(0, value - minimumWidths[index]));
    const totalCapacity = capacities.reduce((sum, value) => sum + value, 0);
    if (totalCapacity <= 0.001) return undefined;
    let reduced = 0;
    capacities.forEach((capacity, index) => {
      if (!capacity) return;
      const reduction = Math.min(capacity, overflow * capacity / totalCapacity);
      assignedWidths[index] -= reduction;
      reduced += reduction;
    });
    if (reduced <= 0.001) return undefined;
    overflow -= reduced;
  }

  const itemWidths = new Map<string, number>();
  const nodeDimensions = new Map<string, { width: number; height: number }>();
  let shrinkPenalty = 0;
  row.items.forEach((item, index) => {
    const assignedWidth = assignedWidths[index];
    itemWidths.set(item.key, assignedWidth);
    shrinkPenalty += Math.pow((preferredWidths[index] - assignedWidth) / Math.max(1, preferredWidths[index]), 2);
    if (item.speakerBlock) {
      item.nodes.forEach((node) => nodeDimensions.set(node.id, preferredDimensions.get(node.id)!));
      return;
    }
    const node = item.nodes[0];
    nodeDimensions.set(node.id, getNodeDimensions(node, assignedWidth));
  });
  const height = Math.max(...Array.from(nodeDimensions.values(), (size) => size.height));
  const rowWidth = assignedWidths.reduce((sum, value) => sum + value, gapWidth);
  return {
    row,
    itemWidths,
    nodeDimensions,
    width: rowWidth,
    height,
    availableWidth,
    shrinkPenalty
  };
}

function getCompactLayoutMinimumNodeWidth(node: InterfaceWiringNode, preferredWidth: number, canvasWidth: number) {
  if (node.productId === CONTROL_HOST_PORT_PROFILE_ID) return preferredWidth;
  if (node.productId === HEADSET_SPLITTER_PORT_PROFILE_ID) return Math.min(preferredWidth, 160);
  if (isWideInterfacePanelNode(node)) return Math.min(preferredWidth, canvasWidth < 560 ? 280 : 300);
  if (isCompactPortraitNode(node)) return Math.min(preferredWidth, 180);
  return Math.min(preferredWidth, 200);
}

function getCompactLayoutBands(rows: FittedCompactLayoutRow[]) {
  const speakerRows = rows
    .filter((row) => row.row.items.some((item) => item.speakerBlock))
    .sort((left, right) => getCompactLayoutSpeakerSequence(left) - getCompactLayoutSpeakerSequence(right));
  const regularRows = rows.filter((row) => !row.row.items.some((item) => item.speakerBlock));
  const bands: CompactLayoutBand[] = [];
  if (speakerRows.length) bands.push(makeCompactLayoutBand("speaker-band", speakerRows));
  regularRows.forEach((row, index) => bands.push(makeCompactLayoutBand(`equipment-row-${index}`, [row])));
  return bands;
}

function makeCompactLayoutBand(id: string, rows: FittedCompactLayoutRow[]): CompactLayoutBand {
  return {
    id,
    rows,
    nodeIds: new Set(rows.flatMap((row) => row.row.items.flatMap((item) => item.nodes.map((node) => node.id)))),
    height: rows.reduce((sum, row) => sum + row.height, 0) + COMPACT_LAYOUT_ROW_GAP * Math.max(0, rows.length - 1)
  };
}

function getCompactLayoutSpeakerSequence(row: FittedCompactLayoutRow) {
  return Math.min(...row.row.items
    .filter((item) => item.speakerBlock)
    .flatMap((item) => item.nodes)
    .map((node) => node.ports[0]?.deviceSequenceRange?.start ?? Number.MAX_SAFE_INTEGER));
}

function getCompactLayoutSideAssignments(
  bands: CompactLayoutBand[],
  rootSize: { width: number; height: number },
  bottomPadding: number
) {
  if (!bands.length) return [{ top: [], bottom: [], order: 0 } satisfies CompactLayoutSideAssignment];
  const assignments: CompactLayoutSideAssignment[] = [];
  if (bands.length <= 10) {
    for (let mask = 0; mask < 2 ** bands.length; mask += 1) {
      const top = bands.filter((_, index) => Boolean(mask & (1 << index)));
      const bottom = bands.filter((_, index) => !Boolean(mask & (1 << index)));
      if (bands.length > 1 && (!top.length || !bottom.length)) continue;
      assignments.push({ top, bottom, order: mask });
    }
  } else {
    const top: CompactLayoutBand[] = [];
    const bottom: CompactLayoutBand[] = [];
    [...bands]
      .sort((left, right) => right.height - left.height || left.id.localeCompare(right.id))
      .forEach((band, index) => {
        if (index === 0) top.push(band);
        else if (index === 1) bottom.push(band);
        else {
          const topHalf = getCompactLayoutRequiredHalfHeight([...top, band], bottom, rootSize, bottomPadding);
          const bottomHalf = getCompactLayoutRequiredHalfHeight(top, [...bottom, band], rootSize, bottomPadding);
          (topHalf <= bottomHalf ? top : bottom).push(band);
        }
      });
    assignments.push({ top, bottom, order: 0 });
  }
  const minimumHalfHeight = Math.min(...assignments.map((assignment) =>
    getCompactLayoutRequiredHalfHeight(assignment.top, assignment.bottom, rootSize, bottomPadding)
  ));
  return assignments.filter((assignment) =>
    Math.abs(getCompactLayoutRequiredHalfHeight(assignment.top, assignment.bottom, rootSize, bottomPadding) - minimumHalfHeight) < 0.001
  );
}

function getCompactLayoutRequiredHalfHeight(
  top: CompactLayoutBand[],
  bottom: CompactLayoutBand[],
  rootSize: { width: number; height: number },
  bottomPadding: number
) {
  const getOuterDepth = (items: CompactLayoutBand[]) => rootSize.height / 2 + (items.length
    ? COMPACT_LAYOUT_ROOT_GAP + items.reduce((sum, band) => sum + band.height, 0) +
      COMPACT_LAYOUT_ROW_GAP * Math.max(0, items.length - 1)
    : 0);
  return Math.max(
    COMPACT_LAYOUT_MIN_HEIGHT / 2,
    COMPACT_LAYOUT_TITLE_BAND + getOuterDepth(top),
    bottomPadding + getOuterDepth(bottom)
  );
}

function placeCompactLayoutRows(input: {
  model: InterfaceWiringModel;
  root: InterfaceWiringNode;
  rootSize: { width: number; height: number };
  width: number;
  assignment: CompactLayoutSideAssignment;
}) {
  const { model, root, rootSize, width, assignment } = input;
  const positions = new Map<string, MutableLayoutPosition>();
  positions.set(root.id, {
    x: width / 2 - rootSize.width / 2,
    y: -rootSize.height / 2,
    width: rootSize.width,
    height: rootSize.height,
    centerX: width / 2,
    centerY: 0
  });
  const rowCenters = new Map<FittedCompactLayoutRow, number>();
  const orderedTop = orderCompactLayoutBandsFromRoot(assignment.top, model, root.id);
  const orderedBottom = orderCompactLayoutBandsFromRoot(assignment.bottom, model, root.id);
  const placeSide = (bands: CompactLayoutBand[], direction: -1 | 1) => {
    let boundary = direction < 0
      ? -rootSize.height / 2 - COMPACT_LAYOUT_ROOT_GAP
      : rootSize.height / 2 + COMPACT_LAYOUT_ROOT_GAP;
    bands.forEach((band) => {
      const rows = direction < 0 && band.id === "speaker-band" ? [...band.rows].reverse() : band.rows;
      rows.forEach((row) => {
        const centerY = boundary + direction * row.height / 2;
        rowCenters.set(row, centerY);
        boundary += direction * (row.height + COMPACT_LAYOUT_ROW_GAP);
      });
    });
  };
  placeSide(orderedTop, -1);
  placeSide(orderedBottom, 1);

  const fittedRows = [...orderedTop, ...orderedBottom].flatMap((band) => band.rows);
  const itemOrders = new Map(fittedRows.map((row) => [
    row,
    getInitialCompactLayoutItemOrder(row, model, root)
  ]));
  const placeRow = (row: FittedCompactLayoutRow) => {
    const centerY = rowCenters.get(row)!;
    const items = itemOrders.get(row)!;
    let cursorX = (width - row.width) / 2;
    items.forEach((item, itemIndex) => {
      if (itemIndex) cursorX += LEVEL_TWO_NODE_GAP;
      if (item.speakerBlock) {
        [...item.nodes].sort(compareCompactSpeakerSequence).forEach((node) => {
          const size = row.nodeDimensions.get(node.id)!;
          positions.set(node.id, {
            x: cursorX,
            y: centerY - size.height / 2,
            width: size.width,
            height: size.height,
            centerX: cursorX + size.width / 2,
            centerY
          });
          cursorX += size.width + COMPACT_SPEAKER_GAP;
        });
        cursorX -= COMPACT_SPEAKER_GAP;
        return;
      }
      const node = item.nodes[0];
      const size = row.nodeDimensions.get(node.id)!;
      positions.set(node.id, {
        x: cursorX,
        y: centerY - size.height / 2,
        width: size.width,
        height: size.height,
        centerX: cursorX + size.width / 2,
        centerY
      });
      cursorX += row.itemWidths.get(item.key)!;
    });
  };
  fittedRows.forEach(placeRow);
  for (let pass = 0; pass < 2; pass += 1) {
    fittedRows.forEach((row) => {
      const previousOrder = itemOrders.get(row)!;
      const previousIndex = new Map(previousOrder.map((item, index) => [item.key, index]));
      itemOrders.set(row, [...previousOrder].sort((left, right) => {
        const difference = getCompactLayoutItemBarycenter(left, model, root, rootSize, positions) -
          getCompactLayoutItemBarycenter(right, model, root, rootSize, positions);
        return difference || (previousIndex.get(left.key)! - previousIndex.get(right.key)!);
      }));
      placeRow(row);
    });
  }
  return positions;
}

function getInitialCompactLayoutItemOrder(
  row: FittedCompactLayoutRow,
  model: InterfaceWiringModel,
  root: InterfaceWiringNode
) {
  const modelOrder = new Map(model.nodes.map((node, index) => [node.id, index]));
  return [...row.row.items].sort((left, right) => {
    const getScore = (item: CompactLayoutItem) => item.nodes.reduce(
      (sum, node) => sum + getRootPortHorizontalScore(model, root, node),
      0
    ) / item.nodes.length;
    return getScore(left) - getScore(right) ||
      (modelOrder.get(left.nodes[0].id)! - modelOrder.get(right.nodes[0].id)!);
  });
}

function getCompactLayoutItemBarycenter(
  item: CompactLayoutItem,
  model: InterfaceWiringModel,
  root: InterfaceWiringNode,
  rootSize: { width: number; height: number },
  positions: Map<string, MutableLayoutPosition>
) {
  const nodeIds = new Set(item.nodes.map((node) => node.id));
  const targets = model.edges.flatMap((edge) => {
    const itemNode = item.nodes.find((node) => edge.fromNodeId === node.id || edge.toNodeId === node.id);
    if (!itemNode) return [];
    const peerId = edge.fromNodeId === itemNode.id ? edge.toNodeId : edge.fromNodeId;
    if (nodeIds.has(peerId)) return [];
    if (peerId === root.id) {
      const normalizedX = getRootPortHorizontalScore(model, root, itemNode);
      return [positions.get(root.id)!.x + normalizedX * rootSize.width];
    }
    const peer = positions.get(peerId);
    return peer ? [peer.centerX] : [];
  });
  if (targets.length) return targets.reduce((sum, value) => sum + value, 0) / targets.length;
  return positions.get(root.id)!.centerX;
}

function orderCompactLayoutBandsFromRoot(
  bands: CompactLayoutBand[],
  model: InterfaceWiringModel,
  rootId: string
) {
  const remaining = [...bands];
  const ordered: CompactLayoutBand[] = [];
  while (remaining.length) {
    const placedNodeIds = new Set(ordered.flatMap((band) => Array.from(band.nodeIds)));
    const previousNodeIds = ordered.at(-1)?.nodeIds ?? new Set<string>();
    remaining.sort((left, right) => {
      const getScore = (band: CompactLayoutBand) =>
        getCompactLayoutConnectionCountById(model, band.nodeIds, new Set([rootId])) * 4 +
        getCompactLayoutConnectionCountById(model, band.nodeIds, previousNodeIds) * 3 +
        getCompactLayoutConnectionCountById(model, band.nodeIds, placedNodeIds);
      return getScore(right) - getScore(left) || left.id.localeCompare(right.id);
    });
    ordered.push(remaining.shift()!);
  }
  return ordered;
}

function getCompactLayoutConnectionCount(
  model: InterfaceWiringModel,
  leftNodes: InterfaceWiringNode[],
  rightNodes: InterfaceWiringNode[]
) {
  return getCompactLayoutConnectionCountById(
    model,
    new Set(leftNodes.map((node) => node.id)),
    new Set(rightNodes.map((node) => node.id))
  );
}

function getCompactLayoutConnectionCountById(
  model: InterfaceWiringModel,
  leftIds: Set<string>,
  rightIds: Set<string>
) {
  if (!leftIds.size || !rightIds.size) return 0;
  return model.edges.filter((edge) => edge.kind !== "jumper" && (
    (leftIds.has(edge.fromNodeId) && rightIds.has(edge.toNodeId)) ||
    (leftIds.has(edge.toNodeId) && rightIds.has(edge.fromNodeId))
  )).length;
}

function getCompactLayoutAffinityMatch(leftNodes: InterfaceWiringNode[], rightNodes: InterfaceWiringNode[]) {
  const rightAffinities = new Set(rightNodes.map(getInterfaceWiringRowAffinity).filter(Boolean));
  return leftNodes.filter((node) => {
    const affinity = getInterfaceWiringRowAffinity(node);
    return affinity && rightAffinities.has(affinity);
  }).length;
}

function getCompactLayoutRouteMetrics(
  model: InterfaceWiringModel,
  positions: Map<string, MutableLayoutPosition>
) {
  const segments = model.edges.flatMap((edge) => {
    if (edge.kind === "jumper" || edge.fromNodeId === edge.toNodeId) return [];
    const from = positions.get(edge.fromNodeId);
    const to = positions.get(edge.toNodeId);
    return from && to ? [{ edge, from, to }] : [];
  });
  const length = segments.reduce((sum, segment) => sum + Math.hypot(
    segment.to.centerX - segment.from.centerX,
    segment.to.centerY - segment.from.centerY
  ), 0);
  let crossings = 0;
  segments.forEach((left, index) => {
    segments.slice(index + 1).forEach((right) => {
      if ([left.edge.fromNodeId, left.edge.toNodeId].some((id) =>
        id === right.edge.fromNodeId || id === right.edge.toNodeId
      )) return;
      if (compactLayoutSegmentsCross(left.from, left.to, right.from, right.to)) crossings += 1;
    });
  });
  return { length, crossings };
}

function compactLayoutSegmentsCross(
  a: { centerX: number; centerY: number },
  b: { centerX: number; centerY: number },
  c: { centerX: number; centerY: number },
  d: { centerX: number; centerY: number }
) {
  const orientation = (
    first: { centerX: number; centerY: number },
    second: { centerX: number; centerY: number },
    third: { centerX: number; centerY: number }
  ) => (second.centerX - first.centerX) * (third.centerY - first.centerY) -
    (second.centerY - first.centerY) * (third.centerX - first.centerX);
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return abC * abD < 0 && cdA * cdB < 0;
}

function getCompactLayoutAffinityPenalty(
  model: InterfaceWiringModel,
  positions: Map<string, MutableLayoutPosition>
) {
  const groups = new Map<InterfaceWiringRowAffinity, InterfaceWiringNode[]>();
  model.nodes.forEach((node) => {
    const affinity = getInterfaceWiringRowAffinity(node);
    if (affinity) groups.set(affinity, [...(groups.get(affinity) ?? []), node]);
  });
  return Array.from(groups.values()).reduce((penalty, nodes) => {
    for (let index = 0; index < nodes.length; index += 1) {
      for (const peer of nodes.slice(index + 1)) {
        penalty += Math.abs(positions.get(nodes[index].id)!.centerY - positions.get(peer.id)!.centerY);
      }
    }
    return penalty;
  }, 0);
}

function compareCompactLayoutScores(left: number[], right: number[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (Math.abs(difference) > 0.0001) return difference;
  }
  return 0;
}

function isCompactSpeakerGroup(node: InterfaceWiringNode) {
  return node.category === "speaker" && node.ports.length === 1 && Boolean(node.ports[0]?.deviceSequenceRange);
}

function isCompactPortraitNode(node: InterfaceWiringNode) {
  if (isCompactSpeakerGroup(node)) return true;
  const aspectRatio = getDevicePortProfile(node.productId)?.interfacePanel?.aspectRatio;
  return typeof aspectRatio === "number" && aspectRatio < 1;
}

function isWideInterfacePanelNode(node: InterfaceWiringNode) {
  const aspectRatio = getDevicePortProfile(node.productId)?.interfacePanel?.aspectRatio;
  return typeof aspectRatio === "number" && aspectRatio >= 2.4;
}

type InterfaceWiringRowAffinity = "speakerHanging" | "recordingConference" | "computer" | "microphoneWireless";

function getInterfaceWiringRowAffinity(node: InterfaceWiringNode): InterfaceWiringRowAffinity | undefined {
  if (isCompactSpeakerGroup(node) || node.productId === HANGING_MIC_PRODUCT_ID) return "speakerHanging";
  if ([RECORDING_HOST_PORT_PROFILE_ID, RECORDING_CAMERA_PORT_PROFILE_ID, VIDEO_CONFERENCE_TERMINAL_PORT_PROFILE_ID].includes(node.productId)) {
    return "recordingConference";
  }
  if ([COMPUTER_REAR_PANEL_PORT_PROFILE_ID, OPS_ALL_IN_ONE_PORT_PROFILE_ID, LAPTOP_PORT_PROFILE_ID].includes(node.productId)) {
    return "computer";
  }
  if (
    node.category === "microphone" ||
    node.productId === WIRELESS_RECEIVER_PORT_PROFILE_ID ||
    node.productId === EXTERNAL_WIRED_MICROPHONE_PORT_PROFILE_ID
  ) {
    return "microphoneWireless";
  }
  return undefined;
}

const COMPACT_SPEAKER_SIDE_PADDING = 32;
const MAX_COMPACT_SPEAKER_ICONS_PER_ROW = 8;

function compareCompactSpeakerSequence(left: InterfaceWiringNode, right: InterfaceWiringNode) {
  return (left.ports[0]?.deviceSequenceRange?.start ?? Number.MAX_SAFE_INTEGER) -
    (right.ports[0]?.deviceSequenceRange?.start ?? Number.MAX_SAFE_INTEGER);
}

function getCompactSpeakerRows(
  nodes: InterfaceWiringNode[],
  dimensions: Map<string, { width: number; height: number }>,
  usableWidth: number
) {
  const rows: InterfaceWiringNode[][] = [];
  let row: InterfaceWiringNode[] = [];
  let rowWidth = 0;
  nodes.forEach((node) => {
    const nodeWidth = dimensions.get(node.id)!.width;
    const candidateWidth = rowWidth + (row.length ? COMPACT_SPEAKER_GAP : 0) + nodeWidth;
    if (row.length && (row.length >= MAX_COMPACT_SPEAKER_ICONS_PER_ROW || candidateWidth > usableWidth)) {
      rows.push(row);
      row = [node];
      rowWidth = nodeWidth;
    } else {
      row.push(node);
      rowWidth = candidateWidth;
    }
  });
  if (row.length) rows.push(row);
  return rows;
}

function getRootPortHorizontalScore(
  model: InterfaceWiringModel,
  root: InterfaceWiringNode,
  child: InterfaceWiringNode
) {
  const panel = getDevicePortProfile(root.productId)?.interfacePanel;
  const scores = model.edges.flatMap((edge) => {
    const rootPortId = edge.fromNodeId === root.id && edge.toNodeId === child.id
      ? edge.fromPortId
      : edge.toNodeId === root.id && edge.fromNodeId === child.id
        ? edge.toPortId
        : undefined;
    if (!rootPortId) return [];
    const rootPortIndex = root.ports.findIndex((port) => port.id === rootPortId);
    const rootPort = root.ports[rootPortIndex];
    if (!rootPort) return [];
    const baseCapabilityId = rootPort.capabilityId.replace(/-\d+$/, "");
    const panelAnchor = panel?.portAnchors[rootPort.capabilityId] ?? panel?.portAnchors[baseCapabilityId];
    if (panelAnchor) return [panelAnchor.x];
    return [(rootPortIndex + 1) / (root.ports.length + 1)];
  });
  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0.5;
}

function getNodeDimensions(node: InterfaceWiringNode, width: number) {
  const interfacePanel = getDevicePortProfile(node.productId)?.interfacePanel;
  const unlocatedPortCount = node.ports.filter((port, index) => !(
    interfacePanel && getInterfacePanelPortAnchor(interfacePanel, port.capabilityId, index, node.ports.length)
  )).length;
  const fallbackRows = Math.ceil(unlocatedPortCount / 4);
  const imageHeight = interfacePanel ? getInterfacePanelCompositeSize(node, interfacePanel, width).height : 0;
  if (node.productId === CONTROL_HOST_PORT_PROFILE_ID && interfacePanel) {
    return {
      width,
      height: Math.max(30 + imageHeight + 4, width * CONTROL_HOST_NODE_HEIGHT / CONTROL_HOST_NODE_WIDTH)
    };
  }
  return {
    width,
    height: interfacePanel
      ? 30 + imageHeight + (fallbackRows ? 64 + (fallbackRows - 1) * 22 : 30)
      : node.ports.length
        ? 88 + Math.max(0, fallbackRows - 1) * 22
        : 48
  };
}

function getPreferredNodeWidth(node: InterfaceWiringNode, isRoot: boolean, canvasWidth: number, sidePadding: number) {
  const maxWidth = canvasWidth - sidePadding * 2;
  const interfacePanel = getDevicePortProfile(node.productId)?.interfacePanel;
  if (isRoot) {
    const preferred = interfacePanel && interfacePanel.aspectRatio < 2.4 ? 420 : 760;
    return Math.min(preferred, maxWidth);
  }
  if (node.productId === HEADSET_SPLITTER_PORT_PROFILE_ID) {
    return Math.min(HEADSET_SPLITTER_NODE_WIDTH, maxWidth);
  }
  if (node.productId === CONTROL_HOST_PORT_PROFILE_ID) {
    return Math.min(CONTROL_HOST_NODE_WIDTH, maxWidth);
  }
  if (isCompactSpeakerGroup(node)) return Math.min(COMPACT_SPEAKER_NODE_WIDTH, maxWidth);
  const wideInterfacePanel = Boolean(interfacePanel && isWideInterfacePanelNode(node));
  const levelTwoMaxWidth = wideInterfacePanel
    ? LEVEL_TWO_MAX_WIDE_NODE_WIDTH
    : LEVEL_TWO_MAX_NODE_WIDTH;
  const levelWidthCap = Math.min(levelTwoMaxWidth, maxWidth);
  if (!interfacePanel) return Math.min(300, levelWidthCap);
  if (wideInterfacePanel) return Math.min(520, levelWidthCap);
  if (interfacePanel.aspectRatio < 0.9) return Math.min(280, levelWidthCap);
  return Math.min(340, levelWidthCap);
}

export function getInterfacePanelImageRect(
  node: InterfaceWiringNode,
  position: MutableLayoutPosition
): InterfacePanelImageRect | undefined {
  const interfacePanel = getDevicePortProfile(node.productId)?.interfacePanel;
  if (!interfacePanel) return undefined;
  const size = getInterfacePanelCompositeSize(node, interfacePanel, position.width);
  const x = position.x + (position.width - size.width) / 2;
  const y = position.y + 30;
  return {
    x,
    y,
    width: size.width,
    height: size.height,
    unitRects: size.repeatCount > 1
      ? Array.from({ length: size.repeatCount }, (_, index) => ({
          x,
          y: y + index * (size.unitHeight + size.gap),
          width: size.width,
          height: size.unitHeight
        }))
      : undefined
  };
}

export function getInterfacePanelPortAnchor(
  panelProfile: DeviceInterfacePanel,
  capabilityId: string,
  portIndex: number,
  portCount: number
) {
  const exact = panelProfile.portAnchors[capabilityId];
  if (exact) return exact;
  const baseId = capabilityId.startsWith("terminals-")
    ? "terminals"
    : capabilityId.replace(/-\d+$/, "");
  const base = panelProfile.portAnchors[baseId];
  if (!base) return undefined;
  if (panelProfile.assetKey === "lineArrayConverter") {
    const unitMatch = capabilityId.match(/-(\d+)$/);
    const unitIndex = Math.max(1, Number(unitMatch?.[1] ?? 1));
    const unitCount = Math.max(unitIndex, Math.ceil(portCount / LINE_ARRAY_CONVERTER_PORTS_PER_UNIT));
    if (unitCount === 1) return base;
    const compositeHeight = unitCount + REPEATED_INTERFACE_PANEL_GAP_RATIO * (unitCount - 1);
    const unitTop = (unitIndex - 1) * (1 + REPEATED_INTERFACE_PANEL_GAP_RATIO);
    const normalizeY = (y: number) => (unitTop + y) / compositeHeight;
    return {
      ...base,
      y: normalizeY(base.y),
      terminalAnchors: base.terminalAnchors
        ? Object.fromEntries(Object.entries(base.terminalAnchors).map(([id, point]) => [id, {
            x: point.x,
            y: normalizeY(point.y)
          }]))
        : undefined
    };
  }
  if (panelProfile.assetKey === "passiveSpeaker" && baseId === "terminals" && portCount > 1) {
    const rowCount = Math.ceil(portCount / 2);
    const column = portIndex % 2;
    const row = Math.floor(portIndex / 2);
    const x = column === 0 ? 0.44 : 0.56;
    const y = rowCount === 1 ? 0.64 : 0.6 + (row / (rowCount - 1)) * 0.08;
    return {
      ...base,
      x,
      y,
      terminalAnchors: {
        positive: { x: x + 0.03, y },
        negative: { x: x - 0.03, y }
      }
    };
  }
  const repeatedOffset = portCount > 1 ? (portIndex - (portCount - 1) / 2) * 0.012 : 0;
  return {
    ...base,
    x: Math.max(0.02, Math.min(0.98, base.x + repeatedOffset)),
    terminalAnchors: base.terminalAnchors
      ? Object.fromEntries(Object.entries(base.terminalAnchors).map(([id, point]) => [id, {
          x: Math.max(0.02, Math.min(0.98, point.x + repeatedOffset)),
          y: point.y
        }]))
      : undefined
  };
}

export function getInterfaceWiringFallbackPortLabelTop(
  position: MutableLayoutPosition,
  imageRect: InterfacePanelImageRect | undefined
) {
  return imageRect ? imageRect.y - position.y + imageRect.height + 5 : 28;
}

export function getInterfaceWiringFallbackPortMarker(
  node: InterfaceWiringNode,
  portIndex: number,
  position: MutableLayoutPosition,
  imageRect: InterfacePanelImageRect | undefined,
  panelProfile: DeviceInterfacePanel | undefined
) {
  const unlocatedIndexes = node.ports.flatMap((port, index) => {
    const anchor = panelProfile
      ? getInterfacePanelPortAnchor(panelProfile, port.capabilityId, index, node.ports.length)
      : undefined;
    return anchor ? [] : [index];
  });
  const fallbackIndex = Math.max(0, unlocatedIndexes.indexOf(portIndex));
  const row = Math.floor(fallbackIndex / 4);
  const rowStart = row * 4;
  const columnsInRow = Math.min(4, unlocatedIndexes.length - rowStart);
  const column = fallbackIndex - rowStart;
  return {
    left: ((column + 1) / (columnsInRow + 1)) * position.width,
    top: getInterfaceWiringFallbackPortLabelTop(position, imageRect) + 24 + row * 22
  };
}

export function getInterfaceWiringPortDrawingAnchor(
  node: InterfaceWiringNode,
  portId: string,
  position: MutableLayoutPosition,
  terminalId?: string,
  peer?: MutableLayoutPosition
) {
  const index = Math.max(0, node.ports.findIndex((port) => port.id === portId));
  const port = node.ports[index];
  const panelProfile = getDevicePortProfile(node.productId)?.interfacePanel;
  const imageRect = panelProfile ? getInterfacePanelImageRect(node, position) : undefined;
  const visualAnchor = panelProfile && port
    ? getInterfacePanelPortAnchor(panelProfile, port.capabilityId, index, node.ports.length)
    : undefined;
  if (imageRect && visualAnchor) {
    const terminalAnchor = terminalId ? visualAnchor.terminalAnchors?.[terminalId] : undefined;
    if (terminalAnchor) {
      return {
        x: imageRect.x + terminalAnchor.x * imageRect.width,
        y: imageRect.y + terminalAnchor.y * imageRect.height
      };
    }
    const basePoint = {
      x: imageRect.x + visualAnchor.x * imageRect.width,
      y: imageRect.y + visualAnchor.y * imageRect.height
    };
    const offset = terminalId && port
      ? getInterfaceWiringLogicalTerminalOffset(port.terminals, terminalId, getDrawingPeerDelta(basePoint, peer))
      : { x: 0, y: 0 };
    return { x: basePoint.x + offset.x, y: basePoint.y + offset.y };
  }
  const fallback = getInterfaceWiringFallbackPortMarker(node, index, position, imageRect, panelProfile);
  const basePoint = { x: position.x + fallback.left, y: position.y + fallback.top };
  const offset = terminalId && port
    ? getInterfaceWiringLogicalTerminalOffset(port.terminals, terminalId, getDrawingPeerDelta(basePoint, peer))
    : { x: 0, y: 0 };
  return { x: basePoint.x + offset.x, y: basePoint.y + offset.y };
}

function getDrawingPeerDelta(point: { x: number; y: number }, peer?: MutableLayoutPosition) {
  return peer
    ? { x: peer.centerX - point.x, y: peer.centerY - point.y }
    : { x: 0, y: -1 };
}

function getInterfacePanelImageSize(aspectRatio: number, nodeWidth: number) {
  const availableWidth = Math.max(120, nodeWidth - 20);
  const width = Math.min(availableWidth, 220 * aspectRatio);
  return {
    width,
    height: width / aspectRatio
  };
}

function getInterfacePanelCompositeSize(
  node: InterfaceWiringNode,
  interfacePanel: DeviceInterfacePanel,
  nodeWidth: number
) {
  const unitSize = getInterfacePanelImageSize(interfacePanel.aspectRatio, nodeWidth);
  const repeatCount = interfacePanel.assetKey === "lineArrayConverter" ? Math.max(1, node.quantity) : 1;
  const gap = repeatCount > 1 ? unitSize.height * REPEATED_INTERFACE_PANEL_GAP_RATIO : 0;
  return {
    width: unitSize.width,
    height: unitSize.height * repeatCount + gap * (repeatCount - 1),
    unitHeight: unitSize.height,
    repeatCount,
    gap
  };
}

function getConnectionMethod(
  line: ConnectionLine,
  fromPort: DevicePortCapability,
  toPort: DevicePortCapability,
  toProductId?: string
) {
  if (line.cableType.includes("USB")) return "USB直连；USB Audio一进一出；内置232串口信号，可用于连接调试软件";
  if (toProductId === YINYI_DT2_PRO_PORT_PROFILE_ID && toPort.terminals.some((terminal) => terminal.id === "signal")) {
    const arrayMicEnd = "阵麦端红线接LINE IN所选L或R，屏蔽接同组G，白线绝缘不接";
    if (/XLR|卡侬/i.test(`${fromPort.interfaceType} ${fromPort.panelLabel}`)) {
      return `线缆卡侬母头插接设备卡侬公口，接头端红接2（+）、白接3（-）、屏蔽接1（G）；${arrayMicEnd}`;
    }
    if (/6\.35/i.test(`${fromPort.interfaceType} ${fromPort.panelLabel}`)) {
      return `6.35 TS端TIP接红线、SLEEVE接屏蔽，白线两端不接；${arrayMicEnd}`;
    }
    if (fromPort.terminals.some((terminal) => terminal.role === "positive")) {
      return `源设备平衡端红接+、白接-、屏蔽接G；${arrayMicEnd}`;
    }
    return `源设备红线接信号端、屏蔽接地端，白线不接；${arrayMicEnd}`;
  }
  if (fromPort.id === "xlr" && /卡侬|XLR/i.test(line.fromPort)) {
    return toPort.id.startsWith("mic")
      ? "线缆卡侬母头插接设备卡侬公口，按2=+、3=-、1=G接处理器MIC IN"
      : `线缆卡侬母头插接设备卡侬公口，按2=+、3=-、1=G接LINE IN。${WIRED_MIC_LINE_IN_POWER_NOTE}`;
  }
  if (fromPort.interfaceType.includes("RJ45") && toPort.interfaceType.includes("RJ45")) return "RJ45直连";
  if (line.cableType.includes("音箱线")) return "保持正负极一致";
  if (hasStereoTerminals(fromPort) && hasStereoTerminals(toPort)) {
    return fromPort.interfaceType.includes("3.5mm") && toPort.interfaceType.includes("3.5mm")
      ? "成品双头3.5mm线，L/R/G一一对应"
      : "L/R/G一一对应";
  }
  if (line.cableType.includes("音频")) return "按输入/输出方向连接";
  return "按标注接口直连";
}

function hasStereoTerminals(port: DevicePortCapability) {
  const terminalIds = new Set(port.terminals.map((terminal) => terminal.id));
  return terminalIds.has("left") && terminalIds.has("right") && terminalIds.has("ground");
}

function normalizeCableType(value: string) {
  if (/超五类|超六类|T568B/i.test(value)) return "网线（T568B）";
  return value.replace(/（Line (?:In|Out)[^）]*）/gi, "").trim();
}

function getQuantityFromText(value: string) {
  const match = value.match(/[×xX]\s*(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function stripQuantity(value: string) {
  return value.replace(/\s*[×xX]\s*\d+\s*$/, "").trim();
}

function isProcessorName(value: string) {
  return value.includes("处理器") || value.includes("智能音频处理主机");
}

function usesSharedComputerRearPanel(value: string) {
  return value === "讲台电脑" || /一体机|会议屏|CLASSIN/i.test(value);
}

function isSpeakerName(value: string) {
  return /吸顶音箱|壁挂音箱|音柱|无源音箱|有源音箱/.test(value);
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
