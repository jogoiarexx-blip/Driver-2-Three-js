#!/usr/bin/env node
'use strict';
/**
 * Auditoria geográfica automática (somente leitura) de Chicago.
 * Não confundir marcadores com setores ou grafo da grade com ruas do PS1.
 * Uso: node tools/chicago-geo-audit.cjs [--out caminho] [--obj arquivo.obj]
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const source=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const evaluate=(p,expression,vars={})=>vm.runInNewContext(
    source(p)+'\n'+expression,{Math,Number,Map,Set,...vars},{filename:p});
const SECTORS=['wrigleyville','lincoln-park','wicker-park',
    'ukrainian-village','goose-island','gold-coast','navy-pier',
    'downtown','greektown','grant-park','prairie-ave',
    'meigs-field','chinatown'];
function inspectOBJ(file){
    if(!file||!fs.existsSync(file))return null;
    let vertexCount=0,faceCount=0;
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
        if(line.startsWith('f '))faceCount++;
        if(!line.startsWith('v '))continue;
        const nums=line.trim().split(/\s+/).slice(1,4).map(Number);
        if(nums.length!==3||!nums.every(Number.isFinite))continue;
        vertexCount++;
        for(let i=0;i<3;i++){
            min[i]=Math.min(min[i],nums[i]);
            max[i]=Math.max(max[i],nums[i]);
        }
    }
    return {vertexCount,faceCount,bounds:vertexCount?{min,max}:null,
        registeredToClone:false,geometricFidelityPercent:null,
        caveat:'A geometria OBJ não foi calibrada por pontos homologados.'};
}
function audit({objPath}={}){
    const Road=evaluate('js/world/road-geometry.js','DriverRoadGeometry');
    const Bridge=evaluate('js/world/chicago-east-bridge.js',
        'DriverChicagoEastBridge');
    const Coast=evaluate('js/world/chicago-ps1-coastline.js','DriverChicagoPS1Coastline');
    const River=evaluate('js/world/chicago-ps1-river-branches.js','DriverChicagoPS1RiverBranches');
    const North=evaluate('js/world/chicago-goose-island-north-yard.js','DriverChicagoGooseIslandNorthYard');
    const Plan=evaluate('js/world/chicago-city-plan.js','DriverChicagoCityPlan');
    const City=evaluate('js/world/city-builder.js','CityBuilder',{
        DriverChicagoEastBridge:Bridge,DriverChicagoPS1Coastline:Coast,
        DriverChicagoPS1RiverBranches:River,DriverChicagoGooseIslandNorthYard:North});
    const Neighborhood=evaluate('js/world/chicago-neighborhoods.js',
        'DriverChicagoNeighborhoods',{DriverChicagoCityPlan:Plan});
    const raw=source('js/world/city-builder.js');
    const ext=raw.match(/this\.roadExtent\s*=\s*(\d+)\s*;\s*this\.worldLimit\s*=\s*(\d+)/);
    if(!ext||!/for\s*\(let p=-320;p<=320;p\+=80\)/.test(raw)||
       !/new THREE\.PlaneGeometry\(840,\s*32\)/.test(raw))
        throw Error('A geometria mudou: atualizar e rever as premissas da auditoria.');
    const roadExtent=Number(ext[1]),worldLimit=Number(ext[2]);
    const city={roadExtent,preset:{id:'chicago'},bridgeAngle:0,
        isPointBlocked:()=>false};
    city.isWaterAt=(x,z)=>City.prototype.isWaterAt.call(city,x,z);
    const graph=Road.auditNetwork(city);
    const districts=Array.from(Neighborhood.DISTRICTS,d=>({
        id:d.id,name:d.name,x:d.x,z:d.z,
        inCurrentDrivingLane:Road.inDrivingLane(d.x,d.z,1.55),
        insideRoadGrid:Math.abs(d.x)<=roadExtent&&Math.abs(d.z)<=roadExtent
    }));
    const cells=[];
    for(let bx=-320;bx<=320;bx+=80)
        for(let bz=-320;bz<=320;bz+=80){
            if(Math.abs(bz-50)<35||(bx===0&&bz===0))continue;
            const x=bx+40,z=bz-40;
            if(Math.abs(z-50)<28)continue;
            cells.push({x,z});
        }
    return {
        city:'chicago',reference:'Driver 2 PS1',referenceGeometryRegistered:false,
        code:{
            step:Road.STEP,roadHalf:Road.ROAD_HALF,roadExtent,worldLimit,
            theoreticalGridNodes:graph.nodes,proceduralCells:cells.length,
            river:{kind:'central-canal-with-north-south-branches',centerZ:50,visualWidth:32,
                eastWaterSample:!!city.isWaterAt(385,-240),
                canalWaterSample:!!city.isWaterAt(160,50),
                eastBridgeWaterSample:!!city.isWaterAt(240,50)}
        },
        neighborhoods:{
            referenceCount:SECTORS.length,declaredMarkers:districts,
            missingMarkers:SECTORS.filter(s=>!districts.some(d=>d.id===s)),
            markerCoveragePercent:Math.round(districts.length/SECTORS.length*1000)/10
        },
        topology:{
            waterOnlyNoBuildings:graph,
            actualVehicleNavigationValidated:false,
            caveat:'Grafo teórico: ignora AABB, desníveis, portões e carro.'
        },
        navyPier:{deckMinX:327,deckMaxX:411,visualOnly:true,
            verifiedRoadConnection:false},
        meigs:{markerX:334,markerZ:-290,runwayVerified:false},
        wrigley:{stadiumX:-280,stadiumZ:200,
            ticketSwitchX:-250,ticketSwitchZ:223,
            gateX:-280,gateZ:219,ps1SecretRouteVerified:false},
        referenceOBJ:inspectOBJ(objPath),
        metrics:{territorialCoveragePercent:null,geometricFidelityPercent:null,
            coastIoU:null,roadRecall:null,
            reason:'Sem geometria PS1 alinhada não é lícito declarar cobertura.'}
    };
}
function main(args=process.argv.slice(2)){
    const flag=f=>{const i=args.indexOf(f);return i<0?null:args[i+1]};
    const out=path.resolve(flag('--out')||'qa-artifacts/chicago-geographic');
    const report=audit({objPath:flag('--obj')});
    fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(path.join(out,'diagnostico.json'),
        JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({
        audit:'CHICAGO_CODE_BASELINE',out,
        nodes:report.code.theoreticalGridNodes,
        cells:report.code.proceduralCells,
        missingMarkers:report.neighborhoods.missingMarkers,
        originalMapCoverage:report.metrics.territorialCoveragePercent
    }));
}
if(require.main===module)main();
module.exports={audit,inspectOBJ,main};
