import { z } from "zod";

// The only scoring rubric. The dashboard and documentation generator both import this module.
export const statusInfo = {
  verified: {
    label: "Complete",
    classification: "Complete and verified",
    credit: 1,
  },
  "needs-verification": {
    label: "Needs verification",
    classification: "Implemented but not fully tested",
    credit: 0.75,
  },
  partial: {
    label: "In progress",
    classification: "Partially implemented",
    credit: 0.5,
  },
  "not-started": {
    label: "Not started",
    classification: "Not implemented",
    credit: 0,
  },
  blocked: {
    label: "Blocked",
    classification: "Blocked by external requirements",
    credit: 0,
  },
} as const;
export type TaskStatus = keyof typeof statusInfo;
const id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const text = z.string().trim().min(1).max(2000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + "T00:00:00Z");
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Use a valid calendar date.");
const sourcePath = text.refine(
  (p) =>
    !p.startsWith("/") &&
    !/^[A-Za-z]:/.test(p) &&
    !p.includes("\\") &&
    !p.split("/").includes(".."),
  "Use a repository-relative path.",
);
const taskSchema = z
  .object({
    id,
    title: text,
    status: z.enum([
      "verified",
      "needs-verification",
      "partial",
      "not-started",
      "blocked",
    ]),
    detail: text,
    evidenceIds: z.array(id),
    sources: z.array(sourcePath).min(1),
    next: text.optional(),
    releaseGate: z.boolean().default(false),
    points: z.number().int().positive().default(1),
  })
  .strict();
export const progressSchema = z
  .object({
    schemaVersion: z.literal(1),
    project: text,
    updatedAt: date,
    phase: text,
    baselineRevision: text,
    assessmentNote: text,
    evidence: z
      .array(
        z
          .object({
            id,
            title: text,
            method: z.enum(["automated", "review", "operational"]),
            verifiedAt: date,
            paths: z.array(sourcePath).min(1),
            result: text,
          })
          .strict(),
      )
      .min(1),
    milestones: z
      .array(
        z
          .object({
            id,
            title: text,
            weight: z.number().positive().max(100),
            track: z.enum(["functional", "readiness", "preparation"]),
            summary: text,
            tasks: z.array(taskSchema).min(1),
          })
          .strict(),
      )
      .min(1),
    testRuns: z.array(
      z
        .object({
          id,
          title: text,
          status: z.enum(["passed", "failed", "not-run"]),
          passed: z.number().int().nonnegative(),
          failed: z.number().int().nonnegative(),
          skipped: z.number().int().nonnegative(),
          verifiedAt: date,
          command: text,
          evidenceId: id,
        })
        .strict(),
    ),
    priorities: z.array(
      z
        .object({
          taskId: id,
          reason: text,
          acceptance: text,
          dependsOn: z.array(id),
        })
        .strict(),
    ),
    knownIssues: z.array(z.object({ title: text, detail: text }).strict()),
    futureScope: z.array(text),
  })
  .strict()
  .superRefine((data, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const unique = (values: string[], label: string) => {
      if (new Set(values).size !== values.length) fail(`Duplicate ${label}.`);
    };
    unique(
      data.milestones.map((m) => m.id),
      "milestone id",
    );
    unique(
      data.evidence.map((e) => e.id),
      "evidence id",
    );
    unique(
      data.testRuns.map((t) => t.id),
      "test run id",
    );
    const tasks = data.milestones.flatMap((m) => m.tasks);
    unique(
      tasks.map((t) => t.id),
      "task id",
    );
    const evidenceIds = new Set(data.evidence.map((e) => e.id)),
      taskIds = new Set(tasks.map((t) => t.id));
    if (
      Math.abs(data.milestones.reduce((sum, m) => sum + m.weight, 0) - 100) >
      0.000001
    )
      fail("Milestone weights must total 100%.");
    for (const track of ["functional", "readiness", "preparation"])
      if (!data.milestones.some((m) => m.track === track))
        fail(`Missing ${track} track.`);
    for (const task of tasks) {
      if (task.status === "verified" && task.evidenceIds.length === 0)
        fail(`${task.id}: completion requires verification evidence.`);
      for (const ref of task.evidenceIds)
        if (!evidenceIds.has(ref)) fail(`${task.id}: unknown evidence ${ref}.`);
      if (task.status !== "verified" && !task.next)
        fail(`${task.id}: unfinished work needs an acceptance step.`);
    }
    for (const run of data.testRuns) {
      if (!evidenceIds.has(run.evidenceId))
        fail(`${run.id}: unknown test evidence.`);
      if (run.status === "passed" && (run.failed > 0 || run.passed === 0))
        fail(`${run.id}: passing status conflicts with test counts.`);
      if (
        run.status === "not-run" &&
        run.passed + run.failed + run.skipped !== 0
      )
        fail(`${run.id}: unexecuted tests cannot have results.`);
    }
    for (const priority of data.priorities) {
      if (
        !taskIds.has(priority.taskId) ||
        priority.dependsOn.some((t) => !taskIds.has(t) || t === priority.taskId)
      )
        fail("Priority references an unknown task or itself.");
    }
  });
export type ProgressData = z.infer<typeof progressSchema>;
export type ProgressTask = z.infer<typeof taskSchema>;
export type Milestone = ProgressData["milestones"][number];
export function calculateProgress(data: ProgressData) {
  const milestones = data.milestones.map((m) => {
    const totalPoints = m.tasks.reduce((sum, t) => sum + t.points, 0);
    const completion =
      (m.tasks.reduce(
        (sum, t) => sum + t.points * statusInfo[t.status].credit,
        0,
      ) /
        totalPoints) *
      100;
    const complete = m.tasks.filter((t) => t.status === "verified").length;
    const status: TaskStatus =
      complete === m.tasks.length
        ? "verified"
        : m.tasks.some((t) => t.status === "blocked")
          ? "blocked"
          : m.tasks.every((t) => t.status === "not-started")
            ? "not-started"
            : m.tasks.every((t) =>
                  ["verified", "needs-verification"].includes(t.status),
                )
              ? "needs-verification"
              : "partial";
    return {
      ...m,
      completion,
      contribution: (completion * m.weight) / 100,
      complete,
      pending: m.tasks.length - complete,
      status,
    };
  });
  const trackScore = (track: Milestone["track"]) => {
    const selected = milestones.filter((m) => m.track === track);
    return (
      selected.reduce((sum, m) => sum + m.completion * m.weight, 0) /
      selected.reduce((sum, m) => sum + m.weight, 0)
    );
  };
  const tasks = milestones.flatMap((m) =>
    m.tasks.map((t) => ({ ...t, milestoneId: m.id, milestoneTitle: m.title })),
  );
  const weights = Object.fromEntries(
    ["functional", "readiness", "preparation"].map((track) => [
      track,
      milestones
        .filter((m) => m.track === track)
        .reduce((sum, m) => sum + m.weight, 0),
    ]),
  );
  return {
    milestones,
    tasks,
    weights,
    overall: milestones.reduce((sum, m) => sum + m.contribution, 0),
    functional: trackScore("functional"),
    readiness: trackScore("readiness"),
    preparation: trackScore("preparation"),
    completedMilestones: milestones.filter((m) => m.status === "verified")
      .length,
    completedTasks: tasks.filter((t) => t.status === "verified").length,
    pendingTasks: tasks.filter((t) => t.status !== "verified").length,
    blockers: tasks.filter((t) => t.status === "blocked"),
    openGates: tasks.filter((t) => t.releaseGate && t.status !== "verified"),
  };
}
export const formatPercent = (value: number) => `${Number(value.toFixed(1))}%`;
