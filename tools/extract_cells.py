"""Split the granulopoiesis artwork sheet into one standalone SVG per stage.

Each top-level element of the sheet is assigned to a stage by its id, the
original artwork (paths, grain filters, granules) is copied untouched, and each
output gets a square viewBox around its circle. Cell sizes stay true to the
sheet: the viewBox is the circle's bounding box, so px-per-unit is identical
across stages and relative sizes are preserved.

Usage: python tools/extract_cells.py
"""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src/apps/granulopoiesis/art/granulopoiesis_v4.2_sizes_granules_circleversion.svg"
OUT = ROOT / "src/apps/granulopoiesis/cells"

SVG = "http://www.w3.org/2000/svg"
for prefix, uri in {
    "": SVG,
    "inkscape": "http://www.inkscape.org/namespaces/inkscape",
    "sodipodi": "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd",
}.items():
    ET.register_namespace(prefix, uri)

# stage name, circle id, (cx, cy, r) from the sheet
STAGES = [
    ("myeloblast", "path955", (234.17332, 228.83707, 192)),
    ("promyelocyte", "path955-10", (637.34436, 231.76158, 192)),
    ("myelocyte", "path955-3", (195.96104, 628.68115, 144)),
    ("metamyelocyte", "path955-3-1", (511.80682, 633.48163, 144)),
    ("band", "path955-1", (875.66852, 485.25076, 96)),
    ("neutrophil", "path955-1-3", (849.79248, 697.21606, 96)),
]
# Elements whose id does not carry the stage name.
EXTRA = {"path15844-0": "myeloblast", "path15844-0-9": "promyelocyte"}
ID_KEYS = {
    "myeloblast": "myeloblast",
    "promyelocyte": "promyelocyte",
    "myelocyte": "myelocyte",
    "metamyelocyte": "metamyelocyte",
    "banded_neutrophil": "band",
    "mature_neutrophil": "neutrophil",
}
circle_ids = {cid: name for name, cid, _ in STAGES}


def stage_of(el):
    eid = el.get("id", "")
    if eid in circle_ids:
        return circle_ids[eid]
    if eid in EXTRA:
        return EXTRA[eid]
    # longest key first so "metamyelocyte" is not matched as "myelocyte"
    for key in sorted(ID_KEYS, key=len, reverse=True):
        if key in eid:
            return ID_KEYS[key]
    return None


def local(tag):
    return tag.rsplit("}", 1)[-1]


def main():
    tree = ET.parse(SRC)
    root = tree.getroot()
    defs = next(c for c in root if local(c.tag) == "defs")
    by_stage = {name: [] for name, _, _ in STAGES}
    for el in root:
        if local(el.tag) in ("defs", "namedview"):
            continue
        stage = stage_of(el)
        if stage is None:
            print("unassigned element:", el.get("id"), file=sys.stderr)
            continue
        by_stage[stage].append(el)

    OUT.mkdir(parents=True, exist_ok=True)
    for name, _, (cx, cy, r) in STAGES:
        body = by_stage[name]
        used = set(re.findall(r"url\(#([^)]+)\)", "".join(ET.tostring(e, encoding="unicode") for e in body)))
        new = ET.Element(f"{{{SVG}}}svg", {
            "viewBox": f"{cx - r:.3f} {cy - r:.3f} {2 * r} {2 * r}",
            "width": str(2 * r),
            "height": str(2 * r),
        })
        new_defs = ET.SubElement(new, f"{{{SVG}}}defs")
        for d in defs:
            if d.get("id") in used or local(d.tag) == "style":
                new_defs.append(d)
        for e in body:
            new.append(e)
        out = OUT / f"{name}.svg"
        ET.ElementTree(new).write(out, encoding="utf-8", xml_declaration=True)
        print(f"{name}: {len(body)} elements, {len(used)} filters, {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
