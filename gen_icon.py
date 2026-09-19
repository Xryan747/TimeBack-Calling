# -*- coding: utf-8 -*-
"""
Timeback Calling — 极简应用图标生成器
设计：白底 + 墨色钟表圆环（表针指向 9 点和 11 点 = 时光倒回）
      + 微信绿回拨箭头弧线（逆时针 = 把时间拨回去的通话）
输出：Android mipmap 各分辨率（含自适应图标 foreground）、PWA 图标、favicon
"""
import math
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))

INK = (27, 27, 34, 255)        # 墨色  #1B1B22
GREEN = (7, 193, 96, 255)      # 微信绿 #07C160
WHITE = (255, 255, 255, 255)

SIZE = 1024
CX = CY = 512

# ── 几何（1024 画布）─────────────────────────────────────────────
R_CIRCLE = 240   # 墨色钟表圆环半径
W_CIRCLE = 44    # 圆环线宽
R_ARC = 292      # 绿色回拨弧半径
W_ARC = 42       # 弧线宽
GAP = (63, 87)   # 弧的缺口角度区间（箭头所在），屏幕角度：3点=0° 顺时针递增

def pt(deg, r):
    a = math.radians(deg)
    return (CX + r * math.cos(a), CY + r * math.sin(a))

def draw_glyph(draw):
    # 墨色钟表圆环
    draw.ellipse(
        (CX - R_CIRCLE, CY - R_CIRCLE, CX + R_CIRCLE, CY + R_CIRCLE),
        outline=INK, width=W_CIRCLE,
    )
    # 表针：9 点（长针）+ 11 点（短针）—— 指针朝左上方 = 时间往回拨
    for deg, r in ((180, 190), (240, 152)):
        end = pt(deg, r)
        draw.line((CX, CY, end[0], end[1]), fill=INK, width=32)
        for p in ((CX, CY), end):  # 圆头端点
            draw.ellipse((p[0] - 16, p[1] - 16, p[0] + 16, p[1] + 16), fill=INK)

    # 绿色回拨弧：从缺口后缘(87°)顺时针绕一圈到缺口前缘(63°)
    bbox = (CX - R_ARC, CY - R_ARC, CX + R_ARC, CY + R_ARC)
    draw.arc(bbox, GAP[1], 360, fill=GREEN, width=W_ARC)
    draw.arc(bbox, 0, GAP[0], fill=GREEN, width=W_ARC)

    # 箭头（缺口内，指向逆时针方向）
    p0 = pt(75, R_ARC)
    unit_ccw = (math.sin(math.radians(75)), -math.cos(math.radians(75)))  # 逆时针切向
    unit_rad = (math.cos(math.radians(75)), math.sin(math.radians(75)))   # 径向向外
    tip = (p0[0] + 0.10 * R_ARC * unit_ccw[0], p0[1] + 0.10 * R_ARC * unit_ccw[1])
    b1 = (p0[0] - 0.04 * R_ARC * unit_ccw[0] + 0.085 * R_ARC * unit_rad[0],
          p0[1] - 0.04 * R_ARC * unit_ccw[1] + 0.085 * R_ARC * unit_rad[1])
    b2 = (p0[0] - 0.04 * R_ARC * unit_ccw[0] - 0.085 * R_ARC * unit_rad[0],
          p0[1] - 0.04 * R_ARC * unit_ccw[1] - 0.085 * R_ARC * unit_rad[1])
    draw.polygon([tip, b1, b2], fill=GREEN)

def full_icon(size):
    """白底完整图标"""
    im = Image.new('RGBA', (size, size), WHITE)
    d = ImageDraw.Draw(im)
    if size != SIZE:
        scale = size / SIZE
        # 直接缩放 master 画布坐标
        global CX, CY, R_CIRCLE, W_CIRCLE, R_ARC, W_ARC
        CX2, CY2 = CX * scale, CY * scale
        R_C2, W_C2, R_A2, W_A2 = R_CIRCLE * scale, W_CIRCLE * scale, R_ARC * scale, W_ARC * scale
        draw_scaled(d, CX2, CY2, R_C2, W_C2, R_A2, W_A2, scale)
    else:
        draw_glyph(d)
    return im

def draw_scaled(d, cx, cy, rc, wc, ra, wa, scale):
    """在非 1024 画布上按比例重绘（线宽按比例）"""
    d.ellipse((cx - rc, cy - rc, cx + rc, cy + rc), outline=INK, width=int(round(wc)))
    for deg, r in ((180, 190 * scale), (240, 152 * scale)):
        end = (cx + r * math.cos(math.radians(deg)), cy + r * math.sin(math.radians(deg)))
        w = int(round(32 * scale))
        d.line((cx, cy, end[0], end[1]), fill=INK, width=w)
        for p in ((cx, cy), end):
            d.ellipse((p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2), fill=INK)
    bbox = (cx - ra, cy - ra, cx + ra, cy + ra)
    wa_i = int(round(wa))
    d.arc(bbox, GAP[1], 360, fill=GREEN, width=wa_i)
    d.arc(bbox, 0, GAP[0], fill=GREEN, width=wa_i)
    p0 = (cx + ra * math.cos(math.radians(75)), cy + ra * math.sin(math.radians(75)))
    unit_ccw = (math.sin(math.radians(75)), -math.cos(math.radians(75)))
    unit_rad = (math.cos(math.radians(75)), math.sin(math.radians(75)))
    tip = (p0[0] + 0.10 * ra * unit_ccw[0], p0[1] + 0.10 * ra * unit_ccw[1])
    b1 = (p0[0] - 0.04 * ra * unit_ccw[0] + 0.085 * ra * unit_rad[0],
          p0[1] - 0.04 * ra * unit_ccw[1] + 0.085 * ra * unit_rad[1])
    b2 = (p0[0] - 0.04 * ra * unit_ccw[0] - 0.085 * ra * unit_rad[0],
          p0[1] - 0.04 * ra * unit_ccw[1] - 0.085 * ra * unit_rad[1])
    d.polygon([tip, b1, b2], fill=GREEN)

def foreground(size):
    """自适应图标前景：透明底 + 图标（内容在安全区内）"""
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if size == SIZE:
        draw_glyph(d)
    else:
        scale = size / SIZE
        draw_scaled(d, CX * scale, CY * scale, R_CIRCLE * scale, W_CIRCLE * scale,
                    R_ARC * scale, W_ARC * scale, scale)
    return im

def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'PNG')
    print('  ', path, im.size)

def main():
    # ── PWA / favicon / 预览 ──
    pub = os.path.join(ROOT, 'public')
    save(full_icon(SIZE), os.path.join(ROOT, 'build', 'icon-master.png'))
    save(full_icon(512), os.path.join(pub, 'icon-512.png'))
    save(full_icon(192), os.path.join(pub, 'icon-192.png'))
    save(full_icon(180), os.path.join(pub, 'apple-touch-icon.png'))
    save(full_icon(64), os.path.join(pub, 'favicon.png'))

    # ── Android legacy + round ──
    res = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
    for density, size in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
        d = os.path.join(res, f'mipmap-{density}')
        save(full_icon(size), os.path.join(d, 'ic_launcher.png'))
        save(full_icon(size), os.path.join(d, 'ic_launcher_round.png'))

    # ── Android adaptive foreground (108dp 各密度) ──
    for density, size in (('mdpi', 108), ('hdpi', 162), ('xhdpi', 216), ('xxhdpi', 324), ('xxxhdpi', 432)):
        d = os.path.join(res, f'mipmap-{density}')
        save(foreground(size), os.path.join(d, 'ic_launcher_foreground.png'))

    # ── 自适应图标背景色 = 白 ──
    bg = os.path.join(res, 'values', 'ic_launcher_background.xml')
    with open(bg, 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                '    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n')
    print('  ', bg)

    # ── 启动屏：白底 + 居中图标 ──
    splash = Image.new('RGBA', (1080, 1920), WHITE)
    icon = full_icon(384)
    splash.paste(icon, ((1080 - 384) // 2, (1920 - 384) // 2 - 80), icon)
    save(splash, os.path.join(res, 'drawable', 'splash.png'))

if __name__ == '__main__':
    main()
