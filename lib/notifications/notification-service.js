// Plix Ops Dedicated NotificationService
// Multi-channel notifications: In-App, Device Web Push (OS alerts), and SMS gateway dispatch.

export const NOTIFICATION_CHANNELS = {
  IN_APP: "in_app",
  DEVICE: "device",
  SMS: "sms",
  EMAIL: "email",
};

export const NOTIFICATION_EVENTS = {
  BRIEF_RELEASED: "brief_released",
  SCRIPT_SUBMITTED: "script_submitted",
  SCRIPT_APPROVED: "script_approved",
  SCRIPT_REWORK: "script_rework",
  VIDEO_SUBMITTED: "video_submitted",
  VIDEO_APPROVED: "video_approved",
  VIDEO_REWORK: "video_rework",
  CAMPAIGN_LIVE: "campaign_live",
};

export const PRIMARY_NOTIFICATION_PHONE = "+91 8779284159";

// Seed initial notifications for realistic workspace context
export const INITIAL_NOTIFICATIONS = [
  {
    id: "notif-1",
    taskId: "BPE-1048",
    targetTeam: "content",
    type: NOTIFICATION_EVENTS.BRIEF_RELEASED,
    title: "Brand Brief Released",
    message: "New brief 'Barrier repair routine' released. Hook: '3 Seconds to Clear Skin'.",
    actorName: "Isha Rao (Brand)",
    recipientName: "Himani",
    recipientPhone: "+91 8779284159",
    createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
    read: false,
    channels: ["in_app", "device", "sms"],
    smsStatus: "delivered",
  },
  {
    id: "notif-2",
    taskId: "BPE-1051",
    targetTeam: "brand",
    type: NOTIFICATION_EVENTS.SCRIPT_SUBMITTED,
    title: "Script Ready for Approval",
    message: "Himani submitted script for 'Ceramide Gentle Cleanser'. Brand approval pending.",
    actorName: "Himani (Content)",
    recipientName: "Isha Rao",
    recipientPhone: "+91 8779284159",
    createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
    read: false,
    channels: ["in_app", "device", "sms"],
    smsStatus: "delivered",
  },
  {
    id: "notif-3",
    taskId: "BPE-1042",
    targetTeam: "video",
    type: NOTIFICATION_EVENTS.SCRIPT_APPROVED,
    title: "Script Approved — Video Production",
    message: "Isha approved script for 'Watermelon Glow Face Gel'. Ready for video cutting.",
    actorName: "Isha Rao (Brand)",
    recipientName: "Noah Kim",
    recipientPhone: "+91 8779284159",
    createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
    read: false,
    channels: ["in_app", "device", "sms"],
    smsStatus: "delivered",
  },
  {
    id: "notif-4",
    taskId: "BPE-1044",
    targetTeam: "performance",
    type: NOTIFICATION_EVENTS.VIDEO_APPROVED,
    title: "Creative Ready for Go-Live",
    message: "Final video approved for 'Anti-Acne Spot Gel'. Ready to configure UTM campaign tags.",
    actorName: "Isha Rao (Brand)",
    recipientName: "Leo Martins",
    recipientPhone: "+91 8779284159",
    createdAt: new Date(Date.now() - 180 * 60000).toISOString(),
    read: true,
    channels: ["in_app", "device", "sms"],
    smsStatus: "delivered",
  },
];

/**
 * Format SMS copy for carrier dispatch to mobile device
 */
export function formatSmsAlert({ eventType, task, actorName, recipientName }) {
  const taskId = task.id || "BPE-TASK";
  const title = task.title || "Campaign";
  const hook = task.hookName ? ` | Hook: "${task.hookName}"` : "";

  switch (eventType) {
    case NOTIFICATION_EVENTS.BRIEF_RELEASED:
      return `[Plix Ops] Hi ${recipientName}, Brand released new brief "${title}" (${taskId})${hook}. Assigned to Content queue: http://localhost:4500`;

    case NOTIFICATION_EVENTS.SCRIPT_SUBMITTED:
      return `[Plix Ops] Hi ${recipientName}, Content script submitted by ${actorName} for "${title}" (${taskId}). Brand approval required: http://localhost:4500`;

    case NOTIFICATION_EVENTS.SCRIPT_APPROVED:
      return `[Plix Ops] Hi ${recipientName}, script approved by ${actorName} for "${title}" (${taskId})! Moved to Video queue: http://localhost:4500`;

    case NOTIFICATION_EVENTS.SCRIPT_REWORK:
      return `[Plix Ops] Hi ${recipientName}, Brand requested script revisions on "${title}" (${taskId}). Open feedback: http://localhost:4500`;

    case NOTIFICATION_EVENTS.VIDEO_SUBMITTED:
      return `[Plix Ops] Hi ${recipientName}, Video cut submitted by ${actorName} for "${title}" (${taskId}). Brand approval pending: http://localhost:4500`;

    case NOTIFICATION_EVENTS.VIDEO_APPROVED:
      return `[Plix Ops] Hi ${recipientName}, video cut approved for "${title}" (${taskId})! Ready for Performance Go-Live: http://localhost:4500`;

    case NOTIFICATION_EVENTS.VIDEO_REWORK:
      return `[Plix Ops] Hi ${recipientName}, Brand requested video revisions on "${title}" (${taskId}). Open feedback: http://localhost:4500`;

    case NOTIFICATION_EVENTS.CAMPAIGN_LIVE:
      return `[Plix Ops] 🚀 "${title}" (${taskId}) is LIVE in market! Setup completed by ${actorName}.`;

    default:
      return `[Plix Ops] Update on ${taskId} ("${title}") by ${actorName}.`;
  }
}

/**
 * NotificationService client helper to send in-app, device OS push, and SMS alert
 */
export class NotificationService {
  /**
   * Request permission for native device / browser OS notifications
   */
  static async requestDevicePermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return { supported: false, granted: false };
    }
    try {
      const permission = await Notification.requestPermission();
      return { supported: true, granted: permission === "granted" };
    } catch (_) {
      return { supported: true, granted: false };
    }
  }

  /**
   * Check if device notifications are currently enabled
   */
  static isDevicePermissionGranted() {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    return Notification.permission === "granted";
  }

  /**
   * Trigger native device OS notification
   */
  static sendDeviceAlert(title, body, tag = "plix-ops") {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        return new Notification(`Plix Ops: ${title}`, {
          body,
          icon: "/plix-ops-logo.png",
          badge: "/plix-ops-logo.png",
          tag,
        });
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  /**
   * Dispatch SMS alert to device through system API
   */
  static async dispatchSms({ phone, recipientName, action, task, actorName }) {
    try {
      const res = await fetch("/api/notifications/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          recipientName,
          action,
          task,
          actorName,
        }),
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Dispatch Gmail API email notification with PlixOps logo to team member
   */
  static async dispatchEmail({ to, recipientName, action, task, actorName, customNote }) {
    try {
      const res = await fetch("/api/notifications/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          recipientName,
          action,
          task,
          actorName,
          customNote,
        }),
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

