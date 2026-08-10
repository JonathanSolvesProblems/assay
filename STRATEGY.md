# Phase 0, why Assay, and why not the other seventeen things

Research completed 27 Jul 2026, before the first line of code.
Deadline: **17 Aug 2026, 11:45 EDT.** 798 registered participants.

## Judges

Listed only as "YouCam API Team". No individual judges are published; searches across
Devpost, the Perfect Corp newsroom and the WeAreDevelopers Berlin launch coverage
returned no names. Profiling the company instead:

- Perfect Corp (NYSE: PERF) sells API units to 800+ beauty and fashion brands. Their
  growth constraint is new use cases and new buyer segments.
- Prizes include a "Product/Developer Marketing Meeting" and a blog feature. They are
  scouting use cases for a sales deck, not just code.
- They publish a tutorial, *"Build a Skincare App Using Claude and YouCam Skin Analysis
  API"*. **That tutorial is the trap**: it describes the exact build most of the field
  is doing.
- Hackathon copy pushes "agentic AI workflows" and "self-learning styling AI agent".
  That is the loudest stated pain point, therefore the most crowded lane. Use it for
  pitch language, not for the idea.

## The field, at 17 submissions with 21 days left

| Lane | Taken by |
|---|---|
| Skin diary / "prove your routine works" | PerfectSkinDiary, skinwise |
| Fit confidence score | FitDNA, FitLens |
| Colour analysis / undertone | TrueHue (×2), GlowCast |
| Wardrobe / shopping agent | Loom, naxora, LOOK AI |
| Combined "mirror check" | MirrorMe, Mirror Session, GlowCast |
| Ingredient matching | OurSkinOurFuture |
| Returns reduction | LoopLook |
| Accessibility | Aloud, "first beauty AI a blind shopper can use alone" |
| Custom design | CriShirt |

Aloud is the strongest entry in the field: a specific, non-obvious audience with a
concrete stake. Every consumer-facing "analyse me, recommend to me" lane is occupied
and will hold 10–20 entries by the deadline.

**Structurally absent from all 17:** anything supply-side, anything treating Skin AI as
a *measurement instrument* rather than a scoring feature, anything whose output is
*evidence* rather than a *recommendation*.

## The opening

Every entry, and Perfect Corp's own tutorial, treats a skin score as a reading. A single
reading is dominated by capture noise. The dermatology imaging literature is explicit
that illumination variation produces image differences "not attributable to skin
condition, thereby lessening the probative value of digital imaging analysis."

So PerfectSkinDiary and skinwise are both built on an uncontrolled measurement and will
report lighting drift as progress. That is a provable flaw at the centre of the most
crowded lane, and it makes a fifteen-second demo that indicts all of it.

## The one number

- Women waste **~$170/year** on trial-and-error skincare
- The average person holds **4 products that never delivered**; **1 in 9** women have
  cycled through 10+
- **£1bn/year** of skincare abandoned in the UK alone
- Second act: a CRO efficacy panel costs **$25,000–$80,000**; the same engine runs one
  for ~$200

## Mapping to the judging criteria

| Criterion | How Assay earns it |
|---|---|
| Technological Implementation | Skin Analysis SD+HD across a real capture pipeline, rate-limited client, unit budget guard, plus a statistics engine with 79 tests |
| Design | One flagship screen, one question, a lab-report aesthetic that no pink-gradient competitor will share |
| Potential Impact | The numbers above, and a second buyer segment (brand R&D budgets, not marketing budgets) |
| Quality of the Idea | Explicitly rewards "genuine understanding of the problem space": an MDC calculation *is* that understanding, made visible |

## Rules from CLAUDE.md this build is enforcing

- **Rule 9**: one flagship feature: the verdict. Everything else serves it.
- **Rule 25**, demo script written before the first commit. See `DEMO_SCRIPT.md`.
- **Rule 31**: no simulated demo. Capture starts day one; by 17 Aug the demo runs on
  ~20 days of real within-subject data. `study.json` ships empty rather than seeded.
- **Rule 32**, headline in world units (dollars, products, days), not benchmark units.
- **Rule 34**: the honest "no evidence yet" verdict is the credibility layer *under* a
  big number, never a substitute for one.
- **Rule 36**, screened against the governance/meta-tool trap. Passes all five rescue
  tests: visible positive artifact, AI as engine, world-impact number, a problem 100% of
  skincare users have today, live on real data.
- **Rule 37**: the AI is the measurement instrument, not an advisory footnote. The
  statistics are the rail around it, and the pitch does not lead with "deterministic".

## Explicitly out of scope

Apparel VTO (prizes are overall, not per-track, adding it would break rule 9),
localisation (rule 21), social/streaks/gamification, an LLM chat coach (every competitor
has one), ingredient databases (OurSkinOurFuture owns that lane).

## Stretch, gated on evidence

Split-face mode: product on one half of the face, control on the other, read from a
single photo. A true within-subject control with no lighting confound by construction,
and the actual dermatology gold standard. **Gated entirely on whether `mask_urls`
returns spatially-aligned masks**, verify on the first real API call. Dropped without
regret if not.
