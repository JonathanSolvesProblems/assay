# Demo script

Target 95 seconds. Read the block below straight through, once, at a normal
speaking pace. Everything after it is for editing, not for reading.

Final. Every number below is verified against the live site as of the day 4
capture. Nothing further will change.

---

## READ THIS ALOUD

I had acne growing up. I tried a lot of products, and I could never tell which ones were actually working, so I just kept buying more.

It's under control now, but the problem never really went away. There's a face wash I use every morning that promises twenty-four hour moisturisation, and I genuinely couldn't tell you whether it does anything. Most people can't. The average woman is holding on to four products that didn't work, and spends about a hundred and seventy dollars a year trying to find ones that do.

So I built Assay.

It runs on YouCam's Skin Analysis API, which scores sixteen things about your skin from a single photo. It's a good instrument. But there are two things nobody tells you about the number it gives back.

The first is that the score you see isn't the score it measured. Perfect Corp's own documentation calls the displayed number a psychological motivator, adjusted upward because people prefer good news about their skin. On my face, moisture measured forty-five. It showed me sixty-eight.

The second is that nobody gives you an error bar. So I sat still in front of a camera for fifteen minutes. My skin didn't change. My radiance score dropped nine and a half points.

In those same fifteen minutes, a tracker that just compares today's score to last time would have told me my skin changed ten separate times. All ten were wrong. There was nothing there to find.

So Assay measures its own error first. Three frames, a few seconds apart, on your face, on your device. Whatever they disagree by becomes the bar that every future change has to beat. It reported none of those ten.

Then it runs the actual study. This is my face, four days of that face wash, measured against my own noise floor. It promises twenty-four hour moisturisation, so I'm judging it on its own timetable.

Texture came back down seven and a half points. Its bar was three point one, so it cleared, and Assay calls it: getting worse. The other four didn't clear their bars, and it says so, instead of dressing them up as progress.

Any other app would have told me I was improving.

Mine told me I got worse, on something I paid for. That's the whole point. I'd rather know.

---

## Word count and pacing

About 320 words, which lands between 95 and 105 seconds at a normal talking
pace. Do not rush to hit 90. If it runs long, drop the sentence "There was
nothing there to find."

Read it the way you would explain it to a friend who actually asked, not the way
you would read a script. Contractions are deliberate, so say "didn't" and
"couldn't" rather than straightening them out.

The product is just "a face cream" out loud, which is also what it is. An
ingredient name most people cannot define is a word the listener stops to decode,
and they miss the next sentence doing it.

Four places to slow down, because they are the whole argument: **forty-five, it
showed me sixty-eight**, **nine and a half points**, **ten separate times**, and
the last line.

The two "nobody tells you" beats are the spine. Everything before them is setup
and everything after is payoff.

---

## Shot mapping

| Time | You say | On screen |
|---|---|---|
| 0:00 | "I had acne growing up... kept buying more" | Landing hero, held still |
| 0:11 | "the average woman is holding on to four... hundred and seventy dollars" | Scroll to the four impact figures, **pausing long enough that the source line under them is readable** |
| 0:22 | "So I built Assay" | Hero settles |
| 0:26 | "scores sixteen things... good instrument" | Slow scroll past the study title block |
| 0:36 | "moisture measured forty-five. It showed me sixty-eight." | **The 68 vs 45.4 card, held** |
| 0:50 | "sat still for fifteen minutes... dropped nine and a half points" | **Instrument table, radiance row: 93.0 / 89.5 / 83.4, drift −9.5** |
| 1:00 | "my skin changed ten separate times. All ten were wrong." | **The 10-of-12 table, held** |
| 1:10 | "Three frames, a few seconds apart" | Calibrate: camera opens, LIGHTING OK chip, capture countdown |
| 1:18 | "the bar every future change has to beat" | Noise floor panel resolving, then concern overlays switching |
| 1:26 | "four days of that face wash... its own timetable" | Study section, "Result issued" status |
| 1:32 | "texture came back down seven and a half... it cleared" | **Texture verdict card, getting worse, −7.5 against ±3.1** |
| 1:40 | "the other four didn't clear their bars" | Scroll the remaining cards |
| 1:46 | "mine told me I got worse... I'd rather know" | Hold on the hero |

---

## How this answers the four criteria

**Technological Implementation.** The script names the API, states what it
returns, and then does something non-trivial with it: it separates `raw_score`
from the displayed value, characterises the instrument before trusting it, and
builds a per-user threshold from replicate frames. The 68 vs 45.4 beat proves
the integration goes deeper than calling an endpoint and printing a number,
because you cannot find that gap without reading both fields and the docs. The
consumer value is stated in the first line as a purchase decision, not a
feature.

**Design.** Carried by the footage rather than the words. The demo moves through
a complete product: a landing page that makes an argument, a guided capture with
live feedback, a result with per-concern overlays, and a method page showing the
working. Nothing in the cut is a placeholder or a mock.

**Potential Impact.** A specific audience, ordinary shoppers with a shelf of
products, a specific harm with a number attached, and a solution that addresses
that exact harm. The closing line is the impact claim: the tool changes what you
buy next, because it is willing to return nothing.

**Quality of the Idea.** The non-obvious move is stated outright. Every other
entry treats a skin score as a reading. This asks whether the reading is stable
enough to compare against yesterday's, and answers with measurements rather than
an assertion. The fifteen-minute drift and the motivator gap are both evidence
of genuine understanding of the problem space, and neither is something you find
without doing the work.

---

## Recording notes

- Record audio separately from the screen capture. Do not narrate live.
- One take, all the way through, even if you fumble. Pause, repeat the line, and
  keep going. Fix it in the edit.
- Phone voice memo held a hand's width away beats a laptop microphone.
- Kill the Video Capture Device source in OBS before capturing screen, or the
  camera path will fail.
- Upload the finished video to YouTube as **public**, not unlisted. A private or
  unlisted link that a judge cannot open is a scored submission lost.
