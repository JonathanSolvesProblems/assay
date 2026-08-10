import Link from "next/link";

import { InstrumentPanel } from "@/components/instrument-panel";
import { Reveal } from "@/components/reveal";
import { VerdictCard } from "@/components/verdict-card";
import { CONCERNS } from "@/lib/domain/concerns";
import {
  calibrationFloors,
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
  const floors = calibrationFloors();

  return (
    <div className="mx-auto max-w-5xl px-6">
      <Reveal as="section" className="pt-20 pb-16 sm:pt-28">
        <p className="tabular text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
          Skin measurement with an error bar
        </p>

        <h1 className="mt-5 max-w-3xl font-serif text-[44px] leading-[1.08] tracking-[-0.01em] sm:text-[58px]">
          Most skin trackers report your lighting as progress.
        </h1>

        <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-[var(--color-ink-secondary)]">
          Assay measures its own error before it measures your skin. A change is only
          called real when it exceeds the margin of error for your face, on your device.
          When it doesn&rsquo;t, you get the honest answer instead of an encouraging one.
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
          Analysis API scores fourteen concerns from a photograph, but a single score
          carries no error bar, and without one you cannot separate a working product from
          a brighter bathroom.
        </p>
      </Reveal>

      <section className="border-t border-[var(--color-rule)] py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-[30px] tracking-[0.005em]">The study</h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
              A prospective n-of-1 study running on a real face, with real products,
              scored by the YouCam Skin Analysis API. Every reading is captured live.
              Nothing on this page is simulated.
            </p>
          </div>

          <dl className="flex gap-8">
            <Stat label="Sessions" value={String(progress.sessionCount)} />
            <Stat label="Baseline" value={String(progress.calibrationSessionCount)} />
            <Stat label="Days" value={String(progress.studyDays)} />
          </dl>
        </div>

        {progress.hasData ? (
          <div className="mt-10 grid gap-5">
            {decided.map((entry, i) => (
              <Reveal key={entry.concern} index={i}>
                <VerdictCard verdict={entry.verdict!} index={i} />
              </Reveal>
            ))}
          </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
        {label}
      </dt>
      <dd className="tabular mt-0.5 text-[22px] leading-none">{value}</dd>
    </div>
  );
}
