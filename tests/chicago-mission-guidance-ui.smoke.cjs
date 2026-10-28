/**
 * Smoke test do painel de etapa + radar + vinheta de capítulos.
 * node tests/chicago-mission-guidance-ui.smoke.cjs
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ids=[
    'chicago-mission-guidance','chicago-guidance-title',
    'chicago-guidance-detail','chicago-guidance-alert','mission-title'
];
const elements=new Map();
function element(){
    const classes=new Set(['hidden']);
    return {
        textContent:'',style:{},dataset:{},offsetWidth:240,
        classList:{
            add(v){classes.add(v);},remove(v){classes.delete(v);},
            toggle(v,cond){
                if(cond)classes.add(v);else classes.delete(v);
            },
            contains(v){return classes.has(v);}
        },
        setAttribute(k,v){this[k]=v;}
    };
}
for(const id of ids)elements.set(id,element());
elements.get('mission-title').textContent='CHICAGO 03 • TRAIN PURSUIT';
const document={
    getElementById(id){return elements.get(id)||null;},
    createElement(){return element();},
    body:{appendChild(element){elements.set('driver-undercover-intro',element);}}
};
const ctx={document};
vm.createContext(ctx);
function load(file,name){
    const filename=path.join(__dirname,'..',file);
    vm.runInContext(fs.readFileSync(filename,'utf8')+
        '\nthis.'+name+'='+name+';',ctx,{filename});
    return ctx[name];
}
load('js/gameplay/campaign-flow.js','DriverCampaignFlow');
const Guidance=load('js/gameplay/chicago-mission-guidance.js',
    'DriverChicagoMissionGuidance');
const Briefing=load('js/gameplay/mission-briefing.js',
    'DriverMissionBriefing');
const game={
    missionActive:true,currentCityKey:'chicago',
    missionType:'story_train',mode:'driving',
    trainLine:{arrived:false,position:{x:0,z:-180}},
    city:{safeHouseZone:{x:-120,z:-101}},
    getPlayerPosition(){return {x:0,z:-100};}
};
let s=Guidance.render(game);
assert.equal(s.id,'train');
assert.equal(elements.get('chicago-mission-guidance').
    classList.contains('hidden'),false);
assert(elements.get('chicago-guidance-title').textContent.
    includes('ACOMPANHE O TREM'));
assert.equal(elements.get('chicago-guidance-title').textContent.
    includes('80m'),true);

const recorded=[];
const canvas={
    save(){recorded.push('save');},restore(){recorded.push('restore');},
    beginPath(){recorded.push('begin');},moveTo(){},lineTo(){},
    stroke(){recorded.push('stroke');},arc(){recorded.push('arc');},
    fill(){recorded.push('fill');},setLineDash(){},
    set strokeStyle(v){},set fillStyle(v){},
    set lineWidth(v){}
};
Guidance.drawRadar(canvas,game,game.getPlayerPosition(),.52);
assert(recorded.includes('arc'));
assert.equal(recorded[0],'save');
assert.equal(recorded.at(-1),'restore');

game.trainLine.arrived=true;
s=Guidance.render(game);
assert.equal(s.id,'platform');
assert.equal(elements.get('chicago-guidance-title').textContent.
    includes('PLATAFORMA'),true);
const opening=new Briefing();
opening.begin(game,'story_train');
assert(opening.active);
assert(opening.element.textContent.includes('TRAIN PURSUIT'));
for(let i=0;i<12;i++)opening.tick(.2);
assert.equal(opening.element.textContent,'SUBA ATÉ A PLATAFORMA');
for(let i=0;i<15;i++)opening.tick(.2);
assert.equal(opening.active,false);

game.missionActive=false;
Guidance.render(game);
assert(elements.get('chicago-mission-guidance').
    classList.contains('hidden'));
console.log('PASS HUD e radar + mudança de etapa + vinheta + limpeza');
