#!/usr/bin/env python3
"""R75: inspect the actual Chicago PS1 atlas pixels under R74 seam UVs.
Offline image/report only. No geometry modification, collision or traffic edits.
Uses glTF UV origin at bottom-left; PIL image origin is top-left.
"""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OFFSETS = (-0.12, -0.10, -0.08)
ATLAS = ROOT / "chicago/chicago_atlas.webp"
SURVEY = ROOT / "chicago/reference-street-survey.json"


def uv_to_pixel(uv, width, height):
    """glTF UV coordinates are bottom-left; PNG/WebP pixel coordinates are top-left."""
    if not isinstance(uv, (list, tuple)) or len(uv) != 2:
        raise ValueError("invalid UV coordinate")
    x, y = uv
    if not (math.isfinite(x) and math.isfinite(y)):
        raise ValueError("non-finite UV")
    if not (0 <= x < width and 0 <= y < height):
        raise ValueError("UV is outside source atlas")
    return min(width - 1, max(0, int(x))), min(height - 1, max(0, height - 1 - int(y)))


def rgb_at(image, uv):
    x, y = uv_to_pixel(uv, image.width, image.height)
    r, g, b = image.getpixel((x, y))[:3]
    return [int(r), int(g), int(b)]


def analyze(report, survey, image):
    if report.get("format") != "DriverChicagoR74SeamRootCauseAudit":
        raise ValueError("expected R74 source evidence")
    if report.get("edgeId") != 3445 or report.get("originalRoadCertified") is not False:
        raise ValueError("source road identity or gating changed")
    if report.get("sourceSHA256") != survey.get("sourceSHA256"):
        # The survey itself need not contain a source SHA; network hash is checked by R74.
        if survey.get("sourceSHA256") is not None:
            raise ValueError("source survey hash mismatch")
    if image.size != (2048, 2048):
        raise ValueError("original atlas dimensions have changed")
    if len(report.get("pointUV", {}).get("sections", [])) != 67:
        raise ValueError("R74 must contain 67 original cross sections")
    counts = {str(offset): collections.Counter() for offset in OFFSETS}
    samples = []
    for section in report["pointUV"]["sections"]:
        coords = []
        for offset, data in zip(OFFSETS, section["offsets"]):
            if abs(data["offset"] - offset) > 1e-7:
                raise ValueError("R74 offset order changed")
            if data["gradeHits"] != 1 or len(data["examples"]) != 1:
                raise ValueError("ambiguous source triangles at UV probe")
            uv = data["examples"][0]["atlasPixel"]
            rgb = rgb_at(image, uv)
            counts[str(offset)][tuple(rgb)] += 1
            coords.append({"offsetOBJ": offset, "atlasUVPixel": uv, "sourceRGB": rgb,
                           "r74Verdict": data["verdict"]})
        samples.append({"sourceXZOBJ": section["atOBJ"], "materials": coords})
    def summary(k):
        colors = counts[str(k)]
        return {"samples": sum(colors.values()),
                "distinctColors": len(colors),
                "topRGB": [{"rgb": list(rgb), "count": n} for rgb, n in colors.most_common(8)]}
    return {
        "format": "DriverChicagoR75SourceAtlasPixels",
        "edgeId": 3445, "sourceSHA256": report["sourceSHA256"],
        "atlasSHA256": survey["atlasSHA256"], "atlasSize": list(image.size),
        "uvOrigin": "bottom-left glTF; mapped to PIL top-left with vertical inversion",
        "offsetsOBJ": list(OFFSETS),
        "evidence": {"totalCrossSections": len(samples),
                     "byOffset": {str(k): summary(k) for k in OFFSETS}},
        "certifiedDriveableRoad": False, "runtimeRoadEnabled": False,
        "sourceAssetsModified": False,
        "warning": "Pixel colors are evidence, not automatically sidewalks, lanes or drivable road surfaces.",
        "crossSections": samples
    }


def draw_contact_sheet(image, result, destination):
    indexes = [0, 16, 32, 48, 66]
    crop = 18
    tile = 195
    margin = 20
    sheet = Image.new("RGB", (3 * tile + 2 * margin, 5 * tile + 92), (20, 28, 38))
    canvas = ImageDraw.Draw(sheet)
    canvas.text((margin, 10), "PS1 CHICAGO — ORIGINAL ATLAS, R75", fill=(235, 240, 245))
    canvas.text((margin, 29), "GLTF UV Y inverted for image pixels • no road certification",
                fill=(160, 180, 195))
    for row, idx in enumerate(indexes):
        section = result["crossSections"][idx]
        canvas.text((margin, 55 + row * tile),
                    "section {}  x={}  z={}".format(idx, *section["sourceXZOBJ"]),
                    fill=(235, 220, 175))
        for col, item in enumerate(section["materials"]):
            x, y = uv_to_pixel(item["atlasUVPixel"], image.width, image.height)
            patch = image.crop((x - crop, y - crop, x + crop + 1, y + crop + 1))
            patch = patch.resize((144, 144), Image.Resampling.NEAREST)
            left = margin + col * tile
            top = 77 + row * tile
            sheet.paste(patch.convert("RGB"), (left, top))
            canvas.rectangle((left + 68, top + 68, left + 76, top + 76),
                             outline=(255, 245, 80), width=2)
            canvas.text((left + 148, top + 2), f'{item["offsetOBJ"]:+.2f}',
                        fill=(240, 245, 245))
            canvas.text((left + 1, top + 148),
                        f'UV {item["atlasUVPixel"][0]:.1f},{item["atlasUVPixel"][1]:.1f}',
                        fill=(214, 230, 232))
            canvas.text((left + 1, top + 163),
                        "RGB {}".format(",".join(map(str,item["sourceRGB"]))),
                        fill=(214, 230, 232))
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, optimize=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", default="qa-artifacts/chicago-r75/seam-r74.json")
    parser.add_argument("--output", default="qa-artifacts/chicago-r75/atlas-materials.json")
    parser.add_argument("--image", default="qa-artifacts/chicago-r75/atlas-contact-sheet.png")
    args = parser.parse_args()
    survey = json.loads(SURVEY.read_text("utf8"))
    digest = hashlib.sha256(ATLAS.read_bytes()).hexdigest()
    if digest != survey["atlasSHA256"]:
        raise ValueError("source atlas SHA256 does not match original R24 survey")
    with Image.open(ATLAS) as im:
        im = im.convert("RGB")
        report = json.loads((ROOT / args.report).read_text("utf8"))
        result = analyze(report, survey, im)
        (ROOT / args.output).parent.mkdir(parents=True, exist_ok=True)
        (ROOT / args.output).write_text(json.dumps(result, indent=2)+"\n", "utf8")
        draw_contact_sheet(im, result, ROOT / args.image)
    print("CHICAGO_R75_ATLAS_PIXELS", json.dumps({
        "atlasSHA256": result["atlasSHA256"], "sections": 67,
        "colors": result["evidence"]["byOffset"],
        "certifiedDriveableRoad": False, "output": args.output,
        "image": args.image
    }))


if __name__ == "__main__":
    main()
