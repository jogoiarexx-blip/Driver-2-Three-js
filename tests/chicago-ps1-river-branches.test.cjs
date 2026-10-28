'use strict';
/* Geografia Chicago R2: pontes contínuas e IA sem rotas sobre água. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const R=require('../js/world/chicago-ps1-river-branches.js');
const Road=vm.runInNewContext(
    read('js/world/road-geometry.js')+'\nDriverRoadGeometry',
    {Math,Number,Map,Set});
class Geo {
    constructor(...args){this.args=args;this.attributes={};}
    setAttribute(name,attr){this.attributes[name]=attr;}
    computeVertexNormals(){this.normals=true;}
}
class Material{constructor(opts){this.opts=opts;}}
class Mesh{
    constructor(geometry,material){
        this.geometry=geometry;this.material=material;
        this.position={set(x,y,z){this.x=x;this.y=y;this.z=z}};
        this.userData={};
    }
}
const THREE={BufferGeometry:Geo,Float32BufferAttribute:class {
    constructor(array,size){this.array=array;this.size=size;}
},BoxGeometry:Geo,Mesh,MeshBasicMaterial:Material,
 MeshLambertMaterial:Material,DoubleSide:2};
function fixture(id='chicago'){
    const children=[];
    return {preset:{id},cityGroup:{add(x){children.push(x);},children},
        buildingBoxes:[{minX:-219.2,maxX:-180.8,minZ:180.8,maxZ:219.2}],
        missionStart:{type:'story_tipoff',x:-64,z:-144},
        garageParking:{x:-129,z:-94},
        secretSwitchPos:{x:102,z:103},
        canalWallSegments:[{z:34,minX:-255,maxX:-225}]};
}
test('riachos North/South e canal de Goose Island permanecem conectados',()=>{
    for(const z of [-300,-275,-190,-125,-100,-50,-35,-10,25,95,115,145,190,215,275,300]){
        if(!R.isBridge(-240,z))assert(R.waterAt(-240,z),'Falha no tronco em '+z);
    }
    for(const z of [113,120,188,208,270,286]){
        assert(R.waterAt(-160,z),'Canal leste interrompido em '+z);
        assert(!R.waterAt(-200,z),'Terreno da ilha não pode ser lago');
    }
    assert(R.waterAt(-200,93.5));
    assert(R.waterAt(-200,306.3));
    assert.equal(R.waterAt(-240,400),false);
    assert.equal(R.waterAt(-160,-80),false);
});
test('dez pontes secas nos cruzamentos mantêm vias leste-oeste trafegáveis',()=>{
    assert.equal(R.BRIDGES_WEST.length,8);
    assert.equal(R.BRIDGES_EAST.length,2);
    for(const [x,z] of [
        ...R.BRIDGES_WEST.map(z=>[-240,z]),
        ...R.BRIDGES_EAST.map(z=>[-160,z])
    ]) {
        assert.equal(R.isBridge(x,z),true);
        assert.equal(R.waterAt(x,z),false);
        for(const lane of [-4,4]){
            assert.equal(R.waterAt(x,z+lane),false,
                'Faixa longitudinal invadida por água na ponte');
        }
    }
    for(const x of [-240,-160]){
        assert.equal(R.waterAt(x,200),true,'Corredor inundado fora da ponte');
    }
});
test('marcadores, garagem, trem, Wrigley Field e Navy Pier permanecem secos',()=>{
    const protectedLocations=[
        [-64,-144],[-129,-94],[-129,-90],[-120,-101],
        [102,103],[120,120],[-14,-260],
        [-280,200],[280,-120],[379,-40],[-115,-275]
    ];
    for(const [x,z] of protectedLocations)
        assert.equal(R.waterAt(x,z),false,'Protegido indevidamente inundado: '+x+','+z);
});
test('pontes e água são visíveis sem novos AABBs nem mudanças nas missões',()=>{
    const c=fixture();
    const before=JSON.stringify({boxes:c.buildingBoxes,
        objective:c.missionStart,parking:c.garageParking,
        switch:c.secretSwitchPos,walls:c.canalWallSegments});
    const globals=global.THREE,structures=global.DriverSpecialStructures;
    global.THREE=THREE;
    global.DriverSpecialStructures={pack(root,parts){
        const result={parts,name:'banks'};root.add(result);return [result];
    }};
    try {
        const out=R.build(c);
        assert.equal(out.bridgeCount,10);
        assert.equal(out.generatedColliders,0);
        assert.equal(out.riverSegments,4);
        assert(out.bankSegments>10);
        assert.equal(out.bridgeMeshes.length,30);
        assert.equal(c.cityGroup.children.filter(x=>x.userData?.chicagoFixedBridge).length,10);
        assert.equal(R.build(c),out,'Recriar Rio na mesma cena não duplica');
        assert.equal(JSON.stringify({boxes:c.buildingBoxes,
            objective:c.missionStart,parking:c.garageParking,
            switch:c.secretSwitchPos,walls:c.canalWallSegments}),before);
        const f=fixture('havana');
        assert.equal(R.build(f),null);
        assert.equal(f.cityGroup.children.length,0);
    } finally {
        global.THREE=globals;
        global.DriverSpecialStructures=structures;
    }
});
test('rotas em cada ponte ficam dirigíveis, mas não percorrem rio em lugar da rua',()=>{
    const city={
        preset:{id:'chicago'},roadExtent:320,
        isPointBlocked(){return false;},
        isWaterAt(x,z){return R.waterAt(x,z) ||
            (z>34.85&&z<65.15&&Math.abs(x)>12.25);}
    };
    for(const z of R.BRIDGES_WEST){
        for(const offset of [-4,4])
            assert(Road.segmentDrivable(city,-270,z+offset,-210,z+offset),
                'Travessia inválida na ponte oeste '+z);
    }
    for(const z of R.BRIDGES_EAST){
        for(const offset of [-4,4])
            assert(Road.segmentDrivable(city,-190,z+offset,-130,z+offset));
    }
    assert.equal(Road.segmentDrivable(city,-240,113,-240,150),false,
        'Rota da IA não pode conduzir pelo canal');
    assert.equal(Road.segmentDrivable(city,-160,170,-160,220),false);
    const audit=Road.auditNetwork(city);
    assert.equal(audit.nodes,81);
    assert(audit.edges>85,'Novos canais desligaram quase todas as ruas: '+audit.edges);
    assert(audit.largestComponent>55,'Cidade ficou fragmentada: '+audit.largestComponent);
});
test('integração R2 apenas em Chicago e depois das ruas, sem sobrescrever pontes móveis',()=>{
    const src=read('js/world/city-builder.js'),html=read('index.html');
    assert(src.includes('DriverChicagoPS1RiverBranches.build(this)'));
    assert(src.includes('DriverChicagoPS1RiverBranches.waterAt(x,z)'));
    assert(html.indexOf('chicago-ps1-river-branches.js')<
        html.indexOf('city-builder.js'));
    assert(src.includes('DriverChicagoEastBridge.isDeckLocation'));
    assert(src.includes('DriverChicagoPS1Coastline.waterAt'));
    assert(src.includes('DriverChicagoGameplay.buildStadium'));
});
