import { z } from "zod";

/**
 * Segment rules are stored as JSON on the segments table and compiled to SQL
 * by src/lib/segments/compile.ts. Every rule type here must be handled there.
 */

const negatable = { negate: z.boolean().optional() };

export const ruleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("visited_season"), season_year: z.number().int(), ...negatable }),
  z.object({ type: z.literal("booked_season"), season_year: z.number().int(), ...negatable }),
  z.object({ type: z.literal("booked_ticket_type"), ticket_type: z.enum(["standard", "fast_track", "vip", "group"]), ...negatable }),
  z.object({ type: z.literal("visited_maze"), maze_slug: z.string().min(1), ...negatable }),
  z.object({ type: z.literal("chickened_out"), maze_slug: z.string().min(1), ...negatable }),
  z.object({ type: z.literal("lifetime_spend"), op: z.enum(["gt", "lt"]), pence: z.number().int().min(0) }),
  z.object({ type: z.literal("visit_count"), op: z.enum(["gt", "lt", "eq"]), value: z.number().int().min(0) }),
  z.object({ type: z.literal("postcode_starts"), value: z.string().min(1).max(4), ...negatable }),
  z.object({ type: z.literal("email_consent"), value: z.boolean() }),
  z.object({ type: z.literal("sms_consent"), value: z.boolean() }),
  z.object({ type: z.literal("has_tag"), tag: z.string().min(1), ...negatable }),
  z.object({ type: z.literal("survey_score"), op: z.enum(["gt", "lt"]), value: z.number().int().min(1).max(10) }),
  z.object({ type: z.literal("last_visit_days"), op: z.enum(["within", "older_than"]), days: z.number().int().min(1) }),
  z.object({ type: z.literal("bought_addon"), addon: z.enum(["photo_pack", "merch_bundle", "food_voucher"]), ...negatable }),
]);

export type Rule = z.infer<typeof ruleSchema>;
export type RuleType = Rule["type"];

export interface RuleGroup {
  op: "and" | "or";
  rules: Array<Rule | RuleGroup>;
}

export const ruleGroupSchema: z.ZodType<RuleGroup> = z.lazy(() =>
  z.object({
    op: z.enum(["and", "or"]),
    rules: z.array(z.union([ruleSchema, ruleGroupSchema])).max(50),
  }),
);

export function isGroup(node: Rule | RuleGroup): node is RuleGroup {
  return "op" in node && Array.isArray((node as RuleGroup).rules);
}

export const EMPTY_GROUP: RuleGroup = { op: "and", rules: [] };

export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  visited_season: "Visited in season",
  booked_season: "Booked in season",
  booked_ticket_type: "Booked ticket type",
  visited_maze: "Visited maze",
  chickened_out: "Chickened out of maze",
  lifetime_spend: "Lifetime spend",
  visit_count: "Number of visits",
  postcode_starts: "Postcode starts with",
  email_consent: "Email consent",
  sms_consent: "SMS consent",
  has_tag: "Has tag",
  survey_score: "Survey score",
  last_visit_days: "Last visit",
  bought_addon: "Bought add-on",
};
