# Assay, demo narration

**Read this out loud, don't perform it.** It is written the way you talk, not the
way a product page reads. Short sentences. Breathe at the line breaks.

Target: **95 seconds.** Hard ceiling is three minutes and judges are not required
to watch past it, so finishing early is a feature.

Everything in square brackets is a screen direction, not something you say.

---

## The script

> **[0:00, on your face, or on the app's landing page]**
>
> "Last year I spent about a hundred and seventy dollars on skincare.
>
> I have no idea if any of it worked.
>
> And the annoying part is, that's a measurable question. I just couldn't measure it."

> **[0:12, screen recording: the Assay landing page, then scroll to the instrument table]**
>
> "So I built Assay.
>
> It uses YouCam's Skin Analysis API, which scores fourteen things about your skin
> from one photo. It's a good instrument. That's not the problem.
>
> The problem is nobody tells you the error bar."

> **[0:25, the calibration table on screen, cursor moving down the radiance row]**
>
> "Here's what I mean. I recorded myself sitting still for fifteen minutes. Same
> chair, same camera, no product, nothing.
>
> My radiance score dropped nine and a half points.
> *(Exact figure is 9.54. "Nine and a half" is the honest way to say it out loud.)*
>
> My skin did not change. The sun went down a bit. That's it. That's the whole
> reason.
>
> Any app comparing today to yesterday would have called that a result."

> **[0:45, the floor column, then the green and grey badges]**
>
> "So Assay measures its own error first.
>
> It takes a few captures where nothing could have changed, works out how much the
> reading wobbles on your face, on your camera, and turns that into a threshold.
>
> Then it tells you which questions it can actually answer.
>
> Hydration and texture, it can. The floor's about three points, and a decent
> moisturiser moves more than that.
>
> Radiance and redness on this setup, it can't. So it says so, instead of making
> something up."

> **[1:05, the verdict card, on the real study data]**
>
> "And that's the verdict.
>
> Working. Not working. Or, not enough evidence yet, which is the one no other
> tracker will ever show you.
>
> If it's not sure, it says how many more days it needs."

> **[1:20, back to your face, or the landing page]**
>
> "It also knows what it's looking at. Ask it about a retinoid after three weeks
> and it refuses, because retinoids don't do anything measurable in three weeks
> and pretending otherwise is just wrong.
>
> Assay. It'll tell you when nothing happened.
>
> That turns out to be the useful part."

---

## Delivery notes

- **Do not smile through the numbers.** Say them flatly. The flatness is what
  makes them sound true.
- The line "My skin did not change. The sun went down a bit." is the whole video.
  Pause before it, and pause after it. Let it sit.
- Read the money line at the very top like you are slightly annoyed at yourself,
  because you are. That is the honest register and it is instantly relatable.
- If you fluff a line, restart the sentence rather than the take. Cuts are fine.
- Record the audio in one pass and cut the screen recording to it afterwards.
  Trying to narrate live while clicking is what makes demos sound stiff.

## What has to be on screen

In order, with roughly how long each needs:

| Time | Shot | Where it comes from |
| ---- | ---- | ------------------- |
| 0:00 | You, or the landing hero | Webcam, or the deployed site |
| 0:12 | Landing page, scrolling | Deployed site |
| 0:25 | The instrument table, radiance row | The home page, real calibration data |
| 0:45 | The floor column and the badges | Same table |
| 1:05 | A verdict card | Home page, once the study has treatment days |
| 1:20 | Landing page or your face | Either |

## Rules from the hackathon that affect the video

- Must be **publicly viewable on YouTube**, no password, no login.
- Must **show the project running on the device it was built for**, so real screen
  recording of the deployed site, not slides.
- Must **explain which YouCam API is used**. The line at 0:12 does that; do not cut
  it.
- **No copyrighted music.** Silence is fine. Silence is better than a stock track,
  and it makes the numbers land harder.

## The one thing not to do

Do not open on the architecture, the statistics, or the API. Open on the money and
the annoyance. The method is why a judge believes you; it is not why they keep
watching.
