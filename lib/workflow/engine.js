import { CATEGORY_ROUTING, STAGE_CONFIG, TEAM_VISIBLE_STATES } from "./constants";

/**
 * Maps a task state to its primary operational lifecycle stage.
 */
export function mapStateToStage(state) {
  switch (state) {
    case "draft":
      return { stage: "brand_intake", team: "brand" };
    case "social_research":
    case "script_changes_requested":
      return { stage: "content_scripting", team: "content" };
    case "script_approval_pending":
      return { stage: "brand_script_review", team: "brand" };
    case "editing_queue":
    case "editing_in_progress":
    case "changes_requested":
      return { stage: "video_production", team: "video" };
    case "approval_pending":
      return { stage: "brand_video_review", team: "brand" };
    case "ready_for_performance":
    case "publishing_in_progress":
    case "publishing_failed":
      return { stage: "perf_publishing", team: "performance" };
    case "published":
      return { stage: "published", team: "performance" };
    default:
      return { stage: "brand_intake", team: "brand" };
  }
}

/**
 * Filters tasks strictly based on team RBAC abstraction.
 */
export function filterTasksForTeam(tasks, team) {
  if (!team || team === "administrator") return tasks;
  const allowedStates = TEAM_VISIBLE_STATES[team] || [];
  return tasks.filter((task) => allowedStates.includes(task.state));
}

/**
 * Executes a transition on a task, recording stage execution timestamps & TAT.
 */
export function transitionTask(task, nextState, actor = "System", comment = null) {
  const now = new Date().toISOString();
  const currentStageInfo = mapStateToStage(task.state);
  const nextStageInfo = mapStateToStage(nextState);

  const stageDurations = Array.isArray(task.stageDurations) ? [...task.stageDurations] : [];

  // Close active stage if moving to a different stage
  const activeStageIndex = stageDurations.findIndex(
    (s) => s.stage === currentStageInfo.stage && !s.completedAt
  );

  if (activeStageIndex !== -1 && currentStageInfo.stage !== nextStageInfo.stage) {
    const active = { ...stageDurations[activeStageIndex] };
    active.completedAt = now;
    const startMs = new Date(active.startedAt).getTime();
    const endMs = new Date(now).getTime();
    active.durationSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));
    active.durationHours = +(active.durationSeconds / 3600).toFixed(1);
    active.durationDays = +(active.durationSeconds / 86400).toFixed(2);
    stageDurations[activeStageIndex] = active;
  }

  // Start new stage if changing stage
  if (currentStageInfo.stage !== nextStageInfo.stage || stageDurations.length === 0) {
    const previousRuns = stageDurations.filter((s) => s.stage === nextStageInfo.stage).length;
    stageDurations.push({
      stage: nextStageInfo.stage,
      team: nextStageInfo.team,
      iteration: previousRuns + 1,
      startedAt: now,
      completedAt: nextState === "published" ? now : null,
      durationSeconds: nextState === "published" ? 0 : null,
      durationHours: nextState === "published" ? 0 : null,
      actor,
    });
  }

  const activity = Array.isArray(task.activity) ? [...task.activity] : [];
  activity.unshift({
    at: now,
    actor,
    text: comment ? `Transitioned to ${nextState}: ${comment}` : `Transitioned to ${nextState}.`,
    state: nextState,
  });

  return {
    ...task,
    state: nextState,
    stageDurations,
    activity,
    updatedAt: now,
  };
}

/**
 * Computes metrics summary (elapsed turnaround by team and total pipeline duration).
 */
export function computePipelineMetrics(task) {
  const durations = task.stageDurations || [];
  if (!durations.length) {
    return {
      pipelineStartedAt: task.updatedAt || new Date().toISOString(),
      pipelineCompletedAt: null,
      totalElapsedDays: 0,
      isLive: task.state === "published",
      teamBreakdown: {},
    };
  }

  const pipelineStartedAt = durations[0].startedAt;
  const lastStage = durations[durations.length - 1];
  const pipelineCompletedAt = lastStage.completedAt;

  const startMs = new Date(pipelineStartedAt).getTime();
  const endMs = pipelineCompletedAt ? new Date(pipelineCompletedAt).getTime() : Date.now();
  const totalElapsedDays = +((endMs - startMs) / (1000 * 86400)).toFixed(2);

  const teamBreakdown = {};
  for (const s of durations) {
    if (!teamBreakdown[s.team]) {
      teamBreakdown[s.team] = { totalHours: 0, stages: [] };
    }
    const stageDurationHours = s.durationHours || 0;
    teamBreakdown[s.team].totalHours += stageDurationHours;
    teamBreakdown[s.team].stages.push({
      stage: s.stage,
      iteration: s.iteration,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      durationHours: stageDurationHours,
    });
  }

  return {
    pipelineStartedAt,
    pipelineCompletedAt,
    totalElapsedDays,
    isLive: task.state === "published",
    teamBreakdown,
  };
}

/**
 * Initializes a new brand brief with automatic routing.
 */
export function initializeBrief(input, creator = "Brand Manager") {
  const now = new Date().toISOString();
  const id = input.id || `PLX-${Math.floor(1000 + Math.random() * 9000)}`;
  const routing = CATEGORY_ROUTING[input.category] || { writerId: null, writerName: "Unassigned" };
  const asDraft = Boolean(input.asDraft);

  return {
    id,
    title: input.title,
    hookName: input.hookName,
    brand: "Plix",
    product: input.product,
    campaign: input.briefType === "ai" ? "AI Tracker Main" : "Work Plan",
    briefType: input.briefType || "video",
    sourceSheet: input.briefType === "ai" ? "AI Tracker Main" : "Work Plan",
    category: input.category,
    contentType: input.contentType,
    priority: input.priority || "P1",
    state: asDraft ? "draft" : "social_research",
    summary: input.summary || "",
    platform: input.platform || "Instagram",
    brandOwnerId: input.brandOwnerId || null,
    creatorId: input.creatorId || null,
    scriptOwnerId: routing.writerId,
    contentOwnerId: routing.writerId,
    editorId: null, // Editing managers assign an editor after Brand approves the script
    publisherId: null,
    references: input.referenceUrls || [],
    assets: [],
    approvals: [],
    stageDurations: asDraft
      ? [
          {
            stage: "brand_intake",
            team: "brand",
            iteration: 1,
            startedAt: now,
            completedAt: null,
            durationSeconds: null,
            durationHours: null,
            actor: creator,
          },
        ]
      : [
          {
            stage: "brand_intake",
            team: "brand",
            iteration: 1,
            startedAt: now,
            completedAt: now,
            durationSeconds: 60,
            durationHours: 0.1,
            actor: creator,
          },
          {
            stage: "content_scripting",
            team: "content",
            iteration: 1,
            startedAt: now,
            completedAt: null,
            durationSeconds: null,
            actor: routing.writerName || "Content Team",
          },
        ],
    activity: [
      {
        at: now,
        actor: creator,
        text: asDraft
          ? `Brand brief saved as draft with Hook "${input.hookName}". Stored in Brand Brief Draft folder.`
          : `Brand brief created with Hook "${input.hookName}". Auto-assigned writer: ${routing.writerName}.`,
      },
    ],
    updatedAt: now,
  };
}

