# Assay, demo voiceover script

**Written before the first commit.** This is the focus test (rule 25). If the build grows
past what this script can carry in 90 seconds, the build is wrong, not the script.

Target: **85 seconds.** Hard ceiling 3:00 per hackathon rules, but we are not using it.

---

## The script

> **[0:00–0:11], The hook. One person, one number.**
>
> *(Screen: a bathroom shelf. Four half-used bottles.)*
>
> "The average woman spends a hundred and seventy dollars a year on skincare that
> turns out not to work. She's holding four bottles right now that didn't deliver.
> Nobody can tell her which ones, because nobody can measure it."

> **[0:11–0:26], The flaw in every skin tracker, shown not stated.**
>
> *(Screen: split view. Same face, two photos taken ten minutes apart: one by a
> window, one under a lamp. Left panel is a naive tracker. Right panel is Assay.)*
>
> "Here's the same face, ten minutes apart. Only the lighting changed."
>
> *(Left panel animates: `radiance +9 ▲ great progress!`)*
>
> "A skin tracker tells her she's improving."
>
> *(Right panel: `Δ 9.0  ·  MDC₉₅ ±11.4  ·  NO CHANGE DETECTED`)*
>
> "Assay tells her the truth. That's her lamp, not her skin."

> **[0:26–0:44], The mechanism. Why we can say that.**
>
> *(Screen: the calibration run. Three frames captured, error bars resolving per concern.)*
>
> "Before Assay measures your skin, it measures its own error. Three frames,
> and YouCam's Skin Analysis API gives us a per-concern noise floor for your face,
> on your device. That's a standard error of measurement: the same statistic a
> clinical instrument has to publish before anyone is allowed to trust it."
>
> *(Concern rows settle: `texture ±3.1`, `redness ±4.0`, `radiance ±11.4`)*
>
> "Now a change has a bar to clear."

> **[0:44–1:08], The payoff. Real data, real product, real verdict.**
>
> *(Screen: the verdict view. Real 20-day study. Real product.)*
>
> "This is twenty days of my own face, captured every other day, on a retinoid I'm
> actually using."
>
> *(Row 1 resolves green:)*
>
> "Texture is up eleven points. The floor is three. That clears it, **this is working.**"
>
> *(Row 2 resolves amber:)*
>
> "The vitamin C serum is up one point against a floor of four. Assay won't
> call that. It says **not enough evidence yet**, and tells her exactly how many
> more sessions it needs before it can."
>
> "No other tracker will ever show you that row. That row is the product."

> **[1:08–1:22], The second act. One screen. The business.**
>
> *(Screen: the panel view. Twelve subjects, one product, effect sizes and CIs.)*
>
> "And because the instrument is calibrated, it aggregates. Twelve people, twenty-eight
> days, one product, with confidence intervals. A contract research lab charges
> twenty-five to eighty thousand dollars for this study. This one cost two hundred."
>
> "Same YouCam API. It just stopped being a widget and became an instrument."

> **[1:22–1:25], Close.**
>
> *(Logo. Tagline.)*
>
> "Assay. Know if it's working."

---

## Focus test, did it pass?

- One sentence pitch: **"It tells you whether your skincare is actually working, by
  measuring its own error first."** ✅
- Number a judge repeats without notes: **"$170 a year on skincare that doesn't work"**
  and **"a $50,000 clinical panel for $200."** ✅
- Familiar form + AI twist (rule 15): **"a lab result for your face."** Judge maps it
  in three seconds. ✅
- One flagship feature (rule 9): **the verdict.** Calibration exists to serve it. The
  panel screen is one shot. ✅
- Live on real data (rule 31): **20 days of real capture, real product, real face.** ✅
- Cuts required: **five.** Not six UIs. ✅

## What this script forbids

Anything that cannot appear in these 85 seconds does not get built. Explicitly out of scope:

- Apparel VTO (would break rule 9: the prizes are overall, not per-track)
- Localization (rule 21)
- Social / sharing / streaks / gamification
- An LLM chat coach (every competitor has one; it dilutes the verdict)
- Ingredient databases (OurSkinOurFuture owns that lane)

## Stretch, gated on evidence

Split-face mode (product on one half of the face, control on the other, read from a
single photo) is the strongest possible version of the thesis: a true within-subject
control with zero lighting confound by construction. **Gated entirely on whether
`mask_urls` returns spatially-aligned masks.** Verify with the first real API call.
If masks are not spatial, this is dropped without regret; it is not a dependency.
