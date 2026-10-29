#!/usr/bin/env python3
"""Whole-map evidence from all 54 original GLBs; not a certified lane network.

Classifies low surfaces by atlas regions inspected in the supplied texture.
Road markings, unmarked paving, grass and water stay separate. No dilation
fills holes: a missing polygon remains missing evidence.
"""
import argparse, base64, gzip, hashlib, json, struct
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

REGIONS={
    'markedPaving':[65,191,128,254],
    'plainPaving':[2,88,65,152],
    'grass':[447,2,510,65],
    'water':[257,191,320,254]
}

def read_glb(path):
    raw=path.read_bytes()
    if raw[:4]!=b'glTF' or struct.unpack_from('<I',raw,8)[0]!=len(raw):
        raise ValueError('Invalid GLB '+str(path))
    size,kind=struct.unpack_from('<I4s',raw,12)
    if kind!=b'JSON':raise ValueError('Missing JSON')
    doc=json.loads(raw[20:20+size]);offset=28+size
    prim=doc['meshes'][0]['primitives'][0]
    def acc(index):
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
        width={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]
        dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']]
        if 'byteStride' in v:raise ValueError('Interleaved buffer unsupported')
        return np.frombuffer(raw,dtype=dtype,count=a['count']*width,
            offset=offset+v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,width)
    indices=acc(prim['indices']).reshape(-1,3)
    return acc(prim['attributes']['POSITION'])[indices],acc(prim['attributes']['TEXCOORD_0'])[indices]


def build(root,output,preview):
    root=Path(root);manifest=json.loads((root/'manifest.json').read_text())
    if len(manifest['tiles'])!=54:raise ValueError('Expected all 54 tiles')
    xmin,_,zmin=manifest['bounds']['min'];xmax,_,zmax=manifest['bounds']['max']
    step=.125;width=int(np.ceil((xmax-xmin)/step))+2;height=int(np.ceil((zmax-zmin)/step))+2
    layers={name:Image.new('1',(width,height)) for name in REGIONS}
    draws={name:ImageDraw.Draw(layer) for name,layer in layers.items()}
    records=[];total=0
    for tile in manifest['tiles']:
        file=root/tile['url'];tri,uv=read_glb(file);total+=len(tri)
        yy=tri[:,:,1];mean=yy.mean(axis=1);span=np.ptp(yy,axis=1)
        # Heights include low decks/ramps, but not facades or roofs.
        ground=(span<=.16)&(mean>=-.18)&(mean<=.18)
        lo=uv.min(axis=1)*2048;hi=uv.max(axis=1)*2048
        found={}
        for name,(x0,y0,x1,y1) in REGIONS.items():
            selected=np.where(ground&(lo[:,0]>=x0)&(lo[:,1]>=y0)&
                (hi[:,0]<=x1)&(hi[:,1]<=y1))[0]
            found[name]=len(selected)
            for item in tri[selected]:
                points=[(int(round((x-xmin)/step)),int(round((zmax-z)/step))) for x,_,z in item]
                draws[name].polygon(points,fill=1)
        records.append({'id':tile['id'],'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),
            'triangles':len(tri),'selected':found})
    if total!=manifest['triangles']:raise ValueError('Triangle count mismatch')
    result={'format':'Driver2ChicagoReferenceStreetsV1','tilesRead':54,'trianglesRead':total,
        'atlasSHA256':hashlib.sha256((root/manifest['atlas']).read_bytes()).hexdigest(),
        'coordinateSystem':'original OBJ, positive Z as in supplied geometry',
        'xminOBJ':xmin,'zmaxOBJ':zmax,'stepOBJ':step,'width':width,'height':height,
        'atlasRegionsPixels':REGIONS,'tiles':records,'layers':{},
        'streetsCertified':False,'navigationCertified':False,'missionsMigrated':False,
        'limitations':'Texture-classified surface evidence; paving includes sidewalks and yards. Missing materials and bridges require independent inspection. No inferred connections or lane directions.'}
    rgb=np.full((height,width,3),(24,35,46),np.uint8)
    colors={'grass':(62,107,65),'water':(40,99,128),
        'plainPaving':(132,137,139),'markedPaving':(242,207,105)}
    for name in ['grass','water','plainPaving','markedPaving']:
        bits=np.array(layers[name],dtype=np.uint8)
        result['layers'][name]={'pixels':int(bits.sum()),
            'gzipBitsetBase64':base64.b64encode(gzip.compress(np.packbits(bits.reshape(-1),bitorder='big').tobytes(),mtime=0)).decode()}
        rgb[bits>0]=colors[name]
    Path(output).write_text(json.dumps(result,separators=(',',':'))+'\n')
    if preview:Image.fromarray(rgb).save(preview)
    print(json.dumps({'tiles':len(records),'triangles':total,'pixels':{k:v['pixels'] for k,v in result['layers'].items()}}))
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',default='chicago')
    p.add_argument('--output',default='chicago/reference-street-survey.json');p.add_argument('--preview')
    a=p.parse_args();build(a.root,a.output,a.preview)
