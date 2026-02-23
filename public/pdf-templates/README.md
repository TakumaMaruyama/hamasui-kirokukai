PDF台紙をこのフォルダに配置してください。

- 記録証: `record-certificate.png`
- 1位賞状: `first-prize-certificate.png`

拡張子は `.png` を推奨します（`.jpg` / `.jpeg` / `.webp` も読み込み可能）。

## 子ども向けテンプレート3案
比較用の3案は `variants/` 配下に生成されます。

- `variants/adventure`（案A: うみのぼうけん）
- `variants/medal-fes`（案B: メダルフェス）
- `variants/swim-hero`（案C: スイムヒーロー）

現在使用されるのは、この階層直下の以下2ファイルです。

- `record-certificate.png`
- `first-prize-certificate.png`

切り替えは次のコマンドで行えます。

```bash
npm run templates:use adventure
npm run templates:use medal-fes
npm run templates:use swim-hero
```

テンプレートを再生成する場合は次を実行してください。

```bash
npm run templates:generate
```

`templates:generate` は Python と Pillow (`pip install pillow`) が必要です。

## 記録証の差し込み項目
`record-certificate.png` は、以下の動的文字を重ねて出力します。

- ふりがな
- 氏名
- 学年
- 種目（最大6行 + 超過時 `...`）
- 記録（最大6行 + 超過時 `...`）
- 年月

## 1位賞状の差し込み項目
`first-prize-certificate.png` は、以下の動的文字を重ねて出力します。

- ふりがな
- 氏名
- 学年・性別
- 種目
- 記録
- 年月

レイアウト座標は `lib/pdf.tsx` の `record*` / `prizeAward*` スタイルで調整できます。
