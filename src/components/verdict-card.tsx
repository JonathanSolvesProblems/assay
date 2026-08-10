import { CONCERNS } from "@/lib/domain/concerns";
import type { Verdict, VerdictState } from "@/lib/stats/verdict";

import { NoiseFloorChart } from "./noise-floor-chart";

const STATE_COPY: Record<VerdictState, { label: string; bg: string; ink: string }> = {
  working: {
    label: "Working",
    bg: "var(--color-verdict-working-bg)",
    ink: "var(--color-verdict-working-ink)",
  },
  worsening: {
    label: "Getting worse",
    bg: "var(--color-verdict-worsening-bg)",
    ink: "var(--color-verdict-worsening-ink)",
  },
  expected_purge: {
    label: "Expected flare",
    bg: "var(--color-verdict-purge-bg)",
    ink: "var(--color-verdict-purge-ink)",
  },
  not_working: {
    label: "Not working",
    bg: "var(--color-verdict-null-bg)",
    ink: "var(--color-verdict-null-ink)",
  },
  insufficient_evidence: {
    label: "No evidence yet",
    bg: "var(--color-verdict-pending-bg)",
    ink: "var(--color-verdict-pending-ink)",
  },
  saturated: {
    label: "Cannot measure",
    bg: "var(--color-surface-sunken)",
    ink: "var(--color-ink-muted)",
  },
};

function signed(value: number): string {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

export function VerdictCard({
  verdict,
  index = 0,
}: {
  verdict: Verdict;
  index?: number;
}) {
  const concern = CONCERNS[verdict.concern];
  const tone = STATE_COPY[verdict.state];

  // The comparison only earns its space when the two readings actually disagree
  // about whether anything happened.
  const naiveDisagrees =
    Math.abs(verdict.naiveChange) > verdict.mdc95 && !verdict.clearsNoiseFloor;

  return (
    <article className="card p-7" style={{ "--index": index } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-[22px] leading-tight tracking-[0.005em]">
            {concern.label}
          </h3>
          <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
            {concern.description}
          </p>
        </div>

        <span
          className="tabular shrink-0 rounded-none px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em]"
          style={{ background: tone.bg, color: tone.ink }}
        >
          {tone.label}
        </span>
      </div>

      <div className="mt-6 flex items-baseline gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
            Change
          </p>
          <p
            className="tabular mt-1 text-[30px] leading-none"
            style={{ color: tone.ink }}
          >
            {signed(verdict.change)}
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
            Noise floor
          </p>
          <p className="tabular mt-1 text-[30px] leading-none text-[var(--color-ink-muted)]">
            &plusmn;{verdict.mdc95.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <NoiseFloorChart
          change={verdict.change}
          mdc95={verdict.mdc95}
          state={verdict.state}
          naiveChange={naiveDisagrees ? verdict.naiveChange : undefined}
        />
        <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
          <span>worse</span>
          <span>cannot distinguish from noise</span>
          <span>better</span>
        </div>
      </div>

      <p className="mt-5 border-t border-[var(--color-rule)] pt-5 text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
        {verdict.explanation}
      </p>

      {naiveDisagrees && (
        <p className="mt-3 rounded-none bg-[var(--color-surface-sunken)] px-4 py-3 text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
          A tracker without a noise floor would have read this as{" "}
          <span className="tabular" style={{ color: "var(--color-ink)" }}>
            {signed(verdict.naiveChange)}
          </span>{" "}
          and told you it was {verdict.naiveChange > 0 ? "improving" : "declining"}.
        </p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[var(--color-rule)] pt-5 sm:grid-cols-4">
        <Meta label="Sessions" value={String(verdict.sessionCount)} />
        <Meta label="Study day" value={String(verdict.studyDay)} />
        <Meta label="SEM" value={verdict.reliability.sem.toFixed(2)} />
        <Meta label="Confidence" value={verdict.confidence} />
      </dl>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
        {label}
      </dt>
      <dd className="tabular mt-0.5 text-[14px] capitalize">{value}</dd>
    </div>
  );
}
