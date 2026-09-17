export interface SimNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  anchorX: number | null;
  anchorY: number | null;
}

export function simulate(
  nodes: SimNode[],
  edges: [number, number][],
  w: number,
  h: number,
  ticks = 260,
) {
  const repulsion = 2600;
  const springLen = Math.min(150, Math.max(90, w / 7));
  const spring = 0.035;
  const damping = 0.72;
  const centerPull = 0.012;
  const anchorPull = 0.06;

  for (let t = 0; t < ticks; t++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 4) {
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
    for (const n of nodes) {
      n.vx *= damping;
      n.vy *= damping;
      if (n.anchorX !== null && n.anchorY !== null) {
        n.vx += (n.anchorX - n.x) * anchorPull;
        n.vy += (n.anchorY - n.y) * anchorPull;
      } else {
        n.vx += (w / 2 - n.x) * centerPull;
        n.vy += (h / 2 - n.y) * centerPull;
      }
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.min(Math.max(n.x, 70), w - 70);
      n.y = Math.min(Math.max(n.y, 40), h - 40);
    }
  }
}
