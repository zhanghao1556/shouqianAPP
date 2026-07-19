import { build } from "esbuild";

const testModule = String.raw`
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createInitialProfile } from "./src/features/classroom/data/initialProfile.ts";
import { generateEngineeringOutputs } from "./src/features/classroom/lib/engineeringRules.ts";
import {
  buildInterfaceWiringModel,
  getInterfacePanelPortAnchor,
  getInterfacePanelImageRect,
  getInterfaceWiringLayout,
  getInterfaceWiringPortReferenceNumbers,
  getInterfaceWiringTableCableLabel,
  getInterfaceWiringUsageDeviceLabel
} from "./src/features/classroom/lib/interfaceWiring.ts";
import { normalizeProfile } from "./src/features/classroom/lib/profileNormalization.ts";
import {
  filterUsbExclusiveAudioLines,
  WIRED_MIC_LINE_IN_POWER_NOTE
} from "./src/features/classroom/lib/connectionRules.ts";
import { getExistingMicInputDemand, HANGING_MIC_PRODUCT_ID } from "./src/features/classroom/lib/hangingMicRules.ts";
import { getYinmanAjProcessorSpeakerPlan, LINE_ARRAY_PRODUCT_ID } from "./src/features/classroom/lib/lineArrayRules.ts";
import { EXTERNAL_AMPLIFIER_PRODUCT_ID } from "./src/features/classroom/lib/speakerRules.ts";
import {
  COMPUTER_REAR_PANEL_PORT_PROFILE_ID,
  CONTROL_HOST_PORT_PROFILE_ID,
  EXTERNAL_WIRED_MICROPHONE_PORT_PROFILE_ID,
  HEADSET_SPLITTER_PORT_PROFILE_ID,
  LAPTOP_PORT_PROFILE_ID,
  OPS_ALL_IN_ONE_PORT_PROFILE_ID,
  PROCESSOR_AJ200_PORT_PROFILE_ID,
  PROCESSOR_AJ350_PORT_PROFILE_ID,
  PROCESSOR_AJ600_PORT_PROFILE_ID,
  PASSIVE_SPEAKER_PORT_PROFILE_ID,
  RECORDING_CAMERA_PORT_PROFILE_ID,
  RECORDING_HOST_PORT_PROFILE_ID,
  VIDEO_CONFERENCE_TERMINAL_PORT_PROFILE_ID,
  WIRELESS_RECEIVER_PORT_PROFILE_ID,
  devicePortCatalog,
  getDevicePortProfile
} from "./src/features/classroom/lib/devicePortCatalog.ts";
import {
  LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID,
  PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID
} from "./src/features/classroom/lib/systemCapabilities.ts";
import {
  SMALL_DISC_01_PRODUCT_ID,
  SMALL_DISC_02_PRODUCT_ID,
  SMALL_DISC_03_PRODUCT_ID,
  SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID,
  SMALL_DISC_MAIN_NAME
} from "./src/features/classroom/lib/yinmanSmallDiscRules.ts";

function makeProfile({
  scenario = "standardClassroom",
  length = 10,
  width = 8,
  height = 3,
  needs = ["localAmplification"],
  scope = "full",
  microphoneSolution = "existingArray",
  teachingWidth = width,
  teachingDepth = 4,
  computer = "",
  recordingHost = "",
  legacyWirelessMic = "",
  speakerProductOverride = "wall",
  processorTier = "auto",
  smallDiscConnectionMode = "auto",
  measuredRt60
} = {}) {
  const base = createInitialProfile();
  return normalizeProfile({
    ...base,
    scenario,
    needs,
    amplificationScope: scope,
    roomGeometry: { length, width, height },
    existingDevices: {
      ...base.existingDevices,
      computer,
      recordingHost,
      legacyWirelessMic
    },
    acousticEnvironment: { ...base.acousticEnvironment, measuredRt60 },
    engineeringConstraints: {
      ...base.engineeringConstraints,
      microphoneSolution,
      processorTier,
      smallDiscConnectionMode,
      speakerProductOverride,
      overheadSpeakerMounting: "available",
      teachingAreaSize: { width: teachingWidth, depth: teachingDepth }
    }
  });
}

function buildModel(profile, overrides = {}, recordingInputSelections = {}) {
  const outputs = generateEngineeringOutputs(profile, overrides, "yinman");
  return {
    outputs,
    model: buildInterfaceWiringModel({ profile, outputs, brandId: "yinman", recordingInputSelections })
  };
}

function node(model, id) {
  const value = model.nodes.find((item) => item.id === id);
  assert.ok(value, "Missing wiring node " + id);
  return value;
}

function processorPortLabels(model) {
  return node(model, "processor").ports.map((port) => port.label);
}

function assertNoDuplicatePortOccupancy(model) {
  const jumperEndpointIds = new Set(model.edges
    .filter((edge) => edge.kind === "jumper")
    .flatMap((edge) => [edge.fromPortId, edge.toPortId]));
  for (const wiringNode of model.nodes) {
    const portsByCapability = new Map();
    wiringNode.ports.forEach((port) => {
      portsByCapability.set(port.capabilityId, [...(portsByCapability.get(port.capabilityId) ?? []), port]);
    });
    for (const [capabilityId, ports] of portsByCapability) {
      if (ports.length === 1) continue;
      assert.equal(wiringNode.productId, EXTERNAL_AMPLIFIER_PRODUCT_ID);
      assert.match(capabilityId, /^lineIn[1-4]$/);
      assert.ok(ports.length <= 2, "Too many conductors share " + wiringNode.id + ":" + capabilityId);
      assert.ok(ports.some((port) => jumperEndpointIds.has(port.id)), "Shared port must belong to an amplifier jumper");
      assert.ok(ports.filter((port) => !jumperEndpointIds.has(port.id)).length <= 1);
    }
  }
  const endpointIds = model.edges.flatMap((edge) => [edge.fromPortId, edge.toPortId]);
  assert.equal(new Set(endpointIds).size, endpointIds.length, "One physical port was assigned to multiple edges");
}

function assertNoPowerEdges(model) {
  assert.doesNotMatch(
    JSON.stringify(model.edges.map((edge) => [edge.cableType, edge.connectionMethod])),
    /POWER|AC\s*220|DC\s*12|电源|适配器/i
  );
}

const ringProfiles = Array.from({ length: 18 }, (_, index) => makeProfile({
  length: 6 + index,
  width: 8,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "existingArray"
}));
const ringCases = new Map();
for (const profile of ringProfiles) {
  const result = buildModel(profile);
  const count = result.outputs.productSelection.find((item) => item.productId === PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID)?.quantity ?? 0;
  if ((count === 1 || count === 2) && !ringCases.has(count)) ringCases.set(count, result);
}
assert.ok(ringCases.has(1), "No one-RING08 fixture was found");
assert.ok(ringCases.has(2), "No two-RING08 fixture was found");
for (const count of [1, 2]) {
  const model = ringCases.get(count).model;
  assert.equal(model.candidateProcessor, "AJ350");
  const microphones = model.nodes.filter((item) => item.productId === PROCESSOR_DEPENDENT_ARRAY_PRODUCT_ID);
  assert.deepEqual(
    microphones.map((item) => [item.id, item.label, item.quantity, item.parentId]),
    count === 1
      ? [["ring08", "大圆盘阵麦", 1, "processor"]]
      : [["ring08-1", "大圆盘阵麦 1", 1, "processor"], ["ring08-2", "大圆盘阵麦 2", 1, "processor"]]
  );
  assert.ok(microphones.every((item) => item.ports.length === 1 && item.ports[0].capabilityId === "lan"));
  assert.equal(new Set(model.edges.filter((edge) => edge.id.startsWith("ring08-aj350-")).map((edge) => edge.fromNodeId)).size, count);
  assert.deepEqual(
    processorPortLabels(model).filter((label) => label === "A1" || label === "A2"),
    count === 1 ? ["A1"] : ["A1", "A2"]
  );
}
console.log("PASS one or two RING08 devices use separate physical nodes and AJ350 A1/A2");

const processorSpeakerBoundaryCases = [
  { count: 4, processor: "AJ200", processorProductId: PROCESSOR_AJ200_PORT_PROFILE_ID, direct: 4, amplifier: 0 },
  { count: 5, processor: "AJ600", processorProductId: PROCESSOR_AJ600_PORT_PROFILE_ID, direct: 5, amplifier: 0 },
  { count: 8, processor: "AJ600", processorProductId: PROCESSOR_AJ600_PORT_PROFILE_ID, direct: 8, amplifier: 0 },
  { count: 9, processor: "AJ200", processorProductId: PROCESSOR_AJ200_PORT_PROFILE_ID, direct: 4, amplifier: 5 },
  { count: 12, processor: "AJ200", processorProductId: PROCESSOR_AJ200_PORT_PROFILE_ID, direct: 4, amplifier: 8 },
  { count: 13, processor: "AJ600", processorProductId: PROCESSOR_AJ600_PORT_PROFILE_ID, direct: 8, amplifier: 5 }
];
for (const expected of processorSpeakerBoundaryCases) {
  const result = buildModel(makeProfile({
    length: 8,
    width: 8,
    scope: "podium",
    microphoneSolution: "hangingMic",
    speakerProductOverride: "wall"
  }), { "COLUMN-SPEAKER": expected.count });
  assert.equal(result.model.candidateProcessor, expected.processor);
  assert.equal(node(result.model, "processor").productId, expected.processorProductId);
  assert.equal(
    result.model.nodes.filter((item) => item.id.startsWith("processor-speakers-group-")).reduce((sum, item) => sum + item.quantity, 0),
    expected.direct
  );
  assert.equal(
    result.model.nodes.filter((item) => item.id.startsWith("amplifier-speakers-group-")).reduce((sum, item) => sum + item.quantity, 0),
    expected.amplifier
  );
  assert.equal(result.model.nodes.some((item) => item.id === "amplifier"), expected.amplifier > 0);
  assert.equal(getYinmanAjProcessorSpeakerPlan(expected.count).directSpeakerCount, expected.direct);
  assertNoDuplicatePortOccupancy(result.model);
}
const interfaceFirstBoundary = buildModel(makeProfile({
  length: 8,
  width: 8,
  scope: "podium",
  microphoneSolution: "hangingMic",
  speakerProductOverride: "wall",
  legacyWirelessMic: "有线麦克风、有线麦克风、有线麦克风"
}), { "COLUMN-SPEAKER": 9 });
assert.equal(interfaceFirstBoundary.model.candidateProcessor, "AJ600");
assert.equal(
  interfaceFirstBoundary.model.nodes.filter((item) => item.id.startsWith("processor-speakers-group-")).reduce((sum, item) => sum + item.quantity, 0),
  8
);
assert.equal(
  interfaceFirstBoundary.model.nodes.filter((item) => item.id.startsWith("amplifier-speakers-group-")).reduce((sum, item) => sum + item.quantity, 0),
  1
);
console.log("PASS interface wiring uses AJ200/AJ600 boundary tiers with 12 speakers split as processor 4 plus amplifier 8");

const singleLineProfile = makeProfile({
  length: 8,
  width: 8,
  scope: "podium",
  microphoneSolution: "lineArray"
});
const singleLine = buildModel(singleLineProfile, { "COLUMN-SPEAKER": 2 });
assert.equal(singleLine.outputs.productSelection.find((item) => item.productId === LINE_ARRAY_PRODUCT_ID)?.quantity, 1);
assert.equal(singleLine.model.candidateProcessor, "AJ350");
assert.equal(singleLine.model.nodes.some((item) => item.id === "line-array-converter"), false);
assert.ok(processorPortLabels(singleLine.model).includes("AMIC"));
assert.equal(node(singleLine.model, "line-array").parentId, "processor");
console.log("PASS one SA110 directly uses AJ350 AMIC");

const oneLineWith02Profile = makeProfile({
  length: 12.4,
  width: 7.4,
  height: 3.1,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "lineArray",
  measuredRt60: 0.4
});
const oneLineWith02 = buildModel(oneLineWith02Profile);
assert.equal(oneLineWith02.outputs.generatedPoints.filter((point) => point.pickupKind === "lineArray").length, 1);
assert.equal(oneLineWith02.outputs.generatedPoints.filter((point) => point.pickupKind === "smallDisc02").length, 1);
assert.equal(oneLineWith02.model.candidateProcessor, "AJ200");
assert.equal(node(oneLineWith02.model, "line-array-converter").quantity, 1);
assert.equal(node(oneLineWith02.model, "line-array").parentId, "line-array-converter");
assert.deepEqual(
  processorPortLabels(oneLineWith02.model).filter((label) => label === "MIC1" || label === "MIC2" || label === "EXTMIC").sort(),
  ["EXTMIC", "MIC1", "MIC2"]
);
const oneLineConverterEdges = oneLineWith02.model.edges.filter((edge) => edge.id.startsWith("line-array-converter-mic-"));
assert.equal(oneLineConverterEdges.length, 2);
for (const edge of oneLineConverterEdges) {
  assert.deepEqual(
    edge.conductors.map((conductor) => [conductor.fromTerminalId, conductor.toTerminalId, conductor.label, conductor.confirmed]),
    [
      ["positive", "positive", "红线", true],
      ["negative", "negative", "白线", true],
      ["ground", "ground", "屏蔽线", true]
    ]
  );
}
assert.equal(oneLineWith02.model.findings.some((item) => item.code === "line-array-converter.output-labels"), false);
assert.equal(oneLineWith02.model.findings.some((item) => item.code.startsWith("unconfirmed-port.line-array-converter-mic-")), false);
console.log("PASS one SA110 plus 02 uses AJ200, one line-array extender, MIC1/MIC2 and EXTMIC");

const twoLineProfile = makeProfile({
  scenario: "combinedClassroom",
  length: 8,
  width: 14,
  scope: "podium",
  microphoneSolution: "lineArray",
  teachingWidth: 14,
  teachingDepth: 5
});
const twoLine = buildModel(twoLineProfile);
assert.equal(twoLine.outputs.generatedPoints.filter((point) => point.pickupKind === "lineArray").length, 2);
assert.equal(twoLine.outputs.generatedPoints.filter((point) => point.pickupKind === "smallDisc02").length, 0);
assert.equal(twoLine.model.candidateProcessor, "AJ600");
assert.equal(node(twoLine.model, "line-array-converter").quantity, 1);
const twoLineArrayNodes = twoLine.model.nodes.filter((item) => item.productId === LINE_ARRAY_PRODUCT_ID);
assert.deepEqual(twoLineArrayNodes.map((item) => [item.id, item.label, item.quantity, item.parentId]), [
  ["line-array-1", "智能线阵麦克风 1", 1, "processor"],
  ["line-array-2", "智能线阵麦克风 2", 1, "line-array-converter"]
]);
assert.deepEqual(
  twoLineArrayNodes.map((item) => item.ports.map((port) => port.label)),
  [["RJ45"], ["RJ45"]]
);
assert.deepEqual(
  processorPortLabels(twoLine.model).filter((label) => label === "MIC1" || label === "MIC2" || label === "EXTMIC").sort(),
  ["EXTMIC", "MIC1", "MIC2"]
);
console.log("PASS two SA110 without 02 use AJ600 with one EXTMIC direct path and one extender");

const twoLineWith02Profile = makeProfile({
  scenario: "combinedClassroom",
  length: 12,
  width: 14,
  needs: ["interactiveClass"],
  scope: "podium",
  microphoneSolution: "lineArray",
  teachingWidth: 14,
  teachingDepth: 5,
  measuredRt60: 0.4
});
const supplementProductTemplate = oneLineWith02.outputs.productSelection.find((item) => item.productId === SMALL_DISC_02_PRODUCT_ID);
const supplementPointTemplate = oneLineWith02.outputs.generatedPoints.find((point) => point.pickupKind === "smallDisc02");
assert.ok(supplementProductTemplate);
assert.ok(supplementPointTemplate);
const twoLineWith02Outputs = {
  ...twoLine.outputs,
  productSelection: [
    ...twoLine.outputs.productSelection.filter((item) => item.productId !== SMALL_DISC_02_PRODUCT_ID),
    { ...supplementProductTemplate, quantity: 2 }
  ],
  generatedPoints: [
    ...twoLine.outputs.generatedPoints,
    { ...supplementPointTemplate, id: "test-small-disc-02-1", position: { x: 4.6, y: 7.2 } },
    { ...supplementPointTemplate, id: "test-small-disc-02-2", position: { x: 9.4, y: 7.2 } }
  ]
};
const twoLineWith02 = {
  outputs: twoLineWith02Outputs,
  model: buildInterfaceWiringModel({ profile: twoLineWith02Profile, outputs: twoLineWith02Outputs, brandId: "yinman" })
};
assert.equal(twoLineWith02.outputs.generatedPoints.filter((point) => point.pickupKind === "lineArray").length, 2);
assert.ok(twoLineWith02.outputs.generatedPoints.some((point) => point.pickupKind === "smallDisc02"));
assert.equal(twoLineWith02.model.candidateProcessor, "AJ600");
assert.equal(node(twoLineWith02.model, "line-array-converter").quantity, 2);
assert.equal(twoLineWith02.model.edges.filter((edge) => edge.id.startsWith("line-array-converter-link-")).length, 2);
assert.equal(twoLineWith02.model.edges.filter((edge) => edge.id.startsWith("line-array-converter-mic-")).length, 4);
assert.deepEqual(
  twoLineWith02.model.nodes
    .filter((item) => item.productId === LINE_ARRAY_PRODUCT_ID)
    .map((item) => [item.id, item.label, item.quantity, item.parentId]),
  [
    ["line-array-1", "智能线阵麦克风 1", 1, "line-array-converter"],
    ["line-array-2", "智能线阵麦克风 2", 1, "line-array-converter"]
  ]
);
assert.deepEqual(
  processorPortLabels(twoLineWith02.model).filter((label) => /^MIC[1-4]$/.test(label) || label === "EXTMIC").sort(),
  ["EXTMIC", "MIC1", "MIC2", "MIC3", "MIC4"]
);
console.log("PASS two SA110 plus 02 use AJ600, two extenders, MIC1-MIC4 and one EXTMIC chain");

const smallDisc01Profile = makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "smallDisc01",
  computer: "讲台电脑",
  recordingHost: "录播主机",
  smallDiscConnectionMode: "usb"
});
const smallDisc01 = buildModel(smallDisc01Profile);
assert.equal(smallDisc01.outputs.productSelection.find((item) => item.productId === SMALL_DISC_01_PRODUCT_ID)?.quantity, 1);
assert.equal(smallDisc01.outputs.productSelection.find((item) => item.productId === SMALL_DISC_02_PRODUCT_ID)?.quantity, 3);
assert.equal(smallDisc01.outputs.productSelection.find((item) => item.productId === SMALL_DISC_AUDIO_EXTENDER_PRODUCT_ID)?.quantity, 1);
assert.equal(smallDisc01.model.rootNodeId, "small-disc-01");
assert.equal(node(smallDisc01.model, "small-disc-extender").level, 2);
assert.equal(node(smallDisc01.model, "small-disc-02").cascade?.label, "级联 ×3");
const smallDisc01Recording = smallDisc01.model.nodes.find((item) => item.label === "录播主机");
assert.ok(smallDisc01Recording);
assert.equal(smallDisc01Recording.level, 3);
assert.equal(smallDisc01Recording.parentId, "small-disc-extender");

const smallDisc03Profile = makeProfile({
  length: 10,
  width: 10,
  needs: ["recording"],
  scope: "podium",
  microphoneSolution: "smallDisc03",
  recordingHost: "录播主机"
});
const smallDisc03 = buildModel(smallDisc03Profile);
assert.equal(smallDisc03.outputs.productSelection.find((item) => item.productId === SMALL_DISC_03_PRODUCT_ID)?.quantity, 1);
assert.equal(smallDisc03.model.rootNodeId, "small-disc-03");
assert.equal(node(smallDisc03.model, "small-disc-extender").level, 2);
const smallDisc03Recording = smallDisc03.model.nodes.find((item) => item.label === "录播主机");
assert.ok(smallDisc03Recording);
assert.equal(smallDisc03Recording.level, 3);
console.log("PASS 01/03 remain level-one roots and the 01 extender remains a separate level-two device");

const smallDiscUsbProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "smallDisc01",
  computer: "讲台电脑",
  recordingHost: "录播主机、录播摄像机、中控主机",
  smallDiscConnectionMode: "usb"
});
const smallDiscUsb = buildModel(smallDiscUsbProfile);
const usbEdge = smallDiscUsb.model.edges.find((edge) => edge.id.includes("small-disc-01-usb-host"));
assert.ok(usbEdge);
const podiumComputer = node(smallDiscUsb.model, usbEdge.toNodeId);
assert.equal(podiumComputer.label, "讲台电脑");
assert.equal(podiumComputer.productId, COMPUTER_REAR_PANEL_PORT_PROFILE_ID);
assert.equal(podiumComputer.ports.find((port) => port.capabilityId === "usbAudio")?.confirmed, true);
assert.equal(usbEdge.toPortId, podiumComputer.id + ":usbAudio");
assert.match(usbEdge.connectionMethod, /USB Audio一进一出.*内置232串口信号.*连接调试软件/);
assert.match(
  smallDiscUsb.outputs.connectionLines.find((line) => line.id === "small-disc-01-usb-host")?.note ?? "",
  /USB Audio一进一出.*内置232串口信号.*连接调试软件/
);
assert.equal(smallDiscUsb.model.findings.some((item) => item.code === "interface-panel.missing." + podiumComputer.id), false);
const invalidUsbOutputs = {
  ...smallDiscUsb.outputs,
  connectionLines: [
    ...smallDiscUsb.outputs.connectionLines,
    {
      id: "test-invalid-usb-target",
      fromDevice: SMALL_DISC_MAIN_NAME,
      fromPort: "USB数字音频接口",
      toDevice: "录播主机",
      toPort: "USB音频接口",
      cableType: "USB音频线",
      note: "测试非法USB目标"
    }
  ]
};
const invalidUsbModel = buildInterfaceWiringModel({
  profile: smallDiscUsbProfile,
  outputs: invalidUsbOutputs,
  brandId: "yinman"
});
assert.equal(invalidUsbModel.edges.some((edge) => edge.id.includes("test-invalid-usb-target")), false);
assert.equal(
  invalidUsbModel.findings.some((item) => item.code.includes("test-invalid-usb-target")),
  false,
  "A managed recording device must replace the impossible source USB edge with its selected LINE IN route"
);
assert.ok(invalidUsbModel.edges.some((edge) => edge.id === "external-recording-input-recording-host"));
const invalidUsbNonComputerOutputs = {
  ...smallDiscUsb.outputs,
  connectionLines: [
    ...smallDiscUsb.outputs.connectionLines,
    {
      id: "test-invalid-usb-non-computer",
      fromDevice: SMALL_DISC_MAIN_NAME,
      fromPort: "USB数字音频接口",
      toDevice: "外接调音台",
      toPort: "USB音频接口",
      cableType: "USB音频线",
      note: "测试非电脑USB目标"
    }
  ]
};
const invalidUsbNonComputerModel = buildInterfaceWiringModel({
  profile: smallDiscUsbProfile,
  outputs: invalidUsbNonComputerOutputs,
  brandId: "yinman"
});
assert.ok(invalidUsbNonComputerModel.findings.some((item) =>
  item.code === "usb.invalid-target.test-invalid-usb-non-computer" && item.severity === "hard"
));
assert.equal(invalidUsbNonComputerModel.edges.some((edge) => edge.id.includes("test-invalid-usb-non-computer")), false);
const notebookUsbProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "smallDisc01",
  computer: "笔记本电脑",
  smallDiscConnectionMode: "usb"
});
const notebookUsb = buildModel(notebookUsbProfile);
const notebookNode = notebookUsb.model.nodes.find((item) => item.label === "笔记本电脑");
assert.ok(notebookNode);
assert.equal(notebookNode.productId, LAPTOP_PORT_PROFILE_ID);
assert.deepEqual(notebookNode.ports.map((port) => port.capabilityId), ["usbAudio"]);
assert.equal(notebookUsb.model.findings.some((item) => item.code === "interface-panel.missing." + notebookNode.id), false);
assert.equal(notebookUsb.model.nodes.some((item) => item.productId === HEADSET_SPLITTER_PORT_PROFILE_ID), false);
const allInOneUsbProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "smallDisc01",
  computer: "ClassIn 一体机",
  smallDiscConnectionMode: "usb"
});
const allInOneUsb = buildModel(allInOneUsbProfile);
const allInOneNode = allInOneUsb.model.nodes.find((item) => item.label === "ClassIn 一体机");
assert.ok(allInOneNode);
assert.equal(allInOneNode.productId, OPS_ALL_IN_ONE_PORT_PROFILE_ID);
assert.equal(allInOneNode.ports.find((port) => port.capabilityId === "usbAudio")?.label, "USB Audio");
assert.equal(allInOneUsb.model.findings.some((item) => item.code === "interface-panel.missing." + allInOneNode.id), false);

const usbPriorityCases = [
  {
    name: "all-in-one over podium and laptop",
    computer: "讲台电脑、笔记本电脑、ClassIn 一体机",
    expectedTarget: "ClassIn 一体机"
  },
  {
    name: "podium over laptop",
    computer: "笔记本电脑、讲台电脑",
    expectedTarget: "讲台电脑"
  },
  {
    name: "laptop only",
    computer: "笔记本电脑",
    expectedTarget: "笔记本电脑"
  }
];
for (const usbPriorityCase of usbPriorityCases) {
  const result = buildModel(makeProfile({
    length: 8,
    width: 8,
    needs: ["interactiveClass"],
    scope: "podium",
    microphoneSolution: "existingArray",
    computer: usbPriorityCase.computer
  }));
  const usbEdges = result.model.edges.filter((edge) => /USB/i.test(edge.cableType));
  assert.equal(usbEdges.length, 1, usbPriorityCase.name + " must allocate exactly one USB Audio edge");
  const target = node(result.model, usbEdges[0].toNodeId);
  assert.equal(target.label, usbPriorityCase.expectedTarget, usbPriorityCase.name);
  assert.deepEqual(target.ports.map((port) => port.capabilityId), ["usbAudio"]);
}

const podiumUsbBaseProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  scope: "podium",
  microphoneSolution: "existingArray",
  computer: "讲台电脑"
});
const podiumUsbWithoutControl = buildModel(podiumUsbBaseProfile);
const podiumUsbWithControl = buildModel({
  ...podiumUsbBaseProfile,
  existingDevices: { ...podiumUsbBaseProfile.existingDevices, recordingHost: "中控主机" }
});
for (const result of [podiumUsbWithoutControl, podiumUsbWithControl]) {
  const usbEdges = result.model.edges.filter((edge) => /USB/i.test(edge.cableType));
  assert.equal(usbEdges.length, 1);
  assert.equal(node(result.model, usbEdges[0].toNodeId).label, "讲台电脑");
  const podium = node(result.model, "podium-computer");
  assert.deepEqual(podium.ports.map((port) => port.capabilityId), ["usbAudio"]);
  assert.equal(result.model.edges.some((edge) => edge.id.startsWith("external-computer-") && (edge.fromNodeId === podium.id || edge.toNodeId === podium.id)), false);
}
const usbControlNode = node(podiumUsbWithControl.model, "control-host");
assert.deepEqual(usbControlNode.ports.map((port) => port.capabilityId), ["rs232"]);
assert.ok(podiumUsbWithControl.model.edges.some((edge) => edge.id === "external-control-rs232-control-host"));
assert.equal(
  podiumUsbWithControl.outputs.connectionLines.find((line) => /USB/i.test(line.cableType))?.toDevice,
  "讲台电脑"
);
console.log("PASS USB Audio globally prefers all-in-one, podium and laptop while control remains RS232-only");

const wirelessProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["localAmplification"],
  scope: "podium",
  microphoneSolution: "lineArray"
});
const wireless = buildModel(wirelessProfile, { "WIRELESS-HANDHELD": 1 });
assert.ok(wireless.outputs.connectionLines.some((line) => line.cableType === "无线信号"));
assert.ok(wireless.model.nodes.some((item) => item.id === "wireless-receiver"));
assert.equal(wireless.model.nodes.some((item) => item.id === "wireless-microphones"), false);
assert.equal(wireless.model.edges.some((edge) => edge.cableType === "无线信号"), false);
assert.equal(
  wireless.model.nodes.find((item) => item.id === "wireless-receiver")?.ports.some((port) => port.capabilityId === "wirelessReceive"),
  false
);
assert.ok(wireless.model.edges.some((edge) =>
  (edge.fromNodeId === "wireless-receiver" || edge.toNodeId === "wireless-receiver") && /音频线/.test(edge.cableType)
));
const wirelessReceiverAudioEdge = wireless.model.edges.find((edge) => edge.fromNodeId === "wireless-receiver" && /音频线/.test(edge.cableType));
assert.ok(wirelessReceiverAudioEdge);
assert.equal(node(wireless.model, wirelessReceiverAudioEdge.toNodeId).ports.find((port) => port.id === wirelessReceiverAudioEdge.toPortId)?.label, "LINE IN 1");
assert.equal(wireless.model.findings.some((item) => item.code === "processor.total-mic-capacity"), false);
assert.equal(getExistingMicInputDemand(makeProfile({ legacyWirelessMic: "无线手持麦" })), 0);
assert.equal(getExistingMicInputDemand(makeProfile({ legacyWirelessMic: "有线麦克风" })), 1);

const oneLineWith02AndWireless = buildModel(oneLineWith02Profile, { "WIRELESS-HANDHELD": 1 });
assert.equal(oneLineWith02AndWireless.model.candidateProcessor, "AJ200");
assert.equal(oneLineWith02AndWireless.model.findings.some((item) => item.code === "processor.total-mic-capacity"), false);
const hybridWirelessReceiverEdge = oneLineWith02AndWireless.model.edges.find((edge) => edge.fromNodeId === "wireless-receiver" && /音频线/.test(edge.cableType));
assert.ok(hybridWirelessReceiverEdge);
assert.equal(
  node(oneLineWith02AndWireless.model, hybridWirelessReceiverEdge.toNodeId).ports.find((port) => port.id === hybridWirelessReceiverEdge.toPortId)?.label,
  "LINE IN 1"
);
for (const width of [520, 993, 1120]) {
  const levelTwoLayout = getInterfaceWiringLayout(wireless.model, width);
  const levelTwoNodes = wireless.model.nodes.filter((item) => item.level === 2);
  const wideLevelTwoNodeIds = new Set(levelTwoNodes
    .filter((item) => (getDevicePortProfile(item.productId)?.interfacePanel?.aspectRatio ?? 0) >= 2.4)
    .map((item) => item.id));
  const levelTwoRows = new Map();
  levelTwoNodes.forEach((item) => {
    const position = levelTwoLayout.positions[item.id];
    const rowKey = position.centerY.toFixed(3);
    levelTwoRows.set(rowKey, [...(levelTwoRows.get(rowKey) ?? []), item.id]);
  });
  assert.ok(Array.from(levelTwoRows.values()).every((row) => {
    const wideCount = row.filter((id) => wideLevelTwoNodeIds.has(id)).length;
    return wideCount === 0 || row.length <= 2;
  }));
  const lineArrayPosition = levelTwoLayout.positions["line-array"];
  const wirelessReceiverPosition = levelTwoLayout.positions["wireless-receiver"];
  assert.ok(lineArrayPosition.width <= 460 && wirelessReceiverPosition.width <= 460);
  if (width >= 993) {
    const expectedWidePanelWidth = Math.min(460, Math.floor((width - 72 * 2 - 24) / 2));
    assert.deepEqual(
      [lineArrayPosition.width, wirelessReceiverPosition.width],
      [expectedWidePanelWidth, expectedWidePanelWidth]
    );
  }
  assert.equal(
    levelTwoNodes.some((item) => levelTwoLayout.positions[item.id].centerY === levelTwoLayout.positions[wireless.model.rootNodeId].centerY),
    false
  );
  const levelTwoSpeakerPositions = levelTwoNodes
    .filter((item) => item.category === "speaker")
    .map((item) => levelTwoLayout.positions[item.id]);
  assert.equal(levelTwoSpeakerPositions.length, levelTwoNodes.filter((item) => item.category === "speaker").length);
  assert.ok(levelTwoSpeakerPositions.length >= 2);
  assert.equal(new Set(levelTwoSpeakerPositions.map((item) => item.centerY)).size, 1);
  for (let index = 1; index < levelTwoSpeakerPositions.length; index += 1) {
    assert.equal(
      levelTwoSpeakerPositions[index].x - (levelTwoSpeakerPositions[index - 1].x + levelTwoSpeakerPositions[index - 1].width),
      0
    );
  }
}
console.log("PASS wireless wiring keeps the receiver physical-only while wide level-two panels use at most two devices per row");

const unknownPortProfile = singleLineProfile;
const unknownPortOutputs = {
  ...singleLine.outputs,
  connectionLines: [
    ...singleLine.outputs.connectionLines,
    {
      id: "test-unknown-external-input",
      fromDevice: "智能音频处理主机",
      fromPort: "LINE OUT / 模拟输出",
      toDevice: "外接调音台",
      toPort: "音频输入",
      cableType: "音频线",
      note: "未知外设接口复核测试"
    }
  ]
};
const unknownPort = {
  outputs: unknownPortOutputs,
  model: buildInterfaceWiringModel({ profile: unknownPortProfile, outputs: unknownPortOutputs, brandId: "yinman" })
};
assert.ok(unknownPort.model.findings.some((item) => item.code.startsWith("external-port.") && item.severity === "review"));
assert.ok(unknownPort.model.nodes.some((item) => item.ports.some((port) => !port.confirmed && port.label.includes("需复核"))));
const unknownMixer = unknownPort.model.nodes.find((item) => item.label === "外接调音台");
assert.ok(unknownMixer?.ports.some((port) => !port.confirmed));
console.log("PASS unknown external interfaces stay visible as review items without blocking generation");

const podiumAnalogOutputs = {
  ...singleLine.outputs,
  connectionLines: [
    ...singleLine.outputs.connectionLines,
    {
      id: "test-podium-computer-audio-input",
      fromDevice: "智能音频处理主机",
      fromPort: "Line Out / 模拟输出",
      toDevice: "讲台电脑",
      toPort: "音频输入",
      cableType: "3.5mm音频线",
      note: "讲台电脑模拟音频输入落点测试"
    },
    {
      id: "test-podium-computer-audio-output",
      fromDevice: "讲台电脑",
      fromPort: "音频输出",
      toDevice: "智能音频处理主机",
      toPort: "Line In / 模拟输入",
      cableType: "3.5mm音频线",
      note: "讲台电脑模拟音频输出落点测试"
    }
  ]
};
const podiumAnalogModel = buildInterfaceWiringModel({
  profile: singleLineProfile,
  outputs: podiumAnalogOutputs,
  brandId: "yinman"
});
const podiumAnalogNode = podiumAnalogModel.nodes.find((item) => item.label === "讲台电脑");
assert.ok(podiumAnalogNode);
assert.deepEqual(
  podiumAnalogNode.ports.map((port) => port.capabilityId).sort(),
  ["audioIn", "audioOut"]
);
assert.ok(podiumAnalogNode.ports.every((port) => port.confirmed));
const podiumAudioInputEdge = podiumAnalogModel.edges.find((edge) => edge.id === "candidate-test-podium-computer-audio-input");
const podiumAudioOutputEdge = podiumAnalogModel.edges.find((edge) => edge.id === "candidate-test-podium-computer-audio-output");
assert.equal(podiumAudioInputEdge?.toPortId, podiumAnalogNode.id + ":audioIn");
assert.equal(podiumAudioOutputEdge?.fromPortId, podiumAnalogNode.id + ":audioOut");
assert.equal(
  podiumAnalogModel.findings.some((item) => item.nodeId === podiumAnalogNode.id),
  false,
  JSON.stringify(podiumAnalogModel.findings.filter((item) => item.nodeId === podiumAnalogNode.id))
);
assertNoDuplicatePortOccupancy(podiumAnalogModel);

const usbExclusiveLines = [
  ...smallDiscUsb.outputs.connectionLines,
  ...podiumAnalogOutputs.connectionLines.filter((line) => line.id.startsWith("test-podium-computer-"))
];
const filteredUsbExclusiveLines = filterUsbExclusiveAudioLines(usbExclusiveLines);
assert.ok(filteredUsbExclusiveLines.some((line) => line.toDevice === "讲台电脑" && /USB/.test(line.cableType)));
assert.equal(
  filteredUsbExclusiveLines.some((line) => line.id.startsWith("test-podium-computer-")),
  false,
  "USB-connected computers must not retain the 3.5mm analog test lines"
);
const competingUsbLines = filterUsbExclusiveAudioLines([
  ...usbExclusiveLines,
  {
    id: "test-competing-all-in-one-usb",
    fromDevice: SMALL_DISC_MAIN_NAME,
    fromPort: "USB数字音频接口",
    toDevice: "ClassIn 一体机",
    toPort: "USB音频接口",
    cableType: "USB音频线",
    note: "测试全局USB优先级"
  }
]);
assert.deepEqual(
  competingUsbLines.filter((line) => /USB/i.test(line.cableType)).map((line) => line.toDevice),
  ["ClassIn 一体机"]
);
assert.equal(competingUsbLines.filter((line) => line.id.startsWith("test-podium-computer-")).length, 2);
const usbExclusiveModel = buildInterfaceWiringModel({
  profile: smallDiscUsbProfile,
  outputs: { ...smallDiscUsb.outputs, connectionLines: usbExclusiveLines },
  brandId: "yinman"
});
const usbExclusiveComputer = usbExclusiveModel.nodes.find((item) => item.label === "讲台电脑");
assert.ok(usbExclusiveComputer);
assert.deepEqual(usbExclusiveComputer.ports.map((port) => port.capabilityId), ["usbAudio"]);
console.log("PASS podium computer uses confirmed USB, line-input and line-output rear-panel ports");

const recordingDevicesProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["recording"],
  scope: "podium",
  microphoneSolution: "existingArray",
  recordingHost: "录播主机、录播摄像机"
});
const recordingBalanced = buildModel(recordingDevicesProfile);
const recordingHostNode = node(recordingBalanced.model, "recording-host");
const recordingCameraNode = node(recordingBalanced.model, "recording-camera");
assert.equal(recordingHostNode.productId, RECORDING_HOST_PORT_PROFILE_ID);
assert.equal(recordingCameraNode.productId, RECORDING_CAMERA_PORT_PROFILE_ID);
for (const recordingNode of [recordingHostNode, recordingCameraNode]) {
  assert.deepEqual(recordingNode.ports.map((port) => port.capabilityId), ["lineInBalanced"]);
  assert.equal(recordingNode.ports[0].confirmed, true);
  assert.match(recordingNode.ports[0].connectionMethod, /LINE OUT.*禁止接MIC IN/);
}
const balancedRecordingEdges = recordingBalanced.model.edges.filter((edge) => edge.id.startsWith("external-recording-input-"));
assert.equal(balancedRecordingEdges.length, 2);
for (const edge of balancedRecordingEdges) {
  assert.deepEqual(
    edge.conductors.map((conductor) => [conductor.label, conductor.fromTerminalLabel, conductor.toTerminalLabel]),
    [["红线", "+", "+"], ["白线", "-", "-"], ["屏蔽线", "G", "G"]]
  );
}

const recordingMixed = buildModel(recordingDevicesProfile, {}, {
  "recording-host": "trs35",
  "recording-camera": "lrg"
});
const mixedHostNode = node(recordingMixed.model, "recording-host");
const mixedCameraNode = node(recordingMixed.model, "recording-camera");
assert.deepEqual(mixedHostNode.ports.map((port) => port.capabilityId), ["lineIn35"]);
assert.deepEqual(mixedCameraNode.ports.map((port) => port.capabilityId), ["lineInLrg"]);
const mixedHostEdge = recordingMixed.model.edges.find((edge) => edge.id === "external-recording-input-recording-host");
const mixedCameraEdge = recordingMixed.model.edges.find((edge) => edge.id === "external-recording-input-recording-camera");
assert.ok(mixedHostEdge);
assert.ok(mixedCameraEdge);
assert.equal(mixedHostEdge.cableType, "3.5mm音频线");
assert.equal(mixedCameraEdge.cableType, "音频线");
for (const edge of [mixedHostEdge, mixedCameraEdge]) {
  assert.deepEqual(
    edge.conductors.map((conductor) => [conductor.label, conductor.fromTerminalId, conductor.toTerminalId]),
    [["红线", "positive", "left"], ["白线", "positive", "right"], ["屏蔽线", "ground", "ground"]]
  );
  assert.equal(edge.conductors.some((conductor) => conductor.fromTerminalId === "negative"), false);
  assert.match(edge.connectionMethod, /LINE OUT \+并接L\/R.*LINE OUT -悬空.*禁止接MIC IN/);
}
assertNoDuplicatePortOccupancy(recordingBalanced.model);
assertNoDuplicatePortOccupancy(recordingMixed.model);
console.log("PASS recording host and camera independently select balanced, LRG or 3.5mm LINE IN without using MIC IN");

const aj200ExternalProfile = makeProfile({
  length: 8,
  width: 8,
  scope: "podium",
  microphoneSolution: "hangingMic",
  recordingHost: "录播主机",
  speakerProductOverride: "wall"
});
for (const mode of ["trs35", "lrg"]) {
  const result = buildModel(aj200ExternalProfile, { "COLUMN-SPEAKER": 4 }, { "recording-host": mode });
  assert.equal(result.model.candidateProcessor, "AJ200");
  const edge = result.model.edges.find((item) => item.id === "external-recording-input-recording-host");
  assert.ok(edge);
  assert.equal(edge.fromPortId, "processor:hpOut");
  assert.deepEqual(
    edge.conductors.map((conductor) => [conductor.fromTerminalId, conductor.toTerminalId]),
    [["left", "left"], ["right", "right"], ["ground", "ground"]]
  );
  assert.match(edge.connectionMethod, /HP OUT.*L\/R\/G.*一一对应/);
  assert.equal(edge.cableType, mode === "trs35" ? "3.5mm成品音频线" : "音频线");
}
const aj200ComputerProfile = makeProfile({
  length: 8,
  width: 8,
  scope: "podium",
  microphoneSolution: "hangingMic",
  computer: "讲台电脑",
  speakerProductOverride: "wall"
});
const aj200ComputerBase = buildModel(aj200ComputerProfile, { "COLUMN-SPEAKER": 4 });
const aj200ComputerOutputs = {
  ...aj200ComputerBase.outputs,
  connectionLines: [
    ...aj200ComputerBase.outputs.connectionLines.filter((line) => !/USB/i.test(line.cableType)),
    {
      id: "test-aj200-computer-output",
      fromDevice: "讲台电脑",
      fromPort: "3.5mm LINE OUT",
      toDevice: "双麦处理器",
      toPort: "LINE IN / 模拟输入",
      cableType: "3.5mm音频线",
      note: "AJ200 HP IN优先测试"
    },
    {
      id: "test-aj200-computer-input",
      fromDevice: "双麦处理器",
      fromPort: "LINE OUT / 模拟输出",
      toDevice: "讲台电脑",
      toPort: "3.5mm LINE IN",
      cableType: "3.5mm音频线",
      note: "AJ200 HP OUT优先测试"
    }
  ]
};
const aj200ComputerModel = buildInterfaceWiringModel({
  profile: aj200ComputerProfile,
  outputs: aj200ComputerOutputs,
  brandId: "yinman"
});
assert.ok(aj200ComputerModel.edges.some((edge) => edge.id === "candidate-test-aj200-computer-output" && edge.toPortId === "processor:hpIn"));
assert.ok(aj200ComputerModel.edges.some((edge) => edge.id === "candidate-test-aj200-computer-input" && edge.fromPortId === "processor:hpOut"));
assertNoDuplicatePortOccupancy(aj200ComputerModel);
console.log("PASS AJ200 prefers HP IN/OUT for 3.5mm and L/R/G external audio with direct stereo mapping");

const smallDiscDualRecordingProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["recording"],
  scope: "podium",
  microphoneSolution: "smallDisc01",
  recordingHost: "录播主机、录播摄像机",
  smallDiscConnectionMode: "audio"
});
const smallDiscDualRecordingBase = buildModel(smallDiscDualRecordingProfile);
const smallDiscDualRecordingOutputs = {
  ...smallDiscDualRecordingBase.outputs,
  productSelection: smallDiscDualRecordingBase.outputs.productSelection.map((item) =>
    item.category === "speaker" || item.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID
      ? { ...item, quantity: 0 }
      : item
  ),
  connectionLines: smallDiscDualRecordingBase.outputs.connectionLines.filter((line) =>
    !/功放|音箱/.test(line.fromDevice + line.toDevice)
  )
};
const smallDiscDualRecording = {
  outputs: smallDiscDualRecordingOutputs,
  model: buildInterfaceWiringModel({
    profile: smallDiscDualRecordingProfile,
    outputs: smallDiscDualRecordingOutputs,
    brandId: "yinman"
  })
};
const smallDiscRecordingEdges = smallDiscDualRecording.model.edges.filter((edge) => edge.id.startsWith("external-recording-input-"));
assert.deepEqual(
  smallDiscRecordingEdges.map((edge) => edge.id).sort(),
  ["external-recording-input-recording-camera", "external-recording-input-recording-host"]
);
assert.equal(new Set(smallDiscRecordingEdges.map((edge) => edge.fromPortId)).size, 2);
assert.equal(smallDiscDualRecording.model.findings.some((item) => item.code.startsWith("external.hub-output")), false);
console.log("PASS Ring01 uses both extender A OUT and main AUDIO OUT before reporting output capacity");

const controlHostProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  scope: "podium",
  microphoneSolution: "existingArray",
  recordingHost: "中控主机"
});
const controlHost = buildModel(controlHostProfile);
const controlHostNode = node(controlHost.model, "control-host");
assert.equal(controlHostNode.productId, CONTROL_HOST_PORT_PROFILE_ID);
assert.deepEqual(controlHostNode.ports.map((port) => port.capabilityId), ["rs232"]);
const controlEdge = controlHost.model.edges.find((edge) => edge.id === "external-control-rs232-control-host");
assert.ok(controlEdge);
assert.equal(controlEdge.cableType, "232线");
assert.deepEqual(
  controlEdge.conductors.map((conductor) => [
    conductor.label,
    conductor.color,
    conductor.fromTerminalLabel,
    conductor.toTerminalLabel
  ]),
  [
    ["TX", "#eab308", "TX", "RX"],
    ["RX", "#22c55e", "RX", "TX"],
    ["GND", "#111827", "GND", "GND"]
  ]
);
assert.match(controlEdge.connectionMethod, /TX接中控RX.*RX接中控TX.*GND对接GND/);
console.log("PASS control host uses three-core RS232 with TX/RX crossing and GND continuity");

const conferenceProfile = makeProfile({
  scenario: "meetingRoom",
  length: 8,
  width: 8,
  needs: ["videoConference"],
  scope: "full",
  microphoneSolution: "existingArray",
  recordingHost: "视频会议终端"
});
const conferenceTerminal = buildModel(conferenceProfile);
const conferenceNode = node(conferenceTerminal.model, "video-conference-terminal");
assert.equal(conferenceNode.productId, VIDEO_CONFERENCE_TERMINAL_PORT_PROFILE_ID);
assert.deepEqual(conferenceNode.ports.map((port) => port.capabilityId).sort(), ["audioIn", "audioOut"]);
const conferenceInputEdge = conferenceTerminal.model.edges.find((edge) => edge.id === "external-conference-input-video-conference-terminal");
const conferenceOutputEdge = conferenceTerminal.model.edges.find((edge) => edge.id === "external-conference-output-video-conference-terminal");
assert.ok(conferenceInputEdge);
assert.ok(conferenceOutputEdge);
assert.deepEqual(
  conferenceInputEdge.conductors.map((conductor) => [conductor.fromTerminalId, conductor.toTerminalId]),
  [["positive", "left"], ["positive", "right"], ["ground", "ground"]]
);
assert.deepEqual(
  conferenceOutputEdge.conductors.map((conductor) => [conductor.fromTerminalId, conductor.toTerminalId]),
  [["left", "positive"], ["right", "positive"], ["ground", "ground"]]
);
assert.ok([conferenceInputEdge, conferenceOutputEdge].every((edge) =>
  edge.conductors.every((conductor) => conductor.fromTerminalId !== "negative" && conductor.toTerminalId !== "negative")
));
console.log("PASS video conference terminal uses independent 3.5mm LINE IN and LINE OUT with bidirectional analog wiring");

const laptopAnalogProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  scope: "podium",
  microphoneSolution: "existingArray",
  computer: "笔记本电脑"
});
const laptopAnalogBase = buildModel(laptopAnalogProfile);
const laptopAnalogOutputs = {
  ...laptopAnalogBase.outputs,
  connectionLines: laptopAnalogBase.outputs.connectionLines.filter((line) =>
    line.fromDevice !== "笔记本电脑" && line.toDevice !== "笔记本电脑"
  )
};
const laptopAnalog = {
  outputs: laptopAnalogOutputs,
  model: buildInterfaceWiringModel({ profile: laptopAnalogProfile, outputs: laptopAnalogOutputs, brandId: "yinman" })
};
const laptopAnalogNode = node(laptopAnalog.model, "laptop-computer");
const headsetSplitterNode = node(laptopAnalog.model, "headset-splitter-laptop-computer");
assert.equal(laptopAnalogNode.productId, LAPTOP_PORT_PROFILE_ID);
assert.equal(headsetSplitterNode.productId, HEADSET_SPLITTER_PORT_PROFILE_ID);
const laptopAnalogLayout = getInterfaceWiringLayout(laptopAnalog.model, 1120);
const headsetSplitterPosition = laptopAnalogLayout.positions[headsetSplitterNode.id];
assert.equal(headsetSplitterPosition.width, 180);
assert.ok(getInterfacePanelImageRect(headsetSplitterNode, headsetSplitterPosition).width <= 160);
assert.deepEqual(laptopAnalogNode.ports.map((port) => port.capabilityId), ["headset"]);
assert.deepEqual(headsetSplitterNode.ports.map((port) => port.capabilityId).sort(), ["headphoneOut", "micIn", "trrs"]);
const splitterLink = laptopAnalog.model.edges.find((edge) => edge.id === "external-laptop-splitter-laptop-computer");
assert.ok(splitterLink);
assert.match(splitterLink.connectionMethod, /TRRS复合口必须先拆分.*禁止直接接普通3\.5mm口/);
assert.equal(laptopAnalog.model.edges.some((edge) =>
  (edge.fromNodeId === laptopAnalogNode.id || edge.toNodeId === laptopAnalogNode.id) &&
  edge.id !== "external-laptop-splitter-laptop-computer"
), false);
assert.equal(notebookUsb.model.nodes.some((item) => item.productId === HEADSET_SPLITTER_PORT_PROFILE_ID), false);
console.log("PASS laptop prefers USB Audio and requires an explicit headset splitter for analog fallback");

const opsAnalogProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  scope: "podium",
  microphoneSolution: "existingArray",
  computer: "ClassIn 一体机"
});
const opsAnalogBase = buildModel(opsAnalogProfile);
const opsAnalogOutputs = {
  ...opsAnalogBase.outputs,
  connectionLines: opsAnalogBase.outputs.connectionLines.filter((line) =>
    line.fromDevice !== "ClassIn 一体机" && line.toDevice !== "ClassIn 一体机"
  )
};
const opsAnalog = {
  outputs: opsAnalogOutputs,
  model: buildInterfaceWiringModel({ profile: opsAnalogProfile, outputs: opsAnalogOutputs, brandId: "yinman" })
};
const opsAnalogNode = node(opsAnalog.model, "classin-all-in-one");
assert.equal(opsAnalogNode.productId, OPS_ALL_IN_ONE_PORT_PROFILE_ID);
assert.deepEqual(opsAnalogNode.ports.map((port) => port.capabilityId).sort(), ["audioIn", "audioOut"]);
assert.equal(opsAnalog.model.edges.filter((edge) => edge.id.startsWith("external-computer-")).length, 2);
const meetingAllInOneUsb = buildModel(makeProfile({
  length: 8,
  width: 8,
  needs: ["interactiveClass"],
  scope: "full",
  microphoneSolution: "smallDisc01",
  computer: "会议一体机",
  smallDiscConnectionMode: "usb"
}));
assert.equal(node(meetingAllInOneUsb.model, "meeting-all-in-one").productId, OPS_ALL_IN_ONE_PORT_PROFILE_ID);
console.log("PASS ClassIn and meeting all-in-ones share the OPS panel, prefer USB Audio and retain analog input/output fallback");

const wiringPreviewSource = readFileSync("src/features/classroom/components/InterfaceWiringPreview.tsx", "utf8");
const wiringPreviewStyles = readFileSync("src/features/classroom/components/InterfaceWiringPreview.css", "utf8");
assert.doesNotMatch(wiringPreviewSource, /<marker\b|markerStart=|markerEnd=/);
assert.match(wiringPreviewSource, /external-podium-computer-panel\.svg/);
assert.match(wiringPreviewSource, /podiumComputer:\s*podiumComputerRearPanel/);
assert.match(wiringPreviewSource, /<td><ConnectionMethodCell value=\{edge\.connectionMethod\} \/><\/td>/);
assert.match(
  wiringPreviewSource,
  /function ConnectionMethodCell[\s\S]*?value\.indexOf\(WIRED_MIC_LINE_IN_POWER_NOTE\)[\s\S]*?<strong className="interfaceWiringInlineWarning">\{WIRED_MIC_LINE_IN_POWER_NOTE\}<\/strong>/
);
assert.match(wiringPreviewStyles, /\.interfaceWiringInlineWarning \{[\s\S]*?font-weight: 800;/);
assert.doesNotMatch(wiringPreviewSource, /\*\*[^*\r\n]*WIRED_MIC_LINE_IN_POWER_NOTE[^*\r\n]*\*\*/);
assert.match(wiringPreviewSource, /const recordingInputOptions:[\s\S]*?3\.5mm[\s\S]*?凤凰 \+\/-\/G[\s\S]*?凤凰 L\/R\/G/);
assert.match(wiringPreviewSource, /selections\[node\.id\] \?\? "balanced"/);
assert.match(wiringPreviewSource, /\[nodeId\]: mode/);
assert.match(wiringPreviewSource, /data-recording-input-option=\{option\.mode\}/);
assert.match(wiringPreviewSource, /option\.region\.x \/ 960 \* imageRect\.width/);
assert.match(wiringPreviewSource, /option\.region\.y \/ 260 \* imageRect\.height/);
assert.match(wiringPreviewSource, /LINE OUT 接 LINE IN；禁止接 MIC IN/);
assert.doesNotMatch(wiringPreviewSource, /interfaceWiringExternalControls/);
assert.doesNotMatch(wiringPreviewSource, /interfaceWiringSegmentedControl/);
assert.match(wiringPreviewStyles, /\.interfaceWiringPanelOptionButton \{[\s\S]*?position: absolute;/);
assert.match(wiringPreviewStyles, /\.interfaceWiringPanelOptionButton\.active \{[\s\S]*?border-color: #0b5cad;/);
assert.match(wiringPreviewSource, /getSharedTerminalFanOffset[\s\S]*?getTerminalFanPath/);
assert.match(wiringPreviewSource, /sharedIndexes\.length < 2/);
assert.match(wiringPreviewSource, /path: edge\.kind === "jumper" \? route\.path : getCompleteCableTrunkPath/);
assert.doesNotMatch(wiringPreviewSource, /laneOffset \+ conductorOffset/);
assert.match(wiringPreviewSource, /resolvedSide === "left"[\s\S]*?resolvedSide === "right"[\s\S]*?resolvedSide === "top"[\s\S]*?resolvedSide === "bottom"/);
assert.match(wiringPreviewSource, /if \(edge\.kind === "jumper"\) \{\s*return \[getCollapsedCableConductor/);
assert.match(wiringPreviewSource, /const bulge = 44 \+ laneOffset;[\s\S]*?const controlDistance = bulge \* 4 \/ 3/);
assert.match(wiringPreviewSource, /const rows = model\.edges\.flatMap/);
assert.match(wiringPreviewSource, /每根线一行，只列当前方案已用接口/);
assert.match(wiringPreviewSource, /设备（从 \/ 到）/);
assert.match(wiringPreviewSource, /接口（从 \/ 到）/);
assert.doesNotMatch(wiringPreviewSource, /data-reference-side/);
assert.match(wiringPreviewSource, /const progresses = \[0\.5, 0\.46, 0\.54/);
assert.match(wiringPreviewStyles, /\.interfaceWiringPortTable \{\s*max-height: none;\s*overflow: visible;/);
assert.doesNotMatch(wiringPreviewStyles, /\.interfaceWiringPortTable \{\s*max-height: 520px/);
assert.match(wiringPreviewStyles, /\.interfaceWiringLegendSwatch\.speaker,\s*\.interfaceWiringLegendSwatch\.audio \{[\s\S]*?background: #e2e8f0;/);
assert.match(wiringPreviewStyles, /\.interfaceWiringLegendSwatch\.speaker i:first-child,[\s\S]*?background: #dc2626;/);
assert.match(wiringPreviewStyles, /\.interfaceWiringLegendSwatch\.speaker i:nth-child\(2\),[\s\S]*?background: #ffffff;/);
assert.match(wiringPreviewStyles, /\.interfaceWiringLegendSwatch\.audio i:nth-child\(3\) \{\s*background: #6b7280;/);
assert.equal(getInterfaceWiringTableCableLabel("音箱线 ×2"), "音箱线");
assert.equal(getInterfaceWiringTableCableLabel("音箱线 ×2 ×2"), "音箱线");
assert.equal(getInterfaceWiringTableCableLabel("音频线 ×2"), "音频线");
assert.match(wiringPreviewSource, /getInterfaceWiringTableCableLabel\(edge\.cableType\)/);
assert.doesNotMatch(wiringPreviewSource, /edge\.cableType\}\{edge\.quantity/);
console.log("PASS each cable has one centered reference and one fully expanded from-to usage row");
console.log("PASS external recording selectors are independent and wiring SVG contains no arrows");

const overflowLines = Array.from({ length: 5 }, (_, index) => ({
  id: "test-line-out-" + (index + 1),
  fromDevice: "智能音频处理主机",
  fromPort: "Line Out / 模拟输出",
  toDevice: "外接音频终端" + (index + 1),
  toPort: "音频输入",
  cableType: "音频线",
  note: "接口容量测试"
}));
const overflowOutputs = {
  ...singleLine.outputs,
  connectionLines: [...singleLine.outputs.connectionLines, ...overflowLines]
};
const overflowModel = buildInterfaceWiringModel({
  profile: singleLineProfile,
  outputs: overflowOutputs,
  brandId: "yinman"
});
assert.equal(overflowModel.candidateProcessor, "AJ350");
assert.ok(overflowModel.findings.some((item) => item.code.startsWith("port-capacity.processor.lineOut") && item.severity === "hard"));
assert.equal(overflowModel.edges.filter((edge) => edge.id.startsWith("candidate-test-line-out-")).length, 4);
console.log("PASS interface exhaustion stops excess edges and reports a hard capacity finding");

const speakerEdge = smallDisc01.model.edges.find((edge) => edge.cableType.includes("音箱线"));
assert.ok(speakerEdge, "No field-terminated speaker cable was generated");
assert.deepEqual(
  speakerEdge.conductors.map((conductor) => [conductor.label, conductor.fromTerminalLabel, conductor.toTerminalLabel]),
  [["红线", "+", "+"], ["白线", "-", "-"]]
);
console.log("PASS speaker cable maps red + to + and white - to -");

const hangingProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["localAmplification"],
  scope: "podium",
  microphoneSolution: "hangingMic",
  teachingWidth: 8,
  teachingDepth: 4
});
const hanging = buildModel(hangingProfile, { [HANGING_MIC_PRODUCT_ID]: 2 });
const hangingNodes = hanging.model.nodes.filter((item) => item.productId === HANGING_MIC_PRODUCT_ID);
const hangingEdges = hanging.model.edges
  .filter((edge) => /^hanging-mic-\d+$/.test(edge.id))
  .sort((left, right) => left.id.localeCompare(right.id));
const hangingOutputLines = hanging.outputs.connectionLines.filter((line) => line.id.startsWith("hanging-mic-processor-"));
assert.deepEqual(
  hangingNodes.map((item) => [item.id, item.label, item.quantity, item.parentId]),
  [
    ["hanging-microphone-1", "吊麦 1", 1, "processor"],
    ["hanging-microphone-2", "吊麦 2", 1, "processor"]
  ]
);
assert.equal(hangingEdges.length, 2);
assert.equal(new Set(hangingEdges.map((edge) => edge.fromNodeId)).size, 2);
for (const [index, edge] of hangingEdges.entries()) {
  const targetNode = node(hanging.model, edge.toNodeId);
  const targetPort = targetNode.ports.find((port) => port.id === edge.toPortId);
  assert.ok(targetPort);
  assert.match(targetPort.capabilityId, /^mic\d+$/);
  assert.equal(targetPort.direction, "input");
  assert.equal(targetPort.label, "MIC IN " + (index + 1));
  assert.doesNotMatch(targetPort.capabilityId + " " + targetPort.label, /lineIn|LINE IN/i);
  assert.match(edge.connectionMethod, /卡侬母头/);
  assert.match(edge.connectionMethod, /MIC IN/);
  assert.doesNotMatch(edge.connectionMethod, /48V|供电/);
  assert.doesNotMatch(edge.connectionMethod, /LINE IN/);
}
assert.deepEqual(hangingOutputLines.map((line) => line.toPort), ["MIC IN 1", "MIC IN 2"]);
assert.ok(hangingOutputLines.every((line) => line.fromPort === "卡侬母头（XLR-3）"));
assert.ok(hangingOutputLines.every((line) => /卡侬母头/.test(line.note) && /MIC IN/.test(line.note) && !/48V|供电/.test(line.note)));
assert.equal(hangingOutputLines.some((line) => /LINE IN/.test(line.toPort + " " + line.note)), false);
assert.equal(hanging.model.findings.some((item) => /^interface-panel\.missing\.hanging-/.test(item.code)), false);
const balancedEdge = hangingEdges[0];
assert.ok(balancedEdge, "No hanging-microphone balanced cable was generated");
assert.deepEqual(
  balancedEdge.conductors.map((conductor) => [conductor.label, conductor.fromTerminalLabel, conductor.toTerminalLabel]),
  [["红线", "2 (+)", "+"], ["白线", "3 (-)", "-"], ["屏蔽线", "1 (G)", "G"]]
);
const hangingDeviceProfile = getDevicePortProfile(HANGING_MIC_PRODUCT_ID);
const hangingInterfacePanel = hangingDeviceProfile?.interfacePanel;
assert.ok(hangingDeviceProfile);
assert.ok(hangingInterfacePanel);
assert.deepEqual(
  hangingDeviceProfile.ports.map((port) => [port.id, port.panelLabel, port.interfaceType, port.direction]),
  [["xlr", "卡侬母头", "XLR-3 卡侬母头（1=G、2=+、3=-）", "output"]]
);
assert.equal(hangingInterfacePanel.assetKey, "hangingMic");
assert.equal(hangingInterfacePanel.aspectRatio, 760 / 1560);
assert.deepEqual(hangingInterfacePanel.portAnchors.xlr, {
  x: 380 / 760,
  y: 1430 / 1560,
  terminalAnchors: {
    pin2: { x: 345 / 760, y: 1400 / 1560 },
    pin3: { x: 415 / 760, y: 1400 / 1560 },
    pin1: { x: 380 / 760, y: 1455 / 1560 }
  }
});
const hangingPanelSvg = readFileSync("src/assets/yinman-hanging-mic-interface-panel.svg", "utf8");
assert.match(hangingPanelSvg, /viewBox="0 0 760 1560"/);
assert.doesNotMatch(hangingPanelSvg, /<image[\s>]/i);
const hangingPanelPaintValues = Array.from(
  hangingPanelSvg.matchAll(/(?:fill|stroke)\s*(?:=|:)\s*["']?([^;"'\s}]+)/gi),
  (match) => match[1]
);
assert.ok(hangingPanelPaintValues.length > 0);
for (const paintValue of hangingPanelPaintValues) {
  if (!paintValue.startsWith("#")) {
    assert.match(paintValue, /^(?:none|url\(#[\w-]+\))$/, "Unexpected hanging-microphone SVG paint " + paintValue);
    continue;
  }
  const rawHex = paintValue.slice(1);
  assert.match(rawHex, /^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  const rgb = rawHex.length <= 4
    ? rawHex.slice(0, 3).split("").map((value) => value + value)
    : [rawHex.slice(0, 2), rawHex.slice(2, 4), rawHex.slice(4, 6)];
  assert.equal(new Set(rgb.map((value) => value.toLowerCase())).size, 1, "Non-gray SVG paint " + paintValue);
}
assert.doesNotMatch(hangingPanelSvg, /\b(?:rgb|hsl)a?\s*\(/i);
assert.deepEqual(
  Array.from(hangingPanelSvg.matchAll(/<circle\s+id="(female-pin-[123]-hole)"\s+data-female-pin-hole="true"/g), (match) => match[1]).sort(),
  ["female-pin-1-hole", "female-pin-2-hole", "female-pin-3-hole"]
);
console.log("PASS two hanging microphones use separate XLR female panels and MIC IN ports without manual 48V instructions");

const wiredMicrophoneEdgeSort = (left, right) => left.id.localeCompare(right.id, "en", { numeric: true });
const getWiredMicrophoneEdges = (model) => model.edges
  .filter((edge) => edge.id.includes("processor-wired-mic-audio-"))
  .sort(wiredMicrophoneEdgeSort);
const getWiredMicrophoneLines = (outputs) => outputs.connectionLines
  .filter((line) => line.id.startsWith("processor-wired-mic-audio-"))
  .sort(wiredMicrophoneEdgeSort);
const getTargetPort = (model, edge) => node(model, edge.toNodeId).ports.find((port) => port.id === edge.toPortId);

const aj200WiredProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["localAmplification"],
  scope: "podium",
  microphoneSolution: "hangingMic",
  legacyWirelessMic: "有线麦克风",
  speakerProductOverride: "wall"
});
const aj200Wired = buildModel(aj200WiredProfile, {
  [HANGING_MIC_PRODUCT_ID]: 1,
  "COLUMN-SPEAKER": 4
});
assert.equal(aj200Wired.model.candidateProcessor, "AJ200");
const aj200HangingEdge = aj200Wired.model.edges.find((edge) => edge.id === "hanging-mic-1");
assert.ok(aj200HangingEdge);
assert.equal(aj200HangingEdge.cableType, "音频线");
assert.equal(getTargetPort(aj200Wired.model, aj200HangingEdge)?.capabilityId, "mic1");
const aj200WiredEdges = getWiredMicrophoneEdges(aj200Wired.model);
assert.equal(aj200WiredEdges.length, 1);
assert.equal(aj200WiredEdges[0].cableType, "音频线");
assert.equal(getTargetPort(aj200Wired.model, aj200WiredEdges[0])?.capabilityId, "mic2");
assert.equal(getTargetPort(aj200Wired.model, aj200WiredEdges[0])?.label, "MIC IN 2");
assert.match(aj200WiredEdges[0].connectionMethod, /卡侬母头.*MIC IN/);
assert.doesNotMatch(aj200WiredEdges[0].connectionMethod, /LINE IN|自供电|前级供电/);

const aj200ExhaustedOutputs = {
  ...aj200Wired.outputs,
  connectionLines: [
    ...aj200Wired.outputs.connectionLines,
    {
      ...getWiredMicrophoneLines(aj200Wired.outputs)[0],
      id: "processor-wired-mic-audio-2",
      fromDevice: "利旧有线麦克风 2"
    }
  ]
};
const aj200ExhaustedModel = buildInterfaceWiringModel({
  profile: aj200WiredProfile,
  outputs: aj200ExhaustedOutputs,
  brandId: "yinman"
});
assert.equal(getWiredMicrophoneEdges(aj200ExhaustedModel).length, 1);
assert.ok(aj200ExhaustedModel.findings.some((item) => item.code.startsWith("port-capacity.processor.mic.")));
assert.equal(
  getWiredMicrophoneEdges(aj200ExhaustedModel).some((edge) =>
    getTargetPort(aj200ExhaustedModel, edge)?.capabilityId.startsWith("lineIn")
  ),
  false
);

const aj600WiredProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["localAmplification"],
  scope: "podium",
  microphoneSolution: "hangingMic",
  legacyWirelessMic: "有线麦克风,有线麦克风",
  speakerProductOverride: "wall"
});
const aj600Wired = buildModel(aj600WiredProfile, {
  [HANGING_MIC_PRODUCT_ID]: 1,
  "COLUMN-SPEAKER": 5
});
assert.equal(aj600Wired.model.candidateProcessor, "AJ600");
const aj600HangingEdge = aj600Wired.model.edges.find((edge) => edge.id === "hanging-mic-1");
assert.ok(aj600HangingEdge);
assert.equal(getTargetPort(aj600Wired.model, aj600HangingEdge)?.capabilityId, "mic1");
const aj600WiredEdges = getWiredMicrophoneEdges(aj600Wired.model);
assert.deepEqual(
  aj600WiredEdges.map((edge) => {
    const targetPort = getTargetPort(aj600Wired.model, edge);
    return [targetPort?.capabilityId, targetPort?.label];
  }),
  [["mic2", "MIC IN 2"], ["mic3", "MIC IN 3"]]
);
assert.ok(aj600WiredEdges.every((edge) => /卡侬母头.*MIC IN/.test(edge.connectionMethod)));
assert.ok(aj600WiredEdges.every((edge) => !/LINE IN|自供电|前级供电/.test(edge.connectionMethod)));
const aj600WiredNodes = aj600Wired.model.nodes.filter(
  (item) => item.productId === EXTERNAL_WIRED_MICROPHONE_PORT_PROFILE_ID
);
assert.deepEqual(
  aj600WiredNodes.map((item) => [item.id, item.label, item.quantity, item.parentId]),
  [
    ["existing-wired-microphone-1", "利旧有线麦克风 1", 1, "processor"],
    ["existing-wired-microphone-2", "利旧有线麦克风 2", 1, "processor"]
  ]
);
assert.ok(aj600WiredNodes.every((item) =>
  item.ports.length === 1 && item.ports[0].capabilityId === "xlr" && item.ports[0].direction === "output"
));
assert.equal(new Set(aj600WiredEdges.map((edge) => edge.fromNodeId)).size, 2);

const aj350WiredProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["localAmplification"],
  scope: "podium",
  microphoneSolution: "lineArray",
  legacyWirelessMic: "有线麦克风"
});
const aj350Wired = buildModel(aj350WiredProfile, { "COLUMN-SPEAKER": 2 });
assert.equal(aj350Wired.model.candidateProcessor, "AJ350");
assert.equal(
  WIRED_MIC_LINE_IN_POWER_NOTE,
  "有线麦直连LINE IN时，需自供电或前级供电，仅提供音频信号。"
);
const aj350WiredLines = getWiredMicrophoneLines(aj350Wired.outputs);
const aj350WiredEdges = getWiredMicrophoneEdges(aj350Wired.model);
assert.equal(aj350WiredLines.length, 1);
assert.equal(aj350WiredEdges.length, 1);
assert.equal(aj350WiredLines[0].note.split(WIRED_MIC_LINE_IN_POWER_NOTE).length - 1, 1);
assert.equal(aj350WiredEdges[0].connectionMethod.split(WIRED_MIC_LINE_IN_POWER_NOTE).length - 1, 1);
assert.doesNotMatch(aj350WiredLines[0].note + aj350WiredEdges[0].connectionMethod, /\*\*/);
assert.equal(getTargetPort(aj350Wired.model, aj350WiredEdges[0])?.capabilityId, "lineIn1");
assert.equal(getTargetPort(aj350Wired.model, aj350WiredEdges[0])?.label, "LINE IN 1");
assert.doesNotMatch(getTargetPort(aj350Wired.model, aj350WiredEdges[0])?.capabilityId ?? "", /^mic\d+$/);

assert.deepEqual(
  aj200WiredEdges[0].conductors.map((conductor) => [
    conductor.fromTerminalId,
    conductor.toTerminalId,
    conductor.fromTerminalLabel,
    conductor.toTerminalLabel
  ]),
  [
    ["pin2", "positive", "2 (+)", "+"],
    ["pin3", "negative", "3 (-)", "-"],
    ["pin1", "ground", "1 (G)", "G"]
  ]
);

const wiredMicrophoneProfile = getDevicePortProfile(EXTERNAL_WIRED_MICROPHONE_PORT_PROFILE_ID);
const wiredMicrophonePanel = wiredMicrophoneProfile?.interfacePanel;
assert.ok(wiredMicrophoneProfile);
assert.ok(wiredMicrophonePanel);
assert.deepEqual(
  wiredMicrophoneProfile.ports.map((port) => [port.id, port.panelLabel, port.interfaceType, port.direction]),
  [["xlr", "卡侬母头", "XLR-3 卡侬母头（1=G、2=+、3=-）", "output"]]
);
assert.equal(wiredMicrophonePanel.assetKey, "wiredMicrophone");
assert.equal(wiredMicrophonePanel.aspectRatio, 760 / 1240);
assert.deepEqual(wiredMicrophonePanel.portAnchors.xlr, {
  x: 380 / 760,
  y: 1120 / 1240,
  terminalAnchors: {
    pin2: { x: 347 / 760, y: 1092 / 1240 },
    pin3: { x: 413 / 760, y: 1092 / 1240 },
    pin1: { x: 380 / 760, y: 1146 / 1240 }
  }
});
const wiredMicrophonePanelSvg = readFileSync("src/assets/external-wired-microphone-panel.svg", "utf8");
assert.match(wiredMicrophonePanelSvg, /viewBox="0 0 760 1240"/);
assert.doesNotMatch(wiredMicrophonePanelSvg, /<image[\s>]/i);
const wiredMicrophonePaintValues = Array.from(
  wiredMicrophonePanelSvg.matchAll(/(?:fill|stroke)\s*(?:=|:)\s*["']?([^;"'\s}]+)/gi),
  (match) => match[1]
);
assert.ok(wiredMicrophonePaintValues.length > 0);
for (const paintValue of wiredMicrophonePaintValues) {
  if (!paintValue.startsWith("#")) {
    assert.match(paintValue, /^(?:none|url\(#[\w-]+\))$/, "Unexpected wired-microphone SVG paint " + paintValue);
    continue;
  }
  const rawHex = paintValue.slice(1);
  assert.match(rawHex, /^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  const rgb = rawHex.length <= 4
    ? rawHex.slice(0, 3).split("").map((value) => value + value)
    : [rawHex.slice(0, 2), rawHex.slice(2, 4), rawHex.slice(4, 6)];
  assert.equal(new Set(rgb.map((value) => value.toLowerCase())).size, 1, "Non-gray SVG paint " + paintValue);
}
assert.doesNotMatch(wiredMicrophonePanelSvg, /\b(?:rgb|hsl)a?\s*\(/i);
assert.deepEqual(
  Array.from(
    wiredMicrophonePanelSvg.matchAll(/<circle\s+id="(wired-female-pin-[123]-hole)"\s+data-female-pin-hole="true"/g),
    (match) => match[1]
  ).sort(),
  ["wired-female-pin-1-hole", "wired-female-pin-2-hole", "wired-female-pin-3-hole"]
);
for (const result of [aj200Wired, aj600Wired, aj350Wired]) {
  const wiredNodeIds = new Set(result.model.nodes
    .filter((item) => item.productId === EXTERNAL_WIRED_MICROPHONE_PORT_PROFILE_ID)
    .map((item) => item.id));
  assert.ok(wiredNodeIds.size > 0);
  assert.equal(
    result.model.findings.some((item) =>
      item.code.startsWith("interface-panel.missing.") && wiredNodeIds.has(item.nodeId ?? item.code.slice("interface-panel.missing.".length))
    ),
    false
  );
}
console.log("PASS legacy wired microphones use individual grayscale XLR panels, free MIC IN ports and the exact AJ350 LINE IN power note");

const rj45Edge = ringCases.get(1).model.edges.find((edge) => edge.conductors.length === 8);
assert.ok(rj45Edge, "No T568B network cable was generated");
assert.deepEqual(
  rj45Edge.conductors.map((conductor, index) => [conductor.fromTerminalId, conductor.toTerminalId, conductor.label, index + 1]),
  Array.from({ length: 8 }, (_, index) => ["pin" + (index + 1), "pin" + (index + 1), (index + 1) + " " + ["白橙", "橙", "白绿", "蓝", "白蓝", "绿", "白棕", "棕"][index], index + 1])
);
console.log("PASS T568B network cable maps pins 1-8 straight through");

for (const profile of Object.values(devicePortCatalog)) {
  if (!profile.interfacePanel) continue;
  for (const [portId, portAnchor] of Object.entries(profile.interfacePanel.portAnchors)) {
    assert.ok(portAnchor.x >= 0 && portAnchor.x <= 1, profile.productId + ":" + portId + " x anchor is outside the panel");
    assert.ok(portAnchor.y >= 0 && portAnchor.y <= 1, profile.productId + ":" + portId + " y anchor is outside the panel");
    for (const [terminalId, terminalAnchor] of Object.entries(portAnchor.terminalAnchors ?? {})) {
      assert.ok(terminalAnchor.x >= 0 && terminalAnchor.x <= 1, profile.productId + ":" + portId + ":" + terminalId + " x anchor is outside the panel");
      assert.ok(terminalAnchor.y >= 0 && terminalAnchor.y <= 1, profile.productId + ":" + portId + ":" + terminalId + " y anchor is outside the panel");
    }
  }
}
const aj600Profile = getDevicePortProfile(PROCESSOR_AJ600_PORT_PROFILE_ID);
assert.ok(aj600Profile?.interfacePanel);
assert.equal(aj600Profile.interfacePanel.assetKey, "aj600");
assert.equal(aj600Profile.interfacePanel.aspectRatio, 724 / 124);
assert.match(aj600Profile.interfacePanel.source, /AJ600上面板/);
const aj600MicPorts = aj600Profile.ports.filter((port) => /^mic\d+$/.test(port.id));
assert.equal(aj600MicPorts.length, 6);
assert.deepEqual(new Set(aj600MicPorts.map((port) => port.physicalGroupId)), new Set(["mic-block"]));
assert.deepEqual(
  ["mic1", "lineIn1", "lineOut1"].flatMap((portId) =>
    ["positive", "negative", "ground"].map((terminalId) => [
      portId,
      terminalId,
      Number(aj600Profile.interfacePanel.portAnchors[portId].terminalAnchors[terminalId].x.toFixed(6)),
      Number(aj600Profile.interfacePanel.portAnchors[portId].terminalAnchors[terminalId].y.toFixed(6))
    ])
  ),
  [
    ["mic1", "positive", 0.143646, 0.451613],
    ["mic1", "negative", 0.157459, 0.451613],
    ["mic1", "ground", 0.171271, 0.451613],
    ["lineIn1", "positive", 0.29558, 0.451613],
    ["lineIn1", "negative", 0.309392, 0.451613],
    ["lineIn1", "ground", 0.323204, 0.451613],
    ["lineOut1", "positive", 0.412983, 0.451613],
    ["lineOut1", "negative", 0.426796, 0.451613],
    ["lineOut1", "ground", 0.440608, 0.451613]
  ]
);
const aj350Panel = getDevicePortProfile(PROCESSOR_AJ350_PORT_PROFILE_ID)?.interfacePanel;
assert.ok(aj350Panel);
const aj350Profile = getDevicePortProfile(PROCESSOR_AJ350_PORT_PROFILE_ID);
const aj350UsbPort = aj350Profile?.ports.find((port) => port.id === "usb");
const aj350PanelSvg = readFileSync("src/assets/yinman-aj350-interface-panel.svg", "utf8");
assert.equal(aj350UsbPort?.interfaceType, "USB Type-C");
assert.match(aj350PanelSvg, /aria-label="USB Type-C vertical"/);
assert.match(aj350PanelSvg, /class="hole" x="1198" y="84" width="14" height="38" rx="7"/);
assert.doesNotMatch(aj350PanelSvg, /aria-label="USB"><rect[^>]+rx="10"/);
assert.deepEqual(
  ["positive", "negative", "ground"].map((terminalId) => {
    const terminal = aj350Panel.portAnchors.lineOut1.terminalAnchors?.[terminalId];
    return [terminalId, Number(terminal?.x.toFixed(6)), Number(terminal?.y.toFixed(6))];
  }),
  [
    ["positive", 0.526814, 0.424757],
    ["negative", 0.542587, 0.424757],
    ["ground", 0.55836, 0.424757]
  ]
);
const podiumComputerProfile = getDevicePortProfile(COMPUTER_REAR_PANEL_PORT_PROFILE_ID);
assert.ok(podiumComputerProfile?.interfacePanel);
assert.equal(podiumComputerProfile.interfacePanel.assetKey, "podiumComputer");
assert.equal(podiumComputerProfile.interfacePanel.aspectRatio, 760 / 420);
assert.deepEqual(
  ["usbAudio", "audioOut", "audioIn", "headset"].map((portId) => {
    const port = podiumComputerProfile.ports.find((item) => item.id === portId);
    const portAnchor = podiumComputerProfile.interfacePanel.portAnchors[portId];
    return [portId, port?.panelLabel, port?.direction, port?.interfaceType, Number(portAnchor.x.toFixed(3)), Number(portAnchor.y.toFixed(3))];
  }),
  [
    ["usbAudio", "USB 2.0", "bidirectional", "USB-A 2.0（USB Audio一进一出、内置232串口信号）", 0.184, 0.367],
    ["audioOut", "LINE OUT", "output", "3.5mm TRS（L/R/G）", 0.447, 0.367],
    ["audioIn", "LINE IN", "input", "3.5mm TRS（L/R/G）", 0.671, 0.367],
    ["headset", "HEADSET", "bidirectional", "3.5mm TRRS", 0.868, 0.367]
  ]
);
assert.match(podiumComputerProfile.interfacePanel.source, /USB Audio和3\.5mm音频输入输出为主/);
const podiumComputerPanelSvg = readFileSync("src/assets/external-podium-computer-panel.svg", "utf8");
assert.match(podiumComputerPanelSvg, /viewBox="0 0 760 420"/);
assert.match(podiumComputerPanelSvg, />USB 2\.0<\/text>/);
assert.match(podiumComputerPanelSvg, />3\.5mm LINE OUT<\/text>/);
assert.match(podiumComputerPanelSvg, />3\.5mm LINE IN<\/text>/);
assert.match(podiumComputerPanelSvg, />3\.5mm HEADSET<\/text>/);
assert.doesNotMatch(podiumComputerPanelSvg, />USB AUDIO<\/text>|>PRIORITY<\/text>/);
assert.doesNotMatch(podiumComputerPanelSvg, /<image[\s>]/);
const podiumComputerLayout = getInterfaceWiringLayout(smallDiscUsb.model, 520);
const podiumComputerImageRect = getInterfacePanelImageRect(
  podiumComputer,
  podiumComputerLayout.positions[podiumComputer.id]
);
assert.ok(podiumComputerImageRect);
assert.ok(podiumComputerImageRect.width > podiumComputerImageRect.height);
assert.equal(Number((podiumComputerImageRect.width / podiumComputerImageRect.height).toFixed(4)), Number((760 / 420).toFixed(4)));
const externalPanelContracts = [
  [RECORDING_HOST_PORT_PROFILE_ID, "recordingLineInput", ["lineIn35", "lineInBalanced", "lineInLrg"]],
  [RECORDING_CAMERA_PORT_PROFILE_ID, "recordingLineInput", ["lineIn35", "lineInBalanced", "lineInLrg"]],
  [CONTROL_HOST_PORT_PROFILE_ID, "controlHost", ["rs232"]],
  [LAPTOP_PORT_PROFILE_ID, "laptop", ["usbAudio", "headset"]],
  [OPS_ALL_IN_ONE_PORT_PROFILE_ID, "opsAllInOne", ["usbAudio", "audioOut", "audioIn"]],
  [VIDEO_CONFERENCE_TERMINAL_PORT_PROFILE_ID, "conferenceTerminal", ["audioOut", "audioIn"]],
  [HEADSET_SPLITTER_PORT_PROFILE_ID, "headsetSplitter", ["trrs", "headphoneOut", "micIn"]]
];
for (const [productId, assetKey, portIds] of externalPanelContracts) {
  const profile = getDevicePortProfile(productId);
  assert.ok(profile?.interfacePanel, productId + " is missing its external interface panel");
  assert.equal(profile.interfacePanel.assetKey, assetKey);
  assert.equal(profile.interfacePanel.confirmed, true);
  assert.deepEqual(profile.ports.map((port) => port.id), portIds);
}
assert.deepEqual(
  getDevicePortProfile(CONTROL_HOST_PORT_PROFILE_ID)?.ports[0].terminals.map((terminal) => [terminal.id, terminal.label, terminal.color]),
  [["rx", "RX", "#22c55e"], ["tx", "TX", "#eab308"], ["ground", "GND", "#111827"]]
);
assert.deepEqual(
  getDevicePortProfile(RECORDING_HOST_PORT_PROFILE_ID)?.ports.map((port) =>
    [port.id, port.panelLabel, port.terminals.map((terminal) => terminal.label)]
  ),
  [
    ["lineIn35", "LINE IN（3.5mm）", ["L", "R", "G"]],
    ["lineInBalanced", "LINE IN（+/-/G）", ["+", "-", "G"]],
    ["lineInLrg", "LINE IN（L/R/G）", ["L", "R", "G"]]
  ]
);
const passiveSpeakerPanel = getDevicePortProfile(PASSIVE_SPEAKER_PORT_PROFILE_ID)?.interfacePanel;
assert.ok(passiveSpeakerPanel);
assert.equal(passiveSpeakerPanel.aspectRatio, 0.5);
assert.deepEqual([
  Number(passiveSpeakerPanel.portAnchors.terminals.x.toFixed(2)),
  Number(passiveSpeakerPanel.portAnchors.terminals.y.toFixed(2)),
  Number(passiveSpeakerPanel.portAnchors.terminals.terminalAnchors.positive.x.toFixed(2)),
  Number(passiveSpeakerPanel.portAnchors.terminals.terminalAnchors.negative.x.toFixed(2))
], [0.5, 0.64, 0.58, 0.42]);
assert.match(passiveSpeakerPanel.source, /完整背面接口重构工程图/);
const groupedSpeakerAnchors = Array.from({ length: 4 }, (_, index) =>
  getInterfacePanelPortAnchor(passiveSpeakerPanel, "terminals-direct-speaker-" + (index + 1), index, 4)
);
assert.deepEqual(groupedSpeakerAnchors.map((anchor) => [
  Number(anchor?.x.toFixed(2)),
  Number(anchor?.y.toFixed(2))
]), [
  [0.44, 0.6],
  [0.56, 0.6],
  [0.44, 0.68],
  [0.56, 0.68]
]);
const amplifierProfile = getDevicePortProfile(EXTERNAL_AMPLIFIER_PRODUCT_ID);
const amplifierPanel = amplifierProfile?.interfacePanel;
assert.ok(amplifierProfile);
assert.ok(amplifierPanel);
assert.equal(amplifierPanel.assetKey, "ap150");
assert.equal(amplifierPanel.aspectRatio, 1200 / 500);
assert.deepEqual(
  ["lineIn1", "lineIn2", "lineIn3", "lineIn4", "spk1", "spk2", "spk3", "spk4"].map((portId) => [
    portId,
    Number(amplifierPanel.portAnchors[portId].x.toFixed(6)),
    Number(amplifierPanel.portAnchors[portId].y.toFixed(6))
  ]),
  [
    ["lineIn1", 0.153333, 0.588],
    ["lineIn2", 0.153333, 0.748],
    ["lineIn3", 0.223333, 0.588],
    ["lineIn4", 0.223333, 0.748],
    ["spk1", 0.43, 0.444],
    ["spk2", 0.556667, 0.444],
    ["spk3", 0.685, 0.444],
    ["spk4", 0.811667, 0.444]
  ]
);
assert.deepEqual(
  ["positive", "negative", "ground"].map((terminalId) => {
    const terminal = amplifierPanel.portAnchors.lineIn1.terminalAnchors[terminalId];
    return [terminalId, Number(terminal.x.toFixed(6)), Number(terminal.y.toFixed(6))];
  }),
  [["positive", 0.133333, 0.588], ["negative", 0.153333, 0.588], ["ground", 0.173333, 0.588]]
);
assert.deepEqual(
  ["positive", "negative"].map((terminalId) => {
    const terminal = amplifierPanel.portAnchors.spk1.terminalAnchors[terminalId];
    return [terminalId, Number(terminal.x.toFixed(3)), Number(terminal.y.toFixed(3))];
  }),
  [["positive", 0.43, 0.256], ["negative", 0.43, 0.632]]
);
assert.match(amplifierPanel.source, /重构清晰工程图/);
const amplifierPanelSvg = readFileSync("src/assets/yinman-ap150-rear-panel.svg", "utf8");
assert.match(amplifierPanelSvg, /viewBox="0 0 1200 500"/);
assert.match(amplifierPanelSvg, /fill:#bbf7d0/);
assert.match(amplifierPanelSvg, /class="post positivePost"/);
assert.match(amplifierPanelSvg, /class="post negativePost"/);
const lineArrayPanel = getDevicePortProfile(LINE_ARRAY_PRODUCT_ID)?.interfacePanel;
assert.ok(lineArrayPanel);
assert.equal(lineArrayPanel.assetKey, "lineArray");
assert.deepEqual([
  Number(lineArrayPanel.portAnchors.rj45.x.toFixed(3)),
  Number(lineArrayPanel.portAnchors.rj45.y.toFixed(2))
], [0.505, 0.47]);
assert.match(lineArrayPanel.source, /用户提供SA110完整背面接线图/);
const lineArrayConverterProfile = getDevicePortProfile(LINE_ARRAY_MIC_CONVERTER_PRODUCT_ID);
const lineArrayConverterPanel = lineArrayConverterProfile?.interfacePanel;
assert.ok(lineArrayConverterProfile);
assert.ok(lineArrayConverterPanel);
assert.equal(lineArrayConverterPanel.assetKey, "lineArrayConverter");
assert.equal(lineArrayConverterPanel.aspectRatio, 760 / 280);
assert.equal(lineArrayConverterPanel.confirmed, true);
assert.deepEqual(
  lineArrayConverterProfile.ports.map((port) => [
    port.id,
    port.panelLabel,
    port.interfaceType,
    port.confirmed,
    port.terminals.map((terminal) => terminal.label)
  ]),
  [
    ["link", "LINK", "RJ45", true, ["1 白橙", "2 橙", "3 白绿", "4 蓝", "5 白蓝", "6 绿", "7 白棕", "8 棕"]],
    ["micOut1", "麦克风输出1", "6Pin凤凰端子（前3针：+/-/G）", true, ["+", "-", "G"]],
    ["micOut2", "麦克风输出2", "6Pin凤凰端子（后3针：+/-/G）", true, ["+", "-", "G"]]
  ]
);
assert.deepEqual(
  lineArrayConverterProfile.ports.filter((port) => port.id.startsWith("micOut")).map((port) => port.physicalGroupId),
  ["mic-output-block", "mic-output-block"]
);
assert.deepEqual(
  ["micOut1", "micOut2"].flatMap((portId) => ["positive", "negative", "ground"].map((terminalId) => [
    portId,
    terminalId,
    Number(lineArrayConverterPanel.portAnchors[portId].terminalAnchors[terminalId].x.toFixed(6)),
    Number(lineArrayConverterPanel.portAnchors[portId].terminalAnchors[terminalId].y.toFixed(3))
  ])),
  [
    ["micOut1", "positive", 0.521053, 0.475],
    ["micOut1", "negative", 0.590789, 0.475],
    ["micOut1", "ground", 0.660526, 0.475],
    ["micOut2", "positive", 0.730263, 0.475],
    ["micOut2", "negative", 0.8, 0.475],
    ["micOut2", "ground", 0.869737, 0.475]
  ]
);
assert.deepEqual(
  getInterfacePanelPortAnchor(lineArrayConverterPanel, "micOut1-1", 1, 3),
  lineArrayConverterPanel.portAnchors.micOut1
);
const firstRepeatedConverterAnchor = getInterfacePanelPortAnchor(lineArrayConverterPanel, "micOut1-1", 1, 6);
const secondRepeatedConverterAnchor = getInterfacePanelPortAnchor(lineArrayConverterPanel, "micOut1-2", 4, 6);
assert.ok(firstRepeatedConverterAnchor);
assert.ok(secondRepeatedConverterAnchor);
assert.equal(firstRepeatedConverterAnchor.x, secondRepeatedConverterAnchor.x);
assert.ok(firstRepeatedConverterAnchor.y < secondRepeatedConverterAnchor.y);
const repeatedConverterLayout = getInterfaceWiringLayout(twoLineWith02.model, 993);
const repeatedConverterRect = getInterfacePanelImageRect(
  node(twoLineWith02.model, "line-array-converter"),
  repeatedConverterLayout.positions["line-array-converter"]
);
assert.ok(repeatedConverterRect);
assert.equal(repeatedConverterRect.unitRects?.length, 2);
const firstConverterUnitRect = repeatedConverterRect.unitRects[0];
const secondConverterUnitRect = repeatedConverterRect.unitRects[1];
assert.ok(firstConverterUnitRect.y + firstConverterUnitRect.height < secondConverterUnitRect.y);
assert.ok(Math.abs(
  repeatedConverterRect.y + firstRepeatedConverterAnchor.y * repeatedConverterRect.height -
  (firstConverterUnitRect.y + lineArrayConverterPanel.portAnchors.micOut1.y * firstConverterUnitRect.height)
) < 0.001);
assert.ok(Math.abs(
  repeatedConverterRect.y + secondRepeatedConverterAnchor.y * repeatedConverterRect.height -
  (secondConverterUnitRect.y + lineArrayConverterPanel.portAnchors.micOut1.y * secondConverterUnitRect.height)
) < 0.001);
const converterPanelSvg = readFileSync("src/assets/yinman-line-array-converter-interface-panel.svg", "utf8");
assert.match(converterPanelSvg, /viewBox="0 0 760 280"/);
assert.deepEqual(
  Array.from(converterPanelSvg.matchAll(/class="terminal-label"[^>]*>([^<]+)<\/text>/g), (match) => match[1]),
  ["+", "-", "G", "+", "-", "G"]
);
for (const holeId of [
  "mic-out-1-positive-hole", "mic-out-1-negative-hole", "mic-out-1-ground-hole",
  "mic-out-2-positive-hole", "mic-out-2-negative-hole", "mic-out-2-ground-hole"
]) {
  assert.match(converterPanelSvg, new RegExp('id="' + holeId + '"'));
}
const wirelessReceiverPanel = getDevicePortProfile(WIRELESS_RECEIVER_PORT_PROFILE_ID)?.interfacePanel;
assert.ok(wirelessReceiverPanel);
assert.equal(wirelessReceiverPanel.assetKey, "wirelessReceiver");
assert.deepEqual(
  ["positive", "negative", "ground"].map((terminalId) => [
    terminalId,
    Number(wirelessReceiverPanel.portAnchors.balOut.terminalAnchors?.[terminalId].x.toFixed(3))
  ]),
  [["positive", 0.391], ["negative", 0.408], ["ground", 0.426]]
);
const reconstructedPanelFiles = [
  "external-conference-terminal-panel.svg",
  "external-control-host-rs232-panel.svg",
  "external-headset-splitter-panel.svg",
  "external-laptop-panel.svg",
  "external-ops-panel.svg",
  "external-podium-computer-panel.svg",
  "external-recording-line-input-panel.svg",
  "external-wired-microphone-panel.svg",
  "yinman-aj200-interface-panel.svg",
  "yinman-aj350-interface-panel.svg",
  "yinman-aj600-interface-panel.svg",
  "yinman-ap150-rear-panel.svg",
  "yinman-ring08-rear-panel.svg",
  "yinman-sa110-rear-panel.svg",
  "yinman-line-array-converter-interface-panel.svg",
  "yinman-ring01-interface-panel.svg",
  "yinman-ring03-interface-panel.svg",
  "yinman-ringof-a-interface-panel.svg",
  "yinman-passive-speaker-terminal.svg",
  "yinman-wireless-receiver-rear-panel.svg"
];
for (const fileName of reconstructedPanelFiles) {
  const artwork = readFileSync("src/assets/" + fileName, "utf8");
  assert.match(artwork, /<svg[\s>]/, fileName + " is not SVG artwork");
  assert.match(artwork, /viewBox="0 0 [0-9.]+ [0-9.]+"/, fileName + " has no stable viewBox");
  assert.doesNotMatch(artwork, /<image[\s>]/, fileName + " embeds a blurry raster image");
}
for (const fileName of reconstructedPanelFiles) {
  assert.match(wiringPreviewSource, new RegExp(fileName.replaceAll(".", "\\.")));
}
for (const fileName of [
  "yinman-aj200-interface-panel.svg",
  "yinman-aj350-interface-panel.svg",
  "yinman-aj600-interface-panel.svg"
]) {
  const processorPanelSvg = readFileSync("src/assets/" + fileName, "utf8");
  assert.match(processorPanelSvg, /aria-label="RS232 RX TX GND"/);
  assert.match(processorPanelSvg, />RX<\/text>/);
  assert.match(processorPanelSvg, />TX<\/text>/);
  assert.match(processorPanelSvg, />G<\/text>/);
}
const nodeLayerIndex = wiringPreviewSource.indexOf('className="interfaceWiringNodeObject"');
const trunkLayerIndex = wiringPreviewSource.indexOf('className="interfaceWiringEdgeTrunks"');
const leadLayerIndex = wiringPreviewSource.indexOf('className="interfaceWiringEdgeLeads"');
assert.ok(nodeLayerIndex >= 0 && nodeLayerIndex < trunkLayerIndex && trunkLayerIndex < leadLayerIndex);
assert.doesNotMatch(wiringPreviewSource, /interfaceWiringPortPin|markerEnd=/);
assert.doesNotMatch(wiringPreviewSource, /getNodeExitPoint/);
assert.match(wiringPreviewSource, /function getCorridorCableRoute/);
assert.match(wiringPreviewSource, /const corridorCandidates = deduplicateCorridorCandidates/);
assert.match(wiringPreviewSource, /route\.corridor/);
assert.match(wiringPreviewSource, /canvasHeight: layout\.height/);
assert.match(wiringPreviewSource, /if \(!edgeRouteStaysInsideDrawingFrame\(route, canvasWidth, canvasHeight\)\) continue;/);
assert.match(wiringPreviewSource, /DRAWING_FRAME_LEFT \+ CABLE_FRAME_CLEARANCE/);
assert.match(wiringPreviewSource, /canvasWidth - DRAWING_FRAME_RIGHT - CABLE_FRAME_CLEARANCE/);
assert.match(wiringPreviewSource, /INTERFACE_WIRING_MIN_LOGICAL_WIDTH = 993/);
assert.match(wiringPreviewSource, /Math\.max\(INTERFACE_WIRING_MIN_LOGICAL_WIDTH, availableWidth\)/);
assert.match(wiringPreviewSource, /const routedCableRoutes: CableRoute\[\] = \[\];/);
assert.match(wiringPreviewSource, /cableRouteConflictsWithReservations/);
assert.match(wiringPreviewSource, /CABLE_CORRIDOR_LANE_SPACING = 30/);
assert.match(wiringPreviewSource, /CABLE_CORRIDOR_CURVE_RATIO = 0\.5522848/);
assert.match(wiringPreviewSource, /data-corridor-x=/);
assert.match(wiringPreviewSource, /function getDeviceCableEscape/);
assert.match(wiringPreviewSource, /function getCableEscapeCommands/);
assert.match(wiringPreviewSource, /const multicore = conductors\.length > 1/);
assert.match(wiringPreviewSource, /multicore \? "#374151"/);
assert.match(wiringPreviewSource, /interfaceWiringConductorColorLabel/);
assert.doesNotMatch(wiringPreviewSource, /C \$\{fromSplit\.x\} \$\{route\.corridor\.fromY\}/);
console.log("PASS interface-panel anchors are normalized, physical rear panels are mapped and grouped speakers use a 2x2 anchor grid");

assert.equal(singleLine.model.findings.some((item) => item.code === "interface-panel.missing.line-array"), false);
assert.equal(oneLineWith02.model.findings.some((item) => item.code === "interface-panel.missing.line-array-converter"), false);
assert.equal(smallDisc01.model.findings.some((item) => item.code === "interface-panel.missing.small-disc-extender"), false);
assert.equal(smallDiscUsb.model.findings.some((item) => item.code === "interface-panel.missing." + podiumComputer.id), false);
console.log("PASS missing and partial interface images create review findings while confirmed panels including the line-array extender do not");

const crossingProfile = makeProfile({
  length: 14.3,
  width: 7.4,
  needs: ["localAmplification"],
  scope: "podium",
  microphoneSolution: "existingArray",
  computer: "讲台电脑",
  recordingHost: "录播主机"
});
const amplifierLayoutCase = buildModel(makeProfile({
  length: 10,
  width: 8,
  needs: ["localAmplification"],
  scope: "full",
  microphoneSolution: "smallDisc01"
}));
const amplifierLayoutNode = amplifierLayoutCase.model.nodes.find((item) => item.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID);
assert.ok(amplifierLayoutNode);
assert.equal(getInterfaceWiringLayout(amplifierLayoutCase.model, 993).positions[amplifierLayoutNode.id].width, 460);
const amplifierLayoutJumpers = amplifierLayoutCase.model.edges.filter((edge) => edge.kind === "jumper");
const amplifierLayoutSpkPorts = amplifierLayoutNode.ports.filter((port) => /^spk[1-4]$/.test(port.capabilityId));
assert.match(
  amplifierLayoutCase.model.edges.find((edge) =>
    (edge.fromNodeId === amplifierLayoutCase.model.rootNodeId && edge.toNodeId === amplifierLayoutNode.id) ||
    (edge.fromNodeId === amplifierLayoutNode.id && edge.toNodeId === amplifierLayoutCase.model.rootNodeId)
  )?.connectionMethod ?? "",
  /LINE IN 1驱动SPK1/
);
assert.equal(amplifierLayoutJumpers.length, Math.max(0, amplifierLayoutSpkPorts.length - 1));
const expectedAmplifierJumperRoutes = {
  1: [],
  2: [["lineIn1", "lineIn2", "left"]],
  3: [["lineIn1", "lineIn2", "left"], ["lineIn2", "lineIn3", "bottom"]],
  4: [["lineIn1", "lineIn2", "left"], ["lineIn2", "lineIn4", "bottom"], ["lineIn4", "lineIn3", "right"]]
}[amplifierLayoutSpkPorts.length];
assert.ok(expectedAmplifierJumperRoutes);
assert.deepEqual(
  amplifierLayoutJumpers.map((edge) => {
    const fromPort = amplifierLayoutNode.ports.find((port) => port.id === edge.fromPortId);
    const toPort = amplifierLayoutNode.ports.find((port) => port.id === edge.toPortId);
    return [
      fromPort?.capabilityId,
      toPort?.capabilityId,
      edge.jumperRoute,
      edge.cableType,
      edge.conductors.map((conductor) => [conductor.fromTerminalLabel, conductor.toTerminalLabel])
    ];
  }),
  expectedAmplifierJumperRoutes.map(([fromPort, toPort, route]) => [
    fromPort,
    toPort,
    route,
    "音频跳线",
    [["+", "+"], ["-", "-"], ["G", "G"]]
  ])
);
const amplifierClusterCase = buildModel(makeProfile({
  length: 8,
  width: 8,
  needs: ["localAmplification"],
  scope: "full",
  microphoneSolution: "lineArray",
  computer: "讲台电脑",
  recordingHost: "录播主机、中控主机",
  legacyWirelessMic: "无线手持麦克风"
}), { "COLUMN-SPEAKER": 10, "WIRELESS-HANDHELD": 1 });
const amplifierClusterNode = amplifierClusterCase.model.nodes.find((item) => item.productId === EXTERNAL_AMPLIFIER_PRODUCT_ID);
assert.ok(amplifierClusterNode);
const amplifierClusterSpeakers = amplifierClusterCase.model.nodes.filter((item) =>
  item.category === "speaker" && item.parentId === amplifierClusterNode.id
);
assert.ok(amplifierClusterSpeakers.length >= 1);
const amplifierClusterJumpers = amplifierClusterCase.model.edges.filter((edge) => edge.kind === "jumper");
assert.equal(
  amplifierClusterJumpers.length,
  amplifierClusterSpeakers.length - 1,
  "amplifier jumper count must follow the active amplifier speaker outputs"
);
assert.deepEqual(amplifierClusterJumpers.map((edge) => edge.connectionMethod), [
  "LINE IN 1跳接LINE IN 2，+/-/G一一对应；LINE IN 2驱动SPK2"
]);
const amplifierClusterLayout = getInterfaceWiringLayout(amplifierClusterCase.model, 993);
const amplifierClusterPosition = amplifierClusterLayout.positions[amplifierClusterNode.id];
const amplifierClusterRootPosition = amplifierClusterLayout.positions[amplifierClusterCase.model.rootNodeId];
const amplifierClusterAllSpeakers = amplifierClusterCase.model.nodes
  .filter((item) => item.category === "speaker")
  .sort((left, right) => left.ports[0].deviceSequenceRange.start - right.ports[0].deviceSequenceRange.start);
const amplifierClusterSpeakerPositions = amplifierClusterAllSpeakers.map((item) =>
  amplifierClusterLayout.positions[item.id]
);
assert.equal(
  new Set(amplifierClusterSpeakerPositions.map((item) => item.centerY)).size,
  1,
  "ten-speaker processor and amplifier groups must share one desktop row"
);
assert.ok(amplifierClusterAllSpeakers.some((item) => item.parentId === amplifierClusterCase.model.rootNodeId));
assert.ok(amplifierClusterAllSpeakers.some((item) => item.parentId === amplifierClusterNode.id));
for (let index = 1; index < amplifierClusterSpeakerPositions.length; index += 1) {
  assert.equal(
    amplifierClusterSpeakerPositions[index].x -
      (amplifierClusterSpeakerPositions[index - 1].x + amplifierClusterSpeakerPositions[index - 1].width),
    0
  );
}
const amplifierClusterSpeakerRowY = amplifierClusterSpeakerPositions[0].centerY;
assert.ok(amplifierClusterPosition.centerY < amplifierClusterSpeakerRowY);
assert.ok(amplifierClusterSpeakerRowY < amplifierClusterRootPosition.centerY);
assert.equal(
  Math.round(amplifierClusterSpeakerPositions[0].y - (amplifierClusterPosition.y + amplifierClusterPosition.height)),
  88
);
assert.equal(
  Math.round(amplifierClusterRootPosition.y -
    (amplifierClusterSpeakerPositions[0].y + amplifierClusterSpeakerPositions[0].height)),
  88
);
for (const directChild of amplifierClusterCase.model.nodes.filter((item) =>
  item.parentId === amplifierClusterCase.model.rootNodeId &&
  item.id !== amplifierClusterNode.id &&
  item.category !== "speaker"
)) {
  const position = amplifierClusterLayout.positions[directChild.id];
  assert.ok(
    position.y >= amplifierClusterRootPosition.y + amplifierClusterRootPosition.height,
    directChild.id + " must stay on the opposite side of the amplifier-speaker-processor cluster"
  );
}

const sixteenSpeakerCase = buildModel(makeProfile({
  length: 8,
  width: 8,
  needs: ["localAmplification"],
  scope: "podium",
  microphoneSolution: "hangingMic",
  computer: "讲台电脑",
  recordingHost: "录播主机、中控主机"
}), { [HANGING_MIC_PRODUCT_ID]: 1, "COLUMN-SPEAKER": 16 });
const sixteenSpeakerAmplifier = node(sixteenSpeakerCase.model, "amplifier");
const sixteenSpeakerGroups = sixteenSpeakerCase.model.nodes
  .filter((item) => item.category === "speaker")
  .sort((left, right) => left.ports[0].deviceSequenceRange.start - right.ports[0].deviceSequenceRange.start);
assert.equal(sixteenSpeakerGroups.length, 8);
assert.ok(sixteenSpeakerGroups.every((item) => item.quantity === 2));
assert.deepEqual(
  sixteenSpeakerGroups.map((item) => item.ports[0].deviceSequenceRange),
  Array.from({ length: 8 }, (_, index) => ({ start: index * 2 + 1, end: index * 2 + 2 }))
);
const sixteenSpeakerDesktopLayout = getInterfaceWiringLayout(sixteenSpeakerCase.model, 993);
const sixteenSpeakerDesktopPositions = sixteenSpeakerGroups.map((item) => sixteenSpeakerDesktopLayout.positions[item.id]);
assert.equal(
  new Set(sixteenSpeakerDesktopPositions.map((item) => item.centerY)).size,
  1,
  "eight speaker icons must share one desktop row"
);
assert.ok(
  sixteenSpeakerDesktopLayout.positions[sixteenSpeakerAmplifier.id].centerY < sixteenSpeakerDesktopPositions[0].centerY &&
  sixteenSpeakerDesktopPositions[0].centerY < sixteenSpeakerDesktopLayout.positions[sixteenSpeakerCase.model.rootNodeId].centerY
);
const sixteenSpeakerNarrowLayout = getInterfaceWiringLayout(sixteenSpeakerCase.model, 520);
const sixteenSpeakerNarrowRows = Object.values(sixteenSpeakerGroups.reduce((rows, item) => {
  const y = sixteenSpeakerNarrowLayout.positions[item.id].centerY;
  rows[y] = [...(rows[y] ?? []), item];
  return rows;
}, {}));
assert.deepEqual(sixteenSpeakerNarrowRows.map((row) => row.length).sort((left, right) => right - left), [4, 4]);

const ninthSpeakerSource = sixteenSpeakerGroups[7];
const ninthSpeakerNode = {
  ...ninthSpeakerSource,
  id: "layout-only-speaker-group-9",
  parentId: sixteenSpeakerCase.model.rootNodeId,
  ports: ninthSpeakerSource.ports.map((port) => ({
    ...port,
    id: "layout-only-speaker-group-9:terminals",
    nodeId: "layout-only-speaker-group-9",
    deviceSequenceRange: { start: 17, end: 18 }
  }))
};
const nineIconLayout = getInterfaceWiringLayout({
  ...sixteenSpeakerCase.model,
  nodes: [...sixteenSpeakerCase.model.nodes, ninthSpeakerNode]
}, 1120);
const nineIconRows = [...sixteenSpeakerGroups, ninthSpeakerNode].reduce((rows, item) => {
  const y = nineIconLayout.positions[item.id].centerY;
  rows[y] = (rows[y] ?? 0) + 1;
  return rows;
}, {});
assert.deepEqual(Object.values(nineIconRows).sort((left, right) => right - left), [8, 1]);
console.log("PASS processor and amplifier speakers form one ordered band with at most eight speaker icons per row");

const crossingCase = buildModel(crossingProfile);
const crossingLayout = getInterfaceWiringLayout(crossingCase.model, 993);
const crossingComputer = crossingCase.model.nodes.find((item) => item.label === "讲台电脑");
assert.ok(crossingComputer);
const crossingSpeakerGroups = crossingCase.model.nodes.filter((item) => item.category === "speaker");
assert.equal(crossingSpeakerGroups.length, 4);
const crossingSpeakerPositions = crossingSpeakerGroups.map((item) => crossingLayout.positions[item.id]);
assert.equal(new Set(crossingSpeakerPositions.map((item) => item.centerY)).size, 1);
assert.ok(crossingSpeakerPositions[0].centerY < crossingLayout.positions[crossingCase.model.rootNodeId].centerY);
assert.ok(crossingLayout.positions[crossingComputer.id].centerY > crossingLayout.positions[crossingCase.model.rootNodeId].centerY);
for (let index = 1; index < crossingSpeakerPositions.length; index += 1) {
  assert.equal(crossingSpeakerPositions[index].x - (crossingSpeakerPositions[index - 1].x + crossingSpeakerPositions[index - 1].width), 0);
}
console.log("PASS compact speaker groups stay ordered while unrelated devices remain beyond the processor row");

const crossingReferences = getInterfaceWiringPortReferenceNumbers(crossingCase.model);
const crossingPorts = crossingCase.model.nodes.flatMap((item) => item.ports);
assert.deepEqual(
  crossingCase.model.edges.map((edge) => [crossingReferences[edge.fromPortId], crossingReferences[edge.toPortId]]),
  Array.from({ length: crossingCase.model.edges.length }, (_, index) => [index + 1, index + 1])
);
assert.equal(crossingPorts.length, crossingCase.model.edges.length * 2);
for (let reference = 1; reference <= crossingCase.model.edges.length; reference += 1) {
  assert.equal(crossingPorts.filter((port) => crossingReferences[port.id] === reference).length, 2);
}
assert.deepEqual(crossingSpeakerGroups.map((item) => item.quantity), [2, 2, 1, 1]);
assert.ok(crossingSpeakerGroups.every((item) => item.ports.length === 1));
assert.deepEqual(crossingSpeakerGroups.map((item) => item.ports[0].deviceSequenceRange), [
  { start: 1, end: 2 },
  { start: 3, end: 4 },
  { start: 5, end: 5 },
  { start: 6, end: 6 }
]);
assert.deepEqual(crossingSpeakerGroups.map((item) => getInterfaceWiringUsageDeviceLabel(item, item.ports[0])), [
  "壁挂音箱 1-2 ×2",
  "壁挂音箱 3-4 ×2",
  "壁挂音箱 5",
  "壁挂音箱 6"
]);
const ceilingSpeakerCase = buildModel(makeProfile({
  length: 10,
  width: 8,
  needs: ["localAmplification"],
  scope: "full",
  speakerProductOverride: "ceiling"
}));
const ceilingSpeakerGroups = ceilingSpeakerCase.model.nodes.filter((item) => item.category === "speaker");
assert.ok(ceilingSpeakerGroups.length > 1);
assert.ok(ceilingSpeakerGroups.every((item) => item.label.includes("吸顶音箱") && item.ports.length === 1));
console.log("PASS each cable shares one endpoint reference while wall and ceiling speakers split into compact SPK groups");

const models = [
  ...Array.from(ringCases.values()).map((item) => item.model),
  singleLine.model,
  oneLineWith02.model,
  twoLine.model,
  twoLineWith02.model,
  smallDisc01.model,
  smallDisc03.model,
  smallDiscUsb.model,
  wireless.model,
  unknownPort.model,
  recordingBalanced.model,
  recordingMixed.model,
  smallDiscDualRecording.model,
  controlHost.model,
  conferenceTerminal.model,
  laptopAnalog.model,
  opsAnalog.model,
  overflowModel,
  hanging.model,
  aj200Wired.model,
  aj600Wired.model,
  aj350Wired.model,
  crossingCase.model,
  amplifierClusterCase.model,
  sixteenSpeakerCase.model
];
for (const model of models) {
  assertNoDuplicatePortOccupancy(model);
  assertNoPowerEdges(model);
  assert.equal(new Set(model.nodes.map((item) => item.id)).size, model.nodes.length, "Duplicate wiring nodes");
}
const deterministicModel = buildModel(oneLineWith02Profile).model;
assert.deepEqual(deterministicModel, oneLineWith02.model);
assert.deepEqual(getInterfaceWiringLayout(deterministicModel), getInterfaceWiringLayout(oneLineWith02.model));
console.log("PASS unique ports, no power lines, no duplicate nodes and deterministic output");

function assertLayoutFitsWidth(model, width) {
  const layout = getInterfaceWiringLayout(model, width);
  assert.equal(layout.width, width, "Wiring canvas must keep the browser-provided width");
  const rectangles = Object.entries(layout.positions).map(([id, position]) => ({ id, ...position }));
  for (const rectangle of rectangles) {
    assert.ok(rectangle.x >= 0, rectangle.id + " starts outside the left canvas edge");
    assert.ok(rectangle.x + rectangle.width <= layout.width, rectangle.id + " exceeds the right canvas edge");
    assert.ok(rectangle.y >= 0, rectangle.id + " starts above the drawing title band");
    assert.ok(rectangle.y + rectangle.height <= layout.height, rectangle.id + " exceeds the bottom canvas edge");
  }
  for (let index = 0; index < rectangles.length; index += 1) {
    const left = rectangles[index];
    for (const right of rectangles.slice(index + 1)) {
      const overlaps = !(
        left.x + left.width <= right.x ||
        right.x + right.width <= left.x ||
        left.y + left.height <= right.y ||
        right.y + right.height <= left.y
      );
      assert.equal(overlaps, false, left.id + " overlaps " + right.id + " at canvas width " + width);
    }
  }
  assert.equal(layout.positions[model.rootNodeId]?.centerX, width / 2, "Level-one device must remain horizontally centered");
}

for (const width of [520, 993, 1120]) {
  for (const model of [
    oneLineWith02.model,
    smallDisc01.model,
    smallDisc03.model,
    smallDiscUsb.model,
    wireless.model,
    amplifierClusterCase.model,
    sixteenSpeakerCase.model,
    aj200Wired.model,
    aj600Wired.model,
    aj350Wired.model
  ]) {
    assertLayoutFitsWidth(model, width);
    assert.deepEqual(getInterfaceWiringLayout(model, width), getInterfaceWiringLayout(model, width));
  }
}
console.log("PASS responsive wiring layouts stay within browser width without node overlap");
`;

const result = await build({
  stdin: {
    contents: testModule,
    loader: "ts",
    resolveDir: process.cwd(),
    sourcefile: "interface-wiring-rule-check.ts"
  },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  write: false,
  loader: { ".png": "dataurl" },
  logLevel: "silent"
});

const bundledCode = result.outputFiles[0]?.text;
if (!bundledCode) throw new Error("Interface wiring test bundle was empty.");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundledCode).toString("base64")}`;
await import(moduleUrl);
