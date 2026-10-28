/**
 * Chicago gameplay — complementos leves ao construtor existente.
 * Coordenadas locais são inspiradas na cidade original, não extraídas do mapa PS1.
 * Colisores AABB inseridos somente para paredes e portão.
 */
class DriverChicagoGameplay {
    static STADIUM={x:-280,z:200};
    static buildGrantPark(city,x,z){
        if(city.preset.id!=='chicago')return;
        const green=new THREE.MeshLambertMaterial({color:0x37794a});
        const concrete=new THREE.MeshLambertMaterial({color:0x9da8a3});
        const water=new THREE.MeshPhongMaterial({
            color:0x37758c,shininess:75,transparent:true,opacity:.85});
        const box=(px,py,pz,w,h,d,mat)=>{
            const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
            mesh.position.set(px,py,pz);mesh.receiveShadow=true;
            city.cityGroup.add(mesh);return mesh;
        };
        box(x,.06,z,38,.12,37,green);
        box(x,.17,z,2,.1,36,concrete);
        box(x,.17,z,36,.1,2,concrete);
        box(x,.18,z,10,.2,10,concrete);
        const fountain=new THREE.Mesh(new THREE.CylinderGeometry(4.2,4.2,.6,12),concrete);
        fountain.position.set(x,.5,z);city.cityGroup.add(fountain);
        const pool=new THREE.Mesh(new THREE.CylinderGeometry(3.7,3.7,.10,12),water);
        pool.position.set(x,.84,z);city.cityGroup.add(pool);
        const trunk=new THREE.MeshLambertMaterial({color:0x684b34});
        const leaves=new THREE.MeshLambertMaterial({color:0x25633a});
        for(const dx of [-14,-9,9,14])for(const dz of [-14,14]){
            const stem=new THREE.Mesh(new THREE.CylinderGeometry(.28,.38,3,5),trunk);
            stem.position.set(x+dx,1.55,z+dz);
            const crown=new THREE.Mesh(new THREE.ConeGeometry(2.3,4.5,6),leaves);
            crown.position.set(x+dx,5,z+dz);
            city.cityGroup.add(stem,crown);
        }
    }
    static buildStadium(city,x,z){
        if(city.preset.id!=='chicago')return;
        const root=new THREE.Group();root.name='chicago-wrigley-interactive';
        city.cityGroup.add(root);
        const brick=new THREE.MeshLambertMaterial({color:0x8f392c});
        const field=new THREE.MeshLambertMaterial({color:0x367741});
        const earth=new THREE.MeshLambertMaterial({color:0xa47b55});
        const gateMaterial=new THREE.MeshLambertMaterial({color:0x596578});
        const add=(px,py,pz,w,h,d,mat,collider=false)=>{
            const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
            m.position.set(px,py,pz);m.receiveShadow=true;
            root.add(m);
            if(collider)city.buildingBoxes.push({
                minX:px-w/2,maxX:px+w/2,minZ:pz-d/2,maxZ:pz+d/2});
            return m;
        };
        // Arena interna atravessável: sem bloco de colisão que ocupe o campo.
        add(x,.04,z,36,.08,35,field);
        add(x,.10,z,18,.10,18,earth).rotation.y=Math.PI/4;
        const perimeter=[
            [x-19,z,1,38],[x+19,z,1,38],[x,z-19,38,1],
            [x-12,z+19,14,1],[x+12,z+19,14,1]
        ];
        perimeter.forEach(([px,pz,w,d])=>add(px,2.8,pz,w,5.6,d,brick,true));
        // Portão físico central, com collider removido quando abre.
        const gate=add(x,2,z+19,9.7,4,.35,gateMaterial);
        const box={minX:x-4.85,maxX:x+4.85,minZ:z+18.65,maxZ:z+19.35};
        city.buildingBoxes.push(box);
        const booth=add(x+30,1.9,z+23,3.5,3.8,3.5,brick);
        add(x+30,4,z+23,4.5,.35,4.5,gateMaterial);
        // Carro secreto visível como marcador até integração com spawner real.
        const car=add(x,0.95,z,3,1.35,6,
            new THREE.MeshLambertMaterial({color:0x0d1016}));
        for(const stripe of [-.62,.62])
            add(x+stripe,1.64,z,.28,.04,5.7,
                new THREE.MeshBasicMaterial({color:0xfacc15}));
        city.chicagoStadium={
            x,z,gate,box,open:false,progress:0,
            switch:{x:x+30,z:z+23},secretDisplay:car
        };
    }
    static interact(city,pos){
        const site=city?.chicagoStadium;
        if(!site||!pos||Math.hypot(pos.x-site.switch.x,pos.z-site.switch.z)>5)
            return false;
        if(!site.open){
            site.open=true;
            const i=city.buildingBoxes.indexOf(site.box);
            if(i>=0)city.buildingBoxes.splice(i,1);
            if(city._spatialCollisions)city._spatialCollisions.boxes=null;
        }
        return true;
    }
    static update(city,dt){
        const site=city?.chicagoStadium;
        if(!site)return;
        const target=site.open?4.5:0;
        site.progress=THREE.MathUtils.damp(site.progress,target,5,
            Math.min(.08,Math.max(0,dt)));
        site.gate.position.y=2+site.progress;
    }
    static updateBridge(city,dt){
        if(city.preset.id!=='chicago')return;
        // A tecla B continua tendo prioridade; pulso automático a cada 90s.
        city.chicagoBridgeClock=(city.chicagoBridgeClock||0)+dt;
        if(city.chicagoBridgeClock>=90){
            city.chicagoBridgeClock%=90;
            city.toggleBridge();
        }
        const a=city.bridgeAngle||0;
        const warning=a>.12;
        if(!city.chicagoBridgeLamps){
            const material=new THREE.MeshBasicMaterial({color:0xef4444});
            city.chicagoBridgeLamps=[-13,13].map(x=>{
                const mesh=new THREE.Mesh(
                    new THREE.BoxGeometry(.7,.55,.6),material.clone());
                mesh.position.set(x,3,32.5);
                city.cityGroup.add(mesh);return mesh;
            });
        }
        const flash=Math.floor((city.signalClock||0)*3)%2===0;
        city.chicagoBridgeLamps.forEach(l=>{
            l.material.color.setHex(warning&&flash?0xff2222:0x3f1010);
        });
    }
}
