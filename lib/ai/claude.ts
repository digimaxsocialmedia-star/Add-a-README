import Anthropic from "@anthropic-ai/sdk";
import { OBJECTIVE_LABELS } from "../types";
import { money, pct, roasFmt } from "../format";
import { AUDIENCE_TYPE_LABELS } from "../audiences/classify";
import type {
  AdCopyResult,
  AdCopyVariant,
  AiResult,
  AiSuggestion,
  AudienceIdea,
  AudienceIdeaResult,
  AudienceRow,
  CampaignWithMetrics,
  CreativeScoreItem,
  CreativeScoreResult,
} from "../types";

// Per the project's Claude integration: use the latest Opus model.
const MODEL = "claude-opus-4-8";

const SYSTEM_PROMPT = `Bạn là chuyên gia chiến lược quảng cáo Meta (Facebook) kỳ cựu, tích hợp trong một công cụ tự động hóa quảng cáo của một nhà quảng cáo Việt Nam.
Bạn nhận được ảnh chụp nhanh các chiến dịch của một tài khoản với hiệu suất tổng hợp 30 ngày. Tiền tệ là VND (đồng).
Hãy đưa ra các khuyến nghị tối ưu cụ thể, có thứ tự ưu tiên mà người chạy quảng cáo có thể hành động ngay hôm nay.

QUAN TRỌNG: Toàn bộ nội dung (title, rationale, recommendedAction) phải viết HOÀN TOÀN BẰNG TIẾNG VIỆT, tự nhiên và chuyên nghiệp.

Hướng dẫn:
- Nói cụ thể, dẫn tên chiến dịch và chỉ số biện minh cho hành động.
- Ưu tiên các nước đi đòn bẩy cao: chuyển ngân sách từ chiến dịch ROAS thấp sang ROAS cao,
  tăng tốc dần các chiến dịch thắng, sửa vấn đề nội dung/CTR, siết hoặc mở rộng đối tượng.
- ROAS dưới ~1.0 là đang lỗ; ROAS trên ~3.0 là ứng viên để tăng tốc.
- CTR dưới ~1.0% thường báo hiệu vấn đề về nội dung hoặc nhắm chọn.
- Mỗi rationale 1-2 câu. recommendedAction là một bước hành động mệnh lệnh duy nhất.
- Trả về từ 3 đến 6 gợi ý, sắp xếp theo mức tác động giảm dần.`;

function buildAccountTable(campaigns: CampaignWithMetrics[]): string {
  const rows = campaigns.map((c) => {
    const m = c.metrics;
    return [
      `- ${c.name} [${OBJECTIVE_LABELS[c.objective]}, ${c.status}]`,
      `daily budget ${money(c.dailyBudget)}`,
      `spend ${money(m.spend)}`,
      `revenue ${money(m.revenue)}`,
      `ROAS ${roasFmt(m.roas)}`,
      `CTR ${pct(m.ctr)}`,
      `CPC ${money(m.cpc)}`,
      `CPA ${m.conversions ? money(m.cpa) : "n/a"}`,
      `conversions ${m.conversions}`,
    ].join(" | ");
  });
  return rows.join("\n");
}

const SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          category: {
            type: "string",
            enum: ["budget", "targeting", "creative", "bidding", "structure"],
          },
          campaignName: { type: "string" },
          rationale: { type: "string" },
          recommendedAction: { type: "string" },
        },
        required: ["title", "severity", "category", "rationale", "recommendedAction"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
} as const;

export async function getSuggestions(
  campaigns: CampaignWithMetrics[],
): Promise<AiResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ...heuristicSuggestions(campaigns),
      source: "heuristic",
      note: "Đặt ANTHROPIC_API_KEY để tạo khuyến nghị bằng Claude. Đang hiển thị phân tích theo quy tắc.",
    };
  }

  try {
    const client = new Anthropic();
    const userPrompt = `Đây là ảnh chụp nhanh tài khoản quảng cáo hiện tại (30 ngày gần nhất), tiền tệ VND:\n\n${buildAccountTable(
      campaigns,
    )}\n\nHãy trả về các khuyến nghị tối ưu theo thứ tự ưu tiên, viết bằng tiếng Việt.`;

    // Adaptive thinking + structured JSON output. Passed as `any` so the build
    // doesn't couple to a specific SDK type version for these newer fields.
    const params = {
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: "json_schema", schema: SUGGESTION_SCHEMA },
      },
      messages: [{ role: "user", content: userPrompt }],
    };

    const response = (await client.messages.create(params as never)) as {
      content: Array<{ type: string; text?: string }>;
    };
    const textBlock = response.content.find(
      (b) => b.type === "text" && typeof b.text === "string",
    );
    if (!textBlock?.text) throw new Error("No text block in response");

    const parsed = JSON.parse(textBlock.text) as { suggestions: AiSuggestion[] };
    if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
      throw new Error("Empty suggestions");
    }
    return { suggestions: parsed.suggestions, source: "claude", model: MODEL };
  } catch (err) {
    // Network/parse/availability issues should never break the demo.
    return {
      ...heuristicSuggestions(campaigns),
      source: "heuristic",
      note: `Gọi Claude thất bại (${
        err instanceof Error ? err.message : "lỗi không xác định"
      }). Đang hiển thị phân tích theo quy tắc.`,
    };
  }
}

// -----------------------------------------------------------------------------
// Phương án dự phòng theo quy tắc — một "bộ tối ưu" tất định để tính năng vẫn
// hữu ích ngay cả khi không có API key.
// -----------------------------------------------------------------------------
export function heuristicSuggestions(
  campaigns: CampaignWithMetrics[],
): { suggestions: AiSuggestion[] } {
  const active = campaigns.filter((c) => c.status === "ACTIVE" && c.metrics.spend > 0);
  const suggestions: AiSuggestion[] = [];

  const losers = active.filter((c) => c.metrics.roas < 1);
  const winners = active.filter((c) => c.metrics.roas >= 3);

  for (const c of [...active].sort((a, b) => a.metrics.roas - b.metrics.roas)) {
    if (c.metrics.roas < 1) {
      suggestions.push({
        title: `Chặn lỗ cho "${c.name}"`,
        severity: "high",
        category: "budget",
        campaignName: c.name,
        rationale: `ROAS chỉ ${roasFmt(c.metrics.roas)} trên ${money(
          c.metrics.spend,
        )} chi tiêu — chiến dịch này đang lỗ.`,
        recommendedAction:
          "Tạm dừng (hoặc giảm 50% ngân sách) và dồn chi tiêu cho chiến dịch ROAS tốt nhất.",
      });
    }
  }

  for (const c of [...winners].sort((a, b) => b.metrics.roas - a.metrics.roas)) {
    suggestions.push({
      title: `Tăng tốc "${c.name}"`,
      severity: "high",
      category: "budget",
      campaignName: c.name,
      rationale: `ROAS ${roasFmt(c.metrics.roas)} — cao hơn hẳn mục tiêu. Còn dư địa để chi nhiều hơn mà vẫn có lời.`,
      recommendedAction: `Tăng ngân sách ngày ~20% (lên ${money(
        c.dailyBudget * 1.2,
      )}) và theo dõi trong 3 ngày.`,
    });
  }

  for (const c of active) {
    if (c.metrics.ctr < 1) {
      suggestions.push({
        title: `Làm mới nội dung cho "${c.name}"`,
        severity: "medium",
        category: "creative",
        campaignName: c.name,
        rationale: `CTR chỉ ${pct(
          c.metrics.ctr,
        )} — đối tượng chưa tương tác với nội dung hiện tại.`,
        recommendedAction:
          "Thử 2-3 hook/thumbnail mới và tạm dừng quảng cáo có CTR thấp nhất trong nhóm.",
      });
    }
  }

  if (losers.length && winners.length) {
    suggestions.push({
      title: "Phân bổ lại ngân sách về nơi đang hiệu quả",
      severity: "high",
      category: "structure",
      rationale: `${losers.length} chiến dịch dưới 1.0x ROAS trong khi ${winners.length} chiến dịch trên 3.0x. Cơ cấu tài khoản đang rò rỉ lợi nhuận.`,
      recommendedAction: `Chuyển ngân sách từ ${losers
        .map((c) => `"${c.name}"`)
        .join(", ")} sang ${winners.map((c) => `"${c.name}"`).join(", ")}.`,
    });
  }

  // Cảnh báo CPA cao.
  const pricey = active
    .filter((c) => c.metrics.conversions > 0 && c.metrics.cpa > 1_200_000)
    .sort((a, b) => b.metrics.cpa - a.metrics.cpa)[0];
  if (pricey) {
    suggestions.push({
      title: `Chi phí chuyển đổi cao ở "${pricey.name}"`,
      severity: "medium",
      category: "bidding",
      campaignName: pricey.name,
      rationale: `CPA là ${money(
        pricey.metrics.cpa,
      )} — cao hơn ngưỡng lành mạnh của tài khoản này.`,
      recommendedAction:
        "Siết đối tượng hoặc chuyển sang chiến lược giá thầu giới hạn chi phí để kiểm soát CPA.",
    });
  }

  const ranked = suggestions
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 6);

  if (ranked.length === 0) {
    ranked.push({
      title: "Tài khoản đang khỏe mạnh — tiếp tục thử nghiệm",
      severity: "low",
      category: "creative",
      rationale: "Hiện không có chiến dịch nào đang lỗ hay kém về CTR.",
      recommendedAction:
        "Duy trì nhịp thử nội dung đều đặn và tăng tốc dần chiến dịch ROAS cao nhất.",
    });
  }
  return { suggestions: ranked };
}

function severityRank(s: AiSuggestion["severity"]): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

// -----------------------------------------------------------------------------
// AI ad copy generator (Creative Studio)
// -----------------------------------------------------------------------------

export interface AdCopyInput {
  product: string;
  audience: string;
  tone: string;
  objective: string;
}

const AD_COPY_SCHEMA = {
  type: "object",
  properties: {
    variants: {
      type: "array",
      items: {
        type: "object",
        properties: {
          angle: { type: "string" },
          headline: { type: "string" },
          primaryText: { type: "string" },
        },
        required: ["angle", "headline", "primaryText"],
        additionalProperties: false,
      },
    },
  },
  required: ["variants"],
  additionalProperties: false,
} as const;

export async function generateAdCopy(input: AdCopyInput): Promise<AdCopyResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ...heuristicAdCopy(input),
      source: "heuristic",
      note: "Đặt ANTHROPIC_API_KEY để viết nội dung bằng Claude. Đang hiển thị các mẫu có sẵn.",
    };
  }
  try {
    const client = new Anthropic();
    const system = `Bạn là copywriter chuyên về quảng cáo phản hồi trực tiếp (direct-response) cho Meta (Facebook/Instagram), phục vụ thị trường Việt Nam.
Viết nội dung quảng cáo "dừng tay lướt" giúp đạt mục tiêu đề ra. Mỗi biến thể dùng một góc tiếp cận
khác nhau (ví dụ: vấn đề/giải pháp, bằng chứng xã hội, khẩn cấp/khan hiếm, dẫn dắt bằng lợi ích,
tò mò). Tiêu đề (headline) dưới ~40 ký tự; nội dung chính (primaryText) 1-3 câu ngắn kèm lời kêu gọi
hành động rõ ràng. Không bịa số liệu hay tuyên bố không kiểm chứng được.

QUAN TRỌNG: Viết TẤT CẢ bằng tiếng Việt tự nhiên, phù hợp văn hóa Việt Nam.`;
    const user = `Sản phẩm/ưu đãi: ${input.product}
Đối tượng mục tiêu: ${input.audience}
Giọng điệu: ${input.tone}
Mục tiêu chiến dịch: ${input.objective}

Viết 4 biến thể nội dung quảng cáo bằng tiếng Việt.`;

    const params = {
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system,
      output_config: { format: { type: "json_schema", schema: AD_COPY_SCHEMA } },
      messages: [{ role: "user", content: user }],
    };
    const response = (await client.messages.create(params as never)) as {
      content: Array<{ type: string; text?: string }>;
    };
    const textBlock = response.content.find(
      (b) => b.type === "text" && typeof b.text === "string",
    );
    if (!textBlock?.text) throw new Error("No text block in response");
    const parsed = JSON.parse(textBlock.text) as { variants: AdCopyVariant[] };
    if (!Array.isArray(parsed.variants) || parsed.variants.length === 0) {
      throw new Error("Empty variants");
    }
    return { variants: parsed.variants, source: "claude", model: MODEL };
  } catch (err) {
    return {
      ...heuristicAdCopy(input),
      source: "heuristic",
      note: `Gọi Claude thất bại (${
        err instanceof Error ? err.message : "lỗi không xác định"
      }). Đang hiển thị các mẫu có sẵn.`,
    };
  }
}

function heuristicAdCopy(input: AdCopyInput): { variants: AdCopyVariant[] } {
  const p = input.product.trim() || "sản phẩm của chúng tôi";
  const a = input.audience.trim() || "bạn";
  const variants: AdCopyVariant[] = [
    {
      angle: "Dẫn dắt bằng lợi ích",
      headline: `${truncate(capitalize(p), 30)}`,
      primaryText: `Dành riêng cho ${a}. ${capitalize(p)} đơn giản mà hiệu quả — xem vì sao nhiều người đang chuyển sang dùng. Mua ngay →`,
    },
    {
      angle: "Vấn đề / giải pháp",
      headline: "Mệt mỏi vì rắc rối?",
      primaryText: `${capitalize(a)} xứng đáng điều tốt hơn. ${capitalize(
        p,
      )} giải quyết chỉ trong vài phút. Thử ngay hôm nay.`,
    },
    {
      angle: "Bằng chứng xã hội",
      headline: "Được hàng nghìn người tin dùng",
      primaryText: `Gia nhập cùng ${a} đã chọn ${p}. Kết quả thật, không hối tiếc. Sở hữu ngay →`,
    },
    {
      angle: "Khẩn cấp / khan hiếm",
      headline: "Ưu đãi có hạn",
      primaryText: `Đừng bỏ lỡ — ${p} với mức giá tốt nhất từ trước đến nay. Ưu đãi sắp kết thúc. Nhận ngay.`,
    },
  ];
  return { variants };
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// -----------------------------------------------------------------------------
// AI gợi ý tệp đối tượng mới (Studio đối tượng)
// -----------------------------------------------------------------------------

const AUDIENCE_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: {
            type: "string",
            enum: ["lookalike", "custom", "interest", "broad", "saved"],
          },
          size: { type: "string", enum: ["hẹp", "vừa", "rộng"] },
          rationale: { type: "string" },
        },
        required: ["name", "type", "size", "rationale"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
} as const;

function buildAudienceTable(audiences: AudienceRow[]): string {
  return audiences
    .map(
      (a) =>
        `- ${a.name} [${AUDIENCE_TYPE_LABELS[a.type]}] | chi ${money(
          a.metrics.spend,
        )} | ROAS ${roasFmt(a.metrics.roas)} | CTR ${pct(a.metrics.ctr)} | ${
          a.metrics.conversions
        } chuyển đổi`,
    )
    .join("\n");
}

export async function generateAudienceIdeas(
  audiences: AudienceRow[],
): Promise<AudienceIdeaResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ...heuristicAudienceIdeas(audiences),
      source: "heuristic",
      note: "Đặt ANTHROPIC_API_KEY để nhận gợi ý từ Claude. Đang hiển thị gợi ý theo quy tắc.",
    };
  }
  try {
    const client = new Anthropic();
    const system = `Bạn là chuyên gia nhắm chọn đối tượng quảng cáo Meta (Facebook) cho nhà quảng cáo Việt Nam.
Dựa trên các tệp đối tượng hiện có và hiệu suất của chúng, hãy đề xuất các tệp đối tượng MỚI đáng thử nghiệm.

QUAN TRỌNG: Viết HOÀN TOÀN BẰNG TIẾNG VIỆT.

Hướng dẫn:
- Ưu tiên các nước đi có đòn bẩy: tạo Lookalike từ tệp hiệu quả nhất, mở rộng theo sở thích liên quan,
  thu hẹp/mở rộng tệp tùy chỉnh (retargeting), thử tệp rộng để Advantage+ tối ưu.
- Mỗi gợi ý nêu rõ lý do dựa trên dữ liệu (dẫn tên tệp/chỉ số khi hợp lý).
- type ∈ lookalike | custom | interest | broad | saved. size ∈ hẹp | vừa | rộng.
- Trả về 4-6 gợi ý, sắp xếp theo mức tiềm năng giảm dần.`;
    const user = `Các tệp đối tượng hiện tại (tiền tệ VND):\n\n${buildAudienceTable(
      audiences,
    )}\n\nHãy đề xuất các tệp đối tượng mới nên thử.`;

    const params = {
      model: MODEL,
      max_tokens: 3072,
      thinking: { type: "adaptive" },
      system,
      output_config: { format: { type: "json_schema", schema: AUDIENCE_SCHEMA } },
      messages: [{ role: "user", content: user }],
    };
    const response = (await client.messages.create(params as never)) as {
      content: Array<{ type: string; text?: string }>;
    };
    const textBlock = response.content.find(
      (b) => b.type === "text" && typeof b.text === "string",
    );
    if (!textBlock?.text) throw new Error("No text block in response");
    const parsed = JSON.parse(textBlock.text) as { ideas: AudienceIdea[] };
    if (!Array.isArray(parsed.ideas) || parsed.ideas.length === 0) {
      throw new Error("Empty ideas");
    }
    return { ideas: parsed.ideas, source: "claude", model: MODEL };
  } catch (err) {
    return {
      ...heuristicAudienceIdeas(audiences),
      source: "heuristic",
      note: `Gọi Claude thất bại (${
        err instanceof Error ? err.message : "lỗi không xác định"
      }). Đang hiển thị gợi ý theo quy tắc.`,
    };
  }
}

// -----------------------------------------------------------------------------
// AI chấm điểm ảnh creative (Claude vision) — nhìn ảnh quảng cáo và góp ý
// TRƯỚC KHI chạy, thay vì đốt tiền rồi mới biết ảnh yếu.
// -----------------------------------------------------------------------------

/** 6 tiêu chí chấm cố định để UI hiển thị ổn định giữa các lần chấm. */
const SCORE_CRITERIA = [
  "Thông điệp & hook",
  "Lượng chữ trên ảnh",
  "Kêu gọi hành động (CTA)",
  "Màu sắc & độ tương phản",
  "Chất lượng hình ảnh",
  "Phù hợp xem trên điện thoại",
] as const;

const CREATIVE_SCORE_SCHEMA = {
  type: "object",
  properties: {
    totalScore: { type: "integer" },
    verdict: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterion: { type: "string", enum: [...SCORE_CRITERIA] },
          score: { type: "integer" },
          comment: { type: "string" },
        },
        required: ["criterion", "score", "comment"],
        additionalProperties: false,
      },
    },
  },
  required: ["totalScore", "verdict", "strengths", "improvements", "items"],
  additionalProperties: false,
} as const;

export interface CreativeScoreInput {
  /** Ảnh dạng data URL (data:image/…;base64,…). */
  imageData: string;
  headline?: string;
  primaryText?: string;
}

/** Tách media type + chuỗi base64 thuần từ data URL. */
function splitDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const m = /^data:(image\/(?:png|jpeg|gif|webp));base64,(.+)$/s.exec(dataUrl);
  if (m) return { mediaType: m[1], data: m[2] };
  // Không phải data URL chuẩn — coi như base64 thuần của ảnh JPEG.
  const comma = dataUrl.indexOf(",");
  return {
    mediaType: "image/jpeg",
    data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
  };
}

export async function scoreCreativeImage(
  input: CreativeScoreInput,
): Promise<CreativeScoreResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ...manualChecklist(),
      source: "heuristic",
      note: "Đặt ANTHROPIC_API_KEY để Claude phân tích ảnh. Đang hiển thị danh sách tự kiểm tra.",
    };
  }
  try {
    const client = new Anthropic();
    const system = `Bạn là giám đốc sáng tạo (creative director) kỳ cựu chuyên quảng cáo Meta (Facebook/Instagram) cho thị trường Việt Nam.
Bạn nhận được MỘT ảnh quảng cáo và (nếu có) tiêu đề + nội dung chính đi kèm. Hãy chấm điểm ảnh này TRƯỚC KHI nhà quảng cáo chi tiền chạy.

QUAN TRỌNG: Viết HOÀN TOÀN BẰNG TIẾNG VIỆT, thẳng thắn và cụ thể — chỉ ra đúng chỗ cần sửa, không khen xã giao.

Chấm theo đúng 6 tiêu chí sau, mỗi tiêu chí 0-10 điểm (một mục cho mỗi tiêu chí, không thêm bớt):
${SCORE_CRITERIA.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Lưu ý chuyên môn:
- Ảnh nhiều chữ (>20% diện tích) thường bị Meta giảm phân phối — trừ điểm mạnh ở tiêu chí 2.
- Hook phải "dừng tay lướt" trong 1-2 giây đầu trên màn hình điện thoại nhỏ.
- Nếu có tiêu đề/nội dung đi kèm, đánh giá độ KHỚP giữa ảnh và lời (ảnh một đằng chữ một nẻo là lỗi nặng).
- totalScore = tổng thể 0-100 (không nhất thiết là trung bình cộng — cân theo mức ảnh hưởng).
- strengths: 2-4 điểm mạnh. improvements: 2-5 chỉnh sửa CỤ THỂ có thể làm ngay (vd "tăng cỡ chữ giá lên gấp đôi", không nói chung chung "cải thiện thiết kế").`;

    const { mediaType, data } = splitDataUrl(input.imageData);
    const context =
      [
        input.headline ? `Tiêu đề đi kèm: ${input.headline}` : "",
        input.primaryText ? `Nội dung chính đi kèm: ${input.primaryText}` : "",
      ]
        .filter(Boolean)
        .join("\n") || "(Không có tiêu đề/nội dung đi kèm — chỉ chấm ảnh.)";

    const params = {
      model: MODEL,
      max_tokens: 3072,
      thinking: { type: "adaptive" },
      system,
      output_config: {
        format: { type: "json_schema", schema: CREATIVE_SCORE_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data },
            },
            {
              type: "text",
              text: `${context}\n\nHãy chấm điểm ảnh quảng cáo này theo 6 tiêu chí.`,
            },
          ],
        },
      ],
    };
    const response = (await client.messages.create(params as never)) as {
      content: Array<{ type: string; text?: string }>;
    };
    const textBlock = response.content.find(
      (b) => b.type === "text" && typeof b.text === "string",
    );
    if (!textBlock?.text) throw new Error("No text block in response");
    const parsed = JSON.parse(textBlock.text) as {
      totalScore: number;
      verdict: string;
      strengths: string[];
      improvements: string[];
      items: CreativeScoreItem[];
    };
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new Error("Empty score items");
    }
    return {
      totalScore: Math.max(0, Math.min(100, Math.round(parsed.totalScore))),
      verdict: parsed.verdict,
      strengths: parsed.strengths ?? [],
      improvements: parsed.improvements ?? [],
      items: parsed.items.map((i) => ({
        ...i,
        score: Math.max(0, Math.min(10, Math.round(i.score))),
      })),
      source: "claude",
      model: MODEL,
    };
  } catch (err) {
    return {
      ...manualChecklist(),
      source: "heuristic",
      note: `Gọi Claude thất bại (${
        err instanceof Error ? err.message : "lỗi không xác định"
      }). Đang hiển thị danh sách tự kiểm tra.`,
    };
  }
}

/** Khi không phân tích được ảnh: trả checklist tự kiểm tra thay vì điểm bịa. */
function manualChecklist(): Omit<CreativeScoreResult, "source"> {
  return {
    totalScore: 0,
    verdict:
      "Chưa phân tích được ảnh bằng AI — hãy tự rà theo danh sách dưới đây trước khi chạy.",
    strengths: [],
    improvements: [
      "Hook 1-2 giây đầu: nhìn ảnh thu nhỏ trên điện thoại, có muốn dừng tay lướt không?",
      "Chữ trên ảnh dưới ~20% diện tích — nhiều chữ bị Meta giảm phân phối.",
      "Có CTA rõ ràng (Mua ngay / Nhắn tin / Đăng ký) và giá/ưu đãi nổi bật.",
      "Màu chủ thể tương phản mạnh với nền — không chìm khi lướt nhanh.",
      "Ảnh sắc nét, không vỡ khi hiển thị trên màn hình nhỏ; chủ thể chiếm phần lớn khung.",
      "Ảnh và tiêu đề/nội dung phải khớp nhau — ảnh một đằng chữ một nẻo làm giảm chuyển đổi.",
    ],
    items: [],
  };
}

function heuristicAudienceIdeas(
  audiences: AudienceRow[],
): { ideas: AudienceIdea[] } {
  const ideas: AudienceIdea[] = [];
  const spending = audiences.filter((a) => a.metrics.spend > 0);
  const best = [...spending].sort((a, b) => b.metrics.roas - a.metrics.roas)[0];

  if (best) {
    ideas.push({
      name: `Lookalike 1% từ khách của "${best.name}"`,
      type: "lookalike",
      size: "hẹp",
      rationale: `"${best.name}" đang hiệu quả nhất (ROAS ${roasFmt(
        best.metrics.roas,
      )}). Tạo Lookalike 1% từ người chuyển đổi của tệp này để tìm khách tương tự.`,
    });
    ideas.push({
      name: `Lookalike 3-5% từ khách của "${best.name}"`,
      type: "lookalike",
      size: "rộng",
      rationale:
        "Mở rộng quy mô tìm khách: Lookalike 3-5% giữ được sự tương đồng nhưng tiếp cận rộng hơn để tăng tốc.",
    });
  }

  const hasInterest = audiences.some((a) => a.type === "interest");
  ideas.push({
    name: hasInterest
      ? "Mở rộng sở thích liên quan (chồng lấn 2-3 sở thích)"
      : "Nhắm theo sở thích cốt lõi của ngành hàng",
    type: "interest",
    size: "vừa",
    rationale:
      "Thử nhóm sở thích liên quan để mở rộng đầu phễu ngoài các tệp hiện có; chồng lấn 2-3 sở thích giúp lọc đúng người quan tâm.",
  });

  ideas.push({
    name: "Retargeting 7 ngày: đã xem sản phẩm nhưng chưa mua",
    type: "custom",
    size: "hẹp",
    rationale:
      "Tệp tùy chỉnh có ý định cao thường cho ROAS tốt nhất — nhắm lại người vừa xem sản phẩm trong 7 ngày để chốt đơn.",
  });

  ideas.push({
    name: "Tệp rộng (để Advantage+ tự tối ưu)",
    type: "broad",
    size: "rộng",
    rationale:
      "Để thuật toán Meta tự tìm khách với tệp rộng + tín hiệu pixel tốt — thường hiệu quả khi đã đủ dữ liệu chuyển đổi.",
  });

  const loser = [...spending].sort((a, b) => a.metrics.roas - b.metrics.roas)[0];
  if (loser && loser.metrics.roas < 1) {
    ideas.push({
      name: `Thay thế/loại trừ "${loser.name}"`,
      type: "custom",
      size: "vừa",
      rationale: `"${loser.name}" đang lỗ (ROAS ${roasFmt(
        loser.metrics.roas,
      )}). Cân nhắc loại trừ tệp này khỏi các nhóm khác và thử tệp mới thay thế.`,
    });
  }

  return { ideas: ideas.slice(0, 6) };
}
