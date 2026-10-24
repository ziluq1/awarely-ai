import type { Metadata } from "next";
import { Suspense } from "react";
import { SharedDetail } from "@/components/shared-detail";
import { LoadingBlock } from "@/components/ui";

export const metadata: Metadata = {
  title: "Shared timeline",
  description: "Entries people chose to share with the members of this timeline.",
};

export default function SharedTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingBlock label="Opening shared timeline." />}>
      <TimelineLoader params={params} />
    </Suspense>
  );
}

async function TimelineLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SharedDetail timelineId={id} />;
}
