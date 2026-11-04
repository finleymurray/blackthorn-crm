import type { Db } from "@/lib/db/client";
import type { StaffUser } from "@/lib/auth/types";

export interface ActivityInput {
  action: string;
  entityType: "guest" | "booking" | "ticket" | "campaign" | "segment" | "automation" | "staff" | "settings" | "saved_reply";
  entityId: string;
  summary: string;
  details?: Record<string, unknown>;
}

/** Append to the audit trail. Every staff mutation goes through here. */
export async function logActivity(db: Db, staff: StaffUser, input: ActivityInput): Promise<void> {
  await db`
    insert into crm.activity_log (staff_id, staff_name, action, entity_type, entity_id, summary, details)
    values (${staff.id}, ${staff.name}, ${input.action}, ${input.entityType}, ${input.entityId}, ${input.summary}, ${db.json((input.details ?? {}) as never)})`;
}

export interface ActivityRow {
  id: number;
  staff_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  details: Record<string, unknown>;
  created_at: Date;
}

export async function listActivity(db: Db, entityType: string, entityId: string, limit = 50): Promise<ActivityRow[]> {
  return db<ActivityRow[]>`
    select id, staff_name, action, entity_type, entity_id, summary, details, created_at
    from crm.activity_log
    where entity_type = ${entityType} and entity_id = ${entityId}
    order by created_at desc limit ${limit}`;
}
