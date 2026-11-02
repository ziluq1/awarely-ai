import type { Metadata } from "next";
import { ReflectionForm } from "@/components/reflection-form";

export const metadata: Metadata = {
  description: "Write what stands out about this moment and optionally choose a mood label.",
};

export default function ReflectPage() {
  return <ReflectionForm />;
}
