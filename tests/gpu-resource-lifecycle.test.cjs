'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const GPU=vm.runInNewContext(read('js/engine/gpu-resources.js')+'\nGPUResourceUtils',{});
const disposable=()=>({count:0,dispose(){this.count++}});
const mesh=(geometry,material,userData={},children=[])=>({geometry,material,userData,children});

test('subárvore de GLB compartilhado não invalida cache nem outras instâncias',()=>{
  const g=disposable(),m=disposable(),t={...disposable(),isTexture:true};
  m.map=t;
  const cloned=mesh(g,m,{cc0SharedAsset:true});
  const other=mesh(g,m,{cc0SharedAsset:true});
  const procedural=mesh(disposable(),disposable());
  GPU.disposeSubtree({children:[cloned,procedural]});
  assert.equal(g.count,0);assert.equal(m.count,0);assert.equal(t.count,0);
  assert.equal(other.geometry,g);
  assert.equal(procedural.geometry.count,1);
  assert.equal(procedural.material.count,1);
});

test('flag de compartilhamento no pai protege os descendentes',()=>{
  const g=disposable(),m=disposable();
  GPU.disposeSubtree({userData:{cc0SharedAsset:true},children:[mesh(g,m)]});
  assert.equal(g.count,0);assert.equal(m.count,0);
});

test('material da pintura individual é liberado, atlas GLB não',()=>{
  const g=disposable(),atlas={...disposable(),isTexture:true};
  const paint={...disposable(),map:atlas,userData:{driverUserPaint:true}};
  GPU.disposeSubtree(mesh(g,paint,{cc0SharedAsset:true}));
  assert.equal(paint.count,1);assert.equal(atlas.count,0);assert.equal(g.count,0);
});

test('geometrias separadas para portas são liberadas com o carro',()=>{
  const g=disposable(),m=disposable();
  GPU.disposeSubtree(mesh(g,m,{cc0SharedAsset:true,driverOwnedGeometry:true}));
  assert.equal(g.count,1);assert.equal(m.count,0);
  const door=read('js/vehicles/police-door-rig.js');
  assert.match(door,/mesh\.userData\.driverOwnedGeometry\s*=\s*true/);
  assert.match(door,/part\.userData\.driverOwnedGeometry\s*=\s*true/);
});

test('objetos privados compartilham materiais sem descarte duplicado',()=>{
  const g=disposable(),m={...disposable(),map:{...disposable(),isTexture:true}};
  GPU.disposeSubtree({children:[mesh(g,m),mesh(g,m)]});
  assert.equal(g.count,1);assert.equal(m.count,1);assert.equal(m.map.count,1);
});

test('entrada vazia é segura',()=>{
  assert.doesNotThrow(()=>GPU.disposeSubtree(null));
});
