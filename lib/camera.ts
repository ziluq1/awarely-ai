export type CameraFacing = "user" | "environment";

export type CameraDevice = {
  deviceId: string;
  label: string;
  kind: string;
};

export type CameraSession = {
  stream: MediaStream;
  facing: CameraFacing;
  canSwitch: boolean;
};

export type CameraErrorCode = "unsupported" | "denied" | "missing" | "busy" | "blocked" | "no-switch" | "failed";

const MESSAGES: Record<CameraErrorCode, string> = {
  unsupported: "This browser cannot open a camera here. You can upload an image or skip.",
  denied: "Camera access was declined. You can upload an image or continue without a photo.",
  missing: "No camera was found on this device. You can upload an image or skip.",
  busy: "The camera is already in use or could not be opened. You can upload an image or skip.",
  blocked: "The camera is blocked in this browser context. You can upload an image or skip.",
  "no-switch": "This device cannot switch between the front and rear cameras.",
  failed: "The camera could not be opened. You can upload an image or skip.",
};

export class CameraOpenError extends Error {
  readonly code: CameraErrorCode;

  constructor(code: CameraErrorCode) {
    super(MESSAGES[code]);
    this.name = "CameraOpenError";
    this.code = code;
  }
}

export function oppositeFacing(facing: CameraFacing): CameraFacing {
  return facing === "user" ? "environment" : "user";
}

export function cameraFacingFromLabel(label: string): CameraFacing | null {
  const value = label.toLowerCase();
  if (!value.trim()) return null;
  if (/(back|rear|environment|world)/.test(value)) return "environment";
  if (/(front|user|face|selfie)/.test(value)) return "user";
  return null;
}

export function selectCameraDevice(devices: CameraDevice[], facing: CameraFacing, avoidDeviceId?: string): string | null {
  const videos = devices.filter((device) => device.kind === "videoinput" && device.deviceId && device.deviceId !== avoidDeviceId);
  const labeled = videos.find((device) => cameraFacingFromLabel(device.label) === facing);
  if (labeled) return labeled.deviceId;
  if (!avoidDeviceId) return null;
  const unlabeled = videos.find((device) => cameraFacingFromLabel(device.label) === null);
  return unlabeled?.deviceId ?? null;
}

export function cameraCanSwitch(stream: MediaStream, devices: CameraDevice[]): boolean {
  const count = devices.filter((device) => device.kind === "videoinput" && device.deviceId).length;
  if (count > 1) return true;
  try {
    const modes = stream.getVideoTracks()[0]?.getCapabilities?.().facingMode;
    return Array.isArray(modes) && modes.includes("user") && modes.includes("environment");
  } catch {
    return false;
  }
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => {
    track.onended = null;
    track.stop();
  });
}

export async function playCameraPreview(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
  if (video.srcObject !== stream) {
    video.srcObject = null;
    video.srcObject = stream;
  }
  await video.play();
}

export async function openCamera(facing: CameraFacing, options?: { switching?: boolean; avoidDeviceId?: string }): Promise<CameraSession> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraOpenError("unsupported");
  }

  if (options?.switching) {
    await waitForCameraRelease();
  }

  let stream = await requestStream(facing, options);
  let devices = await listVideoInputs();
  const openedId = deviceIdOf(stream);

  if (options?.switching && openedId && options.avoidDeviceId && openedId === options.avoidDeviceId) {
    const alternate = selectCameraDevice(devices, facing, options.avoidDeviceId);
    if (!alternate) {
      stopMediaStream(stream);
      throw new CameraOpenError("no-switch");
    }
    stopMediaStream(stream);
    try {
      stream = await requestDevice(alternate);
    } catch (error) {
      throw toCameraError(error, true);
    }
    devices = await listVideoInputs();
  } else if (!options?.switching) {
    const actual = facingOf(stream, devices);
    if (actual && actual !== facing) {
      const alternate = selectCameraDevice(devices, facing, openedId);
      if (alternate) {
        try {
          const replacement = await requestDevice(alternate);
          stopMediaStream(stream);
          stream = replacement;
          devices = await listVideoInputs();
        } catch {
          // Keep the camera that opened when the preferred side cannot be selected.
        }
      }
    }
  }

  const resolved = facingOf(stream, devices) ?? facing;
  if (options?.switching && resolved !== facing && deviceIdOf(stream) === options.avoidDeviceId) {
    stopMediaStream(stream);
    throw new CameraOpenError("no-switch");
  }

  return {
    stream,
    facing: resolved,
    canSwitch: cameraCanSwitch(stream, devices),
  };
}

async function requestStream(facing: CameraFacing, options?: { switching?: boolean; avoidDeviceId?: string }): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { exact: facing } },
    });
  } catch (error) {
    if (isFatal(error)) throw toCameraError(error);
  }

  if (!options?.switching) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facing } },
      });
    } catch (error) {
      if (isFatal(error)) throw toCameraError(error);
    }
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    } catch (error) {
      throw toCameraError(error);
    }
  }

  const alternate = selectCameraDevice(await listVideoInputs(), facing, options.avoidDeviceId);
  if (!alternate) throw new CameraOpenError(options.avoidDeviceId ? "no-switch" : "missing");
  try {
    return await requestDevice(alternate);
  } catch (error) {
    throw toCameraError(error, true);
  }
}

function requestDevice(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { deviceId: { exact: deviceId } },
  });
}

async function listVideoInputs(): Promise<CameraDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === "videoinput")
      .map((device) => ({ deviceId: device.deviceId, label: device.label, kind: device.kind }));
  } catch {
    return [];
  }
}

function facingOf(stream: MediaStream, devices: CameraDevice[]): CameraFacing | null {
  const track = stream.getVideoTracks()[0];
  const settings = track?.getSettings?.();
  if (settings?.facingMode === "user" || settings?.facingMode === "environment") return settings.facingMode;
  const device = devices.find((item) => item.deviceId && item.deviceId === settings?.deviceId);
  return device ? cameraFacingFromLabel(device.label) : null;
}

function deviceIdOf(stream: MediaStream): string | undefined {
  return stream.getVideoTracks()[0]?.getSettings?.().deviceId || undefined;
}

function isFatal(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === "NotAllowedError" ||
    error.name === "PermissionDeniedError" ||
    error.name === "SecurityError" ||
    error.name === "NotReadableError" ||
    error.name === "TrackStartError" ||
    error.name === "AbortError"
  );
}

function toCameraError(error: unknown, switching = false): CameraOpenError {
  if (error instanceof CameraOpenError) return error;
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") return new CameraOpenError("denied");
    if (error.name === "SecurityError") return new CameraOpenError("blocked");
    if (error.name === "NotReadableError" || error.name === "TrackStartError" || error.name === "AbortError") {
      return new CameraOpenError("busy");
    }
    if (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError" ||
      error.name === "OverconstrainedError"
    ) {
      return new CameraOpenError(switching ? "no-switch" : "missing");
    }
  }
  return new CameraOpenError("failed");
}

function waitForCameraRelease(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 120);
  });
}
