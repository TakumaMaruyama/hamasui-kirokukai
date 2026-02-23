from __future__ import annotations

import math
import random
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = (2480, 3508)  # A4 at 300dpi
DPI = (300, 300)

ROOT_DIR = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = ROOT_DIR / "public" / "pdf-templates"
VARIANT_DIR = TEMPLATE_DIR / "variants"
ACTIVE_VARIANT = "adventure"


def blend_color(start: tuple[int, int, int], end: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        int(start[0] + (end[0] - start[0]) * t),
        int(start[1] + (end[1] - start[1]) * t),
        int(start[2] + (end[2] - start[2]) * t),
    )


def new_gradient_canvas(top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    canvas = Image.new("RGBA", SIZE, (255, 255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    height = SIZE[1]

    for y in range(height):
        t = y / max(height - 1, 1)
        draw.line([(0, y), (SIZE[0], y)], fill=blend_color(top, bottom, t) + (255,), width=1)

    return canvas


def draw_star(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    outer_radius: int,
    inner_radius: int,
    fill: tuple[int, int, int, int],
) -> None:
    points: list[tuple[float, float]] = []
    for i in range(10):
        angle = -math.pi / 2 + i * math.pi / 5
        radius = outer_radius if i % 2 == 0 else inner_radius
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    draw.polygon(points, fill=fill)


def draw_top_wave(
    draw: ImageDraw.ImageDraw,
    baseline: int,
    amplitude: int,
    wavelength: int,
    fill: tuple[int, int, int, int],
) -> None:
    points: list[tuple[float, float]] = [(0, 0)]
    step = 28
    for x in range(0, SIZE[0] + step, step):
        y = baseline + math.sin((x / wavelength) * math.tau) * amplitude
        points.append((x, y))
    points.append((SIZE[0], 0))
    draw.polygon(points, fill=fill)


def draw_bottom_wave(
    draw: ImageDraw.ImageDraw,
    baseline: int,
    amplitude: int,
    wavelength: int,
    fill: tuple[int, int, int, int],
) -> None:
    points: list[tuple[float, float]] = [(0, SIZE[1])]
    step = 28
    for x in range(0, SIZE[0] + step, step):
        y = baseline + math.sin((x / wavelength) * math.tau) * amplitude
        points.append((x, y))
    points.append((SIZE[0], SIZE[1]))
    draw.polygon(points, fill=fill)


def draw_fish(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    size: int,
    color: tuple[int, int, int, int],
    flip: bool = False,
) -> None:
    direction = -1 if flip else 1
    body = [
        (x, y),
        (x + direction * int(size * 0.8), y - int(size * 0.35)),
        (x + direction * int(size * 1.45), y),
        (x + direction * int(size * 0.8), y + int(size * 0.35)),
    ]
    tail = [
        (x + direction * int(size * 1.45), y),
        (x + direction * int(size * 1.95), y - int(size * 0.5)),
        (x + direction * int(size * 1.95), y + int(size * 0.5)),
    ]
    eye = (x + direction * int(size * 0.2), y - int(size * 0.08))

    draw.polygon(body, fill=color)
    draw.polygon(tail, fill=color)
    draw.ellipse(
        (eye[0] - 5, eye[1] - 5, eye[0] + 5, eye[1] + 5),
        fill=(255, 255, 255, 230),
    )


def draw_confetti(
    draw: ImageDraw.ImageDraw,
    bounds: tuple[int, int, int, int],
    count: int,
    palette: list[tuple[int, int, int, int]],
    seed: int,
) -> None:
    rng = random.Random(seed)
    left, top, right, bottom = bounds
    for _ in range(count):
        x = rng.randint(left, right)
        y = rng.randint(top, bottom)
        w = rng.randint(16, 42)
        h = rng.randint(8, 28)
        color = palette[rng.randint(0, len(palette) - 1)]
        if rng.random() > 0.5:
            draw.rectangle((x, y, x + w, y + h), fill=color)
        else:
            draw.ellipse((x, y, x + w, y + h), fill=color)


def draw_record_panel(draw: ImageDraw.ImageDraw, palette: dict[str, tuple[int, int, int, int]]) -> None:
    panel = (250, 680, 2230, 3230)
    name_box = (440, 850, 1655, 1200)
    grade_box = (1680, 850, 2180, 1200)
    header_box = (600, 1330, 2260, 1450)
    table_box = (600, 1450, 2260, 2370)
    issue_box = (820, 2860, 1660, 3050)

    draw.rounded_rectangle(
        (panel[0] + 10, panel[1] + 12, panel[2] + 10, panel[3] + 12),
        radius=92,
        fill=(0, 0, 0, 38),
    )
    draw.rounded_rectangle(panel, radius=92, fill=(255, 255, 255, 245), outline=palette["panel"], width=8)

    draw.rounded_rectangle(name_box, radius=46, fill=palette["soft"], outline=palette["accent"], width=6)
    draw.rounded_rectangle(grade_box, radius=46, fill=palette["soft"], outline=palette["accent"], width=6)

    draw.rounded_rectangle(header_box, radius=34, fill=palette["header"], outline=palette["accent"], width=6)
    draw.rounded_rectangle(table_box, radius=36, fill=(255, 255, 255, 248), outline=palette["line"], width=5)
    draw.rounded_rectangle(issue_box, radius=32, fill=palette["soft"], outline=palette["accent"], width=5)

    split_x = 1510
    draw.line((split_x, header_box[1], split_x, table_box[3]), fill=palette["line"], width=5)

    row_step = (table_box[3] - table_box[1]) / 7
    for i in range(1, 7):
        y = int(table_box[1] + row_step * i)
        draw.line((table_box[0], y, table_box[2], y), fill=palette["line"], width=3)


def draw_prize_panel(draw: ImageDraw.ImageDraw, palette: dict[str, tuple[int, int, int, int]]) -> None:
    panel = (250, 620, 2230, 3230)
    name_box = (430, 1220, 2050, 1710)
    meta_box = (560, 1850, 1920, 2015)
    event_box = (420, 2140, 2060, 2360)
    time_box = (520, 2430, 1960, 2630)
    issue_box = (860, 2880, 1620, 3060)

    draw.rounded_rectangle(
        (panel[0] + 10, panel[1] + 12, panel[2] + 10, panel[3] + 12),
        radius=92,
        fill=(0, 0, 0, 38),
    )
    draw.rounded_rectangle(panel, radius=92, fill=(255, 255, 255, 245), outline=palette["panel"], width=8)

    draw.rounded_rectangle(name_box, radius=58, fill=(255, 255, 255, 252), outline=palette["accent"], width=7)
    draw.rounded_rectangle(meta_box, radius=30, fill=palette["soft"], outline=palette["accent"], width=5)
    draw.rounded_rectangle(event_box, radius=34, fill=palette["soft"], outline=palette["accent"], width=6)
    draw.rounded_rectangle(time_box, radius=34, fill=palette["soft"], outline=palette["accent"], width=6)
    draw.rounded_rectangle(issue_box, radius=30, fill=palette["soft"], outline=palette["accent"], width=5)


def add_medal(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int) -> None:
    draw.polygon(
        [
            (cx - 52, cy - radius - 130),
            (cx - 14, cy - radius - 26),
            (cx - 90, cy - radius - 26),
        ],
        fill=(39, 122, 223, 220),
    )
    draw.polygon(
        [
            (cx + 52, cy - radius - 130),
            (cx + 14, cy - radius - 26),
            (cx + 90, cy - radius - 26),
        ],
        fill=(29, 178, 232, 220),
    )
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(255, 217, 94, 255), outline=(240, 166, 34, 255), width=12)
    draw.ellipse((cx - radius + 26, cy - radius + 26, cx + radius - 26, cy + radius - 26), outline=(255, 244, 171, 240), width=8)
    draw_star(draw, cx, cy, 36, 16, (255, 247, 191, 255))


def add_laurel(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int, color: tuple[int, int, int, int], side: str) -> None:
    if side not in {"left", "right"}:
        return
    start_angle = math.radians(152) if side == "left" else math.radians(28)
    direction = -1 if side == "left" else 1
    for i in range(12):
        angle = start_angle + direction * i * math.radians(10)
        x = cx + math.cos(angle) * radius
        y = cy + math.sin(angle) * radius
        draw.ellipse((x - 16, y - 10, x + 16, y + 10), fill=color)


def draw_adventure_record() -> Image.Image:
    image = new_gradient_canvas((145, 224, 255), (19, 151, 223))
    draw = ImageDraw.Draw(image, "RGBA")

    draw_top_wave(draw, baseline=360, amplitude=34, wavelength=420, fill=(197, 239, 255, 190))
    draw_bottom_wave(draw, baseline=3340, amplitude=42, wavelength=450, fill=(3, 127, 187, 210))
    draw_bottom_wave(draw, baseline=3415, amplitude=36, wavelength=360, fill=(3, 103, 159, 255))

    for i, y in enumerate(range(420, 3270, 320)):
        draw.ellipse((90, y, 240, y + 150), outline=(238, 252, 255, 180), width=6)
        draw.ellipse((2260, y + 80, 2380, y + 200), outline=(233, 250, 255, 170), width=5)
        if i % 2 == 0:
            draw.ellipse((180, y + 200, 260, y + 280), outline=(233, 250, 255, 150), width=4)

    draw_fish(draw, 230, 940, 70, (255, 236, 153, 220), flip=False)
    draw_fish(draw, 2180, 1090, 66, (255, 236, 153, 210), flip=True)
    draw_fish(draw, 250, 2520, 72, (255, 215, 136, 210), flip=False)
    draw_fish(draw, 2150, 2730, 68, (255, 215, 136, 205), flip=True)

    for (x, y, o, i) in [
        (355, 520, 30, 12),
        (2080, 560, 26, 10),
        (430, 3030, 34, 13),
        (2050, 2980, 30, 12),
    ]:
        draw_star(draw, x, y, o, i, (255, 244, 183, 230))

    draw_record_panel(
        draw,
        {
            "panel": (26, 124, 182, 255),
            "accent": (20, 141, 207, 255),
            "header": (204, 240, 255, 255),
            "soft": (236, 249, 255, 255),
            "line": (137, 205, 232, 255),
        },
    )
    return image


def draw_adventure_prize() -> Image.Image:
    image = new_gradient_canvas((147, 227, 255), (15, 146, 214))
    draw = ImageDraw.Draw(image, "RGBA")

    draw_top_wave(draw, baseline=390, amplitude=38, wavelength=420, fill=(197, 239, 255, 190))
    draw_bottom_wave(draw, baseline=3345, amplitude=46, wavelength=430, fill=(3, 127, 187, 205))
    draw_bottom_wave(draw, baseline=3420, amplitude=34, wavelength=320, fill=(3, 103, 159, 255))

    draw_confetti(
        draw,
        bounds=(220, 210, 2260, 1180),
        count=90,
        palette=[
            (255, 244, 187, 220),
            (255, 220, 118, 220),
            (192, 245, 255, 210),
            (173, 224, 255, 220),
        ],
        seed=108,
    )
    add_medal(draw, cx=2040, cy=470, radius=130)

    for (x, y, o, i) in [(360, 460, 30, 12), (560, 330, 24, 10), (2050, 1040, 22, 9)]:
        draw_star(draw, x, y, o, i, (255, 248, 204, 235))

    draw_prize_panel(
        draw,
        {
            "panel": (26, 124, 182, 255),
            "accent": (20, 141, 207, 255),
            "soft": (236, 249, 255, 255),
        },
    )
    return image


def draw_medal_record() -> Image.Image:
    image = new_gradient_canvas((255, 244, 190), (255, 195, 144))
    draw = ImageDraw.Draw(image, "RGBA")

    draw.rectangle((0, 0, 320, SIZE[1]), fill=(255, 166, 122, 135))
    draw.rectangle((SIZE[0] - 320, 0, SIZE[0], SIZE[1]), fill=(255, 166, 122, 135))

    for y in range(200, 3400, 230):
        draw.polygon([(0, y), (170, y + 115), (0, y + 230)], fill=(255, 214, 170, 120))
        draw.polygon(
            [(SIZE[0], y), (SIZE[0] - 170, y + 115), (SIZE[0], y + 230)],
            fill=(255, 214, 170, 120),
        )

    add_laurel(draw, cx=1240, cy=500, radius=320, color=(97, 174, 92, 205), side="left")
    add_laurel(draw, cx=1240, cy=500, radius=320, color=(97, 174, 92, 205), side="right")
    draw.ellipse((1090, 310, 1390, 610), fill=(255, 207, 90, 255), outline=(230, 150, 40, 255), width=12)
    draw_star(draw, 1240, 460, 70, 30, (255, 246, 186, 240))

    draw_record_panel(
        draw,
        {
            "panel": (237, 132, 47, 255),
            "accent": (231, 103, 70, 255),
            "header": (255, 233, 187, 255),
            "soft": (255, 247, 227, 255),
            "line": (241, 198, 133, 255),
        },
    )

    draw_confetti(
        draw,
        bounds=(350, 2420, 2140, 3260),
        count=65,
        palette=[
            (255, 187, 120, 205),
            (255, 214, 143, 205),
            (250, 154, 129, 215),
            (255, 241, 207, 210),
        ],
        seed=219,
    )
    return image


def draw_medal_prize() -> Image.Image:
    image = new_gradient_canvas((255, 244, 189), (255, 186, 137))
    draw = ImageDraw.Draw(image, "RGBA")

    draw.rectangle((0, 0, 320, SIZE[1]), fill=(255, 166, 122, 135))
    draw.rectangle((SIZE[0] - 320, 0, SIZE[0], SIZE[1]), fill=(255, 166, 122, 135))
    draw.polygon([(470, 170), (620, 520), (770, 170)], fill=(242, 92, 70, 220))
    draw.polygon([(1710, 170), (1860, 520), (2010, 170)], fill=(66, 134, 231, 220))

    add_laurel(draw, cx=1240, cy=600, radius=360, color=(97, 174, 92, 210), side="left")
    add_laurel(draw, cx=1240, cy=600, radius=360, color=(97, 174, 92, 210), side="right")
    draw.ellipse((1030, 290, 1450, 710), fill=(255, 208, 96, 255), outline=(228, 145, 33, 255), width=14)
    draw.ellipse((1108, 368, 1372, 632), fill=(255, 240, 176, 250))
    draw_star(draw, 1240, 500, 94, 40, (255, 198, 52, 255))

    draw_prize_panel(
        draw,
        {
            "panel": (237, 132, 47, 255),
            "accent": (231, 103, 70, 255),
            "soft": (255, 247, 227, 255),
        },
    )

    draw_confetti(
        draw,
        bounds=(260, 180, 2240, 1260),
        count=110,
        palette=[
            (255, 190, 115, 220),
            (245, 102, 83, 220),
            (104, 160, 242, 220),
            (255, 234, 177, 215),
        ],
        seed=456,
    )
    return image


def draw_hero_record() -> Image.Image:
    image = new_gradient_canvas((155, 246, 228), (67, 175, 255))
    draw = ImageDraw.Draw(image, "RGBA")

    square = 120
    for y in range(0, SIZE[1], square):
        for x in range(0, SIZE[0], square):
            if (x // square + y // square) % 2 == 0:
                draw.rectangle((x, y, x + square, y + square), fill=(255, 255, 255, 35))

    center = (1240, 420)
    for angle in range(-85, 266, 9):
        r1 = 200
        r2 = 2100
        rad = math.radians(angle)
        start = (center[0] + math.cos(rad) * r1, center[1] + math.sin(rad) * r1)
        end = (center[0] + math.cos(rad) * r2, center[1] + math.sin(rad) * r2)
        draw.line((start[0], start[1], end[0], end[1]), fill=(255, 255, 255, 82), width=6)

    draw.polygon([(190, 500), (400, 430), (340, 660), (510, 740), (220, 870), (290, 650)], fill=(255, 242, 120, 220))
    draw.polygon([(2160, 680), (1960, 780), (2030, 980), (1840, 1020), (2050, 1230), (2020, 940)], fill=(255, 242, 120, 220))

    draw.ellipse((210, 2390, 640, 2670), fill=(255, 255, 255, 208), outline=(43, 126, 217, 215), width=8)
    draw.polygon([(520, 2570), (690, 2640), (540, 2690)], fill=(255, 255, 255, 208), outline=(43, 126, 217, 215))
    draw.ellipse((1840, 2580, 2260, 2840), fill=(255, 255, 255, 208), outline=(43, 126, 217, 215), width=8)
    draw.polygon([(1960, 2820), (1830, 2940), (2050, 2890)], fill=(255, 255, 255, 208), outline=(43, 126, 217, 215))

    draw_record_panel(
        draw,
        {
            "panel": (59, 121, 226, 255),
            "accent": (41, 146, 210, 255),
            "header": (213, 239, 255, 255),
            "soft": (241, 250, 255, 255),
            "line": (152, 198, 238, 255),
        },
    )
    return image


def draw_hero_prize() -> Image.Image:
    image = new_gradient_canvas((165, 246, 228), (62, 168, 255))
    draw = ImageDraw.Draw(image, "RGBA")

    square = 120
    for y in range(0, SIZE[1], square):
        for x in range(0, SIZE[0], square):
            if (x // square + y // square) % 2 == 0:
                draw.rectangle((x, y, x + square, y + square), fill=(255, 255, 255, 32))

    center = (1240, 340)
    for angle in range(-85, 266, 8):
        r1 = 240
        r2 = 2160
        rad = math.radians(angle)
        start = (center[0] + math.cos(rad) * r1, center[1] + math.sin(rad) * r1)
        end = (center[0] + math.cos(rad) * r2, center[1] + math.sin(rad) * r2)
        draw.line((start[0], start[1], end[0], end[1]), fill=(255, 255, 255, 86), width=7)

    draw.ellipse((1020, 210, 1460, 650), fill=(255, 94, 88, 240), outline=(197, 56, 61, 255), width=12)
    draw.ellipse((1100, 290, 1380, 570), fill=(255, 233, 91, 245))
    draw_star(draw, 1240, 430, 95, 40, (255, 111, 98, 250))

    draw_confetti(
        draw,
        bounds=(270, 180, 2220, 1120),
        count=95,
        palette=[
            (255, 233, 92, 230),
            (255, 124, 109, 225),
            (83, 175, 255, 225),
            (255, 255, 255, 200),
        ],
        seed=812,
    )

    draw_prize_panel(
        draw,
        {
            "panel": (59, 121, 226, 255),
            "accent": (41, 146, 210, 255),
            "soft": (241, 250, 255, 255),
        },
    )
    return image


def save_template(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(path, format="PNG", dpi=DPI, optimize=True)


def render_variant(name: str) -> None:
    if name == "adventure":
        record = draw_adventure_record()
        prize = draw_adventure_prize()
    elif name == "medal-fes":
        record = draw_medal_record()
        prize = draw_medal_prize()
    elif name == "swim-hero":
        record = draw_hero_record()
        prize = draw_hero_prize()
    else:
        raise ValueError(f"Unsupported variant: {name}")

    target = VARIANT_DIR / name
    save_template(record, target / "record-certificate.png")
    save_template(prize, target / "first-prize-certificate.png")


def activate_variant(name: str) -> None:
    source = VARIANT_DIR / name
    TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source / "record-certificate.png", TEMPLATE_DIR / "record-certificate.png")
    shutil.copyfile(source / "first-prize-certificate.png", TEMPLATE_DIR / "first-prize-certificate.png")


def main() -> None:
    variants = ["adventure", "medal-fes", "swim-hero"]
    for variant in variants:
        render_variant(variant)
    activate_variant(ACTIVE_VARIANT)
    print(f"Generated variants: {', '.join(variants)}")
    print(f"Active variant: {ACTIVE_VARIANT}")


if __name__ == "__main__":
    main()
