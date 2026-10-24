import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Take a moment for yourself",
  description: "Pause, capture an optional photo, and write what stands out. awarely.ai keeps entries only where you choose.",
};

export default function Home() {
  return <Dashboard />;
}
