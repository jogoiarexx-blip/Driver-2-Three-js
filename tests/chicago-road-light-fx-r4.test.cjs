'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/render/road-light-fx.js'),'utf8');
class Object3D {
    constructor(){
        this.position={set:(x,y,z)=>{this.p=[x,y,z];}};
        this.rotation={set:(x,y,z)=>{this.r=[x,y,z];}};
        this.scale={set:(x,y,z)=>{this.s=[x,y,z];}};
    }
    updateMatrix(){this.matrix={p:this.p.slice(),r:this.r.slice(),s:this.s.slice()};}
}
class InstancedMesh {
    constructor(geo,mat,count){
        this.geometry=geo;this.material=mat;this.count=count;
        this.matrices=[];this.instanceMatrix={};this.userData={};
    }
    setMatrixAt(i,m){this.matrices[i]=JSON.parse(JSON.stringify(m));}
}
class Material{constructor(p){Object.assign(this,p);}}
class PlaneGeometry {
    constructor(w,h){this.width=w;this.height=h;}
    rotateX(angle){this.rotX=angle;}
}
const THREE={
    MeshBasicMaterial:Material,PlaneGeometry,InstancedMesh,Object3D,
    CanvasTexture:class{constructor(canvas){this.image=canvas;}},
    DoubleSide:1,AdditiveBlending:2,LinearFilter:3,LinearMipmapLinearFilter:4
};
const canvases=[];
const document={
    createElement(name){
        assert.equal(name,'canvas');
        const canvas={
            width:0,height:0,operations:[],
            getContext(){
                const ctx={
                    createRadialGradient(...args) {
                        const g={args,stops:[],addColorStop(x,color){this.stops.push([x,color]);}};
                        canvas.operations.push(g);
                        return g;
                    },
                    save(){},restore(){},scale(x,y){canvas.scaled=[x,y];},
                    fillRect(x,y,w,h){canvas.fill=[x,y,w,h];}
                };return ctx;
            }
        };
        canvases.push(canvas);
        return canvas;
    }
};
const FX=vm.runInNewContext(source+'\nDriverRoadLightFX',{THREE,document,Math,Number,Array});
function vehicle(x,z,heading=0,options={}){
    return {x,z,y:0,heading,headlightsOn:true,isSubmerged:false,
        root:{visible:true},...options};
}
function makeGame({cityKey='chicago',time=.95,rain=false}={}){
    const meshes=[];
    const player=vehicle(12,0,0);
    const streetPools={material:{opacity:0}};
    const city={
        preset:{id:cityKey},ready:true,
        roadSurfaceStats:{collidersAdded:0},
        buildingBoxes:[{minX:10,maxX:20}],
        sidewalkGrid:new Set(['40:-40']),
        isWaterAt(x,z){return x<0;},
        isOnSidewalk(x,z){return z>200;},
        getGroundHeightAt(x,z){return 0;},
        chicagoNightState:{quantized:24,level:.75,streetPools}
    };
    const game={
        scene:{objects:meshes,add(mesh){meshes.push(mesh);}},
        playerCar:player,vehicles:[player],
        currentCityKey:cityKey,city,dayNight:{time,rain},
        effects:{rainEnabled:rain},
        getPlayerPosition(){return {x:12,z:0};}
    };
    return game;
}
test('two fixed instanced draw batches, no dynamic lights or colliders',()=>{
    const game=makeGame();
    const before=JSON.stringify(game.city.buildingBoxes);
    const shadows=Array.from(game.city.sidewalkGrid);
    const fx=new FX(game);
    assert.equal(game.scene.objects.length,2);
    assert.equal(fx.beams.count,FX.MAX_VEHICLES*2);
    assert.equal(fx.reflections.count,FX.MAX_VEHICLES*2);
    assert(!game.scene.objects.some(x=>x.isLight));
    assert.equal(JSON.stringify(game.city.buildingBoxes),before);
    assert.deepEqual(Array.from(game.city.sidewalkGrid),shadows);
    assert.equal(game.city.roadSurfaceStats.collidersAdded,0);
    assert.equal(canvases.slice(-2).length,2);
    assert.deepEqual(canvases.at(-1).scaled,[1,2]);
});
test('sunlight hides all ground decals; night projects 2 headlights per car',()=>{
    const game=makeGame({time:.49});
    const fx=new FX(game);
    assert.equal(fx.update(.016).active,0);
    assert.equal(fx.beams.visible,false);
    assert.equal(fx.reflections.visible,false);
    game.dayNight.time=.95;
    const result=fx.update(.016);
    assert.equal(result.active,1);
    assert.equal(fx.beams.visible,true);
    assert.equal(fx.reflections.visible,false);
    assert(fx.lightMaterial.opacity>.25);
    assert.equal(fx.beams.matrices[2].s[0],0,'unused instance hidden');
});
test('light projections follow heading and front axle, not camera facing',()=>{
    const game=makeGame();
    const fx=new FX(game);
    fx.update(.016);
    assert(Math.abs(fx.beams.matrices[0].p[2]-9.8)<1e-8);
    assert(Math.abs(fx.beams.matrices[1].p[0]-fx.beams.matrices[0].p[0]-1.68)<1e-7);
    assert.equal(fx.beams.matrices[0].r[1],0);
    game.playerCar.heading=Math.PI/2;
    fx.update(.016);
    assert(Math.abs(fx.beams.matrices[0].p[0]-(game.playerCar.x+9.8))<1e-7);
    assert.equal(fx.beams.matrices[0].r[1],Math.PI/2);
});
test('rain turns on long low-cost reflections, boosts lamp pool opacity',()=>{
    const game=makeGame();
    const fx=new FX(game);
    const dry=fx.update(.016);
    assert.equal(dry.wet,false);
    assert.equal(game.city.chicagoNightState.streetPools.material.opacity,.24*.75);
    game.dayNight.rain=true;
    game.effects.rainEnabled=true;
    const wet=fx.update(.016);
    assert.equal(wet.active,1);
    assert.equal(wet.wet,true);
    assert.equal(fx.reflections.visible,true);
    assert(fx.wetMaterial.opacity>.19);
    assert(Math.abs(game.city.chicagoNightState.streetPools.material.opacity-.24*.75*1.34)<1e-10);
    game.dayNight.rain=false;
    game.effects.rainEnabled=false;
    fx.update(.016);
    assert.equal(fx.reflections.visible,false);
});
test('manual headlights off or submerged vehicle cannot create floor lights',()=>{
    const game=makeGame();
    const fx=new FX(game);
    game.playerCar.headlightsOn=false;
    assert.equal(fx.update(.016).active,0);
    game.playerCar.headlightsOn=true;game.playerCar.isSubmerged=true;
    assert.equal(fx.update(.016).active,0);
    game.playerCar.isSubmerged=false;
    game.playerCar.x=-18;game.playerCar.z=0;
    assert.equal(fx.update(.016).active,0,'water is excluded');
});
test('bridges and elevated cars do not draw floating reflections',()=>{
    const game=makeGame(),fx=new FX(game);
    game.playerCar.y=10;
    assert.equal(fx.update(.016).active,0);
    game.playerCar.y=0;
    game.city.getGroundHeightAt=()=>-4;
    assert.equal(fx.update(.016).active,0);
    game.city.getGroundHeightAt=()=>0;
    assert.equal(fx.update(.016).active,1);
});
test('nearest 7 active cars only; safe when switching city or loading',()=>{
    const game=makeGame(),fx=new FX(game);
    for(let i=0;i<70;i++){
        game.vehicles.push(vehicle(18+i,3+i/3));
    }
    let result=fx.update(.016);
    assert.equal(result.active,FX.MAX_VEHICLES);
    assert(fx.beams.instanceMatrix.needsUpdate);
    assert.equal(game.scene.objects.length,2);
    game.city.preset.id='rio';
    result=fx.update(.016);
    assert.equal(result.active,0);
    assert.equal(fx.beams.visible,false);
    game.city.preset.id='chicago';game.city.ready=false;
    result=fx.update(.016);
    assert.equal(result.active,0);
    assert.equal(fx.reflections.visible,false);
});
test('R4 integrates after camera and clock, rain state preserved on vehicles',()=>{
    const game=fs.readFileSync(path.join(root,'js/engine/driver2-game-engine.js'),'utf8');
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const clock=game.indexOf('this.dayNight.update(dt)');
    const update=game.indexOf('this.roadLightFx.update(dt)');
    assert(clock>=0&&update>clock);
    assert(game.indexOf('if(this.isPaused){')<update);
    assert(game.indexOf('this.updateCamera(dt);')<update);
    assert(game.includes('new DriverRoadLightFX(this)'));
    assert(game.includes('for(const v of this.vehicles)v.wetRoad=!!this.dayNight.rain'));
    assert(html.includes('js/render/road-light-fx.js'));
    assert(html.indexOf('road-light-fx.js')<html.indexOf('driver2-game-engine.js'));
    assert.equal(game.includes('new THREE.SpotLight('),false);
});
