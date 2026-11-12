# 将棋道場

子ども向けの将棋・ボードゲーム・カードゲームのアプリ。https://shogi-dojo.pages.dev

このリポジトリは、下のエンジンが GPL-3.0 のため、**GNU GPL v3** で公開しています（`LICENSE`）。

## 使っているもの（出所）

| もの | 使い道 | 入手先・ライセンス |
| --- | --- | --- |
| Stockfish.js 19（lite-single） | チェスのコンピュータ（ブラウザ内で動く） | https://github.com/nmrugg/stockfish.js ・ GPL-3.0（`public/engines/stockfish/`。元は npm の `stockfish@19.0.1`） |
| やねうら王（@mizarjp/yaneuraou.k-p 7.6.3-alpha.0） | 将棋「ほんき」のコンピュータ（ブラウザ内で動く。評価関数 SuishoPetite 2021-11 〈たややん＠水匠〉入り） | https://github.com/yaneurao/YaneuraOu ・ https://github.com/mizar/YaneuraOu.wasm ・ GPL-3.0（`public/engines/yaneuraou/`、ライセンス全文は同じ場所の `LICENSE.md`）。評価関数ファイルだけの配布条件は未確認 |
| Stockfish | 上のもとになったエンジン | https://github.com/official-stockfish/Stockfish ・ GPL-3.0 |
| chess.js 1.4.0 | チェスのルール判定 | https://github.com/jhlywa/chess.js ・ BSD-2-Clause |
| idb-keyval 6.3.0 | ブラウザ内の記録 | MIT |
| チェスの駒の絵 | 文字（♚♛♜♝♞♟）を色分けして表示 | 画像ファイルは使っていない |

## つくる・テスト

```
npm install
npm run dev
npm test
npm run build
```
