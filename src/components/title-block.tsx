/**
 * The head of an issued document.
 *
 * A calibration certificate opens by stating what was measured, with what, against
 * what reference, on what date, and whether the result is fit for its stated
 * purpose. Putting that at the top does the same job here: before a visitor reads
 * a single score they know this is a record of a specific measurement on a
 * specific subject, not a marketing page with numbers on it.
 *
 * It is also the honest place to carry the study's status. A certificate with no
 * measurements yet says so in its own header rather than hiding it.
 */
export function TitleBlock({
  fields,
  status,
}: {
  fields: { label: string; value: string }[];
  status: { label: string; tone: "issued" | "pending" };
}) {
  return (
    <div className="titleblock">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5 py-5">
        <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
          {fields.map((field) => (
            <div key={field.label}>
              <dt className="tabular text-[9px] tracking-[0.14em] text-[var(--color-ink-muted)] uppercase">
                {field.label}
              </dt>
              <dd className="tabular mt-1 text-[13px] text-[var(--color-ink)]">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>

        <div
          className="tabular shrink-0 border px-3 py-1.5 text-[10px] tracking-[0.12em] uppercase"
          style={
            status.tone === "issued"
              ? {
                  borderColor: "var(--color-spot)",
                  color: "var(--color-spot)",
                }
              : {
                  borderColor: "var(--color-rule-strong)",
                  color: "var(--color-ink-muted)",
                }
          }
        >
          {status.label}
        </div>
      </div>
    </div>
  );
}
