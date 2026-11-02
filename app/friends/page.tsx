import type { Metadata } from "next";
import { FriendsScreen } from "@/components/friends-screen";

export const metadata: Metadata = {
  description: "Find people by the name they chose to share and manage friend requests.",
};

export default function FriendsPage() {
  return <FriendsScreen />;
}
