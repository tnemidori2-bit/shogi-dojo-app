# 将棋道場 引き継ぎメモ（2026-10-22）

## いまの状態
- 第1段階（土台）完成。iPad で確認済み（2026-10-22）。
- 第2段階（レッスン全駒・成り・★と級）完成。iPad で確認済み（2026-10-22）。
- 第3段階（ドリル）完成。iPad で確認済み（2026-10-23）。
- 第4段階（つめしょうぎ）完成。iPad で確認済み（2026-10-23）。
- 第5段階（せんぽう）完成。iPad で確認済み（2026-10-23）。
- 第6段階（たいきょく）完成。iPad で確認済み（2026-10-23）。
- 第7段階（中身を増やす）完成。iPad で確認済み（2026-10-23）：つめしょうぎ 1手詰め60問・3手詰め40問・5手詰め20問、戦法 4本。
- アイコンと書き出し・読み込みを実装済み（2026-10-23）。iPad で確認済み。
- AI を強くした（2026-10-26）：強さ5段階（AI 20級〜5級くらい）、定跡、探索の高速化、成った駒の前進の評価。Mac で自己対戦と画面を確認。**iPad での確認待ち**。
- 平手の飛・角の位置を直した（decisions.json の 2026-10-23-hirate-fix）。盤の向きが変わっている。
- 公開: https://shogi-dojo.pages.dev （GitHub tnemidori2-bit/shogi-dojo の main に push すると自動公開）
- 設計の正本: SPEC.md（第7章が段階分け）
- 置き場所: ~/game/shogi-dojo

- オセロ・五目並べ・囲碁（9路盤）とゲーム選択画面を追加（2026-11-05〜06）。レッスン8本は囲碁のみ。Mac で動作確認。**iPad での確認待ち**。コミット: 109e96d・3491b71・4ab2f00・1391f25。ルールは src/games/（othello.js・gomoku.js・go.js・golessons.js・board.js）、画面は src/screens/（gamepick.js・boardgame.js・golesson.js）。テストは tools/boardgames.test.mjs。決めごとは decisions.json の 2026-11-05-add-othello-gomoku・2026-11-06-add-go-and-lessons。
- CPUを5段階にした（レベル制・勝つと次が開く）。コミット 6f928e4。levels.js が進み具合を localStorage に保存。**iPad での確認待ち**。
- オセロ・五目に初級レッスン（5本ずつ）を追加、七並べ・スピード・UNO を追加（2026-11-06）。CPU5段階とあわせて公開済み。コミット 038bbb4・34f8d92・80aff95。レッスンは screens/boardlesson.js と games/lessons.js、カードは src/cards/ と screens/cardgames.js、テストは tools/cards.test.mjs。**iPad・iPhone での確認待ち**。
- 人狼を追加（2026-11-06）。七並べ・スピード・UNOに「ルール」ボタンも追加。公開済み。コミット 0cd330e・a76fba7。ルールとCPUは src/games/werewolf.js、画面は src/screens/werewolf.js、テストは tools/werewolf.test.mjs。決めごとは decisions.json の 2026-11-06-werewolf。**iPad・iPhone での確認待ち**（占い師・騎士を引いた遊び方は画面で未確認）。
- ゲーム選択の一番下に「かぞくの島」への入口を追加（2026-11-10、c97aed0）。別アプリへのリンクで、記録は共有しない。島側に戻るボタンも足した。

## 次にやること
- iPad で確認：選択画面→各ゲーム→もどる、オセロ・五目・囲碁を終局まで（ふたり／CPU）、囲碁レッスン8本、ダブルタップ拡大が起きないこと、横縦向きで盤がはみ出さないこと。
- 今後の候補：七並べ・UNOのCPUの強さ、UNOのルール拡張、隣り合う段階の差の調整、囲碁のレベル5を Worker に、人が白を持つ選択、進み具合のプロフィール保存、オセロの次の一手ドリル、五目の四三ドリル、囲碁の「地を囲む」レッスンと詰碁、連珠の禁じ手、先読みするCPU、対局の保存。
- 満さんが commit・push して、iPad で確認：「たいきょく」で強さが5つ出ること、AI の指し方（序盤が定跡どおりか、駒の使い方）、考える時間（いちばん強い AI は最大4秒）、★の表示。
- **AIの強さの級（20・15・10・7・5級）は、私の推測の目安**。満さん・家族に遊んでもらって、「この AI に○級の人が何割勝てたか」を聞いて直す（src/text.js の levelLabel）。
- 戦法（棒銀・四間飛車・早繰り銀）の説明の正しさを満さんが確認。
- 次の候補（満さんが決める）: 戦法をもっと足す（足すとAIの定跡にもなる）、ドリルを足す、「きょうの一問」、対局の記録の保存、ひらがな／漢字の切り替え、入玉の判定、AI の評価をさらに調整。

## つくりの要点
- src/main.js: 画面の切り替え（start → profile → home → lesson → result → profile）と、レッスン後の記録（recordLesson）
- src/core: store（状態）・storage（IndexedDB・migrate）・audio（Web Audio 合成）・data（public/data を読む）・rank（級）
- src/shogi/rules.js: 盤・合法手。画面に依存しない。テストは `npm test`（tools/rules.test.mjs）
- src/screens: start / profile / adult / home / lesson / result
- 内容は public/data: pieces.json（駒の動き）・levels.json・lessons/*.json（index.json に id を足す）
- 保存キー: family / profiles / settings / person/<id>。形式を変えるときは storage.js の migrate を足す
- 書き出し・読み込み: 変換と検査は src/core/backup.js（migrateFamily・migratePerson・buildBackup・parseBackup）、保存側は src/core/storage.js（buildExport・applyImport・askPersistent）、画面は src/screens/adult.js。保存の形に項目を足したら、backup.js の migrate に足す。テストは tools/backup.test.mjs
- 画面の文字は src/text.js に集める。開発サーバーでは window.__state で状態を見られる

## 気をつけること
- 外部通信は自分の /data の fetch だけ。`grep -nE 'analytics|googleapis|<a '` で確認
- package-lock.json を作り直すときは decisions.json の 2026-10-22-lockfile-by-npm-10 の手順で（npm 10.9.2・空フォルダ）
- commit・push・Cloudflare の設定は満さんが行う。Claude は手順を案内する
- 家族日記には手を入れない
