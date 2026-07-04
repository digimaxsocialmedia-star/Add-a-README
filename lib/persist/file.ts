// -----------------------------------------------------------------------------
// Lưu trữ bền vững — ghi TRẠNG THÁI ỨNG DỤNG xuống đĩa dạng JSON để sống sót
// qua restart/redeploy: quy tắc, cài đặt tự lái, lịch chạy giờ, mục tiêu tháng,
// điểm hòa vốn, lịch sử thay đổi, nhật ký, cooldown, cảnh báo đã gửi, và tài
// khoản đang chọn.
//
// KHÔNG lưu chiến dịch demo (tự sinh lại với ngày tháng mới mỗi lần khởi động —
// ở live mode chiến dịch đến từ Meta nên cũng không cần lưu).
//
// Vị trí file: $ADPILOT_DATA_DIR/state.json (mặc định .data/ trong thư mục dự
// án). Ghi kiểu tmp + rename để không bao giờ để lại file hỏng dở dang.
// Lưu ý: trên hạ tầng serverless (Vercel) đĩa là tạm thời — hãy chạy trên
// VPS/máy riêng, hoặc trỏ ADPILOT_DATA_DIR vào một volume bền vững.
// -----------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import type {
  AutomationRule,
  AutopilotSettings,
  BreakevenSettings,
  DaypartSchedule,
  HistoryEntry,
  LogEntry,
  MonthlyTargets,
} from "../types";

/** Phần trạng thái ứng dụng của một tài khoản (Store trừ campaigns). */
export interface PersistedAccountState {
  seq: number;
  rules: AutomationRule[];
  settings: AutopilotSettings;
  log: LogEntry[];
  cooldowns: Record<string, string>;
  notifiedAlerts: Record<string, string>;
  targets: MonthlyTargets;
  schedules: Record<string, DaypartSchedule>;
  breakeven: BreakevenSettings;
  history: HistoryEntry[];
}

export interface PersistedFile {
  version: 1;
  savedAt: string;
  activeAccountId?: string;
  accounts: Record<string, PersistedAccountState>;
}

function stateFilePath(): string {
  const dir = process.env.ADPILOT_DATA_DIR || ".data";
  return path.join(dir, "state.json");
}

/** Đọc file trạng thái; trả undefined nếu chưa có hoặc hỏng (không ném lỗi). */
export function loadPersisted(): PersistedFile | undefined {
  try {
    const raw = fs.readFileSync(stateFilePath(), "utf8");
    const data = JSON.parse(raw) as PersistedFile;
    if (data?.version !== 1 || typeof data.accounts !== "object") return undefined;
    return data;
  } catch {
    return undefined;
  }
}

/** Ghi file trạng thái (tmp + rename). Lỗi IO không được làm sập request. */
export function savePersisted(data: PersistedFile): void {
  try {
    const file = stateFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
  } catch {
    /* đĩa chỉ đọc / serverless — bỏ qua, app vẫn chạy trong RAM */
  }
}
