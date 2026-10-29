'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const R16=require('../js/world/chicago-ps1-reference-extension.js'),R15=require('../js/world/chicago-ps1-reference-curve.js');
let Bridge;try{Bridge=require('../js/world/chicago-ps1-reference-bridge.js');}catch{}
test('ligação norte mantém cabeceira e alinhamento do PS1 além do canal',()=>{
 assert(Bridge,'ligação norte com ponte ausente');const p=Bridge.plan();
 assert.deepEqual(p.points[0],R16.plan().points.at(-1));assert(p.points.at(-1).z>175);
 for(const s of Bridge.source.pointsOBJ)assert.deepEqual(Bridge.fitPoint(s),R15.fitPoint(s));
 assert.equal(p.wholeMapCertified,false);assert.equal(p.originalPlacementCertified,false);
});
test('tabuleiro, rampas e cortes de margem deixam um corredor físico sem apagar água lateral',()=>{
 assert(Bridge,'ligação norte com ponte ausente');const p=Bridge.plan();
 for(const z of [34,50,66]){
  const x=Bridge.axisAt(z);assert(Number.isFinite(x));
  assert(Bridge.isBridgeDeck(x,z));assert(Bridge.deckHeight(x,z)>.1);
  assert(!Bridge.isBridgeDeck(x+9,z));assert.equal(Bridge.deckHeight(x+9,z),null);
  assert(!Bridge.railBlocked(x,z,1.55,0));
  if(z!==50){const gap=Bridge.openingAt(z);assert(gap.minX<x-6&&gap.maxX>x+6);}
 }
 assert.equal(Bridge.deckHeight(0,50),null);
 assert.equal(Bridge.railBlocked(0,50,1.55,0),false);
 assert.equal(Bridge.railBlocked(Bridge.axisAt(50)+5.8,50,.5,4),false);
 for(let z=23;z<80;z+=.25){const x=Bridge.axisAt(z);if(x!==null){const h=Bridge.deckHeight(x,z);assert(h>=0&&h<=.18);}}
 for(const {a,b} of Bridge.railSegments()){const x=(a.x+b.x)/2,z=(a.z+b.z)/2;assert(Bridge.railBlocked(x,z,.1,0));assert(!Bridge.railBlocked(x,z,.1,4));}
 assert(p.lots.length===0);
});
test('CityBuilder usa altura de ponte e preserva água e isolamento das outras cidades',()=>{
 assert(Bridge);const fs=require('node:fs'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto');
 const City=vm.runInNewContext(fs.readFileSync('js/world/city-builder.js','utf8')+'\nCityBuilder',{DriverChicagoPS1ReferenceBridge:Bridge});
 const city=Object.create(City.prototype);city.preset={id:'chicago'};city.sidewalkGrid=new Set();
 const x=Bridge.axisAt(50);assert.equal(city.isWaterAt(x,50),false);assert.equal(city.getGroundHeightAt(x,50),.18);
 assert.equal(city.isWaterAt(x+12,50),true);assert.equal(city.getGroundHeightAt(x+12,50),-4);
 city.preset={id:'havana'};assert.equal(city.isWaterAt(x,50),true);assert.equal(city.getGroundHeightAt(x,50),-4);
 const raw=fs.readFileSync('chicago/reference-street-survey.json'),survey=JSON.parse(raw);
 assert.equal(Bridge.source.sourceSHA256,crypto.createHash('sha256').update(raw).digest('hex'));
 const masks=['markedPaving','plainPaving'].map(k=>zlib.gunzipSync(Buffer.from(survey.layers[k].gzipBitsetBase64,'base64')));
 for(const [x,y] of Bridge.source.sourcePixels){const bit=y*survey.width+x;assert(masks.some(b=>b[bit>>>3]&(128>>>(bit&7))));}
});
