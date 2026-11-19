/**
 * Where the team faces, the project name and the forecast sit on the new project card, in art pixels from the card's
 * top left. One place for the drawing code and for the test that checks nothing lands under anything else.
 *
 * Wide card: the pickers fill the left column and the project name sits under them. The right column reads top to
 * bottom: forecast, who builds, start. Narrow card: one column, pickers, who builds, name, forecast, start.
 */

/** one face tile and its gap */
export const FACE_PITCH = 19;
export const FACE_ROW_H = 24;
export const FACE_H = 22;
/** the START button sits this far above the card's bottom edge */
export const START_FROM_BOTTOM = 26;
export const START_H = 20;
export const NAME_H = 14;

export interface WizardRows {
  faceRows: number;
  perRow: number;
  faceX: number;
  teamY: number;
  faceY: number;
  nameX: number;
  nameY: number;
  /** width of the column the name row sits in */
  nameW: number;
  /** top of the forecast block */
  fy: number;
  /** height the card asks for, before the screen clamps it */
  want: number;
}

export function wizardRows(wide: boolean, staff: number, lw: number, rx: number, rw: number): WizardRows {
  const rowsFor = (width: number) => {
    const perRow = Math.max(1, Math.floor((width - 4) / FACE_PITCH));
    return { perRow, faceRows: Math.max(1, Math.ceil(staff / perRow)) };
  };
  if (wide) {
    return { ...rowsFor(rw), faceX: rx, teamY: 124, faceY: 134, nameX: 6, nameY: 192, nameW: lw, fy: 21, want: 246 };
  }
  const { perRow, faceRows } = rowsFor(lw);
  const nameY = 200 + faceRows * FACE_ROW_H + 2;
  const fy = nameY + 20;
  return { perRow, faceRows, faceX: 6, teamY: 190, faceY: 200, nameX: 6, nameY, nameW: rw, fy, want: 372 + (fy - 246) };
}

/** Where the forecast block's last text line ends, so the START button can be kept clear of it. */
export const FORECAST_NOTE_BOTTOM = 89 + 8;
