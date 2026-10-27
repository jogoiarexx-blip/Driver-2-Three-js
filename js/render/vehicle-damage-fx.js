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

        group.add(scratches, dents, cracks, heavy);
        car.chassisTilt.add(group);
        car.damageGroup = group;
        car.damageParts = { scratches, dents, cracks, heavy };
        this.update(car);
    }

    static update(car) {
        if (!car || !car.damageParts) return;
        const stage = this.severity(car.damage);
        car.damageParts.scratches.visible = stage.scratches;
        car.damageParts.dents.visible = stage.dents;
        car.damageParts.cracks.visible = stage.glass;
        car.damageParts.heavy.visible = stage.critical;
    }
}
