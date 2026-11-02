import type { Metadata } from "next";
import { SharedScreen } from "@/components/shared-screen";

export const metadata: Metadata = {
  description: "Create separate spaces and choose which journal entries friends can see.",
};

export default function SharedPage() {
  return <SharedScreen />;
}
