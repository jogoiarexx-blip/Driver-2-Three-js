#!/usr/bin/env python3
"""Extract an ungraded surface graph and one reproducible source-road curve.

Graph candidates include unmarked paving (which also includes sidewalks).
They are evidence for reconstruction, never automatic traffic/mission routes.
"""
import argparse,base64,gzip,hashlib,heapq,json,math
from pathlib import Path
import numpy as np
from scipy.ndimage import distance_transform_edt,label


def layer(data,name):
    raw=gzip.decompress(base64.b64decode(data['layers'][name]['gzipBitsetBase64']))
    return np.unpackbits(np.frombuffer(raw,np.uint8),bitorder='big')[:data['width']*data['height']].reshape(data['height'],data['width']).astype(bool)


def thin(mask):
    a=np.pad(mask,1).astype(np.uint8)
    while True:
        changed=0
        for step in (0,1):
            p=[a[:-2,1:-1],a[:-2,2:],a[1:-1,2:],a[2:,2:],
               a[2:,1:-1],a[2:,:-2],a[1:-1,:-2],a[:-2,:-2]]
            count=sum(p);transitions=sum((p[i]==0)&(p[(i+1)%8]==1) for i in range(8))
            remove=(a[1:-1,1:-1]==1)&(count>=2)&(count<=6)&(transitions==1)
            if step==0:remove&=(p[0]*p[2]*p[4]==0)&(p[2]*p[4]*p[6]==0)
            else:remove&=(p[0]*p[2]*p[6]==0)&(p[0]*p[4]*p[6]==0)
            changed+=int(remove.sum());a[1:-1,1:-1][remove]=0
        if not changed:return a[1:-1,1:-1].astype(bool)


def simplify(points,tolerance):
    if len(points)<=2:return points
    a=np.array(points[0],float);b=np.array(points[-1],float);v=b-a
    p=np.array(points,float)
    t=np.clip(((p-a)@v)/max(float(v@v),1e-12),0,1)
    distances=np.linalg.norm(p-a-t[:,None]*v,axis=1)
    i=int(np.argmax(distances))
    if distances[i]<=tolerance:return [points[0],points[-1]]
    return simplify(points[:i+1],tolerance)[:-1]+simplify(points[i:],tolerance)


def graph(mask,data):
    skeleton=thin(mask);pixels=set(zip(*np.where(skeleton)))
    def neighbors(p):
        y,x=p;out=[]
        for dy,dx in [(-1,0),(0,1),(1,0),(0,-1),(-1,-1),(-1,1),(1,-1),(1,1)]:
            q=(y+dy,x+dx)
            if q not in pixels:continue
            if dy and dx and ((y+dy,x) in pixels or (y,x+dx) in pixels):continue
            out.append(q)
        return sorted(out)
    adjacent={p:neighbors(p) for p in pixels}
    nodes={p for p in pixels if len(adjacent[p])!=2}
    visited=set();components=0
    for p in sorted(pixels):
        if p in visited:continue
        components+=1;queue=[p];visited.add(p);hasnode=p in nodes
        for cur in queue:
            for q in adjacent[cur]:
                if q not in visited:visited.add(q);queue.append(q);hasnode|=q in nodes
        if not hasnode:nodes.add(p)
    ordered=sorted(nodes);ids={p:i for i,p in enumerate(ordered)}
    def obj(p):
        y,x=p;return [round(data['xminOBJ']+x*data['stepOBJ'],6),round(data['zmaxOBJ']-y*data['stepOBJ'],6)]
    edges=[];used=set()
    for p in ordered:
        for q in adjacent[p]:
            key=tuple(sorted((p,q)))
            if key in used:continue
            path=[p,q];used.add(key);prev,cur=p,q
            while cur not in nodes:
                nxt=next(n for n in adjacent[cur] if n!=prev)
                used.add(tuple(sorted((cur,nxt))));path.append(nxt);prev,cur=cur,nxt
            # Pixel-space tolerance 1 = 0.125 OBJ; topology stays ungraded.
            points=simplify(path,1)
            edges.append({'from':ids[p],'to':ids[cur],'sourcePixels':len(path),
                'lengthOBJ':round(sum(math.dist(a,b)*data['stepOBJ'] for a,b in zip(path,path[1:])),6),
                'pointsOBJ':[obj(p) for p in points]})
    return {'nodes':[{'id':i,'pointOBJ':obj(p),'degree':len(adjacent[p])} for i,p in enumerate(ordered)],
        'edges':edges,'components':components,'skeletonPixels':len(pixels)}


def source_curve(marked,data,start=(1400,173),end=(1480,230),bounds=(1395,1486,160,245)):
    # Hand-inspected bounds in the immutable R14 reference raster. The path
    # itself is calculated on actual painted-paving pixels, not hand drawn.
    y0,y1,x0,x1=bounds;mask=np.zeros_like(marked);mask[y0:y1,x0:x1]=marked[y0:y1,x0:x1]
    if not mask[start] or not mask[end]:raise ValueError('Source curve anchors no longer lie on marked paving')
    distance=distance_transform_edt(mask);queue=[(0,start)];cost={start:0};previous={}
    while queue:
        value,p=heapq.heappop(queue)
        if value!=cost[p]:continue
        if p==end:break
        for dy,dx in [(-1,0),(0,1),(1,0),(0,-1),(-1,-1),(-1,1),(1,-1),(1,1)]:
            q=(p[0]+dy,p[1]+dx)
            if not (y0<=q[0]<y1 and x0<=q[1]<x1) or not mask[q]:continue
            weight=math.hypot(dx,dy)*(1+8/(distance[q]+.25))
            new=value+weight
            if new<cost.get(q,math.inf):cost[q]=new;previous[q]=p;heapq.heappush(queue,(new,q))
    if end not in cost:raise ValueError('Marked source curve is disconnected; do not invent a connection')
    path=[end]
    while path[-1]!=start:path.append(previous[path[-1]])
    path.reverse();points=simplify(path,.65)
    return {'format':'Driver2ChicagoSourceCurveR15','sourceBoundsPixels':list(bounds),
        'sourcePixels':[[x,y] for y,x in path],
        'pointsOBJ':[[round(data['xminOBJ']+x*data['stepOBJ'],6),round(data['zmaxOBJ']-y*data['stepOBJ'],6)] for y,x in points],
        'originalPlacementCertified':False,'fullMapCertified':False,
        'placement':'Similarity fit into one legacy Undercover block; source shape preserved, original position not claimed.'}


def build(source,out):
    source=Path(source);out=Path(out);d=json.loads(source.read_text());digest=hashlib.sha256(source.read_bytes()).hexdigest()
    marked=layer(d,'markedPaving');plain=layer(d,'plainPaving')
    network=graph(marked|plain,d)
    network.update({'format':'Driver2ChicagoReferenceNetworkV1','sourceSHA256':digest,
        'tilesRead':d['tilesRead'],'trianglesRead':d['trianglesRead'],
        'gradedJunctionsCertified':False,'trafficRoutesCertified':False,'missionsMigrated':False,
        'limitations':'Surface skeleton includes sidewalks/yards and projected overpasses. Crossings are not certified at grade. No one-way, speed or lane data.'})
    curve=source_curve(marked,d);curve['sourceSHA256']=digest
    (out/'reference-network.json').write_text(json.dumps(network,separators=(',',':'))+'\n')
    (out/'reference-curve-r15.json').write_text(json.dumps(curve,separators=(',',':'))+'\n')
    (out/'reference-curve-r15.js').write_text('/* Generated from the supplied PS1 marked-paving surface; see tools/chicago-reference-network.py. */\nconst DriverChicagoSourceCurveR15='+json.dumps(curve,separators=(',',':'))+';\n')
    extension=source_curve(marked|plain,d,start=(1400,173),end=(1300,173),bounds=(1295,1401,170,200))
    extension.update(sourceLayers=['markedPaving','plainPaving'],format='Driver2ChicagoSourceExtensionR16',sourceSHA256=digest,placement='Same uniform transform as R15; adapted geography, not original neighborhood coordinates.')
    (out/'reference-extension-r16.json').write_text(json.dumps(extension,separators=(',',':'))+'\n')
    (out/'reference-extension-r16.js').write_text('/* Generated by tools/chicago-reference-network.py */\nconst DriverChicagoSourceExtensionR16='+json.dumps(extension,separators=(',',':'))+';\n')
    loop=source_curve(marked|plain,d,start=(1400,173),end=(1300,173),bounds=(1295,1401,145,177))
    loop.update(sourceLayers=['markedPaving','plainPaving'],format='Driver2ChicagoSourceLoopR17',sourceSHA256=digest,placement='Same similarity fit as R15/R16; western branch closes their source loop. Adapted world placement.')
    (out/'reference-loop-r17.json').write_text(json.dumps(loop,separators=(',',':'))+'\n')
    (out/'reference-loop-r17.js').write_text('/* Generated by tools/chicago-reference-network.py */\nconst DriverChicagoSourceLoopR17='+json.dumps(loop,separators=(',',':'))+';\n')
    bridge=source_curve(marked|plain,d,start=(1300,173),end=(1140,172),bounds=(1130,1301,160,190))
    bridge.update(sourceLayers=['markedPaving','plainPaving'],format='Driver2ChicagoSourceBridgeR18',sourceSHA256=digest,placement='Same R15 similarity fit; adapted crossing of the legacy Undercover canal. Bridge grade is reconstructed, not certified from projected pixels.')
    (out/'reference-bridge-r18.json').write_text(json.dumps(bridge,separators=(',',':'))+'\n')
    (out/'reference-bridge-r18.js').write_text('/* Generated by tools/chicago-reference-network.py */\nconst DriverChicagoSourceBridgeR18='+json.dumps(bridge,separators=(',',':'))+';\n')
    print(json.dumps({'nodes':len(network['nodes']),'edges':len(network['edges']),
        'components':network['components'],'skeletonPixels':network['skeletonPixels'],
        'curveSourcePixels':len(curve['sourcePixels']),'curveVertices':len(curve['pointsOBJ'])}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',default='chicago/reference-street-survey.json');p.add_argument('--out',default='chicago');a=p.parse_args();build(a.source,a.out)
