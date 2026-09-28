import { z } from "zod";
import { setMonthlyCap } from "../src/infrai_account.js";

const amount = z.coerce.number().positive().parse(process.argv[2]);
const alertThreshold = z.coerce.number().positive().optional().parse(process.argv[3]);
const result = await setMonthlyCap({
  hard_cap_usd: amount,
  period: "monthly",
  ...(alertThreshold === undefined ? {} : { alert_threshold_usd: alertThreshold })
});

console.log(JSON.stringify(result, null, 2));
