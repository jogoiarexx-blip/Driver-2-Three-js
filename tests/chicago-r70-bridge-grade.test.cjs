'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Road=require('../js/world/road-geometry.js');
global.DriverRoadGeometry=Road;
const Nav=require('../js/traffic/chicago-mixed-navigation-r49.js');
function city(extra={}){
    return {preset:{id:'chicago'},roadExtent:320,
        buildSequence:1,bridgeRaised:false,buildingBoxes:[],
        isWaterAt:()=>false,isPointBlocked:()=>false,
        getGroundHeightAt:()=>0,...extra};
}
test('R70: opening Chicago bridge closes BOTH raised bascules, not only downtown',()=>{
    const c=city();
    for(const x of [0,240]){
        assert.equal(Nav.bridgeClosed(c,{x,z:0},{x,z:80}),false);
        assert.equal(Nav.clear(c,{x,z:0},{x,z:80}),true);
    }
    c.bridgeRaised=true;
    for(const x of [0,240]){
        const a={x,z:0},b={x,z:80};
        assert.equal(Nav.bridgeClosed(c,a,b),true,'raised deck '+x);
        assert.equal(Nav.bridgeClosed(c,b,a),true,'bidirectional '+x);
        assert.equal(Nav.clear(c,a,b),false,'no traffic through raised '+x);
        assert.equal(Nav.bridgeClosed(c,{x,z:0},{x,z:40}),true,
            'partial road touching southern leaf must be blocked '+x);
        assert.equal(Nav.bridgeClosed(c,{x,z:40},{x,z:80}),true,
            'partial road touching northern leaf must be blocked '+x);
    }
    assert.equal(Nav.bridgeClosed(c,{x:-240,z:-80},{x:-160,z:-80}),false,
        'fixed West Canal crossing never closes with bascules');
    assert.equal(Nav.clear(c,{x:-280,z:-80},{x:-200,z:-80}),true,
        'fixed river bridge remains driveable');
    assert.equal(Nav.bridgeClosed(c,{x:160,z:0},{x:160,z:80}),false,
        'unrelated corridor may be checked by water/physics, not falsely closed');
});
test('R70: grade check rejects abrupt overpass cliffs even when XZ is dry',()=>{
    const c=city({getGroundHeightAt:(x,z,_ref,forVehicle)=>{
        assert.equal(forVehicle,true);
        return x<40?0:3.2;
    }});
    assert.equal(Road.segmentDrivable(c,0,-80,80,-80,1.45),true,
        'pre-R70 collision-only verifier accepts a phantom vertical jump');
    assert.equal(Nav.gradeClear(c,{x:0,z:-80},{x:80,z:-80},true,4),false);
    assert.equal(Nav.clear(c,{x:0,z:-80},{x:80,z:-80}),false,
        'the navigation graph must not connect these two street levels');
    assert.equal(Nav.clear(c,{x:0,z:-80},{x:20,z:-80}),true,
        'legitimate same-level street remains usable');
});
test('R70: modest bridge ramps and vehicle underpasses stay passable',()=>{
    const c=city({
        getGroundHeightAt:(x,z,referenceY,forVehicle)=>{
            assert.equal(forVehicle,true);
            if(Math.abs(x-240)<12&&z>=34&&z<=66){
                return .15+.13*Math.min(z-34,66-z);
            }
            // A train platform at 11.3m is for pedestrians; car ground=0.
            if(x>50&&x<70&&z<0)return 0;
            return 0;
        }
    });
    assert.equal(Nav.clear(c,{x:240,z:0},{x:240,z:80},true,4),
        true,'smooth ramp height must not look like a false cliff');
    assert.equal(Nav.clear(c,{x:60,z:-100},{x:60,z:-40},true,4),true);
    assert.equal(Nav.clear(c,{x:-280,z:-80},{x:-200,z:-80}),true);
});
test('R70: grade checks both shoulders and reject NaN heights',()=>{
    const c=city({getGroundHeightAt:(x,z)=>z>2&&x>35?2.5:0});
    assert.equal(Nav.gradeClear(c,{x:0,z:0},{x:80,z:0},false),true,
        'safe centerline before shoulder clearance');
    assert.equal(Nav.clear(c,{x:0,z:0},{x:80,z:0},true,4),false,
        'raised shoulder cannot become an invisible ramp');
    c.getGroundHeightAt=()=>NaN;
    assert.equal(Nav.clear(c,{x:0,z:0},{x:80,z:0}),false);
    c.getGroundHeightAt=()=>0;
    assert.equal(Nav.clear(c,{x:0,z:0},{x:80,z:0}),true);
});
test('R70: graph invalidates on bascule state change; no fake east deck link',()=>{
    const c=city(),open=Nav.compile(c);
    assert(open.adj.get('240,0').some(e=>e.key==='240,80'));
    assert(open.adj.get('0,0').some(e=>e.key==='0,80'));
    c.bridgeRaised=true;
    const raised=Nav.compile(c);
    assert.notEqual(open,raised);
    assert(!raised.adj.get('240,0').some(e=>e.key==='240,80'),
        'the previously unguarded east bascule edge must disappear');
    assert(!raised.adj.get('0,0').some(e=>e.key==='0,80'));
    assert.equal(Nav.compile(c),raised);
    c.bridgeRaised=false;
    const lowered=Nav.compile(c);
    assert.notEqual(lowered,raised);
    assert(lowered.adj.get('240,0').some(e=>e.key==='240,80'));
});
test('R70: other cities use their own existing navigation, not Chicago bascule mask',()=>{
    const other=city({preset:{id:'rio'},bridgeRaised:true});
    assert.equal(Nav.compile(other),null);
    assert.equal(Nav.bridgeClosed(other,{x:240,z:0},{x:240,z:80}),true,
        'helper is scoped by callers, not used for other city route graph');
});
