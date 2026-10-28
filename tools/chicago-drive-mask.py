#!/usr/bin/env python3
"""Converte geometria PS1 em região transitável experimental para passeio livre.

Não classifica ruas nominalmente e não altera física, IA ou colisores das missões.
Os pixels incluem pisos/plataformas e são conservadores: fora da máscara = bloqueado.
A referência permanece a geometria original nos 54 GLBs em chicago/chunks/.
"""
import argparse
import base64
import gzip
import json
import math
import re
import struct
from pathlib import Path

import cv2
import numpy as np


def load_triangles(filename):
    data=filename.read_bytes()
    if data[:4]!=b'glTF' or struct.unpack_from('<I',data,4)[0]!=2:
        raise ValueError('GLB inválido: '+str(filename))
    if struct.unpack_from('<I',data,8)[0]!=len(data):
        raise ValueError('Tamanho GLB incorreto')
    size,kind=struct.unpack_from('<I4s',data,12)
    if kind!=b'JSON':raise ValueError('Chunk JSON ausente')
    document=json.loads(data[20:20+size])
    offset=20+size
    bsize,btype=struct.unpack_from('<I4s',data,offset)
    if btype!=b'BIN\x00':raise ValueError('Chunk BIN ausente')
    start=offset+8
    p=document['meshes'][0]['primitives'][0]

    def read(index):
        a=document['accessors'][index]
        v=document['bufferViews'][a['bufferView']]
        dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']]
        width={'VEC3':3,'SCALAR':1}[a['type']]
        position=start+v.get('byteOffset',0)+a.get('byteOffset',0)
        count=a['count']*width
        if position+count*np.dtype(dtype).itemsize>start+bsize:
            raise ValueError('Buffer excedido')
        return np.frombuffer(data,dtype=dtype,count=count,offset=position).reshape(-1,width)

    vertices=read(p['attributes']['POSITION'])
    triangles=read(p['indices']).reshape(-1,3)
    if int(triangles.max())>=len(vertices):raise ValueError('Índice inválido')
    return vertices[triangles]


def build(root, output):
    root,output=Path(root),Path(output)
    manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
    if manifest['format']!='Driver2ChicagoVisualTilesV1' or len(manifest['tiles'])!=54:
        raise ValueError('Esperado o mapa completo de 54 setores')
    step=.25;scale=3.4
    xmin,_,zmin=manifest['bounds']['min']
    xmax,_,zmax=manifest['bounds']['max']
    width=int(math.ceil((xmax-xmin)/step))+2
    height=int(math.ceil((zmax-zmin)/step))+2
    ground=np.zeros((height,width),np.uint8)
    elevated=np.zeros((height,width),np.uint8)
    total=0
    for tile in manifest['tiles']:
        if not re.fullmatch(r'chunks/[0-9_]+\.glb',tile['url']):
            raise ValueError('Caminho não permitido '+tile['url'])
        tris=load_triangles(root/tile['url']);total+=len(tris)
        y=tris[:,:,1]
        dy=y.max(axis=1)-y.min(axis=1)
        area=.5*np.abs(
            (tris[:,1,0]-tris[:,0,0])*(tris[:,2,2]-tris[:,0,2])-
            (tris[:,2,0]-tris[:,0,0])*(tris[:,1,2]-tris[:,0,2]))
        floor=(dy<=.022)&(np.abs(y.mean(axis=1))<=.04)&(area>.002)
        raised=(dy<=.032)&(y.mean(axis=1)>.04)&(y.mean(axis=1)<=.16)&(area>.002)
        for selection,mask in ((floor,ground),(raised,elevated)):
            polygons=tris[selection][:,:,[0,2]]
            if not len(polygons):continue
            px=np.rint((polygons[:,:,0]-xmin)/step).astype(np.int32)
            pz=np.rint((zmax-polygons[:,:,1])/step).astype(np.int32)
            for tri in np.stack((px,pz),axis=2):
                cv2.fillConvexPoly(mask,tri,255)
    if total!=sum(t['triangles'] for t in manifest['tiles']):
        raise ValueError('Contagem de triângulos inconsistente')
    joined=cv2.morphologyEx(cv2.bitwise_or(ground,elevated),
        cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    clearance=cv2.distanceTransform(joined,cv2.DIST_L2,3)
    safe=(clearance>=2.2).astype(np.uint8)
    count,labels,stats,_=cv2.connectedComponentsWithStats(safe,8)
    ranking=sorted(((int(stats[i,cv2.CC_STAT_AREA]),i)
        for i in range(1,count)),reverse=True)
    if not ranking:raise ValueError('Nenhuma área de direção encontrada')
    component=ranking[0][1]
    ys,xs=np.where((labels==component)&(clearance>=4))
    candidates=np.where((xs>width*.30)&(xs<width*.72)&
        (ys>height*.36)&(ys<height*.69))[0]
    if not len(candidates):candidates=np.arange(len(xs))
    metric=clearance[ys[candidates],xs[candidates]]-(
        np.abs(xs[candidates]-width*.5)+np.abs(ys[candidates]-height*.52))*.025
    n=candidates[int(np.argmax(metric))]
    px,pz=int(xs[n]),int(ys[n])
    best=(0,0,-1)
    for dx,dz in ((0,-1),(-1,0),(0,1),(1,0),(-1,-1),(1,-1),(1,1),(-1,1)):
        travel=0
        for i in range(1,60):
            x=px+int(round(dx*i));z=pz+int(round(dz*i))
            if x<0 or z<0 or x>=width or z>=height or not safe[z,x]:break
            travel=i
        if travel>best[0]:best=(travel,dx,dz)
    centerx,_,centerz=manifest['center']
    bitpack=np.packbits(safe.reshape(-1),bitorder='big').tobytes()
    encoded=base64.b64encode(gzip.compress(bitpack,compresslevel=9,mtime=0)).decode('ascii')
    result={
        'format':'Driver2ChicagoDriveMaskV1','tiles':54,'triangles':total,
        'width':width,'height':height,'stepOBJ':step,'xminOBJ':xmin,
        'zmaxOBJ':zmax,'scale':scale,'centerOBJ':[centerx,centerz],
        'gzipBitsetBase64':encoded,'bitOrder':'msb',
        'minClearancePixels':2.2,
        'spawn':{
            'x':round((xmin+px*step-centerx)*scale,3),
            'z':round((zmax-pz*step-centerz)*scale,3),
            'heading':round(math.atan2(best[1],-best[2]),5)
        },
        'safePixels':int(np.count_nonzero(safe)),
        'largestComponentPixels':ranking[0][0],
        'groundCertified':False,'roadCertified':False,
        'missionLocationsMigrated':False,
        'limitations':'Mapa experimental de pisos sem classificação de vias, pontes e colisores 3D completos; exclusivo do Passeio Livre PS1.'
    }
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,separators=(',',':'))+'\n',encoding='utf-8')
    print('PASS: 54 GLBs,',total,'triângulos,',result['safePixels'],
        'pixels de solo seguro, spawn',result['spawn'])
    return result


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--root',default='chicago')
    parser.add_argument('--output',default='chicago/drive-mask.json')
    args=parser.parse_args()
    build(args.root,args.output)
