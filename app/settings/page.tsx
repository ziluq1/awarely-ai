import type { Metadata } from "next";
import { ThemeSettings } from "@/components/theme-settings";

export const metadata: Metadata = {
  title: "Appearance",
  description: "Choose light or dark mode and a color theme. Preferences stay in this browser.",
};

export default function SettingsPage() {
  return <ThemeSettings />;
}
