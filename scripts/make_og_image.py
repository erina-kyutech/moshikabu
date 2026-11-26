"""SNS・検索結果に出すカード画像（OGP）を作る。

frontend/public/og.png を生成する。配色はアプリ本体（src/index.css）に合わせている。

使い方:
    python scripts/make_og_image.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630

INK = (15, 23, 42)
MUTED = (100, 116, 139)
BRAND = (37, 99, 235)
GAIN = (16, 185, 129)
CANVAS = (247, 249, 252)
LINE = (229, 231, 235)

FONT_DIR = Path("C:/Windows/Fonts")
BOLD = FONT_DIR / "YuGothB.ttc"
MEDIUM = FONT_DIR / "YuGothM.ttc"


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def rounded_logo(draw: ImageDraw.ImageDraw, x: int, y: int, size: int) -> None:
    """favicon と同じ意匠（青い角丸 ＋ 右肩上がりの折れ線）。"""
    draw.rounded_rectangle([x, y, x + size, y + size], radius=int(size * 0.22), fill=BRAND)
    s = size / 64
    points = [(x + 12 * s, y + 42 * s), (x + 24 * s, y + 30 * s), (x + 34 * s, y + 38 * s), (x + 52 * s, y + 18 * s)]
    draw.line(points, fill="white", width=int(6 * s), joint="curve")
    r = 5 * s
    cx, cy = x + 52 * s, y + 18 * s
    draw.ellipse([cx - r - 3 * s, cy - r - 3 * s, cx + r + 3 * s, cy + r + 3 * s], fill="white")
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GAIN)


def main() -> None:
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)

    # 下地（うっすら色を敷いて、白背景のタイムラインでも輪郭が出るように）
    d.rectangle([0, 0, W, H], fill=CANVAS)
    d.rounded_rectangle([40, 40, W - 40, H - 40], radius=32, fill="white", outline=LINE, width=2)

    # 右上に、右肩上がりの折れ線を薄く敷く
    chart = [(700, 430), (780, 380), (860, 400), (940, 300), (1020, 330), (1100, 210)]
    d.line(chart, fill=(219, 234, 254), width=14, joint="curve")
    for px, py in chart:
        d.ellipse([px - 7, py - 7, px + 7, py + 7], fill=(191, 219, 254))

    rounded_logo(d, 96, 110, 92)

    d.text((208, 122), "MoshiKabu", font=font(BOLD, 52), fill=INK)
    d.text((210, 186), "もし株", font=font(MEDIUM, 28), fill=MUTED)

    d.text((96, 268), "あのとき買ってたら、", font=font(BOLD, 64), fill=INK)
    d.text((96, 348), "今いくら？", font=font(BOLD, 64), fill=BRAND)

    d.text(
        (96, 460),
        "実際のお金を使わずに、現実の株価で投資をシミュレーション。",
        font=font(MEDIUM, 26),
        fill=MUTED,
    )
    d.text(
        (96, 500),
        "過去シミュレーション ／ 仮想ポートフォリオ ／ 条件スクリーナー ／ バックテスト",
        font=font(MEDIUM, 22),
        fill=MUTED,
    )

    out = Path(__file__).resolve().parent.parent / "frontend" / "public" / "og.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG", optimize=True)
    print(f"{out} ({out.stat().st_size / 1024:.0f} KB, {W}x{H})")


if __name__ == "__main__":
    main()
