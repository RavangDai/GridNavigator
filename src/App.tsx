import { useEffect, useRef, useState } from "react";
import "./App.css";

type CellType =
  | "wall"
  | "passage"
  | "start"
  | "end"
  | "visited"
  | "path"
  | "pathHead";

interface Cell {
  row: number;
  col: number;
  type: CellType;
}

interface Position {
  row: number;
  col: number;
}

type Algorithm = "bfs" | "dfs";
type Theme = "dark" | "light";
type Speed = "slow" | "normal" | "fast";

interface SolveResult {
  path: Position[] | null;
  visitedOrder: Position[];
}

const posKey = (p: Position) => `${p.row}-${p.col}`;

// ---------- Maze generation (recursive backtracker) ----------

function generatePerfectMaze(mazeRows: number, mazeCols: number): Cell[][] {
  // clamp logical size for safety
  const clampedRows = Math.min(50, Math.max(5, mazeRows));
  const clampedCols = Math.min(50, Math.max(5, mazeCols));

  const rows = 2 * clampedRows + 1;
  const cols = 2 * clampedCols + 1;

  const grid: Cell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < cols; c++) {
      row.push({ row: r, col: c, type: "wall" });
    }
    grid.push(row);
  }

  const inBounds = (mr: number, mc: number) =>
    mr >= 0 && mr < clampedRows && mc >= 0 && mc < clampedCols;

  const visited: boolean[][] = Array.from({ length: clampedRows }, () =>
    Array(clampedCols).fill(false)
  );

  function carveFrom(mr: number, mc: number) {
    visited[mr][mc] = true;
    const r = 2 * mr + 1;
    const c = 2 * mc + 1;
    grid[r][c].type = "passage";

    const dirs: [number, number][] = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];
    // shuffle directions
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    for (const [dr, dc] of dirs) {
      const nmr = mr + dr;
      const nmc = mc + dc;
      if (!inBounds(nmr, nmc) || visited[nmr][nmc]) continue;

      const wallR = r + dr;
      const wallC = c + dc;
      grid[wallR][wallC].type = "passage";
      carveFrom(nmr, nmc);
    }
  }

  carveFrom(0, 0);

  // entrance & exit
  grid[1][0].type = "start";
  grid[rows - 2][cols - 1].type = "end";

  return grid;
}

// ---------- Pathfinding (BFS / DFS) ----------

function getNeighbors(grid: Cell[][], pos: Position): Position[] {
  const deltas = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];
  const rows = grid.length;
  const cols = grid[0].length;
  const res: Position[] = [];

  for (const { dr, dc } of deltas) {
    const nr = pos.row + dr;
    const nc = pos.col + dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
    const cell = grid[nr][nc];
    if (cell.type === "wall") continue;
    res.push({ row: nr, col: nc });
  }
  return res;
}

function findStartEnd(grid: Cell[][]): { start: Position; end: Position } {
  let start: Position | null = null;
  let end: Position | null = null;

  for (const row of grid) {
    for (const cell of row) {
      if (cell.type === "start") start = { row: cell.row, col: cell.col };
      if (cell.type === "end") end = { row: cell.row, col: cell.col };
    }
  }

  if (!start || !end) throw new Error("Maze must contain start and end");
  return { start, end };
}

function bfs(grid: Cell[][]): SolveResult {
  const { start, end } = findStartEnd(grid);
  const rows = grid.length;
  const cols = grid[0].length;

  const visited = Array.from({ length: rows }, () =>
    Array(cols).fill(false)
  );
  const parent = new Map<string, Position | null>();
  const q: Position[] = [];
  const visitedOrder: Position[] = [];

  q.push(start);
  visited[start.row][start.col] = true;
  parent.set(posKey(start), null);

  while (q.length > 0) {
    const cur = q.shift() as Position;
    visitedOrder.push(cur);
    if (cur.row === end.row && cur.col === end.col) break;

    for (const n of getNeighbors(grid, cur)) {
      if (visited[n.row][n.col]) continue;
      visited[n.row][n.col] = true;
      parent.set(posKey(n), cur);
      q.push(n);
    }
  }

  if (!parent.has(posKey(end))) return { path: null, visitedOrder };

  const path: Position[] = [];
  let cur: Position | null = end;
  while (cur) {
    path.push(cur);
    cur = parent.get(posKey(cur)) ?? null;
  }
  path.reverse();
  return { path, visitedOrder };
}

function dfs(grid: Cell[][]): SolveResult {
  const { start, end } = findStartEnd(grid);
  const rows = grid.length;
  const cols = grid[0].length;

  const visited = Array.from({ length: rows }, () =>
    Array(cols).fill(false)
  );
  const parent = new Map<string, Position | null>();
  const stack: Position[] = [];
  const visitedOrder: Position[] = [];

  stack.push(start);
  parent.set(posKey(start), null);

  while (stack.length > 0) {
    const cur = stack.pop() as Position;
    if (visited[cur.row][cur.col]) continue;
    visited[cur.row][cur.col] = true;
    visitedOrder.push(cur);

    if (cur.row === end.row && cur.col === end.col) break;

    const neighbors = getNeighbors(grid, cur);
    for (let i = neighbors.length - 1; i >= 0; i--) {
      const n = neighbors[i];
      if (visited[n.row][n.col]) continue;
      if (!parent.has(posKey(n))) parent.set(posKey(n), cur);
      stack.push(n);
    }
  }

  if (!parent.has(posKey(end))) return { path: null, visitedOrder };

  const path: Position[] = [];
  let cur: Position | null = end;
  while (cur) {
    path.push(cur);
    cur = parent.get(posKey(cur)) ?? null;
  }
  path.reverse();
  return { path, visitedOrder };
}

// ---------- MAIN COMPONENT ----------

function App() {
  const [mazeRows, setMazeRows] = useState(25);
  const [mazeCols, setMazeCols] = useState(25);
  const [grid, setGrid] = useState<Cell[][]>(() =>
    generatePerfectMaze(25, 25)
  );
  const [algorithm, setAlgorithm] = useState<Algorithm>("bfs");
  const [theme, setTheme] = useState<Theme>("dark");
  const [speed, setSpeed] = useState<Speed>("fast");

  const [status, setStatus] = useState("Maze ready");
  const [pathLength, setPathLength] = useState<number | null>(null);
  const [visitedCount, setVisitedCount] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const timeoutsRef = useRef<number[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // --------- Audio helpers ---------
  const getAudioContext = () => {
    if (audioCtxRef.current) return audioCtxRef.current;
    const AC =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    audioCtxRef.current = ctx;
    return ctx;
  };

  const playTone = (
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    volume = 0.04
  ) => {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + duration);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  };

  const playUIClick = () => playTone(260, 0.08, "sine", 0.06);
  const playSolveStart = () => playTone(520, 0.12, "triangle", 0.07);
  const playSolveDone = () => {
    playTone(660, 0.15, "triangle", 0.08);
    setTimeout(() => playTone(880, 0.18, "triangle", 0.05), 120);
  };

  // --------- cleanup timeouts on unmount ----------
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const clearAnimations = () => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
  };

  const regenerateMaze = () => {
    if (isAnimating) return;
    clearAnimations();
    playUIClick();

    const clampedRows = Math.min(50, Math.max(5, mazeRows));
    const clampedCols = Math.min(50, Math.max(5, mazeCols));

    setMazeRows(clampedRows);
    setMazeCols(clampedCols);
    setGrid(generatePerfectMaze(clampedRows, clampedCols));

    setStatus("New maze generated");
    setPathLength(null);
    setVisitedCount(null);
  };

  const clearPath = () => {
    if (isAnimating) return;
    clearAnimations();
    playUIClick();

    setGrid((prev) =>
      prev.map((row) =>
        row.map((cell) => {
          if (
            cell.type === "visited" ||
            cell.type === "path" ||
            cell.type === "pathHead"
          ) {
            return { ...cell, type: "passage" };
          }
          return cell;
        })
      )
    );
    setStatus("Cleared path");
    setPathLength(null);
    setVisitedCount(null);
  };

  const handleSolve = () => {
    if (isAnimating) return;
    clearAnimations();
    playSolveStart();

    clearPath();
    setStatus("Solving maze...");

    const snapshot = grid.map((row) => row.map((c) => ({ ...c })));
    const solver = algorithm === "bfs" ? bfs : dfs;
    const { path, visitedOrder } = solver(snapshot);

    setVisitedCount(visitedOrder.length);

    if (!path) {
      setStatus("No path found");
      return;
    }

    setPathLength(path.length);
    setIsAnimating(true);

    const baseDelay =
      speed === "slow" ? 40 : speed === "fast" ? 5 : 20;

    const visitedSet = new Set<string>();

    // animate visited nodes
    visitedOrder.forEach((pos, i) => {
      const id = window.setTimeout(() => {
        visitedSet.add(posKey(pos));
        setGrid((prev) =>
          prev.map((row) =>
            row.map((cell) => {
              const key = posKey(cell);
              if (
                cell.type !== "start" &&
                cell.type !== "end" &&
                visitedSet.has(key)
              ) {
                // don't overwrite future path head/trail yet
                if (cell.type === "path" || cell.type === "pathHead") {
                  return cell;
                }
                return { ...cell, type: "visited" };
              }
              return cell;
            })
          )
        );
        if (i === visitedOrder.length - 1) {
          setStatus("Drawing shortest path...");
        }
      }, baseDelay * i);
      timeoutsRef.current.push(id);
    });

    // === animate path as a moving "snake" ===
    const pathKeys = path.map(posKey);
    const keyToIndex = new Map<string, number>();
    pathKeys.forEach((k, idx) => keyToIndex.set(k, idx));

    path.forEach((pos, i) => {
      const id = window.setTimeout(
        () => {
          setGrid((prev) =>
            prev.map((row) =>
              row.map((cell) => {
                if (cell.type === "start" || cell.type === "end")
                  return cell;

                const key = posKey(cell);
                const idx = keyToIndex.get(key);

                if (idx === undefined) {
                  // non-path cells (visited / passage) stay as-is
                  return cell;
                }

                if (idx === i) {
                  // current head
                  return { ...cell, type: "pathHead" };
                }

                if (idx < i) {
                  // trail behind head
                  return { ...cell, type: "path" };
                }

                // ahead of head
                return cell;
              })
            )
          );

          // when snake reaches the end, finalize
          if (i === path.length - 1) {
            window.setTimeout(() => {
              setGrid((prev) =>
                prev.map((row) =>
                  row.map((cell) => {
                    if (cell.type === "pathHead") {
                      return { ...cell, type: "path" };
                    }
                    return cell;
                  })
                )
              );
              setIsAnimating(false);
              setStatus(`Solved using ${algorithm.toUpperCase()}`);
              playSolveDone();
            }, baseDelay * 2);
          }
        },
        baseDelay * visitedOrder.length + baseDelay * i
      );
      timeoutsRef.current.push(id);
    });
  };

  const onMazeSizeChange = (rows: number, cols: number) => {
    if (isAnimating) return;
    const clampedRows = Math.min(50, Math.max(5, rows));
    const clampedCols = Math.min(50, Math.max(5, cols));
    setMazeRows(clampedRows);
    setMazeCols(clampedCols);
    setGrid(generatePerfectMaze(clampedRows, clampedCols));
    setStatus("Maze size changed");
    setPathLength(null);
    setVisitedCount(null);
    playUIClick();
  };

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return; // don't trigger when typing in inputs
      }

      if (e.code === "Space") {
        e.preventDefault();
        handleSolve();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleSolve();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        regenerateMaze();
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        clearPath();
      } else if (e.key === "1") {
        setSpeed("slow");
      } else if (e.key === "2") {
        setSpeed("normal");
      } else if (e.key === "3") {
        setSpeed("fast");
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

    return (
    <div className={`app theme-${theme}`}>
      <header className="nav">
        <div className="nav-left">
          <img
            src="/favicon.svg"
            className="app-logo"
            alt="GridNavigator logo"
          />
          <div className="nav-title-block">
            <h1 className="app-title">GridNavigator</h1>
            <p className="app-subtitle">
              Line-style maze generator &amp; pathfinding visualizer
            </p>
          </div>
        </div>

        <div className="nav-controls">
          <div className="nav-center">
            <div className="control-group">
              <label className="control-label">Algorithm</label>
              <select
                value={algorithm}
                onChange={(e) =>
                  setAlgorithm(e.target.value as Algorithm)
                }
                disabled={isAnimating}
              >
                <option value="bfs">BFS (shortest path)</option>
                <option value="dfs">DFS</option>
              </select>
            </div>

            <div className="control-group">
              <label className="control-label">Maze size</label>
              <div className="size-buttons">
                <button
                  className={`size-btn ${
                    mazeRows === 5 ? "active" : ""
                  }`}
                  onClick={() => onMazeSizeChange(5, 5)}
                  disabled={isAnimating}
                >
                  5×5
                </button>
                <button
                  className={`size-btn ${
                    mazeRows === 25 ? "active" : ""
                  }`}
                  onClick={() => onMazeSizeChange(25, 25)}
                  disabled={isAnimating}
                >
                  25×25
                </button>
                <button
                  className={`size-btn ${
                    mazeRows === 50 ? "active" : ""
                  }`}
                  onClick={() => onMazeSizeChange(50, 50)}
                  disabled={isAnimating}
                >
                  50×50
                </button>
              </div>
            </div>

            <div className="control-group">
              <label className="control-label">Theme</label>
              <select
                value={theme}
                onChange={(e) =>
                  setTheme(e.target.value as Theme)
                }
                disabled={isAnimating}
              >
                <option value="dark">Midnight</option>
                <option value="light">Paper</option>
              </select>
            </div>

            <div className="control-group">
              <label className="control-label">Speed</label>
              <select
                value={speed}
                onChange={(e) =>
                  setSpeed(e.target.value as Speed)
                }
                disabled={isAnimating}
              >
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </div>
          </div>

          <div className="nav-right">
            <button
              className="btn ghost"
              onClick={regenerateMaze}
              disabled={isAnimating}
            >
              New maze
            </button>
            <button
              className="btn ghost"
              onClick={clearPath}
              disabled={isAnimating}
            >
              Clear path
            </button>
            <button
              className="btn primary"
              onClick={handleSolve}
              disabled={isAnimating}
            >
              {isAnimating ? "Solving…" : "Solve"}
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        {/* Top status + maze profile */}
        <section className="status-row">
          <div className="status-pill">
            <span className="status-label">{status}</span>
            <span className="status-meta-line">
              Path: {pathLength ?? "--"} • Visited: {visitedCount ?? "--"}
            </span>
          </div>

          <div className="status-hint">
            <div className="hint-title">Maze profile</div>

            <div className="hint-line">
              <span className="hint-dot" />
              Perfect maze · recursive backtracking
            </div>

            <div className="hint-line">
              <span className="hint-dot" />
              Start: left opening · End: right opening
            </div>

            <div className="hint-line">
              <span className="hint-dot" />
              Shortcuts: Space/S = Solve · N = New · C = Clear · 1–3 = Speed
            </div>
          </div>
        </section>

        {/* Maze grid */}
        <section className="grid-wrapper">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${grid[0].length}, 10px)`,
            }}
          >
            {grid.map((row) =>
              row.map((cell) => (
                <div
                  key={posKey(cell)}
                  className={`cell cell-${cell.type}`}
                />
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
