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
- `publish_consent`: 同意フラグ（true/false）
- `publish_until`: 公開期限（YYYY-MM-DD, 空欄可）

CSVの program 列は存在しない。取込時の画面/APIパスで program を固定する。

## 画面一覧
- `/` トップ（検索フォーム）
- `/athletes/[id]` 個人ページ（記録推移・種目別順位）
- `/admin` 管理者ログイン
- `/admin/import/swimming` スイミング取込
- `/admin/import/school` 学校委託取込
- `/admin/consents` 同意管理
- `/admin/docs/swimming` スイミングPDF生成
- `/admin/docs/school` 学校委託PDF生成
- `/admin/logs` 検索ログ閲覧

## API一覧
- `POST /api/search` 検索（レート制限・検索ログ保存）
- `GET /api/athletes/:id` 個人表示
- `POST /api/admin/login`
- `POST /api/admin/import/swimming`
- `POST /api/admin/import/school`
- `POST /api/admin/docs/swimming/records`
- `POST /api/admin/docs/swimming/certificates`
- `POST /api/admin/docs/school/records`
- `GET /api/admin/logs`

## DBスキーマ要約
- athletes: 氏名・学年・性別・公開同意・公開期限
- meets: (program, held_on, title) ユニーク
- events: 種目情報（学年/性別別）
- results: タイムと順位（DENSE_RANK）
- generated_docs: 生成物の保存キー
- search_logs: 検索ログ

## 同意/公開/ログ/レート制限仕様
- `publish_consent=true` のみ検索結果・個人ページに表示。
- `publish_until` が過去日付なら404で閲覧不可。
- 検索はフルネーム完全一致のみ。
- 検索APIはIP単位でレート制限をかける（1分あたり10回想定）。
- 検索実行時に `search_logs` に保存。

## PDF生成/ZIP
- 記録証・賞状はHTMLテンプレからPDF生成しZIPにまとめる。
- 生成ファイルはStorage抽象化で保存し、後でReplit App Storageへ差し替え可能。
