/**
 * Driving Games clássicos independentes do Undercover.
 * A lógica usa a IA, checkpoints e troca de carro já existentes.
 */
class DriverClassicGames {
    static MODES=new Set(['arcade_getaway','gate_racing',
        'arcade_checkpoint','arcade_quickchase']);
    static isClassic(type){return this.MODES.has(type);}
    static route(city){
        // Eixos dirigíveis existentes: pontos espaçados sem rio no meio.
        return [
            {x:0,z:-240},{x:160,z:-240},{x:240,z:-80},
            {x:160,z:160},{x:-160,z:160}
        ];
    }
    static gates(){
        return [
            {x:0,z:-80,axis:'x'},{x:80,z:-80,axis:'x'},
            {x:160,z:-80,axis:'x'},{x:160,z:0,axis:'z'},
            {x:80,z:0,axis:'z'},{x:0,z:0,axis:'x'},
            {x:-80,z:-80,axis:'x'},{x:-160,z:-80,axis:'x'}
        ];
    }
    static begin(g,type){
        const s={type,clearSeconds:0,gates:[],coneMeshes:[],penalized:new Set(),
            passiveCops:[]};
        g.classicState=s;
        const title=document.getElementById('mission-title');
        const obj=document.getElementById('objective-banner');
        const sub=document.getElementById('mission-subcounter');
        g.missionActive=true;
        g.missionTimeLeft=type==='arcade_getaway'?100:
            type==='gate_racing'?90:type==='arcade_checkpoint'?155:65;
        title.textContent={
            arcade_getaway:'DRIVING GAMES • GETAWAY',
            gate_racing:'DRIVING GAMES • GATE RACING',
            arcade_checkpoint:'DRIVING GAMES • CHECKPOINT',
            arcade_quickchase:'DRIVING GAMES • QUICK CHASE'
        }[type]+' • '+g.currentCityKey.toUpperCase();
        document.getElementById('mission-timer').classList.remove('hidden');
        sub.classList.remove('hidden');
        if(type!=='arcade_getaway'){
            // No police pursuit in pure racing/chase arcade trials.
            for(const cop of g.vehicles.filter(v=>v.isPolice)){
                s.passiveCops.push(cop);
                cop.isPolice=false;cop.sirenActive=false;
            }
        }
        if(type==='arcade_getaway'){
            g.felony=98;
            // Policial no encalço desde o início.
            for(const cop of g.vehicles.filter(v=>v.isPolice).slice(0,2)){
                cop.x=g.playerCar.x+(cop===g.vehicles.find(v=>v.isPolice)?8:-8);
                cop.z=g.playerCar.z-18;cop.updateTransform?.();
            }
            obj.textContent='Desapareça do radar: mantenha a polícia sem visão por 8 segundos seguidos.';
            sub.textContent='PERDA DE CONTATO: 0 / 8s';
        }else if(type==='gate_racing'){
            obj.textContent='Atravesse 8 portões estreitos entre dois cones. Limpo: +2s. Cone atingido: -3s.';
            s.gates=this.gates();
            for(const [i,gate] of s.gates.entries()){
                g.spawnMarkerRing(gate.x,gate.z,0xfb923c);
                const axis=gate.axis==='x';
                for(const side of [-1,1]){
                    const x=gate.x+(axis?side*3.9:0);
                    const z=gate.z+(axis?0:side*3.9);
                    const mesh=new THREE.Mesh(
                        new THREE.ConeGeometry(.85,2.1,7),
                        new THREE.MeshLambertMaterial({color:0xf97316}));
                    mesh.position.set(x,1.05,z);
                    mesh.name='gate-racing-cone-'+i;
                    g.scene.add(mesh);s.coneMeshes.push(mesh);
                }
            }
            g.totalMarkers=s.gates.length;
            sub.textContent='PORTÕES: 0 / 8 • SEM POLÍCIA';
            g.felony=0;
        }else if(type==='arcade_checkpoint'){
            for(const marker of this.route(g.currentCityKey))
                g.spawnMarkerRing(marker.x,marker.z,0x38bdf8);
            g.totalMarkers=5;g.felony=0;
            sub.textContent='CHECKPOINTS: 0 / 5';
            obj.textContent='Prova contra o relógio: alcance os 5 checkpoints distantes, sem perseguição policial.';
        }else {
            g.felony=0;
            obj.textContent='Intercepte e destrua o veículo fugitivo antes que o relógio termine.';
            sub.textContent='FUGITIVO: 0% DE DANO';
            g.targetCar=new DriverVehicle(g.scene,{
                name:'FUGITIVO ARCADE',color:0xce3d39,isTarget:true,
                x:0,z:14,heading:0,maxSpeed:49,accel:27
            });
            g.vehicles.push(g.targetCar);
        }
        DriverCheckpointRoute.refresh(type,g.missionMarkers);
        return s;
    }
    static findGateMarker(g,x,z){
        const s=g.classicState;
        if(!s||s.type!=='gate_racing'||g.mode!=='driving')return null;
        const marker=DriverCheckpointRoute.current(g.missionMarkers);
        if(!marker)return null;
        const index=g.missionMarkers.indexOf(marker);
        const gate=s.gates[index];
        if(!gate)return null;
        // Passing between cones is required: approaching a ring from
        // outside the narrow gate must not award the checkpoint.
        const lateral=gate.axis==='x'?Math.abs(x-gate.x):Math.abs(z-gate.z);
        const forward=gate.axis==='x'?Math.abs(z-gate.z):Math.abs(x-gate.x);
        return lateral<3.2&&forward<3.1?marker:null;
    }
    static marker(g,marker){
        const s=g.classicState;
        if(!s)return;
        if(s.type==='gate_racing'){
            const index=g.missionMarkers.indexOf(marker);
            const gate=s.gates[index];
            const player=g.playerCar;
            const d=Math.hypot(player.x-gate.x,player.z-gate.z);
            // Ring + narrow cones: collision evaluated when entering.
            if(d<5.5 && !s.penalized.has(index)){
                g.missionTimeLeft+=2;
            }
        }
    }
    static update(g,dt){
        const s=g.classicState;
        if(!s || !g.missionActive)return null;
        s.elapsed=(s.elapsed||0)+dt;
        const sub=document.getElementById('mission-subcounter');
        const pos=g.getPlayerPosition();
        if(s.type==='arcade_getaway'){
            // Distance + line-of-sight to all cops, not felony alone.
            const visible=g.vehicles.some(v=>v.isPolice && v!==g.playerCar &&
                Math.hypot(v.x-pos.x,v.z-pos.z)<105 &&
                (typeof g.trafficAI.unobstructed!=='function'||
                    g.trafficAI.unobstructed(v,pos)));
            s.clearSeconds=visible?0:s.clearSeconds+dt;
            sub.textContent='FORA DO RADAR: '+s.clearSeconds.toFixed(1)+'/8.0s';
            if(s.clearSeconds>=8){
                const key='driver2.getaway.best.'+g.currentCityKey;
                let best=null;
                try{
                    const store=g.homeSave?.storage;
                    best=Number(store?.getItem(key))||Infinity;
                    if(s.elapsed<best){
                        best=s.elapsed;
                        store?.setItem(key,s.elapsed.toFixed(2));
                    }
                }catch(_){best=s.elapsed;}
                return {success:true,title:'GETAWAY CONCLUÍDO!',
                    message:'Fuga: '+s.elapsed.toFixed(1)+'s • Recorde: '+
                        (Number.isFinite(best)?best.toFixed(1):s.elapsed.toFixed(1))+'s'};
            }
        }
        if(s.type==='gate_racing'){
            // Cones são decorativos mas possuem penalidade real.
            if(g.mode==='driving'){
                for(const [i,gate] of s.gates.entries()){
                    if(s.penalized.has(i))continue;
                    const axis=gate.axis==='x';
                    for(const side of [-1,1]){
                        const x=gate.x+(axis?side*3.9:0);
                        const z=gate.z+(axis?0:side*3.9);
                        if(Math.abs(g.playerCar.speed||0)>2 &&
                            Math.hypot(pos.x-x,pos.z-z)<1.55){
                            s.penalized.add(i);
                            g.missionTimeLeft=Math.max(.1,g.missionTimeLeft-3);
                            g.audio.playCrash(.4);
                            break;
                        }
                    }
                }
            }
            sub.textContent='PORTÕES: '+g.markersCollected+'/'+g.totalMarkers+
                ' • CONES: '+s.penalized.size;
            if(g.markersCollected>=g.totalMarkers)return {success:true,
                title:'GATE RACING CONCLUÍDO!',message:'Todos os portões atravessados.'};
        }
        if(s.type==='arcade_checkpoint'){
            sub.textContent='CHECKPOINTS: '+g.markersCollected+'/5';
            if(g.markersCollected>=5)return {success:true,
                title:'CHECKPOINT CONCLUÍDO!',message:'Cinco pontos em tempo recorde.'};
        }
        if(s.type==='arcade_quickchase'&&g.targetCar){
            sub.textContent='FUGITIVO: '+Math.round(g.targetCar.damage||0)+'% DE DANO';
            if(g.targetCar.damage>=100)return {success:true,
                title:'QUICK CHASE CONCLUÍDO!',message:'Veículo fugitivo interceptado.'};
        }
        return null;
    }
    static dispose(g){
        for(const cop of g.classicState?.passiveCops||[])
            cop.isPolice=true;
        for(const mesh of g.classicState?.coneMeshes||[]){
            g.scene.remove(mesh);
            GPUResourceUtils.disposeSubtree(mesh);
        }
        g.classicState=null;
    }
}
