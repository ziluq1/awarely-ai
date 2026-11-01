import { AuthFinishScreen } from "@/components/auth-finish-screen";

export default function AuthRecoveryCallbackPage() {
  return (
    <AuthFinishScreen
      forcedNext="/reset-password"
      title="Finishing password reset"
      description="This page completes the password reset link from your email."
    />
  );
}
