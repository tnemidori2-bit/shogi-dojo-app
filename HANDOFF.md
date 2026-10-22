# 将棋道場 引き継ぎメモ（2026-10-22）

## いまの状態
- 第1段階（土台）完成。iPad で確認済み（2026-10-22）。
- 第2段階（レッスン全駒・成り・★と級）完成。iPad で確認済み（2026-10-22）。
- 第3段階（ドリル）完成。iPad で確認済み（2026-10-23）。
- 第4段階（つめしょうぎ）完成。iPad で確認済み（2026-10-23）。
- 第5段階（せんぽう）完成。iPad で確認済み（2026-10-23）。
- 第6段階（たいきょく）完成。iPad で確認済み（2026-10-23）。
- 第7段階（中身を増やす）を実装済み（2026-10-23）：つめしょうぎ 1手詰め60問・3手詰め40問・5手詰め20問、戦法 4本（四間飛車・早繰り銀を追加）。Mac で通し確認。**iPad での確認待ち**。
- 平手の飛・角の位置を直した（decisions.json の 2026-10-23-hirate-fix）。盤の向きが変わっている。
- 公開: https://shogi-dojo.pages.dev （GitHub tnemidori2-bit/shogi-dojo の main に push すると自動公開）
- 設計の正本: SPEC.md（第7章が段階分け）
- 置き場所: ~/game/shogi-dojo

## 次にやること
- 満さんが commit・push して、iPad で第7段階を確認（5手詰めが開く条件、追加した問題、四間飛車・早繰り銀の「まなぶ」「ためす」、★と級の表示）。
- **四間飛車・早繰り銀（と棒銀）の手順と説明の正しさを、満さんの目（できれば将棋に詳しい人）で確認してもらう**。直すときは public/data/openings/*.json の text。
- AI の強さは、満さん・家族に遊んでもらった感触を聞いてから調整する（src/shogi/ai.js の LEVELS）。
- 次の候補（満さんが決める）: 戦法をもっと足す（矢倉・居飛車の受け方・後手側の戦法）、ドリルを足す（王手をかわす手など）、アイコン（icons/）、書き出し・読み込み、ホームの背景絵、5手詰めの追加。

## つくりの要点
- src/main.js: 画面の切り替え（start → profile → home → lesson → result → profile）と、レッスン後の記録（recordLesson）
- src/core: store（状態）・storage（IndexedDB・migrate）・audio（Web Audio 合成）・data（public/data を読む）・rank（級）
- src/shogi/rules.js: 盤・合法手。画面に依存しない。テストは `npm test`（tools/rules.test.mjs）
- src/screens: start / profile / adult / home / lesson / result
- 内容は public/data: pieces.json（駒の動き）・levels.json・lessons/*.json（index.json に id を足す）
- 保存キー: family / profiles / settings / person/<id>。形式を変えるときは storage.js の migrate を足す
- 画面の文字は src/text.js に集める。開発サーバーでは window.__state で状態を見られる

## 気をつけること
- 外部通信は自分の /data の fetch だけ。`grep -nE 'analytics|googleapis|<a '` で確認
- package-lock.json を作り直すときは decisions.json の 2026-10-22-lockfile-by-npm-10 の手順で（npm 10.9.2・空フォルダ）
- commit・push・Cloudflare の設定は満さんが行う。Claude は手順を案内する
- 家族日記には手を入れない
