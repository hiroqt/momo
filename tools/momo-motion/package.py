"""Package the motion deliverables, rebuild sources and Expo helper."""
from pathlib import Path
import json
import zipfile

ROOT = Path(__file__).resolve().parents[2]
DESIGN = ROOT / "design/momo-motion"
OUT = DESIGN / "momo-motion-pack.zip"
PREFIX = "Momo-Motion-Studio/"

start = """# Momo Motion Studio

28 transparent animations: 13 image-backed full-body Momo poses and 15 vector app moments,
including streak fire, confetti, document progress, feedback and rewards.

Open `design/momo-motion/preview.html` in a browser for the offline gallery.
Use `.lottie` files in `design/momo-motion/lottie/`, or the JSON files in
`mobile/assets/animations/momo-motion/`. Original-image Momo SVGs and editable vector effect masters live in
`design/momo-motion/svg/`.

Figma draft: https://www.figma.com/design/hFFDpvBESGefE1PCutXqZN/
Import `design/momo-motion/figma/manifest.json` through Figma desktop's
Plugins → Development → Import plugin from manifest to open the preview and
create an editable board. The plugin is local and makes no network requests.
Figma canvas changes do not automatically regenerate animation curves.

Read `design/momo-motion/README.md` for the motion map, Expo integration,
rebuild instructions and validation. Native device performance remains to be
checked. The Expo helper is integrated into the app. See README.md for screen placements.
"""

paths = set()
for folder in [DESIGN, ROOT / "mobile/assets/animations/momo-motion",
               ROOT / "tools/momo-motion"]:
    for path in folder.rglob("*"):
        if path.is_file() and path != OUT and "__pycache__" not in path.parts:
            if path.suffix != ".pyc":
                paths.add(path)

for name in ["mobile/components/mascot/MomoAnimation.tsx",
             "mobile/components/onboarding/useOnboardingReducedMotion.ts",
             "mobile/lib/animations/momoMotion.ts",
             "mobile/lib/animations/motionLayout.ts",
             "docs/momo-mobile-animation-map.md",
             "mobile/__tests__/momoMotion.test.ts"]:
    paths.add(ROOT / name)

meta = json.loads((DESIGN / "manifest.json").read_text())
for asset in meta["animations"]:
    if asset.get("source"):
        source = ROOT / asset["source"]
        if source.is_file():
            paths.add(source)

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    archive.writestr(PREFIX + "START-HERE.md", start)
    for path in sorted(paths):
        archive.write(path, PREFIX + str(path.relative_to(ROOT)))

with zipfile.ZipFile(OUT) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert sum(n.endswith(".lottie") for n in names) == 28
    assert sum("/animations/momo-motion/" in n and n.endswith(".json") for n in names) == 28
    assert sum("/svg/" in n and n.endswith(".svg") for n in names) == 28
print(f"Packaged {len(names)} files: {OUT} ({OUT.stat().st_size / 1048576:.1f} MB)")
