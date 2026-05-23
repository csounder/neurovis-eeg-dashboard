import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { ChunkLoadRecovery } from "@/components/shell/ChunkLoadRecovery";
import { UI_SKIN_LS_KEY } from "@/lib/uiSkinStorage";

/** Runs before React chunks — if `_next` 404s, LS-backed skin still applies on reload. */
const UI_SKIN_BOOTSTRAP = `(function(){try{var k=${JSON.stringify(UI_SKIN_LS_KEY)};var a=["studio","sand","copper","olive","slate"];var v=localStorage.getItem(k);if(!v)return;if(a.indexOf(v)<0)return;document.documentElement.setAttribute("data-nv-skin",v);var b=document.body;if(b)b.setAttribute("data-nv-skin",v);}catch(e){}})();`;

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
  // Avoid Chrome’s “preloaded but not used within a few seconds” noise: fonts
  // are applied via CSS variables and `font-family`; preload heuristics often
  // misfire. `display: "swap"` still keeps text visible while they load.
  preload: false,
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "NeuroVis — EEG Dashboard",
  description:
    "Real-time neurofeedback & EEG analysis for Muse and OpenBCI devices.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="bg-app min-h-screen font-sans text-zinc-200 antialiased"
        suppressHydrationWarning
      >
        <script dangerouslySetInnerHTML={{ __html: UI_SKIN_BOOTSTRAP }} />
        <ChunkLoadRecovery />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
