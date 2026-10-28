#!/usr/bin/env python3
"""Convert user supplied Chicago PS1 OBJ to spatial GLB tiles and packed atlas.

No synthetic roads/collisions. Geometry is retained verbatim (except triangulating polygons),
with UV translation into an atlas. Source coordinates remain unchanged. Output is VISUAL ONLY.
"""
from array import array
from collections import OrderedDict, Counter
from pathlib import Path
from PIL import Image,ImageDraw
import argparse, json, math, re, struct, tempfile, zipfile

ROOT=Path(__file__).resolve().parents[1]
PAGE_NAME=re.compile(r'PAGE_(\d+)\.tga$',re.IGNORECASE)
ATLAS_SLOTS=8
TILE=256
GUTTER=2
ATLAS_SIZE=TILE*ATLAS_SLOTS
CELL_SIZE=16


def make_atlas(zippath, outfile):
    with zipfile.ZipFile(zippath) as z:
        pages={int((m:=PAGE_NAME.search(name)).group(1)):name
            for name in z.namelist() if (m:=PAGE_NAME.search(name))}
        if len(pages)!=59: print('AVISO: páginas fornecidas:',len(pages))
        slots={n:[i%ATLAS_SLOTS,i//ATLAS_SLOTS] for i,n in enumerate(sorted(pages))}
        atlas=Image.new('RGBA',(ATLAS_SIZE,ATLAS_SIZE),(0,0,0,0))
        for n,name in sorted(pages.items()):
            with z.open(name) as fd:
                im=Image.open(fd).convert('RGBA')
                if im.size!=(256,256):raise ValueError(f'Página {n}: tamanho {im.size}')
                # Preserve atlas seamless sampling by copying the outer edges into gutter.
                im=im.resize((TILE-2*GUTTER,TILE-2*GUTTER),Image.Resampling.NEAREST)
                col,row=slots[n]; x=col*TILE+GUTTER;y=row*TILE+GUTTER
                atlas.paste(im,(x,y))
                atlas.paste(im.crop((0,0,im.width,1)).resize((im.width,GUTTER)),(x,y-GUTTER))
                atlas.paste(im.crop((0,im.height-1,im.width,im.height)).resize((im.width,GUTTER)),(x,y+im.height))
                atlas.paste(im.crop((0,0,1,im.height)).resize((GUTTER,im.height)),(x-GUTTER,y))
                atlas.paste(im.crop((im.width-1,0,im.width,im.height)).resize((GUTTER,im.height)),(x+im.width,y))
        # Keep two missing materials visually distinct and recorded.
        fallbacks={128:[3,7],158:[4,7]}
        for n,(col,row) in fallbacks.items():
            slots[n]=[col,row];x=col*TILE;y=row*TILE
            draw=ImageDraw.Draw(atlas)
            draw.rectangle([x,y,x+TILE-1,y+TILE-1],fill=(113,80,132,255))
            for step in range(0,TILE,32):
                draw.line([(x+step,y),(x,y+step)],fill=(242,174,215,255),width=4)
        atlas.save(outfile,format='WEBP',lossless=True,method=5)
    return pages,slots


def scan_obj(obj, work):
    # Arrays indexed by OBJ index (1-based), kept for polygon -> GLB assembly.
    verts=array('f',[0,0,0]);tex=array('f',[0,0]);normals=array('f',[0,1,0]);
    minx=math.inf;maxx=-math.inf;minz=math.inf;maxz=-math.inf
    spool=work/'faces';spool.mkdir(exist_ok=True)
    handles=OrderedDict();counts=Counter();face_total=0;material=0
    def handle(cell):
        if cell in handles:
            fd=handles.pop(cell);handles[cell]=fd;return fd
        if len(handles)>=24:
            _,old=handles.popitem(last=False);old.close()
        fd=open(spool/f'{cell}.txt','a',encoding='ascii');handles[cell]=fd;return fd
    with obj.open('r',encoding='latin1') as fd:
        for line in fd:
            if line.startswith('v '):
                _,a,b,c,*_=line.split(); x=float(a);y=float(b);z=float(c)
                verts.extend((x,y,z));minx=min(x,minx);maxx=max(x,maxx);minz=min(z,minz);maxz=max(z,maxz)
            elif line.startswith('vt '):
                vals=line.split();tex.extend((float(vals[1]),float(vals[2])))
            elif line.startswith('vn '):
                vals=line.split();normals.extend((float(vals[1]),float(vals[2]),float(vals[3])))
            elif line.startswith('usemtl '):
                m=re.match(r'usemtl\s+page_(\d+)',line)
                if m:material=int(m.group(1))
            elif line.startswith('f '):
                pts=line.split()[1:]
                if len(pts)<3: continue
                n=0;cx=0;cz=0
                for pt in pts:
                    idx=int(pt.split('/')[0]); cx+=verts[idx*3];cz+=verts[idx*3+2];n+=1
                cx/=n;cz/=n
                ix=int(math.floor((cx+112)/CELL_SIZE)); iz=int(math.floor((cz-32)/CELL_SIZE));cell=f'{ix:02d}_{iz:02d}'
                handle(cell).write(str(material)+' '+ ' '.join(pts)+'\n')
                counts[cell]+=1;face_total+=1
    for fd in handles.values():fd.close()
    return verts,tex,normals,counts,(minx,maxx,minz,maxz),face_total


def aligned(data,alignment=4):
    pad=(-len(data))%alignment
    return data+b'\x00'*pad


def glb_from_spool(chunk,verts,uvs,normals,slots,out):
    # Single atlas material, single primitive and buffer geometry per chunk.
    positions=array('f');norms=array('f');texcoords=array('f');indices=array('I');lookup={}
    minp=[math.inf]*3;maxp=[-math.inf]*3;material_count=Counter()
    for line in chunk.open('r'):
        bits=line.split();page=int(bits[0]);material_count[page]+=1
        slot=slots.get(page)
        if slot is None: raise ValueError('Página não mapeada '+str(page))
        polygon=[]
        for entry in bits[1:]:
            vals=entry.split('/');vi=int(vals[0]);vt=int(vals[1]) if len(vals)>1 and vals[1] else 0;vn=int(vals[2]) if len(vals)>2 and vals[2] else 0
            key=(vi,vt,vn,page)
            idx=lookup.get(key)
            if idx is None:
                idx=len(positions)//3;lookup[key]=idx
                p=(verts[vi*3],verts[vi*3+1],verts[vi*3+2]);positions.extend(p)
                for i in range(3):minp[i]=min(minp[i],p[i]);maxp[i]=max(maxp[i],p[i])
                norms.extend(normals[vn*3:vn*3+3] if vn else [0,1,0])
                u=uvs[vt*2] if vt else 0.0;v=uvs[vt*2+1] if vt else 0.0
                # OBJ is bottom-up V; glTF is top-down V.
                uu=(slot[0]*TILE+GUTTER+min(1.0,max(0.0,u))*(TILE-2*GUTTER))/ATLAS_SIZE
                vv=(slot[1]*TILE+GUTTER+(1-min(1.0,max(0.0,v)))*(TILE-2*GUTTER))/ATLAS_SIZE
                texcoords.extend((uu,vv))
            polygon.append(idx)
        for i in range(1,len(polygon)-1):indices.extend((polygon[0],polygon[i],polygon[i+1]))
    if not positions:return None
    raw=bytearray();views=[];accessors=[]
    def accessor(ar,component,typename,count,mins=None,maxs=None,target=34962):
        offset=len(raw);data=ar.tobytes();raw.extend(data);raw.extend(b'\0'*((-len(raw))%4));
        views.append(dict(buffer=0,byteOffset=offset,byteLength=len(data),target=target))
        acc=dict(bufferView=len(views)-1,componentType=component,count=count,type=typename)
        if mins is not None:acc.update(min=mins,max=maxs)
        accessors.append(acc);return len(accessors)-1
    a=accessor(positions,5126,'VEC3',len(positions)//3,minp,maxp)
    b=accessor(norms,5126,'VEC3',len(norms)//3)
    c=accessor(texcoords,5126,'VEC2',len(texcoords)//2)
    d=accessor(indices,5125,'SCALAR',len(indices),target=34963)
    gltf={
        'asset':{'version':'2.0','generator':'Driver2 Chicago original OBJ conversion (geometry preserved)'},
        'scene':0,'scenes':[{'nodes':[0]}],
        'nodes':[{'mesh':0,'name':chunk.stem}],
        'meshes':[{'primitives':[{'attributes':{'POSITION':a,'NORMAL':b,'TEXCOORD_0':c},'indices':d,'material':0,'mode':4}]}],
        'buffers':[{'byteLength':len(raw)}],
        'bufferViews':views,'accessors':accessors,
        'materials':[{'name':'Chicago PS1 visual tile (shared atlas attached by runtime)',
            'doubleSided':True,'alphaMode':'MASK','alphaCutoff':0.4,
            'pbrMetallicRoughness':{'metallicFactor':0,'roughnessFactor':1}}]}
    header=json.dumps(gltf,separators=(',',':'),ensure_ascii=True).encode('utf-8')
    jsonchunk=header+b' '*((-len(header))%4)
    binary=bytes(raw)
    full_size=12+8+len(jsonchunk)+8+len(binary)
    with out.open('wb') as fd:
        fd.write(struct.pack('<4sII',b'glTF',2,full_size))
        fd.write(struct.pack('<I4s',len(jsonchunk),b'JSON'));fd.write(jsonchunk)
        fd.write(struct.pack('<I4s',len(binary),b'BIN\x00'));fd.write(binary)
    return {'id':chunk.stem,'url':'chunks/'+out.name,'faces':sum(material_count.values()),
        'triangles':len(indices)//3,'vertices':len(positions)//3,
        'bounds':{'min':[round(x,4) for x in minp], 'max':[round(x,4) for x in maxp]},
        'bytes':out.stat().st_size}


def main():
    a=argparse.ArgumentParser();a.add_argument('--obj',default='chicago_day_split.obj');a.add_argument('--textures',default='chicago_textures.zip');a.add_argument('--out',default=str(ROOT/'assets/chicago'));args=a.parse_args()
    output=Path(args.out);output.mkdir(parents=True,exist_ok=True);(output/'chunks').mkdir(exist_ok=True)
    print('Building atlas...',flush=True)
    pages,slots=make_atlas(Path(args.textures),output/'chicago_atlas.webp')
    with tempfile.TemporaryDirectory(prefix='chicago-obj-chunks-') as td:
        print('Streaming OBJ into spatial tiles...',flush=True)
        verts,uvs,normals,counts,bounds,faces=scan_obj(Path(args.obj),Path(td))
        print('OBJ faces',faces,'tiles',len(counts),'vertices',len(verts)//3-1,flush=True)
        chunks=[]
        for i,c in enumerate(sorted(counts)):
            path=Path(td)/'faces'/f'{c}.txt';target=output/'chunks'/f'{c}.glb'
            chunks.append(glb_from_spool(path,verts,uvs,normals,slots,target))
            if (i+1)%10==0:print('converted',i+1,'/',len(counts),flush=True)
    summary={
        'format':'Driver2ChicagoVisualTilesV1','source':'Chicago Split PS1 OBJ supplied by user',
        'visualOnly':True,'collisionReady':False,'roadTopologyReady':False,
        'cellSizeOriginal':CELL_SIZE,
        'bounds':{'min':[bounds[0],-0.1543,bounds[2]],'max':[bounds[1],1.92,bounds[3]]},
        'center':[(bounds[0]+bounds[1])/2,0,(bounds[2]+bounds[3])/2],
        'atlas':'chicago_atlas.webp','atlasSize':ATLAS_SIZE,
        'materialPagesSupplied':sorted(pages),'materialPagesMissing':[128,158],
        'missingPageFaceGroups':79,'faceCount':faces,'triangles':sum(c['triangles'] for c in chunks),
        'tiles':chunks}
    (output/'manifest.json').write_text(json.dumps(summary,ensure_ascii=False,separators=(',',':')))
    print('DONE',json.dumps({'chunks':len(chunks),'faces':faces,'triangles':summary['triangles'],
        'atlasBytes':(output/'chicago_atlas.webp').stat().st_size,
        'glbBytes':sum(c['bytes'] for c in chunks),'manifestBytes':(output/'manifest.json').stat().st_size}),flush=True)

if __name__=='__main__':main()
