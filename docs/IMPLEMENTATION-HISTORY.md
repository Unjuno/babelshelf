# Mobile Local Brain 0.1.0 — 実機検証用PWA

**完成判定ではありません。** GPUが取得できない検証環境のため、Bonsai 2の実生成とiPhoneオフライン受入は未確認です。ユーザーの追加指示によりGate 0未合格のまま本体構築を進めています。固定回答・クラウド推論は実装していません。

| 対象 | 結果 |
|---|---|
| コンテナのコア・資産・出典・セキュリティ自動試験 | 30件PASS。ログ `docs/container-tests.txt` |
| JavaScript構文・DOM ID・モデルpin・配信資産hash | PASS |
| 内部ブラウザプレビュー | 未実施：previewのbwrapがprocをmountできず起動失敗 |
| 公開WebMLデモの4B→2Bロード | 環境FAIL：No WebGPU adapter was returned |
| このビルドの実IndexedDB/OPFS/SW診断 | 試験コード実装済み、実ブラウザ実行は未確認 |
| このビルドの実Bonsai生成・停止 | 未実施 |
| 多言語50問の実生成 | fixture/実行コードあり、未実施 |
| iPhoneホーム画面PWA・全機能オフライン冷起動 | 未実施 |
| 推論性能・日本語/他言語の生成品質 | 未測定・未検証 |

## 初回準備

1. トップレベルHTTPSで開く。iPhoneはSafariの共有→ホーム画面に追加し、そのPWA内で以下を行う。タブとPWAの保存共有を仮定しない。
2. 管理→保存・検索テスト。初回SWが未制御なら一度再読込し、再度診断する。
3. 管理→WebGPU診断。adapter不在ならモデル対応の合格とはできない。メモ・検索・バックアップはモデルなしで使える。
4. 更新・初回準備用の通信をONにし、4Bを選んで「資産を取得・検査」。PTQ1_0重み949,549,920Bと推論コード2,208,435Bを取得。4Bが実行できなければ2B（429,183,456B）を選んで同じ手順。mmprojは使わずテキスト専用。
5. SHA-256検査完了後、通信トグルをOFF。「ローカルからロード」を実行。生成・停止を試験する。準備だけでAI対応済み・完全オフライン準備完了とは表示しない。
6. 手元ファイル導入も可能。manifestのURLからモデルGGUFとruntime.jsを取得し、指定のファイル名（またはsha256名）で選択する。全内容hashが一致しないと拒否する。

## 使い方と多言語

メモを作成し、タイトル・本文・別名を入力すると自動保存。編集ごとに新しい版を保持する。`[[メモのタイトル]]`または`[[note:ID]]`で明示リンク。同名は自動統合しない。TXT/MDはUTF-8・1件10MBまで。Markdown/HTMLは文字列表示し、外部画像・scriptを実行しない。

質問画面のSearchはモデルなしで文字N-gram索引を検索する。意味検索・Embeddingではない。回答ではBonsaiが検索語を作り、許可したsearch_notes/read_note経路で少数の原文範囲を選び、モデルへ渡す。生成は実モデルのみ。JSON・出典ID・引用一致の検査失敗は失敗表示し、原出力を確認できる。機械的な引用一致は解釈の正しさを保証しない。

入力言語は限定しない。日本語、英語、中国語、韓国語、混合言語を検索テスト。回答は指定言語または質問言語で返すプロンプト。公称対応言語と本アプリの実測品質は区別する。50問は各言語10問の検索→読取→新規生成→派生保存→書出しを実モデルで実施する診断。単純なコード読取課題であり、一般的な言語能力や複雑なツール操作を網羅しない。言語の自然さは人手評価が必要。

「この回答を新しいメモに保存」で生成済み本文を再生成せずプレビューに渡す。日本語/英語/中国語/韓国語の一部の自然言語保存命令も認識する。自由な全表現を保証しない。承認後だけ新規派生メモを作る。既存メモの上書き・削除をモデルに許可しない。撤回・訂正で根拠が古くなった派生メモは新規検索から除外する。出典はID・版・UTF-16開始/終了・原文引用を保持。

長文は2048token予算の範囲内の抜粋を渡す。選択ノート全体が入らなければ部分要約と明示。全文の階層要約・高度な意味検索は未実装。

## オフライン・保存・更新

正本と全版はIndexedDB。再構築可能なN-gram倒立索引はメモリ内。起動後に原文からオフライン再構築する。モデルとruntimeはOPFS、immutable SHA-256名。runtimeのtokenizer/config/chat templateはGGUFメタデータから抽出する。追加tokenizerの外部取得経路は使わない。

初回SWは全アプリ資産を取得し各hashを検査。使用画面に関係なく全画面/Worker/診断fixtureを保存。通常の同一originキャッシュ欠落は503で停止し、外部取得で補完しない。アプリ起動でモデルを取得しない。推論Workerはglobal fetchを拒否し、ローカルGGUFのHEAD/RangeをOPFSから返す専用fetchだけをruntimeへ渡す。初回モデル準備だけ別に保持したnative fetchでmanifestの固定URLを取得。

更新通信は起動ごとにOFF。ONでも通常推論の通信は許可しない。SWの更新は「アプリ更新を確認」でのみ明示実行。ブラウザ自身のSW管理通信・Sitesホストのアクセス管理は別系統で、アプリが制御すると主張しない。新ビルドはhash別のcacheに保存し、旧cacheは自動削除しない。モデル取得は全hash一致後だけready metadataを確定。異なるhashの旧資産は保持する。manifest変更を伴うモデル更新・旧版へのロールバックUIは今回未実装。

バックアップはモデルを含まないJSON .brainpack（schema 1、SHA-256）。原文・全版・状態・別名・生成出典を保存。復元は全検査後に1トランザクション、未登録IDのみ追加。同一IDの差分は上書きせず競合表示。端末側の撤回を旧バックアップで復活させない。競合解決UIは未実装。暗号化されていないため手元で保管先を選ぶ。

## 再現試験

- `npm test`：Node組込runner、外部依存なし。実DB/GPU試験ではない。
- `npm run check`：構文、DOM ID、モデルpin、配信資産hash生成。
- 管理→保存・検索テスト：専用使い捨てDB/OPFSを使う実ブラウザ診断。利用者のメモを消さない。
- 管理→実モデル生成テスト：その場の新しいUUID由来コードを根拠メモに入れ、Bonsaiが読めるかを検査。模擬モデル・固定回答は使わない。
- 管理→多言語の実生成50問：各言語10問。全50問を分母に記録し、失敗を除外しない。これは生成停止・人手品質評価とは別。
- 管理→冷起動診断を予約：正本の版/状態を保存。通信遮断・PWA終了・再起動後に照合し、モデルを再ロードして新しい実生成試験をする。予約だけでPASSにしない。ブラウザ再読込とOSによるPWA終了は自動判別できない。
- 機内モード+Wi-Fi OFF後に新しいメモ/TXT/MDを作成し、検索・回答・要約・派生保存・出典遷移・書出し・別の空データ領域への復元を試す。PWA終了再起動3回、端末再起動1回。AC-26/31〜36の詳細は添付仕様を参照。試験用以外の保存領域を消去しない。
- 結果は端末の管理画面からJSONへ書き出す。UA、standalone/online状態、入力tokens、所要時間を残す。onlineフラグだけで通信監査の代わりにしない。通信監査・GPU停止/device lost・更新失敗注入・容量不足試験は別途未実施。

## 配信とソース

buildless HTML/CSS/ESM。`dist/`を静的HTTPS配信すればよい。`.openai/hosting.json`はSites用。GitHub Pagesへ移す場合も相対パスを維持し、SW scopeとMIMEを実サーバーで検証する。内部プレビューの起動障害はソースの合格証拠に置き換えていない。

app.js（UI・限定操作）→core.js（版・索引・証拠・backup）→storage.js（IndexedDB）。engine.js→model-worker.js（実Bonsai runtime/OPFS）。runtimeは初回直接取得し、このソースには再配布しない。詳しくはLICENSES.txt。

GBrainは設計思想のみ参照。参照指定commit `3ed487d2b72f1c1950f7f722cd5241e4ec537e83`。今回GBrainコードはコピーしていない。BrainEngine責任分離、原文と派生物、版/撤回、明示リンク、証拠範囲を縮小採用。GBrain互換API・Embedding・MCP・常駐処理は作らない。

## 重要な未完了事項

Bonsaiの実生成・停止・iPhoneのWebGPU/メモリ/熱/全機能オフライン冷起動、Safari Worker対応、実ブラウザDB/SW試験、通常利用無通信監査、更新故障注入、容量不足、サイトのトップレベル認証とPWAの共存が未検証。Sites新規サイトは既定の所有者限定アクセスで配信。アプリ自身のアカウントはないが、ホスト側の認証が不要とは宣言しない。必要なら同梱distを認証不要の静的ホストへ移せる。

H: 指定端末・build・Bonsai revisionで、準備後に全通常機能が再接続なしに動く。
T: Node30件、実ブラウザ診断、実生成50問、上記冷起動手順。GPU/破損/漏えいで停止し記録。
D: 各環境で実行した項目だけPASS。未試験UNCERTAIN。必須項目に1件でも未試験があれば完成宣言しない。
C: adapter不在、非対応演算、OOM、GPU lost、資産欠落、引用不一致、再接続依存。
U: OS・Safari・GPU・熱・ストレージ消去・質問選択。数値的な合成不確かさや包含係数は未評価。

## 読み取り優先UIへの修正（2026-10-16）

対象は、自分の保存した情報をスマートフォンで素早く取り出す利用者。通信断や焦りを伴う状況でも、まず検索と原文閲覧を行える設計を目標とする。緊急用途の安全性を実証した製品ではない。
本文18px、回答20px、補足16pxを基準に変更。主要操作は48px以上、本文と主要テキストの指定色をコントラスト回帰試験。スマホは横スクロール一覧を廃止し、縦一覧→閲覧→明示編集へ変更。撤回は「メモの操作」、診断は任意の折り畳みへ移動。表示言語を簡潔にしたが、多言語入力・生成方針は変更していない。
これらはソース上の回帰確認であり、Safariでの実レイアウト、文字拡大、片手操作、焦った状態での誤操作率を検証したものではない。内部プレビューの既知の環境障害は未解決。アクセシビリティ適合・緊急用途適合の宣言はしない。

## English conversation UI（2026-10-17）

Default screen: Chat. Product labels/errors are English; note/message content is unrestricted. Instructional paragraphs, taglines and onboarding explanations were removed from the UI. Operational labels and essential states remain. Notes keep the large-text reading/editing flow. Enter sends, Shift+Enter inserts a newline, and IME composition is not submitted. Confirmed answers are stored as a local conversation history (last 100 successful turns), with collapsed source references and an explicit Save note preview. Conversation history is derived state and is not currently included in .brainpack. No fixed or simulated model answer was added.
Prepared models are loaded locally on first chat submission; no network fallback is permitted. Missing models show Set up. The last selected model is remembered. Failure to load still prevents generation. Broader browser and iPhone verification remain incomplete; static/Node checks do not establish usable model inference or rendered visual quality.

## Minimal controls（2026-10-17）

The application label is Local. The primary mobile navigation has two destinations: Chat and Notes. Settings is a header action. Chat's composer shows a single Send action, or Stop while generating. The mode and attachment controls are not exposed. Summarize/History/Withdraw are inside More. Backup/diagnostics/model maintenance remain available behind disclosure. Model loading is still local and no readiness is fabricated. Buttons are at least 56 CSS pixels high; Send is 60. These are source checks, not measured real-device usability. Legacy offline clients may need the explicit Check for updates action and a full close/reopen to receive this build. Existing user-authored multilingual content is preserved.
