import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "LINXICON PL — połącz słowa łańcuchem znaczeń",
  description:
    "Gra słowna: połącz dwa losowe polskie słowa, dopisując wyrazy powiązane znaczeniowo. Codzienna zagadka i tryb treningowy.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
