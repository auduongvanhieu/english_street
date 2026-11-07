#!/usr/bin/env python3
"""
Build English Street low-poly assets with the blender-lpm-skill loop: recipe -> GLB -> 5 views -> inspect -> gates.

  python3 assets-src/lpm/build.py                 # every recipe
  python3 assets-src/lpm/build.py bus_shelter     # one or more by name
  python3 assets-src/lpm/build.py --no-render     # skip the Cycles views (fast rebuild)

Blender: $BLENDER_EXE, else ~/opt/blender/blender, else `blender` on PATH. Renders use Cycles on the CPU
(this VPS has no GPU/EGL, so EEVEE and Workbench cannot run headless). Outputs: apps/web/public/models/lpm/<slug>.glb
(committed) and _work/lpm/<slug>/ (blend, views/sheet.png, inspect.json, gates.md; git-ignored).
Gate classes per asset come from GATES below (see docs/3d-art-direction.md for the budgets).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SKILL = ROOT / ".claude" / "skills" / "blender-lpm-skill" / "scripts"
# slug -> (gate class, triangle budget); FLOATING = pivot is not on the ground by contract (birds, boats)
GATES = {
    "bus_shelter": ("static-prop", 1200),
    "fountain": ("environment-module", 1500),
    "street_lamp": ("static-prop", 300),
    "lantern_post": ("static-prop", 250),
    "bird": ("static-prop", 750),
    "boat": ("hard-surface", 1200),
    "willow": ("environment-module", 1500),
    "grass_tuft": ("static-prop", 200),
    "farm_kit": ("environment-module", 5000),
    "zoo_kit": ("environment-module", 3500),
    "bus_interior": ("environment-module", 2400),
    "hotel_kit": ("environment-module", 4500),
    "sports_kit": ("static-prop", 700),
    "river_kit": ("environment-module", 3600),
    "library_kit": ("static-prop", 450),
    "kitchen_kit": ("environment-module", 1500),
    "market_kit": ("static-prop", 600),
    "cinema_kit": ("static-prop", 700),
    "train_interior": ("environment-module", 3000),
    "clinic_kit": ("environment-module", 1200),
    "home_kit": ("environment-module", 3000),
    "beach_kit": ("environment-module", 3000),
    "mountain_kit": ("environment-module", 2600),
    "riverside_kit": ("environment-module", 2400),
    "oldtown_kit": ("environment-module", 3000),
    "beach_sports": ("static-prop", 900),
    "cablecar_kit": ("environment-module", 1000),
    "farm_garden": ("static-prop", 2000),
}
FLOATING = {"bird", "boat", "farm_kit", "bus_interior", "river_kit", "kitchen_kit", "train_interior", "clinic_kit", "home_kit", "riverside_kit", "oldtown_kit"}  # farm_kit: the windmill sails pivot on their axle


def blender_env() -> dict:
    env = dict(os.environ)
    if not env.get("BLENDER_EXE"):
        local = Path.home() / "opt" / "blender" / "blender"
        if local.exists():
            env["BLENDER_EXE"] = str(local)
    return env


def bl(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(SKILL / "bl.py"), "--timeout", "900", *args], cwd=ROOT, env=blender_env(),
                          capture_output=True, text=True)


def build(slug: str, render: bool) -> bool:
    recipe = HERE / "recipes" / f"{slug}.py"
    r = bl("--script", str(recipe))
    res = [l for l in r.stdout.splitlines() if l.startswith("##RESULT##")]
    if r.returncode or not res:
        print(r.stdout[-3000:]); print(f"!! {slug}: recipe failed"); return False
    rep = json.loads(res[-1][len("##RESULT## "):])
    work = ROOT / "_work" / "lpm" / slug
    blend = ROOT / rep["blend"]
    if render:
        v = bl("--script", str(SKILL / "render_views.py"), "--", "--input", str(blend), "--out", str(work / "views"),
               "--size", "512", "--engine", "CYCLES", "--samples", "24")
        if v.returncode:
            print(v.stdout[-2000:]); print(f"!! {slug}: render failed"); return False
    ins = bl("--script", str(SKILL / "inspect_scene.py"), "--", "--input", str(blend), "--out", str(work / "inspect.json"))
    if ins.returncode:
        print(ins.stdout[-2000:]); print(f"!! {slug}: inspect failed"); return False
    cls, budget = GATES.get(slug, ("static-prop", rep.get("budget") or 1200))
    g = subprocess.run([sys.executable, str(SKILL / "gate_report.py"), str(work / "inspect.json"), "--class", cls,
                        "--budget", str(budget), "--out", str(work / "gates.md"),
                        *(["--allow-floating"] if slug in FLOATING else [])], cwd=ROOT, capture_output=True, text=True)
    ok = g.returncode == 0
    print(f"{'PASS' if ok else 'FAIL'} {slug}: {rep['tris']} tris (+{sum(rep['extra'].values())} helper) / {budget}, "
          f"{rep['glb_bytes'] / 1024:.0f} KB -> {rep['glb']}" + (f"  views: {work / 'views' / 'sheet.png'}" if render else ""))
    if not ok:
        print(g.stdout)
    return ok


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    render = "--no-render" not in sys.argv
    slugs = args or sorted(p.stem for p in (HERE / "recipes").glob("*.py"))
    results = [build(s, render) for s in slugs]
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
