import "./globals.css";
import { Manrope, Montserrat, IBM_Plex_Serif } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
});

// The display/heading typeface. Loaded here and exposed as --font-ibm-plex-serif,
// which globals.css wires into the semantic --font-title token used by all
// headings — so switching the heading font later is a one-line change here + in
// globals. (IBM Plex Serif tops out at 700 — there is no 800.)
const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["200", "300"],
  variable: "--font-ibm-plex-serif",
  display: "swap",
});

import { NavLoadingProvider } from "@/components/NavLoadingProvider";

export const metadata = {
  title: "BornBhukkad",
  description: "Recipe intelligence for your kitchen",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${montserrat.variable} ${plexSerif.variable}`}
    >
      <body>
        {/* One app-wide loader that persists across page navigations. */}
        <NavLoadingProvider>{children}</NavLoadingProvider>
      </body>
    </html>
  );
}
