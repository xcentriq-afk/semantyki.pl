import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SYMANTYKA.pl — łańcuchy znaczeń",
    short_name: "SYMANTYKA.pl",
    description:
      "Polska gra słowna: połącz dwa słowa łańcuchem wyrazów powiązanych znaczeniowo.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3e9",
    theme_color: "#1f6f5c",
    lang: "pl",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
