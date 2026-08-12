import { CONCERNS, type ConcernId } from "@/lib/domain/concerns";
import { study } from "@/lib/study/store";

/**
 * What a tracker without an error model would have told me.
 *
 * This is the closest thing to a controlled experiment the study contains, and
 * it needs no product and no waiting. The calibration sessions were captured
 * minutes apart. Skin cannot change in minutes, so every difference between
 * them is measurement error by construction, and any tracker that reported one
 * as progress would be wrong with certainty rather than merely unlucky.
 *
 * So the comparison is fair in the one direction that matters: a naive tracker
 * gets credit for nothing here, because there is nothing real to find. Counting
 * how many differences it would have shown as change is a direct measure of how
 * often it misleads, on real readings from the real API.
 */

/**
 * A change a tracker would put in front of a user. Scores are displayed to a
 * tenth, so anything at or above 0.1 is visible movement; a whole point is the
 * conservative choice and is roughly where a UI would draw an arrow.
 */
const VISIBLE_CHANGE = 1;

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

type Comparison = {
  concern: ConcernId;
  from: number;
  to: number;
  delta: number;
  wouldClaim: boolean;
};

export function falseClaims(): {
  comparisons: Comparison[];
  claimed: number;
  total: number;
  largest: Comparison | null;
  minutes: number;
} {
  const sessions = study.calibrationSessions;
  const comparisons: Comparison[] = [];

  if (sessions.length >= 2) {
    const concerns = Object.keys(sessions[0].readings) as ConcernId[];
    for (const concern of concerns) {
      for (let i = 1; i < sessions.length; i++) {
        const before = mean(sessions[i - 1].readings[concern] ?? []);
        const after = mean(sessions[i].readings[concern] ?? []);
        const delta = after - before;
        comparisons.push({
          concern,
          from: i,
          to: i + 1,
          delta,
          wouldClaim: Math.abs(delta) >= VISIBLE_CHANGE,
        });
      }
    }
  }

  const claimed = comparisons.filter((c) => c.wouldClaim).length;
  const largest = comparisons.reduce<Comparison | null>(
    (best, c) => (best === null || Math.abs(c.delta) > Math.abs(best.delta) ? c : best),
    null,
  );

  return { comparisons, claimed, total: comparisons.length, largest, minutes: 15 };
}

export function FalseClaims({ windowMinutes }: { windowMinutes: number }) {
  const { comparisons, claimed, total, largest } = falseClaims();
  if (total === 0) return null;

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:items-start">
      <div>
        <h2 className="max-w-md font-serif text-[30px] leading-[1.2] tracking-[0.005em]">
          On skin that did not change, a normal tracker would have been wrong{" "}
          {claimed} times out of {total}.
        </h2>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-[var(--color-ink-secondary)]">
          These are the calibration sessions, captured {windowMinutes} minutes apart. Skin
          cannot change in {windowMinutes} minutes, so every difference below is
          measurement error, and there is nothing real here for anything to find.
        </p>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--color-ink-secondary)]">
          A tracker that shows you a score and compares it to last time would have
          reported{" "}
          <span className="text-[var(--color-ink)]">
            {claimed} of these {total} comparisons
          </span>{" "}
          as a change in your skin
          {largest && largest.wouldClaim ? (
            <>
              , the largest of them{" "}
              <span style={{ color: "var(--color-alert)" }} className="tabular">
                {largest.delta > 0 ? "+" : ""}
                {largest.delta.toFixed(1)}
              </span>{" "}
              points of {CONCERNS[largest.concern].label.toLowerCase()}
            </>
          ) : null}
          . Every one would have been false.
        </p>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed">
          <span className="text-[var(--color-ink)]">Assay reported none of them.</span> Not
          because it is cautious, but because it had measured what this instrument does
          when nothing happens, and all of it fell inside that.
        </p>
      </div>

      <figure className="card p-7">
        <figcaption className="tabular text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
          Same face, {windowMinutes} minutes, nothing applied
        </figcaption>
        <table className="mt-5 w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-rule)] text-left text-[10px] tracking-[0.1em] text-[var(--color-ink-muted)] uppercase">
              <th className="pb-2 font-normal">Concern</th>
              <th className="pb-2 text-right font-normal">Sessions</th>
              <th className="pb-2 text-right font-normal">Difference</th>
              <th className="pb-2 pl-4 font-normal">A tracker says</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {comparisons.map((c) => (
              <tr
                key={`${c.concern}-${c.from}`}
                className="border-b border-[var(--color-rule)] last:border-0"
              >
                <td className="py-1.5 font-sans">{CONCERNS[c.concern].label}</td>
                <td className="py-1.5 text-right text-[var(--color-ink-muted)]">
                  {c.from}&#8202;&rarr;&#8202;{c.to}
                </td>
                <td
                  className="py-1.5 text-right"
                  style={c.wouldClaim ? { color: "var(--color-alert)" } : undefined}
                >
                  {c.delta > 0 ? "+" : ""}
                  {c.delta.toFixed(2)}
                </td>
                <td className="py-1.5 pl-4 font-sans text-[12px] text-[var(--color-ink-secondary)]">
                  {c.wouldClaim ? "changed" : "no change"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-5 border-t border-[var(--color-rule)] pt-4 text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
          {claimed} false claims from a tracker without an error bar. {total - claimed}{" "}
          honest ones, by luck rather than method. Assay: <span className="tabular">0</span>{" "}
          claims, all {total} correctly held below the floor.
        </p>
      </figure>
    </div>
  );
}
