import { getCampaigns, getDailySeries } from "../meta/client";
import { getAccountLabel } from "../meta/config";
import { detectAlerts } from "./engine";
import { getStore, addLog } from "../mock/store";
import {
  configuredChannels,
  notify,
  type ChannelResult,
  type NotifyChannel,
} from "../notify/channels";
import type { Alert } from "../types";

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
 * - force = false: chỉ gửi cảnh báo MỚI (chưa từng gửi) — dùng cho cron/Autopilot.
 * - force = true:  gửi mọi cảnh báo hiện tại — dùng khi người dùng bấm gửi tay.
 */
export async function runAlertNotifications(force = false): Promise<NotifyRun> {
  const store = getStore();
  const channels = configuredChannels();
  const [campaigns, series] = await Promise.all([
    getCampaigns(),
    getDailySeries(),
  ]);
  const alerts = detectAlerts(series, campaigns);
  const notified = new Set(store.notifiedAlertIds);
  const fresh = force ? alerts : alerts.filter((a) => !notified.has(a.id));

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
    for (const a of fresh) notified.add(a.id);
    store.notifiedAlertIds = [...notified].slice(-200);
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
  getStore().notifiedAlertIds = [];
}
