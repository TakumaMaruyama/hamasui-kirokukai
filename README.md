# hamasui-kirokukai

浜水記録会の記録検索・管理者用PDF生成アプリです。Replit デプロイを想定しつつローカル開発が可能です。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数

`.env` を作成します。

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hamasui
ADMIN_PASSWORD=changeme
ADMIN_SESSION_SECRET=<32バイトの暗号学的乱数を64桁hexで設定>
```

`ADMIN_SESSION_SECRET` は `openssl rand -hex 32` などで生成し、ローカル環境と本番の Secrets にそれぞれ設定してください。値をリポジトリに保存しないでください。未設定・形式不正の場合は管理者ログインが503となり、管理画面・APIは利用できません。

管理者セッションは署名付きCookieで、ログインから8時間で失効します。導入時の旧Cookieと、秘密鍵変更前のCookieは無効になります。`ADMIN_PASSWORD` を変更するときは `ADMIN_SESSION_SECRET` も同時に更新し、再デプロイして既存セッションを失効させてください。個別セッションのサーバー側失効はありません。本番適用は Secrets を設定してから新コードをデプロイし、再ログインして管理画面とPDF生成を確認してください。

### 3. PostgreSQL起動

```bash
docker-compose up -d
```

### 4. Prisma

```bash
npx prisma migrate dev --name init
```

### 5. 開発サーバー

```bash
npm run dev
```

## CSVサンプル

`samples/` 配下にスイミング・学校委託それぞれのサンプルCSVがあります。

## PDF生成について

一般コースでは対象年月を一度選択し、記録証・1位賞状・歴代1位記録一覧の「対象を確認」で人数・枚数（歴代記録は掲載件数・種目数）と一覧を確認してから、PDFをダウンロードします。記録証は現在の掲載順で1枚4件までです。

チャレンジコースのランキングも、対象年月を選択し「対象を確認」で掲載件数・種目数と全員の一覧を確認してから、PDFをダウンロードします。順位の上限はなく、同タイを含む全員を掲載します。同一月・種目・学年・男女ごとに同じ人の最速記録を採用し、人数が多い場合は継続ページに掲載します。

一般コースの上記3種類とチャレンジランキングはダウンロードのみで、新しい保存ファイル・生成履歴は残しません。既存の保存データは保持します。一般コースの月次ランキング・小学校の出力と保存の仕様は従来どおりです。

`@react-pdf/renderer` を使ってサーバー側でPDFを直接生成します。  
Playwright / Chromium の追加インストールは不要です。

## Replitでの公開

公開時のビルドは `npm run build`、起動は `npm run start` を使用します。DBスキーマ更新や開発DBの本番コピーは含めません。

現在のReplitワークスペースには紹介動画のArtifact登録があり、その本番配信設定がルートの `.replit` より優先されます。`artifacts/hamasui-intro-video/.replit-artifact/artifact.toml` の本番サービスを記録会アプリのビルド・起動に設定しています。動画の開発設定・ソース・編集内容は保持しています。[適用した設定差分](docs/deployment/hamasui-artifact-production.patch)を参照してください。

公開成功表示だけで完了とせず、公開URLの `/admin` がログイン画面になり、未認証の `/api/admin/docs/swimming/months` がJSONの401を返すことを確認してください。その後、再ログインして対象年月・対象一覧・3種類のPDFを確認します。[検証記録](docs/record-creation-verification.md)に結果を残しています。

## PDFテンプレート

記録証はコードレイアウトで直接生成します。背景画像テンプレートは使いません。

1位賞状の台紙デザインを使う場合は、以下の画像を配置してください。

- `public/pdf-templates/first-prize-certificate.(jpg|jpeg|png|webp)`（1位賞状）

台紙は A5 縦（推奨: 1748x2480px, 300dpi）で作成してください。写真やグラデーションが多い台紙は `jpg` / `jpeg` 推奨です。

賞状の台紙画像が未配置の場合はシンプルなフォールバックレイアウトで生成されます。
