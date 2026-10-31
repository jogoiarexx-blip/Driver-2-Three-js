'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Nav=require('../js/ui/chicago-landmark-navigation-r56.js');

function classes(initial=[]){
    const s=new Set(initial);
    return {contains:v=>s.has(v),add:v=>s.add(v),
        toggle(v,force){if(force===undefined)force=!s.has(v);
            if(force)s.add(v);else s.delete(v);return force}};
}
function element(id,classesInitial=[]){
    return {id,textContent:'',dataset:{},attributes:{},
        classList:classes(classesInitial),handlers:{},
        addEventListener(type,fn){this.handlers[type]=fn},
        setAttribute(name,value){this.attributes[name]=value},
        click(){this.handlers.click?.()}};
}
function fixture(){
    const els={};
    for(const id of ['driver-landmarks-r56','driver-landmarks-r56-menu',
        'driver-landmarks-r56-toggle','driver-landmarks-r56-status'])
        els[id]=element(id,['hidden']);
    const buttons=['navy-pier','wrigley','soldier','clear'].map(id=>{
        const el=element('button-'+id);el.dataset.chicagoLandmarkR56=id;
        return el;
    });
    global.document={getElementById:id=>els[id]||null,
        querySelectorAll:()=>buttons};
    let blocked=false,routePlans=0;
    const routes=[
        {id:'navy-pier',name:'NAVY PIER',from:[320,-40],to:[359,-40]},
        {id:'wrigley',name:'WRIGLEY FIELD',from:[-280,240],to:[-280,222.5]},
        {id:'soldier',name:'SOLDIER FIELD',from:[280,-240],to:[280,-267]}
    ];
    global.DriverChicagoLandmarkAccessR55={ROUTES:routes,
        sampleRoute(){return {open:!blocked}}};
    global.DriverChicagoMixedNavigationR49={
        plan(city,player,entry) {
            routePlans++;if(blocked)return null;
            return [{x:player.x,z:player.z},{x:entry.x,z:entry.z}];
        },
        clear(){return !blocked}
    };
    const player={x:310,z:-40,heading:0};
    const game={
        currentCityKey:'chicago',loadingActive:false,
        city:{preset:{id:'chicago'},ready:true,buildingBoxes:[],
            bridgeRaised:false,buildSequence:1},
        missionActive:false,missionType:'freeroam',
        inReplayMode:false,interiorPlace:null,navigationHome:false,
        getPlayerPosition(){return player}
    };
    Nav.bind(game);
    return {game,player,els,buttons,plans:()=>routePlans,
        blocked:v=>{blocked=v}};
}
test('R56: chooser binds and routes to three landmarks without touching missions',()=>{
    const x=fixture();
    for(const id of ['navy-pier','wrigley','soldier']){
        const btn=x.buttons.find(b=>b.dataset.chicagoLandmarkR56===id);
        btn.click();
        assert.equal(Nav.audit(x.game).destination,id);
        assert.ok(Nav.audit(x.game).routeAvailable);
        assert.equal(x.game.missionType,'freeroam');
        assert.equal(x.game.missionActive,false);
    }
    assert.ok(x.els['driver-landmarks-r56-status'].textContent.includes('SOLDIER FIELD'));
    x.buttons[3].click();
    assert.equal(Nav.audit(x.game).destination,null);
});
test('R56: cannot display a fake route through inaccessible roads',()=>{
    const x=fixture();x.blocked(true);
    Nav.select(x.game,'navy-pier');
    assert.equal(Nav.audit(x.game).routeAvailable,false);
    assert.match(Nav.audit(x.game).reason,/bloqueado/i);
});
test('R56: mission and home guidance take priority; changing city clears target',()=>{
    const x=fixture();Nav.select(x.game,'wrigley');
    x.game.missionActive=true;
    assert.equal(Nav.isEligible(x.game),false);
    x.game.missionActive=false;x.game.navigationHome=true;
    assert.equal(Nav.isEligible(x.game),false);
    x.game.navigationHome=false;x.game.currentCityKey='havana';
    Nav.cityChanged(x.game);
    assert.equal(Nav.audit(x.game).destination,null);
    Nav.update(x.game);
    assert.equal(x.els['driver-landmarks-r56'].classList.contains('hidden'),true);
});
test('R56: radar draws pins and route only during free roam',()=>{
    const x=fixture();Nav.select(x.game,'navy-pier');
    const calls=[];
    const ctx={
        save(){calls.push('save')},restore(){calls.push('restore')},
        beginPath(){},moveTo(){calls.push('move')},
        lineTo(){calls.push('line')},stroke(){},fill(){},arc(){calls.push('arc')},
        translate(){},scale(){},setLineDash(){},
        fillText(label){calls.push(label)}
    };
    Nav.drawRadar(ctx,x.game,x.player,.16);
    assert.ok(calls.includes('line'));
    assert.ok(calls.includes('P')&&calls.includes('W')&&calls.includes('S'));
    const n=calls.length;
    x.game.missionActive=true;
    Nav.drawRadar(ctx,x.game,x.player,.16);
    assert.equal(calls.length,n);
});
test('R56: no repeated A* while stationary; destination clicks select and close',()=>{
    const x=fixture();
    x.els['driver-landmarks-r56-toggle'].click();
    assert.equal(x.els['driver-landmarks-r56-menu'].classList.contains('hidden'),false);
    x.buttons[0].click();
    assert.equal(x.els['driver-landmarks-r56-menu'].classList.contains('hidden'),true);
    const planned=x.plans();
    for(let i=0;i<120;i++)Nav.update(x.game);
    assert.equal(x.plans(),planned);
    x.game.navigationHome=true;
    assert.equal(Nav.select(x.game,'soldier'),true);
    assert.equal(x.game.navigationHome,false);
});
