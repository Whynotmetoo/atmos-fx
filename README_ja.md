# <img src="./docs/favicon.svg" width="36" height="36" align="center" alt="atmos-fx icon" /> atmos-fx
<div>
    <a href="README.md">English</a> · <a href="README_zh.md">简体中文</a> · <b>日本語</b> · <a href="README_es.md">Español</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</div>
<br>
atmos-fx は、天候表現を単なる背景ではなく DOM の一部として扱う、DOM-aware なエフェクトライブラリです。Apple Weather のような降水表現をベースに、子要素をガラス風に見せたり、不透明のまま保ったり、雨や雪が当たる面として使ったりできます。

![demo-high](https://atmosfx.carsonye.com/assets/demo-high.gif)

> **デモと Playground は [https://atmosfx.carsonye.com/](https://atmosfx.carsonye.com/) で試せます。**

[インストール](#インストール) • [クイックスタート](#クイックスタート) • [API リファレンス](#api-リファレンス) • [デザインの指針](#デザインの指針)

## インストール

```bash
npm i atmos-fx
```

## クイックスタート

### React

ラッパーコンポーネントを使う場合は、React が peer dependency として必要です。

```tsx
import { AtmosFx, AtmosCard } from 'atmos-fx'

export function FunctionalDemo() {
  return (
    <AtmosFx preset="rain" density={0.7} className="functional-demo">
      <AtmosCard transMode="glass">
        <div>雨がこの面に当たり、上端で跳ね返ります。</div>
      </AtmosCard>

      {/* 余分なラッパー要素を増やしたくない場合 */}
      <AtmosCard asChild transMode="solid">
        <button>不透明な操作ボタン</button>
      </AtmosCard>

      <AtmosCard transMode="opacity" opacity={0.64}>
        <span>透明度を個別に指定</span>
      </AtmosCard>
    </AtmosFx>
  )
}
```

### CDN

Vite や webpack を使う場合は、パッケージをインストールして通常どおり import します。

```javascript
import { createAtmosphere } from 'atmos-fx'
```

ビルド環境のない HTML では ESM CDN を利用できます。

```html
<script type="module">
  import { createAtmosphere } from 'https://esm.sh/atmos-fx'

  const controller = createAtmosphere(document.querySelector('#container'), {
    preset: 'rain',
    density: 0.7,
  })

  controller.start()
</script>
```

### Vanilla JS

```html
<div id="container">
  <div data-atmos-collision data-atmos-glass data-atmos-liquid-dripping="true">
    <h1>インタラクティブな棚</h1>
    <p>ここに降水が当たって跳ねます。</p>
  </div>
</div>
```

```javascript
import { createAtmosphere } from 'atmos-fx'

const controller = createAtmosphere(document.querySelector('#container'), {
  preset: 'rain',
  density: 0.7,
  wind: -0.15,
  alpha: 0.16,
})

controller.start()

// React 以外でルート要素を削除するときは、先に破棄してください。
// controller.destroy()
```

### Vue

```html
<template>
  <div ref="containerRef" id="container">
    <!-- data 属性で衝突面とガラス面を指定 -->
    <div data-atmos-collision data-atmos-glass>
      <h1>インタラクティブな棚</h1>
      <p>ここに降水が当たって跳ねます。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { createAtmosphere } from 'atmos-fx'

const containerRef = ref(null)
let controller = null

onMounted(() => {
  if (containerRef.value) {
    controller = createAtmosphere(containerRef.value, {
      preset: 'rain',
      density: 0.7,
      wind: -0.15,
      alpha: 0.16,
    })
    controller.start()
  }
})

onUnmounted(() => {
  controller?.destroy()
})
</script>
```

## API リファレンス

### `AtmosFx` Props

| Prop | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `preset` | `'rain' \| 'snow' \| 'hail'` | `'rain'` | 物理挙動と見た目の基準をまとめて選びます。 |
| `density` | `number` | `0.585` | 単位面積あたりの粒子量です。0 で無効、1 で現在の quality における最大密度になります。 |
| `speed` | `number` | `1.0` | 落下運動と液体アニメーションの速度倍率です。負の値は 0 として扱われます。 |
| `wind` | `number` | `-0.12` | 水平方向の流れを指定します。負なら左、正なら右へ流れます。 |
| `color` | `string` | `'rgba(220, 235, 255, 0.72)'` | ブラウザが解釈できる CSS 色を指定します。alpha は降水と雨水表現にも反映されます。 |
| `quality` | `'auto' \| 'low' \| 'medium' \| 'high'` | `'auto'` | 手動値は粒子密度の段階を決めます。`auto` は medium から始まり、実測したフレーム性能に合わせて調整されます。 |
| `alpha` | `number` | `0.12` | ガラス面の背景不透明度（アルファ値）です。0 から 1 に収まるよう補正されます。 |
| `opacity` | `number` | `0.1` | `data-atmos-opacity` 要素の既定背景不透明度です。0 から 1 に収まるよう補正されます。 |
| `bottomCollision` | `boolean` | `true` | ルートコンテナの下端で降水を衝突させるかを決めます。 |
| `liquidDripping` | `boolean` | `true` | 雨モードの凝結・集約・滴下アニメーションをまとめて切り替えます。 |
| `liquidGatheringPoint` | `number` | カードごとに固定ランダム | 横方向の集約位置を `0.33` から `0.66` で指定します。 |
| `pauseWhenHidden` | `boolean` | `true` | document が非表示、またはルートが viewport 外に出たとき自動停止します。 |
| `respectReducedMotion` | `boolean` | `true` | OS の `prefers-reduced-motion` を尊重してエフェクトを停止します。 |
| `injectStyles` | `boolean` | `true` | 既定 CSS を自動挿入します。`atmos-fx/styles.css` を自分で読む場合は false にします。 |
| `styleNonce` | `string` | `''` | 自動挿入する style 要素に設定する CSP nonce です。 |

### `AtmosCard` Props

| Prop | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `transMode` | `'glass' \| 'opacity' \| 'solid'` | `'glass'` | カードのガラス、半透明、ソリッド表示を切り替えます。どのモードでも衝突面として機能します。 |
| `liquidDripping` | `boolean` | `true` | このカードだけ雨水の凝結と滴下を切り替えます。 |
| `liquidGatheringPoint` | `number` | 継承 / 固定ランダム | このカードの集約位置を `0.33` から `0.66` で上書きします。 |
| `asChild` | `boolean` | `false` | 余分な div を作らず、属性や ref を 1 つの子要素へマージします。 |
| `opacity` | `number` | `0.1` | `transMode="opacity"` のカード背景不透明度です。 |
| `alpha` | `number` | `0.12` | `transMode="glass"` のカード背景不透明度です。 |

### Vanilla JS の `createAtmosphere` options

`createAtmosphere(element, options)` は `start()`、`stop()`、`pause()`、`resume()`、`resize()`、`update(options)`、`destroy()` を持つ controller を返します。

`options` は `AtmosFx` Props と同じです。

#### 内部要素で使える data attributes

- `data-atmos-solid`: ガラスや透明度処理を外し、ソリッドなまま保ちます。
- `data-atmos-opacity="0.1"`: 要素ごとの背景透明度を指定します。
- `data-atmos-alpha="0.12"`: 要素ごとのガラス背景不透明度 (alpha) を指定します。
- `data-atmos-glass`: 内蔵のガラス面スタイルを有効にします。
- `data-atmos-collision`: 前景降水が上端と側面で衝突する面にします。
- `data-atmos-liquid-dripping="true"`: 雨モードで、この面の凝結と滴下を切り替えます。
- `data-atmos-liquid-gathering-point="0.5"` は任意の上書き例です。省略時はカードごとの固定ランダム値を使い、指定値は `0.33` から `0.66` に補正されます。

## デザインの指針

- **前景・背景と滴下**: 降水は前景と背景に分けて描画されます。前景粒子は衝突面に遮られ、雨水は下にある別の衝突面にも当たります。
- **幅に応じた Gathering**: カードが広いほど Gathering は長くなります（`1250ms + 2.8ms × CSS px`、最大 `5500ms`。`300px` なら `2090ms`）。その後の各段階は固定時間です。
- **コンテナ単位のガラス**: glass モードで最良の見た目にするには、`div`、`section`、`article`、`form` などのブロック系 HTML コンテナに付けてください。input、画像、SVG、inline テキストは直接指定せず、外側のコンテナで包みます。
- **広すぎる衝突面に注意**: 幅の広いカードは傘のように前景の雨を遮ります。下のカードにも雨を届かせたい場合は、横幅を抑えてください。
- **カードをむやみに入れ子にしない**: `AtmosCard` 同士の入れ子は衝突境界が重なり、意図しない見た目になりやすいため、明確な演出意図がある場合に限るのがおすすめです。
- **`transMode`**:
  - `glass`: ぼかしを使った既定のフロストガラス。
  - `opacity`: 通常の CSS opacity で背景となじませる半透明表示。
  - `solid`: ライブラリの透明処理を使わず、要素本来の見た目を維持。

## パフォーマンス

- 基本は `quality: 'auto'` を推奨します。コンテナ面積は粒子総数だけに影響し、quality の段階は変えません。
- WebGL を優先し、初期化できない環境では描画を行わない Canvas 2D のダミー実装へ静かに切り替わります。
- 透明面では背景粒子が見えたまま、前景粒子だけが DOM 面と衝突します。
- 衝突計算と滴下は対象要素の AABB を使います。回転要素は見た目ではなく外接矩形で判定されます。
- 雪と雹の堆積は上限付きプールを使い、quality と density に応じて容量を調整します。
- 本番環境では `respectReducedMotion` を有効のまま使ってください。

## 開発

```bash
npm install
npm run typecheck
npm run build
npm test
```

現在は、WebGL による雨・雪・雹、適応型 quality、ガラス表現、角丸を考慮した上端・側面衝突、雨水の集約と滴下、2D の雪・雹堆積、静的 Playground を実装しています。

## ローカルで試す

```bash
npm run build
npx vite --host 127.0.0.1 --port 4173
```

`http://127.0.0.1:4173/docs/` を開くと、雨・雪・雹を切り替えて確認できます。

## コントリビューション

ビルド方法やテスト方針は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

MIT
