import { AuthFinishScreen } from "@/components/auth-finish-screen";

export default function AuthCallbackPage() {
  return (
    <AuthFinishScreen
      title="Finishing sign-in"
      description="This page completes the link from your email or sign-in provider."
    />
  );
}
