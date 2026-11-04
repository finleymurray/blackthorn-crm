"use client";

import * as React from "react";
import { Plus, Trash2, CornerDownRight } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isGroup, RULE_TYPE_LABELS, type Rule, type RuleGroup, type RuleType } from "@/lib/segments/types";
import { TICKET_TYPE_LABELS, ADDONS } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

export interface Lookups {
  seasons: number[];
  tags: string[];
}

const RULE_ORDER: RuleType[] = [
  "visited_season",
  "booked_season",
  "booked_ticket_type",
  "bought_addon",
  "visit_count",
  "lifetime_spend",
  "last_visit_days",
  "survey_score",
  "postcode_starts",
  "has_tag",
  "email_consent",
  "sms_consent",
];

export function defaultRule(type: RuleType, lookups: Lookups): Rule {
  const season = lookups.seasons[0] ?? new Date().getFullYear();
  switch (type) {
    case "visited_season":
      return { type, season_year: season };
    case "booked_season":
      return { type, season_year: season };
    case "booked_ticket_type":
      return { type, ticket_type: "fast_track" };
    case "bought_addon":
      return { type, addon: "photo_pack" };
    case "visit_count":
      return { type, op: "gt", value: 1 };
    case "lifetime_spend":
      return { type, op: "gt", pence: 10000 };
    case "last_visit_days":
      return { type, op: "within", days: 365 };
    case "survey_score":
      return { type, op: "gt", value: 7 };
    case "postcode_starts":
      return { type, value: "NG" };
    case "has_tag":
      return { type, tag: lookups.tags[0] ?? "superfan" };
    case "email_consent":
      return { type, value: true };
    case "sms_consent":
      return { type, value: true };
  }
}

const selectClass = "h-7 w-auto min-w-[6rem] text-xs";
const inputClass = "h-7 w-24 text-xs";

function NegateSelect({ value, onChange, yes, no }: { value: boolean; onChange: (v: boolean) => void; yes: string; no: string }) {
  return (
    <Select aria-label="Condition" value={value ? "not" : "is"} onChange={(e) => onChange(e.target.value === "not")} className={selectClass}>
      <option value="is">{yes}</option>
      <option value="not">{no}</option>
    </Select>
  );
}

function RuleFields({ rule, onChange, lookups }: { rule: Rule; onChange: (r: Rule) => void; lookups: Lookups }) {
  switch (rule.type) {
    case "visited_season":
    case "booked_season":
      return (
        <>
          <NegateSelect value={!!rule.negate} onChange={(negate) => onChange({ ...rule, negate })} yes={rule.type === "visited_season" ? "visited in" : "booked in"} no={rule.type === "visited_season" ? "did not visit in" : "did not book in"} />
          <Select aria-label="Season" value={rule.season_year} onChange={(e) => onChange({ ...rule, season_year: Number(e.target.value) })} className={selectClass}>
            {lookups.seasons.map((y) => (
              <option key={y} value={y}>
                Season {y}
              </option>
            ))}
          </Select>
        </>
      );
    case "booked_ticket_type":
      return (
        <>
          <NegateSelect value={!!rule.negate} onChange={(negate) => onChange({ ...rule, negate })} yes="has booked" no="has never booked" />
          <Select aria-label="Ticket type" value={rule.ticket_type} onChange={(e) => onChange({ ...rule, ticket_type: e.target.value as Rule extends { ticket_type: infer T } ? T : never })} className={selectClass}>
            {Object.entries(TICKET_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </>
      );
    case "bought_addon":
      return (
        <>
          <NegateSelect value={!!rule.negate} onChange={(negate) => onChange({ ...rule, negate })} yes="has bought" no="has never bought" />
          <Select aria-label="Add-on" value={rule.addon} onChange={(e) => onChange({ ...rule, addon: e.target.value as typeof rule.addon })} className={selectClass}>
            {ADDONS.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name}
              </option>
            ))}
          </Select>
        </>
      );
    case "visit_count":
      return (
        <>
          <Select aria-label="Comparison" value={rule.op} onChange={(e) => onChange({ ...rule, op: e.target.value as typeof rule.op })} className={selectClass}>
            <option value="gt">more than</option>
            <option value="lt">fewer than</option>
            <option value="eq">exactly</option>
          </Select>
          <Input aria-label="Visits" type="number" min={0} max={999} value={rule.value} onChange={(e) => onChange({ ...rule, value: Math.max(0, Number(e.target.value) || 0) })} className={inputClass} />
          <span className="text-xs text-muted">visits</span>
        </>
      );
    case "lifetime_spend":
      return (
        <>
          <Select aria-label="Comparison" value={rule.op} onChange={(e) => onChange({ ...rule, op: e.target.value as typeof rule.op })} className={selectClass}>
            <option value="gt">over</option>
            <option value="lt">under</option>
          </Select>
          <span className="text-xs text-muted">£</span>
          <Input aria-label="Amount in pounds" type="number" min={0} step={1} value={Math.round(rule.pence / 100)} onChange={(e) => onChange({ ...rule, pence: Math.max(0, Math.round(Number(e.target.value) || 0) * 100) })} className={inputClass} />
        </>
      );
    case "last_visit_days":
      return (
        <>
          <Select aria-label="Comparison" value={rule.op} onChange={(e) => onChange({ ...rule, op: e.target.value as typeof rule.op })} className={selectClass}>
            <option value="within">within the last</option>
            <option value="older_than">more than</option>
          </Select>
          <Input aria-label="Days" type="number" min={1} max={3650} value={rule.days} onChange={(e) => onChange({ ...rule, days: Math.max(1, Number(e.target.value) || 1) })} className={inputClass} />
          <span className="text-xs text-muted">days{rule.op === "older_than" ? " ago" : ""}</span>
        </>
      );
    case "survey_score":
      return (
        <>
          <Select aria-label="Comparison" value={rule.op} onChange={(e) => onChange({ ...rule, op: e.target.value as typeof rule.op })} className={selectClass}>
            <option value="gt">above</option>
            <option value="lt">below</option>
          </Select>
          <Input aria-label="Score" type="number" min={1} max={10} value={rule.value} onChange={(e) => onChange({ ...rule, value: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} className={inputClass} />
          <span className="text-xs text-muted">out of 10 (any survey)</span>
        </>
      );
    case "postcode_starts":
      return (
        <>
          <NegateSelect value={!!rule.negate} onChange={(negate) => onChange({ ...rule, negate })} yes="starts with" no="does not start with" />
          <Input aria-label="Postcode prefix" value={rule.value} maxLength={4} onChange={(e) => onChange({ ...rule, value: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) })} className={cn(inputClass, "w-20 uppercase")} placeholder="NG" />
        </>
      );
    case "has_tag":
      return (
        <>
          <NegateSelect value={!!rule.negate} onChange={(negate) => onChange({ ...rule, negate })} yes="is tagged" no="is not tagged" />
          {lookups.tags.length > 0 ? (
            <Select aria-label="Tag" value={rule.tag} onChange={(e) => onChange({ ...rule, tag: e.target.value })} className={selectClass}>
              {!lookups.tags.includes(rule.tag) ? <option value={rule.tag}>{rule.tag}</option> : null}
              {lookups.tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          ) : (
            <Input aria-label="Tag" value={rule.tag} onChange={(e) => onChange({ ...rule, tag: e.target.value })} className={inputClass} />
          )}
        </>
      );
    case "email_consent":
    case "sms_consent":
      return (
        <Select aria-label="Consent" value={rule.value ? "yes" : "no"} onChange={(e) => onChange({ ...rule, value: e.target.value === "yes" })} className={selectClass}>
          <option value="yes">given</option>
          <option value="no">not given</option>
        </Select>
      );
  }
}

function RuleRow({ rule, onChange, onRemove, lookups, readOnly }: { rule: Rule; onChange: (r: Rule) => void; onRemove: () => void; lookups: Lookups; readOnly?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select
        aria-label="Rule type"
        value={rule.type}
        onChange={(e) => onChange(defaultRule(e.target.value as RuleType, lookups))}
        className={cn(selectClass, "font-medium text-foreground")}
        disabled={readOnly}
      >
        {RULE_ORDER.map((t) => (
          <option key={t} value={t}>
            {RULE_TYPE_LABELS[t]}
          </option>
        ))}
      </Select>
      <fieldset disabled={readOnly} className="contents">
        <RuleFields rule={rule} onChange={onChange} lookups={lookups} />
      </fieldset>
      {!readOnly ? (
        <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove rule" className="ml-auto text-muted">
          <Trash2 />
        </Button>
      ) : null}
    </div>
  );
}

export function GroupEditor({
  group,
  onChange,
  lookups,
  depth = 0,
  readOnly,
}: {
  group: RuleGroup;
  onChange: (g: RuleGroup) => void;
  lookups: Lookups;
  depth?: number;
  readOnly?: boolean;
}) {
  const update = (index: number, node: Rule | RuleGroup) => onChange({ ...group, rules: group.rules.map((r, i) => (i === index ? node : r)) });
  const remove = (index: number) => onChange({ ...group, rules: group.rules.filter((_, i) => i !== index) });
  const add = () => onChange({ ...group, rules: [...group.rules, defaultRule("visited_season", lookups)] });
  const addGroup = () => onChange({ ...group, rules: [...group.rules, { op: group.op === "and" ? "or" : "and", rules: [defaultRule("email_consent", lookups)] }] });

  return (
    <div className={cn("space-y-2", depth > 0 && "rounded-md border border-border bg-black/10 p-3")}>
      {group.rules.length === 0 ? <p className="text-xs text-muted">No rules yet: this matches every guest.</p> : null}
      {group.rules.map((node, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="w-12 shrink-0 pt-1.5 text-right">
            {i === 0 ? (
              <span className="text-[11px] text-muted">{depth > 0 ? <CornerDownRight className="ml-auto size-3" aria-hidden /> : "Where"}</span>
            ) : i === 1 && !readOnly ? (
              <Select aria-label="Combine rules with" value={group.op} onChange={(e) => onChange({ ...group, op: e.target.value as "and" | "or" })} className="h-7 w-14 min-w-0 px-1.5 text-[11px] font-medium">
                <option value="and">AND</option>
                <option value="or">OR</option>
              </Select>
            ) : (
              <span className="text-[11px] font-medium text-muted-strong">{group.op.toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {isGroup(node) ? (
              <GroupEditor group={node} onChange={(g) => update(i, g)} lookups={lookups} depth={depth + 1} readOnly={readOnly} />
            ) : (
              <RuleRow rule={node} onChange={(r) => update(i, r)} onRemove={() => remove(i)} lookups={lookups} readOnly={readOnly} />
            )}
          </div>
          {isGroup(node) && !readOnly ? (
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(i)} aria-label="Remove group" className="text-muted">
              <Trash2 />
            </Button>
          ) : null}
        </div>
      ))}
      {!readOnly ? (
        <div className="flex gap-1 pl-14">
          <Button type="button" variant="ghost" size="sm" onClick={add}>
            <Plus /> Add rule
          </Button>
          {depth === 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={addGroup}>
              <Plus /> Add group
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
