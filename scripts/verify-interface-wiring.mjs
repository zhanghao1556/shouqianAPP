import { build } from "esbuild";

const testModule = String.raw`
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createInitialProfile } from "./src/features/classroom/data/initialProfile.ts";
import { generateEngineeringOutputs } from "./src/features/classroom/lib/engineeringRules.ts";
import {
  buildInterfaceWiringModel,
  getInterfacePanelPortAnchor,
  getInterfacePanelImageRect,
  getInterfaceWiringLayout,
  getInterfaceWiringLogicalTerminalOffset,
  getInterfaceWiringLogicalTerminals,
  getInterfaceWiringPortReferenceNumbers,
  getInterfaceWiringTableCableLabel,
  getInterfaceWiringUsageDeviceLabel
} from "./src/features/classroom/lib/interfaceWiring.ts";
import { normalizeProfile } from "./src/features/classroom/lib/profileNormalization.ts";
import { filterUsbExclusiveAudioLines } from "./src/features/classroom/lib/connectionRules.ts";
import { getExistingMicInputDemand } from "./src/features/classroom/lib/hangingMicRules.ts";
import { LINE_ARRAY_PRODUCT_ID } from "./src/features/classroom/lib/lineArrayRules.ts";
import { EXTERNAL_AMPLIFIER_PRODUCT_ID } from "./src/features/classroom/lib/speakerRules.ts";
import {
  COMPUTER_REAR_PANEL_PORT_PROFILE_ID,
  PROCESSOR_AJ350_PORT_PROFILE_ID,
  PROCESSOR_AJ600_PORT_PROFILE_ID,
  PASSIVE_SPEAKER_PORT_PROFILE_ID,
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

function buildModel(profile, overrides = {}) {
  const outputs = generateEngineeringOutputs(profile, overrides, "yinman");
  return {
    outputs,
    model: buildInterfaceWiringModel({ profile, outputs, brandId: "yinman" })
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
  for (const wiringNode of model.nodes) {
    const capabilityIds = wiringNode.ports.map((port) => port.capabilityId);
    assert.equal(new Set(capabilityIds).size, capabilityIds.length, "Duplicate occupied port on " + wiringNode.id);
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
  assert.equal(node(model, "ring08").quantity, count);
  assert.deepEqual(
    processorPortLabels(model).filter((label) => label === "A1" || label === "A2"),
    count === 1 ? ["A1"] : ["A1", "A2"]
  );
}
console.log("PASS RING08 uses one AJ350 and A1/A2 for one or two microphones");

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
assert.match(usbEdge.connectionMethod, /USB Audio一进一出.*RS232/);
assert.match(
  smallDiscUsb.outputs.connectionLines.find((line) => line.id === "small-disc-01-usb-host")?.note ?? "",
  /USB Audio一进一出.*RS232/
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
assert.ok(invalidUsbModel.findings.some((item) => item.code.startsWith("usb.invalid-target") && item.severity === "hard"));
assert.equal(invalidUsbModel.edges.some((edge) => edge.id.includes("test-invalid-usb-target")), false);
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
assert.notEqual(notebookNode.productId, COMPUTER_REAR_PANEL_PORT_PROFILE_ID);
assert.ok(notebookUsb.model.findings.some((item) => item.code === "interface-panel.missing." + notebookNode.id));
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
assert.equal(allInOneNode.productId, COMPUTER_REAR_PANEL_PORT_PROFILE_ID);
assert.equal(allInOneNode.ports.find((port) => port.capabilityId === "usbAudio")?.label, "USB 2.0");
assert.equal(allInOneUsb.model.findings.some((item) => item.code === "interface-panel.missing." + allInOneNode.id), false);
console.log("PASS USB audio only connects to a computer or all-in-one and invalid targets are blocked");

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
    assert.deepEqual([lineArrayPosition.width, wirelessReceiverPosition.width], [460, 460]);
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

const unknownPortProfile = makeProfile({
  length: 8,
  width: 8,
  needs: ["videoConference"],
  scope: "podium",
  microphoneSolution: "lineArray",
  computer: "讲台电脑",
  recordingHost: "中控主机"
});
const unknownPort = buildModel(unknownPortProfile);
assert.ok(unknownPort.model.findings.some((item) => item.code.startsWith("external-port.") && item.severity === "review"));
assert.ok(unknownPort.model.nodes.some((item) => item.ports.some((port) => !port.confirmed && port.label.includes("需复核"))));
const unknownControlHost = unknownPort.model.nodes.find((item) => item.label === "中控主机");
assert.ok(unknownControlHost?.ports.some((port) => !port.confirmed));
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
const usbExclusiveModel = buildInterfaceWiringModel({
  profile: smallDiscUsbProfile,
  outputs: { ...smallDiscUsb.outputs, connectionLines: usbExclusiveLines },
  brandId: "yinman"
});
const usbExclusiveComputer = usbExclusiveModel.nodes.find((item) => item.label === "讲台电脑");
assert.ok(usbExclusiveComputer);
assert.deepEqual(usbExclusiveComputer.ports.map((port) => port.capabilityId), ["usbAudio"]);
console.log("PASS podium computer uses confirmed USB, line-input and line-output rear-panel ports");

const recordingLineOutOutputs = {
  ...singleLine.outputs,
  connectionLines: [
    ...singleLine.outputs.connectionLines,
    {
      id: "test-line-out-recording",
      fromDevice: "智能音频处理主机",
      fromPort: "LINE OUT / 模拟输出",
      toDevice: "录播主机",
      toPort: "音频输入",
      cableType: "音频线",
      note: "双端线芯落点测试"
    }
  ]
};
const recordingLineOutModel = buildInterfaceWiringModel({
  profile: singleLineProfile,
  outputs: recordingLineOutOutputs,
  brandId: "yinman"
});
const recordingLineOutEdge = recordingLineOutModel.edges.find((edge) => edge.id === "candidate-test-line-out-recording");
assert.ok(recordingLineOutEdge);
const recordingInputPort = recordingLineOutModel.nodes
  .flatMap((item) => item.ports)
  .find((port) => port.id === recordingLineOutEdge.toPortId);
assert.ok(recordingInputPort);
assert.equal(recordingInputPort.confirmed, false);
assert.deepEqual(
  getInterfaceWiringLogicalTerminals(recordingInputPort.terminals).map((terminal) => [terminal.id, terminal.label]),
  [["positive", "+"], ["negative", "-"], ["ground", "G"]]
);
assert.deepEqual(
  recordingLineOutEdge.conductors.map((conductor) => [
    conductor.label,
    conductor.color,
    conductor.fromTerminalLabel,
    conductor.toTerminalLabel
  ]),
  [
    ["红线", "#dc2626", "+", "+"],
    ["白线", "#ffffff", "-", "-"],
    ["屏蔽线", "#64748b", "G", "G"]
  ]
);
const recordingTerminalOffsets = recordingLineOutEdge.conductors.map((conductor) =>
  getInterfaceWiringLogicalTerminalOffset(recordingInputPort.terminals, conductor.toTerminalId, { x: -100, y: 0 })
);
assert.equal(new Set(recordingTerminalOffsets.map((offset) => offset.x + ":" + offset.y)).size, 3);
const wiringPreviewSource = readFileSync("src/features/classroom/components/InterfaceWiringPreview.tsx", "utf8");
const wiringPreviewStyles = readFileSync("src/features/classroom/components/InterfaceWiringPreview.css", "utf8");
assert.doesNotMatch(wiringPreviewSource, /<marker\b|markerStart=|markerEnd=/);
assert.match(wiringPreviewSource, /podium-computer-rear-panel\.png/);
assert.match(wiringPreviewSource, /podiumComputer:\s*podiumComputerRearPanel/);
assert.match(wiringPreviewSource, /音频双向；RS232调试/);
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
assert.equal(getInterfaceWiringTableCableLabel("麦克风音频线"), "麦克风音频线");
assert.match(wiringPreviewSource, /getInterfaceWiringTableCableLabel\(edge\.cableType\)/);
assert.doesNotMatch(wiringPreviewSource, /edge\.cableType\}\{edge\.quantity/);
console.log("PASS each cable has one centered reference and one fully expanded from-to usage row");
console.log("PASS LINE OUT maps +, -, G to three distinct review heads and wiring SVG contains no arrows");

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
const hanging = buildModel(hangingProfile);
const balancedEdge = hanging.model.edges.find((edge) => edge.id.startsWith("hanging-mic-"));
assert.ok(balancedEdge, "No hanging-microphone balanced cable was generated");
assert.deepEqual(
  balancedEdge.conductors.map((conductor) => [conductor.label, conductor.fromTerminalLabel, conductor.toTerminalLabel]),
  [["红线", "2 (+)", "+"], ["白线", "3 (-)", "-"], ["屏蔽线", "1 (G)", "G"]]
);
console.log("PASS balanced microphone cable maps positive, negative and ground conductors");

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
assert.equal(podiumComputerProfile.interfacePanel.aspectRatio, 357 / 1123);
assert.deepEqual(
  ["usbAudio", "audioOut", "audioIn", "headset"].map((portId) => {
    const port = podiumComputerProfile.ports.find((item) => item.id === portId);
    const portAnchor = podiumComputerProfile.interfacePanel.portAnchors[portId];
    return [portId, port?.panelLabel, port?.direction, port?.interfaceType, Number(portAnchor.x.toFixed(3)), Number(portAnchor.y.toFixed(3))];
  }),
  [
    ["usbAudio", "USB 2.0", "bidirectional", "USB-A 2.0（USB Audio一进一出、内置RS232调试）", 0.295, 0.225],
    ["audioOut", "LINE OUT", "output", "3.5mm", 0.228, 0.911],
    ["audioIn", "LINE IN", "input", "3.5mm", 0.518, 0.911],
    ["headset", "HEADSET", "bidirectional", "3.5mm TRRS", 0.808, 0.911]
  ]
);
assert.match(podiumComputerProfile.interfacePanel.source, /左上角接口面板说明书式裁切线稿.*一体机共用显示/);
const podiumComputerPanelPng = readFileSync("src/assets/podium-computer-rear-panel.png");
assert.deepEqual(Array.from(podiumComputerPanelPng.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
assert.equal(podiumComputerPanelPng.readUInt32BE(16), 357);
assert.equal(podiumComputerPanelPng.readUInt32BE(20), 1123);
assert.equal(
  createHash("sha256").update(podiumComputerPanelPng).digest("hex"),
  "a4e4eafb3d7605cbc50f377d5d4c589b4f969782aeaabf09b50e0c23889e9afa"
);
const podiumComputerLayout = getInterfaceWiringLayout(smallDiscUsb.model, 520);
const podiumComputerImageRect = getInterfacePanelImageRect(
  podiumComputer,
  podiumComputerLayout.positions[podiumComputer.id]
);
assert.ok(podiumComputerImageRect);
assert.equal(Number(podiumComputerImageRect.width.toFixed(1)), 69.9);
assert.equal(podiumComputerImageRect.height, 220);
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
const nodeLayerIndex = wiringPreviewSource.indexOf('className="interfaceWiringNodeObject"');
const trunkLayerIndex = wiringPreviewSource.indexOf('className="interfaceWiringEdgeTrunks"');
const leadLayerIndex = wiringPreviewSource.indexOf('className="interfaceWiringEdgeLeads"');
assert.ok(nodeLayerIndex >= 0 && nodeLayerIndex < trunkLayerIndex && trunkLayerIndex < leadLayerIndex);
assert.doesNotMatch(wiringPreviewSource, /interfaceWiringPortPin|markerEnd=/);
assert.doesNotMatch(wiringPreviewSource, /getNodeExitPoint/);
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
const crossingCase = buildModel(crossingProfile);
const crossingLayout = getInterfaceWiringLayout(crossingCase.model, 993);
const crossingComputer = crossingCase.model.nodes.find((item) => item.label === "讲台电脑");
assert.ok(crossingComputer);
const crossingSpeakerGroups = crossingCase.model.nodes.filter((item) => item.category === "speaker");
assert.equal(crossingSpeakerGroups.length, 4);
assert.ok(crossingSpeakerGroups.every((item) => crossingLayout.positions[item.id].centerX < crossingLayout.positions[crossingComputer.id].centerX));
const crossingSpeakerPositions = crossingSpeakerGroups.map((item) => crossingLayout.positions[item.id]);
assert.equal(new Set(crossingSpeakerPositions.map((item) => item.centerY)).size, 1);
assert.equal(crossingLayout.positions[crossingComputer.id].centerY, crossingSpeakerPositions[0].centerY);
assert.equal(
  crossingCase.model.nodes.filter((item) =>
    item.level === 2 && crossingLayout.positions[item.id].centerY === crossingSpeakerPositions[0].centerY
  ).length,
  5
);
for (let index = 1; index < crossingSpeakerPositions.length; index += 1) {
  assert.equal(crossingSpeakerPositions[index].x - (crossingSpeakerPositions[index - 1].x + crossingSpeakerPositions[index - 1].width), 0);
}
console.log("PASS portrait level-two devices stay together and SPK child groups remain compact on the root-port side");

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
  recordingLineOutModel,
  overflowModel,
  hanging.model,
  crossingCase.model
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
  for (const model of [oneLineWith02.model, smallDisc01.model, smallDisc03.model, smallDiscUsb.model, wireless.model]) {
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
