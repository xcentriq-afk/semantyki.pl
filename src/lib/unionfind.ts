export class UnionFind {
  private parent: Map<string, string>;

  constructor(ids: string[]) {
    this.parent = new Map();
    for (const id of ids) this.parent.set(id, id);
  }

  find(x: string): string {
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    while (this.parent.get(x) !== x) {
      const next = this.parent.get(x)!;
      this.parent.set(x, root);
      x = next;
    }
    return root;
  }

  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  connected(a: string, b: string): boolean {
    return this.find(a) === this.find(b);
  }
}
