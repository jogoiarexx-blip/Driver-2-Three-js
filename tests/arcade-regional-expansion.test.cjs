'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const nodes=new Map();
const doc={getElementById(id){
    if(!nodes.has(id))nodes.set(id,{textContent:'',classList:{
        remove(){},add(){},toggle(){}},style:{}});
    return nodes.get(id);
}};
class Group {
    constructor(){this.children=[];this.position={x:0,y:0,z:0,
        set(x,y,z){this.x=x;this.y=y;this.z=z;}};
        this.rotation={y:0};this.userData={};}
    add(...xs){this.children.push(...xs);}
}
class Mesh extends Group {
    constructor(geometry,material){super();
        this.geometry=geometry;this.material=material;this.visible=true;}
}
class Geometry{constructor(...args){this.args=args;}}
class Material{constructor(options){this.options=options;}}
const THREE={Group,Mesh,ConeGeometry:Geometry,BoxGeometry:Geometry,
    MeshLambertMaterial:Material};
class Vehicle {
    constructor(scene,cfg){Object.assign(this,{speed:0,damage:0},cfg);}
    updateTransform(){}
}
const GPUResourceUtils={disposeSubtree(){}};
const DriverCheckpointRoute={
    current:markers=>markers.find(m=>!m.collected),
    refresh(type,markers){
        for(const m of markers)m.mesh.visible=(!m.collected &&
            (type!=='gate_racing'&&type!=='arcade_checkpoint'||
                this.current(markers)===m));
    }
};
const Arcade=new Function('THREE','DriverVehicle',
    'DriverCheckpointRoute','GPUResourceUtils','document',
    read('js/gameplay/driving-games-classic.js')+
    '\nreturn DriverClassicGames;')(
        THREE,Vehicle,DriverCheckpointRoute,GPUResourceUtils,doc);
const Regional=new Function('THREE','DriverVehicle','GPUResourceUtils',
    'document',read('js/gameplay/regional-missions.js')+
    '\nreturn DriverRegionalMissions;')(
        THREE,Vehicle,GPUResourceUtils,doc);
const intro=new Function('document',
    read('js/gameplay/mission-briefing.js')+
    '\nreturn DriverMissionBriefing;')(undefined);
const Spatial=new Function(
    read('js/world/spatial-collision-grid.js')+
    '\nreturn DriverSpatialCollisionGrid;')();
function game(city='chicago'){
    const car={x:0,z:-120,damage:0,speed:0};
    const g={
        currentCityKey:city,scene:{objects:[],add(x){this.objects.push(x);},
            remove(x){this.objects=this.objects.filter(y=>y!==x);}},
        playerCar:car,mode:'driving',felony:0,vehicles:[car],
        city:{safeHouseZone:{x:-120,z:-120,radius:12}},
        trafficAI:{unobstructed(){return true}},
        audio:{playC4Beep(){},playBigExplosion(){},playCrash(){}},
        effects:{explosions:[],spawnMassiveExplosion(x,y,z){
            this.explosions.push({x,z});}},
        missionMarkers:[],classicState:null,regionalState:null,
        spawnMarkerRing(x,z,color){
            this.missionMarkers.push({x,z,mesh:{visible:true},collected:false});
        },
        clearMissionMarkers(){
            this.missionMarkers=[];this.markersCollected=0;this.totalMarkers=0;
        },
        getPlayerPosition(){
            return this.mode==='driving'?this.playerCar:
                {x:this.tannerX,z:this.tannerZ};},
        markersCollected:0,totalMarkers:0,
        missionActive:false,missionTimeLeft:0
    };
    return g;
}
test('four classic games are independent of Undercover menu',()=>{
    assert.equal(Arcade.MODES.size,4);
    for(const type of Arcade.MODES){
        const g=game('vegas');
        Arcade.begin(g,type);
        assert.equal(g.missionActive,true,type);
        assert(g.missionTimeLeft>0,type);
        if(type==='arcade_checkpoint'){
            assert.equal(g.missionMarkers.length,5);
            assert.equal(g.totalMarkers,5);
            assert.equal(g.felony,0);
        }
        if(type==='gate_racing'){
            assert.equal(g.missionMarkers.length,8);
            assert.equal(g.classicState.coneMeshes.length,16);
        }
        if(type==='arcade_quickchase'){
            assert(g.targetCar && g.vehicles.includes(g.targetCar));
            g.targetCar.damage=100;
            assert.equal(Arcade.update(g,.05).success,true);
        }
        Arcade.dispose(g);
        assert.equal(g.classicState,null);
    }
});
test('gate racing checks the passage between cones and applies time penalties',()=>{
    const g=game();Arcade.begin(g,'gate_racing');
    assert.equal(Arcade.findGateMarker(g,5,-80),null);
    assert(Arcade.findGateMarker(g,0,-80));
    g.playerCar.x=3.9;g.playerCar.z=-80;g.playerCar.speed=18;
    const before=g.missionTimeLeft;
    Arcade.update(g,.016);
    assert(g.missionTimeLeft<=before-2.9);
    assert.equal(g.classicState.penalized.size,1);
});
test('getaway counts eight uninterrupted seconds outside police sight',()=>{
    const g=game();Arcade.begin(g,'arcade_getaway');
    assert.equal(g.felony,98);
    g.vehicles=g.vehicles.filter(v=>!v.isPolice);
    let result;
    for(let i=0;i<9;i++)result=Arcade.update(g,1);
    assert.equal(result.success,true);
    assert(result.message.includes('9.0s'));
});
test('six regional missions start only in their correct city',()=>{
    assert.equal(Object.keys(Regional.SPECS).length,6);
    for(const [type,config] of Object.entries(Regional.SPECS)){
        const g=game(config[0]);
        assert.equal(Regional.begin(g,type),true);
        assert(g.missionActive && g.missionTimeLeft>=120);
        assert.equal(Regional.begin(game(config[0]==='rio'?'vegas':'rio'),type),false);
        Regional.dispose(g);
    }
});
test('Vegas C4 requires on-foot E at each generator, then safe retreat',()=>{
    const g=game('vegas');Regional.begin(g,'story_vegas_c4');
    assert.equal(g.regionalState.props.length,3);
    g.mode='on_foot';
    for(let i=0;i<3;i++){
        const site=g.regionalState.sites[i];
        g.tannerX=site.x;g.tannerZ=site.z;
        assert(Regional.interact(g));
        assert.equal(g.regionalState.planted,i+1);
        assert.notEqual(g.regionalState.props[i].visible,false,
            'The generator must not vanish before detonation');
    }
    g.tannerX=0;g.tannerZ=-320;
    const done=Regional.update(g,14);
    assert(done?.success);
    assert.equal(g.effects.explosions.length,3);
    assert(g.regionalState.props.every(m=>m.visible===false));
});
test('Vegas heist requires two separate vehicles delivered',()=>{
    const g=game('vegas');Regional.begin(g,'story_vegas_heist');
    const first=g.targetCar;
    g.playerCar=first;
    first.x=-120;first.z=-120;
    Regional.update(g,.1);
    assert.equal(g.regionalState.delivered,1);
    assert.notEqual(g.targetCar,first);
    g.playerCar=g.targetCar;
    g.playerCar.x=-120;g.playerCar.z=-120;
    assert.equal(Regional.update(g,.1).success,true);
});
test('Rio barge supports manual C4 and helicopter tracks Corcovado',()=>{
    const barge=game('rio');Regional.begin(barge,'story_rio_barge');
    assert(barge.scene.objects.some(x=>x.name==='rio-barge-mission'));
    barge.mode='on_foot';barge.tannerX=240;barge.tannerZ=26;
    assert(Regional.interact(barge));
    barge.tannerX=0;barge.tannerZ=-240;
    assert(Regional.update(barge,14).success);
    const heli=game('rio');Regional.begin(heli,'story_rio_helicopter');
    let finished;
    for(let i=0;i<55;i++){
        heli.playerCar.x=heli.regionalState.heliAt.x;
        heli.playerCar.z=heli.regionalState.heliAt.z;
        finished=Regional.update(heli,1);
        if(finished)break;
    }
    assert(finished?.success,'helicopter cannot be intercepted');
});
test('Vegas ambulance completes only after driving stolen rescue van to refuge',()=>{
    const g=game('vegas');Regional.begin(g,'story_vegas_ambulance');
    assert(g.targetCar?.missionParked);
    assert(!Regional.update(g,.016)?.success);
    g.playerCar=g.targetCar;g.playerCar.x=-120;g.playerCar.z=-120;
    assert.equal(Regional.update(g,.016).success,true);
});
test('Rio Jericho pursuit requires 100% damage to the actual target',()=>{
    const g=game('rio');Regional.begin(g,'story_rio_jericho');
    g.targetCar.damage=99;
    assert(!Regional.update(g,.05)?.success);
    g.targetCar.damage=100;
    assert.equal(Regional.update(g,.05).success,true);
});
test('arcade checkpoint and gate racing both have reachable final victories',()=>{
    const check=game('vegas');
    Arcade.begin(check,'arcade_checkpoint');
    check.markersCollected=4;
    assert(!Arcade.update(check,.05)?.success);
    check.markersCollected=5;
    assert(Arcade.update(check,.05)?.success);
    const gate=game('chicago');
    Arcade.begin(gate,'gate_racing');
    gate.markersCollected=8;
    assert(Arcade.update(gate,.05)?.success);
});
test('spatial hash preserves exact AABB collision including neighbor cells',()=>{
    const hash=new Spatial(80);
    const boxes=[
        {minX:-5,maxX:5,minZ:-5,maxZ:5},
        {minX:79,maxX:84,minZ:20,maxZ:24}
    ];
    assert(hash.blocked(boxes,0,0,1));
    assert(hash.blocked(boxes,82,22,1));
    assert(!hash.blocked(boxes,45,45,1));
    boxes.splice(1,1);
    assert(!hash.blocked(boxes,82,22,1));
    assert.equal(hash.count,1);
});
test('briefing and audio modules expose five-second title, dispatcher and score',()=>{
    const b=new intro();
    assert.equal(b.active,false);
    b.tick(1);
    const score=read('js/audio/retro-synth-audio.js');
    for(const item of ['playPoliceDispatcher','updateRetroScore',
        'slipAngle','createBiquadFilter','SpeechSynthesisUtterance'])
        assert(score.includes(item));
    const engine=read('js/engine/driver2-game-engine.js');
    assert(engine.includes('briefingDirector?.begin(this,type)'));
    assert(engine.includes('briefingDirector.tick(dt)'));
    assert(engine.includes('DriverRegionalMissions.interact(this)'));
});
test('menu exposes all 10 modes and chapter markers',()=>{
    const html=read('index.html');
    for(const type of [...Arcade.MODES,...Object.keys(Regional.SPECS)])
        assert(html.includes("startMission('"+type+"')"),type);
    const flow=read('js/gameplay/campaign-flow.js');
    assert(flow.includes('story_vegas_ambulance'));
    assert(flow.includes('story_rio_helicopter'));
    const city=read('js/world/city-builder.js');
    assert(city.includes("rio:{x:16,z:-224,type:'story_rio_barge'}"));
});
