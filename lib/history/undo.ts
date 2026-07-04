// -----------------------------------------------------------------------------
// Hoàn tác một mục lịch sử: ghi lại GIÁ TRỊ TRƯỚC qua đúng tầng dữ liệu
// (client.ts), nên bản thân thao tác hoàn tác cũng được ghi thành một dòng
// lịch sử mới — sổ sách luôn trung thực.
// -----------------------------------------------------------------------------

import {
  setAdSetStatus,
  setAdStatus,
  setCampaignStatus,
  updateAdSetDailyBudget,
  updateCampaignDailyBudget,
} from "../meta/client";
import { getStore, schedulePersist } from "../mock/store";
import type { EntityStatus } from "../types";

export async function undoEntry(
  id: string,
): Promise<{ ok: boolean; message: string }> {
  const entry = getStore().history.find((h) => h.id === id);
  if (!entry) return { ok: false, message: "Không tìm thấy mục lịch sử." };
  if (entry.undoneAt) {
    return { ok: false, message: "Mục này đã được hoàn tác trước đó." };
  }
  if (!entry.undoable || entry.before == null) {
    return { ok: false, message: "Mục này không thể hoàn tác." };
  }

  const name = entry.targetName ?? entry.targetId;
  switch (entry.action) {
    case "campaign_status":
      await setCampaignStatus(entry.targetId, entry.before as EntityStatus);
      break;
    case "adset_status":
      await setAdSetStatus(entry.targetId, entry.before as EntityStatus);
      break;
    case "ad_status":
      await setAdStatus(entry.targetId, entry.before as EntityStatus);
      break;
    case "campaign_budget":
      await updateCampaignDailyBudget(entry.targetId, Number(entry.before));
      break;
    case "adset_budget":
      await updateAdSetDailyBudget(entry.targetId, Number(entry.before));
      break;
    default:
      return { ok: false, message: "Loại thay đổi này không hỗ trợ hoàn tác." };
  }

  entry.undoneAt = new Date().toISOString();
  schedulePersist();
  return { ok: true, message: `Đã hoàn tác thay đổi trên "${name}".` };
}
