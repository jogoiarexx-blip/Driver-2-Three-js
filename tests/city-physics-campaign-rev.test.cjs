/** Four regional city bridges + secret cars, spring physics, zoned damage,
 * and regional campaign saves. No WebGL needed. */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const presets=new Function(read('js/data/city-presets.js')+';return CITY_PRESETS;')();
class Group{
    constructor(){this.children=[];this.name='';
        this.position={x:0,y:0,z:0,set(x,y,z){
            this.x=x;this.y=y;this.z=z;}};
        this.rotation={x:0,y:0,z:0};
        this.scale={x:1,y:1,z:1,set(x,y,z){
            this.x=x;this.y=y;this.z=z;}};
        this.parent=null;}
    add(...objects){for(const o of objects){this.children.push(o);o.parent=this;}}
    remove(o){this.children=this.children.filter(x=>x!==o);o.parent=null;}
}
class Mesh extends Group{
    constructor(geometry,material){super();this.geometry=geometry;this.material=material;}
}
class Geometry{constructor(...args){this.args=args;}}
class Material{constructor(args){this.args=args;}}
const THREE={Group,Mesh,BoxGeometry:Geometry,MeshLambertMaterial:Material};
const packs=[];
const Special={pack(parent,parts,name){
    packs.push({parent,parts,name});
    return [{name,parts}];
}};
const Infra=new Function('DriverSpecialStructures','THREE',
    read('js/world/regional-infrastructure.js')+
    ';return DriverRegionalInfrastructure;')(Special,THREE);
const Secret=new Function('THREE',
    read('js/vehicles/driver-secret-cars.js')+
    ';return DriverSecretCars;')(THREE);
const Physics=new Function(read('js/physics/arcade-dynamics.js')+
    ';return DriverArcadePhysics;')();
const Damage=new Function(read('js/render/vehicle-damage-fx.js')+
    ';return VehicleDamageFX;')();
const Progress=new Function(read('js/gameplay/chapter-progress.js')+
    ';return DriverChapterProgress;')();
const Campaign=new Function(read('js/gameplay/campaign-flow.js')+
    ';return DriverCampaignFlow;')();

test('4 regional moving bridges follow real leaves, no new physics colliders',()=>{
    const themes=new Set();
    for(const id of Object.keys(presets)){
        packs.length=0;
        const city={preset:{id},
            bridgeSouthLeaf:new Group(),bridgeNorthLeaf:new Group(),
            cityGroup:new Group(),
            buildingBoxes:[{minX:-6,maxX:6,minZ:0,maxZ:3}]};
        const original=JSON.stringify(city.buildingBoxes);
        const stat=Infra.build(city);
        assert.equal(stat.city,id);
        assert.equal(stat.movingLeaves,2);
        assert(stat.approachParts>=14);
        assert.equal(stat.collidersAdded,0);
        assert.equal(JSON.stringify(city.buildingBoxes),original);
        const r=stat.ramp;
        assert(r && r.height>1.5 && r.length===18);
        assert.equal(Infra.rampHeight(city,r.x,r.z),0);
        assert(Infra.rampHeight(city,r.x,r.z+9)>.5);
        assert(Infra.rampHeight(city,r.x,r.z+r.length)>1.4);
        assert.equal(Infra.rampHeight(city,r.x+7,r.z+9),0);
        assert(city.cityGroup.children.some(item=>
            item.name==='driver2-driveable-ramp-'+id),
            'Driveable ramp geometry missing');
        const leafPacks=packs.filter(x=>x.name.startsWith('regional-bridge-'+id+'-leaf'));
        assert.equal(leafPacks.length,2);
        assert.equal(leafPacks[0].parent,city.bridgeSouthLeaf);
        assert.equal(leafPacks[1].parent,city.bridgeNorthLeaf);
        assert.equal(packs.length,3);
        assert(leafPacks.every(x=>x.parts.length>25));
        themes.add(stat.type);
    }
    assert.equal(themes.size,4,'Four cities must have distinct infrastructure');
});
test('four secret vehicles differ in performance, livery and remain single-body',()=>{
    const features=new Set(),speeds=new Set();
    for(const id of Object.keys(presets)){
        const car={root:new Group(),maxSpeed:68,accel:42};
        assert(Secret.apply(car,id));
        assert(car.secretCityStyle.children.length>=4);
        assert.equal(car.root.children.length,1);
        assert.equal(car.secretCityStyle.parent,car.root);
        features.add(car.secretVariant);speeds.add(car.maxSpeed);
        assert(Secret.apply(car,id));
        assert.equal(car.root.children.length,1,
            'Changing livery must not duplicate geometry');
    }
    assert.equal(features.size,4);
    assert.equal(speeds.size,4);
});
test('spring-damped physics leans into turns and settles after straightening',()=>{
    const v={bodyStyle:'muscle',damage:0,maxSpeed:55,accel:31,
        speed:32,lateralVelocity:0,heading:0,wheelSpin:0,
        steerAngle:0,pitchAngle:0,rollAngle:0,
        chassisTilt:{rotation:{x:0,z:0}}};
    for(let i=0;i<100;i++)Physics.update(v,1/60,1,.8,false,false);
    assert(Math.abs(v.rollAngle)>.02);
    assert(Math.abs(v.rollAngle)<.24);
    assert(Number.isFinite(v.suspensionLateralLoad));
    assert(Number.isFinite(v.suspensionLongitudinalLoad));
    for(let i=0;i<200;i++)Physics.update(v,1/60,0,0,false,false);
    assert(Math.abs(v.rollAngle)<.006,
        'Suspension should return to centre on a straight');
    assert(Number.isFinite(v.pitchAngle));
});
test('damage bends the actual hood mesh progressively by impact zone',()=>{
    const part=()=>({visible:false,rotation:{x:0,y:0,z:0},
        position:{x:0,y:0,z:0},
        scale:{x:1,y:1,z:1,set(x,y,z){
            this.x=x;this.y=y;this.z=z;}}});
    const hood=part(),trunk=part();
    hood.children=[part()];hood.children[0].position.z=.8;
    trunk.children=[part()];trunk.children[0].position.z=-.8;
    const parts={scratches:part(),dents:part(),cracks:part(),heavy:part(),
        bumper:part(),rearDamage:part(),leftDamage:part(),
        rightDamage:part(),engineGlow:part()};
    const car={damage:78,damageZones:{
        front:72,rear:14,left:0,right:15},
        breakawayFlags:{},hoodPivot:hood,trunkPivot:trunk,
        damageParts:parts,motionClock:12,speed:23};
    Damage.update(car);
    assert(hood.rotation.x<-.2);
    assert(hood.children[0].scale.z<.9,
        'Real hood mesh must be crumpled');
    assert(hood.children[0].scale.y<.9);
    assert(parts.bumper.visible);
    assert(parts.cracks.visible);
    const first=hood.children[0].scale.z;
    car.damage=96;car.damageZones.front=100;
    Damage.update(car);
    assert(hood.children[0].scale.z<first);
    assert(parts.heavy.visible);
});
test('regional chapter save migrates v1 and stores all six mission checkpoints',()=>{
    const memory=new Map();
    const storage={
        getItem:k=>memory.get(k)||null,
        setItem(k,v){memory.set(k,String(v));}
    };
    storage.setItem(Progress.KEY,JSON.stringify({
        version:1,chicago08:true,havana09:true}));
    const progress=new Progress(storage);
    assert(progress.canTravelToVegas());
    assert(!progress.canTravelToRio());
    for(const type of [...Campaign.VEGAS,...Campaign.RIO])
        assert(progress.completeRegional(type));
    assert(progress.canTravelToRio());
    assert(progress.isRioComplete());
    const reload=new Progress(storage);
    assert(reload.isVegasComplete()&&reload.isRioComplete());
    assert.equal(Campaign.next('vegas',reload.regionalCompleted),null);
    assert.equal(Campaign.next('rio',reload.regionalCompleted),null);
    assert.equal(Campaign.nextChapter('vegas',reload.regionalCompleted),'rio');
    assert.equal(Campaign.nextChapter('rio',reload.regionalCompleted),null);
    const stored=JSON.parse(storage.getItem(Progress.KEY));
    assert.equal(stored.version,2);
    assert.equal(stored.regional.length,6);
    assert(reload.chicagoComplete && reload.havana09Complete);
});
test('previous Chicago/Havana progression and ten Driving Games remain wired',()=>{
    const engine=read('js/engine/driver2-game-engine.js');
    assert(engine.includes('completeRegional(finishedType)'));
    assert(read('js/world/city-builder.js').includes('DriverRegionalInfrastructure.rampHeight('));
    assert(engine.includes('DriverSecretCars.apply(this.secretCar,this.currentCityKey)'));
    assert(engine.includes('chapterProgress.regionalCompleted'));
    const html=read('index.html');
    for(const tag of ['regional-infrastructure.js','driver-secret-cars.js',
        'driver-vehicle.js','city-builder.js'])
        assert(html.includes(tag),tag);
    assert(html.indexOf('regional-infrastructure.js')<
        html.indexOf('city-builder.js'));
    assert(html.indexOf('driver-vehicle.js')<
        html.indexOf('driver-secret-cars.js'));
    for(const mission of [...Campaign.VEGAS,...Campaign.RIO])
        assert(html.includes("startMission('"+mission+"')"));
});
