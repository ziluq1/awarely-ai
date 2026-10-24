import { connection } from "next/server";
import { finishAuthCallback } from "@/lib/auth-callback";

export async function GET(request: Request) {
  await connection();
  return finishAuthCallback(request, "/reset-password");
}
