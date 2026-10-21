import { colors } from './tokens';

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((value) => parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
function contrast(first: string, second: string) {
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
describe('readable visual tokens', () => {
  it('keeps normal-size filled action text above AA contrast', () => {
    expect(contrast(colors.white, colors.plum)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.white, colors.danger)).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps supporting text readable on the main surfaces', () => {
    expect(contrast(colors.muted, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.muted, colors.surface)).toBeGreaterThanOrEqual(4.5);
  });
});
