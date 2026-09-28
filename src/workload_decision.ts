import { z } from "zod";

export const workloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("maintenance_request"),
    propertyId: z.string().min(1),
    summary: z.string().min(3).max(500),
    safetyRisk: z.boolean().default(false),
    tenantAccessConfirmed: z.boolean().default(false)
  }),
  z.object({
    kind: z.literal("tenant_document"),
    propertyId: z.string().min(1),
    summary: z.string().min(3).max(500),
    expiresOn: z.string().date()
  }),
  z.object({
    kind: z.literal("inspection_reminder"),
    propertyId: z.string().min(1),
    summary: z.string().min(3).max(500),
    dueOn: z.string().date()
  })
]);

export type PropertyWorkload = z.infer<typeof workloadSchema>;
export type WorkloadPriority = "routine" | "soon" | "immediate";

export interface WorkloadDecision {
  priority: WorkloadPriority;
  reason: string;
}

function daysFrom(date: string, today: string): number {
  return Math.ceil((Date.parse(date) - Date.parse(today)) / 86_400_000);
}

export function decideWorkload(item: PropertyWorkload, today: string): WorkloadDecision {
  if (item.kind === "maintenance_request" && item.safetyRisk) {
    return { priority: "immediate", reason: "The maintenance request reports a safety risk." };
  }

  if (item.kind === "inspection_reminder") {
    const remaining = daysFrom(item.dueOn, today);
    if (remaining <= 0) return { priority: "immediate", reason: "The inspection is due or overdue." };
    if (remaining <= 7) return { priority: "soon", reason: "The inspection is due within seven days." };
  }

  if (item.kind === "tenant_document") {
    const remaining = daysFrom(item.expiresOn, today);
    if (remaining <= 7) return { priority: "immediate", reason: "The tenant document expires within seven days." };
    if (remaining <= 30) return { priority: "soon", reason: "The tenant document expires within thirty days." };
  }

  return { priority: "routine", reason: "The item has no near-term deadline or reported safety risk." };
}
