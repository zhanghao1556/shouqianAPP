import type { AppBrandId } from "../brand";
import type {
  ClassroomProfile,
  ConnectionLine,
  DevicePortCapability,
  GeneratedOutputs,
  InterfacePortDirection,
  InterfaceWiringEdge,
  InterfaceWiringFinding,
  InterfaceWiringModel,
  InterfaceWiringNode
} from "../types";
import { getExistingMicInputDemand, HANGING_MIC_PRODUCT_ID } from "./hangingMicRules";
import { LINE_ARRAY_PRODUCT_ID } from "./lineArrayRules";
import { EXTERNAL_AMPLIFIER_PRODUCT_ID } from "./speakerRules";
import {
  getDevicePortCapability,
  getDevicePortProfile,
  getDevicePortsByPrefix,
  PASSIVE_SPEAKER_PORT_PROFILE_ID,
  PROCESSOR_AJ200_PORT_PROFILE_ID,
  PROCESSOR_AJ350_PORT_PROFILE_ID,
  PROCESSOR_AJ600_PORT_PROFILE_ID,
  WIRELESS_RECEIVER_PORT_PROFILE_ID
} from "./devicePortCatalog";
import {
  AUDIO_PROCESSOR_HOST_PRODUCT_ID,
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

export interface InterfaceWiringBuildInput {
  profile: ClassroomProfile;
  outputs: GeneratedOutputs;
  brandId: AppBrandId;
}

interface SystemState {
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
  fromNode: InterfaceWiringNode;
  fromPort: DevicePortCapability;
  toNode: InterfaceWiringNode;
  toPort: DevicePortCapability;
  cableType: string;
  connectionMethod: string;
  signalDirection?: InterfaceWiringEdge["signalDirection"];
  quantity?: number;
}

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

const processorProductIds: Record<CandidateProcessor, string> = {
  AJ200: PROCESSOR_AJ200_PORT_PROFILE_ID,
  AJ350: PROCESSOR_AJ350_PORT_PROFILE_ID,
  AJ600: PROCESSOR_AJ600_PORT_PROFILE_ID
};

const candidateOwnedConnectionPrefixes = [
  "array-mic-processor-network-",
  "line-array-converter-",
  "line-array-supplement-",
  "hanging-mic-processor-",
  "small-disc-01-cascade-",
  "small-disc-03-cascade-"
];

const generatedSpeakerConnectionPrefixes = [
  "dt-speaker-",
  "amplifier-speaker-",
  "small-disc-01-wall-speakers",
  "processor-speaker-direct",
  "processor-amplifier-speakers"
];

export function buildInterfaceWiringModel(input: InterfaceWiringBuildInput): InterfaceWiringModel {
  if (input.brandId !== "yinman") {
    return {
      title: "接口接线图拟调整预览",
      status: "review",
      nodes: [],
      edges: [],
      findings: [{
        code: "brand.yinman-only",
        severity: "info",
        title: "音曼内部校准",
        message: "本轮接口接线候选仅用于音曼开发页。"
      }],
      generatedFrom: "calibrationCandidate"
    };
  }
  return new CandidateWiringBuilder(input.profile, input.outputs).build();
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
    private readonly outputs: GeneratedOutputs
  ) {}

  build(): InterfaceWiringModel {
    const state = this.getSystemState();
    this.prepareCandidateMicrophoneSystem(state);
    this.prepareSmallDiscSystem(state);
    this.addFormalConnections();
    this.addSpeakerRoutes(state);
    this.addKnownBlockingFindings();
    const rootNodeId = this.finalizeHierarchy();
    const status = this.findings.some((item) => item.severity === "hard")
      ? "blocked"
      : this.findings.some((item) => item.severity === "review")
        ? "review"
        : "ready";
    return {
      title: "接口接线图拟调整预览",
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
      ring08Count: Math.max(quantity(PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID), pointCount("existingArray")),
      lineArrayCount,
      supplementCount,
      hangingCount: Math.max(quantity(HANGING_MIC_PRODUCT_ID), pointCount("hangingMic")),
      smallDisc01Count: quantity(SMALL_DISC_01_PRODUCT_ID),
      smallDisc02Count: lineArrayCount > 0 ? 0 : Math.max(quantity(SMALL_DISC_02_PRODUCT_ID), pointCount("smallDisc02")),
      smallDisc03Count: Math.max(quantity(SMALL_DISC_03_PRODUCT_ID), pointCount("smallDisc03"))
    };
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
    if (state.ring08Count > 0) return "AJ350";
    if (state.lineArrayCount > 1) return "AJ600";
    if (state.lineArrayCount === 1 && state.supplementCount > 0) {
      const newWirelessDemand = this.outputs.productSelection.some((item) => item.productId === "WIRELESS-HANDHELD" && item.quantity > 0) ? 1 : 0;
      const micDemand = 2 + getExistingMicInputDemand(this.profile) + newWirelessDemand;
      return micDemand > 2 ? "AJ600" : "AJ200";
    }
    if (state.lineArrayCount === 1) return "AJ350";
    const formalProcessor = this.outputs.productSelection.find((item) => item.productId === AUDIO_PROCESSOR_HOST_PRODUCT_ID)?.name ?? "";
    return formalProcessor.includes("六麦") ? "AJ600" : formalProcessor.includes("高性能") ? "AJ350" : "AJ200";
  }

  private recordProcessorDifference() {
    const formalName = this.outputs.productSelection.find((item) => item.productId === AUDIO_PROCESSOR_HOST_PRODUCT_ID)?.name;
    if (!formalName || !this.candidateProcessor) return;
    const formalModel = formalName.includes("高性能") ? "AJ350" : formalName.includes("六麦") ? "AJ600" : formalName.includes("双麦") ? "AJ200" : undefined;
    if (formalModel && formalModel !== this.candidateProcessor) {
      this.addFinding({
        code: "processor.candidate-difference",
        severity: "info",
        title: "候选处理器调整",
        message: `正式输出当前映射为${formalModel}，接口接线候选按已确认规则使用${this.candidateProcessor}。`,
        nodeId: "processor"
      });
    }
  }

  private addRing08Connections(processor: InterfaceWiringNode, count: number) {
    const micProfile = getDevicePortProfile(PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID)!;
    const mic = this.ensureNode({
      id: "ring08",
      productId: PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID,
      label: micProfile.customerName,
      internalModel: micProfile.internalModel,
      category: "microphone",
      quantity: count
    });
    this.explicitParents.set(mic.id, processor.id);
    const supported = Math.min(2, count);
    for (let index = 1; index <= supported; index += 1) {
      const source = this.unitPort(PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID, "lan", index, count);
      const target = this.requirePort(this.processorProductId!, index === 1 ? "a1" : "a2");
      this.addConnection({
        id: `ring08-aj350-${index}`,
        fromNode: mic,
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
        title: "RING08接口超过上限",
        message: `AJ350只有A1、A2两个RING08接口，当前${count}只无法由一台主机接入，建议更换设备或拆分系统。`,
        nodeId: processor.id
      });
    }
  }

  private addLineArrayConnections(processor: InterfaceWiringNode, state: SystemState) {
    const lineProfile = getDevicePortProfile(LINE_ARRAY_PRODUCT_ID)!;
    const lineMic = this.ensureNode({
      id: "line-array",
      productId: LINE_ARRAY_PRODUCT_ID,
      label: lineProfile.customerName,
      internalModel: lineProfile.internalModel,
      category: "microphone",
      quantity: state.lineArrayCount
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
      this.explicitParents.set(lineMic.id, converter.id);
      this.addFinding({
        code: "line-array-converter.output-labels",
        severity: "review",
        title: "线阵拓展器接口待补录",
        message: "当前实物图只确认LINK，两个输出接口的面板原始名称和物理形式需用户手工补充。",
        nodeId: converter.id
      });
    } else {
      this.explicitParents.set(lineMic.id, processor.id);
    }

    if (directCount > 0) {
      const processorPortId = this.candidateProcessor === "AJ350" ? "amic" : "extmic";
      this.addConnection({
        id: "line-array-direct-1",
        fromNode: lineMic,
        fromPort: this.unitPort(LINE_ARRAY_PRODUCT_ID, "rj45", 1, state.lineArrayCount),
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
        this.addConnection({
          id: `line-array-converter-link-${converterIndex}`,
          fromNode: lineMic,
          fromPort: this.unitPort(LINE_ARRAY_PRODUCT_ID, "rj45", lineUnitIndex, state.lineArrayCount),
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
    const newWirelessDemand = this.outputs.productSelection.some((item) => item.productId === "WIRELESS-HANDHELD" && item.quantity > 0) ? 1 : 0;
    const totalMicDemand = convertedCount * 2 + getExistingMicInputDemand(this.profile) + newWirelessDemand;
    if (totalMicDemand > micCapacity) {
      this.addFinding({
        code: "processor.total-mic-capacity",
        severity: "hard",
        title: "处理器MIC总需求超过上限",
        message: `当前需要${totalMicDemand}个MIC输入，${this.candidateProcessor}只有${micCapacity}个，无法生成超额接口连线，建议更换设备。`,
        nodeId: processor.id
      });
    }
  }

  private addHangingMicrophoneConnections(processor: InterfaceWiringNode, count: number) {
    const profile = getDevicePortProfile(HANGING_MIC_PRODUCT_ID)!;
    const microphones = this.ensureNode({
      id: "hanging-microphones",
      productId: HANGING_MIC_PRODUCT_ID,
      label: profile.customerName,
      internalModel: profile.internalModel,
      category: "microphone",
      quantity: count
    });
    this.explicitParents.set(microphones.id, processor.id);
    const micPorts = getDevicePortsByPrefix(this.processorProductId!, "mic");
    for (let index = 1; index <= count; index += 1) {
      const target = micPorts[index - 1];
      if (!target) {
        this.addFinding({
          code: `hanging-mic.capacity.${index}`,
          severity: "hard",
          title: "吊麦接口超过上限",
          message: `第${index}只吊麦没有可用MIC输入，建议更换设备。`,
          nodeId: processor.id
        });
        continue;
      }
      this.addConnection({
        id: `hanging-mic-${index}`,
        fromNode: microphones,
        fromPort: this.unitPort(HANGING_MIC_PRODUCT_ID, "xlr", index, count),
        toNode: processor,
        toPort: target,
        cableType: "麦克风线",
        connectionMethod: "XLR-3按G/+/-接线；处理器开启48V"
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

  private addFormalConnections() {
    this.outputs.connectionLines.forEach((line) => {
      if (candidateOwnedConnectionPrefixes.some((prefix) => line.id.startsWith(prefix))) return;
      if (generatedSpeakerConnectionPrefixes.some((prefix) => line.id.startsWith(prefix))) return;
      if (this.isPowerConnection(line)) return;
      const fromNode = this.ensureNode(this.describeDevice(line.fromDevice));
      const toNode = this.ensureNode(this.describeDevice(line.toDevice));
      const fromPort = this.resolvePort(fromNode, line.fromPort, "output", line.id);
      const toPort = this.resolvePort(toNode, line.toPort, "input", line.id);
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
        connectionMethod: getConnectionMethod(line, fromPort, toPort),
        signalDirection: line.cableType.includes("USB") ? "bidirectional" : "fromTo"
      });
    });
  }

  private addSpeakerRoutes(state: SystemState) {
    const speakerSelection = this.outputs.productSelection.find((item) => item.category === "speaker" && item.quantity > 0);
    if (!speakerSelection) return;
    const speakers = this.ensureNode({
      id: "speakers",
      productId: PASSIVE_SPEAKER_PORT_PROFILE_ID,
      label: speakerSelection.name,
      category: "speaker",
      quantity: speakerSelection.quantity
    });
    const amplifierSelection = this.outputs.productSelection.find((item) => item.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID && item.quantity > 0);
    const usesSmallDisc01 = state.smallDisc01Count > 0;
    const directCount = usesSmallDisc01 ? 0 : Math.min(8, speakerSelection.quantity);
    const amplifierCount = usesSmallDisc01 ? speakerSelection.quantity : Math.max(0, speakerSelection.quantity - directCount);
    if (directCount > 0) {
      const processor = this.nodes.get("processor");
      if (processor) {
        this.connectSpeakerOutputs(processor, speakers, directCount, "processor-speakers");
        this.explicitParents.set(speakers.id, processor.id);
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
            connectionMethod: "模拟音频输出接功放输入"
          });
        }
      }
      this.connectSpeakerOutputs(amp, speakers, amplifierCount || speakerSelection.quantity, "amplifier-speakers");
      this.explicitParents.set(speakers.id, amp.id);
    }
  }

  private connectSpeakerOutputs(
    source: InterfaceWiringNode,
    speakers: InterfaceWiringNode,
    quantity: number,
    idPrefix: string
  ) {
    if (quantity <= 0) return;
    const available = getDevicePortsByPrefix(source.productId, "spk").filter((port) => !this.isPortOccupied(source.id, port.id));
    if (!available.length) {
      this.addFinding({
        code: `${idPrefix}.no-output`,
        severity: "hard",
        title: "音箱输出接口不足",
        message: "当前设备没有可用功放输出，无法生成音箱连线，建议更换设备。",
        nodeId: source.id
      });
      return;
    }
    const usedPortCount = Math.min(quantity, available.length);
    const base = Math.floor(quantity / usedPortCount);
    const remainder = quantity % usedPortCount;
    let firstSpeaker = 1;
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
        "input"
      );
      this.addConnection({
        id: `${idPrefix}-${index + 1}`,
        fromNode: source,
        fromPort: available[index],
        toNode: speakers,
        toPort: terminal,
        cableType: channelQuantity > 1 ? `音箱线 ×${channelQuantity}` : "音箱线",
        connectionMethod: "保持正负极一致",
        quantity: channelQuantity
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
    if (isProcessorName(clean)) {
      const profile = this.processorProductId ? getDevicePortProfile(this.processorProductId) : undefined;
      return {
        id: "processor",
        productId: this.processorProductId ?? PROCESSOR_AJ350_PORT_PROFILE_ID,
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
      return {
        id: "wireless-receiver",
        productId: WIRELESS_RECEIVER_PORT_PROFILE_ID,
        label: clean.replace(/^利旧/, ""),
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
      productId: `EXTERNAL-${stableHash(clean)}`,
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

  private ensureNode(seed: NodeSeed): InterfaceWiringNode {
    const existing = this.nodes.get(seed.id);
    if (existing) {
      existing.quantity = Math.max(existing.quantity, seed.quantity);
      if (!existing.internalModel && seed.internalModel) existing.internalModel = seed.internalModel;
      return existing;
    }
    const node: InterfaceWiringNode = {
      ...seed,
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
    edgeId: string
  ): DevicePortCapability | undefined {
    const normalized = originalPort.toUpperCase();
    if (node.category === "processor") {
      if (normalized.includes("USB")) return this.requirePort(node.productId, "usb");
      if (/网络|控制|LAN/.test(originalPort)) return this.requirePort(node.productId, "lan");
      if (/LINE OUT|模拟输出|音频输出/i.test(originalPort)) return this.allocatePort(node, "lineOut", originalPort);
      if (/LINE IN|模拟输入|音频输入/i.test(originalPort)) return this.allocatePort(node, "lineIn", originalPort);
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
    if (node.productId === WIRELESS_RECEIVER_PORT_PROFILE_ID) {
      if (normalized.includes("BAL OUT")) return this.requirePort(node.productId, "balOut");
      if (normalized.includes("LINE OUT")) return this.requirePort(node.productId, "lineOut");
      if (normalized.includes("MIC OUT")) return this.requirePort(node.productId, "micOut");
      if (normalized.includes("无线接收")) return this.syntheticPort("wirelessReceive", "无线接收", "无线", "input");
    }
    if (node.productId === "WIRELESS-MICROPHONE") {
      return this.syntheticPort(`wireless-${edgeId}`, "无线发射", "无线", "output");
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
    return this.syntheticPort(`unconfirmed-${direction}-${edgeId}`, label, "接口形式待复核", direction, false);
  }

  private allocatePort(node: InterfaceWiringNode, prefix: string, responsibility: string) {
    const available = getDevicePortsByPrefix(node.productId, prefix).find((port) => !this.isPortOccupied(node.id, port.id));
    if (!available) {
      this.addFinding({
        code: `port-capacity.${node.id}.${prefix}.${stableHash(responsibility)}`,
        severity: "hard",
        title: "接口数量超过上限",
        message: `${node.label}没有剩余${prefix.startsWith("lineIn") ? "音频输入" : prefix.startsWith("lineOut") ? "音频输出" : "可用"}接口，无法为“${responsibility}”生成虚假连线，建议更换设备。`,
        nodeId: node.id
      });
    }
    return available;
  }

  private addConnection(seed: ConnectionSeed) {
    if (this.isPortOccupied(seed.fromNode.id, seed.fromPort.id) || this.isPortOccupied(seed.toNode.id, seed.toPort.id)) {
      const occupiedNode = this.isPortOccupied(seed.fromNode.id, seed.fromPort.id) ? seed.fromNode : seed.toNode;
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
    const fromPortId = `${seed.fromNode.id}:${seed.fromPort.id}`;
    const toPortId = `${seed.toNode.id}:${seed.toPort.id}`;
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
      confirmed: seed.fromPort.confirmed
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
      confirmed: seed.toPort.confirmed
    });
    this.occupiedPorts.add(`${seed.fromNode.id}:${seed.fromPort.id}`);
    this.occupiedPorts.add(`${seed.toNode.id}:${seed.toPort.id}`);
    this.edges.push({
      id: seed.id,
      fromNodeId: seed.fromNode.id,
      fromPortId,
      toNodeId: seed.toNode.id,
      toPortId,
      cableType: seed.cableType,
      connectionMethod: seed.connectionMethod,
      signalDirection: seed.signalDirection ?? (seed.fromPort.direction === "bidirectional" || seed.toPort.direction === "bidirectional" ? "bidirectional" : "fromTo"),
      quantity: seed.quantity ?? 1
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
    confirmed = true
  ): DevicePortCapability {
    return {
      id,
      panelLabel,
      interfaceType,
      direction,
      maxConnections: 1,
      confirmed,
      source: confirmed ? "当前方案连接关系" : "接口资料待用户补录"
    };
  }

  private isPortOccupied(nodeId: string, portId: string) {
    return this.occupiedPorts.has(`${nodeId}:${portId}`);
  }

  private isPowerConnection(line: ConnectionLine) {
    return /电源|POWER|AC\s*220|DC\s*12|适配器/i.test(`${line.fromPort} ${line.toPort} ${line.cableType}`);
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

export function getInterfaceWiringLayout(model: InterfaceWiringModel, availableWidth = 1120): InterfaceWiringLayout {
  const width = Math.max(320, Math.floor(availableWidth));
  if (!model.rootNodeId || !model.nodes.length) return { width, height: 560, positions: {} };
  const sidePadding = width < 720 ? 16 : 24;
  const nodeWidth = Math.min(260, width - sidePadding * 2);
  const nodeMap = new Map(model.nodes.map((node) => [node.id, node]));
  const dimensions = new Map(model.nodes.map((node) => [node.id, getNodeDimensions(node, nodeWidth)]));
  const centerPositions = new Map<string, { x: number; y: number }>();
  const root = nodeMap.get(model.rootNodeId)!;
  centerPositions.set(root.id, { x: width / 2, y: 0 });
  const directChildren = model.nodes.filter((node) => node.parentId === root.id);
  const rootDimensions = dimensions.get(root.id)!;
  if (width >= 840) {
    placeDirectChildrenOnConstrainedRing(
      directChildren,
      rootDimensions,
      dimensions,
      centerPositions,
      width,
      sidePadding
    );
  } else {
    placeDirectChildrenInCompactRows(
      directChildren,
      rootDimensions,
      dimensions,
      centerPositions,
      width,
      sidePadding,
      nodeWidth
    );
  }

  const placedRects: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
  for (const node of [root, ...directChildren]) {
    const center = centerPositions.get(node.id)!;
    const size = dimensions.get(node.id)!;
    placedRects.push({ id: node.id, x: center.x - size.width / 2, y: center.y - size.height / 2, ...size });
  }
  for (const parent of directChildren) {
    const children = model.nodes.filter((node) => node.parentId === parent.id);
    const parentCenter = centerPositions.get(parent.id)!;
    children.forEach((node, index) => {
      const size = dimensions.get(node.id)!;
      const candidate = findOpenChildPosition({
        parentCenter,
        rootCenter: centerPositions.get(root.id)!,
        size,
        siblingIndex: index,
        siblingCount: children.length,
        placedRects,
        width,
        sidePadding
      });
      centerPositions.set(node.id, candidate);
      placedRects.push({ id: node.id, x: candidate.x - size.width / 2, y: candidate.y - size.height / 2, ...size });
    });
  }
  for (const node of model.nodes.filter((item) => !centerPositions.has(item.id))) {
    const parentCenter = centerPositions.get(node.parentId ?? root.id) ?? centerPositions.get(root.id)!;
    const size = dimensions.get(node.id)!;
    const candidate = findOpenChildPosition({
      parentCenter,
      rootCenter: centerPositions.get(root.id)!,
      size,
      siblingIndex: 0,
      siblingCount: 1,
      placedRects,
      width,
      sidePadding
    });
    centerPositions.set(node.id, candidate);
    placedRects.push({ id: node.id, x: candidate.x - size.width / 2, y: candidate.y - size.height / 2, ...size });
  }

  const raw = model.nodes.map((node) => {
    const center = centerPositions.get(node.id)!;
    const size = dimensions.get(node.id)!;
    return {
      id: node.id,
      x: center.x - size.width / 2,
      y: center.y - size.height / 2,
      width: size.width,
      height: size.height,
      centerX: center.x,
      centerY: center.y
    };
  });
  const minY = Math.min(...raw.map((item) => item.y));
  const maxY = Math.max(...raw.map((item) => item.y + item.height));
  const titleBand = 104;
  const bottomPadding = 44;
  const shiftY = titleBand - minY;
  const positions = Object.fromEntries(raw.map((item) => [item.id, {
    ...item,
    x: item.x,
    y: item.y + shiftY,
    centerX: item.centerX,
    centerY: item.centerY + shiftY
  }]));
  return {
    width,
    height: Math.max(620, maxY - minY + titleBand + bottomPadding),
    positions
  };
}

function placeDirectChildrenOnConstrainedRing(
  nodes: InterfaceWiringNode[],
  rootSize: { width: number; height: number },
  dimensions: Map<string, { width: number; height: number }>,
  positions: Map<string, { x: number; y: number }>,
  width: number,
  sidePadding: number
) {
  if (!nodes.length) return;
  const horizontalRadius = width / 2 - sidePadding - rootSize.width / 2;
  const angles = nodes.map((_, index) => -Math.PI / 2 + (Math.PI * 2 * index) / nodes.length);
  let verticalRadius = Math.max(300, rootSize.height / 2 + 190);
  for (const [index, node] of nodes.entries()) {
    const size = dimensions.get(node.id)!;
    const angle = angles[index];
    const horizontalSeparation = Math.abs(Math.cos(angle) * horizontalRadius);
    const requiredHorizontal = (rootSize.width + size.width) / 2 + 34;
    if (horizontalSeparation >= requiredHorizontal) continue;
    const verticalFactor = Math.max(0.18, Math.abs(Math.sin(angle)));
    const requiredVertical = (rootSize.height + size.height) / 2 + 76;
    verticalRadius = Math.max(verticalRadius, requiredVertical / verticalFactor);
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const rects = nodes.map((node, index) => {
      const size = dimensions.get(node.id)!;
      const angle = angles[index];
      const center = {
        x: width / 2 + Math.cos(angle) * horizontalRadius,
        y: Math.sin(angle) * verticalRadius
      };
      return { id: node.id, center, x: center.x - size.width / 2, y: center.y - size.height / 2, ...size };
    });
    const rootRect = {
      x: width / 2 - rootSize.width / 2,
      y: -rootSize.height / 2,
      ...rootSize
    };
    const hasOverlap = rects.some((rect, index) =>
      rectanglesOverlap(rect, rootRect, 34) ||
      rects.slice(index + 1).some((other) => rectanglesOverlap(rect, other, 34))
    );
    if (!hasOverlap) {
      rects.forEach((rect) => positions.set(rect.id, rect.center));
      return;
    }
    verticalRadius += 60;
  }

  nodes.forEach((node, index) => {
    const angle = angles[index];
    positions.set(node.id, {
      x: width / 2 + Math.cos(angle) * horizontalRadius,
      y: Math.sin(angle) * verticalRadius
    });
  });
}

function placeDirectChildrenInCompactRows(
  nodes: InterfaceWiringNode[],
  rootSize: { width: number; height: number },
  dimensions: Map<string, { width: number; height: number }>,
  positions: Map<string, { x: number; y: number }>,
  width: number,
  sidePadding: number,
  nodeWidth: number
) {
  const topNodes = nodes.filter((_, index) => index % 2 === 0);
  const bottomNodes = nodes.filter((_, index) => index % 2 === 1);
  const columnGap = 32;
  const maxColumns = Math.max(1, Math.floor((width - sidePadding * 2 + columnGap) / (nodeWidth + columnGap)));
  const placeGroup = (group: InterfaceWiringNode[], direction: -1 | 1) => {
    const rows: InterfaceWiringNode[][] = [];
    for (let index = 0; index < group.length; index += maxColumns) rows.push(group.slice(index, index + maxColumns));
    let boundary = direction < 0 ? -rootSize.height / 2 - 96 : rootSize.height / 2 + 96;
    for (const row of rows) {
      const rowHeight = Math.max(...row.map((node) => dimensions.get(node.id)!.height));
      const centerY = boundary + direction * rowHeight / 2;
      const usableWidth = width - sidePadding * 2;
      row.forEach((node, index) => {
        const centerX = row.length === 1
          ? width / 2
          : sidePadding + nodeWidth / 2 + index * ((usableWidth - nodeWidth) / (row.length - 1));
        positions.set(node.id, { x: centerX, y: centerY });
      });
      boundary += direction * (rowHeight + 86);
    }
  };
  placeGroup(topNodes, -1);
  placeGroup(bottomNodes, 1);
}

function findOpenChildPosition(input: {
  parentCenter: { x: number; y: number };
  rootCenter: { x: number; y: number };
  size: { width: number; height: number };
  siblingIndex: number;
  siblingCount: number;
  placedRects: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  width: number;
  sidePadding: number;
}) {
  const {
    parentCenter,
    rootCenter,
    size,
    siblingIndex,
    siblingCount,
    placedRects,
    width,
    sidePadding
  } = input;
  const outwardAngle = Math.atan2(parentCenter.y - rootCenter.y, parentCenter.x - rootCenter.x);
  const siblingSpread = (siblingIndex - (siblingCount - 1) / 2) * (Math.PI / 4);
  const angleOffsets = [
    siblingSpread,
    siblingSpread + Math.PI / 2,
    siblingSpread - Math.PI / 2,
    siblingSpread + Math.PI / 4,
    siblingSpread - Math.PI / 4,
    siblingSpread + Math.PI
  ];
  const distances = [360, 440, 520, 620];
  for (const distance of distances) {
    for (const angleOffset of angleOffsets) {
      const angle = outwardAngle + angleOffset;
      const candidate = {
        x: parentCenter.x + Math.cos(angle) * distance,
        y: parentCenter.y + Math.sin(angle) * distance
      };
      const rect = {
        x: candidate.x - size.width / 2,
        y: candidate.y - size.height / 2,
        ...size
      };
      if (rect.x < sidePadding || rect.x + rect.width > width - sidePadding) continue;
      if (!placedRects.some((placed) => rectanglesOverlap(rect, placed, 34))) return candidate;
    }
  }

  const xCandidates = [
    width / 2,
    sidePadding + size.width / 2,
    width - sidePadding - size.width / 2
  ];
  let y = Math.max(...placedRects.map((rect) => rect.y + rect.height), parentCenter.y) + 110 + size.height / 2;
  for (let row = 0; row < 40; row += 1) {
    for (const x of xCandidates) {
      const candidate = { x, y };
      const rect = { x: x - size.width / 2, y: y - size.height / 2, ...size };
      if (!placedRects.some((placed) => rectanglesOverlap(rect, placed, 34))) return candidate;
    }
    y += size.height + 64;
  }
  return { x: width / 2, y };
}

function getNodeDimensions(node: InterfaceWiringNode, width: number) {
  const portRows = Math.max(1, node.ports.length);
  return {
    width,
    height: 62 + portRows * 48 + (node.cascade ? 42 : 0)
  };
}

function rectanglesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
  gap: number
) {
  return !(
    left.x + left.width + gap <= right.x ||
    right.x + right.width + gap <= left.x ||
    left.y + left.height + gap <= right.y ||
    right.y + right.height + gap <= left.y
  );
}

function getConnectionMethod(
  line: ConnectionLine,
  fromPort: DevicePortCapability,
  toPort: DevicePortCapability
) {
  if (line.cableType.includes("USB")) return "USB直连，双向音频";
  if (fromPort.interfaceType.includes("RJ45") && toPort.interfaceType.includes("RJ45")) return "RJ45直连";
  if (line.cableType.includes("音箱线")) return "保持正负极一致";
  if (line.cableType.includes("音频")) return "按输入/输出方向连接";
  return "按标注接口直连";
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
