# ARG Web開発・運用仕様書 (AI/開発者引き継ぎ用)

本ドキュメントは、本ARG（代替現実ゲーム）プロジェクトにおけるWebページ作成・更新時の全技術仕様および開発ルールです。
別のAIや開発者が作業を行う際は、必ず本仕様に従ってください。

---

## 1. プロジェクト情報

- **GitHub ユーザー**: `UOUO-0006`
- **リポジトリ名**: `qa32uiorthnqp20938utqy2g9ot7829`
- **デフォルトブランチ**: `main`
- **GitHub Pages URL**: `https://uouo-0006.github.io/qa32uiorthnqp20938utqy2g9ot7829/`

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

---

## 5. ファイル更新 & リンク難読化運用ルール

1. **ファイル構成**:
   - エントリポイント: `index.html`
   - 内部遷移先ページ: 推測不可能なランダム英数字ファイル名（例: `x9k_37q_rotate_a82.html`）。
2. **更新運用**:
   - ページ内容を更新・改修するたびに新しいランダムファイルを作成し、旧ファイルは削除する。
3. **リンク難読化**:
   - 遷移先URLの直接閲覧防止のため、JavaScriptで Base64 エンコード等を行い動的に遷移させる。
   ```javascript
   const p = "eDlrXzM3cV9yb3RhdGVfYTgyLmh0bWw="; // Base64
   document.getElementById("l").addEventListener("click", function() {
     window.location.href = atob(p);
   });
   ```

---

## 6. ベースHTMLテンプレート

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
  <img src="image.png" alt="">
  <div class="c">
    <a id="l">■</a>
  </div>
  <script>
    document.title = "\u2800";
    const p = "eDlrXzM3cV9yb3RhdGVfYTgyLmh0bWw=";
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
> リポジトリ内の `HANDOVER.md` に記載されているARGWeb開発仕様（親切設計の完全禁止、点字空白タイトル `U+2800` の維持、Base64難読化、`x12y16pxMaruMonica.ttf` の全編Webフォント適用、レイアウト標準）を厳守してページの作成・更新を行ってください。
