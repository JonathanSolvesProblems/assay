import { CONCERNS } from "@/lib/domain/concerns";
import type { ConcernProgress } from "@/lib/study/store";

function signed(v: number): string {
  return v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1);
}

/**
 * The study while it is still running.
 *
 * A verdict needs two treatment sessions and a concern past the timescale on
 * which it can physically move, so for the first few days there is nothing to
 * declare. The honest thing to show then is not an empty page but the instrument
 * working: the baseline, the latest reading, and the distance still to travel
 * before a change would mean anything.
 *
 * It is also the more useful screen. A page that says "no result yet" tells a
 * visitor nothing; this one shows exactly what is being measured and what would
 * have to happen for the answer to change.
 */
export function StudyProgress({
  rows,
  treatmentSessions,
  productName,
  horizonDays,
  studyDay,
}: {
  rows: ConcernProgress[];
  treatmentSessions: number;
  productName: string | null;
  horizonDays: number;
  studyDay: number;
}) {
  const measurable = rows.filter((r) => r.usable !== "unusable");

  return (
    <div className="mt-8">
      <p className="max-w-2xl text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
        {productName ? (
          <>
            <span className="text-[var(--color-ink)]">{productName}</span>, day{" "}
            <span className="tabular text-[var(--color-ink)]">{studyDay}</span> of a study
            that can first return a fair answer at day{" "}
            <span className="tabular text-[var(--color-ink)]">{horizonDays}</span>.{" "}
          </>
        ) : (
          <>No product registered yet. </>
        )}
        {treatmentSessions < 2
          ? "A change needs two sessions to exist at all, so no verdict is offered yet."
          : "Each row shows how far the latest reading sits from the bar it has to clear."}
      </p>

      <div className="mt-7 overflow-x-auto">
        <table className="w-full min-w-[600px] text-[14px]">
          <thead>
            <tr className="border-b border-[var(--color-rule)] text-left text-[10px] tracking-[0.1em] text-[var(--color-ink-muted)] uppercase">
              <th className="pb-2.5 font-normal">Concern</th>
              <th className="pb-2.5 text-right font-normal">Baseline</th>
              <th className="pb-2.5 text-right font-normal">Latest</th>
              <th className="pb-2.5 text-right font-normal">Change</th>
              <th className="pb-2.5 text-right font-normal">Must beat</th>
              <th className="pb-2.5 pl-6 font-normal">Standing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const meta = CONCERNS[row.concern];
              const unusable = row.usable === "unusable";
              return (
                <tr
                  key={row.concern}
                  className="border-b border-[var(--color-rule)] last:border-0"
                >
                  <td className="py-3">
                    <span className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="inline-block h-3 w-3 shrink-0 border border-[var(--color-ink)]"
                        style={{ background: `var(--patch-${row.concern})` }}
                      />
                      {meta.label}
                    </span>
                  </td>
                  <td className="tabular py-3 text-right text-[var(--color-ink-secondary)]">
                    {row.baseline.toFixed(1)}
                  </td>
                  <td className="tabular py-3 text-right">
                    {row.latest === null ? "—" : row.latest.toFixed(1)}
                  </td>
                  <td
                    className="tabular py-3 text-right"
                    style={
                      row.clears && !unusable ? { color: "var(--color-spot)" } : undefined
                    }
                  >
                    {row.change === null ? "—" : signed(row.change)}
                  </td>
                  <td className="tabular py-3 text-right text-[var(--color-ink-muted)]">
                    &plusmn;{row.floor.toFixed(1)}
                  </td>
                  <td className="py-3 pl-6 text-[13px] text-[var(--color-ink-secondary)]">
                    {unusable
                      ? "Cannot measure on this setup"
                      : row.change === null
                        ? "Awaiting first reading"
                        : row.clears
                          ? "Clears its floor"
                          : `Inside the noise by ${(row.floor - Math.abs(row.change)).toFixed(1)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-7 max-w-2xl border-l-2 border-[var(--color-rule-strong)] pl-5 text-[15px] leading-relaxed text-[var(--color-ink-secondary)]">
        {measurable.length} of {rows.length} concerns can support a verdict on this setup.
        Nothing here is a result yet, and saying so is the point: a tracker that reported
        these numbers as progress would be reporting its own error.
      </p>
    </div>
  );
}
