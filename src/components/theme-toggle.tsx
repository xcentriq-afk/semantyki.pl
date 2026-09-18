"use client";

import { useEffect } from "react";

const KEY = "semantyki.pl:theme";

function readTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export default function ThemeToggle() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const stored = localStorage.getItem(KEY);
      if (stored === "light" || stored === "dark") return;
      const t = mq.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", t);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const t = readTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(KEY, t);
    document.documentElement.setAttribute("data-theme", t);
  };

  return (
    <button
      type="button"
      className="themeToggle"
      onClick={toggle}
      aria-label="Przełącz motyw (jasny/nocny)"
      title="Przełącz motyw"
    >
      <svg
        className="sun"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg
        className="moon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}
