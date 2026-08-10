import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import Link from "next/link";

import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Assay, know if your skincare is actually working",
  description:
    "Assay measures its own error before it measures your skin, so a change is only reported when it exceeds the noise floor. Built on the YouCam Skin Analysis API.",
};

const NAV = [
  { href: "/", label: "Verdict" },
  { href: "/calibrate", label: "Calibrate" },
  { href: "/method", label: "Method" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
        <div className="min-h-screen">
          <header className="sticky top-0 z-50 border-b border-[var(--color-rule)] bg-[color-mix(in_srgb,var(--color-paper)_88%,transparent)] backdrop-blur-md">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <Link href="/" className="group flex items-baseline gap-2.5">
                <span className="font-serif text-[19px] tracking-[-0.02em]">Assay</span>
                <span className="tabular hidden text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)] sm:inline">
                  n-of-1
                </span>
              </Link>

              <nav className="flex items-center gap-1">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-[5px] px-2.5 py-1.5 text-[13px] text-[var(--color-ink-secondary)] transition-colors duration-200 hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main>{children}</main>

          <footer className="mt-32 border-t border-[var(--color-rule)]">
            <div className="mx-auto max-w-5xl px-6 py-12">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-md">
                  <p className="font-serif text-[17px] tracking-[-0.02em]">Assay</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
                    Skin measurement with an error bar. Built on the YouCam Skin Analysis
                    API by Perfect Corp.
                  </p>
                </div>
                <p className="max-w-xs text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
                  Assay is a measurement tool, not a medical device. It does not diagnose
                  or treat any condition. Persistent or worsening skin problems belong
                  with a dermatologist.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
