/**
 * Testes de regressão: tamanho do corpo, calçadas elevadas, margem do meio-fio,
 * rotas seguras e travessia nos quatro mapas, sem dependência do navegador.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const Road=vm.runInNewContext(read('js/world/road-geometry.js')+
    '\nDriverRoadGeometry',{Math,Number});
const Nav=vm.runInNewContext(read('js/entities/pedestrian-sidewalk-nav.js')+
    '\nDriverPedestrianSidewalks',{Math,Number,Array,DriverRoadGeometry:Road});
const City=vm.runInNewContext(read('js/world/city-builder.js')+
    '\nCityBuilder',{Math,Number,Map,Set,THREE:{},CITY_PRESETS:{}});
const maps=['chicago','havana','vegas','rio'];
const results=[];
const close=(a,b)=>Math.abs(a-b)<1e-7;
for(const map of maps){
    const city=Object.create(City.prototype);
    city.preset={id:map};
    const blocks=[{x:40,z:-40},{x:120,z:-40},{x:-40,z:-120}];
    city.sidewalkGrid=new Set(blocks.map(b=>b.x+':'+b.z));
    city.worldLimit=410;
    city.buildingBoxes=[{minX:20.8,maxX:59.2,
        minZ:-59.2,maxZ:-20.8}];
    city.canalWallSegments=[];
    city.interiors=[];
    city.districtBuildings=blocks;
    city.isWaterAt=()=>false;

    // Os pisos do passeio são boxes 50x0.35x50, topo y=0.35.
    assert(close(city.getGroundHeightAt(61,-40),.35),map+' pavement');
    assert(close(city.getGroundHeightAt(64.55,-40),.175),map+' ramp');
    assert.equal(city.getGroundHeightAt(65,-40),0,map+' road edge');
    assert.equal(city.getGroundHeightAt(80,-40),0,map+' asphalt');
    assert.equal(city.getGroundHeightAt(280,280),0,map+' no phantom curb');
    assert.equal(city.isOnSidewalk(62,-40,.7),true);
    assert.equal(city.isOnSidewalk(64.5,-40,.7),false);
    assert.equal(Nav.permitted(city,62,-62),true);
    assert.equal(Nav.permitted(city,64.5,-40),false);
    assert.equal(Nav.permitted(city,80,-40),false);
    assert.equal(Nav.permitted(city,40,-40),false,
        map+' should not walk through building');
    assert.equal(Nav.HALF,22,map+' sidewalk safety');

    const block=blocks[0],route=Nav.route(block);
    const ped={x:route[0].x,z:route[0].z,route,block,nextCorner:1,
        walkSpeed:2.5,waitTimer:0,diveTimer:0,walkCorners:0};
    const step=Nav.step(ped,.05,city,[]);
    assert.equal(step.state,'walk');
    assert(ped.x>route[0].x && city.isOnSidewalk(ped.x,ped.z,.7));
    const cross=Nav.crossingPlan({x:route[1].x,z:route[1].z,
        route,block,nextCorner:1},1,city);
    assert(cross && close(cross.distance,36),map+' crossing length');
    // O meio da travessia fica sobre o asfalto, não sobre a calçada.
    const crossing={x:cross.startX,z:cross.startZ,
        route,block,crossing:cross};
    const moved=Nav.stepCrossing(crossing,1,city);
    assert.equal(moved.state,'crossing');
    assert(!city.isOnSidewalk(crossing.x,crossing.z,.7));
    results.push({map,sidewalkTop:.35,frontMargin:3,crossing:36});
}
console.log(JSON.stringify({status:'PASS',results},null,2));
