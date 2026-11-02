import type { Metadata } from "next";
import { ProfileScreen } from "@/components/profile-screen";

export const metadata: Metadata = {
  description: "Choose the name, username, bio, and photo other people can see.",
};

export default function ProfilePage() {
  return <ProfileScreen />;
}
