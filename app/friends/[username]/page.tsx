import type { Metadata } from "next";
import { Suspense } from "react";
import { FriendProfile } from "@/components/friend-profile";
import { LoadingBlock } from "@/components/ui";

export const metadata: Metadata = {
  title: "Profile",
  description: "A public profile with the name, username, bio, and photo someone chose to share.",
};

export default function FriendProfilePage({ params }: { params: Promise<{ username: string }> }) {
  return (
    <Suspense fallback={<LoadingBlock label="Opening profile." />}>
      <ProfileLoader params={params} />
    </Suspense>
  );
}

async function ProfileLoader({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <FriendProfile username={username} />;
}
