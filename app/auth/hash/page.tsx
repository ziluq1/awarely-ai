import { AuthFinishScreen } from "@/components/auth-finish-screen";

/** @deprecated Prefer /auth/callback — kept so older redirects still finish all auth formats. */
export default function AuthHashPage() {
  return (
    <AuthFinishScreen
      title="Finishing sign-in"
      description="This page completes the link from your email or sign-in provider."
    />
  );
}
