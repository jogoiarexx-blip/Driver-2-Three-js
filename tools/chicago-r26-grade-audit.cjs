#!/usr/bin/env node
'use strict';
/**
 * Chicago R26: raster actual 3-D heights from all 54 ORIGINAL PS1 GLBs.
 * No interpolation across missing GLB polygons. Only texture-compatible
 * horizontal or gentle-slope paving triangles contribute.
 *
 * Run: node tools/chicago-r26-grade-audit.cjs [output.json]
 * This is strictly an AUDIT; cannot certify lanes or register traffic paths.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const Guard=require('../js/world/chicago-grade-guard-r26.js');
const Pavement=require('../js/world/chicago-road-evidence-r24.js');
const Root=path.resolve(__dirname,'..');
const REGIONS=[[65,191,128,254],[2,88,65,152]];
function glbAccessors(file){
    const buf=fs.readFileSync(file);
    if(buf.length<32||buf.toString('ascii',0,4)!=='glTF'||
       buf.readUInt32LE(4)!==2||buf.readUInt32LE(8)!==buf.length)
        throw Error('Invalid GLB: '+file);
    const jsonLen=buf.readUInt32LE(12);
    if(buf.toString('ascii',16,20)!=='JSON')
        throw Error('Missing JSON GLB chunk');
    const doc=JSON.parse(buf.toString('utf8',20,20+jsonLen));
    const start=20+jsonLen;
    const binLen=buf.readUInt32LE(start);
    if(buf.toString('ascii',start+4,start+7)!=='BIN'||
       start+8+binLen>buf.length)throw Error('Invalid GLB BIN chunk');
    const base=start+8,prim=doc.meshes?.[0]?.primitives?.[0];
    if(!prim)throw Error('No GLB primitive');
    function accessor(index){
        const a=doc.accessors[index],view=doc.bufferViews[a.bufferView];
        const bytes={5126:4,5125:4,5123:2}[a.componentType];
        const width={VEC3:3,VEC2:2,SCALAR:1}[a.type];
        if(!bytes||!width||view.byteStride)
            throw Error('Unsupported interleaved/index GLB accessor');
        const off=base+(view.byteOffset||0)+(a.byteOffset||0);
        const end=off+a.count*width*bytes;
        if(off<base||end>base+binLen)
            throw Error('GLB accessor out of BIN bounds');
        return {count:a.count,width,type:a.componentType,
            get:(i,j=0)=>{
                if(i<0||i>=a.count||j<0||j>=width)
                    throw Error('GLB accessor index overflow');
                const loc=off+(i*width+j)*bytes;
                if(a.componentType===5126)return buf.readFloatLE(loc);
                return bytes===2?buf.readUInt16LE(loc):buf.readUInt32LE(loc);
            }};
    }
    const pos=accessor(prim.attributes.POSITION);
    const uv=accessor(prim.attributes.TEXCOORD_0);
    const indices=accessor(prim.indices);
    if(indices.count%3||pos.count!==uv.count)
        throw Error('GLB indices or geometry malformed');
    return {pos,uv,indices,triangles:indices.count/3};
}
function makeRaster(survey){
    const n=survey.width*survey.height;
    const minY=new Float32Array(n);minY.fill(Infinity);
    const maxY=new Float32Array(n);maxY.fill(-Infinity);
    const count=new Uint16Array(n);
    return {xminOBJ:survey.xminOBJ,zmaxOBJ:survey.zmaxOBJ,
        stepOBJ:survey.stepOBJ,width:survey.width,height:survey.height,
        minY,maxY,count,tilesRead:0,trianglesRead:0,
        trianglesConsidered:0,trianglesRasterized:0,pixelsHit:0};
}
function rasterizeTriangle(raster,tri){
    const {width,height,stepOBJ:step,xminOBJ:xmin,zmaxOBJ:zmax}=raster;
    const vertices=tri.map(p=>[(p[0]-xmin)/step,(zmax-p[2])/step]);
    const [a,b,c]=vertices;
    const denom=(b[1]-c[1])*(a[0]-c[0])+
                (c[0]-b[0])*(a[1]-c[1]);
    if(!Number.isFinite(denom)||Math.abs(denom)<1e-8)return 0;
    const xminC=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),
        xmaxC=Math.min(width-1,Math.ceil(Math.max(a[0],b[0],c[0]))),
        zminC=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),
        zmaxC=Math.min(height-1,Math.ceil(Math.max(a[1],b[1],c[1])));
    if(xminC>xmaxC||zminC>zmaxC)return 0;
    let count=0;
    for(let row=zminC;row<=zmaxC;row++){
        const base=row*width;
        for(let col=xminC;col<=xmaxC;col++){
            const u=((b[1]-c[1])*(col-c[0])+
                (c[0]-b[0])*(row-c[1]))/denom;
            if(u<-.0001||u>1.0001)continue;
            const v=((c[1]-a[1])*(col-c[0])+
                (a[0]-c[0])*(row-c[1]))/denom;
            if(v<-.0001||u+v>1.0001)continue;
            const y=tri[0][1]*u+tri[1][1]*v+
                tri[2][1]*(1-u-v);
            const id=base+col;
            if(y<raster.minY[id])raster.minY[id]=y;
            if(y>raster.maxY[id])raster.maxY[id]=y;
            if(raster.count[id]<65535)raster.count[id]++;
            count++;
        }
    }
    return count;
}
function inspectTile(file,raster){
    const {pos,uv,indices,triangles}=glbAccessors(file);
    raster.trianglesRead+=triangles;
    let accepted=0,hit=0;
    for(let i=0;i<indices.count;i+=3){
        const ids=[indices.get(i),indices.get(i+1),indices.get(i+2)];
        const xyz=ids.map(k=>[pos.get(k,0),pos.get(k,1),pos.get(k,2)]);
        const ys=xyz.map(p=>p[1]);
        const span=Math.max(...ys)-Math.min(...ys);
        if(span>.16||Math.min(...ys)<-.18||Math.max(...ys)>2.05)
            continue;
        const tex=ids.map(k=>[uv.get(k,0)*2048,uv.get(k,1)*2048]);
        const l=[Math.min(...tex.map(p=>p[0])),
            Math.min(...tex.map(p=>p[1]))],
            h=[Math.max(...tex.map(p=>p[0])),
                Math.max(...tex.map(p=>p[1]))];
        if(!REGIONS.some(([x0,y0,x1,y1])=>
            l[0]>=x0-1e-4&&l[1]>=y0-1e-4&&
            h[0]<=x1+1e-4&&h[1]<=y1+1e-4))continue;
        accepted++;
        hit+=rasterizeTriangle(raster,xyz);
    }
    raster.tilesRead++;
    raster.trianglesConsidered+=accepted;
    raster.trianglesRasterized+=hit>0?1:0;
    raster.pixelsHit+=hit;
    return {triangles,selected:accepted,overdrawCells:hit};
}
function build(root=Root,outFile='qa-artifacts/chicago-r26/grade-evidence.json'){
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'chicago/manifest.json'),'utf8'));
    const graph=JSON.parse(fs.readFileSync(path.join(root,'chicago/reference-network.json'),'utf8'));
    const survey=JSON.parse(fs.readFileSync(path.join(root,'chicago/reference-street-survey.json'),'utf8'));
    assert.equal(manifest.tiles.length,54);
    assert.equal(graph.edges.length,4279);
    assert.equal(graph.nodes.length,3230);
    assert.equal(survey.tilesRead,54);
    const r=makeRaster(survey);
    const tileCounts=[];
    for(const tile of manifest.tiles){
        if(!/^chunks\/\d{2}_\d{2}\.glb$/.test(tile.url))
            throw Error('Unsafe GLB manifest tile path: '+tile.url);
        const one=inspectTile(path.join(root,'chicago',tile.url),r);
        assert.equal(one.triangles,tile.triangles,
            'GLB triangle mismatch in '+tile.id);
        tileCounts.push({id:tile.id,...one});
    }
    assert.equal(r.tilesRead,54);
    assert.equal(r.trianglesRead,manifest.triangles);
    let occupied=0,stacked=0,lowest=Infinity,highest=-Infinity;
    for(let i=0;i<r.count.length;i++)if(r.count[i]){
        occupied++;
        if(r.maxY[i]-r.minY[i]>Guard.LEVEL_GAP_OBJ)stacked++;
        lowest=Math.min(lowest,r.minY[i]);
        highest=Math.max(highest,r.maxY[i]);
    }
    // Double gate: same-level height AND wide enough source paving.
    // This deliberately excludes narrow sidewalks, yards and unknown pads
    // despite their geometric continuity in the projected skeleton.
    const masks=Object.fromEntries(Pavement.LAYERS.map(name=>[
        name,zlib.gunzipSync(Buffer.from(
            survey.layers[name].gzipBitsetBase64,'base64'))
    ]));
    const paved=Pavement.classify(graph,survey,masks);
    const grade=Guard.audit(graph,r,paved.records);
    grade.pavementGate={
        counts:paved.counts,
        acceptedSourceClasses:['strong','medium'],
        requiresSameLevel:true,
        qualifiedEdgeIds:grade.gradeGuardCandidates
    };
    grade.sourceRaster={
        width:r.width,height:r.height,stepOBJ:r.stepOBJ,
        cellsOccupied:occupied,cellsStacked:stacked,
        minObservedYOBJ:+lowest.toFixed(4),
        maxObservedYOBJ:+highest.toFixed(4),
        tilesRead:r.tilesRead,trianglesRead:r.trianglesRead,
        sourceTrianglesSelected:r.trianglesConsidered,
        cellOverdrawHits:r.pixelsHit,materialLayers:['markedPaving','plainPaving']
    };
    const r23=JSON.parse(fs.readFileSync(path.join(root,
        'chicago/reference-north-candidate-r23.json'),'utf8'));
    const r25=JSON.parse(fs.readFileSync(path.join(root,
        'chicago/reference-eastern-fork-r25.json'),'utf8'));
    grade.existingReferenceRoutes={
        r23:r23.sourceEdgeIds.map(id=>({id,...grade.edges[id]})),
        r25:r25.sourceEdgeIds.map(id=>({id,...grade.edges[id]}))
    };
    const destination=path.resolve(root,outFile);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.writeFileSync(destination,JSON.stringify(grade,null,2)+'\n');
    const summary={report:path.relative(root,destination),tilesRead:r.tilesRead,
        trianglesRead:r.trianglesRead,selected:r.trianglesConsidered,
        occupied,stacked,gradeNodeCounts:grade.nodeCounts,
        gradeEdgeCounts:grade.edgeCounts,
        eligible:grade.gradeGuardCandidates.length,
        r23:grade.existingReferenceRoutes.r23.map(e=>({id:e.id,status:e.status})),
        r25:grade.existingReferenceRoutes.r25.map(e=>({id:e.id,status:e.status})),
        gradedIntersectionsCertified:false,trafficRewired:false};
    console.log('CHICAGO_R26_GRADE_AUDIT '+JSON.stringify(summary));
    // Small provenance-rich visual overlay payload; includes only flagged
    // edges and nodes. Full 4279-edge evidence stays in the ZIP artifact.
    console.log('CHICAGO_R26_GRADE_COMPACT '+JSON.stringify({
        format:grade.format,sourceSurveySHA256:graph.sourceSHA256,
        sourceTriangles:r.trianglesRead,sourceSectors:r.tilesRead,
        cellsStacked:stacked,
        nodeCounts:grade.nodeCounts,edgeCounts:grade.edgeCounts,
        pavingCounts:paved.counts,
        gradeGuardCandidateCount:grade.gradeGuardCandidates.length,
        conflictEdgeIds:grade.edges.filter(e=>
            e.status==='multi-level-conflict').map(e=>e.id),
        stackedNodeIds:grade.stackedNodeIds,
        existingReferenceRoutes:Object.fromEntries(
            Object.entries(grade.existingReferenceRoutes)
                .map(([key,edges])=>[key,edges.map(e=>({id:e.id,status:e.status}))])),
        junctionsCertified:false,wholeMapCertified:false,
        note:'Conflicts from coincident source pavement at multiple heights; may include non-road surfaces. Do not create a navigable 2D intersection.'
    }));
    return summary;
}
if(require.main===module)build(Root,process.argv[2]||
    'qa-artifacts/chicago-r26/grade-evidence.json');
module.exports={glbAccessors,makeRaster,rasterizeTriangle,inspectTile,build};
