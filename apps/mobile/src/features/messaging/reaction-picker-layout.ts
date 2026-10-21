export interface MessageAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function reactionPickerPosition({
  anchor,
  width,
  height,
  menuWidth,
  menuHeight,
  topInset,
  bottomInset,
  leftInset = 0,
  rightInset = 0,
}: {
  anchor: MessageAnchor | null;
  width: number;
  height: number;
  menuWidth: number;
  menuHeight: number;
  topInset: number;
  bottomInset: number;
  leftInset?: number;
  rightInset?: number;
}) {
  const top = topInset + 12;
  const bottom = Math.max(top, height - bottomInset - menuHeight - 12);
  const rightAligned = anchor !== null && anchor.x + anchor.width / 2 > width / 2;
  const x =
    anchor === null
      ? (width - menuWidth) / 2
      : rightAligned
        ? anchor.x + anchor.width - menuWidth
        : anchor.x;
  const above = (anchor?.y ?? height / 2) - menuHeight - 8;
  const below = (anchor?.y ?? height / 2) + (anchor?.height ?? 0) + 8;
  const preferred = above >= top ? above : below <= bottom ? below : above;
  return {
    left: Math.max(leftInset + 16, Math.min(x, width - rightInset - menuWidth - 16)),
    top: Math.max(top, Math.min(preferred, bottom)),
  };
}
