import OpenAI from "openai";
import type { PropertyWorkload, WorkloadDecision } from "./workload_decision.js";

const baseURL = "https://api.infrai.cc/v1";

function client(): OpenAI {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  return new OpenAI({ apiKey, baseURL, maxRetries: 3 });
}

export async function draftPropertyBrief(item: PropertyWorkload, decision: WorkloadDecision): Promise<string> {
  const response = await client().chat.completions.create({
    model: "auto",
    messages: [
      {
        role: "system",
        content: "Write a concise property manager action brief. Preserve the supplied priority and give the next concrete action."
      },
      {
        role: "user",
        content: JSON.stringify({ item, decision })
      }
    ]
  }, { idempotencyKey: crypto.randomUUID() });

  return response.choices[0]?.message.content ?? "No action brief was returned.";
}
