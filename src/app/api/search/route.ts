import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { globalSearch } from "@/lib/data/search";

export async function GET(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const hits = await withStaff(staff, (db) => globalSearch(db, q));
  return NextResponse.json({ hits });
}
