/**
 * Regressão do interior de Tanner e início sequencial das missões de Chicago.
 * Executar localmente: node tests/chicago-missions-home.smoke.cjs
 * Não exige Three.js WebGL nem dependências NPM.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const position=()=>({x:0,y:0,z:0,set(x,y,z){
    this.x=x;this.y=y;this.z=z;
}});
class Group{
    constructor(){this.children=[];this.position=position();this.rotation=position();}
    add(...obj){this.children.push(...obj);}
}
class Mesh extends Group{
    constructor(geometry,material){super();
        this.geometry=geometry;this.material=material;
    }
}
class Material{
    constructor(options={}){this.options=options;}
}
class Texture{
    constructor(canvas){
        this.canvas=canvas;
        this.repeat={set(x,y){this.x=x;this.y=y;}};
    }
}
const THREE={
    Group,Mesh,MeshLambertMaterial:Material,MeshBasicMaterial:Material,
    BoxGeometry:class{constructor(...dimensions){this.dimensions=dimensions;}},
    CanvasTexture:Texture,RepeatWrapping:1,NearestFilter:2
};
const document={
    createElement:()=>({
        getContext:()=>({fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}})
    })
};
const batches=[];
const DriverSpecialStructures={
    pack:(parent,parts,name)=>{
        batches.push({name,count:parts.length});return [];
    }
};
const ctx={THREE,document,DriverSpecialStructures,
    CITY_PRESETS:{chicago:{id:'chicago'}}};
vm.createContext(ctx);
function load(file,name){
    const source=path.join(__dirname,'..',file);
    vm.runInContext(fs.readFileSync(source,'utf8')+
        '\nthis.'+name+'='+name+';',ctx,{filename:source});
    return ctx[name];
}
const Home=load('js/world/tanner-home-interior.js',
    'DriverTannerHomeInterior');
const Hubs=load('js/gameplay/chicago-mission-hubs.js',
    'DriverChicagoMissionHubs');
const City=load('js/world/city-builder.js','CityBuilder');
const Flow=load('js/gameplay/campaign-flow.js','DriverCampaignFlow');

const city={preset:{id:'chicago'},cityGroup:new Group(),
    tannerHomeFurnitureBoxes:[],
    interiorArea:()=>true,buildingBoxes:[],
    worldLimit:410,canalWallSegments:[]};
const place={id:'home',inside:{x:1000,z:0}};
const stats=Home.build(city,place);
assert(stats.pieces>=90);
assert(stats.colliders>=10);
for(let z=-6;z<=1.7;z+=.25){
    assert.equal(Home.blocked(city,1000,z,.55),false,
        'Corredor para mesa de save obstruído em z='+z);
    assert.equal(City.prototype.isPointBlocked.call(city,1000,z,.55,0),
        false,'Colisão CityBuilder no corredor: z='+z);
}
assert.equal(Home.blocked(city,1000,4,.55),true,
    'Mesa de save deve ser sólida');
assert.equal(Home.blocked(city,1007,-7.5,.55),true,
    'Cama deve bloquear passagem');
assert.equal(Home.blocked(city,990.5,-3,.55),true,
    'Balcão de cozinha deve ser sólido');

const marker={
    type:'story_tipoff',x:-64,z:-144,
    ring:{position:position()},arrow:{position:position()}
};
// Simula as posições que CityBuilder.buildMissionStartMarker já atribui.
marker.ring.position.set(-64,.55,-144);
marker.arrow.position.set(-64,3.3,-144);
const navCity={preset:{id:'chicago'},missionStart:marker};
const completed=new Set();
assert.equal(Flow.next('chicago',completed),'story_tipoff');
let visited=0;
for(const type of Flow.CHICAGO){
    assert.equal(Flow.next('chicago',completed),type);
    const spec=Hubs.sync(navCity,type,false);
    assert.equal(marker.x,spec.x);
    assert.equal(marker.z,spec.z);
    assert.equal(marker.ring.position.x,spec.x);
    assert.equal(marker.arrow.position.z,spec.z);
    assert(Hubs.canStart({x:spec.x,z:spec.z},marker,false));
    assert.equal(Hubs.canStart({x:spec.x+20,z:spec.z},marker,false),false);
    completed.add(type);visited++;
}
assert.equal(visited,8);
assert.equal(Flow.next('chicago',completed),null);
Hubs.sync(navCity,'story_leaving',true);
assert.equal(marker.ring.visible,false);
assert.equal(marker.arrow.visible,false);
assert.equal(Hubs.spec({preset:{id:'havana'}},'story_train'),null);

console.log('PASS: 4 áreas, corredor/salvamento, 8 missões em sequência, marcadores');
