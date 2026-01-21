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
```

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

Playwright を使ってPDFを生成します。初回はブラウザバイナリのインストールが必要です。

```bash
npx playwright install chromium
```
