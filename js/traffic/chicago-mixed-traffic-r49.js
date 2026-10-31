/**
 * Chicago R49 — civilians choosing between grid streets and R48 side roads.
 * No scripted/mission car is re-routed; cars without a safe route fall back
 * to the pre-existing traffic controller.
 */
class DriverChicagoMixedTrafficR49 {
    static GOALS=[
        {x:200,z:-120},{x:240,z:-160},{x:40,z:-40},
        {x:0,z:-80},{x:160,z:-240},{x:120,z:-120},
        {x:240,z:-40},{x:40,z:-160},
        // Northern R50 district and bridge-connected destinations.
        {x:40,z:200},{x:200,z:280},{x:120,z:200},
        {x:0,z:160},{x:240,z:320},{x:120,z:280},
        // R52 east bank and the existing Goose Island fixed bridge.
        {x:-120,z:200},{x:-40,z:280},{x:-120,z:240},
        {x:-160,z:240},{x:-200,z:240},
        // R53 west bank and the fixed west-channel bridge.
        {x:-280,z:-120},{x:-200,z:-80},{x:-160,z:-80},
        {x:-280,z:-40},{x:-320,z:-80}
    ];
    static isEligible(city,car){
        return city?.preset?.id==='chicago' &&
            !!car?.chicagoMixedTrafficR49 &&
            !car.isPolice&&!car.isMafia&&!car.isTarget&&!car.isSecret &&
            !car.scriptedDrive&&!car.missionParked &&
            !car.gooseIslandRoute&&!car.gooseIslandVisitor &&
            !car.gooseIslandNorthYard&&!car.gooseIslandSouthbound &&
            typeof DriverChicagoMixedNavigationR49!=='undefined';
    }
    static spawnSpecs(city,vehicles=[]){
        if(city?.preset?.id!=='chicago' ||
           !city.chicagoConnectorsR48?.ready ||
           typeof DriverChicagoMixedNavigationR49==='undefined')return [];
        const candidates=[
            {x:84,z:-124,heading:Math.PI/2,
                name:'SEDÃ R49 CORREDOR SUL',color:0x5d89a2},
            {x:164,z:-44,heading:Math.PI/2,
                name:'TÁXI R49 CONEXÃO LESTE',color:0xe1b955},
            {x:44,z:-84,heading:0,
                name:'COUPÉ R49 VIA TRANSVERSAL',color:0x9e6e63},
            {x:196,z:-60,heading:Math.PI,
                name:'SEDÃ R49 ENTRE BAIRROS',color:0x789177}
        ];
        if(city.chicagoConnectorsR50?.ready)candidates.push(
            {x:84,z:196,heading:Math.PI/2,
                name:'SEDÃ R50 RIO NORTE',color:0x537f91},
            {x:164,z:284,heading:-Math.PI/2,
                name:'TÁXI R50 BAIRRO NORTE',color:0xd6b14d},
            {x:44,z:236,heading:0,
                name:'COUPÉ R50 TRAVESSIA',color:0x9a726c},
            {x:196,z:260,heading:Math.PI,
                name:'SEDÃ R50 MARGEM LESTE',color:0x698b78}
        );
        if(city.chicagoGooseEastR52?.ready)candidates.push(
            {x:-84,z:196,heading:Math.PI/2,
                name:'SEDÃ GO OESTE R52',color:0x67869b},
            {x:-44,z:284,heading:-Math.PI/2,
                name:'TÁXI PONTE LESTE R52',color:0xd3b25a},
            {x:-116,z:236,heading:Math.PI,
                name:'COUPÉ TRAVESSIA R52',color:0x92756a},
            {x:-44,z:244,heading:-Math.PI/2,
                name:'SEDÃ CONEXÃO GO R52',color:0x778f80}
        );
        if(city.chicagoWestCanalR53?.ready)candidates.push(
            {x:-284,z:-124,heading:Math.PI/2,
                name:'SEDÃ R53 MARGEM OESTE',color:0x68899a},
            {x:-204,z:-44,heading:Math.PI,
                name:'TÁXI R53 CANAL OESTE',color:0xdcb65c},
            {x:-284,z:-84,heading:Math.PI/2,
                name:'COUPÉ R53 PONTE FIXA',color:0x9b776d},
            {x:-204,z:-84,heading:-Math.PI/2,
                name:'SEDÃ R53 INTERBAIRROS',color:0x78927e}
        );
        const result=[];
        for(const [index,c] of candidates.entries()){
            if(city.isWaterAt?.(c.x,c.z)||
               city.isPointBlocked?.(c.x,c.z,1.8,0))continue;
            if([...vehicles,...result].some(other=>
                Math.hypot(other.x-c.x,other.z-c.z)<18))continue;
            const goalIndex=index<4?
                (index*2+1)%8 : index<8?8+(index-4)%6:
                index<12?14+(index-8)%5:19+(index-12)%5;
            const goal=this.GOALS[goalIndex];
            if(!DriverChicagoMixedNavigationR49.plan(city,c,goal))continue;
            result.push({...c,goalIndex,
                maxSpeed:29,accel:20,bodyStyle:'sedan'});
        }
        return result;
    }
    static getInput(city,car,vehicles=[],dt=0,roadblocks=[]){
        if(!this.isEligible(city,car))return null;
        const state=car.chicagoMixedTrafficStateR49||{
            index:Number.isInteger(car.chicagoMixedTrafficGoalIndex)?
                car.chicagoMixedTrafficGoalIndex:0,
            holder:{},lastX:car.x,lastZ:car.z,
            stuck:0,noRoute:0,replans:0
        };
        car.chicagoMixedTrafficStateR49=state;
        const goals=Array.isArray(car.chicagoMixedTrafficGoalsR51) &&
            car.chicagoMixedTrafficGoalsR51.length>=3?
            car.chicagoMixedTrafficGoalsR51:this.GOALS;
        // Source districts are cyclic roads: traverse each waypoint in
        // forward order. Inner-city R49 cars keep their previous schedule.
        const nextGoalStep=goals===this.GOALS?3:1;
        let goal=goals[state.index%goals.length];
        if(Math.hypot(car.x-goal.x,car.z-goal.z)<14){
            state.index=(state.index+nextGoalStep)%goals.length;
            state.holder={};
            goal=goals[state.index];
        }
        let navigation=DriverChicagoMixedNavigationR49.follow(
            city,car,goal,state.holder,dt);
        if(navigation.blocked||!navigation.target){
            // An unreachable destination must not switch into a generic
            // grid route that can drive through the canal.
            state.noRoute=(state.noRoute||0)+Math.max(0,dt);
            if(state.noRoute>=2){
                state.index=(state.index+1)%goals.length;
                state.holder={};state.noRoute=0;
                state.replans=(state.replans||0)+1;
            }
            car.chicagoMixedTrafficStatusR49={
                destination:state.index,blocked:true,speedLimit:0,
                replans:state.replans||0,waiting:'route'
            };
            return {up:false,down:car.speed>.35,left:false,right:false,
                handbrake:Math.abs(car.speed)<2,sprint:false};
        }
        state.noRoute=0;
        const target=navigation.target;
        const heading=Math.atan2(target.x-car.x,target.z-car.z);
        const delta=Math.atan2(
            Math.sin(heading-car.heading),Math.cos(heading-car.heading));
        const bend=Math.abs(delta);
        let speedLimit=bend>.5?4.2:bend>.22?6.5:11.2;
        // R56: brake *before* narrow junctions, not after steering
        // into the canal rail or into a building corner.
        if(navigation.cornerAngle>.55 &&
           navigation.cornerDistance<28){
            speedLimit=Math.min(speedLimit,
                navigation.cornerDistance<14?3.6:6.0);
        }
        const fx=Math.sin(car.heading),fz=Math.cos(car.heading);
        const brakingGap=8+Math.max(0,car.speed)*.32;
        let waitingForTraffic=false,waitingForSignal=false,
            waitingForCrossing=false;
        for(const other of vehicles){
            if(other===car||other.missionParked||
               Math.abs((other.y||0)-(car.y||0))>3.2)continue;
            const dx=other.x-car.x,dz=other.z-car.z;
            const forward=dx*fx+dz*fz;
            const lateral=Math.abs(dx*fz-dz*fx);
            if(forward>0&&forward<22&&lateral<3.8){
                const aligned=!Number.isFinite(other.heading)||
                    Math.cos(other.heading-car.heading)>.45;
                // Do not mistake perpendicular crossing traffic for
                // a leading car unless its actual footprint is close.
                if(!aligned&&Math.hypot(dx,dz)>7)continue;
                const safeSpeed=forward<brakingGap?0:
                    Math.max(2,(forward-brakingGap)*.9);
                if(safeSpeed<speedLimit){
                    speedLimit=safeSpeed;waitingForTraffic=true;
                }
            }
        }
        for(const block of roadblocks||[]){
            if(block.destroyed||block.disabled||!Number.isFinite(block.x)||
               !Number.isFinite(block.z))continue;
            const dx=block.x-car.x,dz=block.z-car.z;
            const forward=dx*fx+dz*fz;
            const lateral=Math.abs(dx*fz-dz*fx);
            if(forward>0&&forward<28&&lateral<7){
                speedLimit=Math.min(speedLimit,forward<15?0:4);
                waitingForTraffic=true;
            }
        }
        // Signals only exist on the original grid. Off-grid R48 crossings
        // have marked zebra walks but no fictitious traffic lights.
        const nearGrid=Math.abs(target.x/80-Math.round(target.x/80))<.02 &&
            Math.abs(target.z/80-Math.round(target.z/80))<.02;
        const dist=Math.hypot(car.x-target.x,car.z-target.z);
        if(nearGrid&&dist>7&&dist<20&&
           typeof city.isTrafficGreen==='function'){
            const axis=Math.abs(target.x-car.x)>Math.abs(target.z-car.z)?'x':'z';
            if(!city.isTrafficGreen(axis)){
                speedLimit=0;waitingForSignal=true;
            }
        }
        if(typeof DriverPedestrianSidewalks!=='undefined'){
            const p=DriverPedestrianSidewalks.approachingCrossing(
                car,city.activePedestrianCrossings||[],23);
            if(p<20){
                speedLimit=Math.min(speedLimit,p<9?0:4);
                waitingForCrossing=true;
            }
        }
        const moving=Math.hypot(car.x-state.lastX,car.z-state.lastZ);
        state.lastX=car.x;state.lastZ=car.z;
        if(speedLimit>1&&!waitingForTraffic&&!waitingForSignal&&
           !waitingForCrossing&&car.speed<1&&moving<.04)
            state.stuck+=Math.max(0,dt);
        else state.stuck=0;
        if(state.stuck>3.5){
            // Never teleport; choose another destination and replan.
            state.index=(state.index+1)%goals.length;
            state.holder={};
            state.replans=(state.replans||0)+1;
            state.stuck=0;
        }
        car.chicagoMixedTrafficStatusR49={
            destination:state.index,
            target:{x:target.x,z:target.z},
            remaining:navigation.remaining,
            blocked:false,speedLimit,
            replans:state.replans||0,
            waiting:waitingForSignal?'signal':waitingForCrossing?
                'pedestrian':waitingForTraffic?'traffic':null
        };
        return {up:car.speed<speedLimit-.35,
            down:car.speed>speedLimit+.35,
            left:delta<-.055,right:delta>.055,
            handbrake:false,sprint:false};
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoMixedTrafficR49;
