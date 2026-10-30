import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getMasterAdminTrackerPayload } from "@/lib/master-admin/tracker-data";

export async function POST() {
  const sessionUser = await getServerSession();

  if (!sessionUser || sessionUser.role !== "master_admin") {
    return NextResponse.json(
      { status: "unauthorized", message: "Master Admin access is required." },
      { status: 401 }
    );
  }

  try {
    return NextResponse.json(await getMasterAdminTrackerPayload(sessionUser.name), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "read_failed",
        message: error.message || "The Plix Ops data source could not be read.",
        retryAfterMs: 5000,
      },
      {
        status: 503,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      }
    );
  }
}
