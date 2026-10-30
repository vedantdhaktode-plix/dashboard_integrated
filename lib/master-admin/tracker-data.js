import { createClient } from "@supabase/supabase-js";
import { getState } from "@/lib/store/unified-store";

const VALID_PRIORITIES = new Set(["P0", "P1", "P2"]);
const FINISHED_STATES = new Set(["approved", "ready_for_performance", "published"]);

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url && !serviceKey) return null;
  if (!url || !serviceKey) {
    throw new Error("Supabase is only partially configured. Set SUPABASE_URL and a server-only SUPABASE_SECRET_KEY together.");
  }

  return { url, serviceKey };
}

export function hasSupabaseTrackerConfig() {
  return Boolean(supabaseConfig());
}

export function createServerSupabaseClient() {
  const config = supabaseConfig();
  if (!config) return null;

  return createClient(config.url, config.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function groupBy(items, field) {
  const grouped = new Map();
  for (const item of items || []) {
    const key = item[field];
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  return grouped;
}

function latest(items, dateField) {
  return [...(items || [])].sort(
    (a, b) => new Date(b[dateField] || 0).getTime() - new Date(a[dateField] || 0).getTime()
  )[0];
}

async function getSupabaseState() {
  const client = createServerSupabaseClient();
  if (!client) return null;

  const [tasksResult, assetsResult, approvalsResult, profilesResult] = await Promise.all([
    client.from("tasks").select("*").order("updated_at", { ascending: false }).limit(5000),
    client.from("task_assets").select("*").order("created_at", { ascending: false }).limit(10000),
    client.from("approvals").select("*").order("requested_at", { ascending: false }).limit(10000),
    client.from("profiles").select("id, full_name, initials").limit(5000),
  ]);

  const failed = [tasksResult, assetsResult, approvalsResult, profilesResult].find((result) => result.error);
  if (failed) throw new Error(`Supabase tracker read failed: ${failed.error.message}`);

  const assetsByTask = groupBy(assetsResult.data, "task_id");
  const approvalsByTask = groupBy(approvalsResult.data, "task_id");
  const profileById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));

  const tasks = (tasksResult.data || []).map((task) => {
    const assets = assetsByTask.get(task.id) || [];
    const approvals = approvalsByTask.get(task.id) || [];
    const scriptApproval = latest(approvals.filter((item) => item.approval_type === "script"), "requested_at");
    const videoApproval = latest(approvals.filter((item) => item.approval_type === "video"), "requested_at");

    return {
      id: task.id,
      title: task.title,
      hookName: task.hook_name || task.title,
      brand: task.brand,
      product: task.product,
      campaign: task.campaign,
      briefType: task.brief_type,
      sourceSheet: task.source_sheet,
      category: task.category,
      contentType: task.content_type,
      priority: task.priority,
      state: task.state,
      summary: task.summary,
      platform: task.platform,
      scriptOwnerId: task.script_owner_id,
      editorId: task.editor_id,
      publisherId: task.publisher_id,
      editorName: profileById.get(task.editor_id)?.full_name,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      updatedBy:
        profileById.get(videoApproval?.decided_by || scriptApproval?.decided_by)?.full_name || "Plix Ops",
      assets,
      approvals,
      scriptApproval,
      videoApproval,
      activity: approvals.map((approval) => ({
        at: approval.decided_at || approval.requested_at,
        actor: profileById.get(approval.decided_by || approval.requested_by)?.full_name || "Plix Ops",
        text: approval.decision_comment || approval.request_comment || `${approval.approval_type} ${approval.status}`,
      })),
    };
  });

  return {
    revision: tasks.reduce((latestTime, task) => Math.max(latestTime, new Date(task.updatedAt || 0).getTime()), 0),
    updatedAt: tasks[0]?.updatedAt || new Date().toISOString(),
    tasks,
    users: (profilesResult.data || []).map((profile) => ({
      id: profile.id,
      name: profile.full_name,
      initials: profile.initials,
    })),
  };
}

function firstUrl(values) {
  for (const value of values.flat(Infinity)) {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
    if (value && typeof value === "object") {
      const candidate = value.url || value.link || value.href;
      if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) return candidate;
    }
  }
  return "";
}

function taskStage(state) {
  if (state === "published") return "live";
  if (["approved", "ready_for_performance"].includes(state)) return "video_approved";
  if (state === "approval_pending") return "video_pending";
  if (state === "editing_queue") return "script_approved";
  if (["editing_in_progress", "changes_requested", "publishing_in_progress", "publishing_failed"].includes(state)) {
    return "in_progress";
  }
  if (state === "script_approval_pending") return "script_pending";
  if (state === "draft") return "script_not_started";
  if (["social_research", "script_changes_requested"].includes(state)) return "in_progress";
  if (["on_hold", "blocked"].includes(state)) return "on_hold";
  if (state === "cancelled") return "rejected";
  return "unspecified";
}

function statusLabels(task) {
  const state = task.state;
  const scriptApproval = task.scriptApproval || latest(
    (task.approvals || []).filter((item) => (item.approval_type || item.approvalType) === "script"),
    "requested_at"
  );
  const videoApproval = task.videoApproval || latest(
    (task.approvals || []).filter((item) => (item.approval_type || item.approvalType) === "video"),
    "requested_at"
  );

  let scriptStatus = "Script not started";
  if (scriptApproval?.status === "approved" || ["editing_queue", "editing_in_progress", "approval_pending", ...FINISHED_STATES].includes(state)) {
    scriptStatus = "Script Approved";
  } else if (scriptApproval?.status === "changes_requested" || state === "script_changes_requested") {
    scriptStatus = "Script Changes Requested";
  } else if (scriptApproval?.status === "pending" || state === "script_approval_pending") {
    scriptStatus = "Script Approval Pending";
  } else if (state === "social_research") {
    scriptStatus = "Work in progress";
  }

  let videoStatus = "Not started";
  if (videoApproval?.status === "approved" || FINISHED_STATES.has(state)) videoStatus = "Video Approved";
  else if (videoApproval?.status === "changes_requested" || state === "changes_requested") videoStatus = "Changes requested";
  else if (videoApproval?.status === "pending" || state === "approval_pending") videoStatus = "Video Approval Pending";
  else if (["editing_queue", "editing_in_progress"].includes(state)) videoStatus = "Work in progress";
  else if (["on_hold", "blocked"].includes(state)) videoStatus = "On hold";
  else if (state === "cancelled") videoStatus = "Cancelled";

  return { scriptStatus, videoStatus };
}

function toDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function taskTeam(task) {
  const stateTeams = {
    draft: "Brand",
    social_research: "Content",
    script_changes_requested: "Content",
    script_approval_pending: "Brand",
    editing_queue: "Video",
    editing_in_progress: "Video",
    changes_requested: "Video",
    approval_pending: "Brand",
    approved: "Performance",
    ready_for_performance: "Performance",
    publishing_in_progress: "Performance",
    publishing_failed: "Performance",
    published: "Performance",
    cancelled: "Operations",
  };

  if (stateTeams[task.state]) return stateTeams[task.state];
  const lastStage = task.stageDurations?.[task.stageDurations.length - 1];
  const stageTeam = lastStage?.team;
  if (stageTeam === "brand") return "Brand";
  if (stageTeam === "content") return "Content";
  if (["edit", "video"].includes(stageTeam)) return "Video";
  if (stageTeam === "performance") return "Performance";
  return "Operations";
}

function taskToRecord(task, row, userById) {
  const { scriptStatus, videoStatus } = statusLabels(task);
  const stage = taskStage(task.state);
  const assets = task.assets || [];
  const assetOfType = (...types) => assets.find((asset) => types.includes(asset.asset_type || asset.assetType));
  const referenceAsset = assetOfType("reference");
  const scriptAsset = assetOfType("script");
  const videoAsset = assetOfType("video", "drive_link");
  const liveAsset = assetOfType("live_link");
  const dateRaw = task.createdAt || task.created_at || task.sourceDate || task.stageDurations?.[0]?.startedAt || task.updatedAt;
  const priorityRaw = task.priority || "";
  const priority = VALID_PRIORITIES.has(priorityRaw) ? priorityRaw : "Unspecified";
  const editor = task.editorName || userById.get(task.editorId || task.editor_id)?.name || "Unassigned";
  const activity = task.activity || [];
  const lastActivity = activity[0] || activity[activity.length - 1];
  const referenceUrl = firstUrl([referenceAsset, task.references || []]);
  const scriptUrl = firstUrl([scriptAsset, task.documents || [], task.scriptLink]);
  const driveUrl = firstUrl([videoAsset, task.versions || [], task.videoLink]);
  const liveUrl = firstUrl([liveAsset, task.liveUrl]);

  const record = {
    id: task.id,
    row,
    date: toDate(dateRaw),
    dateRaw: dateRaw || "",
    category: task.category || "Unspecified",
    type: task.contentType || task.content_type || task.briefType || "Unspecified",
    dependency: task.briefType === "ai" ? "AI creation" : "Script needed",
    product: task.product || task.title || "Product not recorded",
    outputProduct: task.brand || "",
    reference: referenceAsset?.label || (task.references || []).join(", "),
    referenceUrl,
    hooks: task.title || "",
    comments: task.summary || lastActivity?.text || "",
    scriptLink: scriptAsset?.label || scriptUrl,
    scriptUrl,
    brandComment: lastActivity?.text || "",
    priorityRaw,
    priority,
    scriptStatus,
    editor,
    videoStatus,
    hookName: task.hookName || task.hook_name || task.title || "",
    driveLink: videoAsset?.label || driveUrl,
    driveUrl,
    live: task.state === "published" ? "live" : "",
    liveUrl,
    state: task.state,
    team: taskTeam(task),
    updatedBy: task.updatedBy || lastActivity?.actor || "Plix Ops",
    issues: [],
    stage,
  };

  record.scriptPending = task.state === "script_approval_pending" || task.scriptApproval?.status === "pending";
  record.scriptApproved = scriptStatus === "Script Approved";
  record.scriptClosed = false;
  record.videoPending = task.state === "approval_pending" || task.videoApproval?.status === "pending";
  record.videoApproved = FINISHED_STATES.has(task.state) || task.videoApproval?.status === "approved";
  record.hold = ["on_hold", "blocked"].includes(task.state);
  record.wip = stage === "in_progress";
  record.reportedLive = task.state === "published";
  record.brandHandoff = task.state === "editing_queue";
  record.scriptRequired = task.briefType !== "ai";
  record.finishedSignal = record.reportedLive || record.videoApproved;
  record.pending = !record.finishedSignal && stage !== "rejected";

  if (!record.date) record.issues.push("Created date is missing or invalid");
  if (!task.product) record.issues.push("Product is not recorded");
  if (priority === "Unspecified" && priorityRaw) record.issues.push(`Unsupported priority: ${priorityRaw}`);
  if (task.hasMissingAssets) record.issues.push("Required assets are missing");
  if (["editing_queue", "editing_in_progress", "approval_pending"].includes(task.state) && editor === "Unassigned") {
    record.issues.push("Video work has no assigned editor");
  }

  return record;
}

function mergeTask(sheetTask, supabaseTask) {
  if (!sheetTask) return supabaseTask;
  if (!supabaseTask) return sheetTask;

  const merged = { ...sheetTask };
  for (const [key, value] of Object.entries(supabaseTask)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0 && Array.isArray(merged[key]) && merged[key].length) continue;
    merged[key] = value;
  }
  return merged;
}

function mergeStates(sheetState, supabaseState) {
  if (!supabaseState) return sheetState;

  const tasks = new Map((sheetState.tasks || []).map((task) => [task.id, task]));
  for (const task of supabaseState.tasks || []) {
    tasks.set(task.id, mergeTask(tasks.get(task.id), task));
  }

  const users = new Map((sheetState.users || []).map((user) => [user.id, user]));
  for (const user of supabaseState.users || []) {
    users.set(user.id, { ...(users.get(user.id) || {}), ...user });
  }

  return {
    revision: `${sheetState.revision || "sheet"}:${supabaseState.revision || "supabase"}`,
    updatedAt: [sheetState.updatedAt, supabaseState.updatedAt]
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0],
    tasks: [...tasks.values()],
    users: [...users.values()],
  };
}

export function buildTrackerPayload(state, viewer, sourceKind = "spreadsheet-realtime", warnings = []) {
  const userById = new Map((state.users || []).map((user) => [user.id, user]));
  const sortedTasks = [...(state.tasks || [])].sort(
    (a, b) => new Date(b.updatedAt || b.updated_at || 0).getTime() - new Date(a.updatedAt || a.updated_at || 0).getTime()
  );

  return {
    status: "success",
    viewer,
    fetchedAt: new Date().toISOString(),
    revision: state.revision || state.updatedAt,
    source: {
      title:
        sourceKind === "hybrid"
          ? "Excel / Google Sheets + Supabase"
          : "Excel / Google Sheets + Plix Ops realtime store",
      tab: "Unified task pipeline",
      locale: "en-IN",
      timeZone: "Asia/Kolkata",
      kind: sourceKind,
      warnings,
    },
    records: sortedTasks.map((task, index) => taskToRecord(task, index + 1, userById)),
  };
}

export async function getMasterAdminTrackerPayload(viewer) {
  const sheetState = await getState();

  try {
    const supabaseState = await getSupabaseState();
    if (supabaseState) return buildTrackerPayload(mergeStates(sheetState, supabaseState), viewer, "hybrid");
  } catch (error) {
    return buildTrackerPayload(sheetState, viewer, "spreadsheet-realtime", [
      `Spreadsheet-backed data is available, but Supabase could not be synced: ${error.message}`,
    ]);
  }

  return buildTrackerPayload(sheetState, viewer, "spreadsheet-realtime");
}
