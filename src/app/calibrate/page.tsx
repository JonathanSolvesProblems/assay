import type { Metadata } from "next";

import { CaptureSession } from "@/components/capture-session";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Calibrate, Assay",
  description:
    "Measure how much the YouCam Skin Analysis reading moves on your face when your skin has not changed. Three frames, seconds apart, on your own device.",
};

export default function CalibratePage() {
  return (
    <div className="mx-auto max-w-5xl px-6">
      <Reveal as="section" className="pt-20 pb-10 sm:pt-28">
        <p className="tabular text-[11px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
          Step one
        </p>
        <h1 className="mt-5 max-w-2xl font-serif text-[42px] leading-[1.1] tracking-[-0.03em] sm:text-[52px]">
          Measure the instrument before you measure yourself.
        </h1>
        <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-[var(--color-ink-secondary)]">
          Three frames, a few seconds apart. Your skin cannot change in that time, so
          everything that differs between them is error, the camera, the angle, the light.
          That spread becomes the bar every future change has to clear.
        </p>
      </Reveal>

      <Reveal index={1} className="pb-20">
        <CaptureSession />
      </Reveal>
    </div>
  );
}
