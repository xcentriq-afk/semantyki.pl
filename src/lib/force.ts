export interface SimNode {
  word?: string;
  floaty?: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  anchorX: number | null;
  anchorY: number | null;
  strength: number;
}

export function tick(
  nodes: SimNode[],
  edges: [number, number][],
  w: number,
  h: number,
  pinned: number | null,
) {
  const repulsion = 700;
  const springLen = Math.min(130, Math.max(90, w / 8));
  const spring = 0.05;
  const damping = 0.88;
  const centerPull = 0.004;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      let dx = nodes[j].x - nodes[i].x;
      let dy = nodes[j].y - nodes[i].y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 9) {
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        d2 = dx * dx + dy * dy;
      }
      const d = Math.sqrt(d2);
      const f = repulsion / d2;
      const fx = (f * dx) / d;
      const fy = (f * dy) / d;
      nodes[i].vx -= fx;
      nodes[i].vy -= fy;
      nodes[j].vx += fx;
      nodes[j].vy += fy;
    }
  }

  for (const [a, b] of edges) {
    const dx = nodes[b].x - nodes[a].x;
    const dy = nodes[b].y - nodes[a].y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = spring * (d - springLen);
    const fx = (f * dx) / d;
    const fy = (f * dy) / d;
    nodes[a].vx += fx;
    nodes[a].vy += fy;
    nodes[b].vx -= fx;
    nodes[b].vy -= fy;
  }

  for (let i = 0; i < nodes.length; i++) {
    if (i === pinned) continue;
    const n = nodes[i];
    n.vx *= damping;
    n.vy *= damping;
    if (n.anchorX !== null && n.anchorY !== null) {
      n.vx += (n.anchorX - n.x) * n.strength;
      n.vy += (n.anchorY - n.y) * n.strength;
    } else {
      n.vx += (w / 2 - n.x) * centerPull;
      n.vy += (h / 2 - n.y) * centerPull;
    }
    n.x += n.vx;
    n.y += n.vy;
    n.x = Math.min(Math.max(n.x, 80), w - 80);
    n.y = Math.min(Math.max(n.y, 50), h - 50);
  }
}
