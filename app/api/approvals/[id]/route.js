import { NextResponse } from "next/server";
import { transitionTask } from "@/lib/workflow/engine";
import { mutateState } from "@/lib/store/unified-store";
import { getServerSession } from "@/lib/auth/session";

export async function POST(request, context) {
  try {
    const { id: taskId } = await context.params;
    const body = await request.json();
    const { decision, type = "script", comment = "" } = body;
    const sessionUser = await getServerSession();
    const actorName = sessionUser?.name || "Brand Approver";

    if (!["approved", "changes_requested"].includes(decision)) {
      return NextResponse.json({ error: "Decision must be approved or changes_requested" }, { status: 400 });
    }

    const { result } = await mutateState(async ({ tasks }) => {
      const index = tasks.findIndex((t) => t.id === taskId);
      if (index === -1) throw new Error(`Task ${taskId} not found`);

      const current = tasks[index];
      let nextState;

      if (type === "script") {
        if (decision === "approved") {
          nextState = "editing_queue";
        } else {
          nextState = "script_changes_requested";
        }
      } else {
        // Video approval
        if (decision === "approved") {
          nextState = "ready_for_performance";
        } else {
          nextState = "changes_requested";
        }
      }

      let updated = transitionTask(
        current,
        nextState,
        actorName,
        `Brand decision on ${type}: ${decision}. ${comment}`.trim()
      );

      // Brand-approved scripts enter the shared manager dispatch queue unassigned.
      if (nextState === "editing_queue") {
        updated.editorId = null;
        updated.editorAssignedById = null;
        updated.editorAssignedByName = null;
        updated.editorAssignedAt = null;
      }

      // Update approval record status
      updated.approvals = (updated.approvals || []).map((appr) => {
        if (appr.type === type && appr.status === "pending") {
          return {
            ...appr,
            status: decision,
            decidedBy: actorName,
            decidedById: sessionUser?.id || null,
            decisionComment: comment,
            decidedAt: new Date().toISOString(),
          };
        }
        return appr;
      });

      tasks[index] = updated;
      return updated;
    }, actorName);

    return NextResponse.json({ task: result });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to process approval" }, { status: 500 });
  }
}

