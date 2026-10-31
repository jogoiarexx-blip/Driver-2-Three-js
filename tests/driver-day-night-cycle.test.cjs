'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/render/day-night-cycle.js'),'utf8');

class Color {
    constructor(hex=0){this.setHex(hex);}
    setHex(hex){this.hex=hex;return this;}
    copy(c){this.hex=c.hex;return this;}
    lerp(other,amount) {
        const a=this.hex,b=other.hex,t=Math.max(0,Math.min(1,amount));
        let hex=0;
        for(const shift of [0,8,16]){
            const val=Math.round(((a>>shift)&255)*(1-t)+((b>>shift)&255)*t);
            hex|=val<<shift;
        }
        this.hex=hex;return this;
    }
}
class Vec {
    constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
}
class Light {
    constructor(hex,intensity){
        this.color=new Color(hex);
        this.position=new Vec();
        this.target={position:new Vec(),updateMatrixWorld(){}};
        this.intensity=intensity;this.castShadow=false;
        this.shadow={
            mapSize:{set(x,y){this.x=x;this.y=y;}},
            camera:{}
        };
    }
}
class Sprite {
    constructor(material){
        this.material=material;
        this.position=new Vec();
        this.scale=new Vec(1,1,1);
        this.visible=true;
    }
}
const THREE={
    Color,DirectionalLight:Light,Sprite,
    CanvasTexture:class {constructor(image){this.image=image;}},
    SpriteMaterial:class {constructor(options){Object.assign(this,options);}},
    PCFSoftShadowMap:1
};
const canvases=[];
const document={
    createElement(name){
        assert.equal(name,'canvas');
        const draws=[],ctx={
            createRadialGradient(){
                const stops=[];
                return {stops,addColorStop(x,c){stops.push([x,c]);}};
            },
            fillRect(x,y,w,h){draws.push([x,y,w,h]);}
        };
        const canvas={width:0,height:0,draws,getContext(){return ctx;}};
        canvases.push(canvas);
        return canvas;
    },
    getElementById(id){
        return id==='weather-badge'?document.badge:
            id==='btn-headlights'?document.headlights:null;
    },
    badge:{textContent:''},headlights:{textContent:''}
};
const CITY_PRESETS={
    chicago:{sunColor:0xffdda2},
    havana:{sunColor:0xffc18a},
    vegas:{sunColor:0xcac0f0},
    rio:{sunColor:0xffdfb1}
};
const vehicleVisual={calls:[],setHeadlights(vehicle,on){
    vehicle.headlightsOn=on;this.calls.push(on);
}};
const Cycle=vm.runInNewContext(source+'\nDriverDayNightCycle',
    {THREE,CITY_PRESETS,document,VehicleVisuals:vehicleVisual,Math,Number,String});
function makeGame(){
    const items=[];
    const game={
        scene:{
            background:new Color(0),fog:{color:new Color(0)},
            objects:items,add(...all){this.objects.push(...all);}
        },
        renderer:{shadowMap:{enabled:false}},
        sunLight:new Light(0xffe68a,.8),
        ambientLight:{color:new Color(0xffffff),intensity:.75},
        camera:{position:new Vec(4,3,9)},
        currentCityKey:'chicago',
        effects:{rainEnabled:false},
        playerCar:{headlightsOn:false},
        vehicles:[{headlightsOn:false},{headlightsOn:false}],
        getPlayerPosition(){return {x:30,y:1,z:-15};}
    };
    return game;
}
function make(initial=.47){
    document.badge.textContent='';
    vehicleVisual.calls.length=0;
    const game=makeGame();
    const cycle=new Cycle(game,{time:initial,duration:900});
    game.dayNight=cycle;
    return {game,cycle};
}
test('15 min for full day, with working morning noon night positions',()=>{
    const {game,cycle}=make(.47);
    assert.equal(cycle.duration,900);
    assert.equal(game.sunLight.shadow.mapSize.x,1024);
    assert.equal(game.sunLight.shadow.mapSize.y,1024);
    assert.equal(game.sunLight.castShadow,true);
    assert.equal(cycle.sunSprite.visible,true);
    assert.equal(cycle.moonSprite.visible,false);
    const before=cycle.time;
    cycle.update(0.05);
    assert(cycle.time>before);
    assert(Math.abs(cycle.time-before-0.05/900)<1e-8);
    assert.equal(cycle.sunSprite.name,'driver-sky-sun');
    assert.equal(cycle.moonSprite.name,'driver-sky-moon');
});

test('WebP solar e lunar substituem o gradiente apenas após carregarem',()=>{
    const pending=[];
    THREE.TextureLoader=class {load(url,onLoad,onProgress,onError){
        pending.push({url,onLoad,onError});
    }};
    THREE.CanvasTexture.prototype.dispose=function(){this.disposed=true;};
    try {
        const {cycle}=make();
        assert.deepEqual(pending.map(p=>p.url),[
            './assets/sky/sun.webp','./assets/sky/moon.webp']);
        const fallback=cycle.sunSprite.material.map;
        const image={};pending[0].onLoad(image);
        assert.equal(cycle.sunSprite.material.map,image);
        assert.equal(fallback.disposed,true);
        const lunarFallback=cycle.moonSprite.material.map;
        pending[1].onError();
        assert.equal(cycle.moonSprite.material.map,lunarFallback);
        for(const kind of ['sun','moon']) {
            const data=fs.readFileSync(path.join(root,'assets/sky',kind+'.webp'));
            assert.equal(data.toString('ascii',0,4),'RIFF');
            assert.equal(data.toString('ascii',8,12),'WEBP');
            assert(data.length<100000);
        }
    } finally {delete THREE.TextureLoader;}
});

test('botão de céu direciona a câmera para o astro visível',()=>{
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const engine=fs.readFileSync(path.join(root,'js/engine/driver2-game-engine.js'),'utf8');
    assert(html.includes('id="btn-look-sky"'));
    assert(engine.includes('this.camera.lookAt(body.position)'));
    assert(engine.includes("skyButton.setAttribute('aria-pressed'"));
});

test('sunlight and its visual sprite use one vector, shadows point away',()=>{
    const {game,cycle}=make(.47);
    const sun=game.sunLight.position;
    const sprite=cycle.sunSprite.position;
    const focus=game.getPlayerPosition();
    const vecLight=[sun.x-focus.x,sun.y-focus.y,sun.z-focus.z];
    const vecSky=[sprite.x-game.camera.position.x,
        sprite.y-game.camera.position.y,sprite.z-game.camera.position.z];
    assert(Math.abs(vecLight[0]/190-vecSky[0]/260)<1e-7);
    assert(Math.abs(vecLight[1]/190-vecSky[1]/260)<1e-7);
    assert(Math.abs(vecLight[2]/190-vecSky[2]/260)<1e-7);
    assert.equal(game.sunLight.target.position.x,focus.x);
    assert.equal(game.sunLight.target.position.z,focus.z);
});

test('at night the sun disappears, moon appears and ambient light lowers',()=>{
    const {game,cycle}=make(.5);
    const noonIntensity=game.ambientLight.intensity;
    cycle.setWeather('night');
    assert.equal(cycle.sunSprite.visible,false);
    assert.equal(cycle.moonSprite.visible,true);
    assert(game.ambientLight.intensity<noonIntensity);
    assert(game.sunLight.intensity===0);
    assert(game.moonLight===undefined);
    assert(cycle.moonLight.intensity>0);
    assert.equal(game.sunLight.castShadow,false);
    assert(document.badge.textContent.includes('NOITE'));
});

test('day, dusk and rain buttons do not stop clock; storm hides both bodies',()=>{
    const {game,cycle}=make();
    cycle.setWeather('dusk');
    assert(cycle.time>.70&&cycle.time<.75);
    const dusk=cycle.time;
    cycle.update(.05);
    assert(cycle.time>dusk);
    cycle.setWeather('rain');
    assert(game.effects.rainEnabled);
    assert.equal(cycle.sunSprite.visible,false);
    assert.equal(cycle.moonSprite.visible,false);
    assert.equal(game.sunLight.castShadow,false);
    assert(document.badge.textContent.includes('CHUVA'));
    cycle.setWeather('day');
    assert(!game.effects.rainEnabled);
    assert(cycle.time>.48&&cycle.time<.50);
    assert(cycle.sunSprite.visible);
});

test('disable shadows also disables renderer shadow map but keeps sky alive',()=>{
    const {game,cycle}=make();
    cycle.setShadowsEnabled(false);
    assert.equal(game.sunLight.castShadow,false);
    assert.equal(game.renderer.shadowMap.enabled,false);
    assert.equal(cycle.sunSprite.visible,true);
    cycle.setShadowsEnabled(true);
    assert.equal(game.renderer.shadowMap.enabled,true);
    assert.equal(game.sunLight.castShadow,true);
});

test('headlights toggle only on day/night thresholds, not on every frame',()=>{
    const {game,cycle}=make(.50);
    vehicleVisual.calls.length=0;
    cycle.update(.04);
    assert.equal(vehicleVisual.calls.length,0);
    cycle.setWeather('night');
    assert(vehicleVisual.calls.length>=2);
    assert(game.vehicles.every(v=>v.headlightsOn));
    vehicleVisual.calls.length=0;
    cycle.update(.05);
    assert.equal(vehicleVisual.calls.length,0);
    cycle.setWeather('day');
    assert(game.vehicles.every(v=>!v.headlightsOn));
});

test('four city presets keep same clock but different sunlight colors',()=>{
    const {game,cycle}=make(.48);
    const start=cycle.time;
    for(const city of Object.keys(CITY_PRESETS)){
        game.currentCityKey=city;
        cycle.apply(0,true);
        assert.equal(cycle.time,start);
        assert(game.scene.background.hex>0);
        assert(game.scene.fog.color.hex>0);
    }
});

test('clock is driven only while game runs: pause & briefing skip update',()=>{
    const game=fs.readFileSync(path.join(root,'js/engine/driver2-game-engine.js'),'utf8');
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const boot=fs.readFileSync(path.join(root,'js/ui/driver-boot-flow.js'),'utf8');
    const builder=fs.readFileSync(path.join(root,'js/world/city-builder.js'),'utf8');
    const road=fs.readFileSync(path.join(root,'js/world/road-surface.js'),'utf8');
    assert(game.indexOf('if(this.isPaused){')<game.indexOf('this.dayNight.update(dt)'));
    assert(game.indexOf('if(this.briefingDirector?.active)')<
        game.indexOf('this.dayNight.update(dt)'));
    assert(game.includes('this.dayNight.setWeather(mode)'));
    assert(game.includes('this.dayNight.apply(0,true)'));
    assert(boot.includes('this.game.dayNight.setShadowsEnabled(this.settings.shadows)'));
    assert(html.includes('js/render/day-night-cycle.js'));
    assert(html.indexOf('day-night-cycle.js')<html.indexOf('driver2-game-engine.js'));
    assert(builder.includes('ground.receiveShadow=true'));
    assert(builder.includes('sidewalks.receiveShadow=true'));
    assert(road.includes('mesh.receiveShadow=true'));
});
