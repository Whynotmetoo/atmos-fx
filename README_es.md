# <img src="./docs/favicon.svg" width="36" height="36" align="center" alt="atmos-fx icon" /> atmos-fx
<div>
    <a href="README.md">English</a> · <a href="README_zh.md">简体中文</a> · <a href="README_ja.md">日本語</a> · <b>Español</b> · <a href="README_pt-BR.md">Português (Brasil)</a>
</div>
<br>
atmos-fx es una biblioteca de efectos atmosféricos que entiende la estructura del DOM. En lugar de limitarse a dibujar un fondo, integra lluvia, nieve y granizo con la interfaz: los elementos pueden verse como cristal, mantenerse opacos o convertirse en superficies físicas de colisión.

![demo-high](https://atmosfx.carsonye.com/assets/demo-high.gif)

> **Prueba la demo y el Playground en [https://atmosfx.carsonye.com/](https://atmosfx.carsonye.com/).**

[Instalación](#instalación) • [Inicio rápido](#inicio-rápido) • [Referencia de la API](#referencia-de-la-api) • [Recomendaciones de diseño](#recomendaciones-de-diseño)

## Instalación

```bash
npm i atmos-fx
```

## Inicio rápido

### React

Los componentes de React requieren React como peer dependency.

```tsx
import { AtmosFx, AtmosCard } from 'atmos-fx'

export function FunctionalDemo() {
  return (
    <AtmosFx preset="rain" density={0.7} className="functional-demo">
      <AtmosCard transMode="glass">
        <div>La lluvia choca con esta superficie y salpica en su borde.</div>
      </AtmosCard>

      {/* Evita un contenedor adicional */}
      <AtmosCard asChild transMode="solid">
        <button>Acción opaca</button>
      </AtmosCard>

      <AtmosCard transMode="opacity" opacity={0.64}>
        <span>Opacidad personalizada</span>
      </AtmosCard>
    </AtmosFx>
  )
}
```

### CDN

Con Vite, webpack u otro bundler, instala el paquete e importa la API principal:

```javascript
import { createAtmosphere } from 'atmos-fx'
```

En una página HTML sin proceso de build, puedes usar un CDN ESM:

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
    <h1>Superficie interactiva</h1>
    <p>La precipitación salpica aquí.</p>
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

// Si eliminas el elemento raíz fuera de React, destruye antes el controller:
// controller.destroy()
```

### Vue

```html
<template>
  <div ref="containerRef" id="container">
    <!-- Define superficies de cristal y colisión con atributos data -->
    <div data-atmos-collision data-atmos-glass>
      <h1>Superficie interactiva</h1>
      <p>La precipitación salpica aquí.</p>
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

## Referencia de la API

### Props de `AtmosFx`

| Prop | Tipo | Valor inicial | Descripción |
| --- | --- | --- | --- |
| `preset` | `'rain' \| 'snow' \| 'hail'` | `'rain'` | Elige un conjunto completo de valores físicos y visuales. En React, `mode` funciona como alias. |
| `particle` | `'rain' \| 'snow' \| 'hail'` | Hereda el preset | Cambia solo el tipo de partícula, sin sustituir speed, wind ni los demás valores del preset. |
| `density` | `number` | `0.65` | Controla las partículas por unidad de área. 0 las desactiva y 1 usa la tasa completa del quality activo. |
| `speed` | `number` | `1.0` | Multiplica la velocidad del movimiento y del ciclo de agua. Los valores negativos se convierten en 0. |
| `wind` | `number` | `-0.12` | Aplica movimiento horizontal: negativo hacia la izquierda y positivo hacia la derecha. |
| `color` | `string` | `'rgba(220, 235, 255, 0.72)'` | Acepta un color CSS válido para la precipitación y el agua. También respeta su canal alpha. |
| `quality` | `'auto' \| 'low' \| 'medium' \| 'high'` | `'auto'` | Los niveles manuales definen la tasa de partículas. `auto` comienza en medium y se adapta al rendimiento medido. |
| `autoScaleQuality` | `boolean` | `true` | Activa el ajuste automático de quality y DPR. Al desactivarlo, auto se mantiene en medium. |
| `transparency` | `'glass' \| 'opacity' \| 'none'` | `'glass'` | Define el modo de integración de la raíz; cada superficie se configura con `AtmosCard` o atributos data. |
| `alpha` | `number` | `0.08` | Base de opacidad del fondo de cristal, limitada al rango de `0` a `1`. |
| `opacity` | `number` | `0.72` | Opacidad de fondo por defecto de los elementos con `data-atmos-opacity`, limitada de `0` a `1`. |
| `bottomCollision` | `boolean` | `true` | Activa la colisión con el borde inferior del contenedor raíz. |
| `collisionSelector` | `string` | `[data-atmos-collision]` | Busca los objetivos DOM de colisión. Sus bordes superior y laterales, además de las esquinas redondeadas, afectan a las partículas de primer plano. |
| `solidSelector` | `string` | `[data-atmos-solid]` | Selecciona elementos que deben conservarse sólidos y sin la transparencia administrada por la biblioteca. |
| `liquidDripping` | `boolean` | `true` | Activa globalmente la condensación, reunión y caída del agua en el modo lluvia. |
| `liquidGatheringPoint` | `number` | Aleatorio estable por tarjeta | Fija el punto horizontal de reunión entre `0.33` y `0.66`. |
| `pauseWhenHidden` | `boolean` | `true` | Pausa la animación si el document queda oculto o la raíz sale del viewport. |
| `respectReducedMotion` | `boolean` | `true` | Respeta `prefers-reduced-motion` y detiene el efecto cuando el sistema lo solicita. |
| `injectStyles` | `boolean` | `true` | Inyecta los estilos base; desactívalo si cargas `atmos-fx/styles.css` por tu cuenta. |
| `styleNonce` | `string` | `''` | Nonce CSP aplicado al elemento style que se inyecta automáticamente. |

### Props de `AtmosCard`

| Prop | Tipo | Valor inicial | Descripción |
| --- | --- | --- | --- |
| `transMode` | `'glass' \| 'opacity' \| 'solid'` | `'glass'` | Alterna entre cristal, transparencia y estilo sólido. La tarjeta sigue siendo una superficie de colisión en los tres modos. |
| `liquidDripping` | `boolean` | `true` | Activa o desactiva la animación de agua en esta tarjeta. |
| `liquidGatheringPoint` | `number` | Heredado / aleatorio estable | Sobrescribe entre `0.33` y `0.66` el punto donde se reúne el agua de esta tarjeta. |
| `asChild` | `boolean` | `false` | Combina atributos y refs con un único hijo, sin crear un div adicional. |
| `opacity` | `number` | `0.72` | Opacidad de fondo del card cuando `transMode="opacity"`; no afecta a glass ni solid. |
| `alpha` | `number` | `0.08` | Opacidad de fondo del card cuando `transMode="glass"`; no afecta a opacity ni solid. |

### Opciones de `createAtmosphere` en Vanilla JS

`createAtmosphere(element, options)` devuelve un controller con `start()`, `stop()`, `pause()`, `resume()`, `resize()`, `update(options)` y `destroy()`.

`options` acepta los mismos valores que `AtmosFx`, excepto el alias `mode` de React.

#### Atributos data para los elementos internos

- `data-atmos-solid`: conserva el elemento sólido y sin el efecto de cristal.
- `data-atmos-opacity="0.72"`: define una opacidad de fondo específica para ese elemento.
- `data-atmos-alpha="0.08"`: define una opacidad de cristal (alpha) específica para ese elemento.
- `data-atmos-glass`: aplica la superficie de cristal incluida.
- `data-atmos-collision`: convierte el elemento en una superficie de colisión superior y lateral.
- `data-atmos-liquid-dripping="true"`: controla la condensación y caída de agua de esa superficie en modo lluvia.
- `data-atmos-liquid-gathering-point="0.5"`: sitúa el punto de reunión entre `0.33` y `0.66`.

## Recomendaciones de diseño

- **Capas y agua**: la precipitación se dibuja en primer plano y fondo. Las partículas de primer plano chocan con las tarjetas y el agua desprendida puede caer sobre otras superficies inferiores.
- **Gathering según el ancho**: las tarjetas más anchas tardan más en reunir el agua (`1250ms + 2.8ms × píxel CSS`, con un máximo de `5500ms`; una tarjeta de `300px` tarda `2090ms`). Las fases posteriores conservan una duración fija.
- **Evita superficies demasiado anchas**: una tarjeta muy ancha actúa como un paraguas y deja menos lluvia para las superficies inferiores.
- **No anides tarjetas sin una razón visual clara**: los límites de colisión pueden solaparse y producir movimientos poco naturales.
- **Modos de `transMode`**:
  - `glass`: cristal esmerilado con desenfoque de fondo.
  - `opacity`: mezcla semitransparente basada en CSS opacity.
  - `solid`: conserva el estilo opaco del elemento sin transparencia administrada.

## Rendimiento

- `quality: 'auto'` es la opción recomendada. El área cambia el total de partículas, no el nivel de quality.
- El renderer usa WebGL y, si no puede inicializarlo, cambia silenciosamente a un Canvas 2D dummy que no dibuja el efecto.
- Las superficies transparentes dejan ver las partículas de fondo mientras las de primer plano siguen chocando con el DOM.
- La física usa el AABB de cada objetivo. Un elemento rotado colisiona con su rectángulo exterior, no con su silueta visual.
- La nieve y el granizo acumulados usan pools limitados cuya capacidad depende de quality y density.
- Mantén `respectReducedMotion` activado en producción.

## Desarrollo

```bash
npm install
npm run typecheck
npm run build
npm test
```

La implementación actual incluye renderers WebGL para lluvia, nieve y granizo, quality adaptativo, superficies de cristal, colisiones superiores y laterales con esquinas redondeadas, agua que se reúne y cae, acumulación 2D y un Playground estático.

## Prueba local

```bash
npm run build
npx vite --host 127.0.0.1 --port 4173
```

Abre `http://127.0.0.1:4173/docs/` para comparar lluvia, nieve y granizo.

## Contribuir

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para conocer el flujo de build y pruebas.

## Licencia

MIT
