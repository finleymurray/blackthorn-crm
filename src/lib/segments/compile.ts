import { isGroup, ruleGroupSchema, type Rule, type RuleGroup } from "./types";

/**
 * Compiles a segment rule tree into a parameterised SQL WHERE clause over
 * the guests table (aliased `g`). Values are never interpolated into the
 * SQL text; they are returned as positional parameters.
 *
 * The result is pure data so it can be unit tested without a database and
 * executed with postgres.js `unsafe(text, params)`.
 */
export interface CompiledSegment {
  where: string;
  params: unknown[];
}

class ParamList {
  readonly values: unknown[] = [];
  add(v: unknown): string {
    this.values.push(v);
    return `$${this.values.length}`;
  }
}

const OPS = { gt: ">", lt: "<", eq: "=" } as const;

/** Bookings that count as "attended": past night, not refunded or a no show. */
const ATTENDED = "b.status in ('confirmed', 'transferred') and n.date <= current_date";

function compileRule(rule: Rule, p: ParamList): string {
  let sql: string;
  let negate = false;
  switch (rule.type) {
    case "visited_season":
      negate = !!rule.negate;
      sql = `exists (select 1 from crm.bookings b join crm.event_nights n on n.id = b.event_night_id join crm.seasons s on s.id = n.season_id
        where b.guest_id = g.id and s.year = ${p.add(rule.season_year)} and ${ATTENDED})`;
      break;
    case "booked_season":
      negate = !!rule.negate;
      sql = `exists (select 1 from crm.bookings b join crm.event_nights n on n.id = b.event_night_id join crm.seasons s on s.id = n.season_id
        where b.guest_id = g.id and s.year = ${p.add(rule.season_year)} and b.status <> 'refunded')`;
      break;
    case "booked_ticket_type":
      negate = !!rule.negate;
      sql = `exists (select 1 from crm.bookings b where b.guest_id = g.id and b.ticket_type = ${p.add(rule.ticket_type)}::ticket_type and b.status <> 'refunded')`;
      break;
    case "lifetime_spend":
      sql = `g.lifetime_spend_pence ${OPS[rule.op]} ${p.add(rule.pence)}`;
      break;
    case "visit_count":
      sql = `g.visit_count ${OPS[rule.op]} ${p.add(rule.value)}`;
      break;
    case "postcode_starts":
      negate = !!rule.negate;
      sql = `upper(replace(coalesce(g.postcode, ''), ' ', '')) like ${p.add(rule.value.replace(/\s+/g, "").toUpperCase().replace(/[%_]/g, "") + "%")}`;
      break;
    case "email_consent":
      sql = `g.email_consent = ${p.add(rule.value)}`;
      break;
    case "sms_consent":
      sql = `g.sms_consent = ${p.add(rule.value)}`;
      break;
    case "has_tag":
      negate = !!rule.negate;
      sql = `${p.add(rule.tag.toLowerCase())} = any (g.tags)`;
      break;
    case "survey_score":
      sql = `exists (select 1 from crm.surveys sv where sv.guest_id = g.id and sv.overall_score ${OPS[rule.op]} ${p.add(rule.value)})`;
      break;
    case "last_visit_days":
      sql =
        rule.op === "within"
          ? `g.last_visit_on is not null and g.last_visit_on >= current_date - ${p.add(rule.days)}::int`
          : `g.last_visit_on is not null and g.last_visit_on < current_date - ${p.add(rule.days)}::int`;
      break;
    case "bought_addon":
      negate = !!rule.negate;
      sql = `exists (select 1 from crm.bookings b where b.guest_id = g.id and ${p.add(rule.addon)} = any (b.addons) and b.status <> 'refunded')`;
      break;
  }
  return negate ? `not (${sql})` : `(${sql})`;
}

function compileGroup(group: RuleGroup, p: ParamList): string {
  if (group.rules.length === 0) return "true";
  const parts = group.rules.map((r) => (isGroup(r) ? `(${compileGroup(r, p)})` : compileRule(r, p)));
  return parts.join(group.op === "and" ? " and " : " or ");
}

export function compileSegment(input: unknown): CompiledSegment {
  const group = ruleGroupSchema.parse(input);
  const p = new ParamList();
  return { where: compileGroup(group, p), params: p.values };
}

/** Counts rules, including nested ones, for display. */
export function countRules(group: RuleGroup): number {
  return group.rules.reduce((n, r) => n + (isGroup(r) ? countRules(r) : 1), 0);
}

/** Short human readable description of a rule, used in lists and previews. */
export function describeRule(rule: Rule, lookups: { seasons?: number[]; mazes?: Record<string, string> } = {}): string {
  void lookups;
  const not = (s: string) => ((rule as { negate?: boolean }).negate ? `not ${s}` : s);
  switch (rule.type) {
    case "visited_season":
      return not(`visited in ${rule.season_year}`);
    case "booked_season":
      return not(`booked in ${rule.season_year}`);
    case "booked_ticket_type":
      return not(`booked ${rule.ticket_type.replace("_", " ")}`);
    case "lifetime_spend":
      return `lifetime spend ${rule.op === "gt" ? "over" : "under"} £${(rule.pence / 100).toFixed(0)}`;
    case "visit_count":
      return `visits ${rule.op === "gt" ? "more than" : rule.op === "lt" ? "fewer than" : "exactly"} ${rule.value}`;
    case "postcode_starts":
      return not(`postcode starts ${rule.value.toUpperCase()}`);
    case "email_consent":
      return rule.value ? "has email consent" : "no email consent";
    case "sms_consent":
      return rule.value ? "has SMS consent" : "no SMS consent";
    case "has_tag":
      return not(`tagged "${rule.tag}"`);
    case "survey_score":
      return `survey score ${rule.op === "gt" ? "above" : "below"} ${rule.value}`;
    case "last_visit_days":
      return rule.op === "within" ? `visited in the last ${rule.days} days` : `last visit over ${rule.days} days ago`;
    case "bought_addon":
      return not(`bought ${rule.addon.replace("_", " ")}`);
  }
}

export function describeGroup(group: RuleGroup): string {
  if (group.rules.length === 0) return "All guests";
  return group.rules.map((r) => (isGroup(r) ? `(${describeGroup(r)})` : describeRule(r))).join(group.op === "and" ? " AND " : " OR ");
}
