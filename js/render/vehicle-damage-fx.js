/**
 * Dano visual progressivo para carros PS1 e GLB, sem shaders externos.
 * Geometrias criadas apenas na construção/troca de carro.
 */
class VehicleDamageFX {
    static severity(damage) {
        const value = Math.max(0, Math.min(100, Number(damage) || 0));
        return {
            scratches: value >= 20,
            dents: value >= 38,
            glass: value >= 64,
            critical: value >= 85,
            intensity: value / 100
        };
    }

    static zoneState(car) {
        const clamp=v=>{
            const n=Number(v);
            return Number.isFinite(n)?Math.max(0,Math.min(100,n))/100:0;
        };
        const z=car?.damageZones||{};
        const total=clamp(car?.damage);
        return {
            front:clamp(z.front),
            rear:clamp(z.rear),
            left:clamp(z.left),
            right:clamp(z.right),
            total,
            frontBend:Math.max(clamp(z.front)*.42,total*.15),
            rearBend:Math.max(clamp(z.rear)*.34,total*.10),
            sideLean:(clamp(z.right)-clamp(z.left))*.15
        };
    }

    static attach(car) {
        if (!car || !car.chassisTilt) return;
        if (car.damageGroup && car.damageGroup.parent) {
            car.damageGroup.parent.remove(car.damageGroup);
            GPUResourceUtils.disposeSubtree(car.damageGroup);
        }
        const group = new THREE.Group();
        group.name = 'driver2-visual-damage';
        const metal = new THREE.MeshBasicMaterial({ color: 0x18181b, side: THREE.DoubleSide });
        const rusty = new THREE.MeshBasicMaterial({ color: 0x713f12, side: THREE.DoubleSide });
        const glass = new THREE.MeshBasicMaterial({
            color: 0xe2e8f0, transparent: true, opacity: 0.65,
            depthWrite: false, side: THREE.DoubleSide
        });
        const scratches = new THREE.Group();
        const dents = new THREE.Group();
        const cracks = new THREE.Group();
        const heavy = new THREE.Group();
        // Arranhões nas duas portas: pequenas chapas escuras em zigue-zague.
        for (const sign of [-1, 1]) {
            for (let i = 0; i < 3; i++) {
                const line = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.75), metal);
                line.position.set(sign * 1.205, 0.77 + i * 0.09, -0.5 + i * 0.24);
                line.rotation.x = (i % 2 ? 0.12 : -0.14);
                scratches.add(line);
            }
            // Chapa externa desalinhada; sem deformar a caixa física.
            const dent = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.48, 0.78), rusty);
            dent.position.set(sign * 1.23, 0.75, -0.10);
            dent.rotation.z = sign * 0.18;
            dents.add(dent);
        }
        // Vidro com duas fissuras cruzadas.
        for (let i = 0; i < 2; i++) {
            const line = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.028, 1.18), glass);
            line.position.set(i ? 0.23 : -0.25, 1.66, 0.1);
            line.rotation.y = i ? 0.52 : -0.52;
            cracks.add(line);
        }
        // Capô desalinhado quando o motor está muito danificado.
        const hood = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.8), rusty);
        hood.position.set(0, 1.10, 1.85);
        hood.rotation.x = 0.13;
        heavy.add(hood);

        // Para-choque pendurado + grade amassada após impacto forte.
        // Não desloca o collider físico e acompanha carros GLB.
        const bumper = new THREE.Group();
        const bent = new THREE.Mesh(new THREE.BoxGeometry(2.30, 0.17, 0.22), metal);
        bent.position.set(0.15, 0.41, 2.66);
        bent.rotation.z = -0.12;
        const grille = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.26, 0.08), rusty);
        grille.position.set(-0.08, 0.78, 2.69);
        grille.rotation.y = 0.08;
        bumper.add(bent, grille);

        // Superaquecimento crítico representado por luz de material, não
        // por PointLight; por isso não multiplica o custo de iluminação.
        const engineGlow = new THREE.Group();
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xfb923c, transparent: true, opacity: 0.85,
            depthWrite: false
        });
        const engineStrip = new THREE.Mesh(
            new THREE.BoxGeometry(0.70, 0.10, 0.30), glowMat
        );
        engineStrip.position.set(0, 1.20, 1.82);
        engineGlow.add(engineStrip);

        // Cada lado conserva danos próprios, sem recalcular geometrias por frame.
        const rearDamage = new THREE.Group();
        const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.16,0.16,0.21),metal);
        rearBumper.position.set(-0.16,0.46,-2.68);
        rearBumper.rotation.z=0.16;
        const rearScuff = new THREE.Mesh(new THREE.BoxGeometry(1.4,0.25,0.07),rusty);
        rearScuff.position.set(0.2,0.75,-2.72);
        rearDamage.add(rearBumper,rearScuff);
        const leftDamage = new THREE.Group();
        const rightDamage = new THREE.Group();
        for (const sign of [-1,1]) {
            const door = new THREE.Mesh(new THREE.BoxGeometry(0.075,0.50,1.28),metal);
            door.position.set(sign*1.24,0.79,-0.1);
            door.rotation.z = sign*0.12;
            const scrape = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.12,1.14),rusty);
            scrape.position.set(sign*1.29,0.86,-0.13);
            const target=sign<0?leftDamage:rightDamage;
            target.add(door,scrape);
        }
        group.add(scratches, dents, cracks, heavy, bumper, engineGlow,
            rearDamage,leftDamage,rightDamage);
        car.chassisTilt.add(group);
        car.damageGroup = group;
        car.damageParts = {
            scratches, dents, cracks, heavy, bumper, engineGlow,
            rearDamage,leftDamage,rightDamage
        };
        this.update(car);
    }

    static update(car) {
        if (!car || !car.damageParts) return;
        const stage = this.severity(car.damage);
        car.damageParts.scratches.visible = stage.scratches;
        car.damageParts.dents.visible = stage.dents;
        car.damageParts.cracks.visible = stage.glass;
        car.damageParts.heavy.visible = stage.critical;
        const zones=car.damageZones || {};
        const z=this.zoneState(car);
        // Dobras ficam proporcionais à energia recebida em cada lado.
        // A física usa os mesmos colliders; só a malha sofre deformação.
        if (car.damageParts.bumper) {
            const front=car.damageParts.bumper;
            front.visible=!car.breakawayFlags?.front &&
                (stage.intensity>=.72 || z.front>=.16);
            front.rotation.z=-z.frontBend*.8;
            front.rotation.y=z.sideLean*.45;
            front.position.z=-z.frontBend*.54;
            front.position.y=-z.frontBend*.28;
        }
        if (car.damageParts.rearDamage) {
            const rear=car.damageParts.rearDamage;
            rear.visible=!car.breakawayFlags?.rear && z.rear>=.14;
            rear.rotation.z=z.rearBend*.65;
            rear.rotation.y=-z.sideLean*.4;
            rear.position.z=z.rearBend*.5;
            rear.position.y=-z.rearBend*.2;
        }
        if (car.damageParts.leftDamage) {
            const left=car.damageParts.leftDamage;
            left.visible=!car.breakawayFlags?.left && z.left>=.14;
            left.rotation.z=-z.left*.24;
            left.position.x=z.left*.13;
        }
        if (car.damageParts.rightDamage) {
            const right=car.damageParts.rightDamage;
            right.visible=!car.breakawayFlags?.right && z.right>=.14;
            right.rotation.z=z.right*.24;
            right.position.x=-z.right*.13;
        }
        // Real, persistent low-poly crumple on the hood and trunk,
        // driven by zoned impacts. Does not change physics AABB.
        // Own the hinge rotations here to avoid the previous conflict
        // between the vehicle update and the damage renderer.
        if(car.hoodPivot){
            const deformation=Math.max(z.front,stage.intensity*.34);
            const flutter=deformation>.4?
                Math.sin((car.motionClock||0)*13)*
                    Math.min(.045,Math.abs(car.speed||0)*.0015):0;
            car.hoodPivot.rotation.x=-
                Math.min(.58,deformation*.46+Math.max(0,flutter));
            car.hoodPivot.rotation.z=z.sideLean*.35;
            const hood=car.hoodPivot.children?.[0];
            if(hood?.scale && hood?.position){
                hood.scale.z=1-deformation*.26;
                hood.scale.y=1-deformation*.29;
                hood.position.z=.8-deformation*.18;
                hood.position.y=-deformation*.095;
            }
        }
        if(car.trunkPivot){
            const deformation=Math.max(z.rear,stage.intensity*.25);
            car.trunkPivot.rotation.x=Math.min(.48,deformation*.40);
            car.trunkPivot.rotation.z=-z.sideLean*.25;
            const trunk=car.trunkPivot.children?.[0];
            if(trunk?.scale&&trunk?.position){
                trunk.scale.z=1-deformation*.19;
                trunk.position.z=-.8+deformation*.14;
            }
        }
        if(car.frontBumperMesh)
            car.frontBumperMesh.visible=!car.breakawayFlags?.front;
        if(car.rearBumperMesh)
            car.rearBumperMesh.visible=!car.breakawayFlags?.rear;
        if(car.damageParts.cracks)
            car.damageParts.cracks.visible=stage.glass ||
                z.front>.53 || z.rear>.7;
        if (car.damageParts.engineGlow) {
            car.damageParts.engineGlow.visible = stage.critical;
            const pulse = 0.78 + Math.abs(Math.sin((car.motionClock || 0) * 9)) * 0.22;
            car.damageParts.engineGlow.scale.set(pulse, pulse, pulse);
        }
    }
}
