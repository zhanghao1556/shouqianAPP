import arrayMicMainPanel from "../../../assets/yinyi-array-mic-main-rear-panel.svg";
import arrayMicSlavePanel from "../../../assets/yinyi-array-mic-slave-rear-panel.svg";
import aj200InterfacePanel from "../../../assets/yinman-aj200-interface-panel.svg";
import aj600InterfacePanel from "../../../assets/yinman-aj600-interface-panel.svg";
import amplifierRearPanel from "../../../assets/yinman-ap150-rear-panel.svg";
import lineArrayRearPanel from "../../../assets/yinman-sa110-rear-panel.svg";
import lineArrayConverterPanel from "../../../assets/yinman-line-array-converter-interface-panel.svg";
import passiveSpeakerTerminal from "../../../assets/yinman-passive-speaker-terminal.svg";
import wirelessReceiverRearPanel from "../../../assets/yinman-wireless-receiver-rear-panel.svg";
import podiumComputerRearPanel from "../../../assets/external-podium-computer-panel.svg";
import recordingLineInputPanel from "../../../assets/external-recording-line-input-panel.svg";
import controlHostPanel from "../../../assets/external-control-host-rs232-panel.svg";
import laptopPanel from "../../../assets/external-laptop-panel.svg";
import opsAllInOnePanel from "../../../assets/external-ops-panel.svg";
import conferenceTerminalPanel from "../../../assets/external-conference-terminal-panel.svg";
import headsetSplitterPanel from "../../../assets/external-headset-splitter-panel.svg";
import wiredMicrophonePanel from "../../../assets/external-wired-microphone-panel.svg";
import legacyWirelessReceiverPanel from "../../../assets/external-legacy-wireless-receiver-panel.svg";
import {
  InterfaceWiringPreview,
  type InterfacePanelImageMap,
  type InterfaceWiringPreviewProps
} from "./InterfaceWiringPreview";

const panelImages: InterfacePanelImageMap = {
  yinyiArrayMicMain: arrayMicMainPanel,
  yinyiArrayMicSlave: arrayMicSlavePanel,
  aj200: aj200InterfacePanel,
  aj600: aj600InterfacePanel,
  ap150: amplifierRearPanel,
  lineArray: lineArrayRearPanel,
  lineArrayConverter: lineArrayConverterPanel,
  passiveSpeaker: passiveSpeakerTerminal,
  wirelessReceiver: wirelessReceiverRearPanel,
  podiumComputer: podiumComputerRearPanel,
  recordingLineInput: recordingLineInputPanel,
  controlHost: controlHostPanel,
  laptop: laptopPanel,
  opsAllInOne: opsAllInOnePanel,
  conferenceTerminal: conferenceTerminalPanel,
  headsetSplitter: headsetSplitterPanel,
  wiredMicrophone: wiredMicrophonePanel,
  legacyWirelessReceiver: legacyWirelessReceiverPanel
};

export default function YinyiInterfaceWiringPreview(props: InterfaceWiringPreviewProps) {
  return <InterfaceWiringPreview {...props} interfacePanelImages={panelImages} />;
}
