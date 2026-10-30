'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const path='chicago/sector-inventory-r30.json';
test('inventário cobre cada setor original e conserva os limites transformados',()=>{
 assert(fs.existsSync(path),'inventário setorial R30 ausente');
 const d=JSON.parse(fs.readFileSync(path)),m=JSON.parse(fs.readFileSync('chicago/manifest.json'));
 const Curve=require('../js/world/chicago-ps1-reference-curve.js'),survey=JSON.parse(fs.readFileSync('chicago/reference-street-survey.json'));
 const byId=new Map(survey.tiles.map(x=>[x.id,x]));
 assert.equal(d.sectors.length,54);assert.deepEqual(d.sectors.map(x=>x.id).sort(),m.tiles.map(x=>x.id).sort());
 assert.equal(d.totalTriangles,m.triangles);assert.equal(d.sectors.reduce((s,x)=>s+x.triangles,0),m.triangles);
 for(const s of d.sectors){assert.equal(s.status,'evidence-only');assert.equal(s.certifiedRoads,false);assert.equal(s.worldCorners.length,4);assert(s.worldCorners.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));assert.equal(s.sourceHash,byId.get(s.id).sha256);const tile=m.tiles.find(x=>x.id===s.id);const p=Curve.fitPoint([tile.bounds.min[0],tile.bounds.min[2]]);assert(Math.abs(s.worldCorners[0].x-p.x)<1e-9);assert(Math.abs(s.worldCorners[0].z-p.z)<1e-9);}
 assert.equal(d.wholeMapBuilt,false);assert.equal(d.missionsMigrated,false);
});

test('rejeita levantamento de origem adulterado ou incompatível',()=>{
 const os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chicago-r30-'));
 try{fs.mkdirSync(path.join(temp,'chicago'));for(const f of ['manifest.json','reference-street-survey.json','reference-network.json','reference-recovery-r29.json'])fs.copyFileSync('chicago/'+f,path.join(temp,'chicago',f));
 fs.appendFileSync(path.join(temp,'chicago/reference-street-survey.json'),' ');
 const result=cp.spawnSync(process.execPath,[path.resolve('tools/chicago-r30-sector-inventory.cjs')],{cwd:temp,encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stderr,/proveniência/i);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
