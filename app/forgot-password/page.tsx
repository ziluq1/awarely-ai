import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthScreen } from "@/components/auth-screen";
import { LoadingBlock } from "@/components/ui";

export const metadata: Metadata = {
  description: "Send a awarely.ai password reset link through Supabase.",
};

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Opening password reset." />}>
      <AuthScreen mode="forgot" />
    </Suspense>
  );
}
