import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Flag,
  FlaskConical,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Badge, PageTitle, QueryState, useData } from "../ui";
import {
  calculateProgress,
  formatPercent,
  progressSchema,
  statusInfo,
} from "../development-progress/model";
import type { ProgressData, TaskStatus } from "../development-progress/model";
import "../development-progress/progress.css";

export function DevelopmentProgressPage() {
  const query = useData<unknown>("/admin/development-progress");
  if (query.isPending) return <QueryState query={query} />;
  if (query.error) return <Unavailable retry={() => query.refetch()} />;
  return <ProgressDashboard data={query.data} retry={() => query.refetch()} />;
}

function Unavailable({ retry }: { retry?: () => unknown }) {
  return (
    <>
      <PageTitle
        eyebrow="OWNER WORKSPACE"
        title="Development progress"
        description="A reviewed view of the work behind your shop."
      />
      <section className="panel progress-unavailable" role="alert">
        <AlertCircle size={32} />
        <h2>Progress data is unavailable</h2>
        <p>
          The reviewed snapshot is missing, invalid, or could not be loaded. No
          completion percentage can be shown.
        </p>
        <p>
          Restore and validate the progress file, then rebuild the API. Shop
          operations can continue independently.
        </p>
        {retry && (
          <button className="btn" onClick={retry}>
            <RefreshCw size={16} />
            Try again
          </button>
        )}
      </section>
    </>
  );
}
function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge
      tone={
        status === "verified"
          ? "green"
          : status === "blocked"
            ? "orange"
            : status === "not-started"
              ? "neutral"
              : "purple"
      }
    >
      {statusInfo[status].label}
    </Badge>
  );
}
function ProgressBar({
  value,
  label,
  large = false,
}: {
  value: number;
  label: string;
  large?: boolean;
}) {
  return (
    <div
      className={`development-bar ${large ? "large" : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Number(value.toFixed(1))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
export function ProgressDashboard({
  data,
  retry,
}: {
  data: unknown;
  retry?: () => unknown;
}) {
  const parsed = progressSchema.safeParse(data);
  if (!parsed.success) return <Unavailable retry={retry} />;
  return <ReviewedDashboard data={parsed.data} retry={retry} />;
}
function ReviewedDashboard({
  data,
  retry,
}: {
  data: ProgressData;
  retry?: () => unknown;
}) {
  const progress = calculateProgress(data);
  const reviewedDate = new Date(
    `${data.updatedAt}T00:00:00Z`,
  ).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <div className="development-page">
      <PageTitle
        eyebrow="FROM WORKING SOFTWARE TO SHOP READY"
        title="Development progress"
        description="One honest view of what works, what’s verified, and what comes next."
      >
        <span className="date-chip">
          <CalendarDays size={16} />
          Reviewed {reviewedDate}
        </span>
        {retry && (
          <button className="btn small" onClick={retry}>
            <RefreshCw size={15} />
            Refresh snapshot
          </button>
        )}
      </PageTitle>
      <section className="development-hero" aria-labelledby="overall-heading">
        <div className="development-hero-copy">
          <span className="development-kicker">
            <ClipboardCheck size={16} />
            REVIEWED PROJECT SNAPSHOT
          </span>
          <div className="development-overall">
            <div>
              <h2 id="overall-heading">Overall project completion</h2>
              <strong data-testid="overall-progress">
                {formatPercent(progress.overall)}
              </strong>
            </div>
            <span className="development-hero-icon" aria-hidden="true">
              <Flag size={38} />
            </span>
          </div>
          <ProgressBar
            value={progress.overall}
            label="Overall project completion"
            large
          />
          <p>
            Weighted across {progress.milestones.length} milestones. Verified
            features earn full credit; unfinished acceptance stays visible.
          </p>
          <div className="development-phase">
            <span>Current phase</span>
            <strong>{data.phase}</strong>
          </div>
        </div>
        <aside className="development-release">
          <ShieldCheck size={25} />
          <h3>Production acceptance</h3>
          <strong>{formatPercent(progress.readiness)}</strong>
          <span className="development-gate-label">
            {progress.openGates.length
              ? `${progress.openGates.length} release gates still open`
              : "Tracked gates verified; owner sign-off required"}
          </span>
          <p>
            {progress.openGates.length
              ? "Commercial rollout remains blocked until device, network, security, recovery and external acceptance are recorded."
              : "Review the release decision with the owner before rollout. A percentage does not authorize deployment."}
          </p>
        </aside>
      </section>
      <section className="development-metrics" aria-label="Progress breakdown">
        <article className="panel">
          <span>Functional development</span>
          <strong data-testid="functional-progress">
            {formatPercent(progress.functional)}
          </strong>
          <p>
            Product features · normalized {progress.weights.functional}% track
          </p>
        </article>
        <article className="panel">
          <span>Completed milestones</span>
          <strong>
            {progress.completedMilestones}
            <small> / {progress.milestones.length}</small>
          </strong>
          <p>All acceptance tasks verified</p>
        </article>
        <article className="panel">
          <span>Pending acceptance tasks</span>
          <strong data-testid="pending-tasks">{progress.pendingTasks}</strong>
          <p>
            {progress.completedTasks} verified · {progress.blockers.length}{" "}
            externally blocked
          </p>
        </article>
        <article className="panel">
          <span>Cloud preparation</span>
          <strong>{formatPercent(progress.preparation)}</strong>
          <p>Design and preparation · synchronization deferred</p>
        </article>
      </section>
      <div className="development-layout">
        <section className="panel development-milestones">
          <div className="panel-head">
            <div>
              <h2>Milestone progress</h2>
              <p>Expand a milestone to inspect its acceptance evidence.</p>
            </div>
            <Badge tone="purple">{progress.milestones.length} milestones</Badge>
          </div>
          <div className="development-legend">
            {(Object.keys(statusInfo) as TaskStatus[]).map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
          {progress.milestones.map((milestone) => (
            <details
              className="development-milestone"
              id={milestone.id}
              key={milestone.id}
            >
              <summary>
                <div className="development-milestone-heading">
                  <span
                    className={`development-milestone-symbol ${milestone.status === "verified" ? "done" : ""}`}
                  >
                    {milestone.status === "verified" ? (
                      <CheckCircle2 size={19} />
                    ) : (
                      <Flag size={18} />
                    )}
                  </span>
                  <div>
                    <h3>{milestone.title}</h3>
                    <span>
                      {milestone.weight}% weight ·{" "}
                      {milestone.track === "readiness"
                        ? "Production readiness"
                        : milestone.track === "functional"
                          ? "Functional development"
                          : "Cloud preparation"}
                    </span>
                  </div>
                  <strong>{formatPercent(milestone.completion)}</strong>
                  <ChevronDown className="development-chevron" size={17} />
                </div>
                <ProgressBar
                  value={milestone.completion}
                  label={`${milestone.title} completion`}
                />
                <div className="development-milestone-foot">
                  <StatusBadge status={milestone.status} />
                  <span>
                    {milestone.complete}/{milestone.tasks.length} tasks verified
                    · {formatPercent(milestone.contribution)} overall
                    contribution
                  </span>
                </div>
              </summary>
              <div className="development-milestone-detail">
                <p>{milestone.summary}</p>
                <ul>
                  {milestone.tasks.map((task) => (
                    <li key={task.id} id={task.id}>
                      <div className="development-task-title">
                        <strong>{task.title}</strong>
                        <StatusBadge status={task.status} />
                      </div>
                      <span className="development-classification">
                        {statusInfo[task.status].classification}
                        {task.releaseGate ? " · Release gate" : ""}
                      </span>
                      <p>{task.detail}</p>
                      {task.next && (
                        <p className="development-task-next">
                          <strong>Remaining acceptance:</strong> {task.next}
                        </p>
                      )}
                      <details className="development-evidence">
                        <summary>
                          {task.evidenceIds.length
                            ? `${task.evidenceIds.length} verification reference${task.evidenceIds.length === 1 ? "" : "s"}`
                            : "No completion evidence yet"}{" "}
                          · source
                        </summary>
                        {task.evidenceIds.map((id) => {
                          const evidence = data.evidence.find(
                            (e) => e.id === id,
                          )!;
                          return (
                            <div key={id}>
                              <strong>{evidence.title}</strong>
                              <span>
                                {evidence.method} · {evidence.verifiedAt}
                              </span>
                              <p>{evidence.result}</p>
                            </div>
                          );
                        })}
                        <div className="development-source-paths">
                          {task.sources.map((source) => (
                            <code key={source}>{source}</code>
                          ))}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </section>
        <aside className="development-next">
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Next priorities</h2>
                <p>Ordered by shop impact and dependencies</p>
              </div>
              <ArrowUpRight size={19} />
            </div>
            <ol>
              {data.priorities.map((priority, index) => {
                const task = progress.tasks.find(
                  (t) => t.id === priority.taskId,
                )!;
                return (
                  <li key={task.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <h3>{task.title}</h3>
                      <p>{priority.reason}</p>
                      <details>
                        <summary>Acceptance & dependencies</summary>
                        <p>{priority.acceptance}</p>
                        <p>
                          <strong>Depends on:</strong>{" "}
                          {priority.dependsOn.length
                            ? priority.dependsOn
                                .map(
                                  (id) =>
                                    progress.tasks.find((t) => t.id === id)!
                                      .title,
                                )
                                .join("; ")
                            : "Can start independently"}
                        </p>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
          <section className="development-owner-note">
            <LockKeyhole size={20} />
            <strong>For the owner’s workspace</strong>
            <p>
              This snapshot contains reviewed development information. It is
              read-only and is not served to cashier accounts.
            </p>
          </section>
        </aside>
      </div>
      <section className="panel development-tests">
        <div className="panel-head">
          <div>
            <h2>
              <FlaskConical size={19} />
              Testing evidence
            </h2>
            <p>
              Reviewed run results, not a live test monitor. Refreshing does not
              run tests.
            </p>
          </div>
        </div>
        <div className="development-test-grid">
          {data.testRuns.length ? (
            data.testRuns.map((run) => (
              <article key={run.id}>
                <div>
                  <strong>{run.title}</strong>
                  <Badge
                    tone={
                      run.status === "passed"
                        ? "green"
                        : run.status === "failed"
                          ? "red"
                          : "neutral"
                    }
                  >
                    {run.status === "not-run" ? "Not run" : run.status}
                  </Badge>
                </div>
                <p>
                  <b>{run.passed}</b> passed{" "}
                  <span>
                    · {run.failed} failed · {run.skipped} skipped
                  </span>
                </p>
                <time dateTime={run.verifiedAt}>
                  Last executed {run.verifiedAt}
                </time>
                <details>
                  <summary>Reproduce this check</summary>
                  <code>{run.command}</code>
                </details>
              </article>
            ))
          ) : (
            <p>
              No test run results have been reviewed. No passing result is
              assumed.
            </p>
          )}
        </div>
      </section>
      <div className="development-bottom">
        <section className="panel development-blockers">
          <div className="panel-head">
            <div>
              <h2>
                <AlertCircle size={18} />
                External blockers
              </h2>
              <p>Equipment, infrastructure and qualified acceptance</p>
            </div>
            <Badge tone="orange">{progress.blockers.length} open</Badge>
          </div>
          {progress.blockers.length ? (
            <ul>
              {progress.blockers.map((task) => (
                <li key={task.id}>
                  <strong>{task.title}</strong>
                  <p>{task.detail}</p>
                  <small>{task.next}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="development-no-blockers">
              No external blockers are recorded in this snapshot.
            </p>
          )}
        </section>
        <section className="panel development-known">
          <div className="panel-head">
            <div>
              <h2>Known limits & later scope</h2>
              <p>Visible constraints, without inflating this release’s score</p>
            </div>
          </div>
          {data.knownIssues.map((issue) => (
            <details key={issue.title}>
              <summary>{issue.title}</summary>
              <p>{issue.detail}</p>
            </details>
          ))}
          <details>
            <summary>Later optional features · excluded from scoring</summary>
            <ul>
              {data.futureScope.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </section>
      </div>
      <details className="panel development-method">
        <summary>
          How this score is calculated and maintained <ChevronDown size={17} />
        </summary>
        <div>
          <p>{data.assessmentNote}</p>
          <p>
            <strong>Formula:</strong> sum(milestone completion × milestone
            weight). Within a milestone, earned acceptance points are divided by
            total points. Display values round once to one decimal place.
          </p>
          <ul>
            {Object.entries(statusInfo).map(([key, value]) => (
              <li key={key}>
                {value.classification}: {value.credit * 100}% task credit.
              </li>
            ))}
          </ul>
          <p>
            Functional development normalizes {progress.weights.functional}% of
            overall weight; production readiness normalizes{" "}
            {progress.weights.readiness}%; cloud preparation uses{" "}
            {progress.weights.preparation}%. Open release gates override any
            aggregate score.
          </p>
          <p>
            Edit the reviewed JSON, attach verification evidence and run{" "}
            <code>node scripts/update-progress.mjs</code>. A successful command
            never automatically completes a task. See <code>PROGRESS.md</code>{" "}
            and <code>docs/PROGRESS_MAINTENANCE.md</code> in the repository.
          </p>
          <p>
            Last reviewed{" "}
            <time dateTime={data.updatedAt}>{data.updatedAt}</time> ·
            Asia/Manila · Baseline {data.baselineRevision} plus local progress
            changes.
          </p>
        </div>
      </details>
    </div>
  );
}
