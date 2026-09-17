"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { simulate, type SimNode } from "@/lib/force";
import { UnionFind } from "@/lib/unionfind";
import styles from "./game.module.css";

type Mode = "daily" | "practice";

interface BoardNode {
  word: string;
  start?: boolean;
  target?: boolean;
  x: number;
  y: number;
}

interface Edge {
  from: string;
  to: string;
  score: number;
}

interface Puzzle {
  start: string;
  target: string;
  date: string;
}

interface SavedState {
  start: string;
  target: string;
  date: string;
  nodes: BoardNode[];
  edges: Edge[];
  won: boolean;
}

interface CheckResult {
  ok: boolean;
  reason?: string;
  connected?: boolean;
  best?: { word: string; score: number } | null;
}

const storageKey = (mode: Mode) => `linxicon.pl:state:${mode}`;

function shortestChain(edges: Edge[], start: string, target: string): string[] {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push(e.to);
    adj.get(e.to)!.push(e.from);
  }
  const prev = new Map<string, string | null>();
  const queue = [start];
  prev.set(start, null);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === target) break;
    for (const nb of adj.get(cur) ?? []) {
      if (!prev.has(nb)) {
        prev.set(nb, cur);
        queue.push(nb);
      }
    }
  }
  if (!prev.has(target)) return [];
  const chain: string[] = [];
  let cur: string | null = target;
  while (cur) {
    chain.unshift(cur);
    cur = prev.get(cur) ?? null;
  }
  return chain;
}

export default function Game() {
  const [mode, setMode] = useState<Mode>("daily");
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [nodes, setNodes] = useState<BoardNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [won, setWon] = useState(false);
  const [input, setInput] = useState("");
  const [matches, setMatches] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; kind: "info" | "warn" } | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 560 });
  const [now, setNow] = useState(() => Date.now());

  const boardRef = useRef<HTMLDivElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showFeedback = useCallback((text: string, kind: "info" | "warn" = "info") => {
    setFeedback({ text, kind });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3200);
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDims({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const fetchPuzzle = useCallback(async (m: Mode, fresh: boolean) => {
    if (!fresh) {
      const saved = localStorage.getItem(storageKey(m));
      if (saved) {
        try {
          const state = JSON.parse(saved) as SavedState;
          setPuzzle({ start: state.start, target: state.target, date: state.date });
          setNodes(state.nodes);
          setEdges(state.edges);
          setWon(state.won);
          return;
        } catch {
          /* ignore corrupted state */
        }
      }
    }
    const res = await fetch(`/api/puzzle?mode=${m}`);
    const data = (await res.json()) as Puzzle;
    setPuzzle(data);
    setNodes([
      { word: data.start, start: true, x: 0, y: 0 },
      { word: data.target, target: true, x: 0, y: 0 },
    ]);
    setEdges([]);
    setWon(false);
    localStorage.removeItem(storageKey(m));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    void fetchPuzzle(mode, false);
  }, [mode, fetchPuzzle]);

  useEffect(() => {
    if (!puzzle || nodes.length === 0) return;
    const simNodes: SimNode[] = nodes.map((n) => ({
      x: n.x || Math.random() * dims.w,
      y: n.y || Math.random() * dims.h,
      vx: 0,
      vy: 0,
      anchorX: n.start ? dims.w * 0.16 : n.target ? dims.w * 0.84 : null,
      anchorY: n.start ? dims.h * 0.22 : n.target ? dims.h * 0.78 : null,
    }));
    const simEdges: [number, number][] = edges
      .map((e) => {
        const a = nodes.findIndex((n) => n.word === e.from);
        const b = nodes.findIndex((n) => n.word === e.to);
        return a >= 0 && b >= 0 ? ([a, b] as [number, number]) : null;
      })
      .filter((e): e is [number, number] => e !== null);
    simulate(simNodes, simEdges, dims.w, dims.h);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- layout positions derived from graph topology
    setNodes((prev) => prev.map((n, i) => ({ ...n, x: simNodes[i].x, y: simNodes[i].y })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges, dims.w, dims.h]);

  useEffect(() => {
    if (!puzzle || nodes.length === 0) return;
    const state: SavedState = {
      start: puzzle.start,
      target: puzzle.target,
      date: puzzle.date,
      nodes,
      edges,
      won,
    };
    localStorage.setItem(storageKey(mode), JSON.stringify(state));
  }, [puzzle, nodes, edges, won, mode]);

  const handleInput = useCallback(async (value: string) => {
    setInput(value);
    const q = value.trim().toLowerCase();
    if (!q) {
      setMatches([]);
      return;
    }
    const res = await fetch(`/api/words?q=${encodeURIComponent(q)}`);
    const data = (await res.json()) as { matches: string[] };
    setMatches(data.matches);
  }, []);

  const submitWord = useCallback(
    async (word: string) => {
      const w = word.trim().toLowerCase();
      if (!w || busy || won || !puzzle) return;
      if (nodes.some((n) => n.word === w)) {
        showFeedback("To słowo już jest na planszy.", "warn");
        setInput("");
        setMatches([]);
        return;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: w, existing: nodes.map((n) => n.word) }),
        });
        const data = (await res.json()) as CheckResult;
        if (!data.ok) {
          showFeedback(
            data.reason === "not-found" ? `Nie znam słowa „${w}”.` : "Nieprawidłowe słowo.",
            "warn",
          );
          return;
        }
        const bestNode = data.best ? nodes.find((n) => n.word === data.best!.word) : null;
        const newNode: BoardNode = {
          word: w,
          x: bestNode ? bestNode.x + (Math.random() - 0.5) * 60 : dims.w / 2 + (Math.random() - 0.5) * 120,
          y: bestNode ? bestNode.y + (Math.random() - 0.5) * 60 : dims.h / 2 + (Math.random() - 0.5) * 120,
        };
        const newEdges = data.connected && data.best
          ? [...edges, { from: data.best.word, to: w, score: data.best.score }]
          : edges;
        const allWords = [...nodes.map((n) => n.word), w];
        const uf = new UnionFind(allWords);
        for (const e of newEdges) uf.union(e.from, e.to);
        const connectedNow = uf.connected(puzzle.start, puzzle.target);
        setNodes((prev) => [...prev, newNode]);
        setEdges(newEdges);
        if (connectedNow) {
          setWon(true);
        } else if (data.connected) {
          showFeedback(`„${w}” łączy się z „${data.best!.word}”.`);
        } else {
          showFeedback("Słowo wisi w próżni — brak wystarczającego powiązania z planszą.", "warn");
        }
      } catch {
        showFeedback("Błąd połączenia z serwerem.", "warn");
      } finally {
        setBusy(false);
        setInput("");
        setMatches([]);
        inputRef.current?.focus();
      }
    },
    [busy, won, puzzle, nodes, edges, dims, showFeedback],
  );

  const newGame = useCallback(() => {
    void fetchPuzzle("practice", true);
    setWon(false);
    inputRef.current?.focus();
  }, [fetchPuzzle]);

  const share = useCallback(async () => {
    if (!puzzle) return;
    const chain = shortestChain(edges, puzzle.start, puzzle.target);
    const text =
      `LINXICON PL · ${puzzle.date}\n` +
      `Słowa pomostowe: ${Math.max(0, nodes.length - 2)}\n` +
      (chain.length > 0 ? `Łańcuch: ${chain.join(" → ")}` : "");
    try {
      await navigator.clipboard.writeText(text);
      showFeedback("Skopiowano wynik do schowka.");
    } catch {
      showFeedback("Nie udało się skopiować.", "warn");
    }
  }, [puzzle, edges, nodes, showFeedback]);

  const countdown = useMemo(() => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Warsaw",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
        .formatToParts(now)
        .map((p) => [p.type, p.value]),
    );
    const wall = Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour,
      +parts.minute,
      +parts.second,
    );
    const nextMidnight = Date.UTC(+parts.year, +parts.month - 1, +parts.day + 1);
    const ms = Math.max(0, nextMidnight - wall);
    const hh = Math.floor(ms / 3600000);
    const mm = Math.floor((ms % 3600000) / 60000);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }, [now]);

  const nodeById = useMemo(() => {
    const map = new Map<string, BoardNode>();
    for (const n of nodes) map.set(n.word, n);
    return map;
  }, [nodes]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brandRow}>
          <h1 className={styles.brand}>
            LINXICON<span className={styles.brandAccent}>PL</span>
          </h1>
          <p className={styles.tagline}>Połącz dwa słowa łańcuchem znaczeń.</p>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            <button
              className={mode === "daily" ? styles.tabActive : styles.tab}
              onClick={() => setMode("daily")}
            >
              Zagadka dnia
            </button>
            <button
              className={mode === "practice" ? styles.tabActive : styles.tab}
              onClick={() => setMode("practice")}
            >
              Trening
            </button>
          </div>
          <div className={styles.stats}>
            {mode === "daily" ? (
              <span className={styles.countdown}>Nowa zagadka za {countdown}</span>
            ) : (
              <button className={styles.newGame} onClick={newGame}>
                Nowa gra
              </button>
            )}
            <span className={styles.wordCount}>
              Słowa: {Math.max(0, nodes.length - 2)}
            </span>
          </div>
        </div>
      </header>

      <div className={styles.boardWrap} ref={boardRef}>
        <svg className={styles.board} viewBox={`0 0 ${dims.w} ${dims.h}`}>
          {edges.map((e, i) => {
            const a = nodeById.get(e.from);
            const b = nodeById.get(e.to);
            if (!a || !b) return null;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const bow = Math.min(40, len * 0.12);
            const cx = mx - (dy / len) * bow;
            const cy = my + (dx / len) * bow;
            const intensity = Math.min(1, Math.max(0.25, (e.score - 0.45) / 0.3));
            return (
              <path
                key={`${e.from}-${e.to}`}
                d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                className={i === edges.length - 1 ? styles.edgeNew : styles.edge}
                style={{ opacity: intensity }}
                fill="none"
              />
            );
          })}
          {nodes.map((n) => {
            const w = n.word.length * 8.8 + 30;
            const cls = n.start || n.target ? styles.nodeAnchor : styles.node;
            return (
              <g key={n.word} transform={`translate(${n.x}, ${n.y})`}>
                {n.start && (
                  <text className={styles.nodeLabel} x={0} y={-32} textAnchor="middle">
                    start
                  </text>
                )}
                {n.target && (
                  <text className={styles.nodeLabel} x={0} y={-32} textAnchor="middle">
                    cel
                  </text>
                )}
                <rect className={cls} x={-w / 2} y={-24} width={w} height={48} rx={24} />
                <text className={styles.nodeText} x={0} y={5} textAnchor="middle">
                  {n.word}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <footer className={styles.footer}>
        <div className={styles.hint}>
          Dopisz słowo, które znaczeniowo łączy się z którymś słowem na planszy.
        </div>
        <div className={styles.inputArea}>
          {matches.length > 0 && (
            <ul className={styles.suggestions}>
              {matches.map((m) => (
                <li key={m}>
                  <button onClick={() => void submitWord(m)}>{m}</button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={inputRef}
            className={styles.input}
            value={input}
            onChange={(e) => void handleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitWord(input);
              if (e.key === "Escape") setMatches([]);
            }}
            placeholder="Wpisz słowo…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={busy || won || !puzzle}
          />
          <button
            className={styles.submit}
            onClick={() => void submitWord(input)}
            disabled={busy || won || !puzzle}
          >
            Dodaj
          </button>
        </div>
        {feedback && (
          <div className={feedback.kind === "warn" ? styles.feedbackWarn : styles.feedback}>
            {feedback.text}
          </div>
        )}
      </footer>

      {won && puzzle && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h2 className={styles.winTitle}>Połączone!</h2>
            <p className={styles.winStats}>
              {puzzle.start} → {puzzle.target}
            </p>
            <p className={styles.winStats}>Słowa pomostowe: {Math.max(0, nodes.length - 2)}</p>
            {shortestChain(edges, puzzle.start, puzzle.target).length > 0 && (
              <p className={styles.winChain}>
                {shortestChain(edges, puzzle.start, puzzle.target).join(" → ")}
              </p>
            )}
            <div className={styles.winActions}>
              <button className={styles.primaryBtn} onClick={() => void share()}>
                Udostępnij wynik
              </button>
              {mode === "practice" && (
                <button className={styles.ghostBtn} onClick={newGame}>
                  Nowa gra
                </button>
              )}
              {mode === "daily" && (
                <button className={styles.ghostBtn} onClick={() => setWon(false)}>
                  Wróć do planszy
                </button>
              )}
            </div>
            {mode === "daily" && (
              <p className={styles.winCountdown}>Następna zagadka za {countdown}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
