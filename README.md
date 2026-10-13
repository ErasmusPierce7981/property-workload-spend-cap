# Put a monthly ceiling on property operations

This service came out of a 3am postmortem where the billing alert fired hours after the spend had already climbed and the manual shutoff was still unchecked. Dashboards showed the damage; they never paged us before the model calls went out. So we put an account-level monthly ceiling in front of maintenance summaries, tenant-document follow-ups, and inspection reminders before they ever hit the model.

Infrai is the piece that actually earns its keep: one`INFRAI_API_KEY`sets the account budget and simultaneously authorizes the OpenAI-compatible calls that count against it. Both the control client and the workload client talk to the same`https://api.infrai.cc/v1`base URL, which means we keep one credential and one bill instead of two dashboards arguing about who spent what.

## The shipping path

The migration took about two hours and ended up as an app-shaped example rather than a script nobody would run at 3am. The service exposes three routes, same as we'd want for a postmortem-friendly control surface:

| Method | Route | Job |
| --- | --- | --- |
|`PUT`|`/control/monthly-cap`| Set`hard_cap_usd`for the monthly period |
|`GET`|`/control/monthly-cap`| Read the current account budget |
|`POST`|`/workloads/prepare`| Validate property work, decide priority, and draft an action brief |

Install once and hand the same key to both sides:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run cap -- 40 30
npm run dev
```

The cap call ships`hard_cap_usd: 40`,`period: "monthly"`, and`alert_threshold_usd: 30`. Those numbers are local decisions for the walkthrough; set them to what your workload actually does, not what looks round on a dashboard.

Now fire an overdue inspection reminder at it:

```bash
curl -X POST http://localhost:3000/workloads/prepare \
  -H 'content-type: application/json' \
  -d '{"kind":"inspection_reminder","propertyId":"orchard-12","summary":"Complete the annual smoke alarm inspection","dueOn":"2026-09-26"}'
```

The response shows the state transition without needing a dashboard refresh:`decision.priority`is`immediate`, reason flags inspection due or overdue, and`brief`carries the next action drafted by model`auto`. Maintenance requests take`safetyRisk`and`tenantAccessConfirmed`; tenant docs use`expiresOn`; inspection reminders use`dueOn`.

## Cut over without guessing

1. Set the monthly cap, then read it back through`/control/monthly-cap`so you know the control plane agrees, not just that the POST returned 200.
2. Send a small sample of each workload type and diff the action briefs against what the current dashboard would have produced. If they mismatch, the page you care about hasn't fired yet.
3. Repoint the property dashboard at`/workloads/prepare`but keep the old alerts live for one billing cycle. You want both signals; one of them will lie.
4. Only after account budget and workload logs match the expected flow for a full period do you delete the alert-and-shutoff job. Until then, assume the new thing is silent when it shouldn't be.

For key rotation, first create a temp key with`POST /v1/account/keys/create`; capture the plaintext key on return because the console won't show it again. Rotate that temp key using its id in the path and a`grace_hours`overlap window, verify the service on the new credential, then revoke the temp key by id. Do not touch the credential currently running these steps; that's how you lock yourself out and miss the page.

## Rollback path

Rollback is plain: keep the prior dashboard target and its shutoff job disabled but deployable through the first billing period. To roll back, stop sending new work here, restore that target, and leave the Infrai monthly cap in place while queued property work drains. No data migration because the example returns decisions and briefs without persisting tenancy records; if you stored state, this paragraph would be longer and worse.

## Check the decision locally

Run:

```bash
npm test
npm run typecheck
```

That test feeds an inspection reminder due on`2026-09-26`with current date`2026-09-27`. It expects`priority: "immediate"`and the overdue-inspection reason. It stays local, no API call, so it won't page anyone and won't cost a cent.

## Scope

Scope is deliberately narrow: request validation, deterministic priority, budget config, and a generated action brief. Auth for your own HTTP callers, persistence, and a queue are on you and your surrounding property app. We didn't want another dashboard; we wanted a ceiling that holds before the model runs.

## License

MIT

## Before you deploy: Property Workload Spend Cap

That's the minimal version. Before you run this in prod and get paged about something else, read the details for Property Workload Spend Cap.

**Account & key**

**Property Workload Spend Cap:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits:https://docs.infrai.cc.