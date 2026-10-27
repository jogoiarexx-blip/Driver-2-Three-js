        /**
         * ============================================================================
         * MÓDULO 3: EFEITOS DE DRIFT, MARCAS DE PNEU PERSISTENTES E CALOTAS VOANDO
         * ============================================================================
         */
        class EffectsManager {
            constructor(scene) {
                this.scene = scene;
                this.skidMarks = [];
                this.maxSkidMarks = 260;
                this.smokeParticles = [];
                this.flyingHubcaps = [];
                this.breakawayPieces = [];
                this.breakawayGeometry = new THREE.BoxGeometry(1.7,0.16,0.28);
                this.maxBreakawayPieces=40;

                // Faíscas reutilizáveis: nenhum novo Mesh/material em cada impacto.
                this.impactSparks = [];
                this.sparkGeometry = new THREE.BoxGeometry(0.16, 0.16, 0.16);
                this.sparkMaterial = new THREE.MeshBasicMaterial({color:0xffd66b});
                for (let i = 0; i < 22; i++) {
                    const mesh = new THREE.Mesh(this.sparkGeometry, this.sparkMaterial);
                    mesh.visible = false;
                    this.scene.add(mesh);
                    this.impactSparks.push({
                        mesh, life:0, vx:0, vy:0, vz:0
                    });
                }

                // Geometria compartilhada para performance máxima
                this.skidGeo = new THREE.PlaneGeometry(0.65, 1.9);
                this.skidGeo.rotateX(-Math.PI / 2);
                this.skidMat = new THREE.MeshBasicMaterial({
                    color: 0x090a0f,
                    transparent: true,
                    opacity: 0.65,
                    depthWrite: false
                });

                this.smokeGeo = typeof THREE.SphereGeometry==='function' ?
                    new THREE.SphereGeometry(0.43, 7, 5) :
                    new THREE.BoxGeometry(0.6, 0.6, 0.6);
                this.smokeMat = new THREE.MeshBasicMaterial({
                    color: 0xd1d5db,
                    transparent: true,
                    opacity: 0.55
                });

                this.hubcapGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 10);
                this.hubcapMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });

                // Sistema de Chuva 3D e Explosão C4
                this.rainEnabled = false;
                this.rainDrops = [];
                this.explosions = [];
                this.initRainSystem();
            }

            initRainSystem() {
                const rainGeo = new THREE.BufferGeometry();
                const count = 750;
                const positions = new Float32Array(count * 3);
                for (let i = 0; i < count * 3; i += 3) {
                    positions[i] = (Math.random() - 0.5) * 90;
                    positions[i + 1] = Math.random() * 35;
                    positions[i + 2] = (Math.random() - 0.5) * 90;
                }
                rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                const rainMat = new THREE.PointsMaterial({
                    color: 0xbae6fd,
                    size: 0.35,
                    transparent: true,
                    opacity: 0.65
                });
                this.rainPoints = new THREE.Points(rainGeo, rainMat);
                this.rainPoints.visible = false;
                this.scene.add(this.rainPoints);
            }

            spawnMassiveExplosion(x, y, z) {
                const colors = [0xef4444, 0xf97316, 0xfacc15, 0x1f2937];
                for (let i = 0; i < 36; i++) {
                    const mat = new THREE.MeshBasicMaterial({
                        color: colors[i % colors.length],
                        transparent: true,
                        opacity: 0.95
                    });
                    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), mat);
                    mesh.position.set(x, y + 1.0, z);
                    this.scene.add(mesh);
                    this.explosions.push({
                        mesh,
                        vx: (Math.random() - 0.5) * 32,
                        vy: 6 + Math.random() * 26,
                        vz: (Math.random() - 0.5) * 32,
                        life: 1.4 + Math.random() * 0.6
                    });
                }
            }

            spawnImpactSparks(x, y, z, severity = 0.6) {
                const amount = Math.min(9, Math.max(3, Math.round(severity * 10)));
                let emitted=0;
                for (const spark of this.impactSparks) {
                    if (spark.life>0) continue;
                    spark.life = 0.28 + Math.random()*0.22;
                    const angle=Math.random()*Math.PI*2;
                    const speed=(3+Math.random()*7)*Math.max(0.25,severity);
                    spark.vx=Math.cos(angle)*speed;
                    spark.vz=Math.sin(angle)*speed;
                    spark.vy=4+Math.random()*5;
                    spark.mesh.position.set(x,y+0.65,z);
                    spark.mesh.scale.set(1,1,1);
                    spark.mesh.visible=true;
                    if (++emitted>=amount) break;
                }
                return emitted;
            }

            addSkidMark(x, z, angle) {
                let mesh;
                if (this.skidMarks.length >= this.maxSkidMarks) {
                    mesh = this.skidMarks.shift();
                } else {
                    mesh = new THREE.Mesh(this.skidGeo, this.skidMat);
                    this.scene.add(mesh);
                }
                mesh.position.set(x, 0.04, z);
                mesh.rotation.y = angle;
                this.skidMarks.push(mesh);
            }

            spawnTireSmoke(x, y, z, isDarkEngineSmoke = false, tint = null) {
                if (this.smokeParticles.length > 50) return;
                const mat = this.smokeMat.clone();
                if (isDarkEngineSmoke) mat.color.setHex(0x1f2937);
                if(tint!=null)mat.color.setHex(tint);
                const mesh = new THREE.Mesh(this.smokeGeo, mat);
                mesh.position.set(
                    x + (Math.random() - 0.5) * 0.6,
                    y + 0.25,
                    z + (Math.random() - 0.5) * 0.6
                );
                this.scene.add(mesh);
                this.smokeParticles.push({
                    mesh,
                    life: 0.55,
                    maxLife: 0.55,
                    vy: 1.5 + Math.random() * 1.2
                });
            }

            // Peças estilizadas independentes da topologia do GLB: não
            // desmonta a textura, os ossos ou a geometria compartilhada.
            // A peça original procedural é ocultada quando existe.
            spawnCarBreakaway(car,zone,impactSpeed){
                const allowed=['front','rear','left','right'];
                if(!car || !allowed.includes(zone) ||
                    !Number.isFinite(impactSpeed) || impactSpeed<24)
                    return false;
                const limit=zone==='front'||zone==='rear'?26:30;
                if((car.damageZones?.[zone]||0)<limit)return false;
                if(!car.breakawayFlags)car.breakawayFlags={};
                if(car.breakawayFlags[zone])return false;
                car.breakawayFlags[zone]=true;
                if(zone==='front' && car.frontBumperMesh)
                    car.frontBumperMesh.visible=false;
                if(zone==='rear' && car.rearBumperMesh)
                    car.rearBumperMesh.visible=false;
                if(this.breakawayPieces.length>=this.maxBreakawayPieces){
                    const old=this.breakawayPieces.shift();
                    this.scene.remove(old.mesh);
                    old.mesh.material.dispose();
                }
                const material=new THREE.MeshLambertMaterial({
                    color:zone==='front'||zone==='rear'?0x949aa5:
                        (Number.isFinite(car.color)?car.color:0x737f8d)
                });
                const mesh=new THREE.Mesh(this.breakawayGeometry,material);
                const side=zone==='left'?-1:zone==='right'?1:0;
                const front=zone==='front'?2.45:zone==='rear'?-2.45:0;
                const sine=Math.sin(car.heading||0),cosine=Math.cos(car.heading||0);
                mesh.position.set(
                    car.x+sine*front+cosine*side*1.1,
                    (car.y||0)+.65,
                    car.z+cosine*front-sine*side*1.1
                );
                mesh.rotation.y=car.heading||0;
                this.scene.add(mesh);
                const impulse=Math.min(13,2+impactSpeed*.19);
                this.breakawayPieces.push({
                    mesh,life:4.6,
                    vx:sine*(car.speed||0)*.42+cosine*side*impulse+
                        sine*(front?Math.sign(front)*impulse:0),
                    vy:3.7+impulse*.35,
                    vz:cosine*(car.speed||0)*.42-sine*side*impulse+
                        cosine*(front?Math.sign(front)*impulse:0),
                    spin:(side||Math.sign(front)||1)*(4+impulse*.28)
                });
                return true;
            }

            spawnWaterSplash(x,y,z){
                // Reaproveita sistema e orçamento de partículas existente.
                for(let i=0;i<10;i++){
                    this.spawnTireSmoke(
                        x+(Math.random()-.5)*3,
                        y+.1,
                        z+(Math.random()-.5)*3,
                        false,0x93c5fd
                    );
                }
            }

            ejectHubcap(x, y, z, vx, vz, audio) {
                const mesh = new THREE.Mesh(this.hubcapGeo, this.hubcapMat);
                mesh.position.set(x, y + 0.35, z);
                mesh.rotation.z = Math.PI / 2;
                this.scene.add(mesh);
                if (audio) audio.playHubcapPing();
                this.flyingHubcaps.push({
                    mesh,
                    vx: vx + (Math.random() - 0.5) * 6,
                    vy: 4.5 + Math.random() * 3,
                    vz: vz + (Math.random() - 0.5) * 6,
                    life: 8.0
                });
            }

            update(dt) {
                for (const spark of this.impactSparks) {
                    if (spark.life<=0) continue;
                    spark.life=Math.max(0,spark.life-dt);
                    if (spark.life===0) {
                        spark.mesh.visible=false;
                        continue;
                    }
                    spark.vy-=18*dt;
                    spark.mesh.position.x+=spark.vx*dt;
                    spark.mesh.position.y+=spark.vy*dt;
                    spark.mesh.position.z+=spark.vz*dt;
                    const scale=Math.max(0.12,Math.min(1,spark.life*2.8));
                    spark.mesh.scale.set(scale,scale,scale);
                }
                // Atualiza fumaça de pneu / motor danificado
                for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
                    const p = this.smokeParticles[i];
                    p.life -= dt;
                    if (p.life <= 0) {
                        this.scene.remove(p.mesh);
                        p.mesh.material.dispose();
                        this.smokeParticles.splice(i, 1);
                    } else {
                        p.mesh.position.y += p.vy * dt;
                        const scale = 1 + (1 - p.life / p.maxLife) * 2.2;
                        p.mesh.scale.set(scale, scale, scale);
                        p.mesh.material.opacity = (p.life / p.maxLife) * 0.5;
                    }
                }

                // Fragmentos de carroceria limitados em memória/GPU.
                for(let i=this.breakawayPieces.length-1;i>=0;i--){
                    const p=this.breakawayPieces[i];
                    p.life-=dt;
                    if(p.life<=0){
                        this.scene.remove(p.mesh);
                        p.mesh.material.dispose();
                        this.breakawayPieces.splice(i,1);
                        continue;
                    }
                    p.vy-=19*dt;
                    p.mesh.position.x+=p.vx*dt;
                    p.mesh.position.y+=p.vy*dt;
                    p.mesh.position.z+=p.vz*dt;
                    p.mesh.rotation.x+=p.spin*dt;
                    p.mesh.rotation.z+=p.spin*.6*dt;
                    if(p.mesh.position.y<.16){
                        p.mesh.position.y=.16;
                        p.vy=Math.abs(p.vy)*.23;
                        p.vx*=.86;p.vz*=.86;
                    }
                }

                // Atualiza calotas voando com gravidade e quique no asfalto
                for (let i = this.flyingHubcaps.length - 1; i >= 0; i--) {
                    const h = this.flyingHubcaps[i];
                    h.life -= dt;
                    h.vy -= 14.0 * dt;
                    h.mesh.position.x += h.vx * dt;
                    h.mesh.position.y += h.vy * dt;
                    h.mesh.position.z += h.vz * dt;
                    h.mesh.rotation.x += 12 * dt;
                    h.mesh.rotation.y += 8 * dt;

                    if (h.mesh.position.y < 0.3) {
                        h.mesh.position.y = 0.3;
                        h.vy = -h.vy * 0.55;
                        h.vx *= 0.85;
                        h.vz *= 0.85;
                    }
                    if (h.life <= 0) {
                        this.scene.remove(h.mesh);
                        this.flyingHubcaps.splice(i, 1);
                    }
                }

                // Atualiza Explosões C4
                for (let i = this.explosions.length - 1; i >= 0; i--) {
                    const ex = this.explosions[i];
                    ex.life -= dt;
                    ex.vy -= 18 * dt;
                    ex.mesh.position.x += ex.vx * dt;
                    ex.mesh.position.y += ex.vy * dt;
                    ex.mesh.position.z += ex.vz * dt;
                    ex.mesh.rotation.x += 5 * dt;
                    ex.mesh.rotation.y += 5 * dt;
                    const s = Math.max(0.2, ex.life * 2.2);
                    ex.mesh.scale.set(s, s, s);
                    if (ex.mesh.position.y < 0.5) {
                        ex.mesh.position.y = 0.5;
                        ex.vy = -ex.vy * 0.4;
                    }
                    if (ex.life <= 0) {
                        this.scene.remove(ex.mesh);
                        this.explosions.splice(i, 1);
                    }
                }
            }

            updateRain(dt, playerPos) {
                if (!this.rainPoints) return;
                this.rainPoints.visible = this.rainEnabled;
                if (!this.rainEnabled) return;

                this.rainPoints.position.set(playerPos.x, 0, playerPos.z);
                const posAttr = this.rainPoints.geometry.attributes.position;
                for (let i = 1; i < posAttr.array.length; i += 3) {
                    posAttr.array[i] -= 38 * dt;
                    if (posAttr.array[i] < 0) {
                        posAttr.array[i] = 35;
                    }
                }
                posAttr.needsUpdate = true;
            }
        }

