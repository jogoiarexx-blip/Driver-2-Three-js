/* Six city missions: reusable objectives, existing car/physics/interaction systems. */
class DriverRegionalMissions {
    static SPECS={
        story_vegas_ambulance:['vegas',155,'VEGAS • AMBULANCE'],
        story_vegas_c4:['vegas',180,'VEGAS • CAINE DEPOT'],
        story_vegas_heist:['vegas',200,'VEGAS • ARMORED HEIST'],
        story_rio_barge:['rio',150,'RIO • SINK THE BARGE'],
        story_rio_jericho:['rio',120,'RIO • JERICHO MEN'],
        story_rio_helicopter:['rio',165,'RIO • LENNY ESCAPING']
    };
    static isRegional(t){return !!this.SPECS[t];}
    static car(g,config){
        const car=new DriverVehicle(g.scene,Object.assign({
            x:0,z:-80,heading:0,maxSpeed:50,accel:27},config));
        // Parked mission vehicles stay put until Tanner gets in.
        car.missionParked=config.isTarget===false;
        g.targetCar=car;g.vehicles.push(car);return car;
    }
    static begin(g,type){
        const cfg=this.SPECS[type];
        if(!cfg || cfg[0]!==g.currentCityKey)return false;
        const s={type,phase:0,delivered:0,planted:0,seconds:0,
            countdown:0,sites:[],props:[],lost:0};
        g.regionalState=s;g.missionActive=true;
        g.missionTimeLeft=cfg[1];
        document.getElementById('mission-title').textContent=cfg[2];
        document.getElementById('mission-timer').classList.remove('hidden');
        document.getElementById('mission-subcounter').classList.remove('hidden');
        const obj=document.getElementById('objective-banner');
        if(type==='story_vegas_ambulance'){
            g.felony=72;
            const ambulance=this.car(g,{name:'AMBULANCIA DE VEGAS',bodyStyle:'van',
                color:0xf0f0e7,isTarget:false,x:0,z:-81});
            // Roof rescue beacon and red-cross body decals use geometry
            // already available in Three.js; no downloaded textures.
            if(ambulance.root){
                const red=new THREE.MeshBasicMaterial({color:0xc52c38});
                const white=new THREE.MeshBasicMaterial({color:0xffffff});
                const beacon=new THREE.Mesh(new THREE.BoxGeometry(1.2,.3,.65),red);
                beacon.position.set(0,2.2,.3);
                ambulance.root.add(beacon);
                for(const side of [-1,1]){
                    const plate=new THREE.Mesh(new THREE.BoxGeometry(.09,1.3,1.35),white);
                    plate.position.set(side*1.25,1.0,.25);
                    const bar=new THREE.Mesh(new THREE.BoxGeometry(.12,1.15,.27),red);
                    bar.position.set(side*1.34,1.0,.25);
                    const across=new THREE.Mesh(new THREE.BoxGeometry(.12,.25,1.15),red);
                    across.position.set(side*1.35,1.0,.25);
                    ambulance.root.add(plate,bar,across);
                }
            }
            obj.textContent='Assuma a ambulancia com E e entregue o ferido no abrigo, sob pressão policial.';
        }else if(type==='story_vegas_c4'){
            s.sites=[{x:200,z:-160},{x:-200,z:-160},{x:280,z:160}];
            // Trucks and electrical generators are visible, low-poly
            // objectives. These are scene props, not collision volumes.
            for(const [i,site] of s.sites.entries()){
                const vehicle=new THREE.Mesh(
                    new THREE.BoxGeometry(i===0?7:5,3.5,i===0?11:6),
                    new THREE.MeshLambertMaterial({
                        color:i===0?0x657380:0x827d69}));
                vehicle.position.set(site.x,1.75,site.z);
                vehicle.name='caine-depot-target-'+i;
                g.scene.add(vehicle);s.props.push(vehicle);
            }
            this.nextSite(g,s);
            obj.textContent='Plante o C4 em 3 geradores. Saia do carro e use E em cada zona.';
        }else if(type==='story_vegas_heist'){
            g.felony=55;
            this.car(g,{name:'CARRO FORTE DE CAINE',bodyStyle:'truck',
                color:0x8999aa,isTarget:false,x:0,z:-81});
            obj.textContent='Roube o carro forte e depois o carro de luxo; leve cada um ao esconderijo.';
        }else if(type==='story_rio_barge'){
            s.sites=[{x:240,z:26}];this.nextSite(g,s);
            const barge=new THREE.Group();
            barge.name='rio-barge-mission';
            const mat=new THREE.MeshLambertMaterial({color:0x4a6370});
            const hull=new THREE.Mesh(new THREE.BoxGeometry(19,3,11),mat);
            hull.position.y=1.5;
            const cabin=new THREE.Mesh(new THREE.BoxGeometry(6,4,7),
                new THREE.MeshLambertMaterial({color:0xb7bbba}));
            cabin.position.set(4,4,0);barge.add(hull,cabin);
            barge.position.set(240,0,49);g.scene.add(barge);s.props.push(barge);
            obj.textContent='Plante o C4 no cais com E e afaste-se antes da explosão.';
        }else if(type==='story_rio_jericho'){
            g.felony=30;
            this.car(g,{name:'CAPANGA DE JERICHO',color:0x19232a,
                isTarget:true,x:0,z:-81,maxSpeed:52});
            obj.textContent='Persiga os capangas e danifique o sedan fugitivo até parar.';
        }else if(type==='story_rio_helicopter'){
            g.felony=40;s.route=[
                {x:0,z:-80},{x:80,z:-160},{x:160,z:-240},
                {x:80,z:-320},{x:0,z:-366}];
            s.heliAt={...s.route[0]};
            s.heliIndex=0;
            const heli=new THREE.Group();
            heli.name='lenny-helicopter';
            const material=new THREE.MeshLambertMaterial({color:0x3e4850});
            const body=new THREE.Mesh(new THREE.BoxGeometry(5,2.6,8),material);
            const tail=new THREE.Mesh(new THREE.BoxGeometry(1,.7,8),material);
            tail.position.z=-6;
            const rotor=new THREE.Mesh(new THREE.BoxGeometry(13,.18,.7),material);
            rotor.position.y=2.3;
            heli.add(body,tail,rotor);heli.userData.rotor=rotor;
            heli.position.set(0,23,-80);g.scene.add(heli);
            s.props.push(heli);s.heli=heli;
            obj.textContent='Siga o helicoptero até o pé do Corcovado, sem perdê-lo de vista.';
        }
        return true;
    }
    static nextSite(g,s){
        const target=s.sites[s.phase];
        g.clearMissionMarkers();
        document.getElementById('mission-subcounter')?.classList.remove('hidden');
        if(target){
            g.spawnMarkerRing(target.x,target.z,0xf97316);
            g.missionMarkers[0].manualInteract=true;
        }
    }
    static interact(g){
        const s=g.regionalState;
        if(!s || g.mode!=='on_foot' || s.countdown>0 ||
            !['story_vegas_c4','story_rio_barge'].includes(s.type))return false;
        const t=s.sites[s.phase],p=g.getPlayerPosition();
        if(!t || Math.hypot(t.x-p.x,t.z-p.z)>9)return false;
        // The generators remain visible while charges arm; only the
        // actual detonation should destroy their geometry.
        s.planted++;s.phase++;
        g.audio.playC4Beep(true);
        if(s.phase<s.sites.length)this.nextSite(g,s);
        else{s.countdown=13;g.clearMissionMarkers();
            document.getElementById('mission-subcounter')?.classList.remove('hidden');
            g.felony=Math.max(75,g.felony);}
        return true;
    }
    static update(g,dt){
        const s=g.regionalState;
        if(!s || !g.missionActive)return null;
        const p=g.getPlayerPosition();
        const sub=document.getElementById('mission-subcounter');
        const win=(title,description)=>({success:true,title,description});
        const fail=(title,description)=>({failure:true,title,description});
        if(s.type==='story_vegas_ambulance'){
            const target=g.city.safeHouseZone;
            const dist=Math.hypot(p.x-target.x,p.z-target.z);
            sub.textContent=g.playerCar===g.targetCar?
                'ABRIGO '+Math.round(dist)+'m':'ENTRE NA AMBULANCIA COM E';
            if(g.mode==='driving'&&g.playerCar===g.targetCar&&dist<14)
                return win('AMBULANCIA CONCLUIDA!','Ferido entregue em segurança.');
        }else if(s.type==='story_vegas_heist'){
            const target=g.city.safeHouseZone;
            const dist=Math.hypot(p.x-target.x,p.z-target.z);
            sub.textContent=(s.delivered+1)+'/2 • '+
                (g.playerCar===g.targetCar?'GARAGEM '+Math.round(dist)+'m':
                    'ROUBE O VEICULO COM E');
            if(g.mode==='driving'&&g.playerCar===g.targetCar&&dist<14){
                s.delivered++;
                if(s.delivered>=2)return win('VEICULOS ENTREGUES!',
                    'Carro forte e carro de luxo recuperados.');
                this.car(g,{name:'LIMUSINE DE LUXO',color:0xc16273,
                    bodyStyle:'limo',isTarget:false,x:0,z:165,maxSpeed:55});
                document.getElementById('objective-banner').textContent=
                    'Carro forte guardado. Roube a limousine e volte ao abrigo.';
            }
        }else if(s.type==='story_vegas_c4'||s.type==='story_rio_barge'){
            if(s.countdown>0){
                s.countdown-=dt;
                const distance=Math.min(...s.sites.map(v=>
                    Math.hypot(p.x-v.x,p.z-v.z)));
                sub.textContent='C4: '+s.countdown.toFixed(1)+'s • '+Math.round(distance)+'m';
                if(s.countdown<=0){
                    s.sites.forEach(v=>g.effects.spawnMassiveExplosion(
                        v.x,0,s.type==='story_rio_barge'?49:v.z));
                    if(s.type==='story_rio_barge')s.sinking=5;
                    if(s.type==='story_vegas_c4')
                        s.props.forEach(prop=>{prop.visible=false;});
                    g.audio.playBigExplosion();
                    if(s.heli)s.heli.visible=false;
                    // Vessel sinks visibly after the blast instead of vanishing.
                    return distance>=65?win('C4 CONCLUIDO!','Detonação em segurança.'):
                        fail('ATINGIDO PELA EXPLOSAO!','Saia pelo menos 65m do alvo.');
                }
            }else{
                const t=s.sites[s.phase],distance=t?
                    Math.hypot(p.x-t.x,p.z-t.z):0;
                sub.textContent='C4 '+s.planted+'/'+s.sites.length+
                    ' • '+Math.round(distance)+'m • E A PE';
            }
        }else if(s.type==='story_rio_jericho'){
            sub.textContent='SEDAN '+Math.round(g.targetCar?.damage||0)+'%';
            if(g.targetCar?.damage>=100)return win('JERICHO INTERCEPTADO!',
                'Os capangas foram detidos.');
        }else if(s.type==='story_rio_helicopter'){
            s.seconds+=dt;
            const goal=s.route[s.heliIndex+1];
            if(goal){
                const d=Math.hypot(goal.x-s.heliAt.x,goal.z-s.heliAt.z);
                const advance=Math.min(d,dt*19);
                if(d>.001){
                    s.heliAt.x+=(goal.x-s.heliAt.x)*advance/d;
                    s.heliAt.z+=(goal.z-s.heliAt.z)*advance/d;
                }
                if(d<2)s.heliIndex++;
            }
            s.heli.position.set(s.heliAt.x,23+Math.sin(s.seconds*2),s.heliAt.z);
            s.heli.userData.rotor.rotation.y+=dt*22;
            const d=Math.hypot(p.x-s.heliAt.x,p.z-s.heliAt.z);
            s.lost=d>165?s.lost+dt:Math.max(0,s.lost-dt*2);
            sub.textContent='HELICOPTERO '+Math.round(d)+'m • '+(s.heliIndex+1)+'/5';
            if(s.lost>12)return fail('LENNY ESCAPOU!','Helicoptero perdido.');
            if(s.heliIndex>=4&&Math.hypot(p.x,p.z+366)<80){
                s.heliRetreat=7;
                return win('LENNY ALCANCADO!','Tanner chegou ao Corcovado.');
            }
        }
        return null;
    }
    static animate(g,dt){
        const s=g.regionalState;
        if(s?.type==='story_rio_helicopter'&&s.heliRetreat>0&&s.heli){
            const t=Math.max(0,Math.min(.05,dt));
            s.heliRetreat-=t;
            s.heli.position.y+=t*8;
            s.heli.position.x+=t*9;
            s.heli.userData.rotor.rotation.y+=t*25;
            if(s.heliRetreat<=0)s.heli.visible=false;
        }
        if(s?.type!=='story_rio_barge'||!(s.sinking>0)||!s.props[0])
            return;
        const boat=s.props[0];
        const t=Math.max(0,Math.min(.05,dt));
        boat.position.y-=t*1.5;
        boat.rotation.z+=t*.16;
        s.sinking-=t;
        if(s.sinking<=0)boat.visible=false;
    }
    static dispose(g){
        for(const prop of g.regionalState?.props||[]){
            g.scene.remove(prop);GPUResourceUtils.disposeSubtree(prop);
        }
        g.regionalState=null;
    }
}
