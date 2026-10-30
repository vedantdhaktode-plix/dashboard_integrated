export const TEAMS = [
  { id: "brand", label: "Brand Team", description: "Brief Intake, Approvals & Campaign Oversight", icon: "Sparkles", tone: "amber" },
  { id: "content", label: "Content Team", description: "Script Preparation & Google Docs Submissions", icon: "FileText", tone: "indigo" },
  { id: "video", label: "Video Team", description: "Video Editing & Google Drive Deliverables", icon: "Video", tone: "blue" },
  { id: "performance", label: "Performance Team", description: "Ready-for-Live Queue, Campaign Setup & Go-Live", icon: "Rocket", tone: "green" },
  { id: "administrator", label: "Operations Admin", description: "End-to-End Pipeline & SLA Monitoring", icon: "Shield", tone: "slate" },
];

export const TEAM_VISIBLE_STATES = {
  brand: [
    "draft", "script_approval_pending", "approval_pending",
    "script_changes_requested", "changes_requested", "approved", "ready_for_performance", "published", "on_hold", "cancelled"
  ],
  content: [
    "social_research", "script_changes_requested", "script_approval_pending"
  ],
  video: [
    "editing_queue", "editing_in_progress", "changes_requested", "approval_pending", "blocked"
  ],
  performance: [
    "ready_for_performance", "publishing_in_progress", "published", "publishing_failed"
  ],
  administrator: [
    "draft", "social_research", "script_approval_pending", "script_changes_requested",
    "editing_queue", "editing_in_progress", "approval_pending", "changes_requested",
    "approved", "ready_for_performance", "publishing_in_progress", "published",
    "publishing_failed", "on_hold", "blocked", "cancelled"
  ],
};

export const STAGE_CONFIG = {
  brand_intake: { label: "Brand Intake", team: "brand", order: 1 },
  content_scripting: { label: "Content Scripting", team: "content", order: 2 },
  brand_script_review: { label: "Brand Script Review", team: "brand", order: 3 },
  video_production: { label: "Video Production", team: "video", order: 4 },
  brand_video_review: { label: "Brand Approval Pending", team: "brand", order: 5 },
  perf_publishing: { label: "Performance Go-Live", team: "performance", order: 6 },
  published: { label: "Live in Market", team: "performance", order: 7 },
};

export const CATEGORY_ROUTING = {
  Skin: { writerId: "usr-himani", writerName: "Himani", approverIds: ["usr-sanjeet", "usr-ansh"], approverNames: ["Sanjeet", "Ansh"] },
  Hair: { writerId: "usr-zoha", writerName: "Zoha", approverIds: ["usr-sidhharth", "usr-siddhartha"], approverNames: ["Sidhharth", "Siddhartha"] },
  Nutra: { writerId: "usr-tanmay", writerName: "Tanmay", approverIds: ["usr-sindhura", "usr-sonali"], approverNames: ["Sindhura", "Sonali"] },
  Joyun: { writerId: null, writerName: "Unassigned", approverIds: ["usr-shama"], approverNames: ["Shama"] },
  B2G2: { writerId: null, writerName: "Unassigned", approverIds: [], approverNames: [] },
};

export const CONTENT_TYPES_BY_BRIEF = {
  video: [
    "UGC",
    "Music",
    "Shorter Cut",
    "Hook Change",
    "Office Shoot",
    "Talent",
    "Pack Reduction",
    "Pack Extension",
    "Regional Music",
    "Regional VO",
    "Ending Offer Add",
    "Global English",
    "Other",
  ],
  ai: [
    "Music",
    "AI Male",
    "AI Female",
    "Priyanta",
    "Saurov",
    "Rishubh",
    "Pack Extension",
    "AI Avatar",
    "AI Hook",
    "Experimental",
    "Cyrus",
    "UGC Creator",
    "Yash",
    "Ashrafi",
    "Dr. Ojas",
  ],
};

export const FALLBACK_VIDEO_EDITOR = {
  id: "usr-other-editor",
  name: "Other",
  role: "edit",
};

export const STATE_META = {
  draft: { label: "Brand intake", tone: "neutral", team: "brand" },
  social_research: { label: "Script queue", tone: "indigo", team: "content" },
  script_changes_requested: { label: "Script changes", tone: "rose", team: "content" },
  script_approval_pending: { label: "Brand script approval", tone: "amber", team: "brand" },
  editing_queue: { label: "Video queue", tone: "indigo", team: "video" },
  editing_in_progress: { label: "Video editing", tone: "blue", team: "video" },
  approval_pending: { label: "Brand approval pending", tone: "amber", team: "brand" },
  changes_requested: { label: "Video rework", tone: "rose", team: "video" },
  approved: { label: "Approved", tone: "green", team: "brand" },
  ready_for_performance: { label: "Ready for live", tone: "teal", team: "performance" },
  publishing_in_progress: { label: "Publishing setup", tone: "blue", team: "performance" },
  published: { label: "Live", tone: "green", team: "performance" },
  publishing_failed: { label: "Publishing failed", tone: "rose", team: "performance" },
  on_hold: { label: "On hold", tone: "neutral", team: "brand" },
  blocked: { label: "Blocked", tone: "rose", team: "content" },
  cancelled: { label: "Cancelled", tone: "neutral", team: "brand" },
};

