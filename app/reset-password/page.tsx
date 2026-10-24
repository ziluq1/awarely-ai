import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthScreen } from "@/components/auth-screen";
import { LoadingBlock } from "@/components/ui";

export const metadata: Metadata = {
  title: "New password",
  description: "Choose a new awarely.ai password after opening the reset link.",
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Opening the new password form." />}>
      <AuthScreen mode="reset" />
    </Suspense>
  );
}
