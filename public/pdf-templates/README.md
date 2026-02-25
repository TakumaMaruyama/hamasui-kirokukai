PDF台紙をこのフォルダに配置してください。

- 記録証: `record-certificate.png`
- 1位賞状: `first-prize-certificate.png`

拡張子は `.png` を推奨します（`.jpg` / `.jpeg` / `.webp` も読み込み可能）。
サイズは A5 縦（推奨: 1748x2480px, 300dpi）に合わせてください。

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
