'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const Stream=require('../js/world/chicago-original-tile-stream.js');
class Group{
 constructor(){this.children=[];this.userData={};this.parent=null;this.position={x:0,z:0,set:(x,y,z)=>{this.position.x=x;this.position.z=z;}};this.scale={setScalar:v=>{this.scale.value=v;}};}
 add(c){this.children.push(c);c.parent=this;}remove(c){this.children=this.children.filter(x=>x!==c);c.parent=null;}
 traverse(cb){for(const c of this.children){cb(c);c.traverse?.(cb);}}
}
const THREE={Group,DoubleSide:2,ClampToEdgeWrapping:1,
NearestFilter:1,NearestMipmapNearestFilter:1,
TextureLoader:class{load(u){const t={uri:u,dispose(){t.disposed=true}};return t}},
MeshBasicMaterial:class{constructor(a){this.args=a;}dispose(){this.disposed=true}},
GLTFLoader:class{load(uri,success){const g=new Group();const mesh={isMesh:true,geometry:{dispose(){this.disposed=true}},material:{dispose(){this.disposed=true}}};g.add(mesh);success({scene:g});}}
};
const manifest={format:'Driver2ChicagoVisualTilesV1',visualOnly:true,collisionReady:false,
 atlas:'chicago_atlas.webp',center:[-60,0,125],bounds:{min:[-110,-1,32],max:[-10,2,224]},
 tiles:[
  {id:'00_00',url:'chunks/00_00.glb',bounds:{min:[-65,0,120],max:[-55,1,130]},triangles:123},
  {id:'02_00',url:'chunks/02_00.glb',bounds:{min:[-25,0,120],max:[-18,1,130]},triangles:345}
 ]};
function newStream(opts={}){return new Stream({scene:new Group(),THREE,maxLoaded:1,
 loadRadius:13,unloadRadius:18,...opts});}
test('carrega manifest e um atlas comum sem colisores',async()=>{
 const a=newStream();a.bindManifest(manifest);
 assert.equal(a.root.position.x,204);assert.equal(a.root.position.z,-425);
 // start not used, assign shared test materials explicitly
 a.texture={dispose(){this.disposed=true}};
 a.material={dispose(){this.disposed=true}};
 const center=a.root.position; // chunk A x -60,z125 maps to world x0,z0
 a.update({x:0,z:0});
 assert.equal(a.loaded.size,1);assert.equal(a.stats().trianglesLoaded,123);
 assert.equal(a.stats().collidersCreated,0);
 assert.equal(a.root.children.length,1);
 a.update({x:200,z:0});
 assert.equal(a.loaded.size,0);
 a.dispose();assert.equal(a.material,null);
});
test('não gera requisições repetidas e limpa grupos ao descarregar',()=>{
 const a=newStream({maxLoaded:2});a.bindManifest(manifest);
 a.material={dispose(){this.disposed=true}};
 a.update({x:0,z:0});a.update({x:0,z:0});
 assert.equal(a.loaded.size,1);a.dispose();
 assert.equal(a.scene.children.length,0);
 assert.equal(a.stats().tilesLoaded,0);
 a.dispose();
});
test('rejeita manifest inválido, URLs de fora e promessa de física',()=>{
 const s=newStream();assert.throws(()=>s.bindManifest({...manifest,collisionReady:true}),/isolamento/);
 assert.throws(()=>s.bindManifest({...manifest,tiles:[{id:'unsafe',url:'../../evil.glb',bounds:manifest.tiles[0].bounds}]}),/Chunk inválido/);
 assert.throws(()=>s.bindManifest({}),/Manifest/);
});

test('prioriza o setor próximo mesmo com cache cheio dentro do raio de retenção',()=>{
 const a=newStream({maxLoaded:1,loadRadius:55,unloadRadius:75});
 a.bindManifest(manifest);a.material={dispose(){}};
 a.update({x:0,z:0});
 assert(a.loaded.has('00_00'));
 const old=a.loaded.get('00_00').group;
 // B está a 40 unidades OBJ de A: ambos ainda no raio de retenção.
 a.update({x:40*3.4,z:0});
 assert(a.loaded.has('02_00'),'setor sob o carro deve substituir o distante');
 assert.equal(a.loaded.size,1);
 assert.equal(old.parent,null);
});
