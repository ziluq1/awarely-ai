export class ImagePrepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImagePrepError";
  }
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 900_000;

export async function imageFileToDataUrl(file: Blob): Promise<string> {
  if (file instanceof File) {
    if (file.type && !file.type.startsWith("image/")) {
      throw new ImagePrepError("Choose an image file.");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new ImagePrepError("That image is larger than 15 MB. Try a smaller one.");
    }
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImagePrepError("This file could not be opened as an image. Try a JPG or PNG.");
  }

  try {
    return canvasToDataUrl(drawScaled(bitmap, bitmap.width, bitmap.height));
  } finally {
    bitmap.close();
  }
}

export async function imageFileToJpegBlob(file: Blob): Promise<Blob> {
  if (file instanceof File) {
    if (file.type && !file.type.startsWith("image/")) {
      throw new ImagePrepError("Choose an image file.");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new ImagePrepError("That image is larger than 15 MB. Try a smaller one.");
    }
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImagePrepError("This file could not be opened as an image. Try a JPG or PNG.");
  }

  try {
    const canvas = drawScaled(bitmap, bitmap.width, bitmap.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/jpeg", 0.82);
    });
    if (!blob || blob.size > 4_500_000) {
      throw new ImagePrepError("That image is still too large after resizing. Try another photo.");
    }
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function videoFrameToDataUrl(video: HTMLVideoElement): Promise<string> {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
    throw new ImagePrepError("The camera has not shared a frame yet. Wait a moment and try again.");
  }

  const canvas = drawScaled(video, video.videoWidth, video.videoHeight);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((next) => resolve(next), "image/jpeg", 0.85);
  });
  if (!blob) {
    throw new ImagePrepError("This photo could not be prepared in the browser.");
  }
  return imageFileToDataUrl(blob);
}

function drawScaled(source: CanvasImageSource, sourceWidth: number, sourceHeight: number): HTMLCanvasElement {
  if (sourceWidth < 1 || sourceHeight < 1) {
    throw new ImagePrepError("This photo could not be prepared in the browser.");
  }
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new ImagePrepError("This photo could not be prepared in the browser.");
  }
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  let quality = 0.82;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > 700_000 && quality > 0.5) {
    quality = Math.round((quality - 0.1) * 10) / 10;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (!dataUrl.startsWith("data:image/jpeg") || dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new ImagePrepError("That image is still too large after resizing. Try another photo.");
  }
  return dataUrl;
}

export function cameraErrorMessage(error: unknown): string {
  if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
    return "This browser cannot open a camera here. You can upload an image or skip.";
  }
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return "Camera access was declined. You can upload an image or continue without a photo.";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No camera was found on this device. You can upload an image or skip.";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "The camera is already in use or could not be opened. You can upload an image or skip.";
    }
    if (error.name === "SecurityError") {
      return "The camera is blocked in this browser context. You can upload an image or skip.";
    }
  }
  return "The camera could not be opened. You can upload an image or skip.";
}
