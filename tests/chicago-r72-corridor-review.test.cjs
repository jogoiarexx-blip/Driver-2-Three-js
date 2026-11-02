'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
    fs=require('node:fs'),zlib=require('node:zlib'),crypto=require('node:crypto');
const Corridor=require('../js/world/chicago-corridor-review-r72.js');
const Road=require('../js/world/chicago-road-evidence-r24.js');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const graph=read('chicago/reference-network.json');
const r28=read('chicago/reference-layered-r28.json');
const r29=read('chicago/reference-recovery-r29.json');
const manifest=read('chicago/manifest.json');
const curve=read('chicago/reference-curve-r15.json');
const published=read('chicago/corridor-review-r72.json');
test('R72 original selected edge is present in R28 direct-grade set, not height-recovered',()=>{
    const actual=Corridor.build(graph,r28,r29,manifest,curve);
    assert.deepEqual(actual,published,'published report must equal original PS1 data');
    assert.equal(actual.candidateEdgeId,3445);
    assert.deepEqual(actual.nodeIds,[2560,2805]);
    assert.equal(actual.lengthPolylineOBJ,16.375);
    assert.equal(actual.tilesCount,2);
    assert.deepEqual(actual.tiles.map(t=>t.id),['01_02','01_03']);
    assert.equal(actual.r28Evidence,true);
    assert.equal(actual.r29RecoveredHeight,false);
    assert.equal(actual.originalRoadCertified,false);
    assert.equal(actual.gameTrafficEnabled,false);
    assert.equal(actual.collisionCreated,false);
    assert.equal(actual.missionsMigrated,false);
    assert.equal(actual.projectedUndercoverR15.withinLegacyGrid320,false);
    assert.equal(actual.projectedUndercoverR15.calibratedOriginalPlacement,false);
    assert(actual.projectedUndercoverR15.bounds.minX < -320,
        'unsafe western grid placement must remain a hard stop');
});
test('R72 catalog never fabricates a sector crossing or an interchange',()=>{
    const edge=graph.edges[3445];
    const tileIds=manifest.tiles.filter(t=>
        Corridor.intersectsTile(edge.pointsOBJ,t.bounds)).map(t=>t.id);
    assert.deepEqual(tileIds,['01_02','01_03']);
    // Crossing with both endpoints outside a tile still counts.
    assert.equal(Corridor.intersectsTile([[0,0],[20,0]],
      {min:[5,-1,-1],max:[15,1,1]}),true);
    assert.equal(Corridor.intersectsTile([[0,4],[20,4]],
      {min:[5,-1,-1],max:[15,1,1]}),false);
    assert.equal(Corridor.routeLength([[1,2],[1,12]]),10);
    assert.equal(Corridor.intersectsTile([[0,0],[20,0]],null),false);
});
test('R72 fails closed on stale source SHA, missing R28 grade or fake recovered status',()=>{
    const changed=structuredClone(r28);changed.sourceSurveySHA256='not-matching';
    assert.throws(()=>Corridor.build(graph,changed,r29,manifest,curve),/stale/);
    const excluded=structuredClone(r28);
    excluded.candidateEdgeIds=excluded.candidateEdgeIds.filter(i=>i!==3445);
    assert.throws(()=>Corridor.build(graph,excluded,r29,manifest,curve),
        /lacks direct R28/);
    const recovered=structuredClone(r29);
    recovered.recoveredEdges.push({id:3445});
    assert.throws(()=>Corridor.build(graph,r28,recovered,manifest,curve),
        /lacks direct R28/);
    assert.throws(()=>Corridor.build(graph,r28,r29,{tiles:[]},curve),
        /sectors not found/);
});
test('R72 material width is measured from the same SHA-checked original atlas',()=>{
    const bytes=fs.readFileSync('chicago/reference-street-survey.json');
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
        published.sourceSHA256);
    const survey=JSON.parse(bytes);
    const masks=Object.fromEntries(Road.LAYERS.map(layer=>[
        layer,zlib.gunzipSync(Buffer.from(survey.layers[layer].gzipBitsetBase64,
          'base64'))
    ]));
    const profile=Corridor.materials(published,survey,masks,Road);
    assert(['strong','medium','review','reject'].includes(profile.confidence));
    assert(profile.lengthOBJ>=16.3&&profile.lengthOBJ<=16.5);
    assert(Number.isFinite(profile.center));
    assert(Number.isFinite(profile.shoulders));
    assert(Number.isFinite(profile.laneEdges));
    assert.equal(profile.actualLaneWidthCertified,false);
    assert.equal(profile.gradeAndMaterialTogetherCertified,false);
    assert.equal(profile.noGameplayChanges,true);
});
test('R72 overlay uses only THREE Lines/Points; no collision/body/gps changes',()=>{
    class Group{
        constructor(){this.children=[];this.userData={}}
        add(a){this.children.push(a)}
    }
    class Geometry{constructor(){this.attributes={}}
        setAttribute(k,v){this.attributes[k]=v}}
    class Attr{constructor(a,size){this.array=a;this.itemSize=size}}
    class Material{constructor(o){this.options=o}}
    class Mesh{constructor(g,m){this.geometry=g;this.material=m}}
    const THREE={Group,BufferGeometry:Geometry,Float32BufferAttribute:Attr,
        LineBasicMaterial:Material,PointsMaterial:Material,
        LineSegments:Mesh,Points:Mesh};
    const overlay=Corridor.overlay(THREE,published);
    assert.equal(overlay.userData.visualOnly,true);
    assert.equal(overlay.userData.roadCertified,false);
    assert.equal(overlay.userData.trafficEnabled,false);
    assert.equal(overlay.userData.collidersCreated,0);
    assert.deepEqual(overlay.children.map(c=>c.name),
        ['r72-edge-3445-source-trace','r72-source-endpoints',
         'r72-source-tile-bounds']);
    assert.equal(overlay.children[0].geometry.attributes.position.array.length,6);
    assert.equal(overlay.children[2].geometry.attributes.position.array.length,48);
});
test('R72 inspector is linked from game menu but never loaded into main game',()=>{
    const index=fs.readFileSync('index.html','utf8');
    const preview=fs.readFileSync('chicago-original-preview.html','utf8');
    assert(index.includes('INSPECIONAR CHICAGO ORIGINAL PS1 (R72)'));
    assert(index.includes('target="_blank" rel="noopener noreferrer"'));
    assert(!index.includes('chicago-corridor-review-r72.js'),
        'preview module must not allocate memory inside game');
    assert(preview.includes('id="corridor72"'));
    assert(preview.includes('id="corridor72-audit"'));
    assert(preview.includes('chicago-corridor-review-r72.js?v=r72-source-3445'));
    assert(preview.includes('focusR72(review)'));
});
