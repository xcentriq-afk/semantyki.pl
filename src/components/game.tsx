"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tick, type SimNode } from "@/lib/force";
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
  matches?: { word: string; score: number }[];
}

interface DragInfo {
  index: number;
  word: string;
  ox: number;
  oy: number;
  px: number;
  py: number;
}

const storageKey = (mode: Mode) => `semantyki.pl:state:${mode}`;
const storageKeyPractice = (pos: string[]) =>
  `semantyki.pl:state:practice:${pos.join("+")}`;
const posStorageKey = "semantyki.pl:pos";
const LEGACY_PREFIX = "symantyka.pl";
const edgeKey = (a: string, b: string) => [a, b].sort().join("|");

const DEFAULT_POS = ["rzeczownik", "przymiotnik"];

const POS_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Odmienne",
    items: ["rzeczownik", "przymiotnik", "czasownik", "liczebnik", "zaimek"],
  },
  {
    label: "Nieodmienne",
    items: ["przysłówek", "przyimek", "spójnik", "wykrzyknik", "partykuła"],
  },
];

interface Pt {
  x: number;
  y: number;
}

function hashWord(w: string): number {
  let h = 7;
  for (let i = 0; i < w.length; i++) h = (h * 31 + w.charCodeAt(i)) | 0;
  return h;
}

function buildAdj(edges: Edge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push(e.to);
    adj.get(e.to)!.push(e.from);
  }
  return adj;
}

function bfsDist(adj: Map<string, string[]>, from: string): Map<string, number> {
  const dist = new Map<string, number>();
  if (!from) return dist;
  const queue = [from];
  dist.set(from, 0);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of adj.get(cur) ?? []) {
      if (!dist.has(nb)) {
        dist.set(nb, dist.get(cur)! + 1);
        queue.push(nb);
      }
    }
  }
  return dist;
}

function semanticAnchor(
  word: string,
  dS: Map<string, number>,
  dT: Map<string, number>,
  w: number,
  h: number,
): Pt | null {
  const startA = { x: w * 0.14, y: h * 0.2 };
  const targetA = { x: w * 0.86, y: h * 0.8 };
  const hsh = hashWord(word);
  const jx = (hsh % 50) - 25;
  const jy = ((hsh >> 5) % 50) - 25;
  const cx = w / 2;
  const cy = h / 2;
  const ds = dS.get(word);
  const dt = dT.get(word);
  if (ds !== undefined && dt !== undefined) {
    const t = ds / (ds + dt);
    return {
      x: startA.x + (targetA.x - startA.x) * t + jx,
      y: startA.y + (targetA.y - startA.y) * t + jy,
    };
  }
  if (ds !== undefined) {
    const off = Math.min(ds, 5) * 50;
    const len = Math.hypot(cx - startA.x, cy - startA.y) || 1;
    return {
      x: startA.x + ((cx - startA.x) / len) * off + jx,
      y: startA.y + ((cy - startA.y) / len) * off + jy,
    };
  }
  if (dt !== undefined) {
    const off = Math.min(dt, 5) * 50;
    const len = Math.hypot(cx - targetA.x, cy - targetA.y) || 1;
    return {
      x: targetA.x + ((cx - targetA.x) / len) * off + jx,
      y: targetA.y + ((cy - targetA.y) / len) * off + jy,
    };
  }
  return null;
}

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
  const [dragging, setDragging] = useState<string | null>(null);
  const [posSelection, setPosSelection] = useState<string[]>(() => {
    try {
      const saved =
        localStorage.getItem(posStorageKey) ?? localStorage.getItem(`${LEGACY_PREFIX}:pos`);
      if (saved) return JSON.parse(saved) as string[];
    } catch {
      /* ignore */
    }
    return DEFAULT_POS;
  });
  const [readyKey, setReadyKey] = useState("");
  const [showPosModal, setShowPosModal] = useState(false);
  const [posDraft, setPosDraft] = useState<string[]>(DEFAULT_POS);

  const boardRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const simRef = useRef<{ nodes: SimNode[]; edges: [number, number][] } | null>(null);
  const dragRef = useRef<DragInfo | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback((text: string, kind: "info" | "warn" = "info") => {
    setFeedback({ text, kind });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3200);
  }, []);

  const isFloating = useCallback(
    (word: string) => {
      const n = nodes.find((x) => x.word === word);
      if (!n || n.start || n.target) return false;
      return !edges.some((e) => e.from === word || e.to === word);
    },
    [nodes, edges],
  );

  const flushSave = useCallback(() => {
    const s = simRef.current;
    if (!puzzle) return;
    const key = mode === "practice" ? storageKeyPractice(posSelection) : storageKey(mode);
    const state: SavedState = {
      start: puzzle.start,
      target: puzzle.target,
      date: puzzle.date,
      nodes: nodes.map((n, i) => ({
        ...n,
        x: s ? s.nodes[i].x : n.x,
        y: s ? s.nodes[i].y : n.y,
      })),
      edges,
      won,
    };
    localStorage.setItem(key, JSON.stringify(state));
  }, [puzzle, nodes, edges, won, mode, posSelection]);

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

  const fetchPuzzle = useCallback(
    async (m: Mode, fresh: boolean, pos: string[]) => {
      const key = m === "practice" ? storageKeyPractice(pos) : storageKey(m);
      const legacyKey =
        m === "practice"
          ? `${LEGACY_PREFIX}:state:practice:${pos.join("+")}`
          : `${LEGACY_PREFIX}:state:${m}`;
      if (!fresh) {
        const saved = localStorage.getItem(key) ?? localStorage.getItem(legacyKey);
        if (saved) {
          try {
            const state = JSON.parse(saved) as SavedState;
            setPuzzle({ start: state.start, target: state.target, date: state.date });
            setNodes(state.nodes);
            setEdges(state.edges);
            setWon(state.won);
            localStorage.setItem(key, saved);
            localStorage.removeItem(legacyKey);
            return;
          } catch {
            /* ignore corrupted state */
          }
        }
      }
      const q =
        m === "practice"
          ? `?mode=practice&pos=${encodeURIComponent(pos.join(","))}`
          : "?mode=daily";
      const res = await fetch(`/api/puzzle${q}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        if (err?.error === "no-pairs") {
          showFeedback("Brak zagadek dla wybranej kombinacji części mowy.", "warn");
          setPuzzle(null);
          setNodes([]);
          setEdges([]);
          return;
        }
      }
      const data = (await res.json()) as Puzzle;
      setPuzzle(data);
      setNodes([
        { word: data.start, start: true, x: 0, y: 0 },
        { word: data.target, target: true, x: 0, y: 0 },
      ]);
      setEdges([]);
      setWon(false);
      localStorage.removeItem(key);
    },
    [showFeedback],
  );

  useEffect(() => {
    if (mode === "daily") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
      void fetchPuzzle("daily", false, DEFAULT_POS);
      return;
    }
    const key = posSelection.join("+");
    if (readyKey !== key) {
      setPosDraft(posSelection);
      setShowPosModal(true);
      return;
    }
    void fetchPuzzle("practice", false, posSelection);
  }, [mode, readyKey, posSelection, fetchPuzzle]);

  useEffect(() => {
    const prev = simRef.current;
    const clampX = (x: number) => Math.min(Math.max(x, 80), dims.w - 80);
    const clampY = (y: number) => Math.min(Math.max(y, 50), dims.h - 50);
    const prevByWord = new Map<string, SimNode>();
    if (prev) {
      for (const s of prev.nodes) if (s.word) prevByWord.set(s.word, s);
    }
    const adj = buildAdj(edges);
    const dS = bfsDist(adj, puzzle?.start ?? "");
    const dT = bfsDist(adj, puzzle?.target ?? "");
    const floatyCount = nodes.filter(
      (n) =>
        !n.start &&
        !n.target &&
        !edges.some((e) => e.from === n.word || e.to === n.word),
    ).length;
    let floatIdx = 0;
    const simNodes: SimNode[] = nodes.map((n) => {
      const p = prevByWord.get(n.word) ?? null;
      const isStart = !!n.start;
      const isTarget = !!n.target;
      const floaty =
        !isStart &&
        !isTarget &&
        !edges.some((e) => e.from === n.word || e.to === n.word);
      let anchorX: number | null;
      let anchorY: number | null;
      let strength: number;
      if (isStart) {
        anchorX = dims.w * 0.14;
        anchorY = dims.h * 0.2;
        strength = 0.1;
      } else if (isTarget) {
        anchorX = dims.w * 0.86;
        anchorY = dims.h * 0.8;
        strength = 0.1;
      } else if (floaty) {
        if (p && p.floaty && p.anchorX !== null && p.anchorY !== null) {
          anchorX = p.anchorX;
          anchorY = p.anchorY;
          strength = p.strength;
        } else {
          anchorX = Math.max(70, dims.w * 0.07);
          anchorY =
            dims.h * 0.2 +
            dims.h * 0.6 * (floatIdx / Math.max(1, floatyCount - 1));
          strength = 0.025;
          floatIdx += 1;
        }
      } else {
        const sem = semanticAnchor(n.word, dS, dT, dims.w, dims.h);
        if (sem) {
          anchorX = sem.x;
          anchorY = sem.y;
          strength = 0.03;
        } else {
          anchorX = null;
          anchorY = null;
          strength = 0;
        }
      }
      const x = p ? clampX(p.x) : anchorX !== null ? anchorX : clampX(Math.random() * dims.w);
      const y = p ? clampY(p.y) : anchorY !== null ? anchorY : clampY(Math.random() * dims.h);
      return {
        word: n.word,
        floaty,
        x,
        y,
        vx: p ? p.vx * 0.4 : 0,
        vy: p ? p.vy * 0.4 : 0,
        anchorX,
        anchorY,
        strength,
      };
    });
    const simEdges: [number, number][] = edges
      .map((e) => {
        const a = nodes.findIndex((n) => n.word === e.from);
        const b = nodes.findIndex((n) => n.word === e.to);
        return a >= 0 && b >= 0 ? ([a, b] as [number, number]) : null;
      })
      .filter((e): e is [number, number] => e !== null);
    simRef.current = { nodes: simNodes, edges: simEdges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges, dims.w, dims.h, puzzle?.start, puzzle?.target]);

  useEffect(() => {
    let raf: number;
    const step = () => {
      const sim = simRef.current;
      if (sim) {
        const drag = dragRef.current;
        if (drag) {
          const n = sim.nodes[drag.index];
          n.x = drag.px;
          n.y = drag.py;
          n.vx = 0;
          n.vy = 0;
          tick(sim.nodes, sim.edges, dims.w, dims.h, drag.index);
        } else {
          tick(sim.nodes, sim.edges, dims.w, dims.h, null);
        }
        setNodes((prev) =>
          prev.map((n, i) => {
            const s = sim.nodes[i];
            if (!s) return n;
            return n.x === s.x && n.y === s.y ? n : { ...n, x: s.x, y: s.y };
          }),
        );
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [dims.w, dims.h]);

  useEffect(() => {
    const onHide = () => flushSave();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flushSave]);

  useEffect(() => {
    if (!puzzle || nodes.length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, edges, won, nodes.length, mode, posSelection]);

  const toBoard = useCallback(
    (e: React.PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (dims.w / rect.width),
        y: (e.clientY - rect.top) * (dims.h / rect.height),
      };
    },
    [dims],
  );

  const handleNodePointerDown = useCallback(
    (word: string, index: number) => (e: React.PointerEvent) => {
      if (won || !simRef.current) return;
      const n = nodes[index];
      if (n.start || n.target) return;
      e.preventDefault();
      e.stopPropagation();
      const p = toBoard(e);
      const sim = simRef.current.nodes[index];
      dragRef.current = { index, word, ox: p.x - sim.x, oy: p.y - sim.y, px: p.x, py: p.y };
      setDragging(word);
      svgRef.current?.setPointerCapture?.(e.pointerId);
    },
    [won, nodes, toBoard],
  );

  const handleBoardPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const p = toBoard(e);
      drag.px = p.x - drag.ox;
      drag.py = p.y - drag.oy;
    },
    [toBoard],
  );

  const handleBoardPointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setDragging(null);
    const sim = simRef.current;
    if (!sim) return;
    const n = sim.nodes[drag.index];
    const connected = edges.some((e) => e.from === drag.word || e.to === drag.word);
    if (!connected) {
      n.anchorX = n.x;
      n.anchorY = n.y;
      n.strength = 0.015;
    }
  }, [edges]);

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
        const pos = mode === "daily" ? DEFAULT_POS : posSelection;
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: w, existing: nodes.map((n) => n.word), pos }),
        });
        const data = (await res.json()) as CheckResult;
        if (!data.ok) {
          if (data.reason === "pos") {
            showFeedback("To słowo nie pasuje do wybranych części mowy.", "warn");
          } else {
            showFeedback(
              data.reason === "not-found" ? `Nie znam słowa „${w}”.` : "Nieprawidłowe słowo.",
              "warn",
            );
          }
          return;
        }
        const matchList = data.matches ?? [];
        const newEdges = matchList.length > 0
          ? [...edges, ...matchList.map((m) => ({ from: m.word, to: w, score: m.score }))]
          : edges;
        const semAdj = buildAdj(newEdges);
        const semDS = bfsDist(semAdj, puzzle.start);
        const semDT = bfsDist(semAdj, puzzle.target);
        const sem = semanticAnchor(w, semDS, semDT, dims.w, dims.h);
        const newNode: BoardNode = {
          word: w,
          x: sem ? sem.x : dims.w / 2 + (Math.random() - 0.5) * 120,
          y: sem ? sem.y : dims.h / 2 + (Math.random() - 0.5) * 120,
        };
        const allWords = [...nodes.map((n) => n.word), w];
        const uf = new UnionFind(allWords);
        for (const e of newEdges) uf.union(e.from, e.to);
        const connectedNow = uf.connected(puzzle.start, puzzle.target);
        setNodes((prev) => [...prev, newNode]);
        setEdges(newEdges);
        if (connectedNow) {
          setWon(true);
        } else if (matchList.length > 0) {
          const names = matchList
            .slice(0, 3)
            .map((m) => `„${m.word}” (${Math.round(m.score * 100)}%)`)
            .join(", ");
          showFeedback(`„${w}” łączy się z: ${names}.`);
        } else {
          const pct = data.best ? Math.round(data.best.score * 100) : 0;
          const near = data.best ? ` Najbliższe: „${data.best.word}” (${pct}%, próg 32%).` : "";
          showFeedback(`Słowo wisi w próżni.${near} Możesz je odsunąć na bok.`, "warn");
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
    [busy, won, puzzle, nodes, edges, dims, showFeedback, mode, posSelection],
  );

  const newGame = useCallback(() => {
    setPosDraft(posSelection);
    setShowPosModal(true);
  }, [posSelection]);

  const togglePos = useCallback((p: string) => {
    setPosDraft((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }, []);

  const confirmPosModal = useCallback(() => {
    if (posDraft.length === 0) return;
    const sel = [...posDraft].sort();
    localStorage.setItem(posStorageKey, JSON.stringify(sel));
    localStorage.removeItem(storageKeyPractice(sel));
    setPosSelection(sel);
    setReadyKey(sel.join("+"));
    setShowPosModal(false);
  }, [posDraft]);

  const removeWord = useCallback(
    (word: string) => {
      const n = nodes.find((x) => x.word === word);
      if (!n || n.start || n.target) return;
      if (dragRef.current?.word === word) {
        dragRef.current = null;
        setDragging(null);
      }
      const nextNodes = nodes.filter((x) => x.word !== word);
      const nextEdges = edges.filter((e) => e.from !== word && e.to !== word);
      setNodes(nextNodes);
      setEdges(nextEdges);
      if (puzzle) {
        const uf = new UnionFind(nextNodes.map((x) => x.word));
        for (const e of nextEdges) uf.union(e.from, e.to);
        if (!uf.connected(puzzle.start, puzzle.target)) setWon(false);
      }
    },
    [nodes, edges, puzzle],
  );

  const share = useCallback(async () => {
    if (!puzzle) return;
    const chain = shortestChain(edges, puzzle.start, puzzle.target);
    const text =
      `SEMANTYKI.pl · ${puzzle.date}\n` +
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

  const winEdgeKeys = useMemo(() => {
    if (!won || !puzzle) return new Set<string>();
    const chain = shortestChain(edges, puzzle.start, puzzle.target);
    const s = new Set<string>();
    for (let i = 0; i < chain.length - 1; i++) s.add(edgeKey(chain[i], chain[i + 1]));
    return s;
  }, [won, puzzle, edges]);

  const orderedNodes = useMemo(() => {
    if (!dragging) return nodes;
    const d = nodes.find((n) => n.word === dragging);
    const rest = nodes.filter((n) => n.word !== dragging);
    return d ? [...rest, d] : nodes;
  }, [nodes, dragging]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brandRow}>
          <h1 className={styles.brand}>
            SEMANTYKI<span className={styles.brandAccent}>.pl</span>
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
        <svg
          ref={svgRef}
          className={styles.board}
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handleBoardPointerUp}
          onPointerCancel={handleBoardPointerUp}
        >
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
            const isWin = winEdgeKeys.has(edgeKey(e.from, e.to));
            const cls = [
              styles.edge,
              i === edges.length - 1 && !isWin ? styles.edgeNew : "",
              isWin ? styles.edgeWin : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <path
                key={`${e.from}-${e.to}`}
                d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                className={cls}
                style={{ opacity: isWin ? 1 : won ? 0.35 : intensity }}
                fill="none"
              />
            );
          })}
          {orderedNodes.map((n) => {
            const w = n.word.length * 8.8 + 30;
            const floaty = isFloating(n.word);
            const cls =
              n.start || n.target
                ? styles.nodeAnchor
                : floaty
                  ? styles.nodeFloating
                  : styles.node;
            const draggable = !n.start && !n.target;
            const origIdx = nodes.findIndex((x) => x.word === n.word);
            return (
              <g
                key={n.word}
                transform={`translate(${n.x}, ${n.y})`}
                onPointerDown={draggable ? handleNodePointerDown(n.word, origIdx) : undefined}
                className={
                  draggable ? `${styles.wordGroup} ${styles.draggable}` : styles.wordGroup
                }
              >
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
                {draggable && (
                  <g
                    className={styles.removeBtn}
                    transform={`translate(${w / 2 - 2}, ${-36})`}
                    role="button"
                    aria-label={`Usuń „${n.word}”`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeWord(n.word);
                    }}
                  >
                    <circle className={styles.removeBtnCircle} r={11} />
                    <path className={styles.removeBtnCross} d="M -4 -4 L 4 4 M 4 -4 L -4 4" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <footer className={styles.footer}>
        <div className={styles.hint}>
          Dopisz słowo, które znaczeniowo łączy się z którymś słowem na planszy — połączenie
          powstaje od 32% podobieństwa. Słowa bez połączeń możesz przeciągnąć na bok lub usunąć
          krzyżykiem (×).
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

      {showPosModal && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h2 className={styles.posTitle}>Wybierz części mowy</h2>
            <p className={styles.posHint}>
              Dopuszczalne będą tylko słowa z zaznaczonych kategorii.
            </p>
            {POS_GROUPS.map((g) => (
              <div key={g.label} className={styles.posGroup}>
                <div className={styles.posGroupLabel}>{g.label}</div>
                <div className={styles.posItems}>
                  {g.items.map((p) => (
                    <label key={p} className={styles.posItem}>
                      <input
                        type="checkbox"
                        checked={posDraft.includes(p)}
                        onChange={() => togglePos(p)}
                      />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className={styles.winActions}>
              <button
                className={styles.primaryBtn}
                disabled={posDraft.length === 0}
                onClick={confirmPosModal}
              >
                Rozpocznij
              </button>
              <button
                className={styles.ghostBtn}
                onClick={() => {
                  setShowPosModal(false);
                  setMode("daily");
                }}
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
