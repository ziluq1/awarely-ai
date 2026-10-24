import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthScreen } from "@/components/auth-screen";
import { LoadingBlock } from "@/components/ui";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to awarely.ai with email and password, or continue with Google.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Opening log in." />}>
      <AuthScreen mode="login" />
    </Suspense>
  );
}
