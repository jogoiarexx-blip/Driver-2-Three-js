        /**
         * ============================================================================
         * MÓDULO 4: CONTROLADOR DE JOHN TANNER A PÉ (3ª PESSOA + ANIMAÇÃO DE PASSOS)
         * ============================================================================
         */
        class TannerController {
            constructor(scene) {
                this.scene = scene;
                this.group = new THREE.Group();
                this.heading = 0;
                this.walkCycle = 0;
                this.isSitting = false;
                this.isSwimming = false;
                this.swimClock = 0;
                this.vehicleBoneRig=null;
                this.motorcycleVehicle=null;
                this.motorcycleDynamics=null;
                this.motorcycleContactReport=null;
                this.motorcycleContactBlend=0;
                this.motorcycleExitBlend=1;

                if(typeof DriverFakeShadows!=='undefined') {
                    this.contactShadow=DriverFakeShadows.create(1.25,1.8);
                    this.group.add(this.contactShadow);
                }
                this.buildTannerMesh();
                this.loadPlayerModel();
                this.scene.add(this.group);
                this.setVisible(false);
            }

            buildTannerMesh() {
                const jacketMat = new THREE.MeshLambertMaterial({ color: 0x451a03 }); // Jaqueta de couro marrom clássica do Tanner
                const jeansMat = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 });
                const skinMat = new THREE.MeshLambertMaterial({ color: 0xfdba74 });
                const hairMat = new THREE.MeshLambertMaterial({ color: 0x27272a });

                // Torso
                this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.32), jacketMat);
                this.torso.position.y = 1.15;
                this.group.add(this.torso);

                // Cabeça + Cabelo anos 70/90
                this.head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skinMat);
                this.head.position.y = 1.72;
                const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.38), hairMat);
                hair.position.y = 0.14;
                this.head.add(hair);
                this.group.add(this.head);

                // Braços articulados
                const armGeo = new THREE.BoxGeometry(0.18, 0.62, 0.18);
                this.leftArm = new THREE.Mesh(armGeo, jacketMat);
                this.leftArm.position.set(-0.38, 1.12, 0);
                this.rightArm = new THREE.Mesh(armGeo, jacketMat);
                this.rightArm.position.set(0.38, 1.12, 0);
                this.group.add(this.leftArm, this.rightArm);

                // Pernas articuladas
                const legGeo = new THREE.BoxGeometry(0.22, 0.72, 0.22);
                this.leftLeg = new THREE.Mesh(legGeo, jeansMat);
                this.leftLeg.position.set(-0.15, 0.42, 0);
                this.rightLeg = new THREE.Mesh(legGeo, jeansMat);
                this.rightLeg.position.set(0.15, 0.42, 0);
                this.group.add(this.leftLeg, this.rightLeg);
            }

            loadPlayerModel() {
                if (!THREE.GLTFLoader) {
                    console.error('Tanner: GLTFLoader indisponível.');
                    return;
                }
                const url = window.DRIVER_TANNER_MODEL_URL ||
                    './assets/player/Tanner.glb';
                const loader = new THREE.GLTFLoader();
                loader.load(url, gltf => {
                    const model = gltf.scene;
                    model.updateMatrixWorld(true);
                    const bounds = new THREE.Box3().setFromObject(model);
                    const size = bounds.getSize(new THREE.Vector3());
                    if (!Number.isFinite(size.y) || size.y < .001) {
                        console.error('Tanner: GLB sem geometria visível.', url);
                        return;
                    }
                    model.scale.multiplyScalar(1.9 / size.y);
                    model.updateMatrixWorld(true);
                    const b = new THREE.Box3().setFromObject(model);
                    model.position.y -= b.min.y;
                    model.position.x -= (b.min.x + b.max.x) / 2;
                    model.position.z -= (b.min.z + b.max.z) / 2;
                    model.traverse(obj => {
                        if (obj.isMesh || obj.isSkinnedMesh) {
                            obj.castShadow = true;
                            obj.receiveShadow = true;
                            obj.frustumCulled = false;
                        }
                    });
                    this.group.add(model);
                    this.playerModel = model;
                    // O esqueleto Mixamo original, sem clonar o GLB.
                    this.vehicleBoneRig=typeof DriverTannerVehicleRig!=='undefined'?
                        DriverTannerVehicleRig.bind(model):null;
                    for (const part of [this.torso, this.head, this.leftArm,
                        this.rightArm, this.leftLeg, this.rightLeg]) {
                        part.visible = false;
                    }
                    this.animations = gltf.animations || [];
                    // Mixamo Swim_Forward / Swim_Idle from homem velho.glb.
                    // Keep Tanner's own model, skeleton, and clothing intact.
                    if (typeof DriverTannerSwimAnimations !== 'undefined') {
                        try {
                            this.animations = this.animations.concat(
                                DriverTannerSwimAnimations.build(model));
                        } catch (error) {
                            console.warn('Tanner: retargeting de nado falhou',
                                error);
                        }
                    }
                    if (this.animations.length) {
                        this.animationMixer = new THREE.AnimationMixer(model);
                        this.playModelAnimation('idle');
                    }
                    console.info('Tanner GLB aplicado:', url,
                        'animações:', this.animations.map(a => a.name));
                }, undefined, error => {
                    console.error('Tanner GLB não carregou:', url,
                        error?.message || error);
                });
            }

            playModelAnimation(name) {
                if (!this.animationMixer || !this.animations) return;
                const clips = this.animations;
                const clip = name === 'idle'
                    ? clips.find(a => /^(idle|stand|breathing)/i.test(a.name))
                    : name === 'swim_idle' || name === 'swim_forward'
                    ? clips.find(a => a.name === name)
                    : clips.find(a => /^walk/i.test(a.name)) ||
                      clips.find(a => /^run/i.test(a.name));
                if (!clip) {
                    if (this.activeAction) {
                        this.activeAction.fadeOut(.15);
                        this.activeAction = null;
                        this.activeClip = null;
                    }
                    return;
                }
                if (this.activeClip === clip) return;
                const fade = /^swim/.test(name) ||
                    /^swim/.test(this.activeClip?.name || '') ? .28 : .15;
                if (this.activeAction) this.activeAction.fadeOut(fade);
                this.activeAction = this.animationMixer.clipAction(clip);
                this.activeAction.reset().fadeIn(fade).play();
                this.activeClip = clip;
            }

            // Pose temporizada, também disponível quando o GLB não contém
            // animações específicas de abrir porta ou montar motocicleta.
            // Não altera rig, pesos ou física, evitando deformações no Tanner.
            applyVehicleTransitionPose(style,kind,progress,dt=0,mountSide=-1) {
                const t=Math.max(0,Math.min(1,progress));
                const bike=style==='motorcycle';
                const entering=kind==='enter';
                const motion=Math.sin(Math.PI*t);
                const rise=bike?Math.sin(Math.PI*Math.max(0,Math.min(1,
                    (t-.30)/.53))):0;
                const side=entering?-1:1;
                if(this.vehicleBoneRig&&
                    typeof DriverTannerVehicleRig!=='undefined')
                    DriverTannerVehicleRig.restore(this.vehicleBoneRig);
                if(this.animationMixer) {
                    this.playModelAnimation(kind!=='ride'&&t<.26?'walk':'idle');
                    this.animationMixer.update(Math.max(0,Math.min(.08,dt)));
                }
                this.group.rotation.x=-(bike?.18:.14)*motion;
                this.group.rotation.z=side*(bike?.19:.10)*motion;
                this.leftArm.rotation.x=-(bike?.95:.7)*motion;
                this.rightArm.rotation.x=-(bike?.8:.4)*motion;
                this.leftLeg.rotation.x=(bike?1.28:.55)*Math.max(motion,rise);
                this.rightLeg.rotation.x=-(bike?.45:.22)*motion;
                if(this.vehicleBoneRig&&
                    typeof DriverTannerVehicleRig!=='undefined')
                    DriverTannerVehicleRig.apply(this.vehicleBoneRig,
                        style,kind,t,mountSide);
                if(this.playerModel&&!this.vehicleBoneRig) {
                    if(!this._modelMountBase) {
                        this._modelMountBase={
                            x:this.playerModel.rotation.x,
                            z:this.playerModel.rotation.z
                        };
                    }
                    // Para modelos sem clip de montagem, curvar o corpo
                    // sem mudar o comprimento dos membros/esqueleto.
                    this.playerModel.rotation.x=this._modelMountBase.x-
                        (bike?.13:.09)*motion;
                    this.playerModel.rotation.z=this._modelMountBase.z+
                        side*(bike?.08:.05)*motion;
                }
            }

            resetVehicleTransitionPose() {
                if(this.vehicleBoneRig&&
                    typeof DriverTannerVehicleRig!=='undefined')
                    DriverTannerVehicleRig.restore(this.vehicleBoneRig);
                this.group.rotation.x=0;
                this.group.rotation.z=0;
                for(const limb of [this.leftArm,this.rightArm,
                    this.leftLeg,this.rightLeg])
                    if(limb)limb.rotation.x=0;
                if(this.playerModel && this._modelMountBase) {
                    this.playerModel.rotation.x=this._modelMountBase.x;
                    this.playerModel.rotation.z=this._modelMountBase.z;
                }
                this._modelMountBase=null;
                if(this.playerModel)this.playModelAnimation('idle');
            }

            mountOnMotorcycle(vehicle) {
                if(!vehicle?.chassisTilt||!this.vehicleBoneRig||
                    !this.playerModel||this.motorcycleVehicle)return false;
                this.resetVehicleTransitionPose();
                if(this.contactShadow)this.contactShadow.visible=false;
                vehicle.chassisTilt.add(this.group);
                this.group.position.set(0,0,-.30);
                this.group.rotation.set(0,0,0);
                this.heading=0;
                this.motorcycleVehicle=vehicle;
                this.motorcycleDynamics=null;
                this.motorcycleContactReport=null;
                this.motorcycleContactBlend=0;
                this.motorcycleExitBlend=1;
                this.group.userData.driverPlayerRider=true;
                this.group.visible=true;
                this.applyVehicleTransitionPose('motorcycle','ride',1,0);
                return true;
            }

            updateMotorcycleRidePose(dt) {
                if(!this.motorcycleVehicle||!this.vehicleBoneRig)return;
                const seconds=Math.max(0,Math.min(.08,Number(dt)||0));
                this.applyVehicleTransitionPose('motorcycle','ride',1,seconds);
                if(typeof DriverMotorcycleContactIK!=='undefined'){
                    this.motorcycleDynamics=DriverMotorcycleContactIK.signals(
                        this.motorcycleDynamics,this.motorcycleVehicle,seconds);
                    // A postura de pilotagem entra em ~240ms e é retirada
                    // gradualmente antes da perna deixar o banco.
                    this.motorcycleContactBlend=Math.min(1,
                        (this.motorcycleContactBlend||0)+seconds*4.2);
                    this.motorcycleContactReport=DriverMotorcycleContactIK.apply(
                        this,this.motorcycleVehicle,this.motorcycleDynamics,
                        this.motorcycleContactBlend*
                        Math.max(0,Math.min(1,this.motorcycleExitBlend)));
                }
            }

            detachFromMotorcycle() {
                if(!this.motorcycleVehicle)return false;
                this.resetVehicleTransitionPose();
                // Scene.add restaura a propriedade da entidade Tanner e evita
                // que o descarte do veículo libere seu material/esqueleto.
                this.scene.add(this.group);
                if(this.contactShadow)this.contactShadow.visible=true;
                delete this.group.userData.driverPlayerRider;
                this.motorcycleVehicle=null;
                this.motorcycleDynamics=null;
                this.motorcycleContactReport=null;
                this.motorcycleContactBlend=0;
                this.motorcycleExitBlend=1;
                this.group.rotation.set(0,0,0);
                this.group.visible=false;
                return true;
            }

            setVisible(visible) {
                this.group.visible = visible;
            }

            setPosition(x, y, z, heading = 0) {
                this.group.position.set(x, y, z);
                this.heading = heading;
                this.isSwimming = false;
                this.group.rotation.y = heading;
            }

            toggleSitOnBench(benchPos) {
                if (this.isSitting) {
                    this.isSitting = false;
                    this.torso.position.y = 1.15;
                    this.head.position.y = 1.72;
                    this.leftLeg.rotation.x = 0;
                    this.rightLeg.rotation.x = 0;
                    return false;
                } else {
                    this.isSitting = true;
                    this.group.position.set(benchPos.x, 0.15, benchPos.z + 0.35);
                    this.torso.position.y = 0.85;
                    this.head.position.y = 1.42;
                    this.leftLeg.rotation.x = -Math.PI / 2;
                    this.rightLeg.rotation.x = -Math.PI / 2;
                    return true;
                }
            }

            update(dt, input, cityBuilder) {
                if (!this.group.visible) return;
                if (this.animationMixer) {
                    if(this.vehicleBoneRig&&
                        typeof DriverTannerVehicleRig!=='undefined')
                        DriverTannerVehicleRig.restore(this.vehicleBoneRig);
                    this.animationMixer.update(Math.min(dt, 0.08));
                }

                // Se Tanner estiver sentado no banco e o jogador tentar andar, levanta automaticamente
                if (this.isSitting) {
                    if (input.up || input.down || input.left || input.right) {
                        this.toggleSitOnBench();
                    } else {
                        return;
                    }
                }

                const turnSpeed = 3.2;
                // +X aparece à esquerda na câmera de perseguição Three.js.
                if (input.left) this.heading += turnSpeed * dt;
                if (input.right) this.heading -= turnSpeed * dt;
                this.group.rotation.y = this.heading;

                let moveDir = 0;
                if (input.up) moveDir = 1;
                else if (input.down) moveDir = -0.65;

                const isWater = (x,z) =>
                    typeof cityBuilder?.isWaterAt === 'function' &&
                    cityBuilder.isWaterAt(x,z);
                const wetBefore = isWater(this.group.position.x,
                    this.group.position.z);
                const wasSwimming = this.isSwimming;
                // Swimming moves more slowly than running on the sidewalk.
                const speed = wetBefore ?
                    (input.sprint ? 5.2 : 3.9) :
                    (input.sprint ? 12.5 : 8.5);
                const velocity = speed * moveDir;

                if (Math.abs(moveDir) > 0) {
                    const nextX = this.group.position.x +
                        Math.sin(this.heading)*velocity*dt;
                    const nextZ = this.group.position.z +
                        Math.cos(this.heading)*velocity*dt;
                    // Water surface is at 0.06; the bed is -4.0. Collision
                    // should use swimmer height so quay walls still block.
                    const targetY = isWater(nextX,nextZ) ? -0.76 :
                        cityBuilder.getGroundHeightAt(
                            nextX,nextZ,this.group.position.y);
                    if (!cityBuilder.isPointBlocked(nextX,nextZ,0.55,targetY)) {
                        this.group.position.x = nextX;
                        this.group.position.z = nextZ;
                        this.group.position.y = targetY;
                    }
                }

                this.isSwimming = isWater(this.group.position.x,
                    this.group.position.z);
                if (this.isSwimming) {
                    this.swimClock += dt*(Math.abs(moveDir)>0.01?4:2);
                    this.group.position.y = -0.76 +
                        Math.sin(this.swimClock*2)*0.045;
                    if (this.contactShadow)this.contactShadow.visible=false;
                    if (this.playerModel)this.playModelAnimation(
                        Math.abs(moveDir)>0.01?'swim_forward':'swim_idle');
                    // Procedural fallback is visible only while GLB loads.
                    const kick=Math.sin(this.swimClock*2)*0.4;
                    this.leftLeg.rotation.x=kick;
                    this.rightLeg.rotation.x=-kick;
                    this.leftArm.rotation.x=-0.7-kick;
                    this.rightArm.rotation.x=-0.7+kick;
                } else {
                    if(wasSwimming)this.group.position.y=
                        cityBuilder.getGroundHeightAt(
                            this.group.position.x,this.group.position.z,
                            this.group.position.y);
                    if(this.contactShadow&&!this.motorcycleVehicle)
                        this.contactShadow.visible=true;
                    if(this.playerModel)this.playModelAnimation(
                        Math.abs(moveDir)>0.01?'walk':'idle');
                    if(Math.abs(moveDir)>0){
                        this.walkCycle+=dt*(input.sprint?16:11);
                        const swing=Math.sin(this.walkCycle)*0.65;
                        this.leftLeg.rotation.x=swing;
                        this.rightLeg.rotation.x=-swing;
                        this.leftArm.rotation.x=-swing*0.8;
                        this.rightArm.rotation.x=swing*0.8;
                    }else{
                        this.leftLeg.rotation.x=0;
                        this.rightLeg.rotation.x=0;
                        this.leftArm.rotation.x=0;
                        this.rightArm.rotation.x=0;
                    }
                }
            }
        }

