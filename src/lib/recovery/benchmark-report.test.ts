import { describe, expect, it } from "vitest";
import { runHeldOutBenchmark } from "./benchmark";
import { summarizeBenchmark } from "./benchmark-report";
describe("benchmark reporting",()=>{it("labels benchmark results as synthetic",()=>expect(summarizeBenchmark(runHeldOutBenchmark()).synthetic).toBe(true));});
