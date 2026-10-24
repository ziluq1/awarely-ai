import type { Metadata } from "next";
import { AccountTimeline } from "@/components/account-timeline";

export const metadata: Metadata = {
  title: "Timeline",
  description: "A private timeline of moments saved to your account, newest first.",
};

export default function TimelinePage() {
  return <AccountTimeline />;
}
