import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth/session";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  return NextResponse.json({ hits: [] });
}
