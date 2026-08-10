# ARG Web開発・運用仕様書 (AI/開発者引き継ぎ用)

本ドキュメントは、本ARG（代替現実ゲーム）プロジェクトにおけるWebページ作成・更新時の全技術仕様および開発ルールです。
別のAIや開発者が作業を行う際は、必ず本仕様に従ってください。

---

## 1. プロジェクト情報

- **GitHub ユーザー**: `UOUO-0006`
- **リポジトリ名**: `qa32uiorthnqp20938utqy2g9ot7829`
- **デフォルトブランチ**: `main`
- **GitHub Pages URL**: `https://uouo-0006.github.io/qa32uiorthnqp20938utqy2g9ot7829/`
  - **エントリは `index.html`（乱数なし・最簡形式・永久固定）**。ルートURL（上記）がそのままエントリとして表示される。
  - エントリURLはこれのみを配布・告知する。内部ページURLは教えない。

---

## 2. 厳格禁止事項 (ソースコード隠蔽)

開発者ツール（F12）によるソース閲覧対策のため、以下の「親切設計」は全ページで完全禁止。

1. **ソースコード内コメント (`<!-- ... -->`) の完全禁止**
2. **意味のあるクラス名・ID名・変数名・ファイル名の完全禁止**
   - **ファイル名ルール**: 内部ページのURL（ファイル名）は、状態や内容に関係なく**「ランダムな8桁の英数字（例: `kPMniGhz.html`）」**にすること。
   - **エントリページのみ例外**: 固定ファイル名 `index.html`（乱数なし・最簡形式・永久不変。ユーザーがブックマークするURLのため更新時も変更しない）。
   - クラス・ID・変数名: `c`, `i`, `l`, `p` などの無機質・短縮記号のみ使用。
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
- **画像回転**: なめらかな回転 (CSS `linear` による 360deg 連続回転) は**完全禁止**。高速な瞬間ジャンプ+長停止の繰り返しも**完全禁止**。回転中に意図的な停止フェーズを挟まないこと。
  - **45度ごとのステップ回転** + **fps低下によるコマ落ち** を必須とする。
  - 実装: `animation-timing-function: steps(8)` で連続回転を8コマに分割描画（= 1コマ45°）。周期 `0.667s` で **8 ÷ 0.667 = 12fps** となる。キーフレームは開始から終了まで単純な 0→360deg のみ。停止フェーズは挟まない。
    ```css
    .i {
      animation: s 0.667s steps(8) infinite;
    }
    @keyframes s {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    ```
  - fps は「コマ数 ÷ 周期」で決まる（現状 8コマ / 0.667s = **12fps**）。速度を変えたい場合は周期を変更する（例: 遅く → `1s`=8fps、速く → `0.5s`=16fps）。45度ステップ（8コマ）は変えないこと。

---

## 5. ファイル更新 & リンク難読化運用ルール

1. **ファイル構成**:
   - **エントリページは `index.html` で永久固定**（乱数なし・最簡形式。更新時も名前を変えない。ユーザーがブックマークするURLのため）。
   - 内部遷移先ページ: 推測不可能な8桁ランダム英数字ファイル名（例: `kPMniGhz.html`）。
   - `rotate.html` など、推測可能・意味のある内部ページ名は **完全禁止**。
2. **更新運用**:
   - エントリファイル `index.html` は名前を変えず内容のみ更新する。
   - 内部ページを更新・改修するたびに、新しく生成したランダムな8桁英数字ファイルを作成し、旧ファイルは削除する。エントリ内のBase64リンクも新ファイル名に更新する。
3. **リンク難読化**:
   - 遷移先URLの直接閲覧防止のため、JavaScriptで Base64 エンコード等を行い動的に遷移させる。全ページの遷移リンク（戻りリンク含む）に適用する。
   ```javascript
   const p = "aW5kZXguaHRtbA=="; // "index.html" のBase64
   document.getElementById("l").addEventListener("click", function() {
     window.location.href = atob(p);
   });
   ```

---

## 6. ベースHTMLテンプレート

- エントリページは固定ファイル名 `index.html`（乱数なし・永久不変・回転なし）。内部ページは8桁ランダム英数字。
- 以下は回転ページのテンプレート（`.i` に45度ステップ+12fps回転を適用済み）。回転させないページでは `.i` の `animation` と `@keyframes s` を削除し、`img` はクラスなしで使用する。

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
      animation: s 0.667s steps(8) infinite;
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
    const p = "aW5kZXguaHRtbA==";
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
> リポジトリ内の `HANDOVER.md` に記載されているARGWeb開発仕様（親切設計の完全禁止、点字空白タイトル `U+2800` の維持、**エントリURLは `index.html` で固定（乱数なし・永久不変）・内部ページは8桁ランダム英数字で更新のたび変更**、Base64難読化、**画像は45度ステップの連続回転を12fps（`0.667s steps(8)`）で実装・停止フェーズ禁止**、`x12y16pxMaruMonica.ttf` の全編Webフォント適用、レイアウト標準）を厳守してページの作成・更新を行ってください。
