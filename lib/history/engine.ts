// -----------------------------------------------------------------------------
// Lịch sử thay đổi — sổ ghi chép mọi lệnh GHI (bật/tắt, đổi ngân sách…) đi qua
// tầng dữ liệu, kèm giá trị trước/sau để có thể HOÀN TÁC.
//
// Việc ghi diễn ra ngay trong facade lib/meta/client.ts nên mọi nguồn thay đổi
// (người dùng, quy tắc, lịch chạy giờ, tối ưu ngân sách) đều được ghi ở một
// chỗ. "Ai gây ra" được đặt qua runAsActor() bởi engine tương ứng; mặc định
// là người dùng.
// -----------------------------------------------------------------------------

import { getStore } from "../mock/store";
import type { HistoryActor, HistoryEntry } from "../types";

const MAX_ENTRIES = 100;

// Ngữ cảnh "ai gây ra" — biến module-level là đủ cho app này: các engine tự
// động set trước khi ghi và trả lại "user" ngay sau đó trong cùng request.
let currentActor: HistoryActor = "user";

/** Chạy fn với danh nghĩa actor chỉ định (quy tắc / lịch chạy / tối ưu NS). */
export async function runAsActor<T>(
  actor: HistoryActor,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = currentActor;
  currentActor = actor;
  try {
    return await fn();
  } finally {
    currentActor = prev;
  }
}

/** Ghi một dòng lịch sử (mới nhất lên đầu, giữ tối đa MAX_ENTRIES dòng). */
export function recordHistory(
  entry: Omit<HistoryEntry, "id" | "at" | "actor">,
): void {
  const store = getStore();
  store.history.unshift({
    id: `his_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    actor: currentActor,
    ...entry,
  });
  store.history = store.history.slice(0, MAX_ENTRIES);
}
