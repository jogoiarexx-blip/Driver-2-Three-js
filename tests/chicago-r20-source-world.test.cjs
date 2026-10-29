'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R15=require('../js/world/chicago-ps1-reference-curve.js'),R19=require('../js/world/chicago-ps1-reference-north-network.js');
let World,Road;try{World=require('../js/world/chicago-source-world.js');Road=require('../js/world/chicago-ps1-reference-arterial.js');}catch{}
test('limites retangulares incluem a fonte completa e o cenário anterior sem esticar a referência',()=>{
 assert(World,'envelope mundial ausente');const b=World.bounds('chicago'),m=require('../chicago/manifest.json');
 for(const x of [m.bounds.min[0],m.bounds.max[0]])for(const z of [m.bounds.min[2],m.bounds.max[2]]){
  const p=R15.fitPoint([x,z]);assert(p.x>b.minX&&p.x<b.maxX&&p.z>b.minZ&&p.z<b.maxZ);
 }
 for(const x of [-410,410])for(const z of [-410,410])assert(x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ);
 assert(b.maxZ>1300);assert(b.maxX<600);
});
test('troca de cidade restaura limites antigos e colisão não permite sair pelo lado estreito',()=>{
 assert(World);const City=vm.runInNewContext(fs.readFileSync('js/world/city-builder.js','utf8')+'\nCityBuilder',{});
 const c=Object.create(City.prototype);c.preset={id:'chicago'};World.apply(c);c.interiorArea=()=>null;c.buildingBoxes=[];
 assert(!c.isPointBlocked(-380,600,1.55,0));assert(c.isPointBlocked(c.worldBounds.maxX+1,600,1.55,0));
 c.preset={id:'havana'};World.apply(c);assert.equal(c.worldLimit,410);assert(c.isPointBlocked(0,600,1.55,0));
 for(const id of ['havana','vegas','rio'])assert.deepEqual(World.bounds(id),{minX:-410,maxX:410,minZ:-410,maxZ:410});
});
test('arterial atravessa a antiga borda com ligação exata ao norte da R19',()=>{
 assert(Road,'arterial ausente');const p=Road.plan();assert.deepEqual(p.points[0],R19.plans().continuation.points.at(-1));
 assert(p.points.at(-1).z>620);assert(p.points.some(v=>v.x< -380));assert.equal(p.wholeMapCertified,false);
 for(const s of Road.source.pointsOBJ)assert.deepEqual(Road.fitPoint(s),R15.fitPoint(s));
});
test('arterial mantém largura seca e pixels observados; terreno novo não substitui o núcleo antigo',()=>{
 assert(World&&Road);const crypto=require('node:crypto'),zlib=require('node:zlib');
 const raw=fs.readFileSync('chicago/reference-street-survey.json'),s=JSON.parse(raw),hash=crypto.createHash('sha256').update(raw).digest('hex');
 assert.equal(Road.source.sourceSHA256,hash);assert.equal(World.source.sourceSHA256,hash);
 const masks=['markedPaving','plainPaving'].map(k=>zlib.gunzipSync(Buffer.from(s.layers[k].gzipBitsetBase64,'base64')));
 for(const [x,y] of Road.source.sourcePixels){const bit=y*s.width+x;assert(masks.some(b=>b[bit>>>3]&(128>>>(bit&7))));}
 const river=require('../js/world/chicago-ps1-river-branches.js'),coast=require('../js/world/chicago-ps1-coastline.js'),p=Road.plan(),bounds=World.bounds('chicago');
 for(let i=0;i<p.points.length;i++){
  const c=p.points[i],a=p.points[Math.max(0,i-1)],b=p.points[Math.min(p.points.length-1,i+1)],l=Math.hypot(b.x-a.x,b.z-a.z);
  for(const sign of [-1,0,1]){const x=c.x-sign*(b.z-a.z)/l*4,z=c.z+sign*(b.x-a.x)/l*4;assert(!river.waterAt(x,z)&&!coast.waterAt(x,z));assert(x>bounds.minX&&x<bounds.maxX&&z>bounds.minZ&&z<bounds.maxZ);}
 }
 for(const r of World.grassRects())assert(Math.abs((r.x0+r.x1)/2)>420||Math.abs((r.z0+r.z1)/2)>420);
 assert.equal(World.source.wholeMapBuilt,false);
});
test('lago visível cobre a água física na área ampliada, inclusive em x400 z600',()=>{
 assert(World);const Coast=require('../js/world/chicago-ps1-coastline.js'),terrain=World.terrain('chicago');
 assert(Coast.waterAt(400,600));assert.equal(typeof Coast.shorePoints,'function','lago precisa acompanhar o novo terreno');
 const points=Coast.shorePoints({worldTerrain:terrain});assert.equal(points[0].z,terrain.minZ);assert.equal(points.at(-1).z,terrain.maxZ);
 for(const z of [terrain.minZ,-430,600,1300,terrain.maxZ])assert(points[0].z<=z&&points.at(-1).z>=z);
 assert.equal(Coast.shorePoints({}).at(-1).z,420);
});
