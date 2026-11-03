"""R75 structural + pixel-mapping tests. unittest; no physical world or traffic imports."""
import importlib.util
import unittest
from pathlib import Path

from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("r75_atlas",ROOT/"tools/chicago-r75-atlas-material.py")
mod=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


class AtlasR75Test(unittest.TestCase):
    def test_source_uv_orientation_bottom_left(self):
        self.assertEqual(mod.uv_to_pixel([0,0],2048,2048),(0,2047))
        self.assertEqual(mod.uv_to_pixel([129.23,141.96],2048,2048),(129,1906))
        self.assertEqual(mod.uv_to_pixel([138.34,2047.5],2048,2048),(138,0))

    def test_reject_outside_uv(self):
        for uv in [[-1,10],[0,2048],[float("nan"),3]]:
            with self.assertRaises(ValueError):
                mod.uv_to_pixel(uv,2048,2048)

    def test_pixel_is_taken_from_exact_uv_at_bottom_left(self):
        im=Image.new("RGB",(2048,2048),(7,9,11))
        im.putpixel((129,1906),(101,102,103))
        self.assertEqual(mod.rgb_at(im,[129.23,141.96]),[101,102,103])

    def test_report_requires_unmodified_original_67_sections_and_no_runtime(self):
        sample={"format":"DriverChicagoR74SeamRootCauseAudit","edgeId":3445,
                "originalRoadCertified":False,"sourceSHA256":"fixture",
                "pointUV":{"sections":[{
                    "atOBJ":[-90.6,92.9],"offsets":[{
                        "offset": offset,"gradeHits":1,
                        "examples":[{"atlasPixel":[70,200],"pointUVPavement":offset==-.12}],
                        "verdict":"pavement_uv_inside" if offset==-.12 else
                                  "point_uses_other_atlas_material"
                    } for offset in mod.OFFSETS]
                } for _ in range(67)]}}
        source={"atlasSHA256":"sha"}
        image=Image.new("RGB",(2048,2048),(13,25,37))
        result=mod.analyze(sample,source,image)
        self.assertEqual(result["evidence"]["totalCrossSections"],67)
        self.assertEqual(result["evidence"]["byOffset"]["-0.12"]["samples"],67)
        self.assertFalse(result["runtimeRoadEnabled"])
        self.assertFalse(result["certifiedDriveableRoad"])
        self.assertFalse(result["sourceAssetsModified"])
        with self.assertRaises(ValueError):
            mod.analyze({**sample,"pointUV":{"sections":[]}},source,image)


if __name__=="__main__":
    unittest.main()
