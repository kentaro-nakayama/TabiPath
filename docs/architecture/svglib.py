"""README に貼るアーキテクチャ図を生成するための最小限の SVG ヘルパー。

外部依存なしで動くよう、座標は各図で直接指定する。配色は GitHub のダークテーマの
キャンバス色 rgb(14,17,22) を背景に敷き、その上で読める明度に揃えてある。
"""

# GitHub ダークテーマのキャンバス色
BG = "#0e1116"
FG = "#e6edf3"
MUTED = "#8b949e"
SURFACE = "#161b22"
BORDER = "#30363d"

XML_ESCAPES = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}

FONT = "'Hiragino Sans','Noto Sans JP','Yu Gothic',-apple-system,'Segoe UI',sans-serif"
MONO = "'SFMono-Regular',Consolas,'Liberation Mono',monospace"

# fill, stroke, title color
PALETTE = {
    "client":    ("#11253f", "#4493f8", "#79c0ff"),
    "server":    ("#241b43", "#a371f7", "#d2a8ff"),
    "api":       ("#32240c", "#d29922", "#f0b72f"),
    "lib":       ("#0a2c35", "#39c5cf", "#76e3ea"),
    "db":        ("#10291a", "#3fb950", "#7ee787"),
    "external":  ("#1c2128", "#6e7681", "#c9d1d9"),
    "fix":       ("#36161a", "#f85149", "#ff7b72"),
    "plain":     ("#161b22", "#484f58", "#e6edf3"),
}

ARROW = "#7d8590"
LABEL = "#c9d1d9"


def esc(s):
    out = []
    for ch in str(s):
        out.append(XML_ESCAPES.get(ch, ch))
    return "".join(out)


def text(x, y, s, size=12, weight="400", anchor="start", fill=FG, mono=False, opacity=None):
    op = f' opacity="{opacity}"' if opacity is not None else ""
    family = MONO if mono else FONT
    return (
        f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" '
        f'font-weight="{weight}" text-anchor="{anchor}" fill="{fill}"{op}>{esc(s)}</text>'
    )


def box(x, y, w, h, title, lines=(), style="plain", rx=10, title_size=13, line_size=11,
        mono_lines=False):
    fill, stroke, tcolor = PALETTE[style]
    parts = [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" '
        f'stroke="{stroke}" stroke-width="1.5"/>'
    ]
    cx = x + w / 2
    if lines:
        ty = y + 21
    else:
        ty = y + h / 2 + 4.5
    parts.append(text(cx, ty, title, size=title_size, weight="700", anchor="middle", fill=tcolor))
    ly = ty + 17
    for line in lines:
        parts.append(text(cx, ly, line, size=line_size, anchor="middle", fill="#adbac7",
                          mono=mono_lines))
        ly += 15
    return "".join(parts)


def group(x, y, w, h, label, color="#6e7681", rx=14, dash="6 4"):
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="none" '
        f'stroke="{color}" stroke-width="1.3" stroke-dasharray="{dash}"/>'
        + text(x + 12, y + 18, label, size=11.5, weight="700", fill=color)
    )


def arrow(x1, y1, x2, y2, label=None, dashed=False, color=ARROW, both=False,
          label_dx=0, label_dy=-6, label_anchor="middle"):
    dash = ' stroke-dasharray="5 4"' if dashed else ""
    start = ' marker-start="url(#arrowback)"' if both else ""
    parts = [
        f'<path d="M {x1} {y1} L {x2} {y2}" fill="none" stroke="{color}" stroke-width="1.6"'
        f'{dash} marker-end="url(#arrow)"{start}/>'
    ]
    if label:
        mx, my = (x1 + x2) / 2 + label_dx, (y1 + y2) / 2 + label_dy
        parts.append(_label(mx, my, label, label_anchor))
    return "".join(parts)


def elbow(points, label=None, dashed=False, color=ARROW, label_at=None, label_anchor="middle",
          label_dx=0, label_dy=-7):
    """points: [(x,y), ...] を直線でつなぎ、最後に矢印を付ける。"""
    dash = ' stroke-dasharray="5 4"' if dashed else ""
    d = " ".join(("M" if i == 0 else "L") + f" {px} {py}" for i, (px, py) in enumerate(points))
    parts = [
        f'<path d="{d}" fill="none" stroke="{color}" stroke-width="1.6"{dash} '
        f'marker-end="url(#arrow)" stroke-linejoin="round"/>'
    ]
    if label:
        if label_at is None:
            i = len(points) // 2
            ax, ay = points[i - 1], points[i]
            lx, ly = (ax[0] + ay[0]) / 2, (ax[1] + ay[1]) / 2
        else:
            lx, ly = label_at
        parts.append(_label(lx + label_dx, ly + label_dy, label, label_anchor))
    return "".join(parts)


def _label(x, y, s, anchor="middle"):
    # 線の上に白い下敷きを敷いて可読性を確保する
    w = _approx_width(s, 10.5) + 8
    bx = {"middle": x - w / 2, "start": x - 4, "end": x - w + 4}[anchor]
    return (
        f'<rect x="{bx}" y="{y - 10.5}" width="{w}" height="15" rx="3" fill="{BG}" '
        f'opacity="0.95"/>' + text(x, y + 1, s, size=10.5, anchor=anchor, fill=LABEL)
    )


def _approx_width(s, size):
    total = 0.0
    for ch in str(s):
        total += size * (1.0 if ord(ch) > 0x2E80 else 0.56)
    return total


def badge(x, y, s, style="fix"):
    fill, stroke, tcolor = PALETTE[style]
    w = _approx_width(s, 10.5) + 16
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="20" rx="10" fill="{fill}" '
        f'stroke="{stroke}" stroke-width="1.2"/>'
        + text(x + w / 2, y + 14, s, size=10.5, weight="700", anchor="middle", fill=tcolor)
    )


def note(x, y, s, size=11, fill=MUTED, anchor="start"):
    return text(x, y, s, size=size, anchor=anchor, fill=fill)


def svg(width, height, body, title, subtitle=None):
    head = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'width="{width}" height="{height}" role="img" aria-label="{esc(title)}">',
        '<defs>',
        '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
        f'markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{ARROW}"/></marker>',
        '<marker id="arrowback" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" '
        f'markerHeight="7" orient="auto-start-reverse"><path d="M 10 0 L 0 5 L 10 10 z" fill="{ARROW}"/></marker>',
        '</defs>',
        f'<rect width="{width}" height="{height}" fill="{BG}"/>',
        text(32, 44, title, size=20, weight="700", fill=FG),
    ]
    if subtitle:
        head.append(text(32, 66, subtitle, size=12.5, fill=MUTED))
    return "\n".join(head) + "\n" + body + "\n</svg>\n"


def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"wrote {path}")


def table(x, y, w, name, cols, style="db", row_h=16):
    """ER図用のテーブル。cols は (列名, 注記) のリスト。高さを返す。"""
    fill, stroke, tcolor = PALETTE[style]
    head_h = 30
    h = head_h + row_h * len(cols) + 10
    parts = [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{SURFACE}" '
        f'stroke="{stroke}" stroke-width="1.6"/>',
        f'<path d="M {x} {y + head_h} h {w}" stroke="{stroke}" stroke-width="1.2" opacity="0.6"/>',
        f'<path d="M {x + 8} {y + 1} h {w - 16} a 7 7 0 0 1 7 7 v {head_h - 8} h {-w + 2} '
        f'v {-head_h + 8} a 7 7 0 0 1 7 -7 z" fill="{fill}" opacity="0.95"/>',
        text(x + w / 2, y + 20, name, size=12.5, weight="700", anchor="middle", fill=tcolor, mono=True),
    ]
    ry = y + head_h + 13
    for col, memo in cols:
        parts.append(text(x + 12, ry, col, size=10.5, fill=FG, mono=True))
        if memo:
            parts.append(text(x + w - 12, ry, memo, size=9.5, anchor="end", fill=MUTED))
        ry += row_h
    return "".join(parts), h


def steps(x, y, items, w=220, h=104, gap=40, arrow_labels=None):
    """左から右へ流れる処理の連鎖。items は (タイトル, 行リスト, style)。"""
    parts = []
    cx = x
    for i, (title, lines, style) in enumerate(items):
        parts.append(box(cx, y, w, h, title, lines, style=style, title_size=12, line_size=10.5))
        if i < len(items) - 1:
            lbl = arrow_labels[i] if arrow_labels and i < len(arrow_labels) else None
            parts.append(arrow(cx + w, y + h / 2, cx + w + gap, y + h / 2, lbl, label_dy=-8))
        cx += w + gap
    return "".join(parts), cx - gap


def heading(x, y, number, title, memo=None):
    parts = [
        f'<rect x="{x}" y="{y - 15}" width="22" height="22" rx="11" fill="{BORDER}" '
        f'stroke="{MUTED}" stroke-width="1"/>',
        text(x + 11, y + 1, number, size=12, weight="700", anchor="middle", fill=FG),
        text(x + 32, y + 1, title, size=14, weight="700", fill=FG),
    ]
    if memo:
        parts.append(text(x + 32 + _approx_width(title, 14) + 14, y + 1, memo, size=11,
                          fill=MUTED))
    return "".join(parts)
