import assert from "node:assert/strict";
import test from "node:test";
import { decideWorkload, workloadSchema } from "../src/workload_decision.js";

test("an overdue inspection reminder becomes immediate work", () => {
  const reminder = workloadSchema.parse({
    kind: "inspection_reminder",
    propertyId: "orchard-12",
    summary: "Complete the annual smoke alarm inspection",
    dueOn: "2026-09-26"
  });

  assert.deepEqual(decideWorkload(reminder, "2026-09-27"), {
    priority: "immediate",
    reason: "The inspection is due or overdue."
  });
});
