"""Riverside Hotel guest floors (scene/areas/places/HotelFloors.tsx): room furniture + corridor pieces.

One GLB, one object per piece, merged into the room / corridor meshes in game (Part.addColored).
Pivot = footprint centre on the floor; the front (the side you use it from) is -Y (three +z).
Room frame (game): 7 m (x) x 6 m (z), door wall at +z. Pieces are placed and turned by the scene.
Contract: bed top (mattress) at 0.55 m, 2.1 x 1.6; nightstand top 0.55; desk top 0.75; minibar fridge 0.5 m tall;
TV screen centre 1.25 m; door 1.0 x 2.15 m in a 1.2 m frame, number plate at 1.6 m.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from es_lpm import lpm, palette, export_web, glass

lpm.reset()
P = palette()
objs = []
extras = []


def fin(name, parts, budget):
    objs.append(lpm.finish(name, parts, P, budget=budget, center=False))


# ---------------------------------------------------------------- bed: frame, mattress, duvet, pillows, headboard
b = [lpm.box("frame", (2.1, 1.7, 0.3), at=(0, 0, 0.08), color=P["wood_dark"]),
     lpm.box("mattress", (2.0, 1.6, 0.18), at=(0, 0, 0.38), color=P["linen"]),
     lpm.box("duvet", (1.35, 1.66, 0.08), at=(0.3, 0, 0.5), color=P["white"]),
     lpm.box("runner", (0.35, 1.68, 0.09), at=(0.62, 0, 0.5), color=P["carpet"]),
     lpm.box("headboard", (0.12, 1.8, 1.15), at=(-1.08, 0, 0.0), color=P["teal"]),
     lpm.box("head_trim", (0.16, 1.84, 0.08), at=(-1.08, 0, 1.15), color=P["gold"])]
for y in (-0.42, 0.42):
    b.append(lpm.box(f"pillow{y}", (0.4, 0.66, 0.16), at=(-0.75, y, 0.56), color=P["white"], taper=(0.85, 0.9)))
for x in (-0.95, 0.95):
    for y in (-0.75, 0.75):
        b.append(lpm.box(f"leg{x}{y}", (0.08, 0.08, 0.08), at=(x, y, 0), color=P["ink"]))
fin("SM_HR_Bed", b, 300)

# ---------------------------------------------------------------- nightstand with lamp (and one with the phone)
for name, phone in (("SM_HR_Nightstand", False), ("SM_HR_NightstandPhone", True)):
    n = [lpm.box("body", (0.5, 0.45, 0.5), at=(0, 0, 0.03), color=P["wood_dark"]),
         lpm.box("top", (0.54, 0.49, 0.03), at=(0, 0, 0.53), color=P["wood"]),
         lpm.box("drawer", (0.42, 0.02, 0.16), at=(0, -0.235, 0.3), color=P["wood"]),
         lpm.prism("knob", 6, 0.02, 0.025, at=(0, 0, 0), color=P["gold"])]
    lpm.rotate(n[-1], 90, "X"); lpm.move(n[-1], 0, -0.25, 0.38)
    n += [lpm.prism("lamp_base", 8, 0.07, 0.25, at=(0.1, 0.08, 0.56), color=P["gold"], radius_top=0.03),
          lpm.prism("lamp_shade", 8, 0.13, 0.18, at=(0.1, 0.08, 0.8), color=P["cream"], radius_top=0.09)]
    if phone:
        n += [lpm.box("phone", (0.18, 0.14, 0.05), at=(-0.12, -0.06, 0.56), color=P["ink"], taper=(0.85, 0.8)),
              lpm.box("handset", (0.2, 0.05, 0.04), at=(-0.12, -0.06, 0.61), color=P["slate_dark"])]
    fin(name, n, 240)

# ---------------------------------------------------------------- desk + chair, TV on a low cabinet, minibar fridge
d = [lpm.box("desk_top", (1.2, 0.55, 0.04), at=(0, 0, 0.73), color=P["wood"])]
for x in (-0.55, 0.55):
    d.append(lpm.box(f"desk_side{x}", (0.05, 0.5, 0.73), at=(x, 0, 0), color=P["wood_dark"]))
d += [lpm.box("desk_lamp", (0.08, 0.08, 0.35), at=(0.4, 0.12, 0.77), color=P["gold"]),
      lpm.box("desk_lamp_head", (0.18, 0.12, 0.06), at=(0.34, 0.08, 1.1), color=P["gold"]),
      lpm.box("notepad", (0.22, 0.16, 0.02), at=(-0.2, -0.05, 0.77), color=P["white"])]
fin("SM_HR_Desk", d, 160)
c = [lpm.box("seat", (0.45, 0.45, 0.08), at=(0, 0, 0.42), color=P["teal"]),
     lpm.box("back", (0.45, 0.06, 0.5), at=(0, 0.22, 0.48), color=P["teal"])]
for x in (-0.19, 0.19):
    for y in (-0.19, 0.19):
        c.append(lpm.box(f"cleg{x}{y}", (0.04, 0.04, 0.42), at=(x, y, 0), color=P["wood_dark"]))
fin("SM_HR_Chair", c, 120)
t = [lpm.box("cabinet", (1.4, 0.45, 0.55), at=(0, 0, 0), color=P["wood_dark"]),
     lpm.box("cab_top", (1.44, 0.48, 0.03), at=(0, 0, 0.55), color=P["wood"]),
     lpm.box("tv_stand", (0.25, 0.15, 0.08), at=(0, 0.05, 0.58), color=P["ink"]),
     lpm.box("tv_neck", (0.06, 0.04, 0.2), at=(0, 0.08, 0.6), color=P["ink"]),
     lpm.box("tv", (1.0, 0.05, 0.6), at=(0, 0.06, 0.75), color=P["ink"])]
for x in (-0.35, 0.35):
    t.append(lpm.box(f"door{x}", (0.62, 0.02, 0.42), at=(x, -0.23, 0.07), color=P["wood"]))
fin("SM_HR_TvCabinet", t, 160)
m = [lpm.box("fridge", (0.5, 0.48, 0.55), at=(0, 0, 0), color=P["slate_dark"]),
     lpm.box("fridge_door", (0.46, 0.02, 0.5), at=(0, -0.245, 0.025), color=P["slate"]),
     lpm.box("fridge_handle", (0.04, 0.03, 0.2), at=(0.18, -0.265, 0.2), color=P["steel"]),
     lpm.box("tray", (0.46, 0.3, 0.02), at=(0, 0.05, 0.55), color=P["wood"])]
for i, col in enumerate((P["red"], P["green"], P["yellow"])):
    m.append(lpm.prism(f"bottle{i}", 6, 0.035, 0.18, at=(-0.13 + i * 0.13, 0.05, 0.57), color=col, radius_top=0.02))
fin("SM_HR_Minibar", m, 160)

# ---------------------------------------------------------------- wardrobe, armchair, luggage rack, rug
w = [lpm.box("wardrobe", (1.1, 0.6, 2.1), at=(0, 0, 0), color=P["wood"]),
     lpm.box("wardrobe_top", (1.16, 0.64, 0.06), at=(0, 0, 2.1), color=P["wood_dark"]),
     lpm.box("wardrobe_split", (0.02, 0.02, 1.9), at=(0, -0.31, 0.1), color=P["wood_dark"])]
for x in (-0.06, 0.06):
    w.append(lpm.box(f"handle{x}", (0.03, 0.03, 0.25), at=(x, -0.32, 0.95), color=P["gold"]))
fin("SM_HR_Wardrobe", w, 120)
a = [lpm.box("arm_seat", (0.8, 0.75, 0.3), at=(0, 0, 0.12), color=P["blue_dark"]),
     lpm.box("arm_cushion", (0.6, 0.6, 0.12), at=(0, -0.04, 0.42), color=P["blue"]),
     lpm.box("arm_back", (0.8, 0.2, 0.55), at=(0, 0.28, 0.42), color=P["blue_dark"], taper=(1.0, 0.8))]
for x in (-0.36, 0.36):
    a.append(lpm.box(f"armrest{x}", (0.12, 0.75, 0.3), at=(x, 0, 0.42), color=P["blue_dark"]))
for x in (-0.3, 0.3):
    for y in (-0.3, 0.3):
        a.append(lpm.box(f"aleg{x}{y}", (0.06, 0.06, 0.12), at=(x, y, 0), color=P["wood_dark"]))
fin("SM_HR_Armchair", a, 180)
l = [lpm.box("rack_top", (0.8, 0.5, 0.04), at=(0, 0, 0.46), color=P["wood"]),
     lpm.box("suitcase", (0.62, 0.4, 0.28), at=(0, 0, 0.5), color=P["orange"]),
     lpm.box("suitcase_handle", (0.2, 0.04, 0.05), at=(0, 0, 0.78), color=P["ink"])]
for x in (-0.36, 0.36):
    l.append(lpm.box(f"rleg{x}", (0.04, 0.45, 0.46), at=(x, 0, 0), color=P["gold"]))
fin("SM_HR_LuggageRack", l, 100)
fin("SM_HR_Rug", [lpm.box("rug", (2.6, 2.0, 0.015), at=(0, 0, 0), color=P["carpet"]),
                  lpm.box("rug_border", (2.4, 1.8, 0.02), at=(0, 0, 0.0), color=P["gold"]),
                  lpm.box("rug_inner", (2.2, 1.6, 0.025), at=(0, 0, 0.0), color=P["carpet"])], 40)

# ---------------------------------------------------------------- window with curtains (on the back wall, front = into the room)
wi = [lpm.box("win_top", (2.0, 0.12, 0.08), at=(0, 0, 2.32), color=P["white"]),
      lpm.box("win_bottom", (2.0, 0.12, 0.08), at=(0, 0, 0.9), color=P["white"]),
      lpm.box("win_left", (0.08, 0.12, 1.5), at=(-0.96, 0, 0.9), color=P["white"]),
      lpm.box("win_right", (0.08, 0.12, 1.5), at=(0.96, 0, 0.9), color=P["white"]),
      lpm.box("win_sill", (2.1, 0.25, 0.05), at=(0, -0.08, 0.86), color=P["white"]),
      lpm.box("win_bar", (0.05, 0.13, 1.5), at=(0, -0.005, 0.9), color=P["white"]),
      lpm.box("rail", (2.8, 0.06, 0.04), at=(0, -0.12, 2.5), color=P["gold"])]
for x in (-1.2, 1.2):
    cur = lpm.box(f"curtain{x}", (0.5, 0.08, 1.9), at=(x, -0.14, 0.6), color=P["carpet"], taper=(0.8, 1.0))
    wi.append(cur)
fin("SM_HR_Window", wi, 120)
extras.append(glass("SM_HR_Window", [lpm.box("win_glass", (1.86, 0.02, 1.36), at=(0, 0.0, 0.97))], color="#bfe6fb", alpha=0.35))

# ---------------------------------------------------------------- bathroom corner: shower tray (+ glass), toilet, sink + mirror
bt = [lpm.box("tray", (0.9, 0.9, 0.08), at=(0, 0, 0), color=P["white"]),
      lpm.prism("drain", 8, 0.05, 0.085, at=(0, 0, 0), color=P["steel"]),
      lpm.prism("shower_pipe", 6, 0.02, 1.9, at=(0, 0.42, 0.08), color=P["steel"]),
      lpm.prism("shower_head", 8, 0.1, 0.04, at=(0, 0.32, 1.95), color=P["steel"])]
fin("SM_HR_Shower", bt, 160)
extras.append(glass("SM_HR_Shower", [lpm.box("shower_glass", (0.9, 0.02, 1.9), at=(0, -0.45, 0.08)), lpm.box("shower_glass_side", (0.02, 0.9, 1.9), at=(0.45, 0, 0.08))], color="#cfe6ff", alpha=0.3))
to = [lpm.lathe("bowl", [(0, 0.0), (0.16, 0.0), (0.2, 0.38), (0, 0.38)], segments=10, color=P["white"]),
      lpm.box("seat", (0.4, 0.46, 0.04), at=(0, -0.04, 0.38), color=P["white"]),
      lpm.box("cistern", (0.38, 0.16, 0.42), at=(0, 0.22, 0.38), color=P["white"]),
      lpm.box("flush", (0.06, 0.04, 0.02), at=(0, 0.22, 0.8), color=P["steel"])]
fin("SM_HR_Toilet", to, 160)
si = [lpm.box("vanity", (0.7, 0.45, 0.8), at=(0, 0, 0), color=P["wood"]),
      lpm.box("basin", (0.5, 0.36, 0.08), at=(0, -0.02, 0.8), color=P["white"]),
      lpm.box("tap", (0.04, 0.12, 0.12), at=(0, 0.14, 0.86), color=P["steel"]),
      lpm.box("mirror_frame", (0.62, 0.04, 0.72), at=(0, 0.21, 1.15), color=P["gold"]),
      lpm.box("mirror", (0.54, 0.02, 0.64), at=(0, 0.2, 1.19), color=P["steel"]),
      lpm.box("towel", (0.3, 0.06, 0.4), at=(0.42, 0.18, 0.65), color=P["linen"])]
fin("SM_HR_Sink", si, 120)

# ---------------------------------------------------------------- corridor: door (frame + number plate + handle), lift doors, sconce, plant, cart
dr = [lpm.box("door_frame", (1.2, 0.14, 2.3), at=(0, 0, 0), color=P["white"]),
      lpm.box("door", (1.0, 0.16, 2.15), at=(0, -0.01, 0), color=P["wood"]),
      lpm.box("door_panel_lo", (0.76, 0.17, 0.75), at=(0, -0.012, 0.25), color=P["wood_dark"]),
      lpm.box("door_panel_hi", (0.76, 0.17, 0.85), at=(0, -0.012, 1.15), color=P["wood_dark"]),
      lpm.box("plate", (0.32, 0.18, 0.16), at=(0, -0.015, 1.52), color=P["gold"]),
      lpm.box("handle", (0.14, 0.2, 0.04), at=(0.36, -0.03, 1.0), color=P["gold"]),
      lpm.box("card_reader", (0.06, 0.2, 0.12), at=(0.36, -0.03, 1.12), color=P["ink"])]
fin("SM_HR_Door", dr, 120)
li = [lpm.box("lift_frame", (2.2, 0.14, 2.6), at=(0, 0, 0), color=P["gold"]),
      lpm.box("lift_l", (0.86, 0.16, 2.25), at=(-0.45, -0.01, 0), color=P["steel"]),
      lpm.box("lift_r", (0.86, 0.16, 2.25), at=(0.45, -0.01, 0), color=P["steel"]),
      lpm.box("lift_buttons", (0.16, 0.18, 0.36), at=(1.35, -0.01, 1.0), color=P["ink"]),
      lpm.box("lift_up", (0.06, 0.2, 0.06), at=(1.35, -0.02, 1.25), color=P["yellow"]),
      lpm.box("lift_down", (0.06, 0.2, 0.06), at=(1.35, -0.02, 1.06), color=P["yellow"]),
      lpm.box("lift_display", (0.5, 0.16, 0.18), at=(0, -0.01, 2.35), color=P["ink"])]
fin("SM_HR_Lift", li, 120)
sc = [lpm.box("sconce_plate", (0.14, 0.05, 0.2), at=(0, 0.08, 0), color=P["gold"]),
      lpm.prism("sconce_shade", 8, 0.11, 0.2, at=(0, -0.02, 0.05), color=P["cream"], radius_top=0.07)]
fin("SM_HR_Sconce", sc, 60)
pl = [lpm.lathe("pot", [(0, 0), (0.16, 0), (0.22, 0.4), (0, 0.4)], segments=8, color=P["slate_dark"])]
for i, (x, y, h) in enumerate(((0, 0, 1.0), (0.1, 0.05, 0.8), (-0.1, -0.04, 0.85))):
    # leaves start inside the pot rim (0.4) so the bush sits in the pot
    leaf = lpm.lathe(f"leaf{i}", [(0, 0), (0.18, 0.15), (0.12, 0.45), (0, 0.55)], segments=6, at=(x, y, 0.3 + (h - 0.8) * 0.3), color=P["leaf"] if i else P["leaf_dark"])
    pl.append(leaf)
fin("SM_HR_Plant", pl, 200)
ca = [lpm.box("cart_base", (1.0, 0.5, 0.06), at=(0, 0, 0.12), color=P["steel"]),
      lpm.box("cart_shelf", (1.0, 0.5, 0.04), at=(0, 0, 0.55), color=P["steel"]),
      lpm.box("cart_top", (1.0, 0.5, 0.04), at=(0, 0, 0.95), color=P["steel"]),
      lpm.box("towels", (0.5, 0.4, 0.2), at=(-0.2, 0, 0.6), color=P["white"]),
      lpm.box("linen", (0.35, 0.4, 0.25), at=(0.25, 0, 0.99), color=P["linen"]),
      lpm.box("bin_bag", (0.3, 0.35, 0.35), at=(0.3, 0, 0.17), color=P["blue_dark"])]
for x in (-0.47, 0.47):
    for y in (-0.22, 0.22):
        ca.append(lpm.box(f"post{x}{y}", (0.03, 0.03, 0.9), at=(x, y, 0.1), color=P["steel"]))
        ca.append(lpm.prism(f"wheel{x}{y}", 6, 0.05, 0.03, at=(x, y, 0.02), color=P["ink"]))
fin("SM_HR_Cart", ca, 300)

lay = [(i * 2.6 % 18, (i // 7) * 3.0, 0) for i in range(len(objs))]
export_web(objs[0], P, extra=objs[1:] + extras, slug="hotel_kit", spread=lay + [(99, 0, 0)] * len(extras))
