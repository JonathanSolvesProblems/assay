# Demo script

Target 95 seconds. Read the block below straight through, once, at a normal
speaking pace. Everything after it is for editing, not for reading.

One number changes after the day 4 capture: the acne line near the end. I will
confirm the final figures before you record.

---

## READ THIS ALOUD

I had acne growing up. I tried a lot of products, and I could never tell which ones were actually working, so I kept buying more.

It's under control now. But I still have four things on my shelf, and I still don't know which of them do anything. Neither does anyone else. That's about a hundred and seventy dollars a year, spent on products that don't work.

So I built Assay.

It runs on YouCam's Skin Analysis API, which scores sixteen things about your skin from a single photo. It's a good instrument. But there are two things nobody tells you about the number it gives you.

The first is that the score you're shown isn't the score that was measured. Perfect Corp's own documentation calls the displayed value a psychological motivator, adjusted upward because people prefer good news about their skin. On my face, moisture measured forty-five, and displayed sixty-eight.

The second is that nobody gives you an error bar. So I recorded myself sitting still for fifteen minutes. My skin did not change. My radiance score fell nine and a half points.

Across those fifteen minutes, a tracker that just shows you a score and compares it to last time would have reported ten changes in my skin. All ten were false. There was nothing to find.

That's why Assay measures its own error before it measures your skin. Three frames, seconds apart, on your face, on your device. The spread between them becomes the bar that every future change has to clear. Assay reported none of those ten.

Then it runs a real study. This is my face, day two, on a hyaluronic acid serum, scored against my own noise floor. My blemish score moved five points. The bar it has to beat is six point four.

So Assay tells me it can't tell yet, and shows me exactly how far it still has to go.

Every other skin app will tell you you're improving.

This is the one that will tell you when it doesn't know.

---

## Word count and pacing

About 300 words. At a natural, unhurried pace that lands between 90 and 100
seconds. Do not speed up to fit; if it runs long, cut the sentence beginning
"That's why Assay measures" down to "So Assay measures its own error first."

Read it like you're explaining it to a friend who asked a genuine question. The
two "nobody tells you" beats are the spine. Slow down on the two numbers that
matter: **forty-five and sixty-eight**, and **nine and a half points**.

---

## Shot mapping

| Time | You say | On screen |
|---|---|---|
| 0:00 | "I had acne growing up... kept buying more" | Landing hero, held still |
| 0:10 | "a hundred and seventy dollars a year" | Scroll to the four impact figures |
| 0:16 | "So I built Assay" | Hero settles |
| 0:20 | "scores sixteen things... good instrument" | Slow scroll past the study title block |
| 0:30 | "psychological motivator... forty-five, displayed sixty-eight" | **The 68 vs 45.4 card, held** |
| 0:45 | "sitting still for fifteen minutes... fell nine and a half points" | **Instrument table, radiance row: 93.0 / 89.5 / 83.4, drift −9.5** |
| 0:52 | "would have reported ten changes... all ten were false" | **The 10-of-12 table, held** |
| 1:02 | "Three frames, seconds apart" | Calibrate: camera opens, LIGHTING OK chip, capture countdown |
| 1:08 | "the bar every future change has to clear" | Noise floor panel resolving, then concern overlays switching |
| 1:18 | "day two... blemish score moved five points" | Study progress table, acne row |
| 1:28 | "can't tell yet, and shows me how far it has to go" | "Inside the noise by..." column |
| 1:33 | "tell you when it doesn't know" | Hold on the hero, or the method page's column of zeros |

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
