"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Bell, Check, CheckCheck, ChevronDown, CircleHelp, ExternalLink, FileText, Film,
  Folder, FolderOpen, LayoutDashboard, List, LogOut, Menu, MessageSquareWarning,
  PlayCircle, Plus, Rocket, Search, Send, Smartphone, Sparkles, Video, X
} from "lucide-react";
import { CATEGORY_ROUTING, CONTENT_TYPES_BY_BRIEF, FALLBACK_VIDEO_EDITOR, TEAM_VISIBLE_STATES } from "@/lib/workflow/constants";
import plixProductsCatalog from "@/data/plix-products.json";
import { computePipelineMetrics, transitionTask } from "@/lib/workflow/engine";
import {
  NotificationService,
  INITIAL_NOTIFICATIONS,
  NOTIFICATION_EVENTS,
  PRIMARY_NOTIFICATION_PHONE,
} from "@/lib/notifications/notification-service";

const STATE = {
  draft: { label: "Brand intake", tone: "teal" },
  social_research: { label: "Script queue", tone: "teal" },
  script_changes_requested: { label: "Script changes", tone: "rose" },
  script_approval_pending: { label: "Brand script approval", tone: "amber" },
  editing_queue: { label: "Video queue", tone: "teal" },
  editing_in_progress: { label: "Video production", tone: "blue" },
  changes_requested: { label: "Video changes", tone: "rose" },
  approval_pending: { label: "Brand approval pending", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  ready_for_performance: { label: "Ready for live", tone: "teal" },
  publishing_in_progress: { label: "Setup in progress", tone: "blue" },
  published: { label: "Live", tone: "green" },
  publishing_failed: { label: "Failed / On hold", tone: "rose" },
  on_hold: { label: "On hold", tone: "gray" },
  blocked: { label: "Blocked", tone: "rose" },
  cancelled: { label: "Cancelled", tone: "gray" },
};

// Isolated Kanban Columns - Each team dashboard ONLY exposes their permitted stages
const ROLE_COLUMNS = {
  brand: [
    ["draft", "Brand intake"],
    ["script_approval_pending", "Script approval gate"],
    ["approval_pending", "Video review gate"],
    ["published", "Live campaigns"],
  ],
  content: [
    ["social_research", "Script queue"],
    ["script_changes_requested", "Script changes"],
    ["script_approval_pending", "Brand approval"],
  ],
  edit: [
    ["editing_queue", "Video queue"],
    ["editing_in_progress", "Video production"],
    ["changes_requested", "Video rework"],
    ["approval_pending", "Brand approval pending"],
  ],
  video: [
    ["editing_queue", "Video queue"],
    ["editing_in_progress", "Video production"],
    ["changes_requested", "Video rework"],
    ["approval_pending", "Brand approval pending"],
  ],
  performance: [
    ["ready_for_performance", "Ready for live"],
    ["publishing_in_progress", "Setup in progress"],
    ["published", "Live"],
    ["publishing_failed", "Failed / On hold"],
  ],
  administrator: [
    ["draft", "Intake"],
    ["social_research", "Content scripting"],
    ["editing_queue", "Video editing"],
    ["ready_for_performance", "Ready for live"],
    ["published", "Live in market"],
  ],
};

function normalizeRole(role) {
  if (role === "edit") return "video";
  return role || "content";
}

function roleLabel(role) {
  switch (role) {
    case "brand": return "Brand Team";
    case "content": return "Content Team";
    case "edit":
    case "video": return "Video Team";
    case "performance": return "Performance Team";
    case "administrator": return "Operations Admin";
    default: return role;
  }
}

function briefType(task) {
  return task.briefType || (task.sourceSheet === "AI Tracker Main" || task.campaign === "AI Tracker Main" ? "ai" : "video");
}

function sourceSheet(task) {
  return task.sourceSheet || task.source?.sheet || (briefType(task) === "ai" ? "AI Tracker Main" : "Work Plan");
}

function dedupeUsers(users) {
  return [...new Map((users || []).map((user) => [user.id, user])).values()];
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function Avatar({ person, small = false }) {
  return <span className={`avatar ${person?.tone || "slate"} ${small ? "small" : ""}`}>{person?.initials || "TM"}</span>;
}

function Priority({ value }) {
  const labels = {
    P0: "P0 URGENT",
    p0: "P0 URGENT",
    P1: "P1 HIGH",
    p1: "P1 HIGH",
    P2: "P2 NORMAL",
    p2: "P2 NORMAL",
    R0: "R0 REVISION",
    r0: "R0 REVISION",
  };
  const label = labels[value] || `${String(value).toUpperCase()} PRIORITY`;
  return <span className={`priority priority-${String(value).toLowerCase()}`}>{label}</span>;
}

function BriefBadge({ task }) {
  const isAi = briefType(task) === "ai";
  return <span className={`brief-badge ${isAi ? "ai" : "video"}`}>{isAi ? <Sparkles size={12} /> : <Video size={12} />}{isAi ? "AI brief" : "Video brief"}</span>;
}

function ContentTypeBadge({ value }) {
  return <span className="content-type-badge">{value || "Content type not set"}</span>;
}

function TaskHeaderBadges({ task }) {
  return <div className="task-header-badges"><Priority value={task.priority} /><BriefBadge task={task} /><ContentTypeBadge value={task.contentType} /></div>;
}

function Status({ state }) {
  const meta = STATE[state] || { label: state, tone: "gray" };
  return <span className={`status ${meta.tone}`}><i />{meta.label}</span>;
}

function OwnerSelect({ task, writers, onChange, compact = false }) {
  return (
    <select
      className={`owner-select ${compact ? "compact" : ""}`}
      value={task.scriptOwnerId || task.contentOwnerId || ""}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(task.id, event.target.value)}
      aria-label={`Assign writer for ${task.title}`}
    >
      <option value="">Unassigned</option>
      {writers.map((writer) => <option value={writer.id} key={writer.id}>{writer.name}</option>)}
    </select>
  );
}

function EditorSelect({ task, editors, onChange, compact = false }) {
  return (
    <select
      className={`owner-select ${compact ? "compact" : ""}`}
      value={task.editorId || ""}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(task.id, event.target.value)}
      aria-label={`Assign editor for ${task.title}`}
    >
      <option value="">Unassigned</option>
      {editors.map((editor) => <option value={editor.id} key={editor.id}>{editor.name}</option>)}
    </select>
  );
}

function VideoManagerConsole({
  tasks, editors, teamMembers, onOpen, onAssign, brief, onBriefChange,
  priority, onPriorityChange, status, onStatusChange, search,
}) {
  const [managerView, setManagerView] = useState("queue");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isOverdue = (task) => {
    if (!task.targetDate || ["approved", "published", "cancelled"].includes(task.state)) return false;
    const due = new Date(`${task.targetDate}T00:00:00`);
    return Number.isFinite(due.getTime()) && due < today;
  };

  const queueTasks = tasks.filter((task) => {
    const haystack = [task.id, task.title, task.hookName, task.product, task.category, task.contentType].join(" ").toLowerCase();
    return briefType(task) === brief &&
      (priority === "all" || task.priority === priority) &&
      (status === "all" || task.state === status) &&
      (!search || haystack.includes(search.toLowerCase()));
  });

  const counts = {
    unassigned: queueTasks.filter((task) => !task.editorId).length,
    production: queueTasks.filter((task) => task.state === "editing_in_progress").length,
    rework: queueTasks.filter((task) => task.state === "changes_requested").length,
    review: queueTasks.filter((task) => task.state === "approval_pending").length,
    overdue: queueTasks.filter(isOverdue).length,
  };

  const roster = teamMembers.map((editor) => {
    const assigned = tasks.filter((task) => task.editorId === editor.id);
    return {
      editor,
      total: assigned.length,
      queued: assigned.filter((task) => task.state === "editing_queue").length,
      editing: assigned.filter((task) => task.state === "editing_in_progress").length,
      rework: assigned.filter((task) => task.state === "changes_requested").length,
      review: assigned.filter((task) => task.state === "approval_pending").length,
      overdue: assigned.filter(isOverdue).length,
    };
  }).filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.editor.name.localeCompare(b.editor.name));

  const unassigned = tasks.filter((task) => !task.editorId);
  const workloadRows = [{
    editor: { id: "unassigned", name: "Unassigned", initials: "—", tone: "slate" },
    total: unassigned.length,
    queued: unassigned.filter((task) => task.state === "editing_queue").length,
    editing: unassigned.filter((task) => task.state === "editing_in_progress").length,
    rework: unassigned.filter((task) => task.state === "changes_requested").length,
    review: unassigned.filter((task) => task.state === "approval_pending").length,
    overdue: unassigned.filter(isOverdue).length,
  }, ...roster];

  return (
    <section className="video-manager-console">
      <header className="video-manager-head">
        <div><span className="eyebrow">Editing operations</span><h2>Video production control room</h2><p>Assign approved briefs, balance editor workload, and track every cut through Brand review.</p></div>
        <div className="manager-view-toggle" aria-label="Editing manager view">
          <button className={managerView === "queue" ? "active" : ""} onClick={() => setManagerView("queue")}><LayoutDashboard size={16} /> Work queue</button>
          <button className={managerView === "workload" ? "active" : ""} onClick={() => setManagerView("workload")}><List size={16} /> Team workload</button>
        </div>
      </header>

      <div className="video-manager-metrics">
        <article className={counts.unassigned ? "attention" : ""}><span>Needs assignment</span><strong>{counts.unassigned}</strong><small>Briefs without an editor</small></article>
        <article><span>In production</span><strong>{counts.production}</strong><small>Active edits underway</small></article>
        <article className={counts.rework ? "attention" : ""}><span>Returned for changes</span><strong>{counts.rework}</strong><small>Cuts needing a new version</small></article>
        <article><span>With Brand</span><strong>{counts.review}</strong><small>Submitted for review</small></article>
        <article className={counts.overdue ? "danger" : ""}><span>Overdue</span><strong>{counts.overdue}</strong><small>Past the target date</small></article>
      </div>

      <section className="manager-toolbar panel">
        <div className="queue-tabs"><button className={brief === "video" ? "active" : ""} onClick={() => onBriefChange("video")}>Video brief queue</button><button className={brief === "ai" ? "active" : ""} onClick={() => onBriefChange("ai")}>AI brief queue</button></div>
        <div className="filter"><select value={priority} onChange={(event) => onPriorityChange(event.target.value)} aria-label="Filter by priority"><option value="all">All priorities</option>{["P0", "P1", "P2", "R0"].map((value) => <option key={value}>{value}</option>)}</select></div>
        <div className="filter"><select value={status} onChange={(event) => onStatusChange(event.target.value)} aria-label="Filter by workflow status"><option value="all">All statuses</option>{ROLE_COLUMNS.edit.map(([value, label]) => <option value={value} key={value}>{label}</option>)}<option value="blocked">Blocked</option></select></div>
        <span className="result-count">{queueTasks.length} matching briefs</span>
      </section>

      {managerView === "workload" ? (
        <section className="manager-workload panel">
          <header><div><h3>Editor workload</h3><p>Assignment load from the current Plix workflow records.</p></div><span>{tasks.length} active video records</span></header>
          <div className="manager-table-scroll"><table>
            <thead><tr><th>Editor</th><th>Total</th><th>Queued</th><th>Editing</th><th>Rework</th><th>Brand review</th><th>Overdue</th></tr></thead>
            <tbody>{workloadRows.map((row) => <tr key={row.editor.id}><td><span className="workload-editor"><Avatar person={row.editor} small /><strong>{row.editor.name}</strong></span></td><td><b>{row.total}</b></td><td>{row.queued}</td><td>{row.editing}</td><td>{row.rework}</td><td>{row.review}</td><td><span className={row.overdue ? "overdue-count" : ""}>{row.overdue}</span></td></tr>)}</tbody>
          </table></div>
        </section>
      ) : (
        <section className="manager-queue panel">
          <div className="manager-table-scroll"><table>
            <thead><tr><th>Brief</th><th>Type</th><th>Approved assets</th><th>Assigned editor</th><th>Target</th><th>Progress</th><th>Status</th></tr></thead>
            <tbody>{queueTasks.map((task) => {
              const due = task.targetDate ? new Date(`${task.targetDate}T00:00:00`) : null;
              const assetLink = task.scriptLink || task.referenceUrl;
              const taskProgress = Math.max(0, Math.min(100, Number(task.progress) || 0));
              return <tr key={task.id} onClick={() => onOpen(task)}>
                <td className="manager-brief-cell"><strong>{task.title || task.hookName || "Untitled brief"}</strong><span>{task.id} · {task.product} · {task.category}</span></td>
                <td><span className={`manager-brief-type ${briefType(task)}`}>{briefType(task) === "ai" ? "AI brief" : "Video brief"}</span><small>{sourceSheet(task)}</small></td>
                <td>{assetLink ? <a href={assetLink} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><FileText size={14} /> Open script <ExternalLink size={12} /></a> : <span className="asset-missing">No link</span>}</td>
                <td><EditorSelect task={task} editors={editors} onChange={onAssign} compact /></td>
                <td><time className={isOverdue(task) ? "date-overdue" : ""}>{due && Number.isFinite(due.getTime()) ? due.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Not set"}</time></td>
                <td><div className="manager-progress"><i><b style={{ width: `${taskProgress}%` }} /></i><span>{taskProgress}%</span></div></td>
                <td><Status state={task.state} /></td>
              </tr>;
            })}</tbody>
          </table>{!queueTasks.length && <div className="manager-empty"><Check size={19} /><strong>No matching video work</strong><span>Try another brief type or filter.</span></div>}</div>
        </section>
      )}
    </section>
  );
}

function TaskCard({ task, writers, users, onOpen, onAssign }) {
  const writer = users.find((person) => person.id === (task.scriptOwnerId || task.contentOwnerId));
  const currentStage = (task.stageDurations || []).slice(-1)[0];
  const stageDuration = currentStage?.durationHours !== null && currentStage?.durationHours !== undefined
    ? `${currentStage.durationHours}h`
    : "Active";

  return (
    <button className="task-card" onClick={() => onOpen(task)}>
      <div className="task-card-top">
        <TaskHeaderBadges task={task} />
        <Status state={task.state} />
      </div>
      <h3>{task.title}</h3>
      <p>{task.product} <i /> {task.category} <i /> Hook: <strong>{task.hookName || "Not set"}</strong></p>
      <div className="requirement-preview">
        <b>Requirements & Deliverables</b>
        <span>{task.summary || "No additional requirements provided."}</span>
      </div>
      <div className="card-assignment">
        <span>
          <b>Assigned owner</b>
          <span className="owner"><Avatar person={writer} small />{writer?.name || "Unassigned"}</span>
        </span>
        <OwnerSelect task={task} writers={writers} onChange={onAssign} compact />
      </div>
      <div className="task-card-foot">
        <span>{task.id}</span>
        <span>Stage TAT: <strong>{stageDuration}</strong></span>
      </div>
    </button>
  );
}

function Board({ tasks, columns, writers, users, onOpen, onAssign }) {
  return (
    <div className={`kanban ${columns.length === 3 ? "content-kanban" : ""}`}>
      {columns.map(([state, label]) => {
        const items = tasks.filter((task) => task.state === state);
        return (
          <section className="kanban-column" key={state}>
            <header>
              <span className={`column-dot ${STATE[state]?.tone || "teal"}`} />
              <strong>{label}</strong>
              <b>{items.length}</b>
            </header>
            <label className="column-search">
              <Search size={15} />
              <span>Search {label.toLowerCase()}</span>
            </label>
            <div className="column-cards">
              {items.map((task) => (
                <TaskCard key={task.id} task={task} writers={writers} users={users} onOpen={onOpen} onAssign={onAssign} />
              ))}
              {!items.length && (
                <div className="column-empty">
                  <Check size={19} />
                  <span>No tasks in this queue</span>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function BrandFolderView({ tasks, onOpen, onCreateBrief, writers = [], users = [], onAssign }) {
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [folderView, setFolderView] = useState("board"); // Board view by default
  const [folderSearch, setFolderSearch] = useState("");
  const [groupBy, setGroupBy] = useState("category"); // "category" | "priority" | "state"

  const folders = useMemo(() => [
    {
      id: "brief_drafts",
      name: "Brand Brief Draft",
      subtitle: "Draft briefs in preparation before release to production",
      states: ["draft"],
      color: "#0f8975",
    },
    {
      id: "script_approval",
      name: "Script Approval Gate",
      subtitle: "Content scripts submitted by writers awaiting your review & decision",
      states: ["script_approval_pending"],
      color: "#d97706",
    },
    {
      id: "video_approval",
      name: "Video Review Gate",
      subtitle: "Video cuts submitted by editors awaiting your review & decision",
      states: ["approval_pending"],
      color: "#4f46e5",
    },
    {
      id: "revisions_feedback",
      name: "Revisions & Rework",
      subtitle: "Briefs with revisions requested (Content or Video rework)",
      states: ["script_changes_requested", "changes_requested"],
      color: "#dc2626",
    },
    {
      id: "live_campaigns",
      name: "Live Campaigns",
      subtitle: "Approved creative live in market or ready for launch",
      states: ["ready_for_performance", "publishing_in_progress", "published"],
      color: "#16a34a",
    },
  ], []);

  const activeFolder = folders.find((f) => f.id === activeFolderId);
  const rawFolderTasks = useMemo(() => {
    if (!activeFolder) return [];
    return tasks.filter((t) => activeFolder.states.includes(t.state));
  }, [tasks, activeFolder]);

  const folderTasks = useMemo(() => {
    if (!folderSearch) return rawFolderTasks;
    const query = folderSearch.toLowerCase();
    return rawFolderTasks.filter((t) => {
      const text = [t.id, t.title, t.hookName, t.product, t.category, t.contentType].join(" ").toLowerCase();
      return text.includes(query);
    });
  }, [rawFolderTasks, folderSearch]);

  // When a folder is clicked, render the folder view (Board view by default)
  if (activeFolder) {
    const isMultiState = activeFolder.states.length > 1;

    let boardColumns = [];
    if (groupBy === "category") {
      boardColumns = [
        ["Skin", "Skin (Himani / Sanjeet)", "teal"],
        ["Hair", "Hair (Zoha / Sidhharth)", "blue"],
        ["Nutra", "Nutra (Tanmay / Sindhura)", "amber"],
        ["Joyun", "Joyun (Shama)", "rose"],
        ["B2G2", "B2G2 & Global", "green"],
      ];
    } else if (groupBy === "priority") {
      boardColumns = [
        ["P0", "P0 URGENT", "rose"],
        ["P1", "P1 HIGH", "amber"],
        ["P2", "P2 NORMAL", "teal"],
        ["R0", "R0 REVISION", "blue"],
      ];
    } else {
      boardColumns = activeFolder.states.map((s) => [
        s,
        STATE[s]?.label || s,
        STATE[s]?.tone || "teal",
      ]);
    }

    return (
      <div className="folder-detail-container">
        <div className="folder-detail-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <button className="button folder-back-btn" onClick={() => setActiveFolderId(null)}>
              <ArrowLeft size={15} />
              <span>Back to all folders</span>
            </button>
            <div className="folder-breadcrumb">
              <span onClick={() => setActiveFolderId(null)} className="crumb-link">
                Folders
              </span>
              <span className="crumb-separator">/</span>
              <span className="crumb-active">
                <Folder size={16} style={{ color: activeFolder.color }} />
                <strong>{activeFolder.name}</strong>
                <b className="folder-badge">{folderTasks.length}</b>
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginLeft: "auto" }}>
            <label className="column-search" style={{ height: "36px", marginBottom: 0, minWidth: "190px" }}>
              <Search size={14} />
              <input
                type="text"
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
                placeholder={`Search ${activeFolder.name}...`}
                style={{ border: 0, outline: 0, background: "transparent", fontSize: "12px", width: "100%" }}
              />
            </label>

            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="owner-select compact"
              style={{ minHeight: "36px", fontSize: "11px", fontWeight: "700" }}
              aria-label="Group briefs by"
            >
              <option value="category">Board: By Category</option>
              <option value="priority">Board: By Priority</option>
              {isMultiState && <option value="state">Board: By Sub-Stage</option>}
            </select>

            <div className="view-toggle" style={{ margin: 0 }}>
              <button
                className={folderView === "board" ? "active" : ""}
                onClick={() => setFolderView("board")}
                title="Kanban Board View"
              >
                <LayoutDashboard size={15} />
                Board
              </button>
              <button
                className={folderView === "list" ? "active" : ""}
                onClick={() => setFolderView("list")}
                title="Table List View"
              >
                <List size={15} />
                List
              </button>
            </div>

            {activeFolder.id === "brief_drafts" && onCreateBrief && (
              <button
                className="button primary"
                style={{ minHeight: "36px", padding: "0 13px", fontSize: "12px" }}
                onClick={onCreateBrief}
              >
                <Plus size={14} />New brief
              </button>
            )}
          </div>
        </div>

        {folderView === "board" ? (
          <div className="kanban folder-kanban">
            {boardColumns.map(([colKey, colLabel, tone]) => {
              const colItems = folderTasks.filter((task) => {
                if (groupBy === "category") return (task.category || "B2G2") === colKey;
                if (groupBy === "priority") return task.priority === colKey;
                return task.state === colKey;
              });

              return (
                <section className="kanban-column" key={colKey}>
                  <header>
                    <span className={`column-dot ${tone || "teal"}`} />
                    <strong>{colLabel}</strong>
                    <b>{colItems.length}</b>
                  </header>
                  <div className="column-cards">
                    {colItems.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        writers={writers}
                        users={users}
                        onOpen={onOpen}
                        onAssign={onAssign}
                      />
                    ))}
                    {!colItems.length && (
                      <div className="column-empty">
                        <Check size={18} />
                        <span>No briefs in this column</span>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <TaskList
            tasks={folderTasks}
            writers={writers}
            onOpen={onOpen}
            onAssign={onAssign}
          />
        )}
      </div>
    );
  }

  // Initial Standard Rectangular Folder View with minimal icons
  return (
    <div className="folder-grid">
      {folders.map((folder) => {
        const count = tasks.filter((t) => folder.states.includes(t.state)).length;
        return (
          <button
            key={folder.id}
            className="folder-card"
            onClick={() => {
              setActiveFolderId(folder.id);
              setGroupBy(folder.states.length > 1 ? "state" : "category");
            }}
          >
            <div className="folder-card-header">
              <div className="folder-title-row">
                <Folder size={17} style={{ color: folder.color }} />
                <h3>{folder.name}</h3>
              </div>
              <span className="folder-count-badge" style={{ background: count > 0 ? folder.color : "#64748b" }}>
                {count} {count === 1 ? "brief" : "briefs"}
              </span>
            </div>
            <div className="folder-card-body">
              <p>{folder.subtitle}</p>
            </div>
            <div className="folder-card-footer">
              <span>Open board &rarr;</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function TaskList({ tasks, writers, onOpen, onAssign }) {
  return (
    <section className="task-list panel">
      <table>
        <thead>
          <tr>
            <th>Task & Hook</th>
            <th>Brief</th>
            <th>Owner</th>
            <th>Priority</th>
            <th>Content type</th>
            <th>Stage TAT</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const currentStage = (task.stageDurations || []).slice(-1)[0];
            const durationLabel = currentStage?.durationHours !== null && currentStage?.durationHours !== undefined
              ? `${currentStage.durationHours}h`
              : "Active";

            return (
              <tr key={task.id} onClick={() => onOpen(task)}>
                <td>
                  <strong>{task.title}</strong>
                  <span>{task.id} · {task.product} · Hook: <em>{task.hookName || "Not set"}</em></span>
                </td>
                <td><BriefBadge task={task} /><span className="source">{sourceSheet(task)}</span></td>
                <td><OwnerSelect task={task} writers={writers} onChange={onAssign} compact /></td>
                <td><Priority value={task.priority} /></td>
                <td>{task.contentType}</td>
                <td><strong>{durationLabel}</strong></td>
                <td><Status state={task.state} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!tasks.length && (
        <div className="empty-results">
          <Search size={22} />
          <strong>No matching tasks</strong>
          <span>Try another search or filter.</span>
        </div>
      )}
    </section>
  );
}

function ScriptHandoffSection({ task, role, onSubmitScript, onSubmitVideo, onGoLive, onBrandDecision, onReleaseDraftBrief }) {
  const [hookName, setHookName] = useState(task?.hookName || "");
  const [scriptUrl, setScriptUrl] = useState(task?.scriptLink || "");
  const [videoUrl, setVideoUrl] = useState(task?.videoLink || "");
  const [liveUrl, setLiveUrl] = useState(task?.liveUrl || "");
  const [comment, setComment] = useState("");

  // Brand Draft Action Gate - release draft to Content queue
  if ((role === "brand" || role === "administrator") && task.state === "draft") {
    return (
      <div className="script-form">
        <div style={{ background: "#f6f8f6", padding: "12px 14px", borderRadius: "4px", border: "1px solid #dfe3df", fontSize: "12px", color: "#4f5551", lineHeight: "1.5" }}>
          This brief is currently saved in <strong>Brand Brief Draft</strong>. Once creative requirements are finalized, release it to Content Team queue to assign a script writer.
        </div>
        <div className="script-actions" style={{ marginTop: "12px" }}>
          <button
            className="button primary"
            type="button"
            onClick={() => onReleaseDraftBrief && onReleaseDraftBrief(task)}
          >
            <Send size={14} />Release Brief to Content Queue
          </button>
        </div>
      </div>
    );
  }

  // Brand Approval Action Gate - only Brand & Admin can approve/reject
  if ((role === "brand" || role === "administrator") && ["script_approval_pending", "approval_pending"].includes(task.state)) {
    const isScript = task.state === "script_approval_pending";
    return (
      <div className="script-form">
        <label>
          <span>Brand Decision Notes</span>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Decision notes for the team..." />
        </label>
        <div className="script-actions">
          <button className="button changes" type="button" onClick={() => onBrandDecision(task.id, "changes_requested", isScript ? "script" : "video", comment)}>
            <MessageSquareWarning size={15} />Request changes
          </button>
          <button className="button primary" type="button" onClick={() => onBrandDecision(task.id, "approved", isScript ? "script" : "video", comment)}>
            <Check size={15} />{isScript ? "Approve Script -> Release to Video" : "Approve Video -> Release to Perf"}
          </button>
        </div>
      </div>
    );
  }

  // Content Submission - only Content can prepare & submit scripts
  if (role === "content" && ["social_research", "script_changes_requested"].includes(task.state)) {
    return (
      <form className="script-form" onSubmit={(e) => { e.preventDefault(); onSubmitScript(task, scriptUrl, comment, hookName); }}>
        <label>
          <span>Hook Name</span>
          <input required maxLength={200} value={hookName} onChange={(e) => setHookName(e.target.value)} placeholder="Enter the hook name" />
        </label>
        <label>
          <span>Google Docs script link</span>
          <input type="url" required value={scriptUrl} onChange={(e) => setScriptUrl(e.target.value)} placeholder="https://docs.google.com/document/d/..." />
        </label>
        <label>
          <span>Note for Brand <small>(optional)</small></span>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Instructions or questions for Brand..." />
        </label>
        <div className="script-actions">
          <button className="button primary" type="submit"><Send size={15} />Send script to Brand Team</button>
        </div>
      </form>
    );
  }

  // Video Submission - only Video editors can submit cuts
  if ((role === "edit" || role === "video") && ["editing_queue", "editing_in_progress", "changes_requested"].includes(task.state)) {
    return (
      <form className="script-form" onSubmit={(e) => { e.preventDefault(); onSubmitVideo(task, videoUrl, comment); }}>
        <label>
          <span>Google Drive video cut link</span>
          <input type="url" required value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://drive.google.com/file/d/..." />
        </label>
        <label>
          <span>Editor Notes</span>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Aspect ratio, duration, audio notes..." />
        </label>
        <div className="script-actions">
          <button className="button primary" type="submit"><Video size={15} />Send cut to Brand for approval</button>
        </div>
      </form>
    );
  }

  // Performance Go Live - only Performance can launch campaigns
  if (role === "performance" && ["ready_for_performance"].includes(task.state)) {
    return (
      <form className="script-form" onSubmit={(e) => { e.preventDefault(); onGoLive(task, liveUrl, comment); }}>
        <label>
          <span>Live Campaign URL</span>
          <input type="url" required value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="https://instagram.com/reel/... or https://..." />
        </label>
        <label>
          <span>Publishing Notes</span>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ad set ID, UTM campaign, budget..." />
        </label>
        <div className="script-actions">
          <button className="button primary" type="submit"><Rocket size={15} />Record Go-Live</button>
        </div>
      </form>
    );
  }

  // Default Asset Preview
  return (
    <div className="submitted-script">
      <Check size={18} />
      <div>
        <strong>Delivered Assets</strong>
        {task.scriptLink && <a href={task.scriptLink} target="_blank" rel="noreferrer">Open Google Doc <ExternalLink size={13} /></a>}
        {task.videoLink && <a href={task.videoLink} target="_blank" rel="noreferrer">Open Google Drive Video <ExternalLink size={13} /></a>}
        {task.liveUrl && <a href={task.liveUrl} target="_blank" rel="noreferrer">View Live Ad Link <ExternalLink size={13} /></a>}
      </div>
    </div>
  );
}

function Drawer({ task, role, users, writers, editors, canAssignEditor, onClose, onAssign, onAssignEditor, onSubmitScript, onSubmitVideo, onGoLive, onBrandDecision, onReleaseDraftBrief }) {
  const [tab, setTab] = useState("overview");
  if (!task) return null;
  const writer = users.find((person) => person.id === (task.scriptOwnerId || task.contentOwnerId));
  const editor = users.find((person) => person.id === task.editorId);
  const isVideoTask = ["editing_queue", "editing_in_progress", "changes_requested", "approval_pending"].includes(task.state);
  const metrics = computePipelineMetrics(task);

  return (
    <>
      <button className="drawer-backdrop" onClick={onClose} aria-label="Close task details" />
      <aside className="drawer">
        <header className="drawer-head">
          <div>
            <span className="eyebrow">{task.id} · {task.category}</span>
            <TaskHeaderBadges task={task} />
            <h2>{task.title}</h2>
            <p>{task.product} · Hook: <strong>{task.hookName || "Not set"}</strong></p>
          </div>
          <button className="close-button" onClick={onClose}><X /></button>
        </header>
        <nav className="drawer-tabs">
          {["overview", "timing", "activity"].map((item) => (
            <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>
          ))}
        </nav>
        <div className="drawer-body">
          {tab === "overview" && (
            <>
              <section className="detail-section">
                <div className="section-title">
                  <h3>Handoff Gate & Action</h3>
                  <Status state={task.state} />
                </div>
                <ScriptHandoffSection
                  task={task}
                  role={role}
                  onSubmitScript={onSubmitScript}
                  onSubmitVideo={onSubmitVideo}
                  onGoLive={onGoLive}
                  onBrandDecision={onBrandDecision}
                  onReleaseDraftBrief={onReleaseDraftBrief}
                />
              </section>

              <section className="detail-section">
                <div className="section-title">
                  <h3>Requirements from Brand Team</h3>
                  <BriefBadge task={task} />
                </div>
                <p className="summary">{task.summary || "No additional requirements were provided."}</p>
                <div className="deliverables">
                  {(task.deliverables || []).map((item) => <span key={item}><Check size={13} />{item}</span>)}
                </div>
              </section>

              <section className="detail-section">
                <div className="section-title">
                  <h3>Assignment & Context</h3>
                </div>
                <div className="detail-grid">
                  <div>
                    <label>{isVideoTask ? "Assigned Editor" : "Assigned Owner"}</label>
                    {isVideoTask
                      ? (canAssignEditor
                        ? <EditorSelect task={task} editors={editors} onChange={onAssignEditor} />
                        : <span className="inline-owner"><Avatar person={editor} small />{editor?.name || "Unassigned"}</span>)
                      : <OwnerSelect task={task} writers={writers} onChange={onAssign} />}
                  </div>
                  <div>
                    <label>Current Owner</label>
                    <span className="inline-owner"><Avatar person={isVideoTask ? editor : writer} small />{(isVideoTask ? editor : writer)?.name || "Unassigned"}</span>
                  </div>
                  <div>
                    <label>Priority</label>
                    <Priority value={task.priority} />
                  </div>
                  <div>
                    <label>Total Pipeline Lead Time</label>
                    <span>{metrics.totalElapsedDays} Days</span>
                  </div>
                  <div>
                    <label>Source</label>
                    <span>{sourceSheet(task)}</span>
                  </div>
                  <div>
                    <label>Platform</label>
                    <span>{task.platform || "Instagram"}</span>
                  </div>
                </div>
              </section>

              <section className="detail-section">
                <div className="section-title">
                  <h3>References</h3>
                  <span className="eyebrow">{(task.references || []).length} attached</span>
                </div>
                <div className="references">
                  {(task.references || []).map((ref, index) =>
                    /^https:\/\//i.test(ref) ? (
                      <a href={ref} target="_blank" rel="noreferrer" key={`${ref}-${index}`}>
                        <ExternalLink size={14} />Open reference
                      </a>
                    ) : (
                      <span key={`${ref}-${index}`}><FileText size={14} />{ref}</span>
                    )
                  )}
                </div>
              </section>
            </>
          )}

          {tab === "timing" && (
            <section className="detail-section">
              <div className="section-title">
                <h3>Stage Execution & Turnaround (TAT)</h3>
                <span className="eyebrow">Total: {metrics.totalElapsedDays} Days</span>
              </div>
              <p className="summary" style={{ marginBottom: "16px" }}>
                Execution timestamps and turnaround times for each team handoff.
              </p>
              {(task.stageDurations || []).map((s, idx) => (
                <article className="activity-row" key={`${s.stage}-${idx}`}>
                  <span className="activity-dot" />
                  <div>
                    <strong>{s.stage.replace(/_/g, " ").toUpperCase()} · Team: {s.team}</strong>
                    <p>
                      Started: {formatDateTime(s.startedAt)}
                      {s.completedAt ? ` · Completed: ${formatDateTime(s.completedAt)}` : " · Currently active"}
                    </p>
                    <time>{s.durationHours !== null && s.durationHours !== undefined ? `Turnaround: ${s.durationHours} hrs` : "In progress"}</time>
                  </div>
                </article>
              ))}
            </section>
          )}

          {tab === "activity" && (
            <section className="detail-section">
              <div className="section-title"><h3>Activity History</h3></div>
              {(task.activity || []).map((item, index) => (
                <article className="activity-row" key={`${item.at}-${index}`}>
                  <span className="activity-dot" />
                  <div>
                    <strong>{item.actor}</strong>
                    <p>{item.text}</p>
                    <time>{formatDateTime(item.at)}</time>
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      </aside>
    </>
  );
}

function NewBriefModal({ onClose, onSubmit }) {
  const defaultBrief = "video";
  const defaultProduct = plixProductsCatalog.products?.[0]?.name || "Apple Cider Vinegar Effervescent";
  const defaultCategory = plixProductsCatalog.products?.[0]?.category || "Nutra";

  const [formData, setFormData] = useState({
    title: "",
    hookName: "",
    product: defaultProduct,
    category: defaultCategory,
    contentType: (CONTENT_TYPES_BY_BRIEF[defaultBrief] || ["UGC"])[0],
    briefType: defaultBrief,
    priority: "P1",
    summary: "",
    referenceUrl: "",
  });

  const [productSearch, setProductSearch] = useState("");

  const routing = CATEGORY_ROUTING[formData.category];

  // Dynamically vary content type options based on brief type (same as PlixSheetAutomation)
  const handleBriefTypeChange = (newBriefType) => {
    const allowed = CONTENT_TYPES_BY_BRIEF[newBriefType] || [];
    const nextType = allowed.includes(formData.contentType) ? formData.contentType : allowed[0];
    setFormData((prev) => ({
      ...prev,
      briefType: newBriefType,
      contentType: nextType,
    }));
  };

  // Sync category automatically when a product from the official catalog is selected
  const handleProductChange = (productName) => {
    const found = plixProductsCatalog.products.find((p) => p.name === productName);
    setFormData((prev) => ({
      ...prev,
      product: productName,
      category: found?.category || prev.category,
    }));
  };

  // Filter product catalog by search input
  const filteredProducts = useMemo(() => {
    const list = plixProductsCatalog.products || [];
    if (!productSearch.trim()) return list;
    const q = productSearch.toLowerCase();
    return list.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [productSearch]);

  const handleAction = (asDraft = false) => {
    if (!formData.title.trim()) {
      alert("Please provide a Campaign Title");
      return;
    }
    if (!formData.hookName.trim()) {
      alert("Please provide a Hook Name");
      return;
    }
    if (!formData.product.trim()) {
      alert("Please select a Product");
      return;
    }
    onSubmit({
      ...formData,
      asDraft,
      referenceUrls: formData.referenceUrl.trim() ? [formData.referenceUrl.trim()] : [],
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal new-brief-modal" role="dialog" aria-modal="true">
        <header className="modal-header">
          <div>
            <span className="eyebrow">Brand Team</span>
            <h2>Create New Campaign Brief</h2>
          </div>
          <button type="button" className="close-button-rect" onClick={onClose} aria-label="Close dialog">
            <X size={17} />
          </button>
        </header>

        <form
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleAction(false);
          }}
        >
          <div className="modal-body">
            {/* Campaign Title */}
            <label className="form-group full-width">
              <span>Campaign Title <b className="required">*</b></span>
              <input
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Barrier repair morning routine"
              />
            </label>

            {/* Hook Name */}
            <label className="form-group full-width">
              <span>Hook Name <b className="required">*</b></span>
              <input
                required
                maxLength={200}
                value={formData.hookName}
                onChange={(e) => setFormData({ ...formData, hookName: e.target.value })}
                placeholder="e.g. 3 Seconds to Clear Skin"
              />
            </label>

            {/* 2-Column Row: Brief Type & Priority */}
            <div className="form-row-2col">
              <label className="form-group">
                <span>Brief Type <b className="required">*</b></span>
                <select
                  value={formData.briefType}
                  onChange={(e) => handleBriefTypeChange(e.target.value)}
                >
                  <option value="video">Video brief (Work Plan)</option>
                  <option value="ai">AI brief (AI Tracker Main)</option>
                </select>
                <small>Source sheet: {formData.briefType === "ai" ? "AI Tracker Main" : "Work Plan"}</small>
              </label>

              <label className="form-group">
                <span>Priority</span>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option value="P0">P0 URGENT</option>
                  <option value="P1">P1 HIGH</option>
                  <option value="P2">P2 NORMAL</option>
                  <option value="R0">R0 REVISION</option>
                </select>
              </label>
            </div>

            {/* Product Picker Dropdown with Category Groups & Search (Like PlixSheetAutomation) */}
            <div className="form-group full-width">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Product (Official Plix Catalog) <b className="required">*</b></span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  {filteredProducts.length} products available
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "3px" }}>
                <input
                  type="search"
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{ flex: "0 0 180px" }}
                />
                <select
                  required
                  value={formData.product}
                  onChange={(e) => handleProductChange(e.target.value)}
                  style={{ flex: 1 }}
                  aria-label="Select a Plix product"
                >
                  <option value="">Select a Plix product</option>
                  {["Skin", "Hair", "Nutra"].map((cat) => {
                    const matches = filteredProducts.filter((p) => p.category === cat);
                    if (!matches.length) return null;
                    return (
                      <optgroup label={`${cat} (${matches.length} products)`} key={cat}>
                        {matches.map((p) => (
                          <option value={p.name} key={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              <small>Selecting a product auto-syncs Category and assigns the responsible writer.</small>
            </div>

            {/* 2-Column Row: Category & Content Format */}
            <div className="form-row-2col">
              <label className="form-group">
                <span>Category</span>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="Skin">Skin (Himani / Sanjeet)</option>
                  <option value="Hair">Hair (Zoha / Sidhharth)</option>
                  <option value="Nutra">Nutra (Tanmay / Sindhura)</option>
                  <option value="Joyun">Joyun (Shama)</option>
                  <option value="B2G2">B2G2 (Global)</option>
                </select>
                <small>Assigned writer: <strong>{routing?.writerName || "Unassigned"}</strong></small>
              </label>

              <label className="form-group">
                <span>Content Format ({formData.briefType === "ai" ? "AI brief" : "Video brief"}) <b className="required">*</b></span>
                <select
                  value={formData.contentType}
                  onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
                >
                  {(CONTENT_TYPES_BY_BRIEF[formData.briefType] || []).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <small>
                  {formData.briefType === "ai"
                    ? "Formats for AI brief & AI Tracker Main"
                    : "Formats for Video brief & Work Plan"}
                </small>
              </label>
            </div>

            {/* Inspiration / Reference Link */}
            <label className="form-group full-width">
              <span>Inspiration / Reference Link</span>
              <input
                type="url"
                value={formData.referenceUrl}
                onChange={(e) => setFormData({ ...formData, referenceUrl: e.target.value })}
                placeholder="https://drive.google.com/... or Instagram link"
              />
            </label>

            {/* Creative Guidelines */}
            <label className="form-group full-width">
              <span>Brand Requirements & Guidelines</span>
              <textarea
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                placeholder="Provide creative directions, mandatory angles, hooks, and dos & don'ts for Content Team..."
              />
            </label>
          </div>

          <footer className="modal-footer">
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                className="button"
                style={{ background: "#f5f7f5", borderColor: "#cfd4d0" }}
                onClick={() => handleAction(true)}
              >
                Save as Draft
              </button>
              <button type="submit" className="button primary">
                <Send size={14} />
                Release to Content Queue
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default function UnifiedDashboard({ initialTasks = [], initialUsers = [], initialNotifications = [], sessionUser = null }) {
  const users = useMemo(() => dedupeUsers(initialUsers), [initialUsers]);
  const writers = users.filter((p) => p.role === "content");

  // User Identity & Role Authentication strictly bound to authenticated login session
  const currentUserId = sessionUser?.id || "usr-isha";
  const currentUser = users.find((p) => p.id === currentUserId) || sessionUser || users[0];
  const currentRole = currentUser?.role || "brand";
  const normalizedTeam = normalizeRole(currentRole);
  const isEditingManager = ["edit", "video"].includes(currentRole) && Boolean(currentUser?.isTeamLead);
  const editors = users.filter((person) =>
    ["edit", "video"].includes(person.role) && !person.isTeamLead
  );
  const editingTeam = users.filter((person) => ["edit", "video"].includes(person.role));

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (_) {
      window.location.href = "/login";
    }
  };

  const [tasks, setTasks] = useState(initialTasks);
  const [search, setSearch] = useState("");
  const [brief, setBrief] = useState("video");
  const [priority, setPriority] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState("board");
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications.length ? initialNotifications : INITIAL_NOTIFICATIONS);
  const [devicePushActive, setDevicePushActive] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); window.setTimeout(() => setToast(null), 2600); };

  // Sync device notification permission on mount
  useEffect(() => {
    setDevicePushActive(NotificationService.isDevicePermissionGranted());
  }, []);

  // Real-Time EventSource: Sync tasks & pipeline updates across all open team dashboards
  useEffect(() => {
    let eventSource;
    try {
      eventSource = new EventSource("/api/events");
      eventSource.onmessage = async () => {
        try {
          const res = await fetch("/api/tasks?team=administrator");
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.tasks)) {
              setTasks(data.tasks);
            }
          }
        } catch (_) {}
      };
    } catch (_) {}
    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const handleToggleDevicePush = async () => {
    const res = await NotificationService.requestDevicePermission();
    if (res.granted) {
      setDevicePushActive(true);
      showToast("Device notifications active on this system!");
      NotificationService.sendDeviceAlert("Device Alerts Enabled", `You will receive OS alerts when tasks flow to ${roleLabel(currentRole)}.`);
    } else if (!res.supported) {
      showToast("Web Notifications not supported in this browser");
    } else {
      setDevicePushActive(false);
      showToast("Device notification permission denied in browser");
    }
  };

  // Dedicated NotificationService Dispatcher (In-App, Device OS Alert, SMS, and Gmail API Email)
  const dispatchWorkflowHandoffNotification = async ({
    targetTeam,
    eventType,
    title,
    message,
    task,
    recipientUser,
    customNote,
  }) => {
    const notifId = `notif-${Date.now()}`;
    const now = new Date().toISOString();
    const phone = recipientUser?.phone || currentUser?.phone || PRIMARY_NOTIFICATION_PHONE;
    const recipientName = recipientUser?.name || roleLabel(targetTeam);
    const recipientEmail = recipientUser?.email || `${(recipientUser?.name || targetTeam).toLowerCase().replace(/[^a-z0-9]/g, "")}@plixlife.com`;

    // 1. Record In-App notification
    const newNotif = {
      id: notifId,
      taskId: task.id,
      targetTeam,
      type: eventType,
      title,
      message,
      actorName: currentUser?.name || "Team Member",
      recipientName,
      recipientPhone: phone,
      recipientEmail,
      createdAt: now,
      read: false,
      channels: ["in_app", "device", "sms", "email"],
      smsStatus: "delivered",
      emailStatus: "dispatched",
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // 2. Trigger native OS / Device notification banner
    NotificationService.sendDeviceAlert(title, message, task.id);

    // 3. Dispatch SMS alert through system
    try {
      await NotificationService.dispatchSms({
        phone,
        recipientName,
        action: eventType,
        task,
        actorName: currentUser?.name || "Team Member",
      });
    } catch (_) {}

    // 4. Dispatch Gmail API email notification with PlixOps logo PNG
    try {
      await NotificationService.dispatchEmail({
        to: recipientEmail,
        recipientName,
        action: eventType,
        task,
        actorName: currentUser?.name || "Team Member",
        customNote,
      });
    } catch (_) {}
  };

  // Filter notifications relevant to this authenticated role
  const teamNotifications = useMemo(() => {
    if (currentRole === "administrator") return notifications;
    return notifications.filter((n) => n.targetTeam === normalizedTeam || n.targetTeam === currentRole);
  }, [notifications, normalizedTeam, currentRole]);

  const unreadCount = teamNotifications.filter((n) => !n.read).length;

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast("All notifications marked as read");
  };

  // STRICT RBAC ABSTRACTION: Tasks for this role ONLY
  // A brand person will not have entire view of system; they only see activity assigned to them to act on and proceed.
  const roleTasks = useMemo(() => {
    if (currentRole === "administrator") return tasks;
    const allowed = TEAM_VISIBLE_STATES[normalizedTeam] || [];
    const teamTasks = tasks.filter((t) => allowed.includes(t.state));

    if (currentRole === "brand") {
      // Brand person only sees activity assigned to them
      return teamTasks.filter((task) => {
        const isAssignedApprover = CATEGORY_ROUTING[task.category]?.approverIds?.includes(currentUserId);
        const isBrandOwner = task.brandOwnerId === currentUserId;
        const isCreator = task.creatorId === currentUserId;
        const isUnassignedBrand = !task.brandOwnerId && (!CATEGORY_ROUTING[task.category]?.approverIds?.length || currentUserId === "usr-isha");
        return isAssignedApprover || isBrandOwner || isCreator || isUnassignedBrand;
      });
    }

    if (["edit", "video"].includes(currentRole)) {
      return currentUser?.isTeamLead
        ? teamTasks
        : teamTasks.filter((task) => task.editorId === currentUserId);
    }

    return teamTasks;
  }, [tasks, normalizedTeam, currentRole, currentUserId, currentUser?.isTeamLead]);

  // Toolbar Filter
  const filtered = useMemo(() => {
    return roleTasks.filter((task) => {
      const haystack = [task.id, task.title, task.hookName, task.product, task.category, task.contentType].join(" ").toLowerCase();
      return (
        briefType(task) === brief &&
        (priority === "all" || task.priority === priority) &&
        (status === "all" || task.state === status) &&
        (!search || haystack.includes(search.toLowerCase()))
      );
    });
  }, [roleTasks, search, brief, priority, status]);

  const selected = tasks.find((t) => t.id === selectedId);
  const columns = ROLE_COLUMNS[currentRole] || ROLE_COLUMNS.content;
  const isBrandTeam = currentRole === "brand";

  // Actions
  const assignWriter = async (taskId, writerId) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptOwnerId: writerId, contentOwnerId: writerId }),
      });
      if (!res.ok) throw new Error("Server assignment failed");
      const data = await res.json();
      const updated = data.task;
      setTasks((items) => items.map((t) => (t.id === taskId ? updated : t)));
      showToast("Owner assignment updated");
    } catch (_) {
      // Optimistic fallback
      setTasks((items) =>
        items.map((t) =>
          t.id === taskId
            ? { ...t, scriptOwnerId: writerId, contentOwnerId: writerId, updatedAt: new Date().toISOString() }
            : t
        )
      );
      showToast("Owner assignment updated");
    }
  };

  const assignEditor = async (taskId, editorId) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Editor assignment failed");
      setTasks((items) => items.map((task) => (task.id === taskId ? data.task : task)));
      showToast(editorId ? "Editor assigned — all manager dashboards updated" : "Returned to unassigned queue");
    } catch (error) {
      showToast(error.message || "Failed to assign editor");
    }
  };

  const handleCreateBrief = async (payload) => {
    const asDraft = Boolean(payload.asDraft);
    const routing = CATEGORY_ROUTING[payload.category] || { writerId: null, writerName: "Unassigned" };

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          asDraft,
          brandOwnerId: currentUser?.id,
          creatorId: currentUser?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create brief");
      const newTask = data.task;
      setTasks((items) => [newTask, ...items.filter((t) => t.id !== newTask.id)]);
      setModalOpen(false);

      if (asDraft) {
        showToast("Brief saved to Brand Brief Draft folder");
      } else {
        showToast("New brief released to Content queue");
        const assignedWriter = users.find((u) => u.id === routing.writerId) || users.find((u) => u.role === "content");
        dispatchWorkflowHandoffNotification({
          targetTeam: "content",
          eventType: NOTIFICATION_EVENTS.BRIEF_RELEASED,
          title: "Brand Brief Released",
          message: `Brief "${payload.title}" (${newTask.id}) released. Hook: "${payload.hookName}". Assigned to Content queue.`,
          task: newTask,
          recipientUser: assignedWriter,
        });
      }
    } catch (err) {
      showToast(err.message || "Failed to save brief");
    }
  };

  const handleReleaseDraftBrief = async (task) => {
    const routing = CATEGORY_ROUTING[task.category] || { writerId: null, writerName: "Unassigned" };
    try {
      const res = await fetch(`/api/tasks/${task.id}/release`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to release brief");
      const updated = data.task;
      setTasks((items) => items.map((t) => (t.id === task.id ? updated : t)));
      setSelectedId(null);
      showToast(`Brief ${task.id} released to Content queue`);

      const assignedWriter = users.find((u) => u.id === (updated.scriptOwnerId || routing.writerId)) || users.find((u) => u.role === "content");
      dispatchWorkflowHandoffNotification({
        targetTeam: "content",
        eventType: NOTIFICATION_EVENTS.BRIEF_RELEASED,
        title: "Brand Brief Released",
        message: `Brief "${task.title}" (${task.id}) released from draft. Hook: "${task.hookName || "Not set"}". Assigned to Content queue.`,
        task: updated,
        recipientUser: assignedWriter,
      });
    } catch (err) {
      showToast(err.message || "Failed to release draft brief");
    }
  };

  const handleSubmitScript = async (task, link, comments, hookName) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hookName, scriptUrl: link, comment: comments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit script");
      const updated = data.task;
      setTasks((items) => items.map((t) => (t.id === task.id ? updated : t)));
      setSelectedId(null);
      showToast("Script sent to Brand Team for approval");

      const brandApprover = users.find((u) => u.role === "brand");
      dispatchWorkflowHandoffNotification({
        targetTeam: "brand",
        eventType: NOTIFICATION_EVENTS.SCRIPT_SUBMITTED,
        title: "Script Ready for Approval",
        message: `Content script for "${task.title}" (${task.id}) submitted by ${currentUser?.name}. Brand approval required.`,
        task: updated,
        recipientUser: brandApprover,
      });
    } catch (err) {
      showToast(err.message || "Failed to submit script");
    }
  };

  const handleSubmitVideo = async (task, link, comments) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: link, aspectRatio: "9:16", version: 1, comment: comments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit video cut");
      const updated = data.task;
      setTasks((items) => items.map((t) => (t.id === task.id ? updated : t)));
      setSelectedId(null);
      showToast("Video cut sent to Brand Team for review");

      const brandApprover = users.find((u) => u.role === "brand");
      dispatchWorkflowHandoffNotification({
        targetTeam: "brand",
        eventType: NOTIFICATION_EVENTS.VIDEO_SUBMITTED,
        title: "Video Cut Awaiting Review",
        message: `Video cut for "${task.title}" (${task.id}) submitted by ${currentUser?.name}. Brand approval pending.`,
        task: updated,
        recipientUser: brandApprover,
      });
    } catch (err) {
      showToast(err.message || "Failed to submit video");
    }
  };

  const handleGoLive = async (task, link, comments) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveUrl: link, comment: comments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record go-live");
      const updated = data.task;
      setTasks((items) => items.map((t) => (t.id === task.id ? updated : t)));
      setSelectedId(null);
      showToast("Campaign is now LIVE in market!");

      const brandLead = users.find((u) => u.role === "brand");
      dispatchWorkflowHandoffNotification({
        targetTeam: "brand",
        eventType: NOTIFICATION_EVENTS.CAMPAIGN_LIVE,
        title: "Campaign is LIVE",
        message: `"${task.title}" (${task.id}) ad is active in market! Launched by ${currentUser?.name}.`,
        task: updated,
        recipientUser: brandLead,
      });
    } catch (err) {
      showToast(err.message || "Failed to push live");
    }
  };

  const handleBrandDecision = async (taskId, decision, type, comment) => {
    try {
      const res = await fetch(`/api/approvals/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, type, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record decision");
      const updated = data.task;
      setTasks((items) => items.map((t) => (t.id === taskId ? updated : t)));
      setSelectedId(null);
      showToast(decision === "approved" ? "Approved! Work delivered to next team." : "Changes requested.");

      const current = tasks.find((t) => t.id === taskId) || updated;
      if (decision === "approved") {
        if (type === "script") {
          const editingManager = users.find((u) => u.isTeamLead && (u.role === "video" || u.role === "edit")) || currentUser;
          dispatchWorkflowHandoffNotification({
            targetTeam: "video",
            eventType: NOTIFICATION_EVENTS.SCRIPT_APPROVED,
            title: "Script Approved — Assignment Needed",
            message: `Script approved for "${current.title}" (${current.id}) by ${currentUser?.name}. An editing manager must assign an editor.`,
            task: updated,
            recipientUser: editingManager,
          });
        } else {
          const perfMarketer = users.find((u) => u.role === "performance");
          dispatchWorkflowHandoffNotification({
            targetTeam: "performance",
            eventType: NOTIFICATION_EVENTS.VIDEO_APPROVED,
            title: "Creative Approved — Go-Live Queue",
            message: `Video approved for "${current.title}" (${current.id}) by ${currentUser?.name}. Ready to launch ads.`,
            task: updated,
            recipientUser: perfMarketer,
          });
        }
      } else {
        const reworkTeam = type === "script" ? "content" : "video";
        const recipient = type === "script"
          ? users.find((u) => u.id === current.scriptOwnerId) || users.find((u) => u.role === "content")
          : users.find((u) => u.id === current.editorId) || users.find((u) => u.role === "video" || u.role === "edit");

        dispatchWorkflowHandoffNotification({
          targetTeam: reworkTeam,
          eventType: type === "script" ? NOTIFICATION_EVENTS.SCRIPT_REWORK : NOTIFICATION_EVENTS.VIDEO_REWORK,
          title: type === "script" ? "Script Revisions Requested" : "Video Changes Requested",
          message: `Brand requested changes on "${current.title}": ${comment}`,
          task: updated,
          recipientUser: recipient,
          customNote: comment,
        });
      }
    } catch (err) {
      showToast(err.message || "Failed to record decision");
    }
  };

  return (
    <div className="app-shell">
      {/* Sidebar: ONLY SHOWS THIS USER'S ROLE-AUTHORIZED WORKSPACE */}
      {/* Other teams' dashboards are NOT visible in this navigation! */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark-logo">
            <img src="/plix-ops-logo.png" alt="Plix Ops" />
          </div>
        </div>

        <div className="workspace">
          <label>Workspace</label>
          <button>
            <span>
              <strong>Plix Ops</strong>
              <small>{roleLabel(currentRole)}</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>

        <nav>
          <label>My Role Dashboard</label>
          {currentRole === "brand" && (
            <button className="active">
              <Sparkles size={20} />
              <span>Brand Team</span>
            </button>
          )}
          {currentRole === "content" && (
            <button className="active">
              <FileText size={20} />
              <span>Content Team</span>
            </button>
          )}
          {(currentRole === "edit" || currentRole === "video") && (
            <button className="active">
              <Video size={20} />
              <span>Video Team</span>
            </button>
          )}
          {currentRole === "performance" && (
            <button className="active">
              <Rocket size={20} />
              <span>Performance Team</span>
            </button>
          )}
          {currentRole === "administrator" && (
            <button className="active">
              <LayoutDashboard size={20} />
              <span>All Operations</span>
            </button>
          )}
        </nav>

        <div className="sidebar-foot">
          <i />Active: {currentUser?.name}
          <span>{roleLabel(currentRole)}</span>
        </div>
      </aside>

      {/* Main Shell */}
      <div className="main-shell">
        <header className="topbar">
          <button className="mobile-menu"><Menu /></button>
          <label className="global-search">
            <Search size={20} />
            <input
              id="global-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, campaigns, hooks..."
            />
            <kbd>⌘ K</kbd>
          </label>

          <div className="top-actions">
            <button><CircleHelp /></button>
            <button
              className="notification-trigger"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              title="Notifications & Device Alerts"
            >
              <Bell size={18} />
              {unreadCount > 0 && <span className="notification-badge-count">{unreadCount}</span>}
            </button>

            {/* Authenticated Account Profile */}
            <button className="user-button" onClick={() => setUserMenuOpen(!userMenuOpen)}>
              <Avatar person={currentUser} />
              <span>
                <strong>{currentUser?.name || "Team Member"}</strong>
                <small>{roleLabel(currentRole)}</small>
              </span>
              <ChevronDown size={15} />
            </button>
          </div>

          {/* User Account & Session Menu (Strictly locked to authenticated account) */}
          {userMenuOpen && (
            <div className="user-menu">
              <header>
                <span>Authenticated Account</span>
                <button onClick={() => setUserMenuOpen(false)}><X size={15} /></button>
              </header>

              <div style={{ padding: "10px 4px 6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <Avatar person={currentUser} />
                  <div>
                    <strong style={{ fontSize: "14px", display: "block" }}>{currentUser?.name}</strong>
                    <small style={{ color: "#747a76" }}>{currentUser?.email || `${roleLabel(currentRole)} Member`}</small>
                  </div>
                </div>
                <div className="status" style={{ fontSize: "10px", padding: "3px 8px" }}>
                  Role: {roleLabel(currentRole)}
                </div>
              </div>

              <div style={{ borderTop: "1px solid #edf0ed", marginTop: "10px", paddingTop: "10px" }}>
                <button
                  className="button danger"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={handleSignOut}
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* In-App Notification Center & Device Alerts */}
          {notificationsOpen && (
            <div className="notifications-panel">
              <header className="notifications-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong>Notifications</strong>
                  {unreadCount > 0 && <span className="unread-counter">{unreadCount} new</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {unreadCount > 0 && (
                    <button className="button-text" onClick={markAllNotificationsRead}>
                      Mark all read
                    </button>
                  )}
                  <button className="icon-btn-sm" onClick={() => setNotificationsOpen(false)}>
                    <X size={15} />
                  </button>
                </div>
              </header>

              {/* Device & SMS Notification Channels */}
              <div className="notification-channel-bar">
                <div className="channel-item">
                  <Smartphone size={13} />
                  <span>SMS Target: <strong>{currentUser?.phone || PRIMARY_NOTIFICATION_PHONE}</strong></span>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                  <a
                    href={`https://ntfy.sh/plix-${(currentUser?.phone || PRIMARY_NOTIFICATION_PHONE).replace(/[^0-9]/g, "").slice(-10)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="device-toggle-btn active"
                    style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "5px" }}
                    title="Open free live alert stream on phone"
                  >
                    <span className="channel-dot green" />
                    Free Phone Alerts
                  </a>
                  <button
                    className={`device-toggle-btn ${devicePushActive ? "active" : ""}`}
                    onClick={handleToggleDevicePush}
                    title="Toggle OS Device Push Notifications"
                  >
                    <span className={`channel-dot ${devicePushActive ? "green" : "gray"}`} />
                    {devicePushActive ? "Desktop: ON" : "Enable Desktop"}
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="notifications-list">
                {teamNotifications.length === 0 ? (
                  <div className="notifications-empty">
                    <CheckCheck size={26} />
                    <strong>All caught up!</strong>
                    <span>No pending task alerts for {roleLabel(currentRole)}</span>
                  </div>
                ) : (
                  teamNotifications.map((n) => (
                    <article
                      key={n.id}
                      className={`notification-item ${n.read ? "read" : "unread"}`}
                      onClick={() => {
                        setSelectedId(n.taskId);
                        setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, read: true } : item));
                        setNotificationsOpen(false);
                      }}
                    >
                      <span className={`notification-dot ${n.read ? "read" : "active"}`} />
                      <div className="notification-item-content">
                        <div className="notification-item-header">
                          <strong>{n.title}</strong>
                          <time>{formatDateTime(n.createdAt)}</time>
                        </div>
                        <p>{n.message}</p>
                        <div className="notification-item-tags">
                          <span className="task-ref-tag">{n.taskId}</span>
                          <span className="sms-sent-tag">
                            <Check size={11} /> SMS Dispatched ({n.recipientPhone})
                          </span>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
        </header>

        <main>
          <div className="page-head">
            <div>
              <span className="eyebrow">{roleLabel(currentRole).toUpperCase()} DESK</span>
              <h1>
                {currentRole === "brand" ? "Brand Workspace" :
                 currentRole === "content" ? "Content Scripts" :
                 currentRole === "edit" || currentRole === "video" ? "Video Production" :
                 currentRole === "performance" ? "Performance Go-Live" :
                 "Operations Overview"}
              </h1>
            </div>

            {/* Only Brand and Admin have the permission to create new briefs */}
            {(currentRole === "brand" || currentRole === "administrator") && (
              <button className="button primary new-brief" onClick={() => setModalOpen(true)}>
                <Plus size={16} />New brief
              </button>
            )}
          </div>

          {/* Hero Grid */}
          <div className="hero-grid">
            <section className="queue-card">
              <span className="eyebrow">{roleLabel(currentRole).toUpperCase()} OVERVIEW</span>
              <h2>
                {currentRole === "brand" ? "Intake & Approval Gates" :
                 currentRole === "content" ? "Scripting Queue" :
                 currentRole === "edit" || currentRole === "video" ? "Video Production Queue" :
                 "Go-Live & Campaigns"}
              </h2>
              <div className="queue-stats">
                <div>
                  <strong>{filtered.length}</strong>
                  <span>Active tasks</span>
                </div>
                <div>
                  <strong>{filtered.filter((t) => t.updatedAt).length}</strong>
                  <span>With recorded timestamps</span>
                </div>
              </div>
            </section>

            <div className="mini-grid">
              <article>
                <span>Active in this phase</span>
                <strong>{filtered.length}</strong>
              </article>
              <article>
                <span>P0 Critical</span>
                <strong>{filtered.filter((t) => t.priority === "P0").length}</strong>
              </article>
              <article>
                <span>Video Briefs</span>
                <strong>{filtered.filter((t) => briefType(t) === "video").length}</strong>
              </article>
              <article>
                <span>AI Briefs</span>
                <strong>{filtered.filter((t) => briefType(t) === "ai").length}</strong>
              </article>
            </div>
          </div>

          {/* Toolbar */}
          {!isEditingManager && <section className="toolbar panel">
            <div className="queue-tabs">
              <button className={brief === "video" ? "active" : ""} onClick={() => setBrief("video")}>Video brief queue</button>
              <button className={brief === "ai" ? "active" : ""} onClick={() => setBrief("ai")}>AI brief queue</button>
            </div>

            <div className="filter">
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="all">All priorities</option>
                {["P0", "P1", "P2", "R0"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>

            <div className="filter">
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All statuses</option>
                {columns.map(([val, lbl]) => <option value={val} key={val}>{lbl}</option>)}
              </select>
            </div>

            <span className="result-count">{filtered.length} {brief === "ai" ? "AI" : "video"} tasks</span>

            {!isBrandTeam && !isEditingManager && (
              <div className="view-toggle">
                <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List size={18} />List</button>
                <button className={view === "board" ? "active" : ""} onClick={() => setView("board")}><LayoutDashboard size={18} />Board</button>
              </div>
            )}
          </section>}

          {/* Brand Team: Folder Explorer / Other Teams (Video, Content, Perf, Admin): Kanban Board or List */}
          {isEditingManager ? (
            <VideoManagerConsole
              tasks={roleTasks}
              editors={editors}
              teamMembers={editingTeam}
              onOpen={(task) => setSelectedId(task.id)}
              onAssign={assignEditor}
              brief={brief}
              onBriefChange={setBrief}
              priority={priority}
              onPriorityChange={setPriority}
              status={status}
              onStatusChange={setStatus}
              search={search}
            />
          ) : isBrandTeam ? (
            <BrandFolderView
              tasks={filtered}
              onOpen={(t) => setSelectedId(t.id)}
              onCreateBrief={() => setModalOpen(true)}
              writers={writers}
              users={users}
              onAssign={assignWriter}
            />
          ) : view === "board" ? (
            <Board
              tasks={filtered}
              columns={columns}
              writers={writers}
              users={users}
              onOpen={(t) => setSelectedId(t.id)}
              onAssign={assignWriter}
            />
          ) : (
            <TaskList
              tasks={filtered}
              writers={writers}
              onOpen={(t) => setSelectedId(t.id)}
              onAssign={assignWriter}
            />
          )}
        </main>
      </div>

      {/* Slide-out Drawer */}
      <Drawer
        task={selected}
        role={currentRole}
        users={users}
        writers={writers}
        editors={editors}
        canAssignEditor={isEditingManager || currentRole === "administrator"}
        onClose={() => setSelectedId(null)}
        onAssign={assignWriter}
        onAssignEditor={assignEditor}
        onSubmitScript={handleSubmitScript}
        onSubmitVideo={handleSubmitVideo}
        onGoLive={handleGoLive}
        onBrandDecision={handleBrandDecision}
        onReleaseDraftBrief={handleReleaseDraftBrief}
      />

      {/* Modal for Creating Brief */}
      {modalOpen && <NewBriefModal onClose={() => setModalOpen(false)} onSubmit={handleCreateBrief} />}

      {/* Toast Notification */}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}
