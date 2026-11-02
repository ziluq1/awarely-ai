import type { Metadata } from "next";
import { DeleteAccount } from "@/components/delete-account";
import { ThemeSettings } from "@/components/theme-settings";

export const metadata: Metadata = {
  description: "Choose light or dark mode and a color theme. Preferences stay in this browser.",
};

export default function SettingsPage() {
  return (
    <div className="space-y-10">
      <ThemeSettings />
      <DeleteAccount />
    </div>
  );
}
