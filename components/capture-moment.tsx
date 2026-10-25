"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useJournal } from "@/components/journal-provider";
import { PhotoView } from "@/components/photo-view";
import { Button, ErrorBlock, LoadingBlock, PageHeader, cardClass } from "@/components/ui";
import { openCamera, oppositeFacing, playCameraPreview, stopMediaStream } from "@/lib/camera";
import type { CameraFacing } from "@/lib/camera";
import { cameraErrorMessage, imageFileToDataUrl, videoFrameToDataUrl } from "@/lib/images";

type Phase = "choose" | "requesting" | "live" | "reading" | "ready" | "error";

export function CaptureMoment() {
  const router = useRouter();
  const { draft, setDraft } = useJournal();
  const initialPhase: Phase = draft.photoDataUrl ? "ready" : "choose";
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef(0);
  const phaseRef = useRef<Phase>(initialPhase);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [photo, setPhoto] = useState<string | null>(draft.photoDataUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>("user");
  const [switching, setSwitching] = useState(false);
  const [streamVersion, setStreamVersion] = useState(0);

  useEffect(() => {
    return () => {
      requestRef.current += 1;
      releaseStream(streamRef, videoRef);
    };
  }, []);

  useEffect(() => {
    if (phase !== "live") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    let cancelled = false;
    void playCameraPreview(video, stream).catch(() => {
      if (cancelled || phaseRef.current !== "live" || streamRef.current !== stream) return;
      setMessage("The camera preview could not start. You can upload an image or skip.");
      rememberPhase("error");
      releaseStream(streamRef, videoRef);
    });
    return () => {
      cancelled = true;
    };
  }, [phase, streamVersion]);

  function rememberPhase(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  async function startCamera(nextFacing: CameraFacing = "user") {
    setMessage(null);
    setPreviewReady(false);
    setSwitching(false);
    phaseRef.current = "requesting";
    releaseStream(streamRef, videoRef);
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    rememberPhase("requesting");
    try {
      const session = await openCamera(nextFacing);
      if (requestId !== requestRef.current) {
        stopMediaStream(session.stream);
        return;
      }
      holdStream(session.stream);
      streamRef.current = session.stream;
      setFacing(session.facing);
      setStreamVersion((version) => version + 1);
      rememberPhase("live");
    } catch (error) {
      if (requestId !== requestRef.current) return;
      releaseStream(streamRef, videoRef);
      rememberPhase("error");
      setMessage(cameraErrorMessage(error));
    }
  }

  async function switchCamera() {
    if (phaseRef.current !== "live" || switching) return;
    const nextFacing = oppositeFacing(facing);
    const previousFacing = facing;
    const avoidDeviceId = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
    setMessage(null);
    setPreviewReady(false);
    setSwitching(true);
    releaseStream(streamRef, videoRef);
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    try {
      const session = await openCamera(nextFacing, { switching: true, avoidDeviceId });
      if (requestId !== requestRef.current) {
        stopMediaStream(session.stream);
        return;
      }
      holdStream(session.stream);
      streamRef.current = session.stream;
      setFacing(session.facing);
      setStreamVersion((version) => version + 1);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      try {
        const restored = await openCamera(previousFacing);
        if (requestId !== requestRef.current) {
          stopMediaStream(restored.stream);
          return;
        }
        holdStream(restored.stream);
        streamRef.current = restored.stream;
        setFacing(restored.facing);
        setStreamVersion((version) => version + 1);
        setMessage(cameraErrorMessage(error));
      } catch (restoreError) {
        if (requestId !== requestRef.current) return;
        releaseStream(streamRef, videoRef);
        rememberPhase("error");
        setMessage(cameraErrorMessage(restoreError));
      }
    } finally {
      if (requestId === requestRef.current) setSwitching(false);
    }
  }

  function holdStream(stream: MediaStream) {
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        if (streamRef.current !== stream) return;
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        if (phaseRef.current === "live" || phaseRef.current === "requesting") {
          rememberPhase("choose");
          setMessage("The camera stopped. Start it again if you still want a photo.");
        }
      };
    });
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    try {
      const dataUrl = await videoFrameToDataUrl(video, { mirror: facing === "user" });
      phaseRef.current = "ready";
      releaseStream(streamRef, videoRef);
      setPhoto(dataUrl);
      setMessage(null);
      setPreviewReady(false);
      rememberPhase("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This photo could not be prepared.");
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    requestRef.current += 1;
    phaseRef.current = "reading";
    releaseStream(streamRef, videoRef);
    setSwitching(false);
    rememberPhase("reading");
    setMessage(null);
    try {
      const dataUrl = await imageFileToDataUrl(file);
      setPhoto(dataUrl);
      rememberPhase("ready");
    } catch (error) {
      setPhoto(null);
      rememberPhase("error");
      setMessage(error instanceof Error ? error.message : "That image could not be prepared.");
    }
  }

  function closeCamera() {
    requestRef.current += 1;
    phaseRef.current = photo ? "ready" : "choose";
    releaseStream(streamRef, videoRef);
    setSwitching(false);
    rememberPhase(photo ? "ready" : "choose");
  }

  function removePhoto() {
    setPhoto(null);
    setDraft({ ...draft, photoDataUrl: null, skippedPhoto: false });
    rememberPhase("choose");
    setMessage(null);
  }

  function usePhoto() {
    if (!photo) return;
    setDraft({ ...draft, photoDataUrl: photo, skippedPhoto: false });
    router.push("/reflect");
  }

  function skip() {
    requestRef.current += 1;
    phaseRef.current = "choose";
    releaseStream(streamRef, videoRef);
    setPhoto(null);
    setDraft({ ...draft, photoDataUrl: null, skippedPhoto: true });
    router.push("/reflect");
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Capture" title="Capture this moment">
        <p>
          A photo is optional. Your browser asks for the camera only when you choose Take a photo. awarely.ai does not
          look at the picture or guess how you feel.
        </p>
        <p>
          Images are resized in this browser. When you are signed in, saving the reflection stores the photo privately
          with your account.
        </p>
      </PageHeader>

      {phase === "requesting" ? <LoadingBlock label="Asking for camera access…" /> : null}
      {phase === "reading" ? <LoadingBlock label="Preparing your image…" /> : null}
      {phase === "error" && message ? (
        <ErrorBlock title="The photo could not be added" message={message}>
          <Button variant="secondary" onClick={() => rememberPhase(photo ? "ready" : "choose")}>
            Back to choices
          </Button>
        </ErrorBlock>
      ) : null}

      {phase === "live" ? (
        <div className={`${cardClass} space-y-4 p-4 sm:p-6`}>
          <div className="relative overflow-hidden rounded-[1.5rem] bg-camera">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedData={() => setPreviewReady(true)}
              aria-label={facing === "user" ? "Live front camera preview" : "Live rear camera preview"}
              className="aspect-[4/3] w-full object-contain"
              style={facing === "user" ? { transform: "scaleX(-1)" } : undefined}
            />
            {previewReady ? null : (
              <p className="absolute inset-x-4 bottom-4 rounded-full bg-[#241f2b]/80 px-3 py-2 text-center text-sm text-[#fbf8f4]" role="status">
                {switching ? "Switching camera…" : "Waiting for the camera…"}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={captureFrame} disabled={!previewReady || switching}>
              Capture photo
            </Button>
            <Button
              variant="secondary"
              onClick={() => void switchCamera()}
              disabled={switching}
              aria-label={facing === "user" ? "Switch to the rear camera" : "Switch to the front camera"}
            >
              {switching ? "Switching…" : "Switch camera"}
            </Button>
            <Button variant="secondary" onClick={closeCamera}>
              Close camera
            </Button>
          </div>
        </div>
      ) : null}

      {message && phase === "live" ? (
        <p role="alert" className="rounded-2xl bg-blush px-4 py-3 text-sm leading-relaxed text-blush-text">
          {message}
        </p>
      ) : null}

      {photo && phase !== "live" && phase !== "reading" && phase !== "requesting" ? (
        <div className={`${cardClass} space-y-4 p-4 sm:p-6`}>
          <PhotoView src={photo} alt="Photo you selected for this moment" />
          <p className="text-sm leading-relaxed text-muted">
            This preview stays in the tab until you keep a reflection or remove it. It is not a reading of your mood.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={usePhoto}>Use this photo</Button>
            <Button variant="secondary" onClick={removePhoto}>
              Remove photo
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <article className={`${cardClass} flex flex-col p-5`}>
          <h2 className="font-serif text-2xl text-foreground">Take a photo</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
            Opens the camera after you press the button. Audio is not requested.
          </p>
          <Button className="mt-5 w-full" onClick={() => void startCamera()} disabled={phase === "requesting" || phase === "reading" || switching}>
            Take a photo
          </Button>
        </article>
        <article className={`${cardClass} flex flex-col p-5`}>
          <h2 className="font-serif text-2xl text-foreground">Upload an image</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
            Choose a JPG, PNG, or other image from this device. A signed-in save stores it with your account.
          </p>
          <label className="mt-5 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full bg-inverse px-5 py-2 text-sm font-medium text-inverse-text has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent-text">
            <span>Upload an image</span>
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={onFile}
              aria-label="Upload an image"
              disabled={phase === "requesting" || phase === "reading" || switching}
            />
          </label>
        </article>
        <article className={`${cardClass} flex flex-col p-5`}>
          <h2 className="font-serif text-2xl text-foreground">Skip</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
            Continue to the reflection without a photo. You can add one later.
          </p>
          <Button variant="secondary" className="mt-5 w-full" onClick={skip}>
            Skip for now
          </Button>
        </article>
      </div>
    </div>
  );
}

function releaseStream(streamRef: { current: MediaStream | null }, videoRef: { current: HTMLVideoElement | null }) {
  stopMediaStream(streamRef.current);
  streamRef.current = null;
  if (videoRef.current) videoRef.current.srcObject = null;
}
