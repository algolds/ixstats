/** jsdom has no ResizeObserver, which Radix sliders and scroll areas measure with. Call in `beforeAll`. */
export function stubResizeObserver() {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
