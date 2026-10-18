import { describe, expect, it } from "vitest";
import audit from "../../../../progress/development-progress.json";
import { calculateProgress, formatPercent, progressSchema } from "./model";
import type { ProgressData, TaskStatus } from "./model";

function example(): ProgressData {
  const data = progressSchema.parse(audit);
  const template = data.milestones[0].tasks[0];
  const task = (id: string, status: TaskStatus, points = 1) => ({
    ...template,
    id,
    status,
    points,
    next: "Run the acceptance check.",
    releaseGate: status === "blocked",
  });
  data.milestones = [
    {
      ...data.milestones[0],
      id: "features",
      weight: 50,
      track: "functional",
      tasks: [task("verified", "verified"), task("partial", "partial", 3)],
    },
    {
      ...data.milestones[0],
      id: "ready",
      weight: 30,
      track: "readiness",
      tasks: [task("unverified", "needs-verification")],
    },
    {
      ...data.milestones[0],
      id: "future",
      weight: 20,
      track: "preparation",
      tasks: [task("blocked", "blocked"), task("unstarted", "not-started")],
    },
  ];
  data.priorities = [];
  return progressSchema.parse(data);
}
describe("evidence-based progress calculation", () => {
  it("weights task points and milestone weights, with independent normalized tracks", () => {
    const result = calculateProgress(example());
    expect(result.overall).toBe(53.75);
    expect(result.functional).toBe(62.5);
    expect(result.readiness).toBe(75);
    expect(result.preparation).toBe(0);
    expect(result.pendingTasks).toBe(4);
    expect(result.completedMilestones).toBe(0);
    expect(result.openGates).toHaveLength(1);
    expect(formatPercent(result.overall)).toBe("53.8%");
  });
  it("gives no completion credit to blocked or unstarted work", () => {
    const result = calculateProgress(example());
    expect(result.milestones[2].completion).toBe(0);
    expect(result.milestones[2].status).toBe("blocked");
    expect(result.blockers).toHaveLength(1);
  });
  it("requires every task to be verified for a complete milestone", () => {
    const data = example();
    data.milestones[0].tasks.forEach((t) => {
      t.status = "verified";
    });
    const result = calculateProgress(data);
    expect(result.milestones[0].completion).toBe(100);
    expect(result.completedMilestones).toBe(1);
    expect(result.openGates).toHaveLength(1);
  });
  it("validates the actual audit and its transparent arithmetic", () => {
    const result = calculateProgress(progressSchema.parse(audit));
    expect(result.overall).toBeCloseTo(83.75);
    expect(result.functional).toBeCloseTo((61.25 / 65) * 100);
    expect(result.readiness).toBeCloseTo((19.5 / 30) * 100);
    expect(result.milestones.reduce((sum, m) => sum + m.weight, 0)).toBe(100);
  });
  it("rejects weights that do not sum to 100", () => {
    const data = example();
    data.milestones[0].weight = 49;
    expect(progressSchema.safeParse(data).success).toBe(false);
  });
  it("rejects completion with no evidence or unknown evidence", () => {
    const data = example();
    data.milestones[0].tasks[0].evidenceIds = [];
    expect(progressSchema.safeParse(data).success).toBe(false);
    data.milestones[0].tasks[0].evidenceIds = ["invented-result"];
    expect(progressSchema.safeParse(data).success).toBe(false);
  });
  it("rejects duplicate tasks and unfinished work without acceptance steps", () => {
    const data = example();
    data.milestones[0].tasks[1].id = "verified";
    expect(progressSchema.safeParse(data).success).toBe(false);
    data.milestones[0].tasks[1].id = "partial";
    delete data.milestones[0].tasks[1].next;
    expect(progressSchema.safeParse(data).success).toBe(false);
  });
  it("rejects contradictory test results and unknown priority dependencies", () => {
    const data = example();
    data.testRuns[0].failed = 1;
    expect(progressSchema.safeParse(data).success).toBe(false);
    data.testRuns[0].failed = 0;
    data.priorities = [
      {
        taskId: "partial",
        dependsOn: ["unknown"],
        reason: "Reason",
        acceptance: "Verify",
      },
    ];
    expect(progressSchema.safeParse(data).success).toBe(false);
  });
  it.each([null, {}, { milestones: [] }])(
    "rejects missing progress data without assuming zero completion: %j",
    (value) => {
      expect(progressSchema.safeParse(value).success).toBe(false);
    },
  );
});
