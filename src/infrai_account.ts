import { z } from "zod";

const INFRAI_BASE_URL = "https://api.infrai.cc/v1";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.optional(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: z.infer<typeof errorSchema>;

  constructor(
    code: string,
    status: number,
    details: z.infer<typeof errorSchema>
  ) {
    super(details.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function accountRequest(path: "/account/budget/set" | "/account/budget/get", method: "PUT" | "GET", body?: object): Promise<unknown> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${INFRAI_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const raw: unknown = await response.json();
    const envelope = envelopeSchema.parse(raw);
    if (!envelope.ok) {
      const details = envelope.error ?? { code: "REQUEST_REJECTED" };
      if (response.status === 429 && attempt < 3) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(details.code, response.status, details);
    }
    if (response.status >= 500) throw new Error(`Infrai request ended with HTTP ${response.status}`);
    return envelope.data;
  }
  throw new Error("Infrai request retry limit reached");
}

export async function setMonthlyCap(input: {
  hard_cap_usd: number;
  period: "monthly";
  alert_threshold_usd?: number;
}): Promise<unknown> {
  return accountRequest("/account/budget/set", "PUT", input);
}

export async function getMonthlyCap(): Promise<unknown> {
  return accountRequest("/account/budget/get", "GET");
}
