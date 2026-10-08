/**
 * Icons from the Lucide set (https://lucide.dev, ISC license), drawn on a 24 x 24 grid with a
 * 2 px stroke. They are inlined instead of loading a package so the app stays local-first and
 * only ships the icons it uses.
 */
export type IconShape =
  | { readonly kind: 'path'; readonly d: string }
  | { readonly kind: 'circle'; readonly cx: number; readonly cy: number; readonly r: number }
  | {
      readonly kind: 'rect';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly rx: number;
    };

const path = (d: string): IconShape => ({ kind: 'path', d });
const circle = (cx: number, cy: number, r: number): IconShape => ({ kind: 'circle', cx, cy, r });
const rect = (x: number, y: number, width: number, height: number, rx: number): IconShape => ({
  kind: 'rect',
  x,
  y,
  width,
  height,
  rx,
});

export const ICONS = {
  bike: [
    circle(18.5, 17.5, 3.5),
    circle(5.5, 17.5, 3.5),
    circle(15, 5, 1),
    path('M12 17.5V14l-3-3 4-3 2 3h2'),
  ],
  calendar: [path('M8 2v4'), path('M16 2v4'), rect(3, 4, 18, 18, 2), path('M3 10h18')],
  check: [path('M20 6 9 17l-5-5')],
  'chevron-down': [path('m6 9 6 6 6-6')],
  'chevron-left': [path('m15 18-6-6 6-6')],
  'chevron-right': [path('m9 18 6-6-6-6')],
  copy: [rect(8, 8, 14, 14, 2), path('M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2')],
  ellipsis: [circle(12, 12, 1), circle(19, 12, 1), circle(5, 12, 1)],
  'grip-vertical': [
    circle(9, 12, 1),
    circle(9, 5, 1),
    circle(9, 19, 1),
    circle(15, 12, 1),
    circle(15, 5, 1),
    circle(15, 19, 1),
  ],
  layers: [
    path(
      'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z',
    ),
    path('M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.66 0l8.58-3.9A1 1 0 0 0 22 12'),
    path('M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.66 0l8.58-3.9A1 1 0 0 0 22 17'),
  ],
  'loader-circle': [path('M21 12a9 9 0 1 1-6.219-8.56')],
  plus: [path('M5 12h14'), path('M12 5v14')],
  search: [circle(11, 11, 8), path('m21 21-4.3-4.3')],
  'trash-2': [
    path('M3 6h18'),
    path('M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'),
    path('M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'),
    path('M10 11v6'),
    path('M14 11v6'),
  ],
  user: [path('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'), circle(12, 7, 4)],
  x: [path('M18 6 6 18'), path('m6 6 12 12')],
  zap: [
    path(
      'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z',
    ),
  ],
} as const satisfies Record<string, readonly IconShape[]>;

export type IconName = keyof typeof ICONS;
