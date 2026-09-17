import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SYMANTYKA.pl — polska gra słowna w łańcuchy znaczeń";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 20% 15%, rgba(31,111,92,0.10), transparent 45%), radial-gradient(circle at 85% 90%, rgba(140,47,57,0.10), transparent 45%), #f7f3e9",
          color: "#2b2620",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 84, letterSpacing: "0.1em" }}>
          <span>SYMANTYKA</span>
          <span style={{ color: "#1f6f5c" }}>.pl</span>
        </div>
        <div style={{ fontSize: 30, marginTop: 18, color: "#6f675c", fontStyle: "italic" }}>
          Połącz dwa słowa łańcuchem znaczeń
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 26,
            marginTop: 54,
            fontSize: 34,
          }}
        >
          <div
            style={{
              background: "#1f6f5c",
              color: "#fff",
              borderRadius: 999,
              padding: "14px 34px",
            }}
          >
            deszcz
          </div>
          <div style={{ color: "#1f6f5c", fontSize: 44 }}>→</div>
          <div
            style={{
              background: "#fff",
              border: "1px solid #2b2620",
              borderRadius: 999,
              padding: "14px 34px",
            }}
          >
            parasol
          </div>
          <div style={{ color: "#1f6f5c", fontSize: 44 }}>→</div>
          <div
            style={{
              background: "#1f6f5c",
              color: "#fff",
              borderRadius: 999,
              padding: "14px 34px",
            }}
          >
            muzyka
          </div>
        </div>
        <div style={{ fontSize: 24, marginTop: 46, color: "#6f675c" }}>
          Nowa zagadka codziennie · trening bez limitu · za darmo
        </div>
      </div>
    ),
    size,
  );
}
