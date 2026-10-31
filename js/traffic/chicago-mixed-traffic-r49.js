/**
 * Chicago R49 — civilians choosing between grid streets and R48 side roads.
 * No scripted/mission car is re-routed; cars without a safe route fall back
 * to the pre-existing traffic controller.
 */
class DriverChicagoMixedTrafficR49 {
    static GOALS=[
        {x:200,z:-120},{x:240,z:-160},{x:40,z:-40},
        {x:0,z:-80},{x:160,z:-240},{x:120,z:-120},
        {x:240,z:-40},{x:40,z:-160}
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
        const result=[];
        for(const [index,c] of candidates.entries()){
            if(city.isWaterAt?.(c.x,c.z)||
               city.isPointBlocked?.(c.x,c.z,1.8,0))continue;
            if([...vehicles,...result].some(other=>
                Math.hypot(other.x-c.x,other.z-c.z)<18))continue;
            const goal=this.GOALS[(index*2+1)%this.GOALS.length];
            if(!DriverChicagoMixedNavigationR49.plan(city,c,goal))continue;
            result.push({...c,goalIndex:(index*2+1)%this.GOALS.length,
                maxSpeed:29,accel:20,bodyStyle:'sedan'});
        }
        return result;
    }
    static getInput(city,car,vehicles=[],dt=0,roadblocks=[]){
        if(!this.isEligible(city,car))return null;
        const state=car.chicagoMixedTrafficStateR49||{
            index:Number.isInteger(car.chicagoMixedTrafficGoalIndex)?
                car.chicagoMixedTrafficGoalIndex:0,
            holder:{},lastX:car.x,lastZ:car.z,stuck:0
        };
        car.chicagoMixedTrafficStateR49=state;
        let goal=this.GOALS[state.index%this.GOALS.length];
        if(Math.hypot(car.x-goal.x,car.z-goal.z)<14){
            state.index=(state.index+3)%this.GOALS.length;
            state.holder={};
            goal=this.GOALS[state.index];
        }
        let navigation=DriverChicagoMixedNavigationR49.follow(
            city,car,goal,state.holder,dt);
        if(navigation.blocked||!navigation.target)return null;
        const target=navigation.target;
        const heading=Math.atan2(target.x-car.x,target.z-car.z);
        const delta=Math.atan2(
            Math.sin(heading-car.heading),Math.cos(heading-car.heading));
        const bend=Math.abs(delta);
        let speedLimit=bend>.5?4.2:bend>.22?6.5:11.2;
        const fx=Math.sin(car.heading),fz=Math.cos(car.heading);
        const brakingGap=8+Math.max(0,car.speed)*.32;
        for(const other of vehicles){
            if(other===car||other.missionParked||
               Math.abs((other.y||0)-(car.y||0))>3.2)continue;
            const dx=other.x-car.x,dz=other.z-car.z;
            const forward=dx*fx+dz*fz;
            const lateral=Math.abs(dx*fz-dz*fx);
            if(forward>0&&forward<22&&lateral<3.8)
                speedLimit=Math.min(speedLimit,
                    forward<brakingGap?0:Math.max(2,(forward-brakingGap)*.9));
        }
        for(const block of roadblocks||[]){
            if(block.destroyed||block.disabled||!Number.isFinite(block.x)||
               !Number.isFinite(block.z))continue;
            const dx=block.x-car.x,dz=block.z-car.z;
            const forward=dx*fx+dz*fz;
            const lateral=Math.abs(dx*fz-dz*fx);
            if(forward>0&&forward<28&&lateral<7)
                speedLimit=Math.min(speedLimit,forward<15?0:4);
        }
        // Signals only exist on the original grid. Off-grid R48 crossings
        // have marked zebra walks but no fictitious traffic lights.
        const nearGrid=Math.abs(target.x/80-Math.round(target.x/80))<.02 &&
            Math.abs(target.z/80-Math.round(target.z/80))<.02;
        const dist=Math.hypot(car.x-target.x,car.z-target.z);
        if(nearGrid&&dist>7&&dist<20&&
           typeof city.isTrafficGreen==='function'){
            const axis=Math.abs(target.x-car.x)>Math.abs(target.z-car.z)?'x':'z';
            if(!city.isTrafficGreen(axis))speedLimit=0;
        }
        if(typeof DriverPedestrianSidewalks!=='undefined'){
            const p=DriverPedestrianSidewalks.approachingCrossing(
                car,city.activePedestrianCrossings||[],23);
            if(p<20)speedLimit=Math.min(speedLimit,p<9?0:4);
        }
        const moving=Math.hypot(car.x-state.lastX,car.z-state.lastZ);
        state.lastX=car.x;state.lastZ=car.z;
        if(speedLimit>1&&car.speed<1&&moving<.04)
            state.stuck+=Math.max(0,dt);
        else state.stuck=0;
        if(state.stuck>3.5){
            // Never teleport; choose another destination and replan.
            state.index=(state.index+1)%this.GOALS.length;
            state.holder={};
            state.stuck=0;
        }
        car.chicagoMixedTrafficStatusR49={
            destination:state.index,
            target:{x:target.x,z:target.z},
            remaining:navigation.remaining,
            blocked:false,speedLimit
        };
        return {up:car.speed<speedLimit-.35,
            down:car.speed>speedLimit+.35,
            left:delta<-.055,right:delta>.055,
            handbrake:false,sprint:false};
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoMixedTrafficR49;
