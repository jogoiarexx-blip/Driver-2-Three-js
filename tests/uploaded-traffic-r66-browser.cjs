'use strict';
/** R66: Chromium real, four city traffic spawns and arcade movement. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const DIR=path.resolve('qa-artifacts');
fs.mkdirSync(DIR,{recursive:true});
const base=process.env.DRIVER_QA_URL||'http://127.0.0.1:4173/';
const ids=['pickup-new','pickup-old','cargo-van','motorcycle'];
const cities=['chicago','havana','vegas','rio'];
const report={date:new Date().toISOString(),cities:[],pageErrors:[],status:'STARTED',
    note:'E3 scripted Chromium with actual city geometry and vehicle physics, not Android E5'};
(async()=>{
    const browser=await chromium.launch({headless:true,args:[
        '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
        '--ignore-gpu-blocklist','--enable-unsafe-swiftshader'
    ]});
    const context=await browser.newContext({viewport:{width:960,height:600}});
    const page=await context.newPage();page.setDefaultTimeout(120000);
    page.on('pageerror',error=>report.pageErrors.push(String(error)));
    try{
        await page.addInitScript(()=>{
            localStorage.setItem('driver2-menu-preferences-v1',
                JSON.stringify({models:false,scanlines:false,reducedMotion:true}));
        });
        await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
        await page.waitForFunction(()=>window.DriverBoot&&window.THREE,null,{timeout:60000});
        const started=await page.evaluate(()=>window.DriverBoot.start('ride'));
        assert.equal(started,true,'menu did not start the game');
        await page.waitForFunction(()=>window.DriverBoot?.sessionReady&&
            window.DriverGame?.city?.ready&&window.DriverGame?.vehicles?.length,
            null,{timeout:120000});
        for(const cityId of cities){
            if(cityId!=='chicago'){
                const accepted=await page.evaluate(id=>window.DriverGame.requestCityChange(id),cityId);
                assert.equal(accepted,true,'cannot change to '+cityId);
            }
            await page.waitForFunction(id=>{
                const g=window.DriverGame;
                return g?.currentCityKey===id&&g.city?.ready&&
                    g.vehicles?.filter(v=>v.uploadedTraffic).length===4;
            },cityId,{timeout:120000,polling:250});
            // Templates are local on GitHub Pages; the GLB should replace
            // temporary hidden geometry rather than silently stay missing.
            await page.waitForFunction(()=>{
                const g=window.DriverGame;
                return g?.vehicles?.filter(v=>v.uploadedTraffic).every(v=>
                    v._cc0ModelApplied || v._modelLoadFailed);
            },null,{timeout:180000,polling:500});
            const snapshot=await page.evaluate(()=>{
                const g=window.DriverGame;
                const cars=g.vehicles.filter(v=>v.uploadedTraffic);
                const before=cars.map(v=>({
                    model:v.uploadedModel,name:v.name,x:v.x,z:v.z,heading:v.heading,
                    loaded:!!v._cc0ModelApplied,failed:!!v._modelLoadFailed,
                    secret:!!v.isSecret,parked:!!v.missionParked,
                    water:!!g.city.isWaterAt(v.x,v.z),
                    blocked:!!g.city.isPointBlocked(v.x,v.z,1.1,0)
                }));
                const drives=[];
                for(const v of cars){
                    const x=v.x,z=v.z;
                    // Real driving AI and physics. Isolate other NPCs to
                    // avoid an unrelated red light/traffic jam hiding movement.
                    const savedGreen=g.city.isTrafficGreen;
                    g.city.isTrafficGreen=()=>true;
                    let drove=false,stuck=false;
                    try{
                        for(let i=0;i<48;i++){
                            const input=g.trafficAI.getInput(
                                v,1/60,[v],null,0);
                            drove=drove||!!input.up;
                            v.updatePhysics(1/60,input,g.city,g.effects,g.audio,false);
                        }
                    }catch(err){stuck=String(err);}
                    finally{g.city.isTrafficGreen=savedGreen;}
                    drives.push({model:v.uploadedModel,
                        distance:Math.hypot(v.x-x,v.z-z),
                        accelerated:drove,submerged:!!v.isSubmerged,
                        error:stuck||null});
                }
                return {city:g.currentCityKey,total:g.vehicles.length,
                    secretCount:g.vehicles.filter(v=>v.isSecret).length,
                    secretName:g.secretCar?.name,found:before,drives};
            });
            const names=snapshot.found.map(v=>v.model).sort();
            assert.deepEqual(names,ids.slice().sort(),'missing/duplicated model at '+cityId);
            assert.equal(snapshot.secretCount,1,'more than one secret at '+cityId);
            assert(snapshot.found.every(v=>v.loaded&&!v.failed&&!v.parked&&!v.secret),
                'GLB absent or vehicle parked at '+cityId+': '+JSON.stringify(snapshot.found));
            assert(snapshot.found.every(v=>!v.water&&!v.blocked),
                'unsafe traffic spawn at '+cityId+': '+JSON.stringify(snapshot.found));
            assert(snapshot.drives.every(v=>v.accelerated&&v.distance>.10&&
                !v.submerged&&!v.error),
                'AI/arcade movement failed at '+cityId+': '+JSON.stringify(snapshot.drives));
            report.cities.push(snapshot);
            console.log('R66_BROWSER_CITY',cityId,JSON.stringify(snapshot));
            if(cityId==='chicago'||cityId==='rio')
                await page.screenshot({
                    path:path.join(DIR,'r66-traffic-'+cityId+'.png'),timeout:120000
                });
        }
        assert.equal(report.pageErrors.length,0,'uncaught browser error');
        report.status='PASS';
    }catch(error){
        report.status='FAIL';report.error=String(error);
        throw error;
    }finally{
        fs.writeFileSync(path.join(DIR,'r66-uploaded-traffic.json'),
            JSON.stringify(report,null,2));
        await browser.close();
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
