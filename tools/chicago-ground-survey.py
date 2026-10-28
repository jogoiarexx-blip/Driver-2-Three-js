#!/usr/bin/env python3
"""Auditoria reproduzível de superfícies do Chicago original (somente leitura).

Lê os 54 GLBs da pasta chicago/, NÃO altera o modelo, e mede triângulos
horizontais próximos ao solo. Esses pixels NÃO são ruas certificadas:
incluem calçadas, pátios, água e telhados baixos.
Requer: numpy, opencv-python-headless, Pillow.
Uso: python3 tools/chicago-ground-survey.py --root chicago --output qa-artifacts/chicago-ground
"""
import argparse
import json
import struct
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw


def load_glb_triangles(path):
    data = path.read_bytes()
    if data[:4] != b'glTF' or struct.unpack_from('<I', data, 4)[0] != 2:
        raise ValueError('GLB inválido: ' + str(path))
    if len(data) != struct.unpack_from('<I', data, 8)[0]:
        raise ValueError('Tamanho GLB incorreto: ' + str(path))
    json_size, json_kind = struct.unpack_from('<I4s', data, 12)
    if json_kind != b'JSON':
        raise ValueError('Chunk JSON não encontrado: ' + str(path))
    gltf = json.loads(data[20:20 + json_size])
    at = 20 + json_size
    bin_size, bin_kind = struct.unpack_from('<I4s', data, at)
    if bin_kind != b'BIN\x00' or at + 8 + bin_size > len(data):
        raise ValueError('Chunk BIN inválido: ' + str(path))
    base = at + 8
    primitive = gltf['meshes'][0]['primitives'][0]

    def accessor(index):
        entry = gltf['accessors'][index]
        view = gltf['bufferViews'][entry['bufferView']]
        kind = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[entry['componentType']]
        width = {'VEC3': 3, 'VEC2': 2, 'SCALAR': 1}[entry['type']]
        offset = base + view.get('byteOffset', 0) + entry.get('byteOffset', 0)
        values = entry['count'] * width
        if offset + values * np.dtype(kind).itemsize > at + 8 + bin_size:
            raise ValueError('Accessor ultrapassa o GLB')
        return np.frombuffer(data, dtype=kind, count=values, offset=offset).reshape(-1, width)

    xyz = accessor(primitive['attributes']['POSITION'])
    triangles = accessor(primitive['indices']).reshape(-1, 3)
    if int(triangles.max()) >= len(xyz):
        raise ValueError('Índices fora do buffer')
    return xyz[triangles]


def survey(root, output, pixel_size=0.25):
    root, output = Path(root), Path(output)
    output.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
    if manifest['format'] != 'Driver2ChicagoVisualTilesV1':
        raise ValueError('Versão desconhecida do manifest')
    xmin, _, zmin = manifest['bounds']['min']
    xmax, _, zmax = manifest['bounds']['max']
    width = int(np.ceil((xmax - xmin) / pixel_size)) + 2
    height = int(np.ceil((zmax - zmin) / pixel_size)) + 2
    ground = np.zeros((height, width), np.uint8)
    raised = np.zeros((height, width), np.uint8)
    triangles_scanned = ground_count = raised_count = 0
    projected_ground_area = projected_raised_area = 0.0
    for tile in manifest['tiles']:
        url = tile['url']
        if not isinstance(url, str) or not __import__('re').fullmatch(r'chunks/[0-9_]+\.glb', url):
            raise ValueError('URL de setor inválida: ' + str(url))
        tris = load_glb_triangles(root / url)
        triangles_scanned += len(tris)
        ys = tris[:, :, 1]
        height_span = ys.max(axis=1) - ys.min(axis=1)
        y = ys.mean(axis=1)
        area = np.abs(
            (tris[:, 1, 0] - tris[:, 0, 0]) * (tris[:, 2, 2] - tris[:, 0, 2])
            - (tris[:, 2, 0] - tris[:, 0, 0]) * (tris[:, 1, 2] - tris[:, 0, 2])
        ) * 0.5
        floor = (height_span <= .008) & (np.abs(y) <= .028) & (area > .006)
        higher = (height_span <= .008) & (y > .028) & (y <= .38) & (area > .006)
        ground_count += int(floor.sum())
        raised_count += int(higher.sum())
        projected_ground_area += float(area[floor].sum())
        projected_raised_area += float(area[higher].sum())
        for selection, layer in ((floor, ground), (higher, raised)):
            polygons = tris[selection][:, :, [0, 2]]
            if not len(polygons):
                continue
            x = np.rint((polygons[:, :, 0] - xmin) / pixel_size).astype(np.int32)
            z = np.rint((zmax - polygons[:, :, 1]) / pixel_size).astype(np.int32)
            for points in np.stack((x, z), axis=2):
                cv2.fillConvexPoly(layer, points, 255)

    count, _, stats, _ = cv2.connectedComponentsWithStats(ground, 4)
    pixels = sorted((int(row[cv2.CC_STAT_AREA]) for row in stats[1:]), reverse=True)
    result = {
        'format': 'Driver2ChicagoGroundSurveyV1',
        'source': '54 original PS1 Chicago visual GLB tiles',
        'sourceFormat': manifest['format'],
        'tilesRead': len(manifest['tiles']),
        'trianglesScanned': triangles_scanned,
        'bounds': manifest['bounds'],
        'pixelSizeOBJ': pixel_size,
        'widthPixels': width,
        'heightPixels': height,
        'groundDefinition': {
            'maxTriangleHeightSpan': .008,
            'maxAbsMeanY': .028,
            'minProjectedArea': .006
        },
        'groundTriangleCount': ground_count,
        'groundProjectedAreaSumOBJ2': round(projected_ground_area, 1),
        'raisedTriangleCount': raised_count,
        'raisedProjectedAreaSumOBJ2': round(projected_raised_area, 1),
        'groundRasterPixels': int(np.count_nonzero(ground)),
        'rasterGroundFillFraction': round(float(np.count_nonzero(ground))/(width*height), 5),
        'surfaceRasterComponents': count - 1,
        'largestSurfaceComponentsPixels': pixels[:20],
        'laneNetworkCertified': False,
        'vehicleCollisionCertified': False,
        'roadLengthMeters': None,
        'playableCoveragePercent': None,
        'warning': 'A máscara também contém calçadas, pátios, telhados baixos e outros pisos: não é rede viária dirigível.'
    }
    (output / 'ground-survey.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    rgb = np.empty((height, width, 3), np.uint8)
    rgb[:] = (20, 33, 46)
    rgb[raised > 0] = (99, 85, 49)
    rgb[ground > 0] = (52, 153, 172)
    img = Image.fromarray(rgb, 'RGB').resize(
        (width * 2, height * 2), Image.Resampling.NEAREST)
    draw = ImageDraw.Draw(img)
    for col in range(0, width * 2, 100):
        draw.line((col, 0, col, height * 2), fill=(48, 62, 73), width=1)
    for row in range(0, height * 2, 100):
        draw.line((0, row, width * 2, row), fill=(48, 62, 73), width=1)
    img.save(output / 'chicago-ground-candidates.png', optimize=True)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='chicago')
    parser.add_argument('--output', default='qa-artifacts/chicago-ground')
    parser.add_argument('--step', type=float, default=.25)
    args = parser.parse_args()
    if args.step <= 0 or args.step > 2:
        parser.error('--step deve estar entre 0 e 2')
    survey(args.root, args.output, args.step)
