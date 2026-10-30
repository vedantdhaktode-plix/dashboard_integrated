import { NextResponse } from "next/server";
import { mutateState } from "@/lib/store/unified-store";
import { getServerSession } from "@/lib/auth/session";

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { scriptOwnerId, editorId, brandOwnerId } = body;
    const sessionUser = await getServerSession();

    if (editorId !== undefined && sessionUser?.role !== "administrator" && !sessionUser?.isTeamLead) {
      return NextResponse.json({ error: "Only editing managers can assign editors" }, { status: 403 });
    }

    const { result } = await mutateState(async ({ tasks, users }) => {
      const index = tasks.findIndex((t) => t.id === id);
      if (index === -1) throw new Error(`Task ${id} not found`);

      const current = tasks[index];
      const now = new Date().toISOString();

      const updated = {
        ...current,
        updatedAt: now,
      };

      if (scriptOwnerId !== undefined) {
        updated.scriptOwnerId = scriptOwnerId;
        updated.contentOwnerId = scriptOwnerId;
      }
      if (editorId !== undefined) {
        const editor = editorId ? users.find((user) => user.id === editorId) : null;
        if (editorId && (!editor || !["edit", "video"].includes(editor.role) || editor.isTeamLead)) {
          throw new Error("Select a valid editing team member");
        }
        if (!["editing_queue", "editing_in_progress", "changes_requested", "approval_pending"].includes(current.state)) {
          throw new Error("Editors can only be assigned after script approval");
        }

        updated.editorId = editorId || null;
        updated.editorAssignedById = editorId ? sessionUser.id : null;
        updated.editorAssignedByName = editorId ? sessionUser.name : null;
        updated.editorAssignedAt = editorId ? now : null;
        updated.activity = [
          {
            at: now,
            actor: sessionUser?.name || "Editing Manager",
            team: "Video",
            text: editorId
              ? `Assigned video to ${editor.name}.`
              : "Returned video to the unassigned dispatch queue.",
          },
          ...(updated.activity || []),
        ];
      }
      if (brandOwnerId !== undefined) {
        updated.brandOwnerId = brandOwnerId;
      }

      tasks[index] = updated;
      return updated;
    }, sessionUser?.name || "Dispatcher");

    return NextResponse.json({ task: result });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update assignment" },
      { status: 500 }
    );
  }
}

