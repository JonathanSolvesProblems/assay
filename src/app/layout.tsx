import type { Metadata } from "next";
import { DM_Mono, Public_Sans } from "next/font/google";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

import "./globals.css";

/**
 * Mono is the display voice here, not a code face. A certificate is typed, and
 * the same family that sets the headings sets the figures, so a score and a
 * heading share a rhythm.
 */
const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

/** Public Sans carries long prose. Institutional rather than promotional. */
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
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
    // The font variables belong on <html>, not <body>. Tailwind's @theme emits
    // --font-sans and --font-mono onto :root, and they reference these via var();
    // if the fonts were declared one level lower those references would be
    // undefined at :root, the declarations would be invalid at computed-value
    // time, and every family would silently fall back to the browser default.
    <html lang="en" className={`${dmMono.variable} ${publicSans.variable}`}>
      <head>
        {/* Runs before first paint, so a visitor who chose dark never sees a
            frame of light stock. It only ever writes an attribute the CSS
            already understands, and a stored value that is neither "light" nor
            "dark" is ignored rather than trusted. Without a stored choice it
            writes nothing at all and the media query decides. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("assay-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`,
          }}
        />
      </head>
      <body>
        <div className="min-h-screen">
          {/* The masthead of an issued document: a heavy top rule, the instrument
              named on the left, the certificate reference on the right. */}
          <header className="sticky top-0 z-50 border-t-2 border-b border-t-[var(--color-ink)] border-b-[var(--color-rule)] bg-[color-mix(in_srgb,var(--color-paper)_92%,transparent)] backdrop-blur-sm">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
              <Link href="/" className="flex items-baseline gap-3">
                <span className="tabular text-[17px] font-medium tracking-[0.08em] uppercase">
                  Assay
                </span>
                <span className="tabular hidden text-[10px] tracking-[0.14em] text-[var(--color-ink-muted)] uppercase sm:inline">
                  cert. n-of-1
                </span>
              </Link>

              <nav className="flex items-center">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="tabular border-l border-[var(--color-rule)] px-3 py-1 text-[11px] tracking-[0.1em] text-[var(--color-ink-secondary)] uppercase transition-colors duration-150 first:border-l-0 hover:text-[var(--color-spot)]"
                  >
                    {item.label}
                  </Link>
                ))}
                <ThemeToggle />
              </nav>
            </div>
          </header>

          <main>{children}</main>

          <footer className="mt-28 border-t-2 border-[var(--color-ink)]">
            <div className="mx-auto max-w-5xl px-6 py-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-md">
                  <p className="tabular text-[13px] tracking-[0.1em] uppercase">Assay</p>
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
