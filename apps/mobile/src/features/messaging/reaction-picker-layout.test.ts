import { reactionPickerPosition } from './reaction-picker-layout';

const viewport = {
  width: 390,
  height: 844,
  menuWidth: 280,
  menuHeight: 104,
  topInset: 47,
  bottomInset: 34,
};
describe('anchored reaction menu', () => {
  it('aligns to either bubble edge, staying inside horizontal screen gutters', () => {
    expect(
      reactionPickerPosition({ ...viewport, anchor: { x: 260, y: 400, width: 114, height: 72 } }),
    ).toEqual({ left: 94, top: 288 });
    expect(
      reactionPickerPosition({ ...viewport, anchor: { x: 16, y: 400, width: 160, height: 72 } }),
    ).toEqual({ left: 16, top: 288 });
  });
  it('flips below a message near the top safe area', () => {
    expect(
      reactionPickerPosition({ ...viewport, anchor: { x: 16, y: 70, width: 200, height: 48 } }),
    ).toEqual({ left: 16, top: 126 });
  });
  it('clamps tall menus, offscreen anchors and keyboard-constrained viewports', () => {
    const result = reactionPickerPosition({
      ...viewport,
      height: 420,
      bottomInset: 0,
      menuHeight: 280,
      anchor: { x: -30, y: 820, width: 700, height: 600 },
    });
    expect(result).toEqual({ left: 94, top: 128 });
    expect(reactionPickerPosition({ ...viewport, anchor: null }).left).toBe(55);
  });
  it('keeps narrow and landscape layouts inside safe bounds', () => {
    const result = reactionPickerPosition({
      ...viewport,
      width: 280,
      height: 320,
      menuWidth: 248,
      topInset: 0,
      bottomInset: 21,
      anchor: { x: 0, y: 10, width: 400, height: 220 },
    });
    expect(result.left).toBe(16);
    expect(result.top).toBeGreaterThanOrEqual(12);
    expect(result.top + viewport.menuHeight).toBeLessThanOrEqual(287);
    const landscape = reactionPickerPosition({
      ...viewport,
      width: 844,
      height: 390,
      topInset: 0,
      bottomInset: 21,
      leftInset: 44,
      rightInset: 44,
      anchor: { x: 0, y: 200, width: 100, height: 40 },
    });
    expect(landscape.left).toBe(60);
  });
});
