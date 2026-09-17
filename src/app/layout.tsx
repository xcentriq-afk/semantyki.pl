import type { Metadata, Viewport } from "next";

import "./globals.css";

const SITE_URL = "https://symantyka.pl";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SYMANTYKA.pl — połącz słowa łańcuchem znaczeń",
    template: "%s | SYMANTYKA.pl",
  },
  description:
    "Darmowa polska gra słowna online. Połącz dwa losowe słowa łańcuchem wyrazów powiązanych znaczeniowo. Codzienna zagadka i tryb treningowy. Sprawdź, ile słów wystarczy, by połączyć „deszcz” z „muzyką”.",
  keywords: [
    "gra słowna",
    "gry słowne",
    "polskie gry słowne",
    "łańcuch słów",
    "skojarzenia",
    "zagadka dnia",
    "gra online",
    "word game",
    "polski",
    "bezpłatna gra",
    "łamigłówka językowa",
    "nauka słów",
  ],
  authors: [{ name: "SYMANTYKA.pl" }],
  creator: "SYMANTYKA.pl",
  publisher: "SYMANTYKA.pl",
  alternates: {
    canonical: "/",
    languages: {
      "pl-PL": "/",
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "SYMANTYKA.pl",
    title: "SYMANTYKA.pl — połącz słowa łańcuchem znaczeń",
    description:
      "Połącz dwa losowe polskie słowa, dopisując wyrazy powiązane znaczeniowo. Nowa zagadka codziennie, trening bez limitu.",
    locale: "pl_PL",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SYMANTYKA.pl — polska gra słowna w łańcuchy znaczeń",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SYMANTYKA.pl — połącz słowa łańcuchem znaczeń",
    description:
      "Połącz dwa losowe polskie słowa, dopisując wyrazy powiązane znaczeniowo. Nowa zagadka codziennie.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "game",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f6f5c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
