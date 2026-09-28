import { createServer, type ServerResponse } from "node:http";
import { z, ZodError } from "zod";
import { getMonthlyCap, InfraiError, setMonthlyCap } from "./infrai_account.js";
import { draftPropertyBrief } from "./property_brief.js";
import { decideWorkload, workloadSchema } from "./workload_decision.js";

const capSchema = z.object({
  hard_cap_usd: z.number().positive(),
  alert_threshold_usd: z.number().positive().optional()
}).refine(
  (value) => value.alert_threshold_usd === undefined || value.alert_threshold_usd < value.hard_cap_usd,
  { message: "alert_threshold_usd must be below hard_cap_usd" }
);

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 64_000) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function upstreamStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && status >= 400 && status < 500 ? status : undefined;
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "PUT" && request.url === "/control/monthly-cap") {
      const input = capSchema.parse(await readJson(request));
      const budget = await setMonthlyCap({ ...input, period: "monthly" });
      json(response, 200, { budget });
      return;
    }

    if (request.method === "GET" && request.url === "/control/monthly-cap") {
      json(response, 200, { budget: await getMonthlyCap() });
      return;
    }

    if (request.method === "POST" && request.url === "/workloads/prepare") {
      const item = workloadSchema.parse(await readJson(request));
      const today = new Date().toISOString().slice(0, 10);
      const decision = decideWorkload(item, today);
      const brief = await draftPropertyBrief(item, decision);
      json(response, 200, { propertyId: item.propertyId, decision, brief });
      return;
    }

    json(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "Invalid request body" });
    } else if (error instanceof InfraiError) {
      json(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
        message: error.message
      });
    } else if (upstreamStatus(error)) {
      json(response, upstreamStatus(error)!, { error: "Workload request was rejected" });
    } else {
      console.error(error);
      json(response, 502, { error: "Upstream request could not be completed" });
    }
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Property operations listening on http://localhost:${port}`));
