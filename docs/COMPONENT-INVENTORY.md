# BabelShelf コンポーネント台帳

2026-11-22 JST のローカル作業ツリー（製品コード commit `a739a574275cd9abe552fb00642626c1e48e0ceb`、PR #113 は open、品質確認済み製品ビルド `064f6378b888213a`、168 検証済み資産）を基準にする。台帳更新前のPR headで GitHub Actions run [44970360642](https://github.com/Unjuno/babelshelf/actions/runs/44970360642) は全段階成功。機能と設計の対応、最適化、検証済みの範囲、未解決事項を同じ表で管理する。公開可否は [REMAINING-GATES.md](REMAINING-GATES.md)、ビルド別の証拠は [TEST-RESULTS.txt](TEST-RESULTS.txt) が正本。

状態の意味：**PASS** は記載した検証範囲のみ合格、**PARTIAL** は一部の証拠はあるが受入条件が未完、**OPEN** は実環境または機能の受入が未確認。自動テストを実モデル・公開環境・物理端末の証拠へ読み替えない。

## 機能・実装・最適化

| ID / コンポーネント | 現在の機能と実装 | 現在の最適化・境界 | 現在の状態・残作業 |
|---|---|---|---|
| UI / 操作画面 | React。Chat、Memory、Schedule、Notifications、Settings。`main.tsx`、`Prototype.tsx` | 補助画面を遅延読込、長い会話表示を段階化。失敗再試行を表示上まとめつつ原履歴を保持 | **PARTIAL** — 最新候補の全品質ワークフロー合格、Settings 38/38。以前のバッチでroot消失が1回あり原因未確定。実モデル・公開Site・実機の受入は別ゲート |
| CHAT / 送信・振り分け | `submission-workflow.ts` → `turn-router.ts` → 直接回答、Decisionまたはツール計画。確定回答と活動を保存 | 履歴と要求の関係を分類し、独立質問・明示的な再掲では不要な履歴や推論を省く。生成失敗時の非空previewを`Partial · not verified`として保存。Memoryコピーにも未検証/partial provenanceを維持し、Stop時は未確定previewを確定回答にしない | **PARTIAL** — 追質問の指示対象文脈とpartial provenanceの回帰を追加し全品質合格。300秒実モデル停止、20ターン後の追質問・保存資料質問は未確認。v384実ブラウザでLFM3 native plannerが8回選択/ツールループへ入り、Decision分類は走らなかった。長ループ解消は未完 |
| SOURCE / 検索・出典 | `grounded-answer.ts`、`file-discovery.ts`、`semantic-search-runtime.ts`。選択資料・添付・Memoryを区別し、原版と引用範囲を検証 | 明示ファイルはその版だけを読む。検索はページ単位。意味検索に失敗してもキーワード経路を維持 | **PARTIAL** — PCブラウザの検索、オフライン検索、原本範囲の自動テスト合格。現在のビルドでSearchモデル重みの準備・ロード・意味順位とオフライン再検索は未確認 |
| AI / テキスト推論 | `lfm3-text-worker.ts`、追跡ランタイム `dist/lfm-adapter.js`。既定は LFM3 QAD Q4_0。WebGPUとCPU/WASM | モデル常駐、条件付き入力再利用、CPUスレッド制御、バッチ／マイクロバッチ128。役割切替時はメモリ解放 | **PARTIAL** — 公開アプリの既存 Windows Chrome プロファイルで保存済みQ4を検証し、GPUロード後に実回答 `4`。このローカル候補の実モデル実行、CPU/WASM、8K/16K比較、長履歴品質は未確認 |
| ASSET / モデル準備 | `lfm3-assets-worker.ts`、`local-gguf-asset-store.ts`。明示取得・ローカル取込・ハッシュ検証・OPFS保存 | 範囲単位で再開し、排他書込み後に実サイズを検査。古い書込みによる切詰めを拒否。中断後の完了範囲を保つ | **OPEN / P0** — 完了範囲保持の focused tests 18/18、容量説明を修正。隔離新規プロファイルではQ4取得が約855.6MBまたは約989.9MBで `QuotaExceededError`。`navigator.storage.estimate()` の空き表示と不一致。実効quotaの発生レイヤー未特定、初回取得・検証・ロードを現候補で完了できていない |
| MEDIA / 添付・読取 | `automatic-reading.ts`、`input-readings.ts`。テキスト/PDF、OCR、音声、画像・動画の読取りと原本・派生結果の保持 | 選択範囲に基づく読取り。動画はサンプルフレーム。利用前に必要な読取ランタイムを準備 | **PARTIAL** — PCブラウザのファイル文脈・削除済み添付回復・オフライン検索が合格。実機での媒体読取りと状態復帰は未確認 |
| DATA / 保存・履歴・削除 | `knowledge-store.ts`、`memory-trash.ts`、`backup-state.ts`。IndexedDBが正本、Markdownは投影 | 改版時CAS、履歴・withdrawal・原本IDを保持。通常／復旧DBオープンは15秒で失敗を返し、遅れて成立した接続を閉じる | **PARTIAL** — DB境界試験19/19、未応答DB回復画面はChromium/WebKit各1/1。別プロファイルへのBackup `Restore new` UI往復を追加しSettings 38/38・全品質で合格（ノート1件の本文一致）。Muse報告の8/8無反応は再現しておらず、バックアップ形状/設定競合/原本を含む網羅確認と監査実データ25件の参照照合は未完。実利用者データを消して試験しない |
| SCHED / スケジュール・通知 | `scheduled-answer.ts`、`task-records.ts`、`ScheduleEditorSheet.tsx`。Run now、予定回、Retry、履歴、アプリ内通知 | 出典不要な質問と根拠が必要な質問を分ける。回答候補・再試行計測を保持。作成時にウェブ非対応とMemory根拠の注意を表示。閉じたPWAでの起動は保証しない | **OPEN / P0** — 合成分岐と作成時説明は自動試験合格。Audit 18のexact prompt/Activityは未保存で再現不能。v384でQ4をGPU 25/25層ロード後、`say hello briefly` は1回10秒で正常回答したが単一成功に留まる。CPU/WASM・実モデルのanswer/run/history/notification整合は未受入。Schedule/Memory UI 27/27、Run now二度押し防止とterminal後の同sheet再実行を含むPC操作試験は合格。ソース不要の実回答品質・失敗記録保持は未解決。定義削除警告はv384に反映済み |
| TOOL / Decision・ツール | `agent-coordinator.ts`、`decision-routing.ts`、`custom-tool-runtime.ts`。組込・承認付き操作・隔離QuickJS | 宣言済みローカル能力だけを公開。コード、時間、出力、呼出回数に上限。DecisionとTextは別ロール | **PARTIAL** — QuickJS 38/38、MCP browser Chromium/WebKit 8/8。実ブラウザでD1準備・WebGPUロードとTextへの役割切替を確認。ただしLFM3 `native-tool-calls` はDecision分類を迂回する設計で、設定説明を追加。互換JSON-plannerでのDecision実推論と曖昧依頼の正しい結果は未受入 |
| PWA / 起動・更新・接続 | `scripts/build-product.mjs` とService Worker。検証済みシェルを明示準備・修復・更新し、オンライン状態を別管理 | ハッシュ付きアセット、履歴キャッシュ、モデル保存とシェル更新を分離 | **PARTIAL** — 現ローカル候補の更新・起動回復・オフライン・インストール済みPWAの自動受入合格。debug Site v384は前の候補のまま。実モデルと実機の受入は未完 |
| DIAG / 診断・進捗 | `device-diagnostics.ts`、`LiveTextWork.tsx`、`inference-measurements.ts`。ロード、入力処理、生成、停止を記録 | 実測値を表示し、計測不能とゼロを区別。端末検査記録をローカル保存 | **PARTIAL** — Check device、更新中操作、実行状態のUI検査合格。handoff Chromium/WebKit 38/38。WebKitの旧root消失traceは原因未特定だが、今回の全品質runで再現なし。物理iPhone/Androidは未検証 |
| EXT / フィードバック・公開 | `FeedbackPanel.tsx`、`feedback-api/src/index.mjs`。利用者の明示送信。GitHub CIとSite配布を別工程化 | 入力サイズ制限、受信側検証、失敗時のHTTP/service error提示。候補アセットのビルドID・ハッシュを記録 | **PARTIAL** — Site v383隔離profileから合成QA feedbackを実送信しHTTP 201、UI成功表示、限定D1読取で行を確認。合成行1件は残存。mocked 503 UIではdraft保持。Muse報告の失敗は環境/記録不足で未再現。Site v384はdebug候補で一般リリースP0は未完 |

## 不具合・リリースゲート一覧

| 優先 | 問題 | 現在の判定 | 完了条件 |
|---|---|---|---|
| P0 | 既定Q4モデルの初回保存がquotaで止まる | **未解決** — 有効なエラー説明と完了範囲保持は実装済み。容量境界を越えて取得できる保証はない | 対象ユーザープロファイルで1,049,615,680 bytes取得、SHA-256検証、モデルロード、実回答まで確認。実効容量制限と空き推定差の再現条件を確定 |
| P0 | 長い履歴の一般質問が誤操作へ振り分けられる | **自動経路は改善、実モデル未完** — 直接回答への経路と長対話UI試験はある | 現行候補の実モデルで独立質問、文脈追質問、資料質問、明示操作を同じ長い履歴から各検証し、経路と結果が要求に合う |
| P0 | スケジュールの自由文・挨拶を誤検証／失敗扱いする | **未解決** — 合成テストはある。過去の実モデル監査は不安定 | GPUとCPU/WASMで挨拶、一般知識、記号付き計算、資料根拠を実行し、answer/run/history/notificationが一致。失敗時の候補と理由を残す |
| P1 | スケジュール作成時に根拠・ウェブ非対応の説明がない | **候補へ反映済み** — editorにMemory根拠とブラウジング不可の説明を追加、focused browser test合格。実モデルの失敗傾向は未解決 | 現行Siteでプロンプト別の適格性・説明を確認し、根拠不要/必要の動作を実モデル検証 |
| P1 | Restore backup がブラウザから開始できない | **通常の復元UIは追加確認済み** — v383隔離Chromiumの既存試験に加え、build 064で別の空プロファイルへQAノートを`Restore new`し、本文一致をSettings 38/38・全品質で確認 | Museの8/8無反応は依然として再現不能。設定競合・originals・他のバックアップ形式/サイズでrestore scopeを検証 |
| P1 | Send feedback がオンラインでも失敗する | **v383実送信・D1保存確認済み** — 隔離Chromiumから合成QA記録を明示送信、API HTTP 201、UI `Sent · saved for product development`。読み取り専用D1照会で該当行を確認。合成行1件は開発DBに残存 | Muse環境で失敗ケースを分類し直す。API障害時のdraft保持とHTTP/service code表示はfocused 503試験済み |
| P1 | 有効スケジュール定義ファイルの削除時に影響が無告知 | **公開v383で再現、修正・debug v384公開** — 隔離profileで有効な一回予定を作成し、削除確認に影響説明がないことを確認。操作はキャンセル。ローカル候補のSchedule/Memory/Toast 27/27とfull quality合格 | Site v384で公開済み。Museに対象ビルドを確認して再監査依頼 |
| P1 | 長時間生成失敗時に部分回答が残らない | **コード修正済み、実モデル未確認** — 失敗後は非空previewを`Partial · not verified`として保存。Memoryへコピーした場合もpartial provenanceを保ち、Stop時は未確定previewを確定扱いしない。workflow/copy regressions追加 | 実モデルの300秒timeoutで部分テキスト・状態が保持されること、再試行で履歴を保持することを確認 |
| P1 | Decision/Text切替とDecision実行結果が分かりにくい | **一部は設計どおり、受入未完** — 単一モデルのメモリ保護で他ロールを解放。実モデルによるDecision選択・ロード・活動表示は未確認 | 対象端末でTextを解放してDecision実行後、Textを再取得し、経路/進捗/結果を実モデルで確認。二重常駐を無条件に有効化しない |
| P1 | スケジュール完了後の Retry/Run now 状態が遅れて更新される | **PCブラウザUI試験合格、実モデル未確認** — same-sheetでRun now二度押しを抑止し、約600msのsettle後に再実行可能。2行の成功履歴を確認 | 実モデルの成功・失敗・停止・Retry後に一覧、活性、履歴、通知の状態が一致することを現行Siteで確認 |
| P1 | WebKitでアプリ起動待ちの散発タイムアウト | **間欠リスク** — 最新の全品質runでhandoff 38/38。以前の1 runでtrace上storage gate描画後にrootが空になったが、資産は全て200、console/pageerror/requestfailedなし。isolated 3回と今回の全runは合格。原因未確定 | 再発した場合は別traceで調査し、時間制限やassertionを緩めず安定性を再確認 |
| P1 | Trashの実データ参照サイクル | **部分確認** — 合成25件のグラフと関連削除は合格 | 監査データを匿名化した同型グラフで定義・Runs・通知・会話参照を確認し、関連項目だけを削除、無関係原本と履歴を保持 |
| P1 | 削除／改版後の添付チップ整合 | **UI回帰合格、旧データ修復未完** — 消失ファイルは説明・解除できる | 削除、復元、新版作成、別タブ編集後に添付ID/revisionを照合し、古い参照の説明と回復を実ブラウザで確認 |
| P1 | Search意味検索の実ランタイム | **未検証** — UIで準備は明示、選択時に暗黙取得しない | 承認取得、ハッシュ、ロード、意味順位、原文引用、オフライン再検索まで行い、キーワードfallbackを維持 |
| P1 | iPhone/Android installed PWA | **未検証** — iOS handoff UIはPCで試験済み。Phone Useは接続不可 | 実機の現候補でモデルLoad/Generation、Home Screen起動、オフライン冷間起動、再開後の保存を確認。PC WebKitは代替にしない |
| P2 | 通知送信・GitHub/Siteへの公開配線 | **未検証** — フィードバックUIのオフライン挙動と本番POST成功は別 | テスト用の明示的な送信でAPIの受信・応答を確認。公開はrelease gate合格後にbuildを照合して実行 |

## コード配置

- `design/prototype/src` は製品UIと主な実装、`design/prototype/product` は本番入口。`prototype` という名前だけで非製品扱いしない。
- `dist` は追跡ランタイムとローカル生成物が混在する。追跡状態とimport元を確認してから変更する。
- `tests`、`design/prototype/tests`、`specs`、`scripts/qa` はロジック、実ブラウザ、自動PWA、実モデル、物理端末を分けて記録する。
- 設計・仕様は既存の `docs` に集約し、この台帳は責務・最適化・状態の索引とする。詳細と日付付き証拠は [TEST-RESULTS.txt](TEST-RESULTS.txt) にリンクする。
