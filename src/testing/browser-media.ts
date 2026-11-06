// jsdom does not implement matchMedia. This browser adapter is used only by component tests.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: (query: string) => ({
    matches: false, media: query, onchange: null, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
  }) });
}
