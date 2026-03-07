PDF台紙をこのフォルダに配置してください。

- 記録証: `record-certificate.(jpg|jpeg|png|webp)`
- 1位賞状: `first-prize-certificate.(jpg|jpeg|png|webp)`

サイズは A5 縦（推奨: 1748x2480px, 300dpi）に合わせてください。
写真やグラデーションが多い台紙は `.jpg` / `.jpeg` を推奨します。大きい台紙はサーバー側で軽量化してから PDF に埋め込みます。

## 記録証の差し込み項目
`record-certificate.*` は、以下の動的文字を重ねて出力します。

- ふりがな
- 氏名
- 学年
- 種目（最大6行 + 超過時 `...`）
- 記録（最大6行 + 超過時 `...`）
- 年月

## 1位賞状の差し込み項目
`first-prize-certificate.*` は、以下の動的文字を重ねて出力します。

- ふりがな
- 氏名
- 学年・性別
- 種目
- 記録
- 年月

レイアウト座標は `lib/pdf.tsx` の `record*` / `prizeAward*` スタイルで調整できます。
