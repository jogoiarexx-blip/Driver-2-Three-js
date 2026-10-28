/**
 * Luzes dos veículos: node tests/driver2-vehicle-lights.smoke.cjs
 * Testa estados reais do renderer com MeshBasicMaterial simulado.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={
    VehicleDamageFX:{update(){}}
};
vm.createContext(ctx);
const file=path.join(__dirname,'../js/render/vehicle-visuals.js');
vm.runInContext(fs.readFileSync(file,'utf8')+
    '\nthis.Visuals=VehicleVisuals;',ctx,{filename:file});
const Visuals=ctx.Visuals;
const mat=()=>({color:{value:0,setHex(value){this.value=value;}}});
const car={
    speed:22,headlightsOn:true,wetRoad:false,
    headlightMaterial:mat(),tailMaterial:mat(),
    reverseLightMaterial:mat(),
    turnSignalMaterials:{left:mat(),right:mat()},
    headlightBeams:{visible:false,material:{opacity:0}},
    chassisTilt:{position:{y:0}},_suspensionBaseY:0,
    longitudinalG:0,wheels:[]
};
Visuals.update(car,.1,{down:true,left:true});
assert.equal(car.headlightMaterial.color.value,0xfff6bf);
assert.equal(car.tailMaterial.color.value,0xff293c);
assert.equal(car.turnSignalMaterials.left.color.value,0xffaa23);
assert.notEqual(car.turnSignalMaterials.right.color.value,0xffaa23);
assert.equal(car.headlightBeams.visible,true);
car.speed=-7;
Visuals.update(car,.1,{up:true});
assert.equal(car.reverseLightMaterial.color.value,0xf8fafc);
car.speed=20;
Visuals.update(car,.1,{right:true});
assert.equal(car.turnSignalMaterials.right.color.value,0xffaa23);
car.headlightsOn=false;
Visuals.update(car,.1,{});
assert.equal(car.headlightBeams.visible,false);
assert.equal(car.tailMaterial.color.value,0x52151a);
console.log('PASS: faróis, freio, ré, setas esquerda/direita e desligamento');
