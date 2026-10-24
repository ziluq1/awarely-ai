import type { Metadata } from "next";
import { NotificationsScreen } from "@/components/notifications-screen";

export const metadata: Metadata = {
  title: "Alerts",
  description: "Friend requests and shared timeline activity, without private journal text.",
};

export default function NotificationsPage() {
  return <NotificationsScreen />;
}
