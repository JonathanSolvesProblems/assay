# YouTube upload block, demo video

Set visibility to **Public**. Not unlisted: a judge who cannot open the link
loses you the criterion the video was made to satisfy.

---

## Title

*(66 characters)*

```
Assay: does your skincare actually work? Measuring with an error bar
```

## Description

```
Most skin trackers report your lighting as progress. Assay measures its own error
first, then only calls a change real when it beats that margin on your face, on
your device. It is the only skin tracker that tells you when it cannot tell.

Built on the YouCam Skin Analysis API by Perfect Corp, for the YouCam API Skin AI
and Apparel VTO Hackathon.

--- WHAT THIS VIDEO SHOWS ---

Three findings, all measured rather than asserted:

1. The score you are shown is not the score that was measured. Perfect Corp's own
   developer documentation describes the displayed value as "a psychological
   motivator", adjusted upward because "consumers generally prefer positive
   evaluations regarding their skin health". On my face, hydration measured 45.4
   and displayed 68. A 22.6 point upward adjustment.

2. Nobody gives you an error bar. I sat still in front of a camera for 15 minutes
   with nothing applied, so my skin could not have changed. My radiance score fell
   9.5 points anyway. The afternoon light faded and the score followed it.

3. Across those same 15 minutes, a tracker that compares today's score to last
   time would have reported 10 of 12 comparisons as a real change in my skin. The
   largest was a 17 point swing in redness. Every one would have been false. Assay
   reported none of them, because it had already measured what the instrument does
   when nothing happens.

Then it runs a real 4-day study on my own face and returns a verdict I did not
want: texture down 7.5 points against a 3.1 point noise floor, so it cleared.
Getting worse, on a product I bought. Four other concerns did not clear their
bars, and it says so plainly instead of dressing them up as progress.

--- LINKS ---

Live app ............ https://assay.jonathanandrei.com
Source code (MIT) ... https://github.com/JonathanSolvesProblems/assay
The method, in full . https://assay.jonathanandrei.com/method
Calibrate your own .. https://assay.jonathanandrei.com/calibrate
YouCam API .......... https://yce.perfectcorp.com/ai-api
My other work ....... https://jonathanandrei.com

Everything I learned about the Skin Analysis API is in API_FINDINGS.md in the
repository: fourteen documented behaviours, several of which are absent from or
contradict the published documentation, including a frame that satisfies every
documented limit and still never completes while charging you for it.

--- CHAPTERS ---

0:00 I could never tell which products worked
0:19 What this costs people, with the sources
0:34 The YouCam Skin Analysis API
0:48 The score you see is not the score measured
1:16 Fifteen minutes, nothing changed
1:24 Ten false results out of twelve
1:37 How Assay fixes it
1:59 The study
2:07 The verdict
2:30 Where to find it

--- HOW IT IS BUILT ---

Next.js, TypeScript, React and Tailwind, deployed on Vercel. The YouCam Skin
Analysis API is the measurement instrument. Every frame is normalised to a fixed
size, JPEG quality and crop before upload, because all three of those were
measured moving the score.

The statistics are implemented from their definitions rather than pulled from a
package: the log gamma and incomplete beta functions, Student's t, the standard
error of measurement, the minimal detectable change, an ordinary least squares
trend with inference on the slope, and a power projection that answers "how many
more sessions". The whole claim of the project is that the numbers are defensible,
so a reviewer should be able to read the implementation and check it against a
table. 92 tests, none of which touch the network or spend an API unit.

--- SOURCES ---

Consumer figures: AmLactin / OnePoll survey of 2,000 American women aged 35 and
over, February 2022. Abandoned skincare in the UK: The Body Shop survey of 2,000
UK adults, reported by Professional Beauty. Both are linked in the repository's
README. The ui_score description is quoted from Perfect Corp's public AI Skin
Analysis documentation.

Assay is a measurement tool, not a medical device. It does not diagnose or treat
anything, and persistent or worsening skin problems belong with a dermatologist.

#skincare #ai #datascience #buildinpublic #hackathon
```

## Tags

*(15, broad to exact)*

```
skincare, does skincare work, skin analysis, skincare science, skincare routine,
measurement error, skin analysis api, youcam api, perfect corp, ai skincare,
skin tracker app, noise floor, n-of-1 study, quantified self, hackathon project
```

---

## Using the same block on the Short

It works, and the description and tags carry over unchanged. Two things to know.

**Drop the chapters.** Shorts do not render them, so they become clutter in the
description. Everything above the Chapters line is worth keeping.

**Change the title.** This is the one real difference, and it matters. The demo
title leads with the project name because a judge arriving from Devpost needs to
confirm they are in the right place. A Short is served to strangers who have never
heard of Assay, and a project name in the first words is dead weight. Use:

```
Your skin score is inflated on purpose. Docs admit it.
```

That is the title in `broll/short.metadata.md`, which also has a shorter
description tuned for the swipe feed. Either description works on the Short; that
one is tighter.

---

## Notes

The title states a question the video answers in full, and "measuring with an
error bar" is the differentiator no other entry can claim. Nothing in the title
or description is a claim the video does not pay off.

Every number quoted here is verified against `src/data/study.json` and
`src/data/reliability-summary.json`. The consumer figures are cited on the site
and in the README's Sources section.
