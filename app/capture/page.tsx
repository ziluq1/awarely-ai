import type { Metadata } from "next";
import { CaptureMoment } from "@/components/capture-moment";

export const metadata: Metadata = {
  description: "Take a photo, upload an image, or skip. The camera is used only when you ask for it.",
};

export default function CapturePage() {
  return <CaptureMoment />;
}
