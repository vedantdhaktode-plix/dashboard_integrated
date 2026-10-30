// Plix Ops Gmail API & Email Notification Service
// Features:
// 1. Google Cloud Service Account Authentication (JWT RS256 token exchange via native Node crypto)
// 2. Google OAuth2 Refresh Token fallback (Zero extra dependencies)
// 3. Direct Gmail API v1 dispatch (https://gmail.googleapis.com/gmail/v1/users/me/messages/send)
// 4. Inline CID attachment for PlixOps Logo PNG (<img src="cid:plixops-logo">)
// 5. Responsive branded HTML email template for Brand, Content, Video, and Performance workflows

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const emailDispatchHistory = [];

/**
 * Stage labels & visual badges for email headers
 */
const ACTION_BADGES = {
  brief_released: { label: "NEW BRIEF RELEASED", tone: "#0f8975", desc: "Brief released to Content Queue" },
  brief_created: { label: "NEW BRIEF RELEASED", tone: "#0f8975", desc: "Brief released to Content Queue" },
  script_submitted: { label: "SCRIPT APPROVAL PENDING", tone: "#2563eb", desc: "Writer submitted script for Brand approval" },
  script_approved: { label: "SCRIPT APPROVED — VIDEO QUEUE", tone: "#059669", desc: "Brand approved script. Ready for Video Cutting" },
  script_rework: { label: "REVISIONS REQUESTED", tone: "#dc2626", desc: "Brand requested script changes" },
  script_rejected: { label: "REVISIONS REQUESTED", tone: "#dc2626", desc: "Brand requested script changes" },
  video_submitted: { label: "VIDEO APPROVAL PENDING", tone: "#7c3aed", desc: "Editor submitted video cut for Brand approval" },
  video_approved: { label: "VIDEO APPROVED — GO-LIVE", tone: "#059669", desc: "Video approved. Ready for Performance Launch" },
  video_rework: { label: "VIDEO REWORK REQUESTED", tone: "#dc2626", desc: "Brand requested video changes" },
  video_rejected: { label: "VIDEO REWORK REQUESTED", tone: "#dc2626", desc: "Brand requested video changes" },
  campaign_live: { label: "CAMPAIGN LIVE IN MARKET", tone: "#16a34a", desc: "Ad campaign launched by Performance Team" },
};

/**
 * Read the PlixOps logo PNG and return base64
 */
async function getLogoBase64() {
  try {
    const logoPath = path.join(process.cwd(), "public", "plix-ops-logo.png");
    const buffer = await fs.readFile(logoPath);
    return buffer.toString("base64");
  } catch (err) {
    console.warn("[PlixOps Email] Could not load logo PNG for CID attachment:", err.message);
    return null;
  }
}

/**
 * Format email subject line
 */
export function formatEmailSubject({ action, task }) {
  const taskId = task?.id || "BPE-TASK";
  const title = task?.title || "Campaign Task";
  const product = task?.product ? ` (${task.product})` : "";

  switch (action) {
    case "brief_released":
    case "brief_created":
      return `[Plix Ops] 📋 New Brief Released: ${taskId} — ${title}${product}`;
    case "script_submitted":
      return `[Plix Ops] ✍️ Script Submitted for Approval: ${taskId} — ${title}${product}`;
    case "script_approved":
      return `[Plix Ops] 🎬 Script Approved: ${taskId} — Moving to Video Production`;
    case "script_rework":
    case "script_rejected":
      return `[Plix Ops] ⚠️ Script Changes Requested: ${taskId} — ${title}`;
    case "video_submitted":
      return `[Plix Ops] 🎥 Video Cut Submitted for Approval: ${taskId} — ${title}`;
    case "video_approved":
      return `[Plix Ops] 🚀 Creative Approved for Go-Live: ${taskId} — ${title}`;
    case "video_rework":
    case "video_rejected":
      return `[Plix Ops] ⚠️ Video Revisions Requested: ${taskId} — ${title}`;
    case "campaign_live":
      return `[Plix Ops] 🎉 Campaign LIVE: ${taskId} — ${title}`;
    default:
      return `[Plix Ops] Update on ${taskId}: ${title}`;
  }
}

/**
 * Build responsive HTML template with inline CID PlixOps Logo
 */
export function generateEmailHtml({
  action,
  task = {},
  actorName = "Team Member",
  recipientName = "Team Member",
  customNote = "",
  dashboardUrl = "http://localhost:4500",
}) {
  const badge = ACTION_BADGES[action] || { label: "WORKFLOW UPDATE", tone: "#0f8975", desc: "Task updated in Plix Ops" };
  const taskId = task.id || "BPE-TASK";
  const title = task.title || "Creative Campaign";
  const product = task.product || "General";
  const category = task.category || "Skin";
  const priority = task.priority || "P1";
  const hookName = task.hookName || "Not specified";
  const summary = task.summary || "No additional requirements provided.";
  const scriptLink = task.scriptLink;
  const videoLink = task.videoLink;
  const liveUrl = task.liveUrl;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || dashboardUrl).replace(/\/$/, "");
  const actionLink = `${appUrl}/?task=${taskId}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${badge.label}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f3f1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2923; line-height: 1.5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f3f1; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e1e7e3;">
          
          <!-- Branded Dark Header with Inline CID Logo -->
          <tr>
            <td style="background-color: #0b1a15; padding: 22px 28px; border-bottom: 3px solid ${badge.tone};">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" vertical-align="middle">
                    <!-- Inline PlixOps Logo PNG -->
                    <img src="cid:plixops-logo" alt="Plix Ops" width="130" style="display: block; width: 130px; height: auto; border: 0;" />
                  </td>
                  <td align="right" vertical-align="middle">
                    <span style="display: inline-block; background-color: ${badge.tone}; color: #ffffff; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; padding: 5px 12px; border-radius: 20px;">
                      ${badge.label}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 30px 28px;">
              <h1 style="margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #111814;">
                ${title}
              </h1>
              <p style="margin: 0 0 20px; font-size: 14px; color: #4b554e;">
                Hi <strong>${recipientName}</strong>, <strong>${actorName}</strong> has triggered a workflow handoff in Plix Ops: <em>${badge.desc}</em>.
              </p>

              <!-- Task Overview Grid -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7faf8; border-radius: 8px; border: 1px solid #e5ebe7; margin-bottom: 24px; padding: 14px 18px;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #6b776f;" width="35%">Task ID:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: #111814;">${taskId} <span style="background: #e2e8f0; color: #334155; font-size: 10px; padding: 2px 7px; border-radius: 10px; margin-left: 6px;">${priority}</span></td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #6b776f;">Product & Category:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #111814;">${product} · ${category}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #6b776f;">Hook Angle:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f8975;">"${hookName}"</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #6b776f;" valign="top">Summary:</td>
                  <td style="padding: 6px 0; font-size: 12px; color: #374151;">${summary}</td>
                </tr>
              </table>

              <!-- Custom Note or Comment if Present -->
              ${customNote ? `
              <div style="background-color: #fef9c3; border-left: 4px solid #ca8a04; border-radius: 0 8px 8px 0; padding: 12px 16px; margin-bottom: 24px;">
                <strong style="display: block; font-size: 12px; color: #854d0e; text-transform: uppercase; margin-bottom: 4px;">Note from ${actorName}:</strong>
                <p style="margin: 0; font-size: 13px; color: #713f12;">"${customNote}"</p>
              </div>` : ""}

              <!-- Deliverable Links if Present -->
              ${(scriptLink || videoLink || liveUrl) ? `
              <div style="margin-bottom: 24px;">
                <strong style="display: block; font-size: 12px; color: #4b554e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Submitted Assets:</strong>
                ${scriptLink ? `<p style="margin: 4px 0; font-size: 13px;">📄 <a href="${scriptLink}" target="_blank" style="color: #0f8975; font-weight: 600; text-decoration: underline;">Open Google Doc Script</a></p>` : ""}
                ${videoLink ? `<p style="margin: 4px 0; font-size: 13px;">🎬 <a href="${videoLink}" target="_blank" style="color: #0f8975; font-weight: 600; text-decoration: underline;">Open Google Drive Video Cut</a></p>` : ""}
                ${liveUrl ? `<p style="margin: 4px 0; font-size: 13px;">🚀 <a href="${liveUrl}" target="_blank" style="color: #0f8975; font-weight: 600; text-decoration: underline;">View Live Campaign URL</a></p>` : ""}
              </div>` : ""}

              <!-- Direct Call to Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 10px; margin-bottom: 16px;">
                <tr>
                  <td align="center">
                    <a href="${actionLink}" target="_blank" style="display: inline-block; background-color: #0f8975; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 13px 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(15,137,117,0.35);">
                      Open Task in Plix Ops &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="text-align: center; margin: 0; font-size: 12px; color: #87928b;">
                Click to review deliverables, leave feedback, or approve.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f7faf8; padding: 20px 28px; border-top: 1px solid #e5ebe7; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 11px; color: #738077; font-weight: 600;">
                Plix Unified Operations Engine • Creative Handoff Notification
              </p>
              <p style="margin: 0; font-size: 11px; color: #9aa59e;">
                This is an automated operational alert sent to ${recipientName}. Manage preferences in PlixOps settings.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Plain text fallback
 */
export function generateEmailText({
  action,
  task = {},
  actorName = "Team Member",
  recipientName = "Team Member",
  customNote = "",
  dashboardUrl = "http://localhost:4500",
}) {
  const taskId = task.id || "BPE-TASK";
  const title = task.title || "Creative Campaign";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || dashboardUrl).replace(/\/$/, "");

  return `[Plix Ops] Workflow Notification
----------------------------------------
Hi ${recipientName},

${actorName} has triggered an update for "${title}" (${taskId}).
Action: ${action.replace(/_/g, " ").toUpperCase()}

Task Details:
- Task ID: ${taskId} (${task.priority || "P1"})
- Product: ${task.product || "General"}
- Category: ${task.category || "Skin"}
- Hook: "${task.hookName || "Not set"}"

${customNote ? `Note from ${actorName}: "${customNote}"\n` : ""}${task.scriptLink ? `Google Doc: ${task.scriptLink}\n` : ""}${task.videoLink ? `Video Drive: ${task.videoLink}\n` : ""}
Open and act on this task in Plix Ops:
${appUrl}/?task=${taskId}

--
Plix Creative Operations`;
}

/**
 * Encodes string to Base64URL safe for Gmail API
 */
function toBase64Url(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Load Google Cloud Service Account credentials from credentials/google-service-account.json or env
 */
async function loadServiceAccountKey() {
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || path.join(process.cwd(), "credentials", "google-service-account.json");
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Exchange Google Service Account signed JWT for an access token
 */
async function getServiceAccountAccessToken() {
  const sa = await loadServiceAccountKey();
  if (!sa || !sa.client_email || !sa.private_key) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const delegatedUser = process.env.GOOGLE_DELEGATED_USER;

    const claims = {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };
    if (delegatedUser) {
      claims.sub = delegatedUser;
    }

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    const encodedClaims = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const signatureInput = `${encodedHeader}.${encodedClaims}`;

    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signatureInput);
    const signature = signer.sign(sa.private_key, "base64url");
    const jwt = `${signatureInput}.${signature}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.warn("[PlixOps Email] Service Account token exchange error:", tokenData);
      return null;
    }

    return {
      accessToken: tokenData.access_token,
      senderEmail: delegatedUser || sa.client_email,
      authMethod: "service_account",
    };
  } catch (err) {
    console.warn("[PlixOps Email] Failed to authenticate with Service Account:", err.message);
    return null;
  }
}

/**
 * Obtain a valid access token using either OAuth refresh token or Service Account
 */
async function getGmailAccessToken() {
  // 1. Prefer User OAuth2 Refresh Token (Authenticated user mailbox)
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenRes.ok && tokenData.access_token) {
        return {
          accessToken: tokenData.access_token,
          senderEmail: process.env.GMAIL_SENDER_EMAIL || "notifications@plixlife.com",
          authMethod: "oauth_refresh",
        };
      } else {
        console.warn("[PlixOps Email] OAuth Refresh error:", tokenData);
      }
    } catch (err) {
      console.warn("[PlixOps Email] Failed to refresh OAuth token:", err.message);
    }
  }

  // 2. Service Account fallback (for Google Workspace Domain-Wide Delegation)
  const saAuth = await getServiceAccountAccessToken();
  if (saAuth) {
    return saAuth;
  }

  return null;
}

/**
 * Build RFC 2822 MIME message string containing HTML, plain-text fallback,
 * and inline CID attachment for public/plix-ops-logo.png
 */
async function buildRfc2822MimeMessage({
  from,
  to,
  subject,
  html,
  text,
}) {
  const logoBase64 = await getLogoBase64();
  const boundaryMixed = `__mixed_boundary_${Date.now()}__`;
  const boundaryAlt = `__alt_boundary_${Date.now()}__`;

  // Encode Subject as UTF-8 Base64 to support emojis & punctuation safely
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

  const headers = [
    `From: Plix Ops <${from}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${boundaryMixed}"`,
    "",
  ];

  const bodyParts = [
    `--${boundaryMixed}`,
    `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
    "",
    `--${boundaryAlt}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    text,
    "",
    `--${boundaryAlt}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
    "",
    `--${boundaryAlt}--`,
  ];

  // Attach Inline PlixOps Logo PNG with Content-ID: <plixops-logo>
  if (logoBase64) {
    bodyParts.push(
      "",
      `--${boundaryMixed}`,
      'Content-Type: image/png; name="plix-ops-logo.png"',
      "Content-Transfer-Encoding: base64",
      "Content-ID: <plixops-logo>",
      'Content-Disposition: inline; filename="plix-ops-logo.png"',
      "",
      logoBase64,
      ""
    );
  }

  bodyParts.push(`--${boundaryMixed}--`);

  return headers.join("\r\n") + "\r\n" + bodyParts.join("\r\n");
}

/**
 * Primary dispatch function: sends email via Gmail API or logs simulation
 */
export async function sendGmailNotification({
  to,
  recipientName = "Team Member",
  action,
  task = {},
  actorName = "Team Member",
  customNote = "",
  dashboardUrl = "http://localhost:4500",
}) {
  if (!to) {
    return { success: false, error: "Recipient email address missing" };
  }

  const senderEmail = process.env.GMAIL_SENDER_EMAIL || "notifications@plixlife.com";
  // Developer override: allows testing all workflow notifications to a single inbox during development
  const destinationEmail = process.env.DEV_NOTIFICATION_EMAIL || to;

  const subject = formatEmailSubject({ action, task });
  const html = generateEmailHtml({ action, task, actorName, recipientName, customNote, dashboardUrl });
  const text = generateEmailText({ action, task, actorName, recipientName, customNote, dashboardUrl });

  const record = {
    id: `EMAIL-${Date.now().toString(36).toUpperCase()}`,
    to: destinationEmail,
    originalTo: to,
    recipientName,
    taskId: task.id || "N/A",
    action,
    subject,
    status: "pending",
    dispatchedAt: new Date().toISOString(),
    channel: "gmail_api",
    hasLogoCid: true,
  };

  try {
    const auth = await getGmailAccessToken();

    if (auth && auth.accessToken) {
      const fromAddress = senderEmail || auth.senderEmail;

      // 1. Build MIME with inline logo CID
      const rawMime = await buildRfc2822MimeMessage({
        from: fromAddress,
        to: destinationEmail,
        subject,
        html,
        text,
      });

      const base64UrlMessage = toBase64Url(rawMime);

      // 2. Call Gmail API endpoint
      const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: base64UrlMessage }),
      });

      const gmailData = await gmailRes.json();

      if (!gmailRes.ok) {
        throw new Error(`Gmail API Error: ${gmailData.error?.message || JSON.stringify(gmailData)}`);
      }

      record.status = "delivered_via_gmail_api";
      record.authMethod = auth.authMethod;
      record.gmailMessageId = gmailData.id;
      record.threadId = gmailData.threadId;
    } else {
      // Credentials not yet configured: provide safe dry-run simulation
      record.status = "simulation_mode";
      record.note = "Google credentials not detected in .env.local. Ready to send once configured.";
    }
  } catch (err) {
    record.status = "delivery_failed";
    record.error = err.message;
  }

  emailDispatchHistory.unshift(record);
  if (emailDispatchHistory.length > 50) emailDispatchHistory.pop();

  return {
    success: record.status !== "delivery_failed",
    ...record,
  };
}

export function getEmailDispatchLogs() {
  return emailDispatchHistory;
}

