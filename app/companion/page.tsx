import type { Metadata } from "next";
import { CompanionScreen } from "@/components/companion-screen";

export const metadata: Metadata = {
  description:
    "A wellness companion that uses a Groq model when calls are enabled, and prepared exercises when they are not.",
};

export default function CompanionPage() {
  return <CompanionScreen />;
}
