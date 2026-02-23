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

`@react-pdf/renderer` を使ってサーバー側でPDFを直接生成します。  
Playwright / Chromium の追加インストールは不要です。

台紙デザインを使う場合は、以下の画像を配置してください。

- `public/pdf-templates/record-certificate.png`（記録証）
- `public/pdf-templates/first-prize-certificate.png`（1位賞状）

子ども向け3案の比較用テンプレートは `public/pdf-templates/variants/` 配下にあります。
次のコマンドで有効化する案を切り替えできます。

```bash
npm run templates:use adventure
npm run templates:use medal-fes
npm run templates:use swim-hero
```

テンプレートを再生成する場合:

```bash
npm run templates:generate
```

`templates:generate` は Python と Pillow (`pip install pillow`) が必要です。

画像が未配置の場合はシンプルなフォールバックレイアウトで生成されます。
