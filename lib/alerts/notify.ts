import { getCampaigns, getDailySeries } from "../meta/client";
import { getAccountLabel } from "../meta/config";
import { detectAlerts } from "./engine";
import { getStore, addLog, schedulePersist } from "../mock/store";
import {
  configuredChannels,
  notify,
  type ChannelResult,
  type NotifyChannel,
} from "../notify/channels";
import type { Alert, CampaignWithMetrics } from "../types";

// Cảnh báo cùng id (vd "spend_spike") được phép gửi LẠI sau khoảng này — dedup
// vĩnh viễn sẽ nuốt mất các bất thường mới tái diễn (đúng thứ cron cần báo).
const RENOTIFY_HOURS = 12;

const SEV_ICON: Record<Alert["severity"], string> = {
  high: "🔴",
  medium: "🟠",
  low: "🔵",
};

function formatMessage(alerts: Alert[]): string {
  const head = `🔔 AdPilot — ${alerts.length} cảnh báo mới\n${getAccountLabel()}`;
  const body = alerts
    .map((a) => `${SEV_ICON[a.severity]} ${a.title}\n${a.detail}`)
    .join("\n\n");
  return `${head}\n\n${body}`;
}

export interface NotifyRun {
  channels: NotifyChannel[];
  newAlerts: Alert[];
  results: ChannelResult[];
  note?: string;
  test?: boolean;
}

export async function sendTestNotification(): Promise<NotifyRun> {
  const channels = configuredChannels();
  if (channels.length === 0) {
    return {
      channels,
      newAlerts: [],
      results: [],
      test: true,
      note: "Chưa cấu hình kênh nào (Telegram/Zalo).",
    };
  }
  const results = await notify(
    "🔔 AdPilot: Tin nhắn thử — kênh cảnh báo đang hoạt động bình thường.",
  );
  return { channels, newAlerts: [], results, test: true };
}

/**
 * Kiểm tra bất thường và gửi cảnh báo.
 * - force = false: chỉ gửi cảnh báo chưa gửi trong RENOTIFY_HOURS giờ qua —
 *                  dùng cho cron/Autopilot.
 * - force = true:  gửi mọi cảnh báo hiện tại — dùng khi người dùng bấm gửi tay.
 * `snapshot`: danh sách chiến dịch đã tải sẵn (tránh gọi API lặp trong 1 tick).
 */
export async function runAlertNotifications(
  force = false,
  snapshot?: CampaignWithMetrics[],
): Promise<NotifyRun> {
  const store = getStore();
  const channels = configuredChannels();
  const [campaigns, series] = await Promise.all([
    snapshot ?? getCampaigns(),
    getDailySeries(),
  ]);
  const alerts = detectAlerts(series, campaigns);
  const resendCutoff = Date.now() - RENOTIFY_HOURS * 3_600_000;
  const fresh = force
    ? alerts
    : alerts.filter((a) => {
        const sentAt = store.notifiedAlerts[a.id];
        return !sentAt || new Date(sentAt).getTime() < resendCutoff;
      });

  if (channels.length === 0) {
    return {
      channels,
      newAlerts: fresh,
      results: [],
      note: "Chưa cấu hình kênh nào (Telegram/Zalo).",
    };
  }
  if (fresh.length === 0) {
    return { channels, newAlerts: [], results: [], note: "Không có cảnh báo mới." };
  }

  const results = await notify(formatMessage(fresh));
  if (results.some((r) => r.ok)) {
    const now = new Date().toISOString();
    for (const a of fresh) store.notifiedAlerts[a.id] = now;
    // Dọn các mục quá cũ để map không phình vô hạn (id no_conv_* theo chiến dịch).
    const weekAgo = Date.now() - 7 * 24 * 3_600_000;
    for (const [id, at] of Object.entries(store.notifiedAlerts)) {
      if (new Date(at).getTime() < weekAgo) delete store.notifiedAlerts[id];
    }
    addLog({
      kind: "info",
      message: `Đã gửi ${fresh.length} cảnh báo qua ${results
        .filter((r) => r.ok)
        .map((r) => r.channel)
        .join(", ")}.`,
    });
  }
  return { channels, newAlerts: fresh, results };
}

export function resetNotified(): void {
  getStore().notifiedAlerts = {};
  schedulePersist();
}
