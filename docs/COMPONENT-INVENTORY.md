# BabelShelf コンポーネント台帳

2026-11-23 JST の現在候補は branch `codex/nov21-contextual-chat-followup`、製品コミット `4fbc881ba2344b51b846bbce83815e490647088f`、ビルド `400813a209347f37`（170検証済み資産）、最新台帳コミット `72ae5ff3af77b2a931be147074c7eae51b528e3d`。PR #113 はopen、exact-head CI run `45155177211` はbrowser system dependency installationで進行中。Debug Site v389に同じ製品ビルドを公開し、既存PWAタブでもUpdate後のActive worker一致を確認。一般リリース判定はDO-NOT-SHIP。Site配信物の証拠と未解決ゲートは [REMAINING-GATES.md](REMAINING-GATES.md)、ビルド別の証拠は [TEST-RESULTS.txt](TEST-RESULTS.txt) が正本。

状態の意味：**PASS** は記載した検証範囲のみ合格、**PARTIAL** は一部の証拠はあるが受入条件が未完、**OPEN** は実環境または機能の受入が未確認。自動テストを実モデル・公開環境・物理端末の証拠へ読み替えない。

## 機能・実装・最適化

| ID / コンポーネント | 現在の機能と実装 | 現在の最適化・境界 | 現在の状態・残作業 |
|---|---|---|---|
| UI / 操作画面 | React。Chat、Memory、Schedule、Notifications、Settings。`main.tsx`、`Prototype.tsx` | 補助画面を遅延読込、長い会話表示を段階化。失敗再試行を表示上まとめつつ原履歴を保持 | **PARTIAL** — 最新候補の全品質ワークフロー合格、Settings 38/38。以前のバッチでroot消失が1回あり原因未確定。実モデル・公開Site・実機の受入は別ゲート |
| CHAT / 送信・振り分け | `submission-workflow.ts` → `turn-router.ts` → 直接回答、Decisionまたはツール計画。確定回答と活動を保存 | 履歴と要求の関係を分類し、独立質問・明示的な再掲では不要な履歴や推論を省く。生成失敗時の非空previewを`Partial · not verified`として保存。Memoryコピーにも未検証/partial provenanceを維持し、Stop時は未確定previewを確定回答にしない | **PARTIAL** — 追質問の指示対象文脈とpartial provenanceの回帰を追加し全品質合格。300秒実モデル停止、20ターン後の追質問・保存資料質問は未確認。v384実ブラウザでLFM3 native plannerが8回選択/ツールループへ入り、Decision分類は走らなかった。長ループ解消は未完 |
| SOURCE / 検索・出典 | `grounded-answer.ts`、`file-discovery.ts`、`semantic-search-runtime.ts`、`memory-search-order.ts`。選択資料・添付・Memoryを区別し、原版と引用範囲を検証 | 明示ファイルはその版だけを読む。意味検索に成功した時は一致済みkeyword候補も意味順位に並べ替え、候補自体は落とさない。未準備・失敗時は従来順を維持 | **OPEN / P0** — 実Graniteの単一日本語言い換えでは期待ノートを1位に取得し、UI順序回帰2/2・worker統合1/1合格。ただしAudit20でSearch ON/OFFが4クエリ同一、日本語「フランスの首都」0件。Test Searchの合格とMemory UI検索の意味検索を同一視できない。BLUEBERRY/QUOKKA両候補で回答検証が内部ラベルを拒否。固定コーパスのUI経路・候補決定性は未修正 |
| AI / テキスト推論 | `lfm3-text-worker.ts`、追跡ランタイム `dist/lfm-adapter.js`。既定は LFM3 QAD Q4_0。WebGPUとCPU/WASM | モデル常駐、条件付き入力再利用、CPUスレッド制御、バッチ／マイクロバッチ128。役割切替時はメモリ解放 | **PARTIAL** — 公開アプリの既存 Windows Chrome プロファイルで保存済みQ4を検証し、GPUロード後に実回答 `4`。このローカル候補の実モデル実行、CPU/WASM、8K/16K比較、長履歴品質は未確認 |
| ASSET / モデル準備 | `lfm3-assets-worker.ts`、`local-gguf-asset-store.ts`。明示取得・ローカル取込・ハッシュ検証・OPFS保存 | 範囲単位で再開し、排他書込み後に実サイズを検査。古い書込みによる切詰めを拒否。中断後の完了範囲を保つ | **OPEN / P0** — 完了範囲保持の focused tests 18/18、容量説明を修正。隔離新規プロファイルではQ4取得が約855.6MBまたは約989.9MBで `QuotaExceededError`。`navigator.storage.estimate()` の空き表示と不一致。実効quotaの発生レイヤー未特定、初回取得・検証・ロードを現候補で完了できていない |
| MEDIA / 添付・読取 | `automatic-reading.ts`、`input-readings.ts`。テキスト/PDF、OCR、音声、画像・動画の読取りと原本・派生結果の保持 | 選択範囲に基づく読取り。動画はサンプルフレーム。利用前に必要な読取ランタイムを準備 | **PARTIAL** — PCブラウザのファイル文脈・削除済み添付回復・オフライン検索が合格。実機での媒体読取りと状態復帰は未確認 |
| DATA / 保存・履歴・削除 | `knowledge-store.ts`、`memory-trash.ts`、`backup-state.ts`。IndexedDBが正本、Markdownは投影 | 改版時CAS、履歴・withdrawal・原本IDを保持。通常／復旧DBオープンは15秒で失敗を返し、遅れて成立した接続を閉じる。Restore pickerは選択前後の状態を表示 | **OPEN / P0** — 隔離profileの回帰テストがRestore backupボタン→browser filechooser event→backup選択→review→restore→本文再表示を1/1確認。MuseのAudit20では16/16無反応、代替importなし。schedule定義Trash→Restoreと引用ノートの削除・復元は正常。Muse同型の失敗原因は未解決 |
| SCHED / スケジュール・通知 | `scheduled-answer.ts`、`task-records.ts`、`ScheduleEditorSheet.tsx`。Run now、予定回、Retry、履歴、アプリ内通知 | 出典不要な質問と根拠が必要な質問を分ける。回答候補・再試行計測を保持。作成時にウェブ非対応とMemory根拠の注意を表示。閉じたPWAでの起動は保証しない | **OPEN / P0** — Audit 19で挨拶と3+3が失敗、France-capitalはノートなし0/2・対応ノートあり成功（前監査の2/2改善という要約は誤り）。正確な失敗プロンプト/run recordは未保存。v384の挨拶1回成功は単一例。CPU/WASM・answer/run/history/notification整合は未受入。定義削除警告は公開済みだが、後続操作の結果通知は無反応との報告あり |
| TOOL / Decision・ツール | `agent-coordinator.ts`、`decision-routing.ts`、`decision-worker.ts`、`decision-backend.ts`、`custom-tool-runtime.ts`。組込・承認付き操作・隔離QuickJS | 宣言済みローカル能力だけを公開。コード、時間、出力、呼出回数に上限。既定D1 Q8はピン留めONNX RuntimeのWebGPU MatMulNBitsが未対応と実測し、WebGPU session作成を飛ばしてWASMを選ぶ | **PARTIAL / P0** — 監査20は旧build `95335123c7a30b70`。現候補は実D1全資産を読み、Q8ではWebGPUを避けてJSEP WASMでsession作成・分類成功。D1 graphが必要とする`GatherBlockQuantized`を含む経路のモデル実行は確認できた。これはWebGPU合格ではない。監査のcustom-tool chat 2/2は旧buildで、現候補の統合dispatch未確認のためP0は未解決 |
| PWA / 起動・更新・接続 | `scripts/build-product.mjs` とService Worker。検証済みシェルを明示準備・修復・更新し、オンライン状態を別管理 | ハッシュ付きアセット、履歴キャッシュ、モデル保存とシェル更新を分離 | **PARTIAL / P0** — public profileでv388→v389のアプリ内Updateを実施し、Active worker `400813a209347f37` とQ4 `Files present` / `Verified` を確認。Q4資産はこの1回の通常更新で保持された。Repair経路、Decision/Search等の他ロール、厳密な転送量は未測定。Museの3監査連続再DL報告は未解決 |
| DIAG / 診断・進捗 | `device-diagnostics.ts`、`LiveTextWork.tsx`、`inference-measurements.ts`。ロード、入力処理、生成、停止を記録 | 実測値を表示し、計測不能とゼロを区別。端末検査記録をローカル保存 | **PARTIAL** — Check device、更新中操作、実行状態のUI検査合格。handoff Chromium/WebKit 38/38。WebKitの旧root消失traceは原因未特定だが、今回の全品質runで再現なし。物理iPhone/Androidは未検証 |
| EXT / フィードバック・公開 | `FeedbackPanel.tsx`、`feedback-api/src/index.mjs`。利用者の明示送信。GitHub CIとSite配布を別工程化 | 入力サイズ制限、受信側検証、失敗時のHTTP/service error提示。候補アセットのビルドID・ハッシュを記録 | **PARTIAL** — Site v383隔離profileの合成QA POSTはHTTP 201でD1保存確認。Audit 19ではFeedbackがHTTP 405で0/2だが、該当request method/URL/response traceは未保存。Safe endpoint probesでGET=405、OPTIONS=204、invalid POST=400。POST 405の原因は未特定。mocked 503 UIではdraft保持 |

## 不具合・リリースゲート一覧

| 優先 | 問題 | 現在の判定 | 完了条件 |
|---|---|---|---|
| P0 | DecisionとカスタムツールのONNX統合経路 | **PARTIAL** — 現候補で実D1をJSEP WASM sessionにロードし分類成功。旧監査buildのGatherBlockQuantized失敗はこのmodel graphで再確認されず、現workerはQ8をWebGPUへ渡さない。監査のcustom-tool chat 2/2 failureは旧buildの結果で、現候補のchat/tool dispatch未確認 | 現候補でDecisionを実際に選択するJSON-planner model/profileからcustom-tool dispatchを実行し、session provider、tool call、最終回答と保存記録を確認。WebGPU passとは報告しない |
| P0 | 更新後に既定モデルがNot preparedとなり再取得が繰り返される | **原因未確定** — Service Worker更新/repair pathにモデルOPFSを削除する処理なし。Museでは3回連続して未準備と約1GB再DLを観測、更新前の実ファイル存在を記録できず削除は未立証 | 更新前後の隔離PCブラウザでモデルOPFSのサイズ/ハッシュを比較し、UI stateとasset bytesを分離。実転送0・実ファイル保持を確認 |
| P0 | Backup restoreが対象ブラウザで無反応 | **Muse再現未解決** — 現候補の通常Restore newはブラウザで複数回成功、`Restore new`後に本文一致。16/16監査失敗は対象profileの競合/asset形状/chooser traceがなく未説明 | Muse同型backupでchooser→parse→review→commitを計測。conflicts/originals/settings/runs付き全ケースとエラー表示を検証 |
| P0 | Memory画面のSearch model設定が検索結果に反映されない | **経路修正済み・実モデル未検証** — Memory検索が埋め込みruntimeを呼んでいなかった。明示ロード・索引済み候補を追加し語句一致は維持 | 現候補でSearch modelをload/indexし、日本語意味検索ON/OFFを対応比較。複数候補、revision変更、folder scope、オフラインを確認 |
| P0 | 検索候補が揺れて内部source label/矛盾回答へ進む | **未解決** — Audit20で過去QA noteが追加取得されると曖昧拒否。現候補のindexはrevision pinで古い引用を破棄するが、live rankingの実測がない | 実Searchモデルで固定corpus/queryを複数回再生しcandidate IDs/ranksを比較。矛盾候補の扱いとsource-label拒否の候補/理由の履歴保存を確認 |
| P0 | 既定Q4モデルの初回保存がquotaで止まる | **未解決** — 有効なエラー説明と完了範囲保持は実装済み。容量境界を越えて取得できる保証はない | 対象ユーザープロファイルで1,049,615,680 bytes取得、SHA-256検証、モデルロード、実回答まで確認。実効容量制限と空き推定差の再現条件を確定 |
| P0 | 長い履歴の一般質問が誤操作へ振り分けられる | **自動経路は改善、実モデル未完** — 直接回答への経路と長対話UI試験はある | 現行候補の実モデルで独立質問、文脈追質問、資料質問、明示操作を同じ長い履歴から各検証し、経路と結果が要求に合う |
| P0 | スケジュールの自由文・挨拶を誤検証／失敗扱いする | **未解決** — 合成テストはある。過去の実モデル監査は不安定 | GPUとCPU/WASMで挨拶、一般知識、記号付き計算、資料根拠を実行し、answer/run/history/notificationが一致。失敗時の候補と理由を残す |
| P1 | Schedule定義とRunファイルへMemory Homeから到達できない | **修正・debug v386公開** — HomeにもScheduleを表示し、従来のMemory rootにも残した。ナビゲーションfocused tests 3/3、全品質workflow合格。isolated local browserでMemory Home → Scheduleを確認 | 既存公開profileのworker adoptionは未確認。既存ユーザーデータを消さずにPWA Update適用後、公開Memory Home→ScheduleからRunファイルを開くのを確認する |
| P1 | スケジュール作成時に根拠・ウェブ非対応の説明がない | **候補へ反映済み** — editorにMemory根拠とブラウジング不可の説明を追加、focused browser test合格。実モデルの失敗傾向は未解決 | 現行Siteでプロンプト別の適格性・説明を確認し、根拠不要/必要の動作を実モデル検証 |
| P1 | Restore backup がブラウザから開始できない | **通常の復元UIは追加確認済み、Muse再現は未解決** — 隔離ChromiumでQAノートを`Restore new`し本文一致。Audit 19では4/4無反応、累計12/12 | 対象ブラウザでbutton clickからchooser、parse、review、commitまでを記録し、失敗段階を特定。設定競合・originals・他形式/サイズも検証 |
| P1 | Send feedback がオンラインでも失敗する | **成功経路と失敗報告が併存** — synthetic POST HTTP 201/D1保存を確認。一方Audit 19はHTTP 405を0/2報告。GET 405の安全プローブはできたがブラウザPOSTは未再現 | Network evidenceで実POST URL/method/statusを取り、UI/API/edge routeのどこが405を返すか特定。実ユーザーの内容は送信しない |
| P1 | 有効スケジュール定義ファイルの削除時に影響が無告知 | **公開v383で再現、修正済み** — 隔離profileで有効な一回予定を作成し、削除確認に影響説明がないことを確認。操作はキャンセル。ローカル候補のSchedule/Memory/Toast 27/27とfull quality合格 | 修正はdebug v384以降に含まれ、v386でも公開。一般リリースはP0未解決のため保留 |
| P1 | 長時間生成失敗時に部分回答が残らない | **コード修正済み、実モデル未確認** — 失敗後は非空previewを`Partial · not verified`として保存。Memoryへコピーした場合もpartial provenanceを保ち、Stop時は未確定previewを確定扱いしない。workflow/copy regressions追加 | 実モデルの300秒timeoutで部分テキスト・状態が保持されること、再試行で履歴を保持することを確認 |
| P1 | Decision/Text切替とDecision実行結果が分かりにくい | **一部は設計どおり、受入未完** — 単一モデルのメモリ保護で他ロールを解放。実モデルによるDecision選択・ロード・活動表示は未確認 | 対象端末でTextを解放してDecision実行後、Textを再取得し、経路/進捗/結果を実モデルで確認。二重常駐を無条件に有効化しない |
| P1 | スケジュール完了後の Retry/Run now 状態が遅れて更新される | **PCブラウザUI試験合格、実モデル未確認** — same-sheetでRun now二度押しを抑止し、約600msのsettle後に再実行可能。2行の成功履歴を確認 | 実モデルの成功・失敗・停止・Retry後に一覧、活性、履歴、通知の状態が一致することを現行Siteで確認 |
| P1 | WebKitでアプリ起動待ちの散発タイムアウト | **間欠リスク** — 最新の全品質runでhandoff 38/38。以前の1 runでtrace上storage gate描画後にrootが空になったが、資産は全て200、console/pageerror/requestfailedなし。isolated 3回と今回の全runは合格。原因未確定 | 再発した場合は別traceで調査し、時間制限やassertionを緩めず安定性を再確認 |
| P1 | Trashの実データ参照サイクル | **部分確認** — 合成25件のグラフと関連削除は合格 | 監査データを匿名化した同型グラフで定義・Runs・通知・会話参照を確認し、関連項目だけを削除、無関係原本と履歴を保持 |
| P1 | 削除／改版後の添付チップ整合 | **UI回帰合格、旧データ修復未完** — 消失ファイルは説明・解除できる | 削除、復元、新版作成、別タブ編集後に添付ID/revisionを照合し、古い参照の説明と回復を実ブラウザで確認 |
| P1 | Search意味検索の実ランタイム | **WASMで部分検証** — 実Graniteモデルを隔離Chromiumで検証・ロードし、日本語言い換え1件を意味順位で正しく取得。UIの複数クエリ・ON/OFF比較、オフライン再検索は未確認 | 固定corpusで複数クエリのcandidate ID/rankとキーワードfallback、改版、scope、オフラインを対応比較 |
| P1 | iPhone/Android installed PWA | **未検証** — iOS handoff UIはPCで試験済み。Phone Useは接続不可 | 実機の現候補でモデルLoad/Generation、Home Screen起動、オフライン冷間起動、再開後の保存を確認。PC WebKitは代替にしない |
| P2 | 通知送信・GitHub/Siteへの公開配線 | **未検証** — フィードバックUIのオフライン挙動と本番POST成功は別 | テスト用の明示的な送信でAPIの受信・応答を確認。公開はrelease gate合格後にbuildを照合して実行 |

## コード配置

- `design/prototype/src` は製品UIと主な実装、`design/prototype/product` は本番入口。`prototype` という名前だけで非製品扱いしない。
- `dist` は追跡ランタイムとローカル生成物が混在する。追跡状態とimport元を確認してから変更する。
- `tests`、`design/prototype/tests`、`specs`、`scripts/qa` はロジック、実ブラウザ、自動PWA、実モデル、物理端末を分けて記録する。
- 設計・仕様は既存の `docs` に集約し、この台帳は責務・最適化・状態の索引とする。詳細と日付付き証拠は [TEST-RESULTS.txt](TEST-RESULTS.txt) にリンクする。
