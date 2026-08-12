import Link from "next/link";

import { InstrumentPanel } from "@/components/instrument-panel";
import { Reveal } from "@/components/reveal";
import { StudyProgress } from "@/components/study-progress";
import { TitleBlock } from "@/components/title-block";
import { VerdictCard } from "@/components/verdict-card";
import { CONCERNS } from "@/lib/domain/concerns";
import {
  activesFor,
  calibrationFloors,
  concernProgress,
  study,
  studyProgress,
  sortVerdicts,
  verdictsFor,
} from "@/lib/study/store";

/**
 * Span of the recording the calibration sessions were sampled from. Stated
 * rather than derived, because the sessions carry a study day rather than a
 * wall-clock offset and the honest figure is the one from the source footage.
 */
const CALIBRATION_WINDOW_MINUTES = 15;

export default function VerdictPage() {
  const progress = studyProgress();
  const verdicts = sortVerdicts(verdictsFor());
  const decided = verdicts.filter((v) => v.verdict !== null);
  // Two treatment sessions make a verdict computable, but computable is not the
  // same as decided: until a concern clears its floor every card reads
  // "insufficient evidence", which is six restatements of one fact and tells a
  // visitor less than the progress table does. The table carries the same
  // honest answer in a more useful form, showing how far each concern still has
  // to travel, so the cards only take over once at least one has resolved.
  const resolved = decided.filter(
    (v) => v.verdict!.state !== "insufficient_evidence" && v.verdict!.state !== "saturated",
  );
  const showVerdicts = resolved.length > 0;
  const floors = calibrationFloors();
  const progressRows = concernProgress();
  const actives = activesFor(study);
  const horizonDays = actives.length
    ? Math.max(...actives.map((a) => a.assessAtDays))
    : 56;

  return (
    <div className="mx-auto max-w-5xl px-6">
      <Reveal as="section" className="pt-20 pb-16 sm:pt-28">
        <p className="tabular text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
          Skin measurement with an error bar
        </p>

        <h1 className="mt-5 max-w-3xl font-serif text-[44px] leading-[1.08] tracking-[-0.01em] sm:text-[58px]">
          Four of the products on your shelf are doing nothing. Assay tells you which.
        </h1>

        <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-[var(--color-ink-secondary)]">
          Most skin trackers report your lighting as progress. Assay measures its own
          error first, then calls a change real only when it beats that margin on your
          face, on your device. It is the only skin tracker that tells you when it
          cannot tell.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            href="/calibrate"
            className="rounded-none bg-[var(--color-ink)] px-5 py-2.5 text-[13px] tracking-[0.06em] uppercase text-[var(--color-paper)] transition-colors duration-150 hover:bg-[var(--color-spot)]"
          >
            Calibrate your instrument
          </Link>
          <Link
            href="/method"
            className="rounded-none border border-[var(--color-rule-strong)] px-5 py-2.5 text-[14px] transition-colors duration-200 hover:bg-[var(--color-surface-sunken)]"
          >
            How the maths works
          </Link>
        </div>
      </Reveal>

      <Reveal
        as="section"
        index={1}
        className="border-t border-[var(--color-rule)] py-14"
      >
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <Figure
            value="$170"
            label="wasted per year on skincare that turns out not to work"
          />
          <Figure
            value="4"
            label="products the average person keeps that never delivered"
          />
          <Figure
            value="1 in 9"
            label="women who have cycled through ten or more failures"
          />
          <Figure value="£1bn" label="of skincare abandoned annually in the UK alone" />
        </div>
        <p className="mt-8 max-w-2xl text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
          Nobody can tell you which four. The measurement exists, YouCam&rsquo;s Skin
          Analysis API scores sixteen skin attributes from a photograph, but a single
          score carries no error bar, and without one you cannot separate a working
          product from a brighter bathroom.
        </p>
      </Reveal>

      <Reveal as="section" index={2} className="border-t border-[var(--color-rule)] py-14">
        <div className="grid gap-10 md:grid-cols-[1.35fr_1fr] md:items-start">
          <div>
            <h2 className="max-w-lg font-serif text-[30px] leading-[1.2] tracking-[0.005em]">
              The score you are shown is not the score that was measured.
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--color-ink-secondary)]">
              This is not an accusation, it is in the documentation. Perfect Corp describe
              the displayed value as{" "}
              <span className="text-[var(--color-ink)]">
                &ldquo;a psychological motivator&rdquo;
              </span>
              , adjusted upward from the underlying measurement because{" "}
              <span className="text-[var(--color-ink)]">
                &ldquo;consumers generally prefer positive evaluations regarding their skin
                health.&rdquo;
              </span>
            </p>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--color-ink-secondary)]">
              It is a reasonable product decision. It is also why this exists. I measured
              the gap on my own face before I read the reason for it, and it is largest on
              moisture, the one concern a hydrating product is supposed to move. Assay
              computes everything on the measurement and never on the motivator.
            </p>
          </div>

          <figure className="card p-7">
            <figcaption className="tabular text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
              Moisture, one frame, one call
            </figcaption>
            <div className="mt-6 flex items-end justify-between gap-4">
              <div>
                <p className="tabular text-[40px] leading-none">68</p>
                <p className="mt-2 text-[12px] text-[var(--color-ink-secondary)]">
                  displayed
                </p>
              </div>
              <div className="pb-1.5 text-[13px] text-[var(--color-ink-muted)]">vs</div>
              <div className="text-right">
                <p
                  className="tabular text-[40px] leading-none"
                  style={{ color: "var(--color-spot)" }}
                >
                  45.4
                </p>
                <p className="mt-2 text-[12px] text-[var(--color-ink-secondary)]">
                  measured
                </p>
              </div>
            </div>
            <p className="mt-6 border-t border-[var(--color-rule)] pt-5 text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
              A 22.6 point upward adjustment. A tracker scoring progress on the left-hand
              number reads an encouragement as evidence.
            </p>
          </figure>
        </div>
      </Reveal>

      <section className="border-t border-[var(--color-rule)] py-14">
        <div className="mb-8">
          <h2 className="font-serif text-[30px] tracking-[0.005em]">The study</h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
            A prospective n-of-1 study running on a real face, with real products, scored
            by the YouCam Skin Analysis API. Every reading is captured live. Nothing on
            this page is simulated.
          </p>
        </div>

        <TitleBlock
          fields={[
            { label: "Subject", value: study.subject },
            { label: "Instrument", value: "YouCam Skin Analysis" },
            {
              label: "Reference",
              value: `${progress.calibrationSessionCount} baseline sessions`,
            },
            { label: "Opened", value: study.startedAt },
            { label: "Treatment sessions", value: String(progress.sessionCount) },
            { label: "Span", value: `${progress.studyDays} days` },
            { label: "Concerns", value: String(study.concerns.length) },
            { label: "Cadence", value: `${study.cadenceDays}d` },
          ]}
          status={
            showVerdicts
              ? { label: "Result issued", tone: "issued" }
              : { label: "No result yet", tone: "pending" }
          }
        />

        {showVerdicts ? (
          <div className="mt-10 grid gap-5">
            {decided.map((entry, i) => (
              <Reveal key={entry.concern} index={i}>
                <VerdictCard verdict={entry.verdict!} index={i} />
              </Reveal>
            ))}
          </div>
        ) : progress.calibrationSessionCount > 0 ? (
          <StudyProgress
            rows={progressRows}
            treatmentSessions={progress.sessionCount}
            productName={study.products[0]?.name ?? null}
            horizonDays={horizonDays}
            // The latest day reached, not the span between sessions: with one
            // session the span is zero, which read as 'day 0' on day one.
            studyDay={Math.max(0, ...study.treatmentSessions.map((t) => t.day))}
          />
        ) : (
          <EmptyStudy />
        )}
      </section>

      {floors.length > 0 && (
        <Reveal as="section" className="border-t border-[var(--color-rule)] py-14">
          <InstrumentPanel
            floors={floors}
            sessionCount={progress.calibrationSessionCount}
            windowMinutes={CALIBRATION_WINDOW_MINUTES}
          />
        </Reveal>
      )}
    </div>
  );
}

function EmptyStudy() {
  return (
    <div className="mt-10 card p-10">
      <p className="tabular text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
        Awaiting capture
      </p>
      <h3 className="mt-3 max-w-lg font-serif text-[26px] leading-tight tracking-[0.005em]">
        The study has no readings yet, so there is nothing to report.
      </h3>
      <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
        This page will only ever show measurements that actually happened. An app arguing
        that skincare claims need evidence does not get to invent its own, so rather than
        filling this space with a plausible chart, it stays empty until the first session
        is captured.
      </p>
      <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
        Two things have to happen before a verdict can exist: a baseline that measures how
        much the instrument moves when your skin has not changed, and at least two
        treatment sessions to compare against it.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          href="/calibrate"
          className="rounded-none bg-[var(--color-ink)] px-5 py-2.5 text-[13px] tracking-[0.06em] uppercase text-[var(--color-paper)] transition-colors duration-150 hover:bg-[var(--color-spot)]"
        >
          Capture a baseline
        </Link>
        <Link
          href="/method"
          className="rounded-none border border-[var(--color-rule-strong)] px-5 py-2.5 text-[14px] transition-colors duration-200 hover:bg-[var(--color-surface-sunken)]"
        >
          See a worked example
        </Link>
      </div>

      <div className="mt-9 border-t border-[var(--color-rule)] pt-7">
        <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
          Tracking
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {study.concerns.map((concern) => (
            <li
              key={concern}
              className="rounded-none bg-[var(--color-surface-sunken)] px-3 py-1 text-[12px] text-[var(--color-ink-secondary)]"
            >
              {CONCERNS[concern].label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="tabular text-[32px] leading-none tracking-[0.005em]">{value}</p>
      <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--color-ink-secondary)]">
        {label}
      </p>
    </div>
  );
}
