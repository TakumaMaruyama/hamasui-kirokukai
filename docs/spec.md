# 仕様

## CSV列定義（program列なし）
- `meet_title`: 記録会名称
- `held_on`: 開催日（YYYY-MM-DD）
- `full_name`: 氏名（検索対象。フルネーム完全一致）
- `grade`: 学年（数値）
- `gender`: `male` / `female` / `other`
- `event_title`: 種目名（例: 50m自由形）
- `style`: 泳法（例: free, fly）
- `distance_m`: 距離（数値）
- `lane`: レーン番号（任意）
- `time_text`: 記録（例: 0:45.23, 45.23）

CSVの program 列は存在しない。取込時の画面/APIパスで program を固定する。

### 名簿CSV（簡易形式）の取り込み
- 画面で `年 / 月 / 曜日` を指定してからプレビューする。
- 名簿CSVのように `meet_title` / `held_on` が無い場合は、指定した `年 / 月 / 曜日` から内部値を補完する。
- 補完時:
  - `meet_title`: `YYYY年M月X曜`
  - `held_on`: `YYYY-MM-01`

## 画面一覧
- `/` トップ（検索フォーム）
- `/athletes/[id]` 個人ページ（記録推移・種目別順位）
- `/athletes/history` 子ども統合ページ（氏名+性別単位、学校年度ごとの履歴）
- `/admin` 管理者ログイン
- `/admin/import/swimming` スイミング取込
- `/admin/import/school` 学校委託取込
- `/admin/import/challenge` チャレンジコース取込
- `/admin/publish` 公開期間・お知らせ表示管理
- `/admin/docs/swimming` スイミングPDF生成
- `/admin/docs/school` 学校委託PDF生成
- `/admin/docs/challenge` チャレンジコースランキングPDF生成
- `/admin/logs` 検索ログ閲覧

## API一覧
- `POST /api/search` 検索（レート制限・検索ログ保存）
- `GET /api/athletes/:id` 個人表示
- `POST /api/admin/login`
- `POST /api/admin/import/swimming/preview`
- `POST /api/admin/import/swimming/confirm`
- `POST /api/admin/import/school/preview`
- `POST /api/admin/import/school/confirm`
- `POST /api/admin/import/challenge/preview`
- `POST /api/admin/import/challenge/confirm`
- `POST /api/admin/docs/swimming/records`
- `POST /api/admin/docs/swimming/certificates`
- `POST /api/admin/docs/swimming/rankings`
- `POST /api/admin/docs/school/records`
- `POST /api/admin/docs/challenge/rankings`
- `GET /api/admin/logs`

### 検索APIの同意仕様
- `POST /api/search` は毎回同意必須。
- リクエストは `{ fullName, consentAccepted, consentVersion }`。
- `consentAccepted` が `true` でない場合は検索できない。
- `consentVersion` がサーバー定義と不一致の場合は再同意を求める。
- 検索結果は学年単位ではなく、`fullName + gender` で集約した子ども単位で返す。
- 検索結果要素は `{ fullName, gender, grades }`（`grades` は昇順の学年一覧）。

### PDF出力APIの条件指定
- `POST /api/admin/docs/*` はJSONで条件指定できる（任意）。
- `year` + `month` + `weekday` で「指定年月の曜日ごと」に出力可能。
- `year` + `month` + `fullName` で「特定の子どもの指定年月」を出力可能（`weekday` 併用可）。
- ランキングPDF（`/api/admin/docs/swimming/rankings`）は、記録会ごとに1ファイル生成する（種目ごとの別ファイルは作らない）。
- チャレンジランキングPDF（`/api/admin/docs/challenge/rankings`）は年月指定必須で、同月・同種目・同学年・同性別の全順位を生成する。
- チャレンジCSV取り込みは学年 `1..15`（年少〜高校3年生）のみを有効とし、範囲外はスキップして件数を通知する。

## DBスキーマ要約
- athletes: 氏名・学年・性別
- meets: (program, held_on, title) ユニーク（program: `swimming` / `school` / `challenge`）
- events: 種目情報（学年/性別別）
- results: タイムと順位（DENSE_RANK）
- generated_docs: 生成物の保存キー
- search_logs: 検索ログ（検索名、IP、User-Agent、同意バージョン）
- publish_windows: ユーザー画面に表示する公開期間（開始日/終了日）とお知らせ

## ログ/レート制限仕様
- 検索はフルネーム完全一致のみ。
- 検索APIはIP単位でレート制限をかける（1分あたり10回想定）。
- 検索時に毎回同意チェックを必須にする。
- 検索実行時に `search_logs` に保存。
- `search_logs` には `consentVersion` も保存する。
- 公開期限はユーザー画面の案内表示専用（自動非公開は行わない）。

## 子ども統合ページの表示仕様
- `/athletes/history` はクエリ `fullName` と `gender` を受け取り、同一キー（氏名+性別）で複数学年の履歴を統合表示する。
- 年度表示は学校年度（4月〜翌3月、UTC基準）を使用する。
- 同姓同名・同性別の別人をDB上で完全判別できないため、統合表示される可能性がある旨を画面で案内する。

## PDF生成/ZIP
- 記録証・賞状はHTMLテンプレからPDF生成しZIPにまとめる。
- 生成ファイルはStorage抽象化で保存し、後でReplit App Storageへ差し替え可能。
