import type { Metadata } from "next";
import Link from "next/link";
import { PrivacyActions } from "@/components/privacy-actions";
import { PageHeader, cardClass } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy and storage",
  description: "How awarely.ai keeps photos and journal entries in your browser, and how to delete them.",
};

export default function PrivacyPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Privacy" title="What stays on this device">
        <p>
          Reflections you keep from Capture and Reflect stay in this browser. They are not uploaded, and images are not
          analyzed. A moment you save on the timeline while signed in is stored in your Supabase account.
          A message you choose to send in the AI companion is sent to Groq only when model calls are enabled. If Groq
          cannot take that request and Gemini is configured, the same message is sent to Google Gemini. Sign-in is
          optional. Email, password checks, and Google sign-in are handled by Supabase. Journal entries and photos
          still stay in this browser.
        </p>
      </PageHeader>

      <div className="grid gap-4">
        <section className={`${cardClass} p-6`}>
          <h2 className="font-serif text-2xl text-foreground">While you are writing</h2>
          <p className="mt-3 leading-relaxed text-muted">
            A photo you select and the words in the reflection form stay in this tab so you can move between Capture
            and Reflect. That draft is not added to your timeline, and it is not written to device storage.
          </p>
        </section>
        <section className={`${cardClass} p-6`}>
          <h2 className="font-serif text-2xl text-foreground">This visit</h2>
          <p className="mt-3 leading-relaxed text-muted">
            If you choose “Keep for this visit only,” the entry is held in memory. Reloading or closing the tab removes
            it. It is not stored in local storage.
          </p>
        </section>
        <section className={`${cardClass} p-6`}>
          <h2 className="font-serif text-2xl text-foreground">This device</h2>
          <p className="mt-3 leading-relaxed text-muted">
            “Remember on this device” writes the entry to this browser’s local storage, and only after you check the
            consent box. A photo is included only if you attached one. Anyone with access to this browser can see those
            entries. awarely.ai asks again for each entry.
          </p>
        </section>
        <section className={`${cardClass} p-6`}>
          <h2 className="font-serif text-2xl text-foreground">Appearance</h2>
          <p className="mt-3 leading-relaxed text-muted">
            Light or dark mode and the color theme are saved in this browser. On a first visit, awarely.ai follows the
            device appearance until you choose otherwise in{" "}
            <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/settings">
              Settings
            </Link>
            . Those choices are not uploaded.
          </p>
        </section>
        <section className={`${cardClass} p-6`}>
          <h2 className="font-serif text-2xl text-foreground">Photos and the camera</h2>
          <p className="mt-3 leading-relaxed text-muted">
            The camera permission appears only after you press Take a photo. Uploads are resized in the browser. Photos
            are never used to infer emotions, name a mood, or suggest a diagnosis. Mood labels are chosen by you. A
            custom feeling is saved only as part of an entry you choose to keep.
          </p>
        </section>
        <section className={`${cardClass} p-6`}>
          <h2 className="font-serif text-2xl text-foreground">Account timeline</h2>
          <p className="mt-3 leading-relaxed text-muted">
            Saving an entry while you are signed in sends the words, mood, and photo to your Supabase project. The photo
            goes in a private bucket, and the row is tied to your user id. awarely.ai asks Supabase for a temporary link
            when it shows the photo. Other accounts cannot read those rows or files through the app policies.
          </p>
        </section>
        <section className={`${cardClass} p-6`}>
          <h2 className="font-serif text-2xl text-foreground">The companion</h2>
          <p className="mt-3 leading-relaxed text-muted">
            When model calls are enabled and a Groq key and model are configured, a message you send in the AI
            companion, plus recent messages in that chat, is sent to Groq so it can reply. If Groq rate-limits the
            request or cannot answer, and a Gemini key is configured, that same message is sent to Gemini instead.
            Photos are never sent. Saved journal entries are not sent unless you type them yourself. Chat text is not
            stored by awarely.ai, and it is not written to the server logs.
          </p>
          <p className="mt-3 leading-relaxed text-muted">
            If model calls are turned off or not configured, the companion does not contact a model. It shows prepared
            exercises stored with the site and labels them as demo mode. Those exercises are not AI replies. The chat is
            not saved. awarely.ai cannot monitor you or contact emergency services, and it is not medical care, a
            diagnosis, or a crisis service.
          </p>
        </section>
        <section className={`${cardClass} space-y-4 p-6`}>
          <h2 className="font-serif text-2xl text-foreground">Delete what you kept</h2>
          <p className="leading-relaxed text-muted">
            Delete one entry from the{" "}
            <Link className="font-medium text-accent-text underline decoration-line underline-offset-4" href="/timeline">
              timeline
            </Link>
            , or clear every device entry here. Clearing device storage does not remove entries that were kept only for
            this visit.
          </p>
          <PrivacyActions />
        </section>
      </div>
    </div>
  );
}
