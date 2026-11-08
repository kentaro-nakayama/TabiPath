# 構成図

READMEに貼っているアーキテクチャ図のSVGと、その生成スクリプト。

| ファイル | 内容 |
|---|---|
| `01-system.svg` | レベル1: システム構成 |
| `02-routes.svg` | レベル2: 画面とAPIの対応 |
| `03-data-model.svg` | レベル3: データモデル |
| `04-trip-flow.svg` | レベル4: 旅行行程画面の処理の流れ |
| `05-spot-list-flow.svg` | レベル5: 行きたいところリストの処理の流れ |

## 作り直し方

SVGは手で編集せず、生成スクリプトを直してから再生成する。外部依存はなく、Python 3 だけで動く。

```bash
cd docs/architecture
for f in gen_*.py; do python3 "$f"; done
```

- `svglib.py`: 箱・矢印・テーブル・処理の連鎖を描くための共通ヘルパー
- `gen_0*.py`: 図ごとのレイアウト定義（座標は各ファイルに直接書いてある）

GitHub上では `<img>` から参照したSVGだけが描画され、Markdownに直接書いたインラインの `<svg>` は除去される。
背景色はGitHubダークテーマのキャンバス色 `rgb(14,17,22)` に合わせてあり、テーマ定数は `svglib.py` の
`BG` / `FG` / `PALETTE` にまとまっている。
