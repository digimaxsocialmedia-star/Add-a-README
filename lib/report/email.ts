import nodemailer from "nodemailer";
import { getAccountSummary, getCampaigns, getDailySeries } from "../meta/client";
import { getAccountLabel } from "../meta/config";
import { detectAlerts } from "../alerts/engine";
import { runAudit } from "../audit/engine";
import { money, pct, roasFmt, intNum } from "../format";
import type {
  AccountSummary,
  Alert,
  AuditResult,
  CampaignWithMetrics,
} from "../types";

// -----------------------------------------------------------------------------
// Báo cáo hiệu suất gửi qua email (SMTP). Cấu hình qua biến môi trường:
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
//   REPORT_EMAIL_FROM, REPORT_EMAIL_TO
// Chưa cấu hình thì API trả về bản xem trước (HTML) để demo vẫn dùng được.
// -----------------------------------------------------------------------------

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

interface ReportData {
  summary: AccountSummary;
  campaigns: CampaignWithMetrics[];
  alerts: Alert[];
  audit: AuditResult;
}

async function gather(): Promise<ReportData> {
  const [summary, campaigns, series] = await Promise.all([
    getAccountSummary(),
    getCampaigns(),
    getDailySeries(),
  ]);
  return {
    summary,
    campaigns,
    alerts: detectAlerts(series, campaigns),
    audit: runAudit(campaigns, summary),
  };
}

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

function gradeColor(score: number): string {
  if (score >= 85) return "#10b981";
  if (score >= 70) return "#22c55e";
  if (score >= 55) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

const SEV_COLOR: Record<Alert["severity"], string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#0ea5e9",
};

export function buildReportHtml(d: ReportData): {
  subject: string;
  html: string;
  text: string;
} {
  const date = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const m = d.summary.metrics;
  const top = [...d.campaigns]
    .filter((c) => c.status === "ACTIVE")
    .sort((a, b) => b.metrics.spend - a.metrics.spend)
    .slice(0, 6);

  const kpi = (label: string, value: string, color = "#0f172a") =>
    `<td style="padding:10px 12px;background:#f8fafc;border-radius:10px;">
       <div style="font-size:12px;color:#64748b;">${label}</div>
       <div style="font-size:18px;font-weight:700;color:${color};margin-top:2px;">${value}</div>
     </td>`;

  const rows = top
    .map((c) => {
      const rc =
        c.metrics.roas >= 3 ? "#10b981" : c.metrics.roas >= 1 ? "#f59e0b" : "#ef4444";
      return `<tr>
        <td style="padding:8px 10px;border-top:1px solid #eef2f7;">${esc(c.name)}</td>
        <td style="padding:8px 10px;border-top:1px solid #eef2f7;text-align:right;">${money(c.metrics.spend)}</td>
        <td style="padding:8px 10px;border-top:1px solid #eef2f7;text-align:right;">${money(c.metrics.revenue)}</td>
        <td style="padding:8px 10px;border-top:1px solid #eef2f7;text-align:right;color:${rc};font-weight:700;">${roasFmt(c.metrics.roas)}</td>
      </tr>`;
    })
    .join("");

  const alertsHtml = d.alerts.length
    ? d.alerts
        .map(
          (a) =>
            `<div style="padding:8px 10px;border-left:3px solid ${SEV_COLOR[a.severity]};background:#fff7ed;border-radius:6px;margin-bottom:6px;">
               <div style="font-weight:600;color:#0f172a;">${esc(a.title)}</div>
               <div style="font-size:13px;color:#475569;">${esc(a.detail)}</div>
             </div>`,
        )
        .join("")
    : `<div style="font-size:13px;color:#64748b;">Không phát hiện bất thường — mọi thứ ổn định.</div>`;

  const gc = gradeColor(d.audit.score);

  const html = `<!doctype html><html lang="vi"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:#4f46e5;border-radius:14px 14px 0 0;padding:20px 22px;color:#fff;">
      <div style="font-size:18px;font-weight:700;">AdPilot — Báo cáo quảng cáo</div>
      <div style="font-size:13px;opacity:.9;">${esc(getAccountLabel())} · ${date}</div>
    </div>
    <div style="background:#fff;border-radius:0 0 14px 14px;padding:22px;border:1px solid #e2e8f0;border-top:none;">

      <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:8px;margin:-8px;">
        <tr>${kpi("Chi tiêu", money(m.spend))}${kpi("Doanh thu", money(m.revenue), "#10b981")}</tr>
        <tr>${kpi("ROAS", roasFmt(m.roas), m.roas >= 1 ? "#10b981" : "#ef4444")}${kpi("Chuyển đổi", intNum(m.conversions))}</tr>
        <tr>${kpi("CTR", pct(m.ctr))}${kpi("Chiến dịch đang chạy", `${d.summary.activeCampaigns}/${d.summary.totalCampaigns}`)}</tr>
      </table>

      <div style="margin:20px 0 8px;display:flex;align-items:center;gap:10px;">
        <span style="display:inline-block;background:${gc};color:#fff;font-weight:800;border-radius:8px;padding:4px 10px;font-size:16px;">${d.audit.grade}</span>
        <span style="font-weight:600;">Điểm sức khỏe tài khoản: ${d.audit.score}/100</span>
      </div>
      <div style="font-size:13px;color:#64748b;">${d.audit.counts.pass} đạt · ${d.audit.counts.warn} cảnh báo · ${d.audit.counts.fail} lỗi</div>

      <h3 style="margin:22px 0 8px;font-size:15px;">Top chiến dịch theo chi tiêu</h3>
      <table role="presentation" width="100%" style="border-collapse:collapse;font-size:13px;">
        <thead><tr style="color:#64748b;text-align:left;">
          <th style="padding:6px 10px;">Chiến dịch</th>
          <th style="padding:6px 10px;text-align:right;">Chi tiêu</th>
          <th style="padding:6px 10px;text-align:right;">Doanh thu</th>
          <th style="padding:6px 10px;text-align:right;">ROAS</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="4" style="padding:10px;color:#94a3b8;">Chưa có chiến dịch đang chạy.</td></tr>`}</tbody>
      </table>

      <h3 style="margin:22px 0 8px;font-size:15px;">Cảnh báo</h3>
      ${alertsHtml}

      <div style="margin-top:22px;padding-top:14px;border-top:1px solid #eef2f7;font-size:12px;color:#94a3b8;">
        Gửi tự động bởi AdPilot. Đây là bản tóm tắt 30 ngày gần nhất.
      </div>
    </div>
  </div>
  </body></html>`;

  const text = [
    `AdPilot — Báo cáo quảng cáo (${date})`,
    `Chi tiêu: ${money(m.spend)} | Doanh thu: ${money(m.revenue)} | ROAS: ${roasFmt(m.roas)}`,
    `Chuyển đổi: ${intNum(m.conversions)} | CTR: ${pct(m.ctr)}`,
    `Điểm sức khỏe: ${d.audit.score}/100 (${d.audit.grade})`,
    `Cảnh báo: ${d.alerts.length ? d.alerts.map((a) => a.title).join("; ") : "Không có"}`,
  ].join("\n");

  return { subject: `AdPilot — Báo cáo quảng cáo ${date}`, html, text };
}

export interface SendResult {
  sent: boolean;
  subject: string;
  to?: string;
  preview?: string;
  note?: string;
  error?: string;
}

export async function sendReportEmail(
  to?: string,
  opts: { previewOnly?: boolean } = {},
): Promise<SendResult> {
  const data = await gather();
  const { subject, html, text } = buildReportHtml(data);
  const recipient = to || process.env.REPORT_EMAIL_TO;

  if (opts.previewOnly) {
    return { sent: false, subject, preview: html };
  }
  if (!isEmailConfigured()) {
    return {
      sent: false,
      subject,
      preview: html,
      note: "Chưa cấu hình SMTP (SMTP_HOST/SMTP_USER/SMTP_PASS). Đang hiển thị bản xem trước.",
    };
  }
  if (!recipient) {
    return {
      sent: false,
      subject,
      preview: html,
      note: "Chưa có địa chỉ nhận (REPORT_EMAIL_TO hoặc nhập email).",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.REPORT_EMAIL_FROM || process.env.SMTP_USER,
      to: recipient,
      subject,
      html,
      text,
    });
    return { sent: true, subject, to: recipient };
  } catch (err) {
    return {
      sent: false,
      subject,
      preview: html,
      error: err instanceof Error ? err.message : "Không gửi được email",
    };
  }
}
