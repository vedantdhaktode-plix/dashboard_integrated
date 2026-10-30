import { NextResponse } from "next/server";
import { SubmitVideoSchema } from "@/lib/workflow/contracts";
import { transitionTask } from "@/lib/workflow/engine";
import { mutateState } from "@/lib/store/unified-store";
import { getServerSession } from "@/lib/auth/session";

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const sessionUser = await getServerSession();
    if (!sessionUser || !["edit", "video", "administrator"].includes(sessionUser.role)) {
      return NextResponse.json({ error: "You do not have permission to submit video versions" }, { status: 403 });
    }
    const body = await request.json();
    const parsed = SubmitVideoSchema.safeParse({ ...body, taskId: id });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid video submission" },
        { status: 400 }
      );
    }

    const { result } = await mutateState(async ({ tasks }) => {
      const index = tasks.findIndex((t) => t.id === id);
      if (index === -1) throw new Error(`Task ${id} not found`);

      const current = tasks[index];
      let updated = transitionTask(
        current,
        "approval_pending",
        sessionUser.name,
        `Submitted version ${parsed.data.version} (${parsed.data.aspectRatio}) for Brand approval.`
      );

      updated.videoLink = parsed.data.videoUrl;
      updated.aspectRatio = parsed.data.aspectRatio;

      // Add to versions
      updated.versions = updated.versions || [];
      updated.versions.unshift({
        id: `ver-${Date.now()}`,
        number: parsed.data.version,
        videoUrl: parsed.data.videoUrl,
        aspectRatio: parsed.data.aspectRatio,
        comment: parsed.data.comment,
        status: "In review",
        submittedAt: new Date().toISOString(),
      });

      // Add pending video approval
      updated.approvals = updated.approvals || [];
      updated.approvals.unshift({
        id: `appr-vid-${Date.now()}`,
        type: "video",
        status: "pending",
        requestedBy: sessionUser.name,
        comment: parsed.data.comment,
        requestedAt: new Date().toISOString(),
      });

      tasks[index] = updated;
      return updated;
    }, sessionUser.name);

    return NextResponse.json({ task: result });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to submit video" }, { status: 500 });
  }
}

