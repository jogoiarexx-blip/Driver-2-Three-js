        /**
         * ============================================================================
         * MÓDULO 5: ENTIDADE DE VEÍCULO & FÍSICA MUSCLE-CAR ANOS 90
         * Inclui Botão Burnout (J-Turn), Capô/Porta-Malas Deformáveis e Sirene
         * ============================================================================
         */
        class DriverVehicle {
            constructor(scene, config) {
                this.scene = scene;
                this.name = config.name || '1970 Muscle V8';
                this.color = config.color || 0xd97706;
                this.bodyStyle = config.bodyStyle || 'muscle'; // 'muscle', 'bus', 'truck', 'limo'
                this.isPolice = !!config.isPolice;
                this.isTarget = !!config.isTarget;
                this.isSecret = !!config.isSecret;
                this.maxSpeed = config.maxSpeed || 52;
                this.accel = config.accel || 28;

                this.root = new THREE.Group();
                this.chassisTilt = new THREE.Group();
                this.root.add(this.chassisTilt);

                this.x = config.x || 0;
                this.y = 0;
                this.z = config.z || 0;
                this.vy = 0;
                this.heading = config.heading || 0;
                this.speed = 0;
                this.lateralVelocity = 0;
                this.isSubmerged=false;
                this.waterRecoveryClock=0;
                this.lastDryPosition=null;
                this.steerAngle = 0;
                this.pitchAngle = 0;
                this.rollAngle = 0;

                // Estado de Dano, Deformação e Calotas (Driver 2)
                this.damage = config.initialDamage || 0;
                this.damageZones = { front: 0, rear: 0, left: 0, right: 0 };
                this.breakawayFlags={front:false,rear:false,left:false,right:false};
                this.lastImpactZone = null;
                this.hubcaps = 4;
                this.hubcapMeshes=[];
                this.nextHubcapIndex=0;
                this.engineSmokeClock=0;
                this.isDrifting = false;
                this.isBurnout = false;
                this.sirenActive = false;
                this.sirenTimer = 0;

                this.hoodPivot = null;
                this.trunkPivot = null;
                this.wheels = [];
                this.wheelRig=null;
                this.wheelRigConfig=config.wheelRig||null;
                this.wheelSpin = 0;
                this.motionClock = 0;
                this._suspensionBaseY = 0;
                this.headlightsOn = false;
                this.brakeLightsOn = false;
                this._cc0ModelApplied = false;
                this._userCustomModel = false;
                this.buildCarMesh();
                this.updateTransform();
                this.scene.add(this.root);
            }

            buildCarMesh() {
                // Ao voltar ao visual PS1, não deixar uma dobradiça GLB
                // antiga ligada aos controles de entrada/saída.
                if(this.policeDoorRig &&
                    typeof DriverPoliceDoorRig!=='undefined')
                    DriverPoliceDoorRig.cancel(this);
                this.policeDoorRig=null;
                this._cc0ModelApplied = false;
                this._userCustomModel = false;
                this.hoodPivot = null;
                this.trunkPivot = null;
                this.sirenRed = null;
                this.sirenBlue = null;
                this.targetMarker = null;
                this.headlightBeams = null;
                this.lightsGroup = null;
                this.sirenAssembly = null;
                this.headlightMaterial = null;
                this.tailMaterial = null;
                this.reverseLightMaterial=null;
                this.turnSignalMaterials=null;
                this.damageGroup = null;
                this.damageParts = null;
                this.frontBumperMesh=null;
                this.rearBumperMesh=null;
                while (this.chassisTilt.children.length > 0) {
                    const old = this.chassisTilt.children[0];
                    GPUResourceUtils.disposeSubtree(old);
                    this.chassisTilt.remove(old);
                }
                this.wheels.forEach(w => {
                    GPUResourceUtils.disposeSubtree(w);
                    this.root.remove(w);
                });
                this.wheels = [];
                this.hubcapMeshes=[];
                this.wheelRig=null;

                const bodyMat = new THREE.MeshLambertMaterial({ color: this.color });
                this.bodyPaintMaterial = bodyMat;
                const secondaryMat = new THREE.MeshLambertMaterial({ color: this.isPolice ? 0xf8fafc : (this.isSecret ? 0xfacc15 : 0x18181b) });
                const glassMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
                const chromeMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });

                const zScale = (this.bodyStyle === 'bus') ? 1.55 : (this.bodyStyle === 'limo' ? 1.45 : (this.bodyStyle === 'truck' ? 1.32 : 1.0));
                this.chassisTilt.scale.set(1, 1, zScale);

                // Corpo central do chassi
                const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.72, 3.3), bodyMat);
                lowerBody.position.y = 0.72;
                lowerBody.castShadow = true;
                this.chassisTilt.add(lowerBody);

                // Geometria extra para Ônibus e Caminhão Baú (Exclusivos do Driver 2!)
                if (this.bodyStyle === 'bus') {
                    const busTop = new THREE.Mesh(new THREE.BoxGeometry(2.32, 1.15, 4.9), bodyMat);
                    busTop.position.set(0, 1.55, 0);
                    const busWindows = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.55, 4.6), glassMat);
                    busWindows.position.set(0, 1.68, 0);
                    this.chassisTilt.add(busTop, busWindows);
                } else if (this.bodyStyle === 'truck') {
                    const cargoBox = new THREE.Mesh(
                        new THREE.BoxGeometry(2.48, 1.85, 3.2),
                        new THREE.MeshLambertMaterial({
                            color:this.isSecret?this.color:0xf1f5f9
                        })
                    );
                    cargoBox.position.set(0, 1.75, -0.85);
                    this.chassisTilt.add(cargoBox);
                }

                // CAPÔ DIANTEIRO ARTICULADO (Abre/Amassa quando o carro bate!)
                this.hoodPivot = new THREE.Group();
                this.hoodPivot.position.set(0, 0.72, 0.95);
                const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(2.33, 0.70, 1.6), bodyMat);
                hoodMesh.position.set(0, 0, 0.8);
                this.hoodPivot.add(hoodMesh);

                // Blower Supercharger cromado no capô para o Carro Secreto!
                if (this.isSecret) {
                    const blower = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.85), chromeMat);
                    blower.position.set(0, 0.45, 0.75);
                    this.hoodPivot.add(blower);
                }
                this.chassisTilt.add(this.hoodPivot);

                // PORTA-MALAS TRASEIRO ARTICULADO (Abre/Amassa quando damage > 60%)
                this.trunkPivot = new THREE.Group();
                this.trunkPivot.position.set(0, 0.72, -0.95);
                const trunkMesh = new THREE.Mesh(new THREE.BoxGeometry(2.33, 0.70, 1.6), bodyMat);
                trunkMesh.position.set(0, 0, -0.8);
                this.trunkPivot.add(trunkMesh);
                this.chassisTilt.add(this.trunkPivot);

                // Faixa esportiva ou pintura branca nas portas da polícia
                if (this.isPolice) {
                    const doorPaint = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.65, 2.1), secondaryMat);
                    doorPaint.position.set(0, 0.72, 0);
                    this.chassisTilt.add(doorPaint);
                } else {
                    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.74, 3.32), secondaryMat);
                    stripe.position.y = 0.72;
                    this.chassisTilt.add(stripe);
                }

                // Cabine / Teto
                const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 2.35), this.isPolice ? secondaryMat : bodyMat);
                cabin.position.set(0, 1.35, -0.2);
                this.chassisTilt.add(cabin);

                // Para-brisas
                const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.52, 2.42), glassMat);
                windshield.position.set(0, 1.33, -0.2);
                this.chassisTilt.add(windshield);

                // Para-choques cromados dianteiro e traseiro
                const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.25, 0.25), chromeMat);
                frontBumper.position.set(0, 0.48, 2.58);
                const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.25, 0.25), chromeMat);
                rearBumper.position.set(0, 0.48, -2.58);
                this.chassisTilt.add(frontBumper, rearBumper);
                this.frontBumperMesh=frontBumper;
                this.rearBumperMesh=rearBumper;

                // Faróis dianteiros e lanternas traseiras
                const headlightMat = new THREE.MeshBasicMaterial({ color: 0x605735 });
                const taillightMat = new THREE.MeshBasicMaterial({ color: 0x6b171d });
                this.headlightMaterial = headlightMat;
                this.tailMaterial = taillightMat;
                this.lightsGroup = new THREE.Group();
                const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), headlightMat);
                hlLeft.position.set(-0.75, 0.78, 2.55);
                const hlRight = hlLeft.clone();
                hlRight.position.x = 0.75;

                // Feixes luminosos de farol no chão (Cone translúcido estilo PS1 Noturno)
                const beamGeo = new THREE.ConeGeometry(1.9, 9.5, 8, 1, true);
                beamGeo.rotateX(Math.PI / 2);
                const beamMat = new THREE.MeshBasicMaterial({
                    color: 0xfef08a,
                    transparent: true,
                    opacity: 0.16,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
                this.headlightBeams = new THREE.Mesh(beamGeo, beamMat);
                this.headlightBeams.position.set(0, 0.45, 7.2);
                this.headlightBeams.visible = this.headlightsOn;
                this.lightsGroup.add(this.headlightBeams);

                const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.1), taillightMat);
                tlLeft.position.set(-0.75, 0.78, -2.55);
                const tlRight = tlLeft.clone();
                tlRight.position.x = 0.75;
                // Lanternas auxiliares independentes: ré e piscas.
                // Funcionam também com um GLB customizado, pois lightsGroup
                // é preservado ao substituir a carroceria.
                const reverseMat=new THREE.MeshBasicMaterial({color:0x332d20});
                this.reverseLightMaterial=reverseMat;
                const revL=new THREE.Mesh(new THREE.BoxGeometry(.22,.14,.11),reverseMat);
                revL.position.set(-.33,.78,-2.60);
                const revR=revL.clone();revR.position.x=.33;
                const leftBlink=new THREE.MeshBasicMaterial({color:0x59320d});
                const rightBlink=new THREE.MeshBasicMaterial({color:0x59320d});
                this.turnSignalMaterials={left:leftBlink,right:rightBlink};
                for(const side of [-1,1]){
                    const mat=side<0?leftBlink:rightBlink;
                    for(const z of [-2.60,2.60]){
                        const turn=new THREE.Mesh(
                            new THREE.BoxGeometry(.20,.16,.12),mat);
                        turn.position.set(side*.99,.77,z);
                        this.lightsGroup.add(turn);
                    }
                }
                this.lightsGroup.add(hlLeft, hlRight, tlLeft, tlRight,revL,revR);
                this.chassisTilt.add(this.lightsGroup);

                // Giroflex Policial
                if (this.isPolice) {
                    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.3), chromeMat);
                    barBase.position.set(0, 1.72, -0.1);
                    this.sirenRed = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.28), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
                    this.sirenRed.position.set(-0.38, 1.78, -0.1);
                    this.sirenBlue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.28), new THREE.MeshBasicMaterial({ color: 0x2563eb }));
                    this.sirenBlue.position.set(0.38, 1.78, -0.1);
                    this.sirenAssembly = new THREE.Group();
                    this.sirenAssembly.add(barBase, this.sirenRed, this.sirenBlue);
                    this.chassisTilt.add(this.sirenAssembly);
                }

                // Seta indicadora acima do carro-alvo em missões
                if (this.isTarget) {
                    const coneGeo = new THREE.ConeGeometry(0.6, 1.2, 4);
                    coneGeo.rotateX(Math.PI);
                    this.targetMarker = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
                    this.targetMarker.position.set(0, 3.3, 0);
                    this.chassisTilt.add(this.targetMarker);
                }

                // 4 Rodas
                const wheelGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.36, 12);
                wheelGeo.rotateZ(Math.PI / 2);
                const tireMat = new THREE.MeshLambertMaterial({ color: 0x111827 });
                const capMat=new THREE.MeshLambertMaterial({color:0xc9cacc});
                const capGeo=new THREE.CylinderGeometry(.27,.27,.05,12);
                capGeo.rotateZ(Math.PI/2);

                const wheelPositions = [
                    { x: -1.18, y: 0.44, z: 1.55 },
                    { x: 1.18, y: 0.44, z: 1.55 },
                    { x: -1.18, y: 0.44, z: -1.55 },
                    { x: 1.18, y: 0.44, z: -1.55 }
                ];

                wheelPositions.forEach((pos,index) => {
                    const wMesh = new THREE.Mesh(wheelGeo, tireMat);
                    wMesh.position.set(pos.x, pos.y, pos.z);
                    const cap=new THREE.Mesh(capGeo,capMat);
                    cap.position.x=pos.x<0?-.205:.205;
                    cap.name='detachable-hubcap-'+index;
                    wMesh.add(cap);
                    this.hubcapMeshes.push(cap);
                    this.root.add(wMesh);
                    this.wheels.push(wMesh);
                });
                VehicleDamageFX.attach(this);
                VehicleVisuals.setHeadlights(this, this.headlightsOn);
            }


            applyCC0Model(modelScene, shared = true) {
                // Usuário pode substituir outro GLB manualmente. Apenas downloads
                // automáticos não podem sobrescrever uma importação pessoal.
                if (!modelScene || (this._userCustomModel && shared)) return false;
                const box = new THREE.Box3().setFromObject(modelScene);
                const size = box.getSize(new THREE.Vector3());
                if (!Number.isFinite(size.x + size.y + size.z) ||
                    Math.min(size.x, size.y, size.z) < 0.01) return false;

                // Ajuste ao chassi físico, sem criar um segundo carro sobre o original.
                const width = 2.45;
                const length = this.bodyStyle === 'truck' ? 6.6 : 5.15;
                const height = this.bodyStyle === 'truck' ? 3.3 : 2.05;
                const scale = Math.min(width / size.x, length / size.z, height / size.y);
                const preserved = [this.sirenAssembly, this.targetMarker, this.lightsGroup, this.damageGroup];
                this.chassisTilt.children.slice().forEach(child => {
                    if (!preserved.includes(child)) {
                        GPUResourceUtils.disposeSubtree(child);
                        this.chassisTilt.remove(child);
                    }
                });
                this.wheels.forEach(w => {
                    GPUResourceUtils.disposeSubtree(w);
                    this.root.remove(w);
                });
                this.wheels = [];
                this.hubcapMeshes=[];
                this.wheelRig=null;
                this.frontBumperMesh=null;
                this.rearBumperMesh=null;
                this.chassisTilt.scale.set(1, 1, 1);
                modelScene.scale.setScalar(scale);
                modelScene.position.set(
                    -(box.min.x + box.max.x) * 0.5 * scale,
                    0.34 - box.min.y * scale,
                    -(box.min.z + box.max.z) * 0.5 * scale
                );
                modelScene.traverse(obj => {
                    if (obj.isMesh) {
                        obj.frustumCulled = true;
                        obj.castShadow = false;
                        obj.userData.cc0SharedAsset = shared;
                    }
                });
                this.chassisTilt.add(modelScene);
                this.hoodPivot = null;
                this.trunkPivot = null;
                this._cc0ModelApplied = shared;
                VehicleVisuals.setHeadlights(this, this.headlightsOn);
                return true;
            }

            updatePhysics(dt, input, cityBuilder, effects, audio, isPlayer = false) {
                if(this.isSubmerged){
                    this.waterRecoveryClock=Math.max(0,this.waterRecoveryClock-dt);
                    this.speed=0;this.lateralVelocity=0;
                    this.y=Math.max(-2.7,this.y-1.4*dt);
                    if(this.waterRecoveryClock<=0){
                        const safe=this.lastDryPosition ||
                            {x:0,z:-80,heading:0};
                        this.x=safe.x;this.z=safe.z;
                        this.heading=safe.heading||0;
                        this.y=cityBuilder.getGroundHeightAt(this.x,this.z);
                        this.vy=0;this.isSubmerged=false;
                        this.prevX=this.x;this.prevZ=this.z;
                    }
                    this.updateTransform();
                    return;
                }
                const forwardThrottle = input.up ? 1 : (input.down ? -1 : 0);
                // Câmera Three.js atrás do carro: quando ele aponta para +Z,
                // +X fica à ESQUERDA da tela. Preservar a sensação original
                // de A/D; a IA usa o sentido matemático da via.
                const steerInput = isPlayer ?
                    (input.left ? 1 : 0) - (input.right ? 1 : 0) :
                    (input.right ? 1 : 0) - (input.left ? 1 : 0);
                const handbrake = !!input.handbrake;
                const burnoutKey = !!input.sprint; // Botão dedicado de Burnout (SHIFT / C)

                const armorFactor = this.isSecret ? 0.35 : 1.0;
                // A física agora está separada do desenho do carro, permitindo
                // ajuste/testes por subsistema sem comprometer o WebGL.
                const centrifugal = DriverArcadePhysics.update(
                    this, dt, forwardThrottle, steerInput, handbrake, burnoutKey
                );

                // Deformação Visual de Lataria (Capô e Porta-Malas abrindo/amassando com o Dano)
                if (this.hoodPivot && this.trunkPivot) {
                    if (this.damage > 35) {
                        const flap = Math.min(0.55, ((this.damage - 35) / 65) * 0.45) + Math.abs(Math.sin(Date.now() * 0.015)) * (Math.abs(this.speed) * 0.002);
                        this.hoodPivot.rotation.x = -flap;
                    } else {
                        this.hoodPivot.rotation.x = 0;
                    }
                    if (this.damage > 60) {
                        this.trunkPivot.rotation.x = Math.min(0.48, ((this.damage - 60) / 40) * 0.4);
                    } else {
                        this.trunkPivot.rotation.x = 0;
                    }
                }

                // Curvas extremas também podem arrancar uma calota real,
                // deixando a roda sem seu disco cromado.
                if(this.isDrifting&&this.hubcaps>0 &&
                    Math.abs(centrifugal)>.68&&
                    Math.random()<Math.min(.4,dt*.9))
                    this.loseHubcap(effects,
                        Math.cos(this.heading)*9*steerInput,
                        -Math.sin(this.heading)*9*steerInput,
                        isPlayer?audio:null);

                // 5. Deslocamento no mundo + Rampa da Ponte Levadiça
                const vx = Math.sin(this.heading) * this.speed + Math.cos(this.heading) * this.lateralVelocity;
                const vz = Math.cos(this.heading) * this.speed - Math.sin(this.heading) * this.lateralVelocity;

                this.prevX=this.x;
                this.prevZ=this.z;
                const nextX = this.x + vx * dt;
                const nextZ = this.z + vz * dt;

                // A inclinação de 10°..30° lança o carro somente quando ele
                // cruza a ponta das folhas, em velocidade suficiente.
                // Cooldown por veículo evita múltiplos impulsos no mesmo salto.
                this.chicagoBridgeJumpCooldown=Math.max(0,
                    (this.chicagoBridgeJumpCooldown||0)-dt);
                if(this.chicagoBridgeJumpCooldown<=0 &&
                    typeof DriverChicagoEastBridge!=='undefined'){
                    const impulse=DriverChicagoEastBridge.jumpVelocity(
                        cityBuilder,this.x,this.z,nextX,nextZ,
                        this.speed,this.y);
                    if(impulse>0){
                        this.vy=Math.max(this.vy||0,impulse);
                        this.chicagoBridgeJumpCooldown=1.25;
                    }
                }

                // Referência de altura evita teleporte de carros sob a
                // plataforma da ferrovia para o piso 11m acima.
                const groundBefore=cityBuilder.getGroundHeightAt(
                    this.x,this.z,this.y);
                const groundHeight=cityBuilder.getGroundHeightAt(
                    nextX,nextZ,this.y);
                const travel=Math.hypot(nextX-this.x,nextZ-this.z);
                const steepStep=groundHeight>groundBefore+
                    (.18+travel*.57) && groundHeight>this.y+.55;
                // Um salto genuíno só ocorre ao perder uma superfície
                // elevada enquanto vinha subindo, com velocidade suficiente.
                const lip=groundBefore-groundHeight>.55 &&
                    (this.surfaceSlope||0)>.07&&Math.abs(this.speed)>22;
                if(lip&&Math.abs(this.y-groundBefore)<.8){
                    this.vy=Math.min(7,Math.abs(this.speed)*
                        this.surfaceSlope*.40);
                }
                if(groundHeight>=groundBefore){
                    this.surfaceSlope=travel>.01?
                        Math.min(.75,Math.max(0,
                            (groundHeight-groundBefore)/travel)):0;
                }
                // A transição da rampa é resolvida por contacto com a
                // superfície. Nunca converter um degrau em vy=altura*18.
                if(this.y>groundHeight+.08 || this.vy>0){
                    this.vy=Math.max(-24,this.vy-24*dt);
                    this.y+=this.vy*dt;
                    if(this.y<=groundHeight && !steepStep){
                        if(this.vy < -10 && audio && isPlayer)
                            audio.playCrash(.6);
                        this.y=groundHeight;
                        this.vy=0;
                    }
                } else if(!steepStep) {
                    this.y=groundHeight;
                    this.vy=0;
                }
                if(cityBuilder.isWaterAt?.(nextX,nextZ)&&this.y<-.55){
                    this.isSubmerged=true;
                    this.waterRecoveryClock=1.3;
                    this.damage=Math.min(100,this.damage+9);
                    if(typeof effects?.spawnWaterSplash==='function')
                        effects.spawnWaterSplash(this.x,this.y,this.z);
                    if(isPlayer && audio?.playCrash)audio.playCrash(.6);
                }
                if(!cityBuilder.isWaterAt?.(this.x,this.z)&&
                    (this.z<=26||this.z>=74) &&
                    Math.abs(this.y-groundBefore)<.9 &&
                    !cityBuilder.isPointBlocked?.(this.x,this.z,2.2,this.y)){
                    this.lastDryPosition={
                        x:this.x,z:this.z,heading:this.heading
                    };
                }

                if (!steepStep &&
                    !cityBuilder.isPointBlocked(nextX, nextZ, 1.55, this.y)) {
                    this.x = nextX;
                    this.z = nextZ;
                } else {
                    // Deslizamento junto a paredes: permite avançar no eixo livre
                    // em vez de parar completamente numa quina.
                    const freeX = !steepStep &&
                        !cityBuilder.isPointBlocked(nextX,this.z,1.55,this.y);
                    const freeZ = !steepStep &&
                        !cityBuilder.isPointBlocked(this.x,nextZ,1.55,this.y);
                    if (freeX) this.x = nextX;
                    if (freeZ) this.z = nextZ;
                    const impactNow = performance.now();
                    const impactSpeed = Math.abs(this.speed) *
                        (freeX || freeZ ? 0.48 : 1);
                    if (impactSpeed > 8 && impactNow - (this.lastWallImpactAt || 0) > 450) {
                        this.lastWallImpactAt = impactNow;
                        // Pilares de aço do Lower Wacker causam dano superior
                        // às paredes comuns, com faíscas sob demanda.
                        const steelImpact=typeof DriverChicagoLowerWacker!=='undefined' &&
                            DriverChicagoLowerWacker.isPillarContact(
                                cityBuilder,nextX,nextZ,1.55);
                        this.damage = Math.min(100, this.damage +
                            impactSpeed * (steelImpact ? 0.56 : 0.30) * armorFactor);
                        if(steelImpact && effects?.spawnImpactSparks)
                            effects.spawnImpactSparks(
                                this.x,this.y+0.8,this.z,
                                Math.min(1,impactSpeed/38));
                        // Localiza o choque na lataria sem deslocar os colliders.
                        const collisionX = freeX ? 0 : vx;
                        const collisionZ = freeZ ? 0 : vz;
                        const contactLength = Math.hypot(collisionX,collisionZ);
                        if (contactLength>0.01) {
                            const zone=DriverVehicleCollisions.recordZone(this,
                                collisionX/contactLength,collisionZ/contactLength,
                                impactSpeed*armorFactor);
                            if(effects && typeof effects.spawnCarBreakaway==='function')
                                effects.spawnCarBreakaway(this,zone,impactSpeed);
                        }
                        if (audio && isPlayer) audio.playCrash(Math.min(1, impactSpeed / 35));
                        if(this.hubcaps>0&&impactSpeed>24)
                            this.loseHubcap(effects,-vx*.3,-vz*.3,
                                isPlayer?audio:null);
                    }
                    // Dissipa a energia contra a superfície, sem quicar para trás
                    // repetidamente a cada frame.
                    this.speed *= freeX || freeZ ? 0.84 : -0.20;
                    this.lateralVelocity *= 0.42;
                }

                // 6. Curvas fechadas em alta velocidade cantam pneu,
                // deixam marcas e soltam fumaça mesmo sem SHIFT/Espaço.
                const hardCorner = Math.abs(steerInput) > .45 &&
                    Math.abs(this.speed) > 22;
                const shouldSmoke = (this.isDrifting || hardCorner) &&
                    this.y < 0.3;
                if(shouldSmoke) {
                    this.skidFxClock=(this.skidFxClock||0)+dt;
                    const markNow=this.skidFxClock>=.075;
                    if(markNow)this.skidFxClock=0;
                    const rearLeftX = this.x - Math.sin(this.heading) * 1.5 - Math.cos(this.heading) * 1.05;
                    const rearLeftZ = this.z - Math.cos(this.heading) * 1.5 + Math.sin(this.heading) * 1.05;
                    const rearRightX = this.x - Math.sin(this.heading) * 1.5 + Math.cos(this.heading) * 1.05;
                    const rearRightZ = this.z - Math.cos(this.heading) * 1.5 - Math.sin(this.heading) * 1.05;

                    if(markNow){
                        effects.addSkidMark(rearLeftX,rearLeftZ,this.heading);
                        effects.addSkidMark(rearRightX,rearRightZ,this.heading);
                        // Até 18 partículas/segundo, independente de FPS.
                        if(Math.random()<(hardCorner?.72:.54)){
                            effects.spawnTireSmoke(rearLeftX,this.y,rearLeftZ,false);
                            effects.spawnTireSmoke(rearRightX,this.y,rearRightZ,false);
                        }
                    }
                }

                // Fumaça progressiva: vapor cinza a partir de 35%,
                // cinza escuro acima de 60%, preta em dano crítico.
                // Acumulador temporal para consistência entre 30/60FPS.
                const smokeRatio=Math.max(0,Math.min(1,
                    (this.damage-35)/65));
                if(smokeRatio>0){
                    this.engineSmokeClock+=Math.max(0,dt)*
                        (1+smokeRatio*5);
                    if(this.engineSmokeClock>=1){
                        this.engineSmokeClock%=1;
                        effects?.spawnTireSmoke?.(
                            this.x+Math.sin(this.heading)*1.9,
                            this.y+1.0,
                            this.z+Math.cos(this.heading)*1.9,
                            this.damage>=75,
                            this.damage<75?0x868686:null
                        );
                    }
                }else this.engineSmokeClock=0;

                // Giroflex da polícia piscando
                if (this.isPolice && this.sirenRed && this.sirenBlue) {
                    this.sirenTimer += dt * 10;
                    if (this.sirenActive) {
                        const flash = Math.sin(this.sirenTimer) > 0;
                        this.sirenRed.material.color.setHex(flash ? 0xff1111 : 0x450a0a);
                        this.sirenBlue.material.color.setHex(!flash ? 0x3b82f6 : 0x172554);
                    } else {
                        this.sirenRed.material.color.setHex(0x7f1d1d);
                        this.sirenBlue.material.color.setHex(0x1e3a8a);
                    }
                }

                if (this.targetMarker) {
                    this.targetMarker.rotation.y += dt * 3;
                    this.targetMarker.position.y = 3.2 + Math.sin(Date.now() * 0.008) * 0.35;
                }

                VehicleVisuals.update(this, dt, input);
                this.updateTransform();
            }

            loseHubcap(effects,vx=0,vz=0,audio=null){
                if(this.hubcaps<=0)return false;
                const index=this.nextHubcapIndex%4;
                this.nextHubcapIndex++;
                this.hubcaps--;
                if(this.hubcapMeshes[index])
                    this.hubcapMeshes[index].visible=false;
                effects?.ejectHubcap?.(this.x,this.y,this.z,vx,vz,audio);
                return true;
            }

            setPaintColor(hex) {
                this.color=hex;
                if(this._userCustomModel){
                    DriverUserCarPaint.setColor(this.chassisTilt,hex);
                } else if(this.bodyPaintMaterial &&
                    this.bodyPaintMaterial.color &&
                    !this._cc0ModelApplied){
                    this.bodyPaintMaterial.color.setHex(hex);
                }
            }

            updateTransform() {
                this.root.position.set(this.x, this.y, this.z);
                this.root.rotation.y = this.heading;
                if (this.wheels.length >= 2) {
                    this.wheels.forEach(w => { w.rotation.x = this.wheelSpin; });
                    this.wheels[0].rotation.y = this.steerAngle;
                    this.wheels[1].rotation.y = this.steerAngle;
                }
            }
        }

