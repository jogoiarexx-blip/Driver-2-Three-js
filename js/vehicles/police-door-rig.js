/**
 * Animação de portas GLB de polícia e do carro Driver 2 personalizado.
 * pivôs reais; o GLB original de malha única é separado em runtime
 * quando o usuário ainda não publicou a versão com rig.
 * Nunca altera o chassi físico, controles, cor ou sirene da viatura.
 */
class DriverPoliceDoorRig {
    static find(root,name) {
        if(root.getObjectByName)return root.getObjectByName(name);
        let found=null;
        root.traverse?.(node=>{
            if(node.name===name)found=node;
        });
        return found;
    }
    static splitOriginal(root) {
        // Somente GLBs de malha unificada; não retalhar a geometria
        // dos veículos CC0 que podem ter muitas malhas separadas.
        const list=[];
        root.traverse(obj=>{
            if(obj.isMesh && obj.geometry?.attributes?.position &&
                obj.geometry.index)list.push(obj);
        });
        if(list.length!==1)return null;
        const mesh=list[0],geometry=mesh.geometry,position=geometry.attributes.position;
        if(position.count<3000)return null;
        const index=geometry.index;
        if(index.count<9000)return null;
        const body=[],doors=[[],[]];
        for(let i=0;i<index.count;i+=3){
            const ia=index.getX(i),ib=index.getX(i+1),ic=index.getX(i+2);
            const x=(position.getX(ia)+position.getX(ib)+position.getX(ic))/3;
            const y=(position.getY(ia)+position.getY(ib)+position.getY(ic))/3;
            const z=(position.getZ(ia)+position.getZ(ib)+position.getZ(ic))/3;
            const side=z<-.245?0:z>.245?1:-1;
            if(side>=0 && x>=-.50 && x<=.16 && y>-.185 && y<.175)
                doors[side].push(ia,ib,ic);
            else body.push(ia,ib,ic);
        }
        if(doors.some(v=>v.length<2700)||body.length<6000)return null;
        const createGeom=indices=>{
            const g=new THREE.BufferGeometry();
            for(const key of Object.keys(geometry.attributes))
                g.setAttribute(key,geometry.attributes[key]);
            g.setIndex(indices);
            return g;
        };
        mesh.geometry=createGeom(body);
        // Geometria privada da instância; atributos de vértices seguem
        // compartilhados, mas índices e objeto BufferGeometry são novos.
        mesh.userData=mesh.userData||{};
        mesh.userData.driverOwnedGeometry=true;
        // As novas geometrias compartilham atributos e texturas originais:
        // só os índices são separados, sem duplicar milhares de vértices.
        for(let side=0;side<2;side++){
            const left=side===0,hinge=new THREE.Group();
            hinge.name='police_'+(left?'left':'right')+'_door_hinge';
            hinge.position.set(-.46,0,left?-.31:.31);
            const part=new THREE.Mesh(createGeom(doors[side]),mesh.material);
            part.name='Police_Door_'+(left?'left':'right')+'_Mesh';
            part.position.set(.46,0,left?.31:-.31);
            part.frustumCulled=false;
            part.castShadow=false;
            part.userData=part.userData||{};
            part.userData.cc0SharedAsset=true;
            part.userData.driverOwnedGeometry=true;
            hinge.add(part);mesh.add(hinge);
        }
        return mesh;
    }
    static mount(vehicle,wrapped) {
        if(!vehicle || !(vehicle.isPolice||vehicle._userCustomModel) ||
            !wrapped)return false;
        let left=this.find(wrapped,'police_left_door_hinge');
        let right=this.find(wrapped,'police_right_door_hinge');
        if(!left){
            if(!this.splitOriginal(wrapped))return false;
            left=this.find(wrapped,'police_left_door_hinge');
            right=this.find(wrapped,'police_right_door_hinge');
        }
        if(!left)return false;
        left.rotation.y=0;
        if(right)right.rotation.y=0;
        // O carro Driver2 GLB tem a orientação lateral inversa da
        // viatura: o painel usado antes era o da porta do passageiro.
        const side=vehicle._userCustomModel&&!vehicle._policeCustomModel?
            'right':'left';
        vehicle.policeDoorRig={left,right,side,phase:'closed',
            duration:1.35,clock:0,onFinished:null};
        return true;
    }
    static standPoint(vehicle,distance=2.4) {
        // Ângulo da direção é medido em torno de +Y; o carro avança +Z.
        // Rigs distintos (Tanner / polícia) selecionam o mesmo lado
        // para dobradiça, aproximação e posição após sair.
        const side=vehicle?.policeDoorRig?.side==='right'?1:-1;
        const h=Number(vehicle?.heading)||0;
        return {
            x:vehicle.x+Math.cos(h)*distance*side,
            y:vehicle.y||0,
            z:vehicle.z-Math.sin(h)*distance*side,
            heading:h
        };
    }
    static start(vehicle,mode,callback) {
        const rig=vehicle?.policeDoorRig;
        if(!rig||rig.phase!=='closed' ||
            !['enter','exit'].includes(mode))return false;
        rig.phase=mode;rig.clock=0;
        rig.onFinished=typeof callback==='function'?callback:null;
        return true;
    }
    static progress(clock){
        // abre 0-0.38, segura 0.38-0.93, fecha 0.93-1.35s
        if(clock<.38)return Math.max(0,Math.min(1,clock/.38));
        if(clock<.93)return 1;
        return Math.max(0,1-(clock-.93)/.42);
    }
    static update(vehicle,dt){
        const rig=vehicle?.policeDoorRig;
        if(!rig||rig.phase==='closed')return false;
        rig.clock+=Math.min(.08,Math.max(0,dt));
        const angle=this.progress(rig.clock);
        // Porta esquerda: no GLB nativo, X positivo aponta para trás
        // e Z negativo aponta para fora (motor usa Ry(+90°)).
        rig.left.rotation.y=rig.side==='left'?angle*1.13:0;
        if(rig.right)rig.right.rotation.y=
            rig.side==='right'?-angle*1.13:0;
        if(rig.clock>=rig.duration){
            rig.left.rotation.y=0;
            if(rig.right)rig.right.rotation.y=0;
            rig.phase='closed';rig.clock=0;
            const done=rig.onFinished;rig.onFinished=null;
            if(done)done();
            return true;
        }
        return false;
    }
    static cancel(vehicle) {
        const rig=vehicle?.policeDoorRig;
        if(!rig)return;
        rig.left.rotation.y=0;
        if(rig.right)rig.right.rotation.y=0;
        rig.phase='closed';rig.clock=0;rig.onFinished=null;
    }
}
