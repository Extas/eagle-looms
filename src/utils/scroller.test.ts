import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Scroller } from "./scroller";

describe("Scroller", () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extends an active scroll in the same direction and resolves one promise", async () => {
    const element = scrollElement();
    const scroller = new Scroller(element, 2);
    const onScrolled = vi.fn();
    scroller.onScrolled = onScrolled;

    const first = scroller.scroll(4);
    const continued = scroller.scroll(2);

    expect(continued).toBe(first);
    flushFrames(frames);
    await first;
    expect(element.scrollTop).toBe(6);
    expect(onScrolled).toHaveBeenCalledTimes(3);
    expect(scroller.scrolling).toBe(false);
  });

  it("finishes the old scroll before changing direction", async () => {
    const element = scrollElement(10);
    const scroller = new Scroller(element, 2);
    const forward = scroller.scroll(10);

    frames.shift()?.(0);
    const reverse = scroller.scroll(-4);

    expect(reverse).not.toBe(forward);
    await forward;
    flushFrames(frames);
    await reverse;
    expect(element.scrollTop).toBe(8);
  });

  it("resolves a pending scroll when stopped", async () => {
    const element = scrollElement();
    const scroller = new Scroller(element, 2);
    const pending = scroller.scroll(20);

    scroller.stop();
    await pending;
    flushFrames(frames);
    expect(element.scrollTop).toBe(0);
    expect(scroller.scrolling).toBe(false);
  });
});

function scrollElement(scrollTop = 0): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperties(element, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 100 },
    scrollTop: { configurable: true, value: scrollTop, writable: true },
  });
  return element;
}

function flushFrames(frames: FrameRequestCallback[]): void {
  let count = 0;
  while (frames.length) {
    const callback = frames.shift()!;
    callback(count * 16);
    count += 1;
    if (count > 100) throw new Error("animation did not settle");
  }
}
