# Capture protocol

The whole submission rests on this. Six days of real readings beats any amount of
polish, and no amount of polish substitutes for it.

## The rules that decide whether this works

The first baseline attempt produced a detection floor of **±14.6 points on
pores** and **±3.6 on hydration**, which is too wide to prove a moisturiser did
anything. Three causes, all avoidable:

| Cause | Effect | Fix |
|---|---|---|
| Handheld phone | Face moved between frames | **Brace or prop the phone** |
| Light dropped 9% across the shots | Score drifts with brightness | Blinds shut, one fixed lamp |
| Only 2 usable frames | SD estimate has 1 degree of freedom | **Take 5 frames** |

Frames matter twice over: more replicates give a more stable estimate of the
error, and they shrink the error on the session mean by a further factor of
&radic;k. Going from 2 usable frames to 5 steady ones takes the hydration floor
from &plusmn;3.6 to roughly &plusmn;1.2: the difference between being able to
prove your moisturiser works and not.

## Why the baseline is three short sessions, not one

Cropping the same photograph two different ways moved a texture score by **5.81
points**, larger than a realistic four-week treatment effect, on skin that was
identical because it was the same instant of the same image.

That means setting the camera back up tomorrow is not a neutral act. It is a
source of error, and it is probably the largest one. Frames taken seconds apart
without touching the camera cannot see it at all, so a floor built from them is
an optimistic lower bound.

So the baseline is **three separate sessions on the same day**, taking the camera
down and setting it back up between each. Your skin cannot change in twenty
minutes, so any difference between those three session means is pure measurement
error, including the repositioning. That is the floor a day-to-day verdict has
to clear.

Assay takes whichever is larger, the between-session error or the
frame-level error, and never the smaller.

## The baseline (about 20 minutes, three sessions)

Pick a spot you can return to for six days. **Artificial light you control beats
daylight**, because daylight changes while you stand in it.

1. **Prop the phone.** Against books, on a shelf, anything. Do not hold it.
   This is the single highest-value change.
2. Mark where you stand. A piece of tape on the floor is not overkill.
3. Close blinds, one lamp, same lamp every day.
4. No makeup, hair back off the face, clean dry skin.
5. Face **closer than feels natural**: it should fill most of the frame.
   A frame was already rejected for `error_src_face_too_small`.
6. Take **five photos, about ten seconds apart**, without moving between them.
   Use the self-timer so you are not touching the phone.

Put those five in `captures/day0a/`.

Then **take the phone down, walk away, and set it up again from scratch.** Repeat
for `captures/day0b/` and `captures/day0c/`. Getting the placement slightly
different each time is the point, not a mistake: that difference is the error we
need to measure.

### Framing, specifically

The first video failed on all three counts, so to be concrete:

- **Portrait, not landscape.** Landscape spent half the frame on the kitchen.
- **Whole head in frame**, including the top of your hair. The video cut your
  forehead off, and forehead texture and pores are part of the score.
- **Centred**, not off to one side.
- Face filling roughly the middle two-thirds of the height.
- Look straight at the lens and hold still. Leaning between shots undoes the
  entire benefit of a fixed camera.

### Part 2: the lighting pair (the demo shot)

Immediately afterwards, without changing anything about yourself:

5. Move to a **different light source**, if part 1 was a window, use a lamp
6. Take **three more photos** the same way

Put those in `captures/lighting-b/`.

This pair is the demo. Same face, ten minutes apart, only the light changed. A
tracker with no error model reports it as progress. Assay reports it as
nothing, which is the truth.

### Then run

```bash
node scripts/capture.mjs --dir captures/day0a --type calibration --note "baseline A, propped, lamp"
node scripts/capture.mjs --dir captures/day0b --type calibration --note "baseline B, camera reset"
node scripts/capture.mjs --dir captures/day0c --type calibration --note "baseline C, camera reset"
node scripts/capture.mjs --dir captures/lighting-b --type calibration --note "different light, same session"
```

Add `--dry-run` first if you want to see the frames normalise and the cost
before spending anything.

## Every day, 11–15 August (about 60 seconds)

Same spot, same light, **same time of day**, skin genuinely differs between
morning and night, and that is real variation, not error, but it will still
swamp a one-week effect if you let it drift.

Five photos, ten seconds apart, phone propped in the same place, into
`captures/dayN/`, then:

```bash
node scripts/capture.mjs --dir captures/day1 --type treatment --day 1
```

The `--day` number is days since the baseline. Keep it accurate; every statistic
downstream is a function of it.

## Capture before you apply, not after

This one decides whether the study measures anything real.

A humectant works by holding water at the surface, so a frame taken shortly after
application is looking at wet product sitting on skin rather than at the skin's
own state. The reading would rise on day one, stay high, and mean nothing.

So the order every day is: **record on a bare face, then apply.** Same point in
the cycle each time. Applying again at night is fine and expected; the capture
just has to happen at the same place in the routine, which in practice means
first thing, before anything touches your face.

Showering first is fine. Give it a few minutes so your skin is dry and not flushed
from the heat, since both move hydration and redness genuinely.

## The product

Apply your hydrating moisturiser or serum as normal, morning and night, starting
after tonight's baseline. Do not change anything else about your routine for six
days: a second new product makes the result uninterpretable, which is exactly
the problem this app exists to solve.

Tell me the product name and I will register it so the app can detect the actives
and set the correct assessment window.

## Rules

- **Never** photograph after washing, exercising, or drinking alcohol the night
  before if you can avoid it. All three move hydration and redness genuinely.
- Miss a day rather than capture under different light. A missing session costs
  a little power; a bad session adds error to the floor for every other reading.
- Photographs stay on your machine. `captures/` is gitignored, and only the
  scores the API returns are ever committed.

## Cost

12 units per frame, so 60 per five-frame session. Baseline plus lighting pair
plus five daily sessions is about 420 units against a balance of 850, leaving
room for a re-shoot if a session goes wrong.

Rejected frames cost nothing, verified: the balance was unchanged after an
`error_src_face_too_small`. So framing too tight is a cheap mistake and framing
too loose is a free one. Err toward closer.
