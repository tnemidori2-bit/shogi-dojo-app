import { ENGINE_DEPTH, ENGINE_SKILL } from './chess.js';

// Stockfish（ブラウザ版・軽い1スレッド版）を Web Worker の中で動かす橋渡し。画面は固まらない。
// 使うのはチェスの対コンピュータを始めたときだけ。読み込めなかったら best() は null を返す（画面側が代わりの手を使う）
const URL_BASE = `${import.meta.env.BASE_URL}engines/stockfish/stockfish-19-lite-single.js`;
const THINK_LIMIT_MS = 8000;

export function createChessEngine() {
  let worker = null, ready = null, waiting = null, failed = false;

  function start() {
    if (ready) return ready;
    ready = new Promise((resolve) => {
      try {
        worker = new Worker(URL_BASE);
      } catch { failed = true; resolve(false); return; }
      const timer = setTimeout(() => { failed = true; resolve(false); }, 15000);
      worker.onerror = () => { failed = true; clearTimeout(timer); resolve(false); if (waiting) waiting(null); };
      worker.onmessage = (ev) => {
        const line = typeof ev.data === 'string' ? ev.data : '';
        if (line === 'uciok') {
          worker.postMessage(`setoption name Skill Level value ${ENGINE_SKILL}`);
          worker.postMessage('isready');
        } else if (line === 'readyok') { clearTimeout(timer); resolve(true); }
        else if (line.startsWith('bestmove') && waiting) waiting(line.split(' ')[1] || null);
      };
      worker.postMessage('uci');
    });
    return ready;
  }

  // 局面（FEN）から、エンジンが選んだ手（"e2e4" の形）を返す。だめなら null
  async function best(fen) {
    if (failed || !(await start())) return null;
    return new Promise((resolve) => {
      const t = setTimeout(() => { waiting = null; worker.postMessage('stop'); resolve(null); }, THINK_LIMIT_MS);
      waiting = (mv) => { clearTimeout(t); waiting = null; resolve(mv && mv !== '(none)' ? mv : null); };
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${ENGINE_DEPTH}`);
    });
  }

  function stop() {
    if (!worker) return;
    try { worker.postMessage('quit'); } catch { /* ignore */ }
    worker.terminate();
    worker = null; waiting = null;
  }

  return { best, stop };
}
