import type { AudienceType } from "../types";

export const AUDIENCE_TYPE_LABELS: Record<AudienceType, string> = {
  lookalike: "Lookalike",
  custom: "Tùy chỉnh",
  interest: "Sở thích",
  broad: "Rộng",
  saved: "Đã lưu",
};

/** Suy ra loại tệp đối tượng từ tên (hỗ trợ cả tiếng Việt và tiếng Anh). */
export function classifyAudience(name: string): AudienceType {
  const s = name.toLowerCase();
  if (s.includes("lookalike") || s.includes("lla")) return "lookalike";
  if (s.includes("sở thích") || s.includes("interest")) return "interest";
  if (s.includes("rộng") || s.includes("broad")) return "broad";
  if (
    /(ghé thăm|đã xem|đã thêm|giỏ|website|web |visitor|viewed|cart|mua|khách|người đọc|retarget|remarket)/.test(
      s,
    )
  ) {
    return "custom";
  }
  return "saved";
}
