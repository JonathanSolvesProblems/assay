# YouTube Short, upload block

## Title

*(54 characters)*

```
Your skin score is inflated on purpose. Docs admit it.
```

## Description

```
Perfect Corp's own developer documentation describes the skin score their API
displays as "a psychological motivator", adjusted upward because "consumers
generally prefer positive evaluations regarding their skin health". On my face,
hydration measured 45.4 and displayed 68.

Then I sat still in front of a camera for 15 minutes with nothing applied. My skin
could not have changed. My radiance score fell 9.5 points anyway, and a tracker
comparing today's score to last time would have reported 10 of 12 comparisons as a
real change. Every one would have been false.

So I built Assay: it measures the instrument's own error before it measures your
skin, and only calls a change real when it beats that margin. It is the only skin
tracker that tells you when it cannot tell.

--- LINKS ---

Live app ............ https://assay.jonathanandrei.com
Source code (MIT) ... https://github.com/JonathanSolvesProblems/assay
The method, in full . https://assay.jonathanandrei.com/method
YouCam API .......... https://yce.perfectcorp.com/ai-api
My other work ....... https://jonathanandrei.com

Full 2 minute version on this channel, including the 4 day study on my own face
and the verdict it returned: texture down 7.5 points against a 3.1 point noise
floor. Getting worse, on a product I bought.

--- HOW IT IS BUILT ---

Next.js and TypeScript, with the YouCam Skin Analysis API as the measurement
instrument. The statistics are implemented from their definitions rather than
pulled from a package: standard error of measurement, minimal detectable change,
an ordinary least squares trend with inference on the slope, and a power
projection. 92 tests, none of which touch the network.

Everything I learned about the API is in API_FINDINGS.md in the repository:
fourteen documented behaviours, several absent from or contradicting the published
docs.

--- SOURCES ---

The ui_score description is quoted from Perfect Corp's public AI Skin Analysis
documentation. Consumer figures elsewhere in this project come from an AmLactin /
OnePoll survey of 2,000 American women aged 35 and over, February 2022, linked in
the repository README.

Assay is a measurement tool, not a medical device. It does not diagnose or treat
anything, and persistent or worsening skin problems belong with a dermatologist.

#skincare #ai #datascience #buildinpublic #skintok
```

## Tags

*(15)*

```
skincare, does skincare work, skin analysis, skincare science, skincare routine, measurement error, skin analysis api, youcam api, perfect corp, ai skincare, skin tracker app, noise floor, n-of-1 study, quantified self, skincare myths
```

---

## Notes

**First frame** shows the quoted line from Perfect Corp's documentation, with
"psychological motivator" in yellow. No logo, no title card, no build-up.

**Topic pool: broad.** The subject is skincare apps and whether skincare works,
not this project. "Assay" is not named until the final beat, deliberately.

**What the video actually proves**, so the title is paid off:
- The quoted phrase is verbatim from the public YouCam API documentation
- 68 vs 45.4 is a real reading from one photo of my own face
- The 9.5 point radiance drift and the 10-of-12 count come from three calibration
  sessions taken 15 minutes apart with nothing applied

Nothing in the Short is claimed that is not on the site or in the repo.

**Runtime** 54.1s, 1080x1920, well inside the 3:00 Shorts ceiling.
