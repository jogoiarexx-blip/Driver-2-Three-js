'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const source=read('js/assets/uploaded-vehicles.js');
const Roster=vm.runInNewContext(source+';DriverUploadedVehicles');
test('todos os veículos enviados possuem GLB local válido',()=>{
 assert.equal(Object.keys(Roster.DEFINITIONS).length,5);
 for(const [id,definition] of Object.entries(Roster.DEFINITIONS)){
  const filename=decodeURIComponent(definition.url.slice(2));
  // O ônibus é opcional até o upload do arquivo GLB no repositório.
  // Os quatro arquivos publicados anteriormente seguem obrigatórios.
  if(id==='school-bus'&&!fs.existsSync(filename))continue;
  const bytes=fs.readFileSync(filename);
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert(gltf.meshes.length>0);
 }
});
test('ônibus escolar usa o GLB enviado na vaga do ônibus original',()=>{
 assert.equal(Roster.DEFINITIONS['school-bus'].url,'./assets/vehicles/onibus%20escolar.glb');
 assert.equal(Roster.DEFINITIONS['school-bus'].bodyStyle,'bus');
 const engine=read('js/engine/driver2-game-engine.js');
 const vehicle=read('js/vehicles/driver-vehicle.js');
 assert.match(engine,/name: 'ÔNIBUS ESCOLAR'.*uploadedModel:'school-bus'/);
 assert.match(engine,/uploadedModel: c\.uploadedModel \|\| null/);
 assert.match(vehicle,/const bus=this\.bodyStyle==='bus'/);
 assert.match(vehicle,/if\(bus\)modelScene\.scale\.set\(sx,sy,sz\)/);
 const physics=vm.runInNewContext(read('js/physics/vehicle-collisions.js')+';DriverVehicleCollisions');
 assert.equal(physics.dimensions({bodyStyle:'bus'}).length,8);
 assert.equal(physics.dimensions({bodyStyle:'bus'}).width,2.72);
 assert.equal(Roster.DEFINITIONS['school-bus'].z,undefined,'ônibus não cria uma segunda frota estacionada');
});
test('GLB binário do ônibus (executa automaticamente após upload)',{
 skip:!fs.existsSync('assets/vehicles/onibus escolar.glb')
},()=>{
 const data=fs.readFileSync('assets/vehicles/onibus escolar.glb');
 assert.equal(data.toString('ascii',0,4),'glTF');
 assert.equal(data.readUInt32LE(8),data.length);
 const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
 assert(gltf.meshes.length>0);assert(gltf.images.length>0);
});
test('carregamento é serial, único por modelo e preserva fallback quando falha',async()=>{
 const callbacks=[],requests=[];
 const Type=vm.runInNewContext(source+';DriverUploadedVehicles',{THREE:{GLTFLoader:class{load(url,ok,_progress,fail){requests.push(url);callbacks.push({ok,fail});}}}});
 const roster=new Type({},{}),root={traverse(){}};
 const first=roster.getTemplate('pickup-new'),same=roster.getTemplate('pickup-new'),second=roster.getTemplate('pickup-old');
 assert.equal(first,same);await Promise.resolve();assert.equal(requests.length,1);
 callbacks[0].ok({scene:root});assert.equal(await first,root);await Promise.resolve();assert.equal(requests.length,2);
 callbacks[1].fail();assert.equal(await second,null);assert.equal(roster.states['pickup-old'],'missing');
});
test('spawn não substitui frota anterior, evita água e colisões',()=>{
 const Type=vm.runInNewContext(source+';DriverUploadedVehicles',{DriverVehicle:class{constructor(_scene,config){Object.assign(this,config);}}});
 const engine={scene:{},vehicles:[{x:100,z:100}],city:{isWaterAt:()=>false,isPointBlocked:()=>false}};
 Type.spawn(engine);assert.equal(engine.vehicles.length,4);assert.equal(engine.vehicles[0].x,100);
 assert.equal(new Set(engine.vehicles.slice(1).map(v=>v.uploadedModel)).size,3);assert(engine.vehicles.slice(1).every(v=>v.missionParked));
 Type.spawn(engine);assert.equal(engine.vehicles.length,4);
 const wet={...engine,vehicles:[],city:{isWaterAt:()=>true}};Type.spawn(wet);assert.equal(wet.vehicles.length,0);
});
test('moto tem massa e colisão próprias e mantém identidade na garagem',()=>{
 const Collisions=vm.runInNewContext(read('js/physics/vehicle-collisions.js')+';DriverVehicleCollisions');
 const Physics=vm.runInNewContext(read('js/physics/arcade-dynamics.js')+';DriverArcadePhysics');
 const Garage=vm.runInNewContext(read('js/gameplay/tanner-garage.js')+';DriverTannerGarage');
 const bike={bodyStyle:'motorcycle',uploadedModel:'motorcycle',name:'MOTO',color:123};
 assert.equal(Collisions.dimensions(bike).width,1.05);assert.equal(Physics.mass(bike),280);
 const garage=new Garage({getItem(){return null},setItem(){}});assert(garage.store(bike));
 assert.equal(garage.take(0).uploadedModel,'motorcycle');
 for(const id of ['pickup-new','pickup-old','school-bus'])assert.equal(Garage.sanitize({...bike,bodyStyle:id==='school-bus'?'bus':'truck',uploadedModel:id}).uploadedModel,id);
 assert.equal(Garage.sanitize({...bike,uploadedModel:'arbitrary.glb'}).uploadedModel,null);
});
test('download tardio não sobrescreve importação manual nem veículo removido',async()=>{
 const vehicle={uploadedModel:'pickup-new',root:{parent:{}},applyCC0Model(){throw Error('must not replace personal model');}};
 const engine={vehicles:[vehicle]},roster=new Roster(engine,{enabled:true});
 let resolve;roster.getTemplate=()=>new Promise(r=>{resolve=r;});
 roster.decorate(vehicle);vehicle._userCustomModel=true;resolve({});await Promise.resolve();
 assert.equal(vehicle._userCustomModel,true);assert.equal(vehicle._uploadedCustomModel,undefined);
 vehicle._userCustomModel=false;roster.decorate(vehicle);engine.vehicles=[];resolve({});await Promise.resolve();
 assert.equal(vehicle._uploadedCustomModel,undefined);
});
test('barco em download não aparece em outra cidade após reset do mesmo CityBuilder',async()=>{
 const city={preset:{id:'chicago'},cityGroup:{parent:{}}},roster=new Roster({city},{enabled:true});
 let resolve;roster.getTemplate=()=>new Promise(r=>{resolve=r;});roster.attachBoat();
 city.preset={id:'havana'};resolve({});await Promise.resolve();assert.equal(roster.boat,null);
});
