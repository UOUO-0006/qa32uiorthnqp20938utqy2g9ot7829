# ARG Web開発・運用仕様書 (AI/開発者引き継ぎ用)

本ドキュメントは、本ARG（代替現実ゲーム）プロジェクトにおけるWebページ作成・更新時の全技術仕様および開発ルールです。
別のAIや開発者が作業を行う際は、必ず本仕様に従ってください。

---

## 1. プロジェクト情報

- **GitHub ユーザー**: `UOUO-0006`
- **リポジトリ名**: `qa32uiorthnqp20938utqy2g9ot7829`
- **デフォルトブランチ**: `main`
- **GitHub Pages URL**: `https://uouo-0006.github.io/qa32uiorthnqp20938utqy2g9ot7829/`
  - `index.html` を配置しないため、ルートURLは404となる。エントリURLは8桁ランダム英数字ファイルのフルURL（例: `https://uouo-0006.github.io/qa32uiorthnqp20938utqy2g9ot7829/2X4EFtnr.html`）を配布すること。

---

## 2. 厳格禁止事項 (ソースコード隠蔽)

開発者ツール（F12）によるソース閲覧対策のため、以下の「親切設計」は全ページで完全禁止。

1. **ソースコード内コメント (`<!-- ... -->`) の完全禁止**
2. **意味のあるクラス名・ID名・変数名の禁止** (例: `rotate-img`, `secret-link` などの推測可能な名前は不可。`c`, `i`, `l`, `p` などの無機質・短縮記号のみ使用)
3. **`alt` 属性テキストの禁止** (常に空文字 `alt=""`)
4. **意味のあるページタイトルの禁止**

---

## 3. 必須ブラウザ仕様回避策

### (1) タブ名完全空白保持 (`U+2800` 点字空白)
- Chrome等の `trim()` 削除によるURL自動補完表示を回避するため、点字空白 `&#10240;` (`U+2800`) を設定。
- HTML: `<title>&#10240;</title>`
- JS: `document.title = "\u2800";`

### (2) 検索エンジン除外 (`noindex`)
- 全ページの `<head>` に記述: `<meta name="robots" content="noindex, nofollow">`

---

## 4. デザイン・UI共通基本仕様

- **背景色**: 完全な黒 (`background-color: #000000;`)
- **Webフォント**: リポジトリ直下の `x12y16pxMaruMonica.ttf` を `@font-face` で全要素に適用。
  ```css
  @font-face {
    font-family: 'MaruMonica';
    src: url('x12y16pxMaruMonica.ttf') format('truetype');
  }
  * {
    font-family: 'MaruMonica', sans-serif;
  }
  ```
- **画面配置**:
  - **上部要素/画像**: 画面の中央上部 (`margin-top: 20px; max-height: 45vh;`)
  - **下部操作要素/リンク**: 画面の中央より下 (`top: 65vh;` 〜 `68vh`)
  - **標準リンクスタイル**: Web標準青色 (`#0000FF`)、下線あり、サイズ `2rem`
- **画像回転**: なめらかな回転 (CSS `linear` による 360deg 連続回転) は**完全禁止**。高速な瞬間ジャンプ+長停止の繰り返しも禁止。
  - **45度ごとのステップ回転** + **コマ落ち表現** を必須とする。
  - 実装例: 周期 8s。各45°ステップは「0.4s停止 → 0.6sで回転」で、回転中は `steps(4)` により **11.25°ずつ4コマ** に分割描画される（= デジタル的なコマ落ち）。
    ```css
    .i {
      animation: s 8s steps(4) infinite;
    }
    @keyframes s {
      0%   { transform: rotate(0deg); }
      5%   { transform: rotate(0deg); }
      12.5%{ transform: rotate(45deg); }
      17.5%{ transform: rotate(45deg); }
      25%  { transform: rotate(90deg); }
      30%  { transform: rotate(90deg); }
      37.5%{ transform: rotate(135deg); }
      42.5%{ transform: rotate(135deg); }
      50%  { transform: rotate(180deg); }
      55%  { transform: rotate(180deg); }
      62.5%{ transform: rotate(225deg); }
      67.5%{ transform: rotate(225deg); }
      75%  { transform: rotate(270deg); }
      80%  { transform: rotate(270deg); }
      87.5%{ transform: rotate(315deg); }
      92.5%{ transform: rotate(315deg); }
      100% { transform: rotate(360deg); }
    }
    ```
  - 速度調整は `8s` の値のみ変更（例: ゆっくり → `12s`、速め → `5s`）。キーフレームの百分率は変更しないこと。

---

## 5. ファイル更新 & リンク難読化運用ルール

1. **ファイル構成**:
   - **全ページのURLは「8桁のランダム英数字」に統一**（エントリポイント含む。例: `2X4EFtnr.html`, `RmT8tL0t.html`）。
   - `index.html` や `rotate.html` など、推測可能・意味のあるファイル名は **完全禁止**。エントリポイントも例外なくランダム名とする（`index.html` は配置しない）。
   - 内部遷移先ページ: 推測不可能な8桁ランダム英数字ファイル名（例: `RmT8tL0t.html`）。
2. **更新運用**:
   - ページ内容を更新・改修するたびに新しい8桁ランダム英数字ファイルを作成し、旧ファイルは削除する。
3. **リンク難読化**:
   - 遷移先URLの直接閲覧防止のため、JavaScriptで Base64 エンコード等を行い動的に遷移させる。全ページの遷移リンク（戻りリンク含む）に適用する。
   ```javascript
   const p = "Um1UOHRMMHQuaHRtbA=="; // Base64 ("RmT8tL0t.html")
   document.getElementById("l").addEventListener("click", function() {
     window.location.href = atob(p);
   });
   ```

---

## 6. ベースHTMLテンプレート

- ファイル名は必ず8桁ランダム英数字（例: `2X4EFtnr.html`）。`index.html` は使用しない。
- 以下は回転ページのテンプレート（`.i` に45度ステップ回転+コマ落ちを適用済み）。回転させないページでは `.i` の `animation` と `@keyframes s` を削除し、`img` はクラスなしで使用する。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>&#10240;</title>
  <style>
    @font-face {
      font-family: 'MaruMonica';
      src: url('x12y16pxMaruMonica.ttf') format('truetype');
    }
    * {
      font-family: 'MaruMonica', sans-serif;
    }
    body {
      background-color: #000000;
      color: #ffffff;
      margin: 0;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      min-height: 100vh;
      box-sizing: border-box;
      position: relative;
    }
    img, .i {
      max-width: 90%;
      height: auto;
      max-height: 45vh;
      margin-top: 20px;
      display: block;
    }
    .i {
      animation: s 8s steps(4) infinite;
    }
    @keyframes s {
      0%   { transform: rotate(0deg); }
      5%   { transform: rotate(0deg); }
      12.5%{ transform: rotate(45deg); }
      17.5%{ transform: rotate(45deg); }
      25%  { transform: rotate(90deg); }
      30%  { transform: rotate(90deg); }
      37.5%{ transform: rotate(135deg); }
      42.5%{ transform: rotate(135deg); }
      50%  { transform: rotate(180deg); }
      55%  { transform: rotate(180deg); }
      62.5%{ transform: rotate(225deg); }
      67.5%{ transform: rotate(225deg); }
      75%  { transform: rotate(270deg); }
      80%  { transform: rotate(270deg); }
      87.5%{ transform: rotate(315deg); }
      92.5%{ transform: rotate(315deg); }
      100% { transform: rotate(360deg); }
    }
    .c {
      position: absolute;
      top: 65vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    a {
      color: #0000FF;
      font-size: 2rem;
      text-decoration: underline;
      line-height: 1;
      cursor: pointer;
    }
    a:visited {
      color: #0000FF;
    }
    a:hover {
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <img src="image.png" alt="" class="i">
  <div class="c">
    <a id="l">■</a>
  </div>
  <script>
    document.title = "\u2800";
    const p = "Um1UOHRMMHQuaHRtbA==";
    document.getElementById("l").addEventListener("click", function() {
      window.location.href = atob(p);
    });
  </script>
</body>
</html>
```

---

## 7. 引き継ぎ用プロンプト

他のAIに作業を引き継ぐ際は、以下のテキストを渡してください。

> **【指示文】**
> リポジトリ内の `HANDOVER.md` に記載されているARGWeb開発仕様（親切設計の完全禁止、点字空白タイトル `U+2800` の維持、**全URLを8桁ランダム英数字に統一**（`index.html` 不使用）、Base64難読化、**画像は45度ステップ回転+コマ落ち**、`x12y16pxMaruMonica.ttf` の全編Webフォント適用、レイアウト標準）を厳守してページの作成・更新を行ってください。
