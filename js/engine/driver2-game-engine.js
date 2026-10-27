        /**
         * ============================================================================
         * MÓDULO 7: MOTOR PRINCIPAL DO JOGO, FILM DIRECTOR REPLAY E DRIVING GAMES
         * ============================================================================
         */
        class Driver2GameEngine {
            constructor() {
                this.canvas = document.getElementById('game-canvas');
                this.radarCanvas = document.getElementById('radar-canvas');
                this.radarCtx = this.radarCanvas.getContext('2d');

                this.scene = new THREE.Scene();
                this.scene.background = new THREE.Color(0x1e293b);
                this.scene.fog = new THREE.FogExp2(0x1e293b, 0.0032);

                this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 620);
                this.cameraRig = new DriverCameraRig();
                this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

                this.ambientLight = new THREE.AmbientLight(0xf1f5f9, 0.75);
                this.sunLight = new THREE.DirectionalLight(0xfde68a, 0.85);
                this.sunLight.position.set(80, 140, 60);
                this.scene.add(this.ambientLight, this.sunLight);

                this.currentCityKey = 'chicago';
                this.audio = new RetroSynthAudio();
                this.effects = new EffectsManager(this.scene);
                this.impactFeedback = new DriverImpactFeedback();
                this.impactFlash = document.getElementById('impact-flash');
                this.reducedMotion = !!(window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
                this.city = new CityBuilder(this.scene, this.currentCityKey);
                this.trafficAI = new DriverTrafficAI(this.city);
                this.collisionSystem = new DriverVehicleCollisions();
                this.pursuitChapter = new DriverPursuitChapter();
                this.dropDirector=new DriverTailingDropMission();
                this.dropStatus=null;
                this.trainLine=new DriverChicagoTrain(this.scene,this.city);
                this.trainLostSeconds=0;
                this.homeSave=new DriverHomeSave(
                    (()=>{try{return window.localStorage}catch(e){return null}})()
                );
                this.completedMissions=new Set();
                this.interiorPlace=null;
                this.witnessCloseTime=0;
                this.tanner = new TannerController(this.scene);
                this.pedManager = new PedestrianAndRoadblockManager(this.scene);
                this.roadblockDirector = new PoliceRoadblockDirector();
                this.pedManager.spawnCityPedestrians();

                this.mode = 'driving';
                this.cameraMode = 0;
                this.radarWide = false;
                this.lookBackActive = false;
                this.weatherMode = 'default';
                this.felony = 0;
                this.roadblocksSpawned = false;
                this.missionType = 'freeroam';
                this.missionTimeLeft = 0;
                this.survivalElapsed = 0;
                this.tailOutOfRangeTimer = 0;
                this.c4State = { active: false, planted: false, timer: 15.0, beepAccum: 0, x: 0, z: 95 };
                this.c4TargetMesh = null;
                this.missionActive = false;
                this.gameEnded = false;

                // Checkpoints / Trailblazer Cones
                this.missionMarkers = [];
                this.markersCollected = 0;
                this.totalMarkers = 0;

                // Film Director Replay Buffer (grava até 600 frames)
                this.replayBuffer = [];
                this.inReplayMode = false;
                this.replayIndex = 0;
                this.directorCamType = 0; // 0: Tripod Street Cam, 1: Wheel Cam, 2: Helicopter Cam

                this.vehicles = [];
                this.playerCar = null;
                this.targetCar = null;
                this.secretCar = null;
                this.spawnAllVehicles();
                this.freeVehicleAssets = new FreeVehicleAssets(this);
                this.freeVehicleAssets.decorateFleet();

                this.input = { up: false, down: false, left: false, right: false, handbrake: false, sprint: false };
                this.bindEvents();

                this.currentVFSFile = 'assets/AssetManifest.json';
                this.selectVFSFile(this.currentVFSFile);

                this.lastTime = performance.now();
                this.frames = 0;
                this.fpsTimer = 0;
            }

            changeCity(cityKey) {
                if (!CITY_PRESETS[cityKey]) return;
                this.currentCityKey = cityKey;
                const preset = CITY_PRESETS[cityKey];

                this.scene.background.setHex(preset.skyColor);
                this.scene.fog.color.setHex(preset.skyColor);
                this.sunLight.color.setHex(preset.sunColor);

                this.city.loadCityPreset(cityKey);
                if(this.trainLine)this.trainLine.setCity(this.city);

                // Atualiza estilo dos botões de cidade na UI
                ['chicago', 'havana', 'vegas', 'rio'].forEach(k => {
                    const btn = document.getElementById(`city-btn-${k}`);
                    if (!btn) return;
                    if (k === cityKey) {
                        btn.className = 'city-pill text-[10px] font-extrabold py-1 px-1.5 rounded bg-amber-500 text-slate-950 border border-amber-300 transition';
                    } else {
                        btn.className = 'city-pill text-[10px] font-bold py-1 px-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600 transition';
                    }
                });

                document.getElementById('secret-status').textContent = 'BLOQUEADO';
                document.getElementById('secret-status').className = 'text-purple-400';

                this.startMission(this.missionType);
            }

            spawnAllVehicles() {
                this.vehicles.forEach(v => {
                    GPUResourceUtils.disposeSubtree(v.root);
                    this.scene.remove(v.root);
                });
                this.vehicles = [];
                if (this.trafficAI) this.trafficAI.reset();
                if (this.collisionSystem) this.collisionSystem.reset();
                this.targetCar = null;

                const preset = CITY_PRESETS[this.currentCityKey] || CITY_PRESETS.chicago;

                // 1. Carro Principal de John Tanner
                this.playerCar = new DriverVehicle(this.scene, {
                    name: preset.playerCarName,
                    color: preset.playerCarColor,
                    bodyStyle: 'muscle',
                    x: 0, z: -20,
                    heading: 0,
                    maxSpeed: 55,
                    accel: 31
                });
                this.vehicles.push(this.playerCar);

                // 2. Carro Secreto Supercharged (Dentro da Garagem Secreta no Nordeste X=120, Z=120)
                this.secretCar = new DriverVehicle(this.scene, {
                    name: preset.secretCarName,
                    color: preset.secretCarColor,
                    bodyStyle: 'muscle',
                    isSecret: true,
                    x: 120, z: 120,
                    heading: Math.PI,
                    maxSpeed: 68,
                    accel: 42
                });
                this.vehicles.push(this.secretCar);

                // 3. Frota de Viaturas Policiais da Cidade Atual
                const copCoords = [
                    { x: -4, z: -112, heading: 0 },
                    { x: 76, z: 132, heading: Math.PI },
                    { x: -116, z: -84, heading: Math.PI / 2 },
                    { x: 124, z: 84, heading: -Math.PI / 2 }
                ];
                copCoords.forEach((c, index) => {
                    const cop = new DriverVehicle(this.scene, {
                        name: preset.copName,
                        color: preset.copColor,
                        isPolice: true,
                        x: c.x, z: c.z,
                        heading: c.heading,
                        maxSpeed: 56,
                        accel: 33
                    });
                    cop.pursuitRole = index;
                    this.vehicles.push(cop);
                });

                // 4. Carros Civis + Veículos Pesados Exclusivos do Driver 2 (Ônibus, Caminhão Baú e Limusine)
                const civilSpecs = [
                    { name: 'ÔNIBUS URBANO V8', color: 0xf59e0b, bodyStyle: 'bus', x: -84, z: -138, heading: Math.PI, maxSpeed: 42, accel: 20 },
                    { name: 'CAMINHÃO CARGA', color: 0x0284c7, bodyStyle: 'truck', x: 102, z: -84, heading: Math.PI / 2, maxSpeed: 45, accel: 22 },
                    { name: 'STRETCH LIMO V8', color: 0x18181b, bodyStyle: 'limo', x: 84, z: 122, heading: 0, maxSpeed: 52, accel: 27 },
                    { name: 'CADILLAC VERDE', color: 0x15803d, bodyStyle: 'muscle', x: -76, z: 27, heading: 0, maxSpeed: 46, accel: 24 },
                    { name: 'COUPE TURQUESA', color: 0x0d9488, bodyStyle: 'muscle', x: 116, z: -4, heading: Math.PI / 2, maxSpeed: 48, accel: 25 },
                    { name: 'DODGE BEGE', color: 0xc4a07c, bodyStyle: 'muscle', x: -4, z: 145, heading: Math.PI, maxSpeed: 47, accel: 25 },
                    { name: 'SEDAN AZUL', color: 0x2563eb, bodyStyle: 'muscle', x: -130, z: 4, heading: -Math.PI / 2, maxSpeed: 48, accel: 27 },
                    { name: 'TÁXI AMARELO', color: 0xeab308, bodyStyle: 'muscle', x: 84, z: -148, heading: 0, maxSpeed: 48, accel: 26 }
                ];
                civilSpecs.forEach(c => {
                    const civ = new DriverVehicle(this.scene, {
                        name: c.name,
                        color: c.color,
                        bodyStyle: c.bodyStyle,
                        x: c.x, z: c.z,
                        heading: c.heading,
                        maxSpeed: c.maxSpeed,
                        accel: c.accel
                    });
                    this.vehicles.push(civ);
                });

                this.tanner.setVisible(false);
                const lowLight = this.weatherMode === 'night' || this.weatherMode === 'rain';
                this.vehicles.forEach(v => VehicleVisuals.setHeadlights(v, lowLight));
                if (this.freeVehicleAssets) this.freeVehicleAssets.decorateFleet();
            }

            setWeather(mode) {
                this.weatherMode = mode;
                if (this.vehicles) {
                    const lowLight = mode === 'night' || mode === 'rain';
                    this.vehicles.forEach(v => VehicleVisuals.setHeadlights(v, lowLight));
                }
                const lightsButton = document.getElementById('btn-headlights');
                if (lightsButton && this.playerCar) {
                    lightsButton.textContent = this.playerCar.headlightsOn ? '💡 ON' : '💡 OFF';
                }
                const badge = document.getElementById('weather-badge');
                if (mode === 'day') {
                    this.scene.background.setHex(0x38bdf8);
                    this.scene.fog.color.setHex(0x38bdf8);
                    this.sunLight.intensity = 1.05;
                    this.ambientLight.intensity = 0.85;
                    this.effects.rainEnabled = false;
                    badge.textContent = '☀️ DIA';
                } else if (mode === 'dusk') {
                    this.scene.background.setHex(0x9a3412);
                    this.scene.fog.color.setHex(0x9a3412);
                    this.sunLight.intensity = 0.85;
                    this.ambientLight.intensity = 0.65;
                    this.effects.rainEnabled = false;
                    badge.textContent = '🌅 TARDE';
                } else if (mode === 'night') {
                    this.scene.background.setHex(0x090b10);
                    this.scene.fog.color.setHex(0x090b10);
                    this.sunLight.intensity = 0.35;
                    this.ambientLight.intensity = 0.45;
                    this.effects.rainEnabled = false;
                    badge.textContent = '🌙 NOITE';
                } else if (mode === 'rain') {
                    this.scene.background.setHex(0x0f172a);
                    this.scene.fog.color.setHex(0x0f172a);
                    this.sunLight.intensity = 0.42;
                    this.ambientLight.intensity = 0.5;
                    this.effects.rainEnabled = true;
                    badge.textContent = '🌧️ CHUVA';
                }
            }

            cycleWeather() {
                const order = ['day', 'dusk', 'night', 'rain'];
                const next = order[(order.indexOf(this.weatherMode) + 1) % order.length];
                this.setWeather(next);
            }

            clearMissionMarkers() {
                this.missionMarkers.forEach(m => {
                    GPUResourceUtils.disposeSubtree(m.mesh);
                    this.scene.remove(m.mesh);
                });
                this.missionMarkers = [];
                if (this.c4TargetMesh) {
                    GPUResourceUtils.disposeSubtree(this.c4TargetMesh);
                    this.scene.remove(this.c4TargetMesh);
                    this.c4TargetMesh = null;
                }
                this.c4State = { active: false, planted: false, timer: 15.0, beepAccum: 0, x: 0, z: 95 };
                this.markersCollected = 0;
                this.totalMarkers = 0;
                document.getElementById('mission-subcounter').classList.add('hidden');
            }

            spawnMarkerRing(x, z, colorHex = 0xfacc15) {
                const geo = new THREE.CylinderGeometry(3.2, 3.2, 5.5, 12);
                const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.65 });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, 2.75, z);
                this.scene.add(mesh);
                this.missionMarkers.push({ mesh, x, z, collected: false });
            }

            startMission(type) {
                if((type==='story_tipoff'||type==='story_witness'||type==='story_train'||type==='story_drop') &&
                    this.currentCityKey!=='chicago')this.changeCity('chicago');
                document.getElementById('missions-modal').classList.add('hidden');
                document.getElementById('center-announcement').classList.add('hidden');

                this.inReplayMode = false;
                document.getElementById('director-banner').classList.add('hidden');

                this.missionType = type;
                this.gameEnded = false;
                this.clearMissionMarkers();
                this.spawnAllVehicles();
                if(this.trainLine)this.trainLine.reset(type==='story_train');
                this.trainLostSeconds=0;
                this.pedManager.spawnCityPedestrians();
                this.roadblockDirector.reset();
                this.roadblocksSpawned = false;
                this.tailOutOfRangeTimer = 0;
                this.dropDirector.reset();
                this.dropStatus=null;
                this.mode = 'driving';
                this.interiorPlace=null;
                this.witnessCloseTime=0;
                this.felony = 0;
                this.survivalElapsed = 0;
                this.evidencePhase = 0;
                this.pursuitChapter.reset();
                this.impactFeedback.reset();
                if (this.impactFlash) this.impactFlash.style.opacity = '0';
                const missionCenter = document.getElementById('mission-center');
                if (missionCenter) missionCenter.classList.remove('objective-expanded');
                const objectiveButton = document.getElementById('btn-objective-toggle');
                if (objectiveButton) {
                    objectiveButton.setAttribute('aria-expanded','false');
                    objectiveButton.textContent = 'Ver objetivo completo';
                }
                this.replayBuffer = [];
                const proximity=document.getElementById('tail-proximity');
                if(proximity)proximity.classList.toggle('hidden',type!=='story_drop');

                const cityTitle = CITY_PRESETS[this.currentCityKey].name;
                const titleEl = document.getElementById('mission-title');
                const timerEl = document.getElementById('mission-timer');
                const subEl = document.getElementById('mission-subcounter');
                const objEl = document.getElementById('objective-banner');

                if (type === 'freeroam') {
                    this.missionActive = false;
                    titleEl.textContent = `TAKE A RIDE: ${cityTitle}`;
                    timerEl.classList.add('hidden');
                    objEl.innerHTML = 'Passeio livre! Pedestres saltam na calçada, <kbd class="px-1 bg-slate-800 text-amber-400 rounded">SHIFT</kbd> faz Burnout, <kbd class="px-1 bg-slate-800 text-amber-400 rounded">Q</kbd> olha para trás e <kbd class="px-1 bg-slate-800 text-amber-400 rounded">R</kbd> abre o Film Director!';
                } else if (type === 'story_tipoff') {
                    this.missionActive=true;
                    this.missionTimeLeft=175;
                    this.mode='on_foot';
                    this.tanner.setPosition(2,0,-19,0);
                    this.tanner.setVisible(true);
                    titleEl.textContent='CHICAGO 01: SURVEILLANCE TIP OFF';
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');
                    subEl.textContent='ENCONTRE O CARRO DE JONES';
                    objEl.textContent='Entre no carro, encontre Jones no norte da cidade, '+
                        'saia a pé e entre no carro dele antes que a testemunha parta.';
                    this.targetCar=new DriverVehicle(this.scene,{
                        name:'CARRO DE JONES',color:0x94a3b8,isTarget:true,
                        isSecret:true,x:244,z:-240,heading:Math.PI,
                        maxSpeed:52,accel:30
                    });
                    this.vehicles.push(this.targetCar);
                } else if (type === 'story_drop') {
                    this.missionActive=true;
                    this.missionTimeLeft=112;
                    this.playerCar.x=4;
                    this.playerCar.z=-108;
                    this.playerCar.y=0;
                    this.playerCar.heading=0;
                    this.playerCar.speed=0;
                    this.playerCar.updateTransform();
                    this.tanner.setVisible(false);
                    this.setWeather('day');
                    titleEl.textContent='CHICAGO 04: TAILING THE DROP';
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');
                    subEl.textContent='SIGA O CARRO VERMELHO SEM SER VISTO';
                    objEl.textContent='Mantenha a barra de proximidade VERDE. '+
                        'Não encoste no suspeito nem fique distante demais. '+
                        'Siga-o até o depósito de Chicago.';
                    this.targetCar=new DriverVehicle(this.scene,{
                        name:'BRASILEIRO — SEDÃ VERMELHO',
                        color:0xd94828,
                        bodyStyle:'muscle',
                        isTarget:true,
                        x:4,z:-54,
                        heading:0,maxSpeed:39,accel:24
                    });
                    DriverTailingDropMission.attachRoute(this.targetCar);
                    this.vehicles.push(this.targetCar);
                } else if (type === 'story_train') {
                    this.missionActive=true;
                    this.missionTimeLeft=120;
                    this.playerCar.x=4;this.playerCar.z=217;this.playerCar.y=0;
                    this.playerCar.heading=Math.PI;this.playerCar.speed=0;
                    this.playerCar.updateTransform();
                    this.tanner.setVisible(false);
                    this.setWeather('day');
                    titleEl.textContent='CHICAGO 03: TRAIN PURSUIT';
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');
                    subEl.textContent='SIGA O TREM ELEVADO • EVITE PERDÊ-LO';
                    objEl.textContent='A testemunha escapou no trem! Siga os trilhos, '+
                        'alcance a estação, saia do carro e suba a rampa à esquerda.';
                } else if (type === 'story_witness') {
                    this.missionActive=true;
                    this.missionTimeLeft=65;
                    this.witnessCloseTime=0;
                    titleEl.textContent='CHICAGO 02: CHASE THE WITNESS';
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');
                    subEl.textContent='MANTENHA-SE PERTO DO SEDÃ AZUL';
                    objEl.textContent='Siga o sedã azul por 48 segundos, sem perder contato '+
                        'por mais de quatro segundos. Não destrua o alvo.';
                    this.targetCar=new DriverVehicle(this.scene,{
                        name:'SEDÃ DA TESTEMUNHA',color:0x2563eb,isTarget:true,
                        x:4,z:14,heading:0,maxSpeed:46,accel:30
                    });
                    this.vehicles.push(this.targetCar);
                } else if (type === 'chase') {
                    this.missionActive = true;
                    this.missionTimeLeft = 90.0;
                    titleEl.textContent = `MISSÃO 1 (${cityTitle}): PERSEGUIR A TESTEMUNHA`;
                    timerEl.classList.remove('hidden');
                    objEl.textContent = 'OBJETIVO: Bata no Sedan Vermelho de Caine até destruir 100% do motor dele antes que o tempo acabe!';

                    this.targetCar = new DriverVehicle(this.scene, {
                        name: 'CAINE V8 SEDAN',
                        color: 0xdc2626,
                        isTarget: true,
                        x: 0, z: 14,
                        heading: 0,
                        maxSpeed: 50,
                        accel: 27
                    });
                    this.vehicles.push(this.targetCar);
                } else if (type === 'checkpoints') {
                    this.missionActive = true;
                    this.missionTimeLeft = 95.0;
                    this.felony = 55;
                    titleEl.textContent = `MISSÃO 2 (${cityTitle}): ROTA DE FUGA`;
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');

                    const pts = [
                        { x: 0, z: 85 },
                        { x: 80, z: 85 },
                        { x: 80, z: -80 },
                        { x: -80, z: -80 }
                    ];
                    pts.forEach(p => this.spawnMarkerRing(p.x, p.z, 0xfacc15));
                    this.totalMarkers = pts.length;
                    subEl.textContent = `CHECKPOINTS: 0 / ${this.totalMarkers}`;
                    objEl.textContent = 'OBJETIVO: Passe pelos 4 Checkpoints amarelos e depois entre A PÉ no Esconderijo Verde (Sudoeste)!';
                } else if (type === 'getaway') {
                    this.missionActive = true;
                    this.missionTimeLeft = 100.0;
                    this.felony = 90;
                    this.playerCar.damage = 50; // Já começa avariado!
                    titleEl.textContent = `MISSÃO 3 (${cityTitle}): ENTREGA SOB FOGO`;
                    timerEl.classList.remove('hidden');
                    objEl.textContent = 'OBJETIVO: Seu carro está com 50% de dano e cercado! Troque de carro ou fuja até entrar A PÉ no Esconderijo Verde!';
                } else if (type === 'evidence') {
                    // Nova operação inspirada nas missões de fuga de Driver.
                    // Primeiro recolhe três dossiês em ordem; depois despista
                    // a polícia e chega ao esconderijo a pé.
                    this.missionActive = true;
                    this.missionTimeLeft = 165;
                    this.felony = 68;
                    this.evidencePhase = 0;
                    titleEl.textContent = `MISSÃO 7 (${cityTitle}): DOSSIÊS DO CARTEL`;
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');
                    const evidenceStops = [
                        { x: 0, z: -80 },
                        { x: 80, z: -80 },
                        { x: 80, z: 0 }
                    ];
                    evidenceStops.forEach(p => this.spawnMarkerRing(p.x, p.z, 0x22d3ee));
                    this.totalMarkers = evidenceStops.length;
                    subEl.textContent = `DOSSIÊS: 0 / ${this.totalMarkers}`;
                    objEl.textContent =
                        'ETAPA 1: recolha os 3 dossiês azuis em ordem. ' +
                        'ETAPA 2: despiste a polícia (delito abaixo de 25) ' +
                        'e entre A PÉ no esconderijo verde.';
                } else if (type === 'pursuit') {
                    this.missionActive = true;
                    this.missionTimeLeft = 155;
                    this.felony = 98;
                    this.setWeather('night');
                    this.roadblockDirector.cooldown = 2;
                    titleEl.textContent = `MISSÃO 8 (${cityTitle}): CERCO À MEIA-NOITE`;
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');
                    subEl.textContent = 'ATO 1: RESISTA AO CERCO POLICIAL POR 24s';
                    objEl.textContent = 'ATO 1: sobreviva ao cerco por 24 segundos. ' +
                        'ATO 2: siga 3 portões amarelos em ordem. ' +
                        'ATO 3: despiste as viaturas e entre A PÉ no esconderijo.';
                    // A breve tomada aérea tem início imediato, mas não
                    // interrompe a direção nem congela o jogo.
                } else if (type === 'survival') {
                    this.missionActive = true;
                    this.felony = 100;
                    titleEl.textContent = `MODO SURVIVAL: ${cityTitle}`;
                    timerEl.classList.remove('hidden');
                    objEl.textContent = 'SOBREVIVÊNCIA CLÁSSICA: Viaturas ultra-agressivas caçam você sem parar! Sobreviva o máximo de segundos possível!';
                    // Turbina todas as viaturas no modo Survival
                    this.vehicles.forEach(v => {
                        if (v.isPolice) {
                            v.maxSpeed = 66;
                            v.accel = 44;
                        }
                    });
                } else if (type === 'trailblazer') {
                    this.missionActive = true;
                    this.missionTimeLeft = 35.0;
                    titleEl.textContent = `TRAILBLAZER (CONES): ${cityTitle}`;
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');

                    const trail = [
                        { x: 0, z: 10 }, { x: 0, z: 50 }, { x: 0, z: 95 },
                        { x: -40, z: 95 }, { x: -80, z: 95 }, { x: -80, z: 15 },
                        { x: -80, z: -40 }, { x: -40, z: -80 }, { x: 20, z: -80 }, { x: 80, z: -80 }
                    ];
                    trail.forEach(p => this.spawnMarkerRing(p.x, p.z, 0xa855f7));
                    this.totalMarkers = trail.length;
                    subEl.textContent = `MARCADORES: 0 / ${this.totalMarkers} (+4s cada)`;
                    objEl.textContent = 'OBJETIVO: Atinja todos os 10 totens roxos pela cidade! Cada totem dá +4 segundos de bônus!';
                } else if (type === 'tail') {
                    this.missionActive = true;
                    this.missionTimeLeft = 45.0;
                    titleEl.textContent = `MISSÃO 4 (${cityTitle}): SEGUIR VASQUEZ`;
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');
                    subEl.textContent = `DISTÂNCIA STEALTH: 32m (IDEAL: 15m a 75m)`;
                    objEl.textContent = 'OBJETIVO: Siga o carro preto de Vasquez por 45s! Não chegue a menos de 15m nem fique a mais de 75m!';

                    this.targetCar = new DriverVehicle(this.scene, {
                        name: 'VASQUEZ LIMO V8',
                        color: 0x090d16,
                        isTarget: true,
                        x: 0, z: 12,
                        heading: 0,
                        maxSpeed: 36,
                        accel: 22
                    });
                    this.vehicles.push(this.targetCar);
                } else if (type === 'mountainpass') {
                    this.missionActive = true;
                    this.missionTimeLeft = 65.0;
                    titleEl.textContent = `PISTA SECRETA: ${cityTitle} GP`;
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');

                    // Já coloca o jogador direto no Carro Secreto Supercharged!
                    this.city.unlockSecretGate();
                    this.playerCar = this.secretCar;
                    this.playerCar.x = 0;
                    this.playerCar.z = -20;
                    this.playerCar.heading = 0;

                    const raceRingCoords = [
                        { x: 0, z: 50 }, { x: 0, z: 110 }, { x: 80, z: 110 },
                        { x: 80, z: 0 }, { x: 80, z: -80 }, { x: 0, z: -80 },
                        { x: -80, z: -80 }, { x: -80, z: 20 }, { x: -80, z: 110 }, { x: 0, z: 0 }
                    ];
                    raceRingCoords.forEach(p => this.spawnMarkerRing(p.x, p.z, 0xf43f5e));
                    this.totalMarkers = raceRingCoords.length;
                    subEl.textContent = `PORTÕES GP: 0 / ${this.totalMarkers}`;
                    objEl.textContent = 'CORRIDA SECRETA: Você está pilotando o Carro Secreto Supercharged! Complete todos os 10 portões antes do tempo zerar!';
                } else if (type === 'gauntlet') {
                    this.missionActive = true;
                    this.missionTimeLeft = 60.0;
                    this.felony = 85;
                    this.pedManager.spawnPoliceRoadblocks(CITY_PRESETS[this.currentCityKey]);
                    this.roadblocksSpawned = true;
                    titleEl.textContent = `FURA-BLOQUEIOS: ${cityTitle}`;
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');
                    subEl.textContent = `BARRICADAS DESTRUÍDAS: 0 / 5`;
                    objEl.textContent = 'OBJETIVO: A polícia bloqueou as avenidas com cavaletes laranjas! Atravesse e destrua pelo menos 5 cavaletes de bloqueio!';
                } else if (type === 'bomb') {
                    this.missionActive = true;
                    this.missionTimeLeft = 95.0;
                    this.c4State = { active: true, planted: false, timer: 15.0, beepAccum: 0, x: 0, z: 95 };
                    const crateGeo = new THREE.CylinderGeometry(3.4, 3.4, 4.5, 16);
                    const crateMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.7 });
                    this.c4TargetMesh = new THREE.Mesh(crateGeo, crateMat);
                    this.c4TargetMesh.position.set(0, 2.25, 95);
                    this.scene.add(this.c4TargetMesh);

                    titleEl.textContent = `MISSÃO 5 (${cityTitle}): SABOTAGEM C4`;
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');
                    subEl.textContent = `STATUS DO C4: NÃO PLANTADO (VÁ ATÉ A ZONA VERMELHA A PÉ)`;
                    objEl.textContent = 'OBJETIVO: Dirija até o marcador vermelho ao norte da ponte, saia do carro (E), plante o C4 e fuja a mais de 65m em 15s!';
                } else if (type === 'heist') {
                    this.missionActive = true;
                    this.missionTimeLeft = 105.0;
                    this.felony = 45;
                    titleEl.textContent = `MISSÃO 6 (${cityTitle}): SEQUESTRO DE CARGA`;
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');

                    this.targetCar = new DriverVehicle(this.scene, {
                        name: 'CAMINHÃO BLINDADO',
                        color: 0x84cc16,
                        bodyStyle: 'truck',
                        isTarget: true,
                        x: 0, z: 25,
                        heading: 0,
                        maxSpeed: 42,
                        accel: 24
                    });
                    this.vehicles.push(this.targetCar);
                    subEl.textContent = `FASE 1: PARE E ROUBE O CAMINHÃO BLINDADO (TECLA E)`;
                    objEl.textContent = 'OBJETIVO: Feche o Caminhão Blindado verde, desça com Tanner (E) para tomar a direção dele e leve-o até o Esconderijo Verde!';
                } else if (type === 'quickchase') {
                    this.missionActive = true;
                    this.missionTimeLeft = 45.0;
                    this.setWeather('rain');
                    titleEl.textContent = `QUICK CHASE (CHUVA): ${cityTitle}`;
                    timerEl.classList.remove('hidden');
                    objEl.textContent = 'CAÇADA RELÂMPAGO: Você tem apenas 45s sob chuva intensa para destruir 100% da Limusine Blindada fugitiva!';

                    this.targetCar = new DriverVehicle(this.scene, {
                        name: 'LIMO BLINDADA V8',
                        color: 0xe11d48,
                        bodyStyle: 'limo',
                        isTarget: true,
                        x: 0, z: 14,
                        heading: 0,
                        maxSpeed: 50,
                        accel: 29
                    });
                    this.vehicles.push(this.targetCar);
                }
                DriverCheckpointRoute.refresh(this.missionType, this.missionMarkers);
                if (this.freeVehicleAssets) this.freeVehicleAssets.decorateFleet();
            }

            togglePlayerHeadlights() {
                if (this.mode !== 'driving' || !this.playerCar) return;
                VehicleVisuals.setHeadlights(this.playerCar, !this.playerCar.headlightsOn);
                const button = document.getElementById('btn-headlights');
                if (button) button.textContent = this.playerCar.headlightsOn ? '💡 ON' : '💡 OFF';
            }

            triggerHornOrSiren() {
                this.audio.init();
                if (this.mode !== 'driving' || !this.playerCar) return;
                if (this.playerCar.isPolice) {
                    this.playerCar.sirenActive = !this.playerCar.sirenActive;
                } else {
                    this.audio.playHorn();
                }
            }

            enterInterior(place) {
                if(!place||this.mode!=='on_foot')return false;
                this.interiorPlace=place;
                this.tanner.setPosition(place.inside.x,0,place.inside.z-6,0);
                this.cameraRig.lastMode=-1;this.cameraRig.focus=null;
                document.getElementById('player-state-badge').textContent=
                    'DENTRO: '+(place.name||place.id).toUpperCase();
                return true;
            }

            leaveInterior() {
                const place=this.interiorPlace;
                if(!place)return false;
                this.interiorPlace=null;
                this.tanner.setPosition(place.door.x,0,place.door.z+4,Math.PI);
                this.cameraRig.lastMode=-1;this.cameraRig.focus=null;
                document.getElementById('player-state-badge').textContent='TANNER (A PÉ)';
                return true;
            }

            nearSaveDesk() {
                const place=this.interiorPlace;
                if(this.mode!=='on_foot'||place?.id!=='home'||!place.savePoint)return false;
                const pos=this.tanner.group.position;
                return Math.hypot(pos.x-place.savePoint.x,pos.z-place.savePoint.z)<3.6;
            }

            showSaveStatus(message) {
                const el=document.getElementById('home-save-status');
                if(el)el.textContent=message;
            }

            saveAtHome() {
                if(!this.nearSaveDesk()){
                    this.showSaveStatus('Aproxime-se da mesa verde da casa para salvar.');
                    return false;
                }
                const ok=this.homeSave.write(this.homeSave.capture(this));
                this.showSaveStatus(ok?'PARTIDA GRAVADA! O progresso está no navegador.':
                    'Falha ao salvar. Verifique o armazenamento do navegador.');
                return ok;
            }

            loadHomeGame() {
                const save=this.homeSave.read();
                if(!save) {
                    this.showSaveStatus('Nenhuma partida salva válida neste navegador.');
                    return false;
                }
                const ok=this.homeSave.restore(this,save);
                this.showSaveStatus(ok?'Partida carregada com sucesso!':
                    'Não foi possível restaurar a partida.');
                if(ok)document.getElementById('player-state-badge').textContent=
                    this.interiorPlace?'DENTRO: '+this.interiorPlace.name.toUpperCase():
                    this.mode==='on_foot'?'TANNER (A PÉ)':'NO VOLANTE (V8)';
                return ok;
            }

            toggleVehicleEnterExit() {
                if (this.gameEnded || this.inReplayMode) return;
                this.audio.init();

                if (this.mode === 'driving' && this.playerCar) {
                    if (Math.abs(this.playerCar.speed) > 13) return;

                    this.mode = 'on_foot';
                    this.playerCar.speed = 0;
                    const exitX = this.playerCar.x - Math.cos(this.playerCar.heading) * 2.4;
                    const exitZ = this.playerCar.z + Math.sin(this.playerCar.heading) * 2.4;
                    this.tanner.setPosition(exitX, this.playerCar.y, exitZ, this.playerCar.heading);
                    this.tanner.setVisible(true);

                    const badge = document.getElementById('player-state-badge');
                    badge.textContent = 'TANNER (A PÉ)';
                    badge.className = 'px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold';
                } else if (this.mode === 'on_foot') {
                    if(this.interiorPlace){
                        const pos=this.tanner.group.position;
                        if(this.nearSaveDesk()){this.saveAtHome();return;}
                        if(Math.hypot(pos.x-this.interiorPlace.exit.x,
                            pos.z-this.interiorPlace.exit.z)<4.2)
                            this.leaveInterior();
                        return;
                    }
                    const doorway=this.city.interiorAt(
                        this.tanner.group.position.x,this.tanner.group.position.z);
                    if(doorway){this.enterInterior(doorway);return;}
                    // 0. Se for a Missão 5 (Sabotagem C4) e Tanner estiver na zona da bomba
                    if (this.c4State.active && !this.c4State.planted) {
                        const distBomb = Math.hypot(
                            this.tanner.group.position.x - this.c4State.x,
                            this.tanner.group.position.z - this.c4State.z
                        );
                        if (distBomb < 6.5) {
                            this.c4State.planted = true;
                            this.c4State.timer = 15.0;
                            this.felony = Math.max(this.felony, 70);
                            this.audio.playC4Beep(true);
                            document.getElementById('objective-banner').textContent =
                                '💣 BOMBA C4 ATIVADA (15 SEGUNDOS)! Volte para o carro (E) e afaste-se a mais de 65 metros IMEDIATAMENTE!';
                            return;
                        }
                    }

                    // 0.5. Verifica se Tanner quer sentar ou levantar de um Banco de Praça (Easter Egg Clássico do Driver 2!)
                    for (const b of this.city.benches) {
                        const dBench = Math.hypot(this.tanner.group.position.x - b.x, this.tanner.group.position.z - b.z);
                        if (dBench < 3.5) {
                            const satDown = this.tanner.toggleSitOnBench(b);
                            const badge = document.getElementById('player-state-badge');
                            badge.textContent = satDown ? 'TANNER (SENTADO)' : 'TANNER (A PÉ)';
                            return;
                        }
                    }

                    // 1. Verifica primeiro se Tanner está perto do Interruptor da Garagem Secreta
                    const distSwitch = Math.hypot(
                        this.tanner.group.position.x - this.city.secretSwitchPos.x,
                        this.tanner.group.position.z - this.city.secretSwitchPos.z
                    );
                    if (distSwitch < 5.5 && !this.city.secretGateOpen) {
                        this.city.unlockSecretGate();
                        this.audio.playHubcapPing();
                        document.getElementById('secret-status').textContent = 'ABERTO!';
                        document.getElementById('secret-status').className = 'text-emerald-400 font-extrabold';
                        document.getElementById('objective-banner').textContent =
                            '🔓 PORTÃO SECRETO ABERTO! Entre na garagem e assuma o Veículo Secreto Supercharged!';
                        return;
                    }

                    // 2. Procura veículo próximo para entrar
                    let closestCar = null;
                    let minDist = 6.2;

                    for (const v of this.vehicles) {
                        const d = Math.hypot(v.x - this.tanner.group.position.x, v.z - this.tanner.group.position.z);
                        if (d < minDist) {
                            minDist = d;
                            closestCar = v;
                        }
                    }

                    if (closestCar) {
                        const switchedCar = (closestCar !== this.playerCar);
                        this.playerCar = closestCar;
                        this.mode = 'driving';
                        this.tanner.setVisible(false);

                        if (switchedCar && !this.isPoliceNearPlayer(45)) {
                            this.felony = Math.max(0, this.felony - 65);
                        } else if (closestCar.isPolice) {
                            this.felony = Math.min(100, this.felony + 35);
                        }

                        const badge = document.getElementById('player-state-badge');
                        badge.textContent = closestCar.isSecret ? 'CARRO SECRETO!' : 'NO VOLANTE (V8)';
                        badge.className = 'px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold';
                    }
                }
            }

            // =========================================================================
            // FILM DIRECTOR MODE (GRAVADOR E REPRODUTOR DE REPLAY CINEMATOGRÁFICO)
            // =========================================================================
            recordReplayFrame() {
                if (this.inReplayMode || this.gameEnded) return;
                const snapshot = this.vehicles.map(v => ({
                    x: v.x, y: v.y, z: v.z,
                    heading: v.heading,
                    pitch: v.pitchAngle,
                    roll: v.rollAngle,
                    steer: v.steerAngle
                }));
                this.replayBuffer.push({
                    playerPos: this.getPlayerPosition(),
                    cars: snapshot
                });
                if (this.replayBuffer.length > 600) {
                    this.replayBuffer.shift();
                }
            }

            toggleReplayDirector() {
                if (this.replayBuffer.length < 10) return;
                this.inReplayMode = !this.inReplayMode;
                const banner = document.getElementById('director-banner');
                if (this.inReplayMode) {
                    this.replayIndex = 0;
                    banner.classList.remove('hidden');
                } else {
                    banner.classList.add('hidden');
                }
            }

            cycleDirectorCamera() {
                this.directorCamType = (this.directorCamType + 1) % 3;
                const labels = ['CÂMERA DE RUA (TRIPÉ)', 'CÂMERA DE CALOTA (WHEEL CAM)', 'CÂMERA HELICÓPTERO'];
                document.getElementById('director-cam-label').textContent = labels[this.directorCamType];
            }

            updateReplayPlayback(dt) {
                if (this.replayBuffer.length === 0) return;
                this.replayIndex = (this.replayIndex + 1) % this.replayBuffer.length;
                const frame = this.replayBuffer[this.replayIndex];

                for (let i = 0; i < this.vehicles.length && i < frame.cars.length; i++) {
                    const v = this.vehicles[i];
                    const s = frame.cars[i];
                    v.x = s.x; v.y = s.y; v.z = s.z;
                    v.heading = s.heading;
                    v.chassisTilt.rotation.x = s.pitch;
                    v.chassisTilt.rotation.z = s.roll;
                    v.steerAngle = s.steer;
                    v.updateTransform();
                }

                const p = frame.playerPos;
                if (this.directorCamType === 0) {
                    // Câmera Tripé Fixa na Calçada a cada 90 frames acompanhando o carro passar!
                    const blockSnap = Math.floor(this.replayIndex / 90) * 90;
                    const anchor = this.replayBuffer[Math.min(this.replayBuffer.length - 1, blockSnap + 35)].playerPos;
                    this.camera.position.set(anchor.x + 11, anchor.y + 2.2, anchor.z + 11);
                    this.camera.lookAt(p.x, p.y + 1.0, p.z);
                } else if (this.directorCamType === 1) {
                    // Wheel Cam (Rente à calota traseira)
                    const wx = p.x - Math.cos(p.heading) * 1.65 - Math.sin(p.heading) * 2.2;
                    const wz = p.z + Math.sin(p.heading) * 1.65 - Math.cos(p.heading) * 2.2;
                    this.camera.position.set(wx, p.y + 0.55, wz);
                    this.camera.lookAt(p.x + Math.sin(p.heading) * 12, p.y + 0.8, p.z + Math.cos(p.heading) * 12);
                } else {
                    // Helicopter Cam
                    const angle = this.replayIndex * 0.015;
                    this.camera.position.set(p.x + Math.cos(angle) * 24, p.y + 22, p.z + Math.sin(angle) * 24);
                    this.camera.lookAt(p.x, p.y + 1, p.z);
                }
            }

            isPoliceNearPlayer(radius = 55) {
                const pos = this.getPlayerPosition();
                for (const v of this.vehicles) {
                    if (v.isPolice && v !== this.playerCar) {
                        const d = Math.hypot(v.x - pos.x, v.z - pos.z);
                        if (d < radius) return true;
                    }
                }
                return false;
            }

            getPlayerPosition() {
                if (this.mode === 'driving' && this.playerCar) {
                    return { x: this.playerCar.x, y: this.playerCar.y, z: this.playerCar.z, heading: this.playerCar.heading, speed: this.playerCar.speed };
                }
                return {
                    x: this.tanner.group.position.x,
                    y: this.tanner.group.position.y,
                    z: this.tanner.group.position.z,
                    heading: this.tanner.heading
                };
            }

            updateAIAndCollisions(dt) {
                const playerPos = this.getPlayerPosition();

                // IA: tráfego dirigido por cruzamentos e sinalização.
                // Os bloqueios intactos entram como obstáculos para os motoristas
                // não os atravessarem nem os destruírem por engano.
                this.trafficAI.policeRoadblocks = this.pedManager.roadblocks;
                // O carro secreto só deixa a garagem quando o jogador assume o volante.
                for (const vehicle of this.vehicles) {
                    if (vehicle === this.playerCar || vehicle.isSecret) continue;
                    const controls = this.trafficAI.getInput(
                        vehicle, dt, this.vehicles, playerPos, this.felony
                    );
                    vehicle.updatePhysics(dt, controls, this.city, this.effects, this.audio, false);
                }

                // Separação respeita paredes; colisão usa a massa dos veículos
                // e um cooldown por par para não aplicar dano a cada quadro.
                this.collisionSystem.step(
                    this.vehicles, this.playerCar, this.city, performance.now(),
                    impact => {
                        if (this.mode !== 'driving') return;
                        this.audio.playCrash(Math.min(1, impact.closingSpeed / 35));
                        const strength = Math.min(1, impact.closingSpeed / 38);
                        this.effects.spawnImpactSparks(
                            (this.playerCar.x + impact.other.x) * 0.5,
                            this.playerCar.y || 0,
                            (this.playerCar.z + impact.other.z) * 0.5,
                            strength
                        );
                        this.impactFeedback.trigger(impact.closingSpeed);
                        if(this.missionType==='story_drop' &&
                            impact.other===this.targetCar && this.dropStatus){
                            this.dropDirector.suspicion=Math.min(100,
                                this.dropDirector.suspicion+50);
                        }
                        if (impact.closingSpeed >= 29) {
                            // Colisões fortes soltam vapor do capô sem luzes caras.
                            this.effects.spawnTireSmoke(
                                this.playerCar.x + Math.sin(this.playerCar.heading) * 1.5,
                                this.playerCar.y || 0,
                                this.playerCar.z + Math.cos(this.playerCar.heading) * 1.5,
                                true
                            );
                        }
                        // A polícia não pode aumentar o delito de Tanner
                        // simplesmente batendo no carro dele.
                        if (impact.playerApproach > 8) {
                            if (impact.other.isPolice) {
                                this.felony = Math.min(100, this.felony + 12);
                            } else if (this.isPoliceNearPlayer(65)) {
                                this.felony = Math.min(100, this.felony + 6);
                            }
                        }
                    }
                );
            }

            updateFelonyAndMissions(dt) {
                if (this.gameEnded || this.inReplayMode) return;

                if (this.mode === 'driving' && this.playerCar) {
                    const kmh = Math.abs(this.playerCar.speed) * 3.4;
                    if (this.isPoliceNearPlayer(65)) {
                        if (this.playerCar.isDrifting || this.playerCar.isBurnout) this.felony = Math.min(100, this.felony + 9 * dt);
                        if (kmh > 130) this.felony = Math.min(100, this.felony + 6 * dt);
                    } else if (this.felony > 0 && this.missionType !== 'survival') {
                        this.felony = Math.max(0, this.felony - 3.5 * dt);
                    }

                    if (this.playerCar.damage >= 100) {
                        if (this.missionType === 'survival') {
                            this.triggerEndScreen('FIM DO SURVIVAL!', `Você sobreviveu por ${this.survivalElapsed.toFixed(1)} segundos contra a frota de elite!`);
                        } else {
                            this.triggerEndScreen('CARRO DESTRUÍDO!', 'O motor do seu veículo fundiu após sofrer 100% de dano. Dica: Saia do carro (E) e troque de veículo antes de explodir!');
                        }
                        return;
                    }
                } else {
                    if (!this.isPoliceNearPlayer(40) && this.missionType !== 'survival') {
                        this.felony = Math.max(0, this.felony - 6.5 * dt);
                    }
                }

                // O diretor também limpa bloqueios quando Tanner sai do veículo.
                this.roadblockDirector.update(dt, this);

                // Somente o próximo portão da rota pode ser coletado.
                if (this.missionMarkers.length > 0) {
                    const pos = this.getPlayerPosition();
                    const marker = DriverCheckpointRoute.findReached(
                        this.missionType, this.missionMarkers, pos.x, pos.z
                    );
                    for (const m of this.missionMarkers) {
                        if (!m.collected && m.mesh.visible) m.mesh.rotation.y += dt * 2.5;
                    }
                    if (marker) {
                        marker.collected = true;
                        marker.mesh.visible = false;
                        this.markersCollected++;
                        this.audio.playHubcapPing();
                        if (this.missionType === 'trailblazer') {
                            this.missionTimeLeft += 4.0;
                            document.getElementById('mission-subcounter').textContent =
                                `MARCADORES: ${this.markersCollected} / ${this.totalMarkers} (+4s!)`;
                        } else {
                            const kind = this.missionType === 'evidence' ? 'DOSSIÊS' : 'CHECKPOINTS';
                            document.getElementById('mission-subcounter').textContent =
                                `${kind}: ${this.markersCollected} / ${this.totalMarkers}`;
                        }
                        DriverCheckpointRoute.refresh(this.missionType, this.missionMarkers);
                    }
                }

                // Lógica de Tempo e Condições de Vitória/Derrota das Missões
                if (this.missionActive) {
                    if (this.missionType === 'story_tipoff' && this.targetCar) {
                        const player=this.getPlayerPosition();
                        const distance=Math.hypot(player.x-this.targetCar.x,
                            player.z-this.targetCar.z);
                        document.getElementById('mission-subcounter').textContent=
                            'JONES: '+Math.round(distance)+'m • ENTRE NO CARRO DELE';
                        if(this.playerCar===this.targetCar && this.mode==='driving'){
                            this.triggerEndScreen('SURVEILLANCE TIP OFF CONCLUÍDA!',
                                'Tanner encontrou Jones e a testemunha a tempo.');
                            return;
                        }
                    } else if(this.missionType==='story_witness'&&this.targetCar){
                        const player=this.getPlayerPosition();
                        const distance=Math.hypot(player.x-this.targetCar.x,
                            player.z-this.targetCar.z);
                        if(distance<=85&&this.mode==='driving'){
                            this.witnessCloseTime+=dt;
                            this.tailOutOfRangeTimer=Math.max(0,this.tailOutOfRangeTimer-dt);
                        }else this.tailOutOfRangeTimer+=dt;
                        document.getElementById('mission-subcounter').textContent=
                            'SEDÃ AZUL: '+Math.round(distance)+'m | CONTATO '+
                            Math.floor(this.witnessCloseTime)+'/48s';
                        if(this.tailOutOfRangeTimer>4){
                            this.triggerEndScreen('TESTEMUNHA ESCAPOU!',
                                'Você perdeu o sedã. Mantenha-se a menos de 85 metros.');
                            return;
                        }
                        if(this.witnessCloseTime>=48){
                            this.triggerEndScreen('CHASE THE WITNESS CONCLUÍDA!',
                                'Você acompanhou a testemunha até a estação.');
                            return;
                        }
                    }
                    if(this.missionType==='story_drop'&&this.targetCar){
                        const info=this.dropDirector.update(
                            dt,this.getPlayerPosition(),this.targetCar,this.mode
                        );
                        this.dropStatus=info;
                        const counter=document.getElementById('mission-subcounter');
                        const state=info.zone==='close'?
                            'AFASTE-SE! O SUSPEITO ESTÁ DESCONFIADO':
                            info.zone==='far'?
                            'APROXIME-SE! VOCÊ ESTÁ PERDENDO O ALVO':
                            'DISTÂNCIA SEGURA • NÃO SEJA VISTO';
                        counter.textContent=state+' • '+Math.round(info.distance)+' m';
                        if(info.failed){
                            const title=info.failed==='seen'?
                                'O SUSPEITO VIU VOCÊ!':
                                info.failed==='lost'?'O SUSPEITO ESCAPOU!':
                                'ALVO DESTRUÍDO!';
                            this.triggerEndScreen(title,
                                'A vigilância foi comprometida. Mantenha a barra verde e não bata no sedã.');
                            return;
                        }
                        if(info.complete){
                            this.triggerEndScreen('TAILING THE DROP CONCLUÍDA!',
                                'Tanner seguiu o brasileiro discretamente até o depósito.');
                            return;
                        }
                    }
                    if(this.missionType==='story_train'&&this.trainLine){
                        const current=this.getPlayerPosition();
                        const train=this.trainLine;
                        const distance=Math.hypot(current.x-train.position.x,
                            current.z-train.position.z);
                        const label=document.getElementById('mission-subcounter');
                        if(!train.arrived){
                            if(distance>132)this.trainLostSeconds+=dt;
                            else this.trainLostSeconds=Math.max(0,this.trainLostSeconds-dt*1.6);
                            label.textContent='TREM: '+Math.round(distance)+'m | PERDENDO: '+
                                this.trainLostSeconds.toFixed(1)+'/6s';
                            if(this.trainLostSeconds>6){
                                this.triggerEndScreen('TESTEMUNHA ESCAPOU!',
                                    'Você perdeu o trem elevado durante a perseguição.');
                                return;
                            }
                        }else{
                            label.textContent='TREM NA ESTAÇÃO • SAIA E SUBA A RAMPA';
                            document.getElementById('objective-banner').textContent=
                                'PARE, SAIA DO CARRO (E) E CORRA PELA RAMPA CINZA, '+
                                'AO LADO ESQUERDO DOS TRILHOS, ATÉ A PLATAFORMA!';
                            if(this.mode==='on_foot' && this.city.onTrainPlatform(current)){
                                this.triggerEndScreen('TRAIN PURSUIT CONCLUÍDA!',
                                    'Tanner alcançou o trem e encontrou a testemunha na plataforma.');
                                return;
                            }
                        }
                    }
                    if (this.missionType === 'pursuit') {
                        const result = this.pursuitChapter.update(dt, {
                            markersCollected: this.markersCollected,
                            felony: this.felony,
                            position: this.getPlayerPosition(),
                            mode: this.mode,
                            policeNear: this.isPoliceNearPlayer(40),
                            safeHouseZone: this.city.safeHouseZone
                        });
                        const objEl = document.getElementById('objective-banner');
                        const subEl = document.getElementById('mission-subcounter');
                        subEl.textContent = result.status;
                        if (result.changed && result.phase === 1) {
                            const escapeRoute = [
                                { x: 0, z: 85 }, { x: -80, z: 0 }, { x: -80, z: -80 }
                            ];
                            escapeRoute.forEach(p => this.spawnMarkerRing(p.x, p.z, 0xfacc15));
                            this.totalMarkers = escapeRoute.length;
                            this.markersCollected = 0;
                            DriverCheckpointRoute.refresh(this.missionType, this.missionMarkers);
                            objEl.textContent = 'ATO 2: passe pelos três portões amarelos na ordem indicada no radar.';
                        } else if (result.changed && result.phase === 2) {
                            objEl.textContent = 'ATO 3: despiste as viaturas (delito abaixo de 35%) e ' +
                                'entre A PÉ no esconderijo verde.';
                        }
                        if (result.complete) {
                            this.triggerEndScreen('CERCO SUPERADO!',
                                'Tanner passou pelo bloqueio, despistou as viaturas e entrou no esconderijo.');
                            return;
                        }
                    }
                    if (this.missionType === 'survival') {
                        this.survivalElapsed += dt;
                        this.felony = 100;
                        return;
                    }

                    this.missionTimeLeft -= dt;
                    if (this.missionTimeLeft <= 0 && this.missionType !== 'tail') {
                        this.missionTimeLeft = 0;
                        this.triggerEndScreen('TEMPO ESGOTADO!', 'O cronômetro chegou a zero antes de você concluir o objetivo da missão.');
                        return;
                    }

                    if ((this.missionType === 'chase' || this.missionType === 'quickchase') && this.targetCar) {
                        if (this.targetCar.damage >= 100) {
                            this.triggerEndScreen('ALVO INTERCEPTADO!', 'Você destruiu o veículo fugitivo com precisão digna de John Tanner!');
                            return;
                        }
                    } else if (this.missionType === 'checkpoints') {
                        if (this.markersCollected >= this.totalMarkers && this.mode === 'on_foot') {
                            const dSafe = Math.hypot(
                                this.tanner.group.position.x - this.city.safeHouseZone.x,
                                this.tanner.group.position.z - this.city.safeHouseZone.z
                            );
                            if (dSafe <= this.city.safeHouseZone.radius) {
                                this.triggerEndScreen('ROTA CONCLUÍDA!', 'Você passou por todos os Checkpoints e entrou a pé no Esconderijo em segurança!');
                                return;
                            }
                        }
                    } else if (this.missionType === 'evidence') {
                        const subEl = document.getElementById('mission-subcounter');
                        const objEl = document.getElementById('objective-banner');
                        if (this.markersCollected >= this.totalMarkers) {
                            if (this.evidencePhase !== 1) {
                                this.evidencePhase = 1;
                                objEl.textContent =
                                    'ETAPA 2: despiste as viaturas e entre A PÉ no esconderijo verde.';
                            }
                            const position = this.getPlayerPosition();
                            const safe = this.city.safeHouseZone;
                            const distance = Math.hypot(position.x - safe.x, position.z - safe.z);
                            const clear = this.felony < 25 && !this.isPoliceNearPlayer(42);
                            subEl.textContent = `ESCONDERIJO: ${Math.round(distance)}m | ` +
                                `DELITO: ${Math.round(this.felony)}% (META: <25%)`;
                            if (clear && this.mode === 'on_foot' && distance <= safe.radius) {
                                this.triggerEndScreen('DOSSIÊS RECUPERADOS!',
                                    'Você recolheu as provas e despistou a polícia antes de entrar no esconderijo.');
                                return;
                            }
                        }
                    } else if (this.missionType === 'getaway') {
                        if (this.mode === 'on_foot') {
                            const dSafe = Math.hypot(
                                this.tanner.group.position.x - this.city.safeHouseZone.x,
                                this.tanner.group.position.z - this.city.safeHouseZone.z
                            );
                            if (dSafe <= this.city.safeHouseZone.radius) {
                                this.triggerEndScreen('ENTREGA CONCLUÍDA!', 'Você escapou do cerco policial e chegou ao Esconderijo!');
                                return;
                            }
                        }
                    } else if (this.missionType === 'trailblazer' || this.missionType === 'mountainpass') {
                        if (this.markersCollected >= this.totalMarkers) {
                            this.triggerEndScreen('RECORDE BATIDO!', `Você completou todo o percurso restando ${this.missionTimeLeft.toFixed(1)}s no cronômetro!`);
                            return;
                        }
                    } else if (this.missionType === 'tail' && this.targetCar) {
                        const pos = this.getPlayerPosition();
                        const dist = Math.hypot(pos.x - this.targetCar.x, pos.z - this.targetCar.z);
                        const subEl = document.getElementById('mission-subcounter');
                        if (dist < 14) {
                            this.tailOutOfRangeTimer += dt;
                            subEl.textContent = `⚠️ PERTO DEMAIS (${Math.round(dist)}m)! AFASTE-SE!`;
                            subEl.className = 'text-xs font-extrabold text-red-400';
                        } else if (dist > 78) {
                            this.tailOutOfRangeTimer += dt;
                            subEl.textContent = `⚠️ LONGE DEMAIS (${Math.round(dist)}m)! APROXIME-SE!`;
                            subEl.className = 'text-xs font-extrabold text-amber-400';
                        } else {
                            this.tailOutOfRangeTimer = Math.max(0, this.tailOutOfRangeTimer - dt);
                            subEl.textContent = `DISTÂNCIA STEALTH OK: ${Math.round(dist)}m`;
                            subEl.className = 'text-xs font-extrabold text-emerald-400';
                        }

                        if (this.tailOutOfRangeTimer > 4.0) {
                            this.triggerEndScreen('MISSÃO FALHOU!', dist < 14 ? 'Você chegou perto demais e os capangas de Vasquez descobriram você!' : 'Vasquez despistou você no trânsito!');
                            return;
                        }
                        if (this.missionTimeLeft <= 0.15) {
                            this.triggerEndScreen('MISSÃO 4 CONCLUÍDA!', 'Você seguiu Vasquez até o encontro secreto sem ser detectado!');
                            return;
                        }
                    } else if (this.missionType === 'gauntlet') {
                        const smashedCount = this.pedManager.roadblocks.filter(r => r.smashed).length;
                        document.getElementById('mission-subcounter').textContent = `BARRICADAS DESTRUÍDAS: ${smashedCount} / 5`;
                        if (smashedCount >= 5) {
                            this.triggerEndScreen('BLOQUEIOS FURADOS!', 'Você destruiu as barricadas policiais como num filme de ação dos anos 70!');
                            return;
                        }
                    } else if (this.missionType === 'bomb' && this.c4State.active) {
                        const pos = this.getPlayerPosition();
                        const dist = Math.hypot(pos.x - this.c4State.x, pos.z - this.c4State.z);
                        const subEl = document.getElementById('mission-subcounter');
                        if (!this.c4State.planted) {
                            subEl.textContent = `DISTÂNCIA ATÉ O ALVO C4: ${Math.round(dist)}m (SAIA DO CARRO P/ PLANTAR)`;
                        } else {
                            this.c4State.timer -= dt;
                            this.c4State.beepAccum += dt;
                            const beepInterval = this.c4State.timer < 5 ? 0.22 : 0.65;
                            if (this.c4State.beepAccum >= beepInterval) {
                                this.c4State.beepAccum = 0;
                                this.audio.playC4Beep(this.c4State.timer < 5);
                            }
                            subEl.textContent = `💣 DETONAÇÃO EM: ${Math.max(0, this.c4State.timer).toFixed(1)}s | DISTÂNCIA: ${Math.round(dist)}m (MÍN: 65m)`;
                            subEl.className = dist >= 65 ? 'text-xs font-extrabold text-emerald-400' : 'text-xs font-extrabold text-red-400';

                            if (this.c4State.timer <= 0) {
                                this.audio.playBigExplosion();
                                this.effects.spawnMassiveExplosion(this.c4State.x, 0, this.c4State.z);
                                if (this.c4TargetMesh) this.c4TargetMesh.visible = false;
                                if (dist < 65) {
                                    this.triggerEndScreen('ATINGIDO PELA EXPLOSÃO!', 'Você ficou a menos de 65 metros da detonação do C4!');
                                } else {
                                    this.triggerEndScreen('SABOTAGEM CONCLUÍDA!', 'BUM! O depósito de Vasquez foi pelos ares enquanto você escapava em segurança!');
                                }
                                return;
                            }
                        }
                    } else if (this.missionType === 'heist' && this.targetCar) {
                        const subEl = document.getElementById('mission-subcounter');
                        if (this.playerCar === this.targetCar) {
                            const dSafe = Math.hypot(this.playerCar.x - this.city.safeHouseZone.x, this.playerCar.z - this.city.safeHouseZone.z);
                            subEl.textContent = `FASE 2: LEVE O CAMINHÃO AO ESCONDERIJO VERDE (${Math.round(dSafe)}m)`;
                            if (dSafe < 11) {
                                this.triggerEndScreen('CARGA ENTREGUE!', 'Você sequestrou o Caminhão Blindado e entregou a carga no esconderijo!');
                                return;
                            }
                        } else {
                            const pos = this.getPlayerPosition();
                            const dTruck = Math.hypot(pos.x - this.targetCar.x, pos.z - this.targetCar.z);
                            subEl.textContent = `FASE 1: ROUBE O CAMINHÃO BLINDADO (${Math.round(dTruck)}m)`;
                        }
                    }
                }
            }

            triggerEndScreen(title, desc) {
                this.gameEnded = true;
                if(!/FALH|ESGOTAD|DESTRUÍDO|ESCAPOU|ATINGIDO|FIM DO SURVIVAL/i.test(title))
                    this.completedMissions.add(this.missionType);
                document.getElementById('announcement-title').textContent = title;
                document.getElementById('announcement-desc').textContent = desc;
                document.getElementById('center-announcement').classList.remove('hidden');
            }

            updateCamera(dt) {
                this.cameraRig.update(
                    this.camera, this.getPlayerPosition(), this.playerCar,
                    this.mode,
                    this.missionType === 'pursuit' && this.pursuitChapter.introSeconds > 0
                        ? 2 : this.cameraMode,
                    this.lookBackActive, this.city, dt
                );
                this.impactFeedback.update(dt, this.camera, this.impactFlash,
                    this.reducedMotion);
            }

            updateHUD() {
                const dmg = this.playerCar ? Math.round(this.playerCar.damage) : 0;
                const fel = Math.round(this.felony);

                document.getElementById('damage-pct').textContent = `${dmg}%`;
                document.getElementById('damage-bar').style.width = `${dmg}%`;

                document.getElementById('felony-pct').textContent = `${fel}%`;
                const felBar = document.getElementById('felony-bar');
                felBar.style.width = `${fel}%`;
                if (fel > 25) felBar.classList.add('felony-flash');
                else felBar.classList.remove('felony-flash');

                const kmh = (this.mode === 'driving' && this.playerCar)
                    ? Math.round(Math.abs(this.playerCar.speed) * 3.4)
                    : 0;
                document.getElementById('speed-value').textContent = String(kmh).padStart(3, '0');
                document.getElementById('rpm-bar').style.width = `${Math.min(100, 12 + (kmh / 185) * 88)}%`;

                if (this.playerCar) {
                    document.getElementById('car-name-label').textContent = this.playerCar.name;
                    document.getElementById('hubcaps-counter').textContent = `${this.playerCar.hubcaps}/4`;
                    const driftBadge = document.getElementById('drift-badge');
                    if (this.playerCar.isBurnout) {
                        driftBadge.textContent = 'BURNOUT 180°!';
                        driftBadge.style.opacity = '1';
                    } else if (this.playerCar.isDrifting) {
                        driftBadge.textContent = 'DRIFT!';
                        driftBadge.style.opacity = '1';
                    } else {
                        driftBadge.style.opacity = '0';
                    }

                    const sirenBadge = document.getElementById('siren-badge');
                    if (this.playerCar.isPolice && this.playerCar.sirenActive) {
                        sirenBadge.classList.remove('hidden');
                    } else {
                        sirenBadge.classList.add('hidden');
                    }
                }

                const stealthHud=document.getElementById('tail-proximity');
                if(stealthHud && this.missionType==='story_drop'&&this.dropStatus){
                    const s=this.dropStatus;
                    const needle=document.getElementById('tail-needle');
                    const warning=document.getElementById('tail-zone-label');
                    const caution=document.getElementById('tail-exposure');
                    const ratio=Math.min(100,Math.max(0,
                        (s.distance/140)*100));
                    needle.style.left=ratio+'%';
                    warning.textContent=s.zone==='green'?'SEGURANÇA':
                        s.zone==='close'?'PERTO DEMAIS':'MUITO LONGE';
                    warning.className='tail-zone-'+s.zone;
                    caution.textContent='SUSPEITA '+Math.round(s.suspicion)+
                        '% • DISTÂNCIA '+Math.round(s.distance)+' m';
                    stealthHud.setAttribute('aria-valuenow',String(Math.round(s.distance)));
                }
                // Aviso antecipado só para barricadas existentes e à frente.
                const warningEl = document.getElementById('roadblock-warning');
                const warning = this.roadblockDirector.warning(
                    this.mode === 'driving' ? this.playerCar : null, this.pedManager
                );
                if (warningEl) {
                    warningEl.classList.toggle('hidden', !warning);
                    if (warning) {
                        const message = warning.arming ?
                            `POLÍCIA MONTANDO BLOQUEIO • ${warning.distance}m` :
                            `BLOQUEIO POLICIAL À FRENTE • ${warning.distance}m`;
                        if (warningEl.textContent !== message) warningEl.textContent = message;
                    }
                }

                const progress = document.getElementById('mission-compact-progress');
                if (progress) {
                    let label = this.missionActive ? 'MISSÃO EM ANDAMENTO' : 'PASSEIO LIVRE';
                    if (this.missionType === 'story_drop') {
                        label='CHICAGO 04 • VIGILÂNCIA';
                    } else if (this.missionType === 'pursuit') {
                        label = ['ATO 1/3 • CERCO','ATO 2/3 • ROTA','ATO 3/3 • FUGA'][
                            this.pursuitChapter.phase
                        ];
                    } else if (this.missionMarkers.length) {
                        label = `ETAPA ${this.markersCollected}/${this.totalMarkers}`;
                    }
                    if (progress.textContent !== label) progress.textContent = label;
                }

                if (this.missionActive) {
                    const timeVal = (this.missionType === 'survival') ? this.survivalElapsed : this.missionTimeLeft;
                    const mins = Math.floor(timeVal / 60);
                    const secs = Math.floor(timeVal % 60);
                    const ms = Math.floor((timeVal % 1) * 100);
                    document.getElementById('mission-timer').textContent =
                        `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
                }

                // Prompt de interação quando Tanner está a pé perto do interruptor secreto ou de um carro
                const promptEl = document.getElementById('interaction-prompt');
                if (this.mode === 'on_foot') {
                    const distSwitch = Math.hypot(
                        this.tanner.group.position.x - this.city.secretSwitchPos.x,
                        this.tanner.group.position.z - this.city.secretSwitchPos.z
                    );
                    if (distSwitch < 5.5 && !this.city.secretGateOpen) {
                        promptEl.textContent = 'Pressione [E] para acionar o INTERRUPTOR DA GARAGEM SECRETA!';
                        promptEl.classList.remove('hidden');
                    } else if (this.c4State.active && !this.c4State.planted &&
                        Math.hypot(this.tanner.group.position.x - this.c4State.x, this.tanner.group.position.z - this.c4State.z) < 6.5) {
                        promptEl.textContent = '💣 Pressione [E] para PLANTAR O EXPLOSIVO C4!';
                        promptEl.classList.remove('hidden');
                    } else {
                        let nearBench = false;
                        for (const b of this.city.benches) {
                            if (Math.hypot(this.tanner.group.position.x - b.x, this.tanner.group.position.z - b.z) < 3.5) {
                                nearBench = true;
                                break;
                            }
                        }
                        let nearCar = null;
                        for (const v of this.vehicles) {
                            const d = Math.hypot(v.x - this.tanner.group.position.x, v.z - this.tanner.group.position.z);
                            if (d < 6.2) { nearCar = v; break; }
                        }
                        if (nearBench) {
                            promptEl.textContent = this.tanner.isSitting
                                ? 'Pressione [E] ou mova-se para levantar do banco'
                                : '🪑 Pressione [E] para SENTAR NO BANCO DE PRAÇA (Easter Egg Driver 2)';
                            promptEl.classList.remove('hidden');
                        } else if (nearCar) {
                            promptEl.textContent = `Pressione [E] ou [ENTER] para dirigir ${nearCar.name}`;
                            promptEl.classList.remove('hidden');
                        } else {
                            promptEl.classList.add('hidden');
                        }
                    }
                } else {
                    promptEl.classList.add('hidden');
                }

                this.drawRadar();
            }

            updateInteriorHUD() {
                const prompt=document.getElementById('interaction-prompt');
                const banner=document.getElementById('interior-banner');
                if(banner)banner.classList.toggle('hidden',!this.interiorPlace);
                if(this.mode!=='on_foot')return;
                if(this.interiorPlace){
                    const t=this.tanner.group.position;
                    const exit=this.interiorPlace.exit;
                    const atExit=Math.hypot(t.x-exit.x,t.z-exit.z)<4.2;
                    prompt.textContent=this.nearSaveDesk()?
                        'MESA VERDE: E ou F para salvar seu jogo':
                        atExit?'Pressione E para SAIR do prédio':
                        'Explore o prédio. Caminhe até a porta para sair.';
                    prompt.classList.remove('hidden');
                    return;
                }
                const pos=this.tanner.group.position;
                const entry=this.city.interiorAt(pos.x,pos.z);
                if(entry){
                    prompt.textContent='E ou ENTER: ENTRAR EM '+entry.name.toUpperCase();
                    prompt.classList.remove('hidden');
                }
            }

            toggleRadarZoom() {
                this.radarWide=!this.radarWide;
                const button=document.getElementById('btn-radar-zoom');
                if(button)button.textContent=this.radarWide?'RADAR PERTO':'MAPA GERAL';
            }

            drawRadar() {
                const ctx = this.radarCtx;
                const w = this.radarCanvas.width;
                const h = this.radarCanvas.height;
                const cx = w / 2;
                const cy = h / 2;
                const scale = this.radarWide ? 0.16 : 0.52;

                ctx.clearRect(0, 0, w, h);
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 0, w, h);

                const pos = this.getPlayerPosition();
                if(this.interiorPlace) {
                    ctx.fillStyle='#1e293b';
                    ctx.fillRect(15,17,w-30,h-34);
                    ctx.strokeStyle='#86efac';
                    ctx.strokeRect(16,18,w-32,h-36);
                    ctx.fillStyle='#4ade80';
                    if(this.interiorPlace.id==='home')ctx.fillRect(cx-7,cy-18,14,8);
                    ctx.fillStyle='#38bdf8';
                    ctx.fillRect(cx-9,h-27,18,5);
                    ctx.fillStyle='#facc15';
                    ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);ctx.fill();
                    ctx.fillStyle='#e2e8f0';
                    ctx.font='bold 11px sans-serif';ctx.textAlign='center';
                    ctx.fillText(this.interiorPlace.id==='home'?'CASA':'DEPÓSITO',cx,14);
                    return;
                }

                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(pos.heading);

                // Canal no radar
                const riverY = -(50 - pos.z) * scale;
                ctx.fillStyle = '#0369a1';
                ctx.fillRect(-200, riverY - 9, 400, 18);

                // Prédios no radar
                ctx.fillStyle = '#334155';
                for (const b of this.city.buildingBoxes) {
                    if (b.minX > 1000) continue;
                    const bx = (b.minX - pos.x) * scale;
                    const bz = -(b.maxZ - pos.z) * scale;
                    const bw = (b.maxX - b.minX) * scale;
                    const bh = (b.maxZ - b.minZ) * scale;
                    ctx.fillRect(bx, bz, bw, bh);
                }

                // Esconderijo (Safe House) em verde
                const sx = (this.city.safeHouseZone.x - pos.x) * scale;
                const sz = -(this.city.safeHouseZone.z - pos.z) * scale;
                ctx.fillStyle = '#10b981';
                ctx.beginPath();
                ctx.arc(sx, sz, 5, 0, Math.PI * 2);
                ctx.fill();

                // Garagem Secreta (Ponto Roxo Especial no Nordeste)
                const gx = (this.city.secretGarageCenter.x - pos.x) * scale;
                const gz = -(this.city.secretGarageCenter.z - pos.z) * scale;
                ctx.fillStyle = '#c084fc';
                ctx.fillRect(gx - 4, gz - 4, 8, 8);

                // Trem vermelho e estação (verde) no radar de Chicago.
                if(this.missionType==='story_train'&&this.trainLine?.active){
                    const tp=this.trainLine.position;
                    const tx=(tp.x-pos.x)*scale,tz=-(tp.z-pos.z)*scale;
                    ctx.fillStyle='#ef4444';ctx.fillRect(tx-4,tz-8,8,17);
                    ctx.fillStyle='#4ade80';
                    const ex=(-14-pos.x)*scale,ez=-(-260-pos.z)*scale;
                    ctx.fillRect(ex-5,ez-5,10,10);
                }

                // Checkpoints / Marcadores de Trailblazer no radar
                for (const m of this.missionMarkers) {
                    if (!DriverCheckpointRoute.isActive(this.missionType, this.missionMarkers, m)) continue;
                    const mx = (m.x - pos.x) * scale;
                    const mz = -(m.z - pos.z) * scale;
                    ctx.fillStyle = '#facc15';
                    ctx.beginPath();
                    ctx.arc(mx, mz, 4.5, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Outros veículos e Polícia no radar
                for (const v of this.vehicles) {
                    if (v === this.playerCar && this.mode === 'driving') continue;
                    const vx = (v.x - pos.x) * scale;
                    const vz = -(v.z - pos.z) * scale;

                    if (v.isPolice) {
                        ctx.fillStyle = (Math.floor(Date.now() / 180) % 2 === 0) ? '#ef4444' : '#3b82f6';
                        ctx.beginPath();
                        ctx.arc(vx, vz, 4.2, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (v.isTarget) {
                        ctx.fillStyle = '#ef4444';
                        ctx.beginPath();
                        ctx.arc(vx, vz, 5.5, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (v.isSecret) {
                        ctx.fillStyle = '#e879f9';
                        ctx.beginPath();
                        ctx.arc(vx, vz, 4.5, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        ctx.fillStyle = '#94a3b8';
                        ctx.fillRect(vx - 2, vz - 2, 4, 4);
                    }
                }

                ctx.restore();

                // Seta central do Jogador (Tanner)
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.moveTo(cx, cy - 6);
                ctx.lineTo(cx - 5, cy + 5);
                ctx.lineTo(cx + 5, cy + 5);
                ctx.closePath();
                ctx.fill();
            }

            // =========================================================================
            // MÉTODOS DO VISUALIZADOR DE ARQUITETURA E LOADER DE ASSETS EXTERNOS (.GLB)
            // =========================================================================
            selectVFSFile(filename) {
                this.currentVFSFile = filename;
                document.getElementById('vfs-filename-title').textContent = filename;
                document.getElementById('vfs-code-viewer').textContent = VFS_MODULES[filename] || '';
            }

            copyVFSCode() {
                const code = VFS_MODULES[this.currentVFSFile] || '';
                const textarea = document.createElement('textarea');
                textarea.value = code;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                document.getElementById('vfs-filename-title').textContent = `${this.currentVFSFile} (Copiado!)`;
            }

            downloadCurrentVFSFile() {
                const code = VFS_MODULES[this.currentVFSFile] || '';
                const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = this.currentVFSFile.split('/').pop();
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            downloadCompleteIndexHTML() {
                const htmlContent = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
                const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'index.html';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            downloadAllGitHubFiles() {
                const filesToExport = ['README.md', 'package.json', '.github/workflows/deploy.yml'];
                filesToExport.forEach((fileKey, idx) => {
                    setTimeout(() => {
                        const code = VFS_MODULES[fileKey] || '';
                        const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = fileKey.split('/').pop();
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, idx * 250);
                });
            }

            copyGitCommands() {
                const cmdText = document.getElementById('git-cli-commands').textContent;
                const textarea = document.createElement('textarea');
                textarea.value = cmdText;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                const btn = document.getElementById('btn-copy-git');
                if (btn) btn.textContent = '✅ Comandos Copiados!';
            }

            loadExternalGLB(url, labelName) {
                const statusEl = document.getElementById('asset-loader-status');
                statusEl.textContent = `Baixando modelo 3D externo (${labelName}) via THREE.GLTFLoader...`;
                if (!THREE.GLTFLoader) {
                    statusEl.textContent = 'Erro: THREE.GLTFLoader não disponível.';
                    return;
                }
                const loader = new THREE.GLTFLoader();
                loader.load(
                    url,
                    (gltf) => {
                        this.applyCustomModelToPlayerCar(gltf.scene, labelName);
                        statusEl.textContent = `Sucesso! Modelo "${labelName}" acoplado ao chassi físico de Tanner!`;
                    },
                    undefined,
                    (err) => {
                        statusEl.textContent = `Aviso ao carregar URL externa: verifique sua conexão. Mantendo malha padrão.`;
                    }
                );
            }

            loadLocalGLB(event) {
                const file = event.target.files[0];
                if (!file) return;
                const statusEl = document.getElementById('asset-loader-status');
                statusEl.textContent = `Processando arquivo local "${file.name}"...`;

                const url = URL.createObjectURL(file);
                const loader = new THREE.GLTFLoader();
                loader.load(
                    url,
                    (gltf) => {
                        this.applyCustomModelToPlayerCar(gltf.scene, file.name.replace(/\..+$/, '').toUpperCase());
                        statusEl.textContent = `Sucesso! Seu arquivo 3D "${file.name}" está pronto para dirigir na cidade!`;
                        URL.revokeObjectURL(url);
                    },
                    undefined,
                    () => {
                        statusEl.textContent = `Formato inválido. Selecione um arquivo .glb ou .gltf válido.`;
                    }
                );
            }

            applyCustomModelToPlayerCar(modelScene, name) {
                if (!this.playerCar || !modelScene) return;
                // Remove a malha antiga e suas rodas, mas preserva faróis,
                // lanternas de freio e giroflex sobre o GLB importado.
                this.playerCar.applyCC0Model(modelScene, false);
                this.playerCar._userCustomModel = true;
                this.playerCar._cc0ModelApplied = false;
                this.playerCar.name = name.slice(0, 25);
            }

            restoreDefaultCarMesh() {
                if (!this.playerCar) return;
                this.playerCar._userCustomModel = false;
                this.playerCar.buildCarMesh();
                this.playerCar.name = CITY_PRESETS[this.currentCityKey].playerCarName;
                if (this.freeVehicleAssets && this.freeVehicleAssets.enabled) this.freeVehicleAssets.decorateFleet();
                document.getElementById('asset-loader-status').textContent =
                    'Malha Low-Poly PS1 original restaurada com sucesso!';
            }

            bindEvents() {
                window.addEventListener('resize', () => {
                    this.camera.aspect = window.innerWidth / window.innerHeight;
                    this.camera.updateProjectionMatrix();
                    this.renderer.setSize(window.innerWidth, window.innerHeight);
                });

                window.addEventListener('keydown', (e) => {
                    this.audio.init();
                    const code = e.code;
                    if (code === 'KeyW' || code === 'ArrowUp') this.input.up = true;
                    if (code === 'KeyS' || code === 'ArrowDown') this.input.down = true;
                    if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = true;
                    if (code === 'KeyD' || code === 'ArrowRight') this.input.right = true;
                    if (code === 'Space') this.input.handbrake = true;
                    if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyC') this.input.sprint = true;

                    if((code==='KeyE'||code==='Enter')&&!e.repeat)
                        this.toggleVehicleEnterExit();
                    if(code==='KeyF'&&!e.repeat)this.saveAtHome();
                    if (code === 'KeyV') this.cameraMode = (this.cameraMode + 1) % 3;
                    if (code === 'KeyQ') this.lookBackActive = true;
                    if (code === 'KeyN') this.cycleWeather();
                    if (code === 'KeyG'&&!e.repeat) this.toggleRadarZoom();
                    if (code === 'KeyM' && !e.repeat) this.freeVehicleAssets.toggle();
                    if (code === 'KeyL' && !e.repeat) this.togglePlayerHeadlights();
                    if (code === 'KeyH') this.triggerHornOrSiren();
                    if (code === 'KeyR') this.toggleReplayDirector();
                    if (code === 'KeyB') this.city.toggleBridge();
                });

                const clearInputs = () => {
                    Object.keys(this.input).forEach(key => { this.input[key] = false; });
                    this.lookBackActive = false;
                };
                window.addEventListener('blur', clearInputs);
                document.addEventListener('visibilitychange', () => {
                    if (document.hidden) clearInputs();
                });

                window.addEventListener('keyup', (e) => {
                    const code = e.code;
                    if (code === 'KeyW' || code === 'ArrowUp') this.input.up = false;
                    if (code === 'KeyS' || code === 'ArrowDown') this.input.down = false;
                    if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = false;
                    if (code === 'KeyD' || code === 'ArrowRight') this.input.right = false;
                    if (code === 'Space') this.input.handbrake = false;
                    if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyC') this.input.sprint = false;
                    if (code === 'KeyQ') this.lookBackActive = false;
                });

                // Botões de UI
                const objectiveToggle = document.getElementById('btn-objective-toggle');
                if (objectiveToggle) {
                    objectiveToggle.addEventListener('click', () => {
                        const center = document.getElementById('mission-center');
                        const opened = center.classList.toggle('objective-expanded');
                        objectiveToggle.setAttribute('aria-expanded',String(opened));
                        objectiveToggle.textContent = opened ?
                            'Recolher objetivo' : 'Ver objetivo completo';
                    });
                }
                const hudMore = document.getElementById('btn-hud-more');
                if (hudMore) {
                    hudMore.addEventListener('click', () => {
                        const controls = document.getElementById('hud-player-panel');
                        const opened = controls.classList.toggle('hud-expanded');
                        hudMore.setAttribute('aria-expanded',String(opened));
                        hudMore.textContent = opened ?
                            '⚙ Ocultar cidades / clima' : '⚙ Cidades / clima';
                    });
                }
                const radarZoom=document.getElementById('btn-radar-zoom');
                if(radarZoom)radarZoom.addEventListener('click',()=>this.toggleRadarZoom());
                const saveButton=document.getElementById('btn-save-home');
                if(saveButton)saveButton.addEventListener('click',()=>this.saveAtHome());
                const exitButton=document.getElementById('btn-leave-interior');
                if(exitButton)exitButton.addEventListener('click',()=>this.leaveInterior());
                const loadButton=document.getElementById('btn-load-home');
                if(loadButton)loadButton.addEventListener('click',()=>this.loadHomeGame());
                document.getElementById('btn-missions').addEventListener('click', () => {
                    document.getElementById('missions-modal').classList.remove('hidden');
                });
                document.getElementById('close-missions-modal').addEventListener('click', () => {
                    document.getElementById('missions-modal').classList.add('hidden');
                });
                document.getElementById('btn-architecture').addEventListener('click', () => {
                    document.getElementById('architecture-modal').classList.remove('hidden');
                });
                document.getElementById('close-arch-modal').addEventListener('click', () => {
                    document.getElementById('architecture-modal').classList.add('hidden');
                });
                document.getElementById('btn-director').addEventListener('click', () => {
                    this.toggleReplayDirector();
                });
                document.getElementById('btn-audio').addEventListener('click', (e) => {
                    this.audio.init();
                    const active = this.audio.toggleMute();
                    e.currentTarget.textContent = active ? '🔊' : '🔇';
                });
                document.getElementById('btn-free-assets').addEventListener('click', () => {
                    this.freeVehicleAssets.toggle();
                });
                const headlightButton = document.getElementById('btn-headlights');
                if (headlightButton) {
                    headlightButton.addEventListener('click', () => this.togglePlayerHeadlights());
                }
                document.getElementById('btn-camera').addEventListener('click', () => {
                    if (this.inReplayMode) this.cycleDirectorCamera();
                    else this.cameraMode = (this.cameraMode + 1) % 3;
                });
                document.getElementById('btn-toggle-bridge').addEventListener('click', () => {
                    this.city.toggleBridge();
                });
                document.getElementById('btn-restart-mode').addEventListener('click', () => {
                    this.startMission(this.missionType);
                });
                document.getElementById('btn-free-roam').addEventListener('click', () => {
                    this.startMission('freeroam');
                });

                document.querySelectorAll('.arch-tab-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        document.querySelectorAll('.arch-tab-btn').forEach(b => {
                            b.className = 'arch-tab-btn px-4 py-2 text-xs sm:text-sm font-bold rounded-t-lg bg-slate-800 text-slate-300 hover:bg-slate-700';
                        });
                        btn.className = 'arch-tab-btn px-4 py-2 text-xs sm:text-sm font-bold rounded-t-lg bg-indigo-600 text-white';

                        const targetId = btn.getAttribute('data-tab');
                        document.querySelectorAll('.arch-tab-content').forEach(c => c.classList.add('hidden'));
                        document.getElementById(targetId).classList.remove('hidden');
                    });
                });

                // Controles Touch Mobile
                const bindTouch = (id, key) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.style.touchAction = 'none';
                    el.addEventListener('pointerdown', e => {
                        e.preventDefault();
                        this.audio.init();
                        this.input[key] = true;
                        if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
                    });
                    const release = e => {
                        if (e && e.cancelable) e.preventDefault();
                        this.input[key] = false;
                    };
                    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(eventName => {
                        el.addEventListener(eventName, release);
                    });
                };
                bindTouch('touch-left', 'left');
                bindTouch('touch-right', 'right');
                bindTouch('touch-gas', 'up');
                bindTouch('touch-brake', 'down');
                bindTouch('touch-drift', 'handbrake');
                bindTouch('touch-burnout', 'sprint');
                const touchAction = document.getElementById('touch-action');
                if (touchAction) {
                    touchAction.addEventListener('pointerdown', e => {
                        e.preventDefault();
                        if (touchAction.dataset.pressed) return;
                        touchAction.dataset.pressed = '1';
                        this.toggleVehicleEnterExit();
                    });
                    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(eventName => {
                        touchAction.addEventListener(eventName, () => {
                            delete touchAction.dataset.pressed;
                        });
                    });
                }
            }

            animate() {
                requestAnimationFrame(() => this.animate());

                const now = performance.now();
                const dt = Math.min(0.05, (now - this.lastTime) / 1000);
                this.lastTime = now;

                this.frames++;
                this.fpsTimer += dt;
                if (this.fpsTimer >= 0.5) {
                    document.getElementById('fps-counter').textContent = Math.round(this.frames / this.fpsTimer);
                    this.frames = 0;
                    this.fpsTimer = 0;
                }

                if (this.inReplayMode) {
                    this.updateReplayPlayback(dt);
                    this.renderer.render(this.scene, this.camera);
                    return;
                }

                if (!this.gameEnded) {
                    if(this.trainLine&&this.missionType==='story_train'&&
                        this.missionActive)this.trainLine.update(dt);
                    if (this.mode === 'driving' && this.playerCar) {
                        this.playerCar.updatePhysics(dt, this.input, this.city, this.effects, this.audio, true);
                    } else {
                        this.tanner.update(dt, this.input, this.city);
                    }
                }

                this.updateAIAndCollisions(dt);
                this.city.update(dt, this.vehicles, () => {
                    if (this.isPoliceNearPlayer(65)) {
                        this.felony = Math.min(100, this.felony + 5);
                    }
                });
                this.pedManager.update(dt, this.vehicles, this.audio,
                    this.mode === 'driving' ? this.playerCar : null,
                    (car, barrier, speed) => {
                        const now = performance.now();
                        if (now - (car.lastBarrierImpactAt || -Infinity) < 350) return;
                        car.lastBarrierImpactAt = now;
                        car.damage = Math.min(100, car.damage + Math.min(9, speed * 0.13));
                        car.speed *= 0.72;
                        this.felony = Math.min(100, this.felony + (barrier.dynamic ? 2 : 0));
                        this.effects.spawnImpactSparks(car.x, car.y || 0, car.z,
                            Math.min(0.9,speed/38));
                        this.impactFeedback.trigger(speed * 0.65);
                    });
                this.effects.update(dt);
                this.effects.updateRain(dt, this.getPlayerPosition());
                this.updateFelonyAndMissions(dt);
                this.updateCamera(dt);
                this.recordReplayFrame();

                const speedKmh = (this.mode === 'driving' && this.playerCar) ? this.playerCar.speed * 3.4 : 0;
                const skidding = (this.mode === 'driving' && this.playerCar) ? this.playerCar.isDrifting : false;
                const burnout = (this.mode === 'driving' && this.playerCar) ? this.playerCar.isBurnout : false;
                const sirenOn = (this.felony > 25) || (this.mode === 'driving' && this.playerCar && this.playerCar.isPolice && this.playerCar.sirenActive);
                this.audio.update(dt, this.mode === 'driving', speedKmh, skidding, burnout, sirenOn);

                this.updateHUD();
                this.updateInteriorHUD();
                this.renderer.render(this.scene, this.camera);
            }
        }

        // Inicializa o Jogo quando a janela carregar
        window.onload = function () {
            window.DriverGame = new Driver2GameEngine();
            window.DriverGame.animate();
        };
    