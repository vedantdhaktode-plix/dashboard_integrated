import { getServerSession } from "@/lib/auth/session";
import { subscribeToChanges } from "@/lib/store/unified-store";
import { createServerSupabaseClient, hasSupabaseTrackerConfig } from "@/lib/master-admin/tracker-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionUser = await getServerSession();
  if (!sessionUser || sessionUser.role !== "master_admin") {
    return Response.json({ error: "Master Admin access is required." }, { status: 401 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let cleaned = false;
      const send = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (_) {
          closed = true;
          cleanup();
        }
      };

      const heartbeat = setInterval(() => send("heartbeat", { time: new Date().toISOString() }), 25000);

      const unsubscribe = subscribeToChanges((event) =>
        send("message", { ...event, source: "spreadsheet-realtime" })
      );
      let supabase = null;
      let channel = null;

      try {
        if (hasSupabaseTrackerConfig()) {
          supabase = createServerSupabaseClient();
          channel = supabase
            .channel("master-admin-pipeline")
            .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) =>
              send("message", { type: "tasks.updated", source: "supabase", table: "tasks", event: payload.eventType })
            )
            .on("postgres_changes", { event: "*", schema: "public", table: "task_assets" }, (payload) =>
              send("message", { type: "tasks.updated", source: "supabase", table: "task_assets", event: payload.eventType })
            )
            .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, (payload) =>
              send("message", { type: "tasks.updated", source: "supabase", table: "approvals", event: payload.eventType })
            )
            .subscribe((status) => {
              if (status === "SUBSCRIBED") {
                send("connected", { source: "hybrid", time: new Date().toISOString() });
              }
            });
        } else {
          send("connected", { source: "spreadsheet-realtime", time: new Date().toISOString() });
        }
      } catch (error) {
        send("connected", {
          source: "spreadsheet-realtime",
          warning: error.message,
          time: new Date().toISOString(),
        });
      }

      cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        if (supabase && channel) supabase.removeChannel(channel);
      };
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "private, no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
