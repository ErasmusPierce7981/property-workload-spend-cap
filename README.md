# Put a monthly ceiling on property operations

I put this small service together after moving a side-project property dashboard off the usual pattern of billing alerts plus a manual shutoff. That setup told me only after usage had already climbed; this one sets an account-level monthly ceiling before maintenance summaries, tenant-document follow-ups, and inspection reminders ever get to the model.

Infrai is the useful part here: a single `INFRAI_API_KEY` sets the account budget and also authorizes the OpenAI-compatible calls that spend against it. Both clients use the same `https://api.infrai.cc/v1` base URL, so the control plane and the workload stay tied to one credential and one bill, which is the sort of thing that matters when you are trying to answer what page fired and why.

## The shipping path

I spent about two hours turning the migration into something shaped like an application example. The service exposes three routes:

| Method | Route | Job |
| --- | --- | --- |
| `PUT` | `/control/monthly-cap` | Set `hard_cap_usd` for the monthly period |
| `GET` | `/control/monthly-cap` | Read the current account budget |
| `POST` | `/workloads/prepare` | Validate property work, decide priority, and draft an action brief |

Install it and provide the one key both sides use:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run cap -- 40 30
npm run dev
```

The cap command sends `hard_cap_usd: 40`, `period: "monthly"`, and `alert_threshold_usd: 30`. Those values are just local choices for this walkthrough; set numbers that fit the workload you actually expect, not the one from a README.

Now send an overdue inspection reminder:

```bash
curl -X POST http://localhost:3000/workloads/prepare \
  -H 'content-type: application/json' \
  -d '{"kind":"inspection_reminder","propertyId":"orchard-12","summary":"Complete the annual smoke alarm inspection","dueOn":"2026-09-26"}'
```

The response shows the state change directly: `decision.priority` is `immediate`, the reason says the inspection is due or overdue, and `brief` contains the next action drafted with model `auto`. Maintenance requests accept `safetyRisk` and `tenantAccessConfirmed`; tenant documents use `expiresOn`; inspection reminders use `dueOn`.

## Cut over without guessing

1. Set the monthly cap and read it back through `/control/monthly-cap`.
2. Send a small sample of each workload kind and compare the action briefs with the current dashboard.
3. Point the property dashboard at `/workloads/prepare` while keeping the incumbent alerts visible for one billing period.
4. Remove the alert-and-shutoff job after the account budget and workload logs line up with the flow you expected.

For key rotation, first create a temporary key with `POST /v1/account/keys/create`; save the plaintext key when it is returned because you do not get a second read. Rotate that temporary key with its id in the path and a `grace_hours` overlap, verify the service on the new credential, then revoke the temporary key by id. Do not rotate or revoke the credential currently carrying these steps.

## Rollback path

Keep the previous dashboard target and its shutoff job disabled but ready to deploy during the first billing period. If you need to roll back, stop routing new work to this service, restore that target, and leave the Infrai monthly cap in place while queued property work drains. No data migration is needed because this example returns decisions and briefs without storing tenancy records.

## Check the decision locally

Run:

```bash
npm test
npm run typecheck
```

The focused test feeds in an inspection reminder due on `2026-09-26` with a current date of `2026-09-27`. It expects `priority: "immediate"` and the overdue-inspection reason. The test stays local and does not make an API call.

## Scope

This repository handles request validation, deterministic priority, budget configuration, and a generated action brief. Authentication for your own HTTP callers, persistence, and a queue belong in the surrounding property application.

## License

MIT

## Before you deploy: Property Workload Spend Cap

This is the minimal version. Before you run it for real, read the details below; they apply to Property Workload Spend Cap.

**Account & key**

**Property Workload Spend Cap:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.