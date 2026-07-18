export function isUsbAudioTargetDevice(device: string) {
  return /电脑|一体机|会议屏|CLASSIN|笔记本/i.test(device);
}

export function isUsbAudioAllInOneDevice(device: string) {
  return /一体机|会议屏|CLASSIN/i.test(device);
}

export function selectPrimaryUsbAudioDevice(devices: string[], fallbackWhenEmpty = "") {
  const candidates = Array.from(new Set(devices.map((device) => device.trim()).filter(isUsbAudioTargetDevice)));
  if (!candidates.length) return devices.length === 0 ? fallbackWhenEmpty : "";
  return candidates.find(isUsbAudioAllInOneDevice)
    ?? candidates.find((device) => device.includes("讲台电脑"))
    ?? candidates.find((device) => device.includes("笔记本电脑"))
    ?? candidates[0];
}
