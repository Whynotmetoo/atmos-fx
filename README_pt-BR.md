# <img src="./docs/favicon.svg" width="36" height="36" align="center" alt="atmos-fx icon" /> atmos-fx
<div>
    <a href="README.md">English</a> · <a href="README_zh.md">简体中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_es.md">Español</a> · <b>Português (Brasil)</b>
</div>
<br>
atmos-fx é uma biblioteca de efeitos atmosféricos que entende a estrutura do DOM. Em vez de funcionar como um fundo isolado, ela integra chuva, neve e granizo à interface: elementos podem ganhar aparência de vidro, continuar opacos ou virar superfícies físicas de colisão.

![demo-high](https://atmosfx.carsonye.com/assets/demo-high.gif)

> **Veja a demonstração e use o Playground em [https://atmosfx.carsonye.com/](https://atmosfx.carsonye.com/).**

[Instalação](#instalação) • [Início rápido](#início-rápido) • [Referência da API](#referência-da-api) • [Orientações de design](#orientações-de-design)

## Instalação

```bash
npm i atmos-fx
```

## Início rápido

### React

Os componentes React precisam do React como peer dependency.

```tsx
import { AtmosFx, AtmosCard } from 'atmos-fx'

export function FunctionalDemo() {
  return (
    <AtmosFx preset="rain" density={0.7} className="functional-demo">
      <AtmosCard transMode="glass">
        <div>A chuva atinge esta superfície e respinga na borda.</div>
      </AtmosCard>

      {/* Evita criar um elemento extra */}
      <AtmosCard asChild transMode="solid">
        <button>Ação opaca</button>
      </AtmosCard>

      <AtmosCard transMode="opacity" opacity={0.64}>
        <span>Opacidade personalizada</span>
      </AtmosCard>
    </AtmosFx>
  )
}
```

### CDN

Com Vite, webpack ou outro bundler, instale o pacote e importe a API normalmente:

```javascript
import { createAtmosphere } from 'atmos-fx'
```

Em uma página HTML sem etapa de build, use um CDN ESM:

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
    <h1>Superfície interativa</h1>
    <p>A precipitação respinga aqui.</p>
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

// Ao remover a raiz fora do React, destrua o controller primeiro:
// controller.destroy()
```

### Vue

```html
<template>
  <div ref="containerRef" id="container">
    <!-- Atributos data definem as superfícies de vidro e colisão -->
    <div data-atmos-collision data-atmos-glass>
      <h1>Superfície interativa</h1>
      <p>A precipitação respinga aqui.</p>
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

## Referência da API

### Props de `AtmosFx`

| Prop | Tipo | Padrão | Descrição |
| --- | --- | --- | --- |
| `preset` | `'rain' \| 'snow' \| 'hail'` | `'rain'` | Seleciona um conjunto completo de valores físicos e visuais. |
| `density` | `number` | `0.65` | Controla as partículas por unidade de área. 0 desativa e 1 usa a taxa completa do quality atual. |
| `speed` | `number` | `1.0` | Multiplica a velocidade do movimento e do ciclo de água. Valores negativos são tratados como 0. |
| `wind` | `number` | `-0.12` | Aplica movimento horizontal: negativo para a esquerda, positivo para a direita. |
| `color` | `string` | `'rgba(220, 235, 255, 0.72)'` | Aceita qualquer cor CSS válida para a precipitação e a água. O canal alpha também é preservado. |
| `quality` | `'auto' \| 'low' \| 'medium' \| 'high'` | `'auto'` | Os níveis manuais definem a taxa de partículas. `auto` começa em medium e se adapta ao desempenho medido. |
| `alpha` | `number` | `0.12` | Base de opacidade do fundo de vidro, limitada entre `0` e `1`. |
| `opacity` | `number` | `0.1` | Opacidade de fundo padrão de elementos com `data-atmos-opacity`, limitada entre `0` e `1`. |
| `bottomCollision` | `boolean` | `true` | Ativa a colisão com a borda inferior do contêiner raiz. |
| `liquidDripping` | `boolean` | `true` | Controla globalmente a condensação, o agrupamento e o gotejamento no modo chuva. |
| `liquidGatheringPoint` | `number` | Aleatório estável por card | Define o ponto horizontal de agrupamento entre `0.33` e `0.66`. |
| `pauseWhenHidden` | `boolean` | `true` | Pausa quando o document fica oculto ou a raiz sai do viewport. |
| `respectReducedMotion` | `boolean` | `true` | Respeita `prefers-reduced-motion` e interrompe o efeito quando o sistema solicita. |
| `injectStyles` | `boolean` | `true` | Injeta os estilos básicos; desative ao carregar `atmos-fx/styles.css` manualmente. |
| `styleNonce` | `string` | `''` | Nonce CSP aplicado ao elemento style injetado automaticamente. |

### Props de `AtmosCard`

| Prop | Tipo | Padrão | Descrição |
| --- | --- | --- | --- |
| `transMode` | `'glass' \| 'opacity' \| 'solid'` | `'glass'` | Alterna entre vidro, transparência e aparência sólida. O card continua sendo uma superfície de colisão nos três modos. |
| `liquidDripping` | `boolean` | `true` | Ativa ou desativa a animação de água deste card. |
| `liquidGatheringPoint` | `number` | Herdado / aleatório estável | Sobrescreve entre `0.33` e `0.66` o ponto onde a água se reúne neste card. |
| `asChild` | `boolean` | `false` | Mescla atributos e refs em um único filho sem criar uma div extra. |
| `opacity` | `number` | `0.1` | Opacidade de fundo do card no modo opacity, de 0 a 1. |
| `alpha` | `number` | `0.12` | Opacidade de fundo do card (alpha) em modo glass, de 0 a 1. |

### Opções de `createAtmosphere` em Vanilla JS

`createAtmosphere(element, options)` retorna um controller com `start()`, `stop()`, `pause()`, `resume()`, `resize()`, `update(options)` e `destroy()`.

`options` aceita os mesmos valores de `AtmosFx`.

#### Atributos data para elementos internos

- `data-atmos-solid`: mantém o elemento sólido e sem tratamento de vidro.
- `data-atmos-opacity="0.1"`: define uma opacidade de fundo específica para o elemento.
- `data-atmos-alpha="0.12"`: define uma opacidade de vidro (alpha) específica para o elemento.
- `data-atmos-glass`: ativa a superfície de vidro incluída.
- `data-atmos-collision`: transforma o elemento em superfície de colisão superior e lateral.
- `data-atmos-liquid-dripping="true"`: controla condensação e gotejamento dessa superfície no modo chuva.
- `data-atmos-liquid-gathering-point="0.5"` é um exemplo de sobrescrita opcional. Quando omitido, cada card mantém seu valor aleatório estável; valores informados são limitados entre `0.33` e `0.66`.

## Orientações de design

- **Camadas e gotejamento**: a precipitação é desenhada em primeiro plano e no fundo. Partículas em primeiro plano colidem com os cards, e gotas destacadas podem atingir outras superfícies abaixo.
- **Gathering proporcional à largura**: cards mais largos demoram mais para reunir a água (`1250ms + 2.8ms × pixel CSS`, limitado a `5500ms`; em `300px`, leva `2090ms`). As fases seguintes mantêm duração fixa.
- **Vidro no nível do contêiner**: para obter o melhor resultado no modo glass, aplique em contêineres HTML de bloco, como `div`, `section`, `article` ou `form`. Envolva inputs, imagens, SVGs e texto inline em vez de marcá-los diretamente.
- **Evite superfícies largas demais**: um card muito largo funciona como guarda-chuva e reduz a chuva que chega aos elementos inferiores.
- **Não aninhe cards sem um motivo visual claro**: limites de colisão sobrepostos tendem a gerar movimentos pouco naturais.
- **Modos de `transMode`**:
  - `glass`: vidro fosco com desfoque do fundo.
  - `opacity`: mistura translúcida baseada em CSS opacity.
  - `solid`: preserva o estilo opaco sem transparência gerenciada.

## Desempenho

- Prefira `quality: 'auto'`. A área muda o total de partículas, mas não escolhe o nível de quality.
- O renderer usa WebGL e, se não conseguir inicializá-lo, troca silenciosamente para um Canvas 2D dummy que não desenha o efeito.
- Superfícies transparentes revelam as partículas do fundo enquanto as de primeiro plano continuam colidindo com o DOM.
- A física usa o AABB de cada alvo. Elementos rotacionados colidem pelo retângulo externo, não pelo contorno visual.
- Neve e granizo acumulados usam pools limitados cuja capacidade varia com quality e density.
- Mantenha `respectReducedMotion` ativado em produção.

## Desenvolvimento

```bash
npm install
npm run typecheck
npm run build
npm test
```

A implementação atual inclui renderers WebGL de chuva, neve e granizo, quality adaptativo, superfícies de vidro, colisões superiores e laterais com cantos arredondados, água que se reúne e goteja, acúmulo 2D e um Playground estático.

## Teste local

```bash
npm run build
npx vite --host 127.0.0.1 --port 4173
```

Abra `http://127.0.0.1:4173/docs/` para comparar chuva, neve e granizo.

## Como contribuir

Veja [CONTRIBUTING.md](CONTRIBUTING.md) para detalhes de build e testes.

## Licença

MIT
