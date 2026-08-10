# ARG Webページ制作・更新仕様書 (AI引き継ぎ用ドキュメント)

本ドキュメントは、本プロジェクト（ARG: 代替現実ゲーム用Webサイト）におけるデザイン、ソースコード隠蔽ルール、ブラウザ仕様回避策、ファイル構成等の全仕様をまとめたものです。
他のAIや開発者に作業を引き継ぐ際は、本ファイルを前提知識として渡してください。

---

## 1. プロジェクト概要 & リポジトリ情報

- **プロジェクト目的**: ARG（代替現実ゲーム）の謎解き・探索用Webサイト制作
- **GitHub ユーザー名**: `UOUO-0006`
- **リポジトリ名**: `qa32uiorthnqp20938utqy2g9ot7829`
- **デフォルトブランチ**: `main`
- **GitHub Pages 公開URL**: `https://uouo-0006.github.io/qa32uiorthnqp20938utqy2g9ot7829/`

---

## 2. 厳格ルール: ソースコードの「親切設計」完全禁止

ARGのプレイヤーはブラウザのデベロッパーツール（F12）やソースコード閲覧を行うため、ソース内にプレイヤーへのヒントや説明が残っているとゲームが台無しになります。**以下のルールを徹底してください。**

1. **一切のコメント (`<!-- ... -->`) 禁止**
   - HTML/CSS/JS 内に解説、注釈、開発用メモなどのコメントを絶対に記述しないこと。
2. **意味のあるクラス名・ID名・変数名の禁止**
   - `rotate-img`, `secret-link`, `encodedPath` などの推測しやすい名称は絶対禁止。
   - `c`, `t`, `i`, `l`, `p` などの無機質・短縮記号のみを使用すること。
3. **`alt` 属性テキストの禁止**
   - `<img>` タグの `alt` 属性は常に空文字 (`alt=""`) にすること（「画像」「回転する画像」などの説明は厳禁）。
4. **意味のあるページタイトルの禁止**
   - 「トップページ」「Rotate Page」などの文章を `<title>` に記述することは厳禁。

---

## 3. ブラウザ仕様回避テクニック (必須実装)

### (1) タブ名の完全空白保持 (`U+2800` 点字空白)
- **問題点**: Chrome/Edge/Safari 等のブラウザは、`<title>` が空または全角スペース (`\u3000`) だと `trim()` 処理により空文字とみなされ、タブ名にページのURLがフォールバック表示されてしまう。
- **解決策**: Unicodeの点字空白文字 `U+2800` (`&#10240;`) を使用する。`trim()` 削除対象にならず見た目も透明なため、ブラウザにURLが表示されず完全な空白タブになる。
- **実装必須コード**:
  ```html
  <title>&#10240;</title>
  ```
  ```javascript
  document.title = "\u2800";
  ```

### (2) 検索エンジンの除外 (`noindex`)
- Google等の検索エンジンにページがヒット・ネタバレしないよう、全ページの `<head>` に必ず以下を記述する。
  ```html
  <meta name="robots" content="noindex, nofollow">
  ```

---

## 4. デザイン & レイアウト仕様

- **背景色**: 完全な黒 (`background-color: #000000;`)
- **Webフォント**:
  - プロジェクト直下の `x12y16pxMaruMonica.ttf` を `@font-face` で全ページに読み込む。
  ```css
  @font-face {
    font-family: 'MaruMonica';
    src: url('x12y16pxMaruMonica.ttf') format('truetype');
  }
  * {
    font-family: 'MaruMonica', sans-serif;
  }
  ```
- **配置レイアウト**:
  - **添付画像 (`image.png`)**: 画面の中央上部 (`margin-top: 20px; max-height: 45vh;`) に配置。
  - **テキスト & リンク**: 画面の中央より下 (`top: 65vh;` や `top: 68vh;`) に配置。
  - **テキスト内容**: 「ドンドコタコス」（文字色: `#ffffff` 白, サイズ: `2rem`）
  - **リンク内容**: 直下に「■」（文字色: `#0000FF` 標準の青, 下線あり, サイズ: `2rem`）

---

## 5. ファイル構成 & リンク難読化ルール

- **トップページ**: `index.html`
- **遷移先ページ**: 意味を推測できないランダムな英数字のファイル名（例: `x9k_37q_rotate_a82.html`）。
- **更新時の運用ルール**: 内容を更新・改修するたびに、新しいランダムファイル名を作成し、古い不要なファイルは削除する。
- **リンク難読化**:
  - ソースコードをパッと見ただけで遷移先URLが特定されないよう、JavaScriptで Base64 エンコード等を行い動的に遷移させる。
  ```javascript
  const p = "eDlrXzM3cV9yb3RhdGVfYTgyLmh0bWw="; // Base64 encoded
  document.getElementById("l").addEventListener("click", function() {
    window.location.href = atob(p);
  });
  ```

---

## 6. HTMLテンプレート構造 (ベースコード)

新しくページを作成・追加する際は、以下の構造を厳守してください。

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
    /* 回転アニメーションが必要な場合 */
    .i {
      animation: s 4s linear infinite;
    }
    @keyframes s {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .c {
      position: absolute;
      top: 65vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .t {
      color: #ffffff;
      font-size: 2rem;
      line-height: 1;
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
    <div class="t">ドンドコタコス</div>
    <a href="index.html">■</a>
  </div>
  <script>
    document.title = "\u2800";
  </script>
</body>
</html>
```

---

## 7. 次のAIへの依頼用プロンプト (プロンプト例)

他のAIにこのリポジトリの編集を依頼する際は、以下の文章をそのまま貼り付けて渡してください。

> **【引き継ぎ指示文】**
> あなたはARG（代替現実ゲーム）のWeb制作アシスタントです。
> リポジトリ内の `HANDOVER.md` に記載されている全仕様・禁止事項（親切設計の完全禁止、点字空白タイトルの維持、Base64難読化、`x12y16pxMaruMonica.ttf` Webフォントの適応、黒背景と配置レイアウト）を厳守して、Webページの編集・作成を行ってください。
