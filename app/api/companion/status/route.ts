import { connection, NextResponse } from "next/server";
import { readAvailability } from "@/lib/agent/config";

export async function GET() {
  await connection();
  return NextResponse.json(readAvailability());
}
