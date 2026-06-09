# Accessibility and Motion

atoms-fx is decorative by default. It should enhance an interface without becoming required to understand or operate it.

## Reduced Motion

Keep `respectReducedMotion` enabled in production unless the host application already handles motion preferences at a higher level.

```ts
const controller = createAtmosphere(root, {
  preset: 'rain',
  respectReducedMotion: true,
})
```

When the user prefers reduced motion, the engine automatically avoids running the animation loop.

## Visibility and Battery

Keep `pauseWhenHidden` enabled for normal page usage. The controller pauses while the owning document is hidden and resumes when it becomes visible again.

```ts
createAtmosphere(root, {
  pauseWhenHidden: true,
})
```

## Content Readability

- Prefer `transparency: 'glass'` for panels over reducing opacity on large text blocks.
- Mark critical controls with `data-atoms-opaque`.
- Use `data-atoms-opacity` sparingly and verify text contrast after applying it.
- Keep weather colors subtle when content appears above the canvas.

## Interaction

The canvas layer is pointer-events disabled, so it should not block pointer or touch input. Do not attach essential application behavior to the generated canvas.

## Testing Guidance

Before shipping a page that uses atoms-fx:

- Test with the operating system reduced-motion setting enabled.
- Test keyboard focus states on controls inside the atmosphere root.
- Verify text contrast in glass and opacity modes.
- Check a narrow viewport where particle density and content overlap are most likely to compete.
