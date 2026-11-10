/**
 * Which slot a dragged photo lands in. Slots fill left to right, top to bottom; a photo can only
 * land on a slot that already holds a photo, so the set never gains a gap.
 */
export function photoDropTarget({
  index,
  count,
  columns,
  cellWidth,
  cellHeight,
  gap,
  dx,
  dy,
}: {
  index: number;
  count: number;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  gap: number;
  dx: number;
  dy: number;
}): number {
  'worklet';
  if (count <= 1 || cellWidth <= 0 || cellHeight <= 0) return index;
  const rows = Math.ceil(count / columns);
  const column = Math.min(
    columns - 1,
    Math.max(0, Math.round((index % columns) + dx / (cellWidth + gap))),
  );
  const row = Math.min(
    rows - 1,
    Math.max(0, Math.round(Math.floor(index / columns) + dy / (cellHeight + gap))),
  );
  return Math.min(count - 1, row * columns + column);
}
