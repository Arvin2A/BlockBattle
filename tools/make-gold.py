# BlockBattle — Copyright (C) 2026 Arvin Zaman
# Original source: https://github.com/Arvin2A/BlockBattle
# Licensed under the GNU GPL v3 only. See LICENSE.

import argparse
import colorsys
from PIL import Image

DARK = (88, 59, 15)
MID = (160, 118, 34)
BRIGHT = (240, 200, 89)
MID_T = 0.47
GRAY_RANGE = (0.0, 0.80)
MAIN_RANGE = (0.30, 0.55)
ACCENT_RANGE = (0.65, 1.0)
GRAY_SPREAD = 20
HUE_BUCKETS = 12
STREAK_BOOST = 28
STREAK_RADIUS = 3


def lum(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


def group_of(r, g, b):
    if max(r, g, b) - min(r, g, b) < GRAY_SPREAD:
        return 'gray'
    hue = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[0]
    return int(hue * HUE_BUCKETS) % HUE_BUCKETS


def ramp(t):
    if t <= MID_T:
        a, b, k = DARK, MID, t / MID_T
    else:
        a, b, k = MID, BRIGHT, (t - MID_T) / (1 - MID_T)
    return tuple(round(a[i] + (b[i] - a[i]) * k) for i in range(3))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('src')
    parser.add_argument('dst')
    parser.add_argument('--frame', nargs=2, type=int, metavar=('W', 'H'))
    parser.add_argument('--no-streak', action='store_true')
    args = parser.parse_args()

    img = Image.open(args.src).convert('RGBA')
    px = img.load()
    width, height = img.size
    frame_w, frame_h = args.frame or (width, height)

    groups = {}
    bounds = {}
    counts = {}
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            group = group_of(r, g, b)
            groups[(x, y)] = group
            value = lum(r, g, b)
            low, high = bounds.get(group, (value, value))
            bounds[group] = (min(low, value), max(high, value))
            if a >= 200:
                counts[group] = counts.get(group, 0) + 1

    colored = [group for group in counts if group != 'gray']
    main_group = max(colored, key=counts.get) if colored else None

    out = Image.new('RGBA', img.size)
    po = out.load()
    for (x, y), group in groups.items():
        r, g, b, a = px[x, y]
        low, high = bounds[group]
        shade = (lum(r, g, b) - low) / (high - low) if high > low else 0.5
        start, end = GRAY_RANGE if group == 'gray' else MAIN_RANGE if group == main_group else ACCENT_RANGE
        po[x, y] = ramp(start + (end - start) * shade) + (a,)

    if not args.no_streak and main_group is not None:
        base = out.copy()
        pb = base.load()
        for fy in range(0, height, frame_h):
            for fx in range(0, width, frame_w):
                cells = [(x, y) for (x, y), group in groups.items()
                         if group == main_group and fx <= x < fx + frame_w and fy <= y < fy + frame_h and pb[x, y][3] >= 200]
                if not cells:
                    continue
                cx = sum(x for x, _ in cells) / len(cells) - fx
                cy = sum(y for _, y in cells) / len(cells) - fy
                line = round(cx - cy)
                for x, y in cells:
                    if (x - fx) - (y - fy) != line:
                        continue
                    near = [pb[nx, ny]
                            for nx in range(max(0, x - STREAK_RADIUS), min(width, x + STREAK_RADIUS + 1))
                            for ny in range(max(0, y - STREAK_RADIUS), min(height, y + STREAK_RADIUS + 1))
                            if pb[nx, ny][3] > 0]
                    po[x, y] = tuple(min(255, max(p[i] for p in near) + STREAK_BOOST) for i in range(3)) + (pb[x, y][3],)

    out.save(args.dst)
    print(f'saved {args.dst}')


if __name__ == '__main__':
    main()
