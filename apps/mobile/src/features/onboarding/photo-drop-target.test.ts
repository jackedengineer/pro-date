import { photoDropTarget } from './photo-drop-target';

const grid = { count: 5, columns: 2, cellWidth: 160, cellHeight: 200, gap: 16 };

describe('photoDropTarget', () => {
  it('stays put for a small nudge', () => {
    expect(photoDropTarget({ ...grid, index: 2, dx: 40, dy: -60 })).toBe(2);
  });

  it('moves across a row and down a column', () => {
    expect(photoDropTarget({ ...grid, index: 0, dx: 176, dy: 0 })).toBe(1);
    expect(photoDropTarget({ ...grid, index: 0, dx: 0, dy: 216 })).toBe(2);
    expect(photoDropTarget({ ...grid, index: 3, dx: -176, dy: -216 })).toBe(0);
  });

  it('never lands on an empty slot or outside the grid', () => {
    // Slot 5 (row 2, column 1) is empty when there are five photos.
    expect(photoDropTarget({ ...grid, index: 3, dx: 0, dy: 216 })).toBe(4);
    expect(photoDropTarget({ ...grid, index: 0, dx: -900, dy: -900 })).toBe(0);
    expect(photoDropTarget({ ...grid, index: 4, dx: 900, dy: 900 })).toBe(4);
  });

  it('does nothing with one photo or an unmeasured grid', () => {
    expect(photoDropTarget({ ...grid, count: 1, index: 0, dx: 300, dy: 300 })).toBe(0);
    expect(photoDropTarget({ ...grid, cellWidth: 0, index: 1, dx: 300, dy: 0 })).toBe(1);
  });
});
