'use strict';
/* Certifica Undercover no navegador após primeira mudança geográfica. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const base=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
const dir=path.join(process.cwd(),'qa-artifacts');fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
    '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1152,height:720}});
 page.setDefaultTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
    await page.addInitScript(()=>localStorage.setItem(
        'driver2-menu-preferences-v1',JSON.stringify({
            models:false,scanlines:false,reducedMotion:true
        })));
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>window.DriverBoot&&window.THREE);
    assert(await page.evaluate(()=>window.DriverBoot.start('story')));
    await page.waitForFunction(()=>window.DriverGame?.city?.ready &&
        window.DriverBoot.sessionReady && window.DriverGame.playerCar);
    const r=await page.evaluate(()=>{
        const g=window.DriverGame,c=g.city;
        return {preset:g.currentCityKey,
            geography:!!c.chicagoPS1Coastline,
            lake:c.isWaterAt(400,-140),lastAvenue:c.isWaterAt(320,-140),
            pier:c.isWaterAt(379,-40),river:c.isWaterAt(160,50),
            bridge:c.isWaterAt(0,50),
            missions:c.missionStart?.type,
            buildings:c.buildingBoxes.length,
            player:{x:g.playerCar.x,z:g.playerCar.z},
            carOnDryLand:!c.isWaterAt(g.playerCar.x,g.playerCar.z),
            cityPlan:c.chicagoCityPlan&&{
                blocks:c.chicagoCityPlan.blocks.length,lots:c.chicagoCityPlan.lots,
                links:c.chicagoCityPlan.courtyardLinks?.length,
                districts:DriverChicagoNeighborhoods.DISTRICTS.length,
                pedestrians:g.pedManager.pedestrians.length,
                // R32 has exact collider boxes tagged adaptedR32 instead
                // of chicagoPlanLot. Both building classes must match their
                // *own* physical AABB, without accepting a nearby fake collider.
                exactCollision:c.districtBuildings.filter(b=>b.planned).every(b=>
                    c.buildingBoxes.some(a=>(a.chicagoPlanLot||
                        (b.adaptedR32&&a.adaptedR32))&&
                        Math.abs(a.minX-(b.x-b.width/2))<.001&&
                        Math.abs(a.maxX-(b.x+b.width/2))<.001&&
                        Math.abs(a.minZ-(b.z-b.depth/2))<.001&&
                        Math.abs(a.maxZ-(b.z+b.depth/2))<.001)),
                linksSafe:c.chicagoCityPlan.courtyardLinks?.every(l=>
                    DriverRoadGeometry.segmentDrivable(c,l.from.x,l.from.z,l.to.x,l.to.z,1.7)),
                lotCentersSolid:c.districtBuildings.filter(b=>b.planned).every(b=>
                    c.isPointBlocked(b.x,b.z,0,0)),
                airfield:!!c.chicagoAirfield,
                runwayDry:c.chicagoAirfield&&!c.isWaterAt(c.chicagoAirfield.x,c.chicagoAirfield.z)
            },
            lakeMesh:c.cityGroup.children.some(o=>o.name==='chicago-ps1-lake-michigan')};
    });
    assert(r.cityPlan,'Undercover sem plano integral');
    assert(r.cityPlan.blocks>35&&r.cityPlan.lots>80,JSON.stringify(r.cityPlan));
    assert.equal(r.cityPlan.districts,13);
    assert.equal(r.cityPlan.pedestrians,28);
    assert(r.cityPlan.exactCollision&&r.cityPlan.lotCentersSolid);
    assert(r.cityPlan.links>8&&r.cityPlan.linksSafe,JSON.stringify(r.cityPlan));
    assert(r.cityPlan.airfield&&r.cityPlan.runwayDry);
    const curveReplay=await page.evaluate(()=>{
        const g=window.DriverGame,c=g.city,plan=c.chicagoReferenceCurve;
        if(!plan)return {missing:true};
        g.isPaused=true;
        const effects={addSkidMark(){},spawnTireSmoke(){},spawnImpactSparks(){},
            spawnCarBreakaway(){},spawnWaterSplash(){},ejectHubcap(){}};
        const replay=reverse=>{
            const path=reverse?[...plan.points].reverse():plan.points;
            const first=path[0],next=path[1];
            const car=new DriverVehicle(g.scene,{name:'R15 PHYSICS',bodyStyle:'muscle',
                x:first.x,z:first.z,heading:Math.atan2(next.x-first.x,next.z-first.z),
                maxSpeed:24,accel:18,color:0xbb523c});
            const result={reverse,completed:false,wet:0,blocked:0,submerged:0,
                maxDamage:0,maxOffset:0,samples:[]};let index=1;
            const offset=()=>{
                let best=Infinity;
                for(let i=1;i<path.length;i++){
                    const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z;
                    const t=Math.max(0,Math.min(1,((car.x-a.x)*dx+(car.z-a.z)*dz)/(dx*dx+dz*dz||1)));
                    best=Math.min(best,Math.hypot(car.x-a.x-t*dx,car.z-a.z-t*dz));
                }
                return best;
            };
            try{
                for(let frame=0;frame<1200;frame++){
                    while(index<path.length-1&&Math.hypot(car.x-path[index].x,car.z-path[index].z)<4)index++;
                    const target=path[index],distance=Math.hypot(car.x-target.x,car.z-target.z);
                    if(index===path.length-1&&distance<3){result.completed=true;break;}
                    const desired=Math.atan2(target.x-car.x,target.z-car.z);
                    const angle=Math.atan2(Math.sin(desired-car.heading),Math.cos(desired-car.heading));
                    const limit=Math.abs(angle)>.3?6:8;
                    car.updatePhysics(.05,{up:car.speed<limit,down:car.speed>limit+.6,
                        left:angle<-.08,right:angle>.08,handbrake:false,sprint:false},c,effects,null,false);
                    if(c.isWaterAt(car.x,car.z))result.wet++;
                    if(c.isPointBlocked(car.x,car.z,1.55,car.y))result.blocked++;
                    if(car.isSubmerged)result.submerged++;
                    result.maxDamage=Math.max(result.maxDamage,car.damage);
                    result.maxOffset=Math.max(result.maxOffset,offset());
                    if(frame%40===0)result.samples.push({t:frame*.05,x:car.x,z:car.z,index,speed:car.speed});
                }
                result.end={x:car.x,z:car.z,index};return result;
            }finally{GPUResourceUtils.disposeSubtree(car.root);g.scene.remove(car.root);}
        };
        return {sourcePixels:plan.sourcePixels,carved:!c.sidewalkGrid.has('-280:-120'),
            tests:[replay(false),replay(true)]};
    });
    fs.writeFileSync(path.join(dir,'chicago-r15-source-curve-replay.json'),JSON.stringify(curveReplay,null,2));
    console.log('CHICAGO R15 SOURCE CURVE '+JSON.stringify(curveReplay));
    assert.equal(curveReplay.missing,undefined);
    assert(curveReplay.carved&&curveReplay.sourcePixels>50);
    for(const test of curveReplay.tests){
        assert(test.completed,JSON.stringify(test));
        assert.equal(test.wet,0);assert.equal(test.blocked,0);assert.equal(test.submerged,0);
        assert(test.maxDamage<15);assert(test.maxOffset<2.45,JSON.stringify(test));
    }
    const extensionReplay=await page.evaluate(()=>{
        const g=window.DriverGame,c=g.city,extension=c.chicagoReferenceExtension,previous=c.chicagoReferenceCurve;
        const plan=extension&&previous?{...extension,points:[...extension.points].reverse().concat(previous.points.slice(1))}:null;
        if(!plan)return {missing:true};
        g.isPaused=true;
        const effects={addSkidMark(){},spawnTireSmoke(){},spawnImpactSparks(){},
            spawnCarBreakaway(){},spawnWaterSplash(){},ejectHubcap(){}};
        const replay=reverse=>{
            const path=reverse?[...plan.points].reverse():plan.points;
            const first=path[0],next=path[1];
            const car=new DriverVehicle(g.scene,{name:'R16 PHYSICS',bodyStyle:'muscle',
                x:first.x,z:first.z,heading:Math.atan2(next.x-first.x,next.z-first.z),
                maxSpeed:24,accel:18,color:0xbb523c});
            const result={reverse,completed:false,wet:0,blocked:0,submerged:0,
                maxDamage:0,maxOffset:0,samples:[]};let index=1;
            const offset=()=>{
                let best=Infinity;
                for(let i=1;i<path.length;i++){
                    const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z;
                    const t=Math.max(0,Math.min(1,((car.x-a.x)*dx+(car.z-a.z)*dz)/(dx*dx+dz*dz||1)));
                    best=Math.min(best,Math.hypot(car.x-a.x-t*dx,car.z-a.z-t*dz));
                }
                return best;
            };
            try{
                for(let frame=0;frame<1200;frame++){
                    while(index<path.length-1&&Math.hypot(car.x-path[index].x,car.z-path[index].z)<4)index++;
                    const target=path[index],distance=Math.hypot(car.x-target.x,car.z-target.z);
                    if(index===path.length-1&&distance<3){result.completed=true;break;}
                    const desired=Math.atan2(target.x-car.x,target.z-car.z);
                    const angle=Math.atan2(Math.sin(desired-car.heading),Math.cos(desired-car.heading));
                    const limit=Math.abs(angle)>.3?6:8;
                    car.updatePhysics(.05,{up:car.speed<limit,down:car.speed>limit+.6,
                        left:angle<-.08,right:angle>.08,handbrake:false,sprint:false},c,effects,null,false);
                    if(c.isWaterAt(car.x,car.z))result.wet++;
                    if(c.isPointBlocked(car.x,car.z,1.55,car.y))result.blocked++;
                    if(car.isSubmerged)result.submerged++;
                    result.maxDamage=Math.max(result.maxDamage,car.damage);
                    result.maxOffset=Math.max(result.maxOffset,offset());
                    if(frame%40===0)result.samples.push({t:frame*.05,x:car.x,z:car.z,index,speed:car.speed});
                }
                result.end={x:car.x,z:car.z,index};return result;
            }finally{GPUResourceUtils.disposeSubtree(car.root);g.scene.remove(car.root);}
        };
        return {sourcePixels:plan.sourcePixels,carved:!c.sidewalkGrid.has('-280:-40'),
            tests:[replay(false),replay(true)]};
    });
    fs.writeFileSync(path.join(dir,'chicago-r16-source-curve-replay.json'),JSON.stringify(extensionReplay,null,2));
    console.log('CHICAGO R16 SOURCE CURVE '+JSON.stringify(extensionReplay));
    assert.equal(extensionReplay.missing,undefined);
    assert(extensionReplay.carved&&extensionReplay.sourcePixels>50);
    for(const test of extensionReplay.tests){
        assert(test.completed,JSON.stringify(test));
        assert.equal(test.wet,0);assert.equal(test.blocked,0);assert.equal(test.submerged,0);
        assert(test.maxDamage<15);assert(test.maxOffset<2.45,JSON.stringify(test));
    }
    const loopReplay=await page.evaluate(()=>{
        const g=window.DriverGame,c=g.city,extension=c.chicagoReferenceLoop,previous=c.chicagoReferenceExtension;
        const plan=extension&&previous?{...extension,points:extension.points.concat([...previous.points].reverse().slice(1))}:null;
        if(!plan)return {missing:true};
        g.isPaused=true;
        const effects={addSkidMark(){},spawnTireSmoke(){},spawnImpactSparks(){},
            spawnCarBreakaway(){},spawnWaterSplash(){},ejectHubcap(){}};
        const replay=reverse=>{
            const path=reverse?[...plan.points].reverse():plan.points;
            const first=path[0],next=path[1];
            const car=new DriverVehicle(g.scene,{name:'R17 PHYSICS',bodyStyle:'muscle',
                x:first.x,z:first.z,heading:Math.atan2(next.x-first.x,next.z-first.z),
                maxSpeed:24,accel:18,color:0xbb523c});
            const result={reverse,completed:false,wet:0,blocked:0,submerged:0,
                maxDamage:0,maxOffset:0,samples:[]};let index=1;
            const offset=()=>{
                let best=Infinity;
                for(let i=1;i<path.length;i++){
                    const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z;
                    const t=Math.max(0,Math.min(1,((car.x-a.x)*dx+(car.z-a.z)*dz)/(dx*dx+dz*dz||1)));
                    best=Math.min(best,Math.hypot(car.x-a.x-t*dx,car.z-a.z-t*dz));
                }
                return best;
            };
            try{
                for(let frame=0;frame<1200;frame++){
                    while(index<path.length-1&&Math.hypot(car.x-path[index].x,car.z-path[index].z)<4)index++;
                    const target=path[index],distance=Math.hypot(car.x-target.x,car.z-target.z);
                    if(index===path.length-1&&distance<3){result.completed=true;break;}
                    const desired=Math.atan2(target.x-car.x,target.z-car.z);
                    const angle=Math.atan2(Math.sin(desired-car.heading),Math.cos(desired-car.heading));
                    const limit=Math.abs(angle)>.3?6:8;
                    car.updatePhysics(.05,{up:car.speed<limit,down:car.speed>limit+.6,
                        left:angle<-.08,right:angle>.08,handbrake:false,sprint:false},c,effects,null,false);
                    if(c.isWaterAt(car.x,car.z))result.wet++;
                    if(c.isPointBlocked(car.x,car.z,1.55,car.y))result.blocked++;
                    if(car.isSubmerged)result.submerged++;
                    result.maxDamage=Math.max(result.maxDamage,car.damage);
                    result.maxOffset=Math.max(result.maxOffset,offset());
                    if(frame%40===0)result.samples.push({t:frame*.05,x:car.x,z:car.z,index,speed:car.speed});
                }
                result.end={x:car.x,z:car.z,index};return result;
            }finally{GPUResourceUtils.disposeSubtree(car.root);g.scene.remove(car.root);}
        };
        return {sourcePixels:plan.sourcePixels,carved:c.cityGroup.children.some(o=>o.name==='chicago-r17-source-west-loop'),
            tests:[replay(false),replay(true)]};
    });
    fs.writeFileSync(path.join(dir,'chicago-r17-source-curve-replay.json'),JSON.stringify(loopReplay,null,2));
    console.log('CHICAGO R17 SOURCE CURVE '+JSON.stringify(loopReplay));
    assert.equal(loopReplay.missing,undefined);
    assert(loopReplay.carved&&loopReplay.sourcePixels>50);
    for(const test of loopReplay.tests){
        assert(test.completed,JSON.stringify(test));
        assert.equal(test.wet,0);assert.equal(test.blocked,0);assert.equal(test.submerged,0);
        assert(test.maxDamage<15);assert(test.maxOffset<2.45,JSON.stringify(test));
    }
    const bridgeReplay=await page.evaluate(()=>{
        const g=window.DriverGame,c=g.city,plan=c.chicagoReferenceBridge;
        if(!plan)return {missing:true};
        g.isPaused=true;
        const effects={addSkidMark(){},spawnTireSmoke(){},spawnImpactSparks(){},
            spawnCarBreakaway(){},spawnWaterSplash(){},ejectHubcap(){}};
        const replay=reverse=>{
            const path=reverse?[...plan.points].reverse():plan.points;
            const first=path[0],next=path[1];
            const car=new DriverVehicle(g.scene,{name:'R18 PHYSICS',bodyStyle:'muscle',
                x:first.x,z:first.z,heading:Math.atan2(next.x-first.x,next.z-first.z),
                maxSpeed:24,accel:18,color:0xbb523c});
            const result={reverse,completed:false,wet:0,blocked:0,submerged:0,
                maxDamage:0,maxOffset:0,samples:[]};let index=1;
            const offset=()=>{
                let best=Infinity;
                for(let i=1;i<path.length;i++){
                    const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z;
                    const t=Math.max(0,Math.min(1,((car.x-a.x)*dx+(car.z-a.z)*dz)/(dx*dx+dz*dz||1)));
                    best=Math.min(best,Math.hypot(car.x-a.x-t*dx,car.z-a.z-t*dz));
                }
                return best;
            };
            try{
                for(let frame=0;frame<1200;frame++){
                    while(index<path.length-1&&Math.hypot(car.x-path[index].x,car.z-path[index].z)<4)index++;
                    const target=path[index],distance=Math.hypot(car.x-target.x,car.z-target.z);
                    if(index===path.length-1&&distance<3){result.completed=true;break;}
                    const desired=Math.atan2(target.x-car.x,target.z-car.z);
                    const angle=Math.atan2(Math.sin(desired-car.heading),Math.cos(desired-car.heading));
                    const limit=Math.abs(angle)>.3?6:8;
                    car.updatePhysics(.05,{up:car.speed<limit,down:car.speed>limit+.6,
                        left:angle<-.08,right:angle>.08,handbrake:false,sprint:false},c,effects,null,false);
                    if(c.isWaterAt(car.x,car.z))result.wet++;
                    if(c.isPointBlocked(car.x,car.z,1.55,car.y))result.blocked++;
                    if(car.isSubmerged)result.submerged++;
                    result.maxDamage=Math.max(result.maxDamage,car.damage);
                    result.maxOffset=Math.max(result.maxOffset,offset());
                    if(frame%40===0)result.samples.push({t:frame*.05,x:car.x,z:car.z,index,speed:car.speed});
                }
                result.end={x:car.x,z:car.z,index};return result;
            }finally{GPUResourceUtils.disposeSubtree(car.root);g.scene.remove(car.root);}
        };
        return {sourcePixels:plan.sourcePixels,carved:c.cityGroup.children.some(o=>o.name==='chicago-r18-bridge-deck'),
            tests:[replay(false),replay(true)]};
    });
    fs.writeFileSync(path.join(dir,'chicago-r18-source-curve-replay.json'),JSON.stringify(bridgeReplay,null,2));
    console.log('CHICAGO R18 SOURCE CURVE '+JSON.stringify(bridgeReplay));
    assert.equal(bridgeReplay.missing,undefined);
    assert(bridgeReplay.carved&&bridgeReplay.sourcePixels>50);
    for(const test of bridgeReplay.tests){
        assert(test.completed,JSON.stringify(test));
        assert.equal(test.wet,0);assert.equal(test.blocked,0);assert.equal(test.submerged,0);
        assert(test.maxDamage<15);assert(test.maxOffset<2.45,JSON.stringify(test));
    }
    const northReplay=await page.evaluate(()=>{
        const g=window.DriverGame,c=g.city,network=c.chicagoReferenceNorthNetwork;
        if(!network)return {missing:true};
        const segments=network.segments;
        const plans=Object.fromEntries(['branch','continuation'].map(key=>[key,{...segments[key],points:segments.stem.points.concat(segments[key].points.slice(1))}]));
        g.isPaused=true;
        const surfaceMeshes=[c.chicagoReferenceBridge.mesh,...Object.values(segments).map(p=>p.mesh),network.junction.mesh,
            c.cityGroup.children.find(o=>o.name==='driver2-road-asphalt-chicago')];
        const triangles=[];
        for(const mesh of surfaceMeshes){
            mesh.updateWorldMatrix(true,false);
            const position=mesh.geometry.attributes.position,index=mesh.geometry.index;
            const count=index?index.count:position.count;
            for(let instance=0;instance<(mesh.isInstancedMesh?mesh.count:1);instance++){
                const matrix=new THREE.Matrix4();
                if(mesh.isInstancedMesh){mesh.getMatrixAt(instance,matrix);matrix.premultiply(mesh.matrixWorld);}
                else matrix.copy(mesh.matrixWorld);
                for(let i=0;i<count;i+=3){
                    const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(position,index?index.getX(i+k):i+k).applyMatrix4(matrix));
                    const [a,b,c]=points;
                    if(Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))<1e-8)continue;
                    const box={points,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};
                    if(box.maxX< -345||box.minX> -250||box.maxZ<175||box.minZ>335)continue;
                    triangles.push(box);
                }
            }
        }
        const paved=(x,z)=>triangles.some(t=>{
            if(x<t.minX-1e-5||x>t.maxX+1e-5||z<t.minZ-1e-5||z>t.maxZ+1e-5)return false;
            const signs=t.points.map((a,i)=>{const b=t.points[(i+1)%3];return (b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x);});
            return signs.every(v=>v>=-1e-5)||signs.every(v=>v<=1e-5);
        });
        const effects={addSkidMark(){},spawnTireSmoke(){},spawnImpactSparks(){},
            spawnCarBreakaway(){},spawnWaterSplash(){},ejectHubcap(){}};
        const replay=(key,reverse)=>{
            const plan=plans[key];
            const path=reverse?[...plan.points].reverse():plan.points;
            const first=path[0],next=path[1];
            const car=new DriverVehicle(g.scene,{name:'R19 PHYSICS',bodyStyle:'muscle',
                x:first.x,z:first.z,heading:Math.atan2(next.x-first.x,next.z-first.z),
                maxSpeed:24,accel:18,color:0xbb523c});
            const result={key,reverse,completed:false,wet:0,blocked:0,submerged:0,
                maxDamage:0,maxOffset:0,roadFootprintMisses:0,samples:[]};let index=1;
            const offset=()=>{
                let best=Infinity;
                for(let i=1;i<path.length;i++){
                    const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z;
                    const t=Math.max(0,Math.min(1,((car.x-a.x)*dx+(car.z-a.z)*dz)/(dx*dx+dz*dz||1)));
                    best=Math.min(best,Math.hypot(car.x-a.x-t*dx,car.z-a.z-t*dz));
                }
                return best;
            };
            try{
                for(let frame=0;frame<1200;frame++){
                    while(index<path.length-1&&Math.hypot(car.x-path[index].x,car.z-path[index].z)<4)index++;
                    const target=path[index],distance=Math.hypot(car.x-target.x,car.z-target.z);
                    if(index===path.length-1&&distance<3){result.completed=true;break;}
                    const desired=Math.atan2(target.x-car.x,target.z-car.z);
                    const angle=Math.atan2(Math.sin(desired-car.heading),Math.cos(desired-car.heading));
                    const limit=Math.abs(angle)>.3?6:8;
                    car.updatePhysics(.05,{up:car.speed<limit,down:car.speed>limit+.6,
                        left:angle<-.08,right:angle>.08,handbrake:false,sprint:false},c,effects,null,false);
                    if(c.isWaterAt(car.x,car.z))result.wet++;
                    if(c.isPointBlocked(car.x,car.z,1.55,car.y))result.blocked++;
                    if(car.isSubmerged)result.submerged++;
                    result.maxDamage=Math.max(result.maxDamage,car.damage);
                    const deviation=offset();
                    if(deviation>result.maxOffset){result.maxOffset=deviation;result.maxOffsetAt={x:car.x,z:car.z};}
                    if(!paved(car.x,car.z)||Array.from({length:16},(_,i)=>i*Math.PI/8).some(angle=>!paved(car.x+Math.cos(angle)*1.55,car.z+Math.sin(angle)*1.55)))result.roadFootprintMisses++;
                    if(frame%40===0)result.samples.push({t:frame*.05,x:car.x,z:car.z,index,speed:car.speed});
                }
                result.end={x:car.x,z:car.z,index};return result;
            }finally{GPUResourceUtils.disposeSubtree(car.root);g.scene.remove(car.root);}
        };
        return {sourcePixels:Object.values(segments).reduce((n,p)=>n+p.sourcePixels,0),
            carved:!c.sidewalkGrid.has('-280:280'),stadium:!!c.chicagoStadium,
            tests:['branch','continuation'].flatMap(key=>[replay(key,false),replay(key,true)])};
    });
    fs.writeFileSync(path.join(dir,'chicago-r19-source-curve-replay.json'),JSON.stringify(northReplay,null,2));
    console.log('CHICAGO R19 SOURCE CURVE '+JSON.stringify(northReplay));
    assert.equal(northReplay.missing,undefined);
    assert(northReplay.carved&&northReplay.sourcePixels>200);assert(northReplay.stadium);
    for(const test of northReplay.tests){
        assert(test.completed,JSON.stringify(test));
        assert.equal(test.wet,0);assert.equal(test.blocked,0);assert.equal(test.submerged,0);
        assert(test.maxDamage<15);assert.equal(test.roadFootprintMisses,0,JSON.stringify(test));
    }
    const arterialReplay=await page.evaluate(()=>{
        const g=window.DriverGame,c=g.city,plan=c.chicagoReferenceArterial;
        if(!plan)return {missing:true};
        g.isPaused=true;
        const effects={addSkidMark(){},spawnTireSmoke(){},spawnImpactSparks(){},
            spawnCarBreakaway(){},spawnWaterSplash(){},ejectHubcap(){}};
        const replay=reverse=>{
            const path=reverse?[...plan.points].reverse():plan.points;
            const first=path[0],next=path[1];
            const car=new DriverVehicle(g.scene,{name:'R20 PHYSICS',bodyStyle:'muscle',
                x:first.x,z:first.z,heading:Math.atan2(next.x-first.x,next.z-first.z),
                maxSpeed:24,accel:18,color:0xbb523c});
            const result={reverse,completed:false,wet:0,blocked:0,submerged:0,
                maxDamage:0,maxOffset:0,samples:[]};let index=1;
            const offset=()=>{
                let best=Infinity;
                for(let i=1;i<path.length;i++){
                    const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z;
                    const t=Math.max(0,Math.min(1,((car.x-a.x)*dx+(car.z-a.z)*dz)/(dx*dx+dz*dz||1)));
                    best=Math.min(best,Math.hypot(car.x-a.x-t*dx,car.z-a.z-t*dz));
                }
                return best;
            };
            try{
                for(let frame=0;frame<1800;frame++){
                    while(index<path.length-1&&Math.hypot(car.x-path[index].x,car.z-path[index].z)<4)index++;
                    const target=path[index],distance=Math.hypot(car.x-target.x,car.z-target.z);
                    if(index===path.length-1&&distance<3){result.completed=true;break;}
                    const desired=Math.atan2(target.x-car.x,target.z-car.z);
                    const angle=Math.atan2(Math.sin(desired-car.heading),Math.cos(desired-car.heading));
                    const limit=Math.abs(angle)>.3?6:8;
                    car.updatePhysics(.05,{up:car.speed<limit,down:car.speed>limit+.6,
                        left:angle<-.08,right:angle>.08,handbrake:false,sprint:false},c,effects,null,false);
                    if(c.isWaterAt(car.x,car.z))result.wet++;
                    if(c.isPointBlocked(car.x,car.z,1.55,car.y))result.blocked++;
                    if(car.isSubmerged)result.submerged++;
                    result.maxDamage=Math.max(result.maxDamage,car.damage);
                    result.maxOffset=Math.max(result.maxOffset,offset());
                    if(frame%40===0)result.samples.push({t:frame*.05,x:car.x,z:car.z,index,speed:car.speed});
                }
                result.end={x:car.x,z:car.z,index};return result;
            }finally{GPUResourceUtils.disposeSubtree(car.root);g.scene.remove(car.root);}
        };
        return {sourcePixels:plan.sourcePixels,carved:c.cityGroup.children.some(o=>o.name==='chicago-r20-west-arterial'),
            bounds:c.worldBounds,ground:!!c.chicagoSourceGround,
            lakeExtent:(()=>{const geo=c.chicagoPS1Coastline.mesh.geometry;geo.computeBoundingBox();return {minZ:geo.boundingBox.min.z,maxZ:geo.boundingBox.max.z};})(),
            tests:[replay(false),replay(true)]};
    });
    fs.writeFileSync(path.join(dir,'chicago-r20-source-curve-replay.json'),JSON.stringify(arterialReplay,null,2));
    console.log('CHICAGO R20 SOURCE CURVE '+JSON.stringify(arterialReplay));
    assert.equal(arterialReplay.missing,undefined);
    assert(arterialReplay.carved&&arterialReplay.sourcePixels>300);
    assert(arterialReplay.ground&&arterialReplay.bounds.maxZ>1300);
    assert(arterialReplay.lakeExtent.minZ<=arterialReplay.bounds.minZ&&arterialReplay.lakeExtent.maxZ>=arterialReplay.bounds.maxZ);
    for(const test of arterialReplay.tests){
        assert(test.completed,JSON.stringify(test));
        assert.equal(test.wet,0);assert.equal(test.blocked,0);assert.equal(test.submerged,0);
        assert(test.maxDamage<15);assert(test.maxOffset<2.45,JSON.stringify(test));
    }
    assert.equal(r.preset,'chicago');assert(r.geography&&r.lakeMesh);
    assert(r.lake,'Lago não está posicionado a leste de Chicago');
    assert.equal(r.lastAvenue,false,'Lago submergiu a última avenida');
    assert.equal(r.pier,false,'Lago bloqueou o Navy Pier');
    assert.equal(r.river,true,'Canal central foi removido');
    assert.equal(r.bridge,false,'Ponte central está submersa');
    assert.equal(r.missions,'story_tipoff','Undercover perdeu marcador');
    assert(r.buildings>30,'Prédios e colisores procedurais desapareceram');
    assert.equal(r.carOnDryLand,true);
    assert.equal(errors.length,0,errors.join('\n'));
    await page.evaluate(()=>{
        const g=window.DriverGame;g.isPaused=true;
        g.camera.position.set(455,115,-120);
        g.camera.lookAt(325,0,-120);
        g.camera.updateProjectionMatrix();g.renderer.render(g.scene,g.camera);
    });
    await page.screenshot({path:path.join(dir,'chicago-ps1-undercover-lake-r1.png')});
    await page.evaluate(()=>{
        const g=window.DriverGame;g.camera.position.set(-280,100,-155);
        g.camera.lookAt(-280,0,-120);g.camera.updateProjectionMatrix();g.renderer.render(g.scene,g.camera);
    });
    await page.screenshot({path:path.join(dir,'chicago-r15-source-curve.png')});
    await page.evaluate(()=>{
        const g=window.DriverGame;g.camera.position.set(-320,155,-100);
        g.camera.lookAt(-320,0,-30);g.camera.updateProjectionMatrix();g.renderer.render(g.scene,g.camera);
    });
    await page.screenshot({path:path.join(dir,'chicago-r17-source-loop.png')});
    await page.evaluate(()=>{
        const g=window.DriverGame;g.camera.position.set(-290,120,-5);
        g.camera.lookAt(-315,0,50);g.camera.updateProjectionMatrix();g.renderer.render(g.scene,g.camera);
    });
    await page.screenshot({path:path.join(dir,'chicago-r18-source-bridge.png')});
    await page.evaluate(()=>{
        const g=window.DriverGame;g.camera.position.set(-285,165,200);
        g.camera.lookAt(-295,0,275);g.camera.updateProjectionMatrix();g.renderer.render(g.scene,g.camera);
    });
    await page.screenshot({path:path.join(dir,'chicago-r19-north-network.png')});
    await page.evaluate(()=>{
        const g=window.DriverGame;g.camera.position.set(-360,205,375);
        g.camera.lookAt(-375,0,495);g.camera.updateProjectionMatrix();g.renderer.render(g.scene,g.camera);
    });
    await page.screenshot({path:path.join(dir,'chicago-r20-west-arterial.png')});
    await page.evaluate(()=>{
        const g=window.DriverGame;g.camera.position.set(30,620,-90);
        g.camera.lookAt(0,0,-20);g.camera.updateProjectionMatrix();
        g.renderer.render(g.scene,g.camera);
    });
    await page.screenshot({path:path.join(dir,'chicago-r14-whole-city-plan.png')});
    console.log('PASS CHICAGO PS1 UNDERCOVER R14',JSON.stringify(r));
 } finally{await page.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
