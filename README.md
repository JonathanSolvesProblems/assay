# Assay

**Know if it's working.**

Assay tells you whether a skincare product is actually doing anything on your
face, by measuring its own error before it measures your skin.

Built on the [YouCam Skin Analysis API](https://yce.perfectcorp.com/ai-api) for
the YouCam API Skin AI & Apparel VTO Hackathon.

**[Watch the 2 minute demo](https://www.youtube.com/watch?v=2TTFyaoxwjE)**  ·  **[Try it live](https://assay.jonathanandrei.com)**  ·  **[The method](https://assay.jonathanandrei.com/method)**

---

## The problem

The average woman spends around $170 a year trying to find skincare that is right
for her, and is still holding on to four products that did not work. One in nine
have been through ten or more. Nobody can tell her which four, because nobody can
measure it.

Those figures are from a [survey of 2,000 American women aged 35 and over,
commissioned by AmLactin and conducted by OnePoll in February
2022](https://swns-research.medium.com/women-reveal-how-many-failed-skincare-products-theyre-still-holding-onto-f1091f8a7b1f).
The same survey found a product gets about three weeks to prove itself, which is
shorter than the onset window of almost every active ingredient it might contain,
and is the reason Assay refuses to return a verdict before an ingredient has had
time to work. A separate [survey of 2,000 UK adults for The Body
Shop](https://professionalbeauty.co.uk/site/newsdetails/more-than-1-billion-in-skincare-products-wasted-uk)
puts the value of abandoned skincare in the UK alone at over £1 billion.

The measurement exists. YouCam's Skin Analysis API scores sixteen skin outputs
from a photograph, and it is a genuinely good instrument. The problem is that a
score reported without its error is a number you cannot make a decision with.

Assay measured how bad that gets. Same face, one variable changed at a time:

| Source of variation | acne | moisture | texture | pore |
| ------------------- | ---: | -------: | ------: | ---: |
| The model itself (byte-identical input) | 0.00 | 0.00 | 0.00 | 0.00 |
| JPEG quality, q80 to q96 | 2.91 | 0.35 | 0.12 | 2.55 |
| Brightness, plus or minus 8% | **4.85** | 3.87 | 1.96 | 1.52 |
| **Cropping the same photograph differently** | | | **5.81** | |

A realistic four-week treatment effect is about five points. Re-saving the same
photograph at a different compression level moves the blemish score by 2.91.
Standing slightly closer to the camera than you did last week moves texture by
5.81. A tracker that compares today's score against yesterday's, with no error
model, is substantially reporting the lighting.

## What Assay does about it

Before it says anything about your skin, Assay measures how much the reading
moves when your skin has **not** changed, then requires any claimed change to
clear that bar.

Two standard quantities from clinical measurement science do the work:

```
SEM    = pooled standard deviation across replicate captures
MDC₉₅  = 1.96 × √2 × SEM
```

The `√2` is there because two measurements are being compared and each carries
its own error. Below that threshold, the honest answer is not zero and it is not
a small improvement. It is "cannot tell yet", and Assay says so, with the number
of further sessions required.

### The verdicts

| Verdict | Meaning |
| ------- | ------- |
| **Working** | Change clears the noise floor and the trend across all sessions agrees |
| **Getting worse** | Change clears the floor in the wrong direction. Reported early, because an adverse reaction shows up fast |
| **Expected flare** | Worse, but inside the window where this active is known to purge. Retinoids and BHAs get worse before they help, and people quit good products over it |
| **Not working** | Flat, past the point where this ingredient should have done something, with enough data to have caught it. A null result, not an early one |
| **No evidence yet** | Flat, but the study cannot yet resolve an effect this size |
| **Cannot measure** | The concern is pinned against the end of the scale and has no room to move |

Separating **not working** from **no evidence yet** is the part almost nothing
else does. Telling someone their retinoid failed at three weeks is not a cautious
result, it is a wrong one: retinoids do not remodel anything on that timescale.
Assay knows the onset window for each active and refuses to render a verdict
before it.

## Why the noise floor is measured between sessions

Frames taken seconds apart without touching the camera capture sensor and pose
noise, and nothing else. They cannot see the error you add by setting the camera
back up tomorrow, which the crop experiment above shows is the largest error
there is.

So calibration is several sessions separated in time rather than several frames
separated in seconds. Skin cannot change in twenty minutes, so the spread across
those session means is pure measurement error rather than biology.

One thing to be clear about, because it is the limit of the number rather than a
detail. The three calibration sessions in this study are sampled from separate
windows of a single continuous recording, at 120s, 520s and 900s. That captures
the pose, distance and expression drift that accumulates between sittings, but
not the error of physically taking the camera down and setting it back up. The
floor it yields is therefore a **lower bound** on the true between-session error,
and the honest consequence runs against the project: an underestimated floor
makes verdicts fire more readily than they should, not less. A calibration with a
genuine teardown between sessions would widen every band below and make every
verdict harder to earn. `src/data/study.json` records this on the calibration
block itself, and the app takes whichever is larger, the between-session error or
the frame-level error, never the smaller, which is what keeps this bound from
collapsing further.

## Running it

```bash
pnpm install
cp .env.example .env.local     # add your YouCam API key
pnpm dev
```

| Command | What it does |
| ------- | ------------ |
| `pnpm dev` | Run the app |
| `pnpm test` | 92 tests, no network, no API units spent |
| `pnpm typecheck` | Type check |
| `node scripts/verify-youcam.mjs` | Check your key, balance and per-feature costs. Spends nothing |
| `node scripts/capture.mjs --dir captures/day1 --type treatment --day 1` | Ingest a capture session |
| `node scripts/experiment-reliability.mjs` | Re-run the instrument characterisation |

Capture protocol is in [CAPTURE.md](CAPTURE.md). Everything learned about the
API, including several behaviours that contradict or are missing from the docs,
is in [API_FINDINGS.md](API_FINDINGS.md).

## Deploying

The app is a standard Next.js build. The only required environment variable is
`YOUCAM_API_KEY`, which must be set on the host and is read only on the server.

```bash
vercel login
vercel link
vercel env add YOUCAM_API_KEY production
vercel --prod
```

Two things worth knowing before deploying elsewhere:

- `/api/analyze` runs frames serially and is capped at `maxDuration = 60`, which
  is the Hobby-tier ceiling on Vercel. A three-frame session lands around 20 to 30
  seconds. Raising the cap on a host that allows it is safe; lowering it is not,
  because a request killed mid-session has already spent the units.
- The key is a bearer credential with spend attached. It is never exposed to the
  client, and `.env.local` is gitignored.

## YouCam APIs used

- **AI Skin Analysis** (`/s2s/v2.0/task/skin-analysis`) is the core instrument.
  Six SD concerns per session, scored on `raw_score` rather than `ui_score`
  because the latter is a rounded non-linear remap and a noise floor built from
  integers would be quantised rather than precise.
- **AI Image Generator** (`/s2s/v2.0/task/text-to-image/youcam`) generated the
  synthetic reference face used for instrument characterisation, so that no real
  person had to be scored to produce those numbers.
- **Credit and feature-cost endpoints** for the budget guard that refuses to
  start a session it cannot afford.

## Structure

```
src/lib/stats/         distributions, reliability, inference, the verdict engine
src/lib/domain/        the 14 concerns, and actives with their onset windows
src/lib/youcam/        API client: rate limiting, retries, budget guard
src/lib/study/         study loading and verdict assembly
src/app/               verdict, calibrate, method, and the analysis route
scripts/               capture ingest, instrument characterisation, key check
experiments/           raw output backing every number on the method page
```

The statistics are implemented directly rather than pulled from a package,
because the whole claim of this project is that the numbers are defensible and a
reviewer should be able to check them against a table. Every expected value in
`src/lib/stats/stats.test.ts` is hand-computed from the definition or taken from
a published table, never from a previous run of the code.

## Honest limitations

- **Not a medical device.** No diagnosis, no treatment, no medical advice.
- The threshold for "a change worth acting on" is set at five points. That is a
  product decision, not a clinical constant: there is no published minimal
  clinically important difference for this scale, because establishing one needs
  anchor-based studies against patient-reported outcomes.
- The error budget was measured on a single synthetic face. That holds the
  subject perfectly constant, which is what instrument characterisation needs,
  but it is one face. The per-user noise floor is measured on your own, and that
  is the number that gates your verdict.
- A single subject cannot tell you what a product does in general. It can tell
  you what it is doing on you, which is the question you actually have.

## Licence

MIT, see [LICENSE](LICENSE).

Assay is a measurement tool. It is not a medical device, it does not diagnose or
treat any condition, and nothing it reports is medical advice. Persistent or
worsening skin problems belong with a dermatologist.

The YouCam and Perfect Corp APIs this project calls are the property of Perfect
Corp and are governed by their own terms. The licence above covers only the code
in this repository.

## Sources

Every external figure quoted in this repository, on the site, or in the demo
video, with what it supports.

**Consumer figures.** [Women reveal how many failed skincare products they're
still holding onto](https://swns-research.medium.com/women-reveal-how-many-failed-skincare-products-theyre-still-holding-onto-f1091f8a7b1f),
SWNS Research, 15 February 2022. A survey of 2,000 American women aged 35 and
over, commissioned by AmLactin and conducted by OnePoll. Source of the four
failed products still being held, the roughly $170 a year spent trying to find
products that are right for them, the one in nine who have been through ten or
more, and the finding that a product gets about three weeks to prove itself
before people decide.

**Wasted skincare.** [More than £1 billion in wasted skincare products sitting
in homes across the UK](https://professionalbeauty.co.uk/site/newsdetails/more-than-1-billion-in-skincare-products-wasted-uk),
Professional Beauty. A separate survey of 2,000 UK adults for The Body Shop,
which found an average of two unused or abandoned products per person at £35.02
each. Quoted only for the £1 billion total; it is not the source of the four
products figure above and the two surveys are not combined anywhere.

**The displayed score.** [AI Skin Analysis, Inputs and
Outputs](https://docs.perfectcorp.com/reference/ai_skin_analysis/section/overview/inputs-and-outputs),
Perfect Corp developer documentation. Source of the description of `ui_score` as
"a psychological motivator" adjusted upward because "consumers generally prefer
positive evaluations regarding their skin health", and of the full standard and
high definition output lists.

**Product claim under test.** Dove Men+Care Extra Fresh Body & Face Wash, whose
label states "24-hour nourishing Micromoisture that continuously nourishes your
skin all day". That stated timescale is what sets the assessment window used in
`src/data/study.json`.

**Method.** The standard error of measurement is estimated by Bland and Altman's
within-subject method, and the minimal detectable change as 1.96 × √2 × SEM,
both standard in clinical measurement science. The illumination quotation on the
method page is from the dermatology imaging literature and is cited in place
there.

Every other number in this repository was measured by calling the YouCam API
directly. Those measurements, and how to reproduce them, are in
[API_FINDINGS.md](API_FINDINGS.md).
