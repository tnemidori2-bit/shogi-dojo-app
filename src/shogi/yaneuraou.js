// 将棋「本気」：やねうら王（ブラウザ版・NNUE）を Web Worker の中で動かす橋渡し。画面は固まらない。
// 使うのは「本気」で対局を始めたときだけ。読み込めなかったときは ready() が false を返し、画面側が元の AI に戻る
const BASE = `${import.meta.env.BASE_URL}engines/yaneuraou/`;
export const THINK_CHOICES = [1000, 3000, 10000]; // 1手の考える時間（ミリ秒）
export const THINK_DEFAULT = 3000;

// エンジンのファイルを先に読み込んで、進み具合（0〜1）を知らせる。2回目以降はブラウザのキャッシュから読む
async function preload(onProgress) {
  const res = await fetch(`${BASE}yaneuraou.k-p.wasm`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) { await res.arrayBuffer(); onProgress?.(1); return; }
  const reader = res.body.getReader();
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    got += value.length;
    onProgress?.(Math.min(1, got / total));
  }
  onProgress?.(1);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof self.YaneuraOu_K_P === 'function') return resolve();
    const el = document.createElement('script');
    el.src = src; el.onload = () => resolve(); el.onerror = () => reject(new Error('script'));
    document.head.appendChild(el);
  });
}

// ※ このエンジンは、読み込みを Web Worker の中ですると止まってしまう作りだった（実機の Chrome で確認）。
//   そこで画面と同じ場所で読み込む。考える仕事そのものは、エンジンが自分で作る別スレッド（pthread）で行うので、
//   考えている間も画面は止まらない（takeover の様子は tools/ の手順書ではなく、decisions.json に書いた）
export function createShogiEngine({ onProgress } = {}) {
  let engine = null, ready = null, waiting = null, dead = false;
  const send = (c) => engine && engine.postMessage(c);

  function start() {
    if (ready) return ready;
    ready = (async () => {
      if (!self.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') return false; // 複数スレッドに必要な設定が効いていない
      try {
        await preload(onProgress);
        await loadScript(`${BASE}yaneuraou.k-p.js`);
        engine = await self.YaneuraOu_K_P({ locateFile: (f) => `${BASE}${f}` });
      } catch { return false; }
      if (dead) { try { engine.terminate(); } catch { /* ignore */ } return false; }
      const hc = navigator.hardwareConcurrency || 2;
      const threads = Math.max(1, Math.min(4, hc - 1));
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), 20000);
        let stage = 'usi';
        engine.addMessageListener((line) => {
          if (line === 'usiok' && stage === 'usi') {
            stage = 'isready';
            send('setoption name USI_Hash value 32');
            send('setoption name PvInterval value 0');
            send('setoption name NetworkDelay value 0'); // 持ち時間から引かれないように（考える時間＝えらんだ時間）
            send('setoption name NetworkDelay2 value 0');
            send('setoption name MinimumThinkingTime value 1000');
            send(`setoption name Threads value ${threads}`);
            send('isready');
          } else if (line === 'readyok' && stage === 'isready') { stage = 'ok'; clearTimeout(timer); resolve(true); }
          else if (line.startsWith('bestmove') && waiting) waiting(line.split(' ')[1] || null);
        });
        send('usi');
      });
    })();
    return ready;
  }

  // 局面（position の文字）から、エンジンが選んだ手（"7g7f" や "P*5e"）を返す。投了・だめなら null
  async function best(positionCmd, ms) {
    if (!(await start()) || dead) return null;
    return new Promise((resolve) => {
      const t = setTimeout(() => { waiting = null; send('stop'); resolve(null); }, ms + 8000);
      waiting = (mv) => { clearTimeout(t); waiting = null; resolve(mv && /^([1-9][a-i][1-9][a-i]\+?|[PLNSGBR]\*[1-9][a-i])$/.test(mv) ? mv : null); };
      send('usinewgame');
      send(positionCmd);
      send(`go btime 0 wtime 0 byoyomi ${ms}`);
    });
  }

  function stop() {
    dead = true; waiting = null;
    if (!engine) return;
    try { send('stop'); engine.terminate(); } catch { /* ignore */ }
    engine = null;
  }

  return { ready: start, best, stop };
}
