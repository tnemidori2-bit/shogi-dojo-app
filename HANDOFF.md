# 将棋道場 引き継ぎメモ（2026-10-22）

## いまの状態
- 第1段階（土台）完成。iPad で確認済み（2026-10-22）。
- 第2段階（レッスン全駒・成り・★と級）完成。iPad で確認済み（2026-10-22）。
- 第3段階（ドリル）完成。iPad で確認済み（2026-10-23）。
- 第4段階（つめしょうぎ）完成。iPad で確認済み（2026-10-23）。
- 第5段階（せんぽう）完成。iPad で確認済み（2026-10-23）。
- 第6段階（たいきょく）完成。iPad で確認済み（2026-10-23）。
- 第7段階（中身を増やす）完成。iPad で確認済み（2026-10-23）：つめしょうぎ 1手詰め60問・3手詰め40問・5手詰め20問、戦法 4本。
- アイコンと書き出し・読み込みを実装済み（2026-10-23）。Mac で、書き出し→読み込みの往復を確認。**iPad での確認待ち**（ホーム画面に追加・かきだす・よみこむ）。
- 平手の飛・角の位置を直した（decisions.json の 2026-10-23-hirate-fix）。盤の向きが変わっている。
- 公開: https://shogi-dojo.pages.dev （GitHub tnemidori2-bit/shogi-dojo の main に push すると自動公開）
- 設計の正本: SPEC.md（第7章が段階分け）
- 置き場所: ~/game/shogi-dojo

## 次にやること
- 満さんが commit・push して、iPad で確認：①Safari で「ホーム画面に追加」してアイコンが出ること ②おとな画面（プロフィール画面で「おとな」を2秒長押し）の「かきだす」でファイルが保存できること ③「よみこむ」で、書き出したファイルから記録が戻ること（確認の2回目で置きかわる）。
- **試すときは、まず「かきだす」で今の記録を残してから、「よみこむ」を試す**（読み込むと、いまの記録は全部置きかわる）。
- 戦法（棒銀・四間飛車・早繰り銀）の説明の正しさを満さんが確認。AIの強さは遊んだ感触で調整。
- 次の候補: 戦法をもっと足す（矢倉・居飛車の受け方・後手側）、ドリルを足す（王手をかわす手・駒の値打ちなど）、「きょうの一問」、対局の記録の保存、ひらがな／漢字の切り替え、入玉の判定。

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
