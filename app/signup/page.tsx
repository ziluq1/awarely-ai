import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthScreen } from "@/components/auth-screen";
import { LoadingBlock } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a awarely.ai account with email and password, or continue with Google.",
};

export default function SignupPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Opening sign up." />}>
      <AuthScreen mode="signup" />
    </Suspense>
  );
}
