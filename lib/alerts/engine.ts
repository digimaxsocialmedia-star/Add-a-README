import { money, pct, roasFmt } from "../format";
import type { Alert, CampaignWithMetrics, SeriesPoint } from "../types";

// Ngưỡng chi tiêu (VND) để coi là "đáng kể" cho cảnh báo không có chuyển đổi.
const MIN_SPEND = 1_200_000;

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Phát hiện bất thường từ chuỗi ngày của tài khoản + số liệu tổng từng chiến dịch. */
export function detectAlerts(
  series: SeriesPoint[],
  campaigns: CampaignWithMetrics[],
): Alert[] {
  const alerts: Alert[] = [];
  const s = [...series].sort((a, b) => a.date.localeCompare(b.date));

  if (s.length >= 8) {
    const last = s[s.length - 1];
    const prior7 = s.slice(-8, -1);
    const avgSpend = mean(prior7.map((p) => p.spend));

    if (avgSpend > 0 && last.spend > avgSpend * 1.6) {
      alerts.push({
        id: "spend_spike",
        severity: "high",
        title: "Phát hiện tăng vọt chi tiêu",
        detail: `Chi tiêu hôm qua (${money(last.spend)}) gấp ${(
          last.spend / avgSpend
        ).toFixed(1)} lần mức trung bình 7 ngày trước (${money(avgSpend)}).`,
      });
    } else if (avgSpend > 0 && last.spend < avgSpend * 0.5) {
      alerts.push({
        id: "spend_drop",
        severity: "medium",
        title: "Chi tiêu giảm mạnh",
        detail: `Chi tiêu hôm qua (${money(last.spend)}) thấp hơn hẳn mức trung bình 7 ngày trước (${money(
          avgSpend,
        )}) — kiểm tra phân phối hoặc ngân sách.`,
      });
    }
  }

  if (s.length >= 10) {
    const recent3 = s.slice(-3);
    const prev7 = s.slice(-10, -3);
    const recentRoas = mean(recent3.map((p) => p.roas));
    const prevRoas = mean(prev7.map((p) => p.roas));
    if (prevRoas > 0 && recentRoas < prevRoas * 0.7) {
      alerts.push({
        id: "roas_drop",
        severity: "high",
        title: "ROAS đang đi xuống",
        detail: `ROAS 3 ngày gần nhất (${roasFmt(recentRoas)}) giảm từ ${roasFmt(
          prevRoas,
        )} của tuần trước — hiệu quả đang sụt giảm.`,
      });
    }

    const recentCtr = mean(recent3.map((p) => p.ctr));
    const prevCtr = mean(prev7.map((p) => p.ctr));
    if (prevCtr > 0 && recentCtr < prevCtr * 0.7) {
      alerts.push({
        id: "ctr_drop",
        severity: "medium",
        title: "CTR đang giảm",
        detail: `CTR 3 ngày gần nhất (${pct(recentCtr)}) đã giảm từ ${pct(
          prevCtr,
        )} — nhiều khả năng nội dung đã "chai".`,
      });
    }
  }

  // Có chi tiêu nhưng không có chuyển đổi.
  for (const c of campaigns) {
    if (
      c.status === "ACTIVE" &&
      c.metrics.spend > MIN_SPEND &&
      c.metrics.conversions === 0
    ) {
      alerts.push({
        id: `no_conv_${c.id}`,
        severity: "high",
        title: `"${c.name}" không có chuyển đổi`,
        detail: `Đã chi ${money(c.metrics.spend)} mà không có chuyển đổi nào — hãy tạm dừng hoặc sửa theo dõi/nhắm chọn.`,
      });
    }
  }

  // Tài khoản dưới hòa vốn.
  const active = campaigns.filter((c) => c.status === "ACTIVE" && c.metrics.spend > 0);
  const spend = active.reduce((a, c) => a + c.metrics.spend, 0);
  const revenue = active.reduce((a, c) => a + c.metrics.revenue, 0);
  if (spend > 0 && revenue / spend < 1) {
    alerts.push({
      id: "account_unprofitable",
      severity: "high",
      title: "Tài khoản dưới điểm hòa vốn",
      detail: `Các chiến dịch đang chạy chỉ đạt ROAS ${roasFmt(
        revenue / spend,
      )} — bạn đang chi nhiều hơn doanh thu thu về.`,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
