import { CONCERNS } from "@/lib/domain/concerns";
import type { ConcernFloor } from "@/lib/study/store";

const USABLE_COPY = {
  measurable: {
    label: "Measurable",
    bg: "var(--color-verdict-working-bg)",
    ink: "var(--color-verdict-working-ink)",
  },
  marginal: {
    label: "Marginal",
    bg: "var(--color-verdict-purge-bg)",
    ink: "var(--color-verdict-purge-ink)",
  },
  unusable: {
    label: "Cannot support a verdict",
    bg: "var(--color-verdict-null-bg)",
    ink: "var(--color-verdict-null-ink)",
  },
} as const;

/**
 * The measured noise floor, shown before any verdict exists.
 *
 * A drift column sits next to each floor because the two together make the
 * argument: these sessions came from one continuous recording of a person
 * sitting still, so every point of drift is error, and a concern whose drift
 * dwarfs its own floor is not measuring skin.
 */
export function InstrumentPanel({
  floors,
  sessionCount,
  windowMinutes,
}: {
  floors: ConcernFloor[];
  sessionCount: number;
  windowMinutes: number;
}) {
  const worst = [...floors].sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))[0];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="font-serif text-[30px] tracking-[0.005em]">Your instrument</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
            {sessionCount} calibration sessions sampled from separate windows of one
            continuous {windowMinutes}-minute recording. Same person, same seat, same
            camera, no product. Nothing about this skin changed, so everything below is
            the instrument, not the face.
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[560px] text-[14px]">
          <thead>
            <tr className="border-b border-[var(--color-rule)] text-left text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
              <th className="pb-2.5 font-normal">Concern</th>
              <th className="pb-2.5 text-right font-normal">
                Readings, {windowMinutes} min apart
              </th>
              <th className="pb-2.5 text-right font-normal">Drift</th>
              <th className="pb-2.5 text-right font-normal">Noise floor</th>
              <th className="pb-2.5 pl-6 font-normal">Can it answer?</th>
            </tr>
          </thead>
          <tbody>
            {floors.map((row) => {
              const meta = CONCERNS[row.concern];
              const tone = USABLE_COPY[row.usable];
              return (
                <tr
                  key={row.concern}
                  className="border-b border-[var(--color-rule)] last:border-0"
                >
                  <td className="py-3">{meta.label}</td>
                  <td className="tabular py-3 text-right text-[13px] text-[var(--color-ink-secondary)]">
                    {row.sessionMeans.map((m) => m.toFixed(1)).join("  ")}
                  </td>
                  <td
                    className="tabular py-3 text-right"
                    style={
                      Math.abs(row.drift) > row.floor
                        ? { color: "var(--color-verdict-worsening-ink)" }
                        : undefined
                    }
                  >
                    {row.drift > 0 ? "+" : ""}
                    {row.drift.toFixed(1)}
                  </td>
                  <td className="tabular py-3 text-right">
                    &plusmn;{row.floor.toFixed(1)}
                  </td>
                  <td className="py-3 pl-6">
                    <span
                      className="tabular rounded-none px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em]"
                      style={{ background: tone.bg, color: tone.ink }}
                    >
                      {tone.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {worst && Math.abs(worst.drift) > worst.floor && (
        <p className="mt-7 max-w-2xl border-l-2 border-[var(--color-rule-strong)] pl-5 text-[15px] leading-relaxed text-[var(--color-ink-secondary)]">
          {CONCERNS[worst.concern].label} moved{" "}
          <span className="tabular text-[var(--color-ink)]">
            {Math.abs(worst.drift).toFixed(1)} points
          </span>{" "}
          across {windowMinutes} minutes of a single sitting. The recording ran into late
          afternoon and the daylight faded, and the score followed it. A tracker comparing
          Monday against Tuesday would have called that progress.
        </p>
      )}
    </div>
  );
}
