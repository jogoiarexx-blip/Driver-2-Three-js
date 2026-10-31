'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/entities/pedestrians-roadblocks.js','utf8');
const nav={
    pick(_city,focus,n){
        return Array.from({length:n},(_,i)=>({
            x:focus.x+40+(i%6)*14,z:focus.z+40+Math.floor(i/6)*20
        }));
    },
    route(block){const {x,z}=block;return [
        {x:x-20,z:z-20},{x:x+20,z:z-20},
        {x:x+20,z:z+20},{x:x-20,z:z+20}
    ]},
    point(route,edge,t){const a=route[edge],b=route[(edge+1)%4];
        return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}},
    permitted(_city,x,z){return Number.isFinite(x)&&Number.isFinite(z)}
};
const Manager=vm.runInNewContext(source+'\nPedestrianAndRoadblockManager',{
    DriverPedestrianSidewalks:nav,Math,Number
});
function make(){
    const m=Object.create(Manager.prototype);
    m.city={getSidewalkHeightAt(){return .35}};
    m.pedestrians=Array.from({length:28},(_,i)=>({
        x:500,z:500,nextCorner:1,
        preferredSpecies:i>=7&&i<=9?'dog':null,
        species:i>=7&&i<=9?'dog':'adult',
        mesh:{visible:true,position:{set(x,y,z){this.x=x;this.y=y;this.z=z}}}
    }));
    m.pedestrianClock=0;
    return m;
}
test('os tres cachorros aparecem perto do jogador sem novos NPCs',()=>{
    const m=make(),focus={x:0,z:0};
    assert.equal(m.placeNearbyDogs(focus),3);
    assert.equal(m.pedestrians.length,28);
    const dogs=m.pedestrians.slice(7,10);
    for(const dog of dogs){
        const d=Math.hypot(dog.x,dog.z);
        assert(d>=28&&d<=105);
        assert(nav.permitted(m.city,dog.x,dog.z));
        assert.equal(dog.mesh.position.y,.35);
    }
    for(let i=0;i<dogs.length;i++)
        for(let j=i+1;j<dogs.length;j++)
            assert(Math.hypot(dogs[i].x-dogs[j].x,dogs[i].z-dogs[j].z)>=22);
    assert.equal(m.placeNearbyDogs(focus),0,'nao teleporta animais ja proximos');
});
test('ao dirigir para longe, os animais reaparecem em calçadas próximas',()=>{
    const m=make(),a={x:0,z:0},b={x:800,z:150};
    m.placeNearbyDogs(a);
    assert.equal(m.placeNearbyDogs(b),3);
    assert(m.pedestrians.slice(7,10).every(p=>
        Math.hypot(p.x-b.x,p.z-b.z)<=105));
    assert.equal(m.pedestrians.length,28);
});
test('o reposicionamento nao mexe nas vagas humanas nem num cão ausente',()=>{
    const m=make(),before=m.pedestrians[0];
    m.pedestrians[8].preferredSpecies=null;
    m.pedestrians[8].species='adult';
    assert.equal(m.placeNearbyDogs({x:0,z:0}),2);
    assert.equal(m.pedestrians[0],before);
    assert.equal(m.pedestrians[8].x,500);
});
