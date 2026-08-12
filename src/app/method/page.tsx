import type { Metadata } from "next";
import Link from "next/link";

import { Reveal } from "@/components/reveal";
import reliability from "@/data/reliability-summary.json";

export const metadata: Metadata = {
  title: "Method, Assay",
  description:
    "How Assay separates a real change from measurement error: the standard error of measurement, the minimal detectable change, and the measured error budget of the YouCam Skin Analysis API.",
};

export default function MethodPage() {
  return (
    <div className="mx-auto max-w-3xl px-6">
      <Reveal as="section" className="pt-20 pb-14 sm:pt-28">
        <p className="tabular text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
          Method
        </p>
        <h1 className="mt-5 font-serif text-[42px] leading-[1.1] tracking-[-0.01em] sm:text-[52px]">
          How to tell a result from a shadow.
        </h1>
        <p className="mt-6 text-[17px] leading-relaxed text-[var(--color-ink-secondary)]">
          Every number on this site is either measured or derived from something measured.
          This page shows the working, including the parts that complicate the story.
        </p>
      </Reveal>

      <Section
        index={1}
        number="01"
        title="A score is a measurement, and measurements have error"
      >
        <p>
          The YouCam Skin Analysis API returns sixteen skin outputs in standard
          definition. Assay models the fourteen that are continuous 0 to 100 scores with
          a direction, and leaves out <code>skin_type</code>, which is a category rather
          than a quantity, and <code>tear_trough</code>, which it has not characterised a
          noise floor for. It is a genuinely good instrument. But like any instrument it
          has error, and a score reported without its error is a number you cannot make a
          decision with.
        </p>
        <p>
          The dermatology imaging literature is blunt about the cause. Variation in
          illumination produces image differences &ldquo;not attributable to skin
          condition, thereby lessening the probative value of digital imaging
          analysis.&rdquo; Change the lamp, change the number.
        </p>
        <p>
          So before Assay measures your skin, it measures how much the instrument moves
          when your skin has <em>not</em> changed.
        </p>
      </Section>

      <Section
        index={2}
        number="02"
        title="The model is deterministic, so all the error is capture"
      >
        <p>
          This matters more than it sounds, and it is the first thing worth checking. The
          noise floor is estimated from the spread across replicate frames taken seconds
          apart, and that spread is attributed entirely to capture variation. That
          attribution is only valid if the model itself returns the same answer for the
          same input.
        </p>
        <p>
          Perfect Corp does not publish this, so I measured it: the same file, byte for
          byte, analysed three times.
        </p>

        <Figure caption="Byte-identical input, three analyses. Standard deviation, in score points.">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-rule)] text-left text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
                <th className="pb-2 font-normal">Concern</th>
                <th className="pb-2 text-right font-normal">Range</th>
                <th className="pb-2 text-right font-normal">SD</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {reliability.determinism.map((row) => (
                <tr
                  key={row.concern}
                  className="border-b border-[var(--color-rule)] last:border-0"
                >
                  <td className="py-1.5 font-sans">{row.concern}</td>
                  <td className="py-1.5 text-right">{row.range.toFixed(3)}</td>
                  <td className="py-1.5 text-right">{row.sd.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Figure>

        <p>
          Zero, everywhere. The model is fully deterministic. Every point of spread
          between two of your frames is capture variation, and none of it is the model
          changing its mind. That is what licenses the rest of this page.
        </p>
      </Section>

      <Section index={3} number="03" title="The error budget, by source">
        <p>
          Because model noise is zero, the remaining error can be pulled apart by cause.
          Same synthetic face, same framing, one variable changed at a time.
        </p>

        <Figure caption="Score movement in points, by source of variation. Larger is worse.">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-rule)] text-left text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
                <th className="pb-2 font-normal">Source</th>
                {reliability.budgetConcerns.map((c) => (
                  <th key={c} className="pb-2 text-right font-normal">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular">
              {reliability.budget.map((row) => (
                <tr
                  key={row.source}
                  className="border-b border-[var(--color-rule)] last:border-0"
                >
                  <td className="max-w-[180px] py-1.5 font-sans">{row.source}</td>
                  {row.values.map((v, i) => (
                    <td
                      key={i}
                      className="py-1.5 text-right"
                      style={
                        v >= 3
                          ? { color: "var(--color-alert)", fontWeight: 500 }
                          : undefined
                      }
                    >
                      {v.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Figure>

        <p>
          Two things fall out of this. Re&#8209;saving the same photograph at a different
          JPEG quality, pixels a person cannot tell apart, moves the blemish score by{" "}
          <Num>2.91</Num> points. And an eight percent brightness change, roughly a lamp
          against a window, moves it by <Num>4.86</Num>.
        </p>
        <p>
          That is larger than most genuine one&#8209;week treatment effects. A tracker
          that compares today&rsquo;s score against yesterday&rsquo;s, with no error
          model, is substantially reporting the weather.
        </p>
        <p>
          It is also why Assay fixes the capture pipeline: every frame is normalised to
          the same dimensions and the same JPEG quality before it is ever sent, so that at
          least those two sources are held constant.
        </p>
      </Section>

      <Section index={4} number="04" title="Turning error into a threshold">
        <p>
          Two standard quantities from clinical measurement science do the work. The first
          is the standard error of measurement, estimated directly as the pooled standard
          deviation across replicate frames within a session, following Bland and
          Altman&rsquo;s within&#8209;subject method. Your skin cannot change in the
          thirty seconds between frames, so all of that spread is instrument error.
        </p>

        <Formula>SEM = pooled within-session SD</Formula>

        <p>
          The second is the minimal detectable change: the smallest difference that can be
          distinguished from that error with 95% confidence.
        </p>

        <Formula>MDC&#8325; = 1.96 &times; &radic;2 &times; SEM</Formula>

        <p>
          The <span className="tabular">&radic;2</span> is there because two measurements
          are being compared and each carries its own error. The{" "}
          <span className="tabular">1.96</span> is the 95% point of the normal
          distribution.
        </p>
        <p>
          Because each session averages three frames, the error on a session mean is
          smaller by <span className="tabular">&radic;3</span>. Capturing three frames
          instead of one lowers the detection threshold by about <Num>42%</Num>, which is
          the entire reason the app asks for three.
        </p>
      </Section>

      <Section index={5} number="05" title="Then the verdict, with two ways of saying no">
        <p>
          A change is only reported when it exceeds MDC&#8325;. Below that, the honest
          answer is not zero and it is not a small improvement. It is &ldquo;cannot tell
          yet&rdquo;, and Assay separates that from a genuine null result, which almost
          nothing else does.
        </p>
        <ul className="mt-4 space-y-3 text-[15px] leading-relaxed">
          <Verdict label="Working" tone="working">
            The change clears the floor and the trend across every session agrees.
          </Verdict>
          <Verdict label="Getting worse" tone="worsening">
            The change clears the floor in the wrong direction. Reported early, before the
            concern&rsquo;s normal timescale, because an adverse reaction is exactly the
            thing that shows up fast.
          </Verdict>
          <Verdict label="Expected flare" tone="purge">
            Worse, but inside the window where this active is known to cause a temporary
            flare. Retinoids and BHAs purge before they help, and people quit good
            products over it.
          </Verdict>
          <Verdict label="Not working" tone="null">
            Flat, past the point where this ingredient should have done something, and
            with enough data to have caught it. A null result, not an early one.
          </Verdict>
          <Verdict label="No evidence yet" tone="pending">
            Flat, but the study cannot yet resolve an effect this size. Comes with the
            number of further sessions required.
          </Verdict>
          <Verdict label="Cannot measure" tone="saturated">
            The concern is pinned against the end of the scale and has no room to move.
            See below.
          </Verdict>
        </ul>
      </Section>

      <Section index={6} number="06" title="The trap in a perfect score">
        <p>
          During instrument characterisation the API returned a redness score of{" "}
          <Num>100.00</Num> on a clear face, on every single variant, including the full
          illumination sweep. Taken at face value that is a noise floor of zero: the most
          reliable metric on the panel.
        </p>
        <p>
          It is the opposite. A reading pinned to the top of its range cannot move upward,
          so it can never show improvement, and its zero variance is a ceiling artefact
          rather than precision. Reporting a beautifully tight error bar for a measurement
          that is not measuring anything would be the most misleading thing this app could
          do.
        </p>
        <p>
          So Assay detects it and declines. A concern sitting at the boundary of the scale
          and not moving is marked <em>cannot measure</em>, and no verdict is offered for
          it.
        </p>
      </Section>

      <Section index={7} number="07" title="What this does not do">
        <p>
          Assay is a measurement tool, not a medical device. It does not diagnose
          anything, and persistent or worsening skin problems belong with a dermatologist.
        </p>
        <p>
          The threshold for &ldquo;a change worth acting on&rdquo; is set at five points.
          That is a product decision, not a clinical constant: there is no published
          minimal clinically important difference for this scale, because establishing one
          requires anchor&#8209;based studies against patient&#8209;reported outcomes. It
          is stated here so it can be argued with.
        </p>
        <p>
          The error budget was measured on a synthetic face, which holds the subject
          perfectly constant but is one face. The per&#8209;user noise floor is measured
          on your own, which is the number that actually gates your verdict.
        </p>
        <p>
          A single subject cannot tell you what a product does in general. It can tell you
          what it is doing on you, which is the question you actually have.
        </p>
      </Section>

      <Reveal
        as="section"
        index={8}
        className="border-t border-[var(--color-rule)] py-14"
      >
        <p className="text-[15px] leading-relaxed text-[var(--color-ink-secondary)]">
          The reliability experiment is reproducible:{" "}
          <code className="tabular rounded-none bg-[var(--color-surface-sunken)] px-1.5 py-0.5 text-[13px]">
            node scripts/experiment-reliability.mjs
          </code>
          . Raw output is committed at{" "}
          <code className="tabular rounded-none bg-[var(--color-surface-sunken)] px-1.5 py-0.5 text-[13px]">
            experiments/reliability.json
          </code>
          .
        </p>
        <Link
          href="/calibrate"
          className="mt-7 inline-block rounded-none bg-[var(--color-ink)] px-5 py-2.5 text-[13px] tracking-[0.06em] uppercase text-[var(--color-paper)] transition-colors duration-150 hover:bg-[var(--color-spot)]"
        >
          Measure your own noise floor
        </Link>
      </Reveal>
    </div>
  );
}

function Section({
  number,
  title,
  children,
  index,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
  index: number;
}) {
  return (
    <Reveal
      as="section"
      index={index}
      className="border-t border-[var(--color-rule)] py-14"
    >
      <div className="flex gap-6">
        <span className="tabular hidden pt-1 text-[11px] text-[var(--color-ink-muted)] sm:block">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-[27px] leading-tight tracking-[0.005em]">
            {title}
          </h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-[var(--color-ink-secondary)]">
            {children}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function Figure({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure className="my-7">
      <div className="card overflow-x-auto p-5">{children}</div>
      <figcaption className="mt-2.5 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
        {caption}
      </figcaption>
    </figure>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="tabular my-5 rounded-none border border-[var(--color-rule)] bg-[var(--color-surface-sunken)] px-5 py-4 text-center text-[15px] text-[var(--color-ink)]">
      {children}
    </div>
  );
}

const TONES: Record<string, { bg: string; ink: string }> = {
  working: {
    bg: "var(--color-verdict-working-bg)",
    ink: "var(--color-verdict-working-ink)",
  },
  worsening: {
    bg: "var(--color-verdict-worsening-bg)",
    ink: "var(--color-verdict-worsening-ink)",
  },
  purge: { bg: "var(--color-verdict-purge-bg)", ink: "var(--color-verdict-purge-ink)" },
  null: { bg: "var(--color-verdict-null-bg)", ink: "var(--color-verdict-null-ink)" },
  pending: {
    bg: "var(--color-verdict-pending-bg)",
    ink: "var(--color-verdict-pending-ink)",
  },
  saturated: { bg: "var(--color-surface-sunken)", ink: "var(--color-ink-muted)" },
};

function Verdict({
  label,
  tone,
  children,
}: {
  label: string;
  tone: keyof typeof TONES;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:gap-4">
      <span
        className="tabular h-fit w-fit shrink-0 rounded-none px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em]"
        style={{ background: t.bg, color: t.ink }}
      >
        {label}
      </span>
      <span className="text-[var(--color-ink-secondary)]">{children}</span>
    </li>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="tabular text-[var(--color-ink)]">{children}</span>;
}
