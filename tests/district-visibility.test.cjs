/** Camera-safe instanced visibility, geometry isolation, no collider changes. */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
class Vector3 {constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}}
class Sphere {constructor(center,radius){this.center=center;this.radius=radius;}}
class Geometry {
  constructor(w,h,d){this.width=w;this.height=h;this.depth=d;}
  dispose(){this.disposed=true;}
}
const THREE={Vector3,Sphere,BoxGeometry:Geometry};
const context=vm.createContext({THREE,Math,Number});
vm.runInContext(read('js/world/district-visibility.js'),context);
const Visibility=vm.runInContext('DriverDistrictVisibility',context);
const City=read('js/world/city-builder.js'),Urban=read('js/world/urban-districts.js');
const LOD=vm.runInNewContext(read('js/world/district-lod.js')+
    '\nDriverDistrictLOD',{Math,Number});

test('aggregate sphere encloses every tall building and rooftop balcony',()=>{
  const buildings=[
    {x:40,z:-120,height:67},
    {x:120,z:-120,height:92},
    {x:40,z:-40,height:75},
    {x:120,z:-40,height:112}
  ];
  const g=Visibility.makeGeometry(buildings);
  const b=g.boundingSphere;
  assert(b && b.radius>0);
  for(const o of buildings)for(const dx of [-30,30]){
    for(const dz of [-30,30]){
      for(const y of [-2,o.height+15]){
        const distance=Math.hypot(o.x+dx-b.center.x,
           y-b.center.y,o.z+dz-b.center.z);
        assert(distance < b.radius,
           'vertex clipped from world bounding sphere');
      }
    }
  }
  assert(b.center.x>40 && b.center.x<120);
  assert(b.center.z<0);
});

test('different distant blocks receive different geometries and spheres',()=>{
  const west=Visibility.makeGeometry([{x:-280,z:-120,height:42}]);
  const east=Visibility.makeGeometry([{x:280,z:120,height:42}]);
  assert.notEqual(west,east,'geometry incorrectly shared between chunks');
  assert(west.boundingSphere.center.x<0);
  assert(east.boundingSphere.center.x>0);
  assert.notEqual(west.boundingSphere.center.z,east.boundingSphere.center.z);
});

test('near and far switch with hysteresis, without flicker or rebuilding',()=>{
  const manager=new LOD({nearRadius:165,farRadius:230,chunkHalfSize:80});
  const geometry=Visibility.makeGeometry([{x:40,z:-40,height:63}]);
  const far={visible:true,geometry};
  let builds=0;
  manager.register({id:'a',x:40,z:-40,far,
    buildNear:()=>{builds++;return {visible:false,geometry};}});
  const a=manager.update({x:40,z:-40});
  assert.equal(a.near,1);
  assert.equal(far.visible,false);
  const stable=manager.update({x:270,z:-40});
  assert.equal(stable.near,1,'hysteresis turned off too soon');
  const moved=manager.update({x:430,z:-40});
  assert.equal(moved.far,1);
  assert.equal(far.visible,true);
  const returned=manager.update({x:40,z:-40});
  assert.equal(returned.near,1);
  assert.equal(builds,1,'near chunk rebuilt on each return');
});

test('batch culling enabled only with safe bounds',()=>{
  const meshes=[{geometry:new Geometry(1,1,1),frustumCulled:false},
                {geometry:new Geometry(1,1,1),frustumCulled:false}];
  for(const mesh of meshes){
    assert.equal(Visibility.cull(mesh,
      [{x:40,z:-120,height:100},{x:120,z:-120,height:35}]),true);
    assert.equal(mesh.frustumCulled,true);
    assert(mesh.geometry.boundingSphere.radius>95);
  }
  assert.equal(Visibility.cull({geometry:new Geometry(1,1,1)},
      [{x:Infinity,z:0,height:10}]),false);
});

test('geometry cleanup and optional standalone modules remain supported',()=>{
  const a=Visibility.makeGeometry([{x:0,z:0,height:20}]);
  a.dispose();assert(a.disposed);
  assert.match(City,/chunk\.geometry=\(typeof DriverDistrictVisibility/);
  assert.match(City,/far\.frustumCulled=!!chunk\.geometry\.boundingSphere/);
  assert.match(City,/chunk\.geometry\|\|this\.districtBoxGeometry/);
  assert.match(Urban,/DriverDistrictVisibility\.cull\(mesh,buildings,18\)/);
  assert.match(read('index.html'),
       /src="\.\/js\/world\/district-visibility\.js"/);
  assert(read('index.html').indexOf('district-visibility.js')<
     read('index.html').indexOf('city-builder.js'));
  new Function(City);
  new Function(Urban);
});
