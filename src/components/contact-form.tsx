"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./contact.module.css";

const SITE_KEY = "0x4AAAAAAE8393KsgN1k_jDV";
const MAX_LEN = 500;

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

function loadTurnstile(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__tsOnload";
    s.async = true;
    s.onerror = () => reject(new Error("turnstile-load"));
    (window as unknown as { __tsOnload?: () => void }).__tsOnload = () => resolve();
    document.head.appendChild(s);
  });
}

export default function ContactForm() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [busy, setBusy] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadTurnstile()
      .then(() => {
        if (cancelled || !widgetRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(widgetRef.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => {
            tokenRef.current = token;
          },
          "expired-callback": () => {
            tokenRef.current = null;
          },
        });
      })
      .catch(() => {
        /* bez widgetu serwer odrzuci wysyłkę */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    const text = message.trim();
    if (!text || busy) return;
    if (text.length < 3) {
      setStatus({ text: "Wiadomość jest za krótka.", kind: "err" });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          token: tokenRef.current ?? "",
          website: "",
        }),
      });
      if (res.status === 429) {
        setStatus({
          text: "Za dużo wiadomości z tego adresu — spróbuj ponownie za godzinę.",
          kind: "err",
        });
        return;
      }
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setMessage("");
        setStatus({ text: "Dziękuję! Wiadomość dotarła.", kind: "ok" });
      } else if (data.error === "link") {
        setStatus({ text: "Wiadomości z linkami są odrzucane.", kind: "err" });
      } else {
        setStatus({
          text: "Nie udało się wysłać. Odśwież stronę i spróbuj ponownie.",
          kind: "err",
        });
      }
    } catch {
      setStatus({ text: "Błąd połączenia — spróbuj ponownie.", kind: "err" });
    } finally {
      setBusy(false);
      tokenRef.current = null;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <textarea
        className={styles.textarea}
        value={message}
        maxLength={MAX_LEN}
        rows={4}
        placeholder="Masz pomysł, błąd lub opinię? Napisz wiadomość…"
        onChange={(e) => setMessage(e.target.value)}
      />
      {/* Honeypot — ludzie tego nie widzą */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className={styles.hp}
        aria-hidden="true"
      />
      <div className={styles.row}>
        <span className={styles.counter}>
          {message.length}/{MAX_LEN}
        </span>
        <button type="submit" className={styles.submit} disabled={busy || message.trim().length < 3}>
          {busy ? "Wysyłanie…" : "Wyślij"}
        </button>
      </div>
      <div ref={widgetRef} className={styles.widget} />
      {status && (
        <p className={status.kind === "ok" ? styles.statusOk : styles.statusErr}>
          {status.text}
        </p>
      )}
    </form>
  );
}
