        /**
         * ============================================================================
         * MÓDULO 7: MOTOR PRINCIPAL DO JOGO, FILM DIRECTOR REPLAY E DRIVING GAMES
         * ============================================================================
         */
        class Driver2GameEngine {
            constructor(config={}) {
                this.isPaused=false;
                this.loadingActive=!!config.deferCityBuild;
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
                this.briefingDirector=typeof DriverMissionBriefing!=='undefined'?
                    new DriverMissionBriefing():null;
                this.effects = new EffectsManager(this.scene);
                this.impactFeedback = new DriverImpactFeedback();
                this.impactFlash = document.getElementById('impact-flash');
                this.reducedMotion = !!(window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
                this.city = new CityBuilder(this.scene, this.currentCityKey,
                    !config.deferCityBuild);
                this.trafficAI = new DriverTrafficAI(this.city);
                this.collisionSystem = new DriverVehicleCollisions();
                this.pursuitChapter = new DriverPursuitChapter();
                this.dropDirector=new DriverTailingDropMission();
                this.intruderDirector=new DriverIntruderPursuit();
                this.caineDirector=new DriverCaineCompound();
                this.leavingDirector=new DriverLeavingChicago();
                this.leavingStatus=null;this.leavingMafia=[];this.stationJones=null;
                this.havanaLeadDirector=new DriverHavanaLead();
                this.havanaLeadStatus=null;
                this._startingHavana=false;
                this.caineStatus=null;
                this.caineVans=[];
                this.intruderStatus=null;
                this.intruderBlocker=null;
                this.safeHouseEscape=new DriverSafeHouseEscape();
                this.safeHouseStatus=null;
                this.dropStatus=null;
                this.trainLine=new DriverChicagoTrain(this.scene,this.city);
                this.trainLostSeconds=0;
                this.homeSave=new DriverHomeSave(
                    (()=>{try{return window.localStorage}catch(e){return null}})()
                );
                this.tannerGarage=new DriverTannerGarage(this.homeSave.storage);
                this.garagePanelOpen=false;
                this.navigationHome=false;
                this.debugVehiclePhysics=false;
                this.policeDoorTransition=null;
                this.completedMissions=new Set();
                this.storyCampaign=false;
                this.missionToastRemaining=0;
                this.missionToastText='';
                this.chapterProgress=new DriverChapterProgress(this.homeSave.storage);
                for(const mission of this.chapterProgress.regionalCompleted)
                    this.completedMissions.add(mission);
                // Saves antigos de Chicago 08 também liberam a nova etapa.
                const legacySave=this.homeSave.read();
                if(legacySave?.completed?.includes('story_leaving') ||
                    legacySave?.completed?.includes('story_havana_lead'))
                    this.chapterProgress.unlockHavana();
                if(legacySave?.completed?.includes('story_havana_lead'))
                    this.chapterProgress.completeHavanaLead();
                this.interiorPlace=null;
                this.witnessCloseTime=0;
                this.tanner = new TannerController(this.scene);
                this.pedManager = new PedestrianAndRoadblockManager(this.scene);
                this.roadblockDirector = new PoliceRoadblockDirector();
                this.pedManager.spawnCityPedestrians(this.city,{x:0,z:-20});

                this.mode = 'driving';
                this.cameraMode = 0;
                this.radarWide = false;
                this.lookBackActive = false;
                this.weatherMode = 'default';
                this.felony = 0;
                this.roadblocksSpawned = false;
                this.missionType = 'freeroam';
                this.chicagoGuidance=null;
                this.chicagoGuidanceStage=null;
                this.classicState=null;
                this.regionalState=null;
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
                this.updateChapterMenu();

                this.currentVFSFile = 'assets/AssetManifest.json';
                this.selectVFSFile(this.currentVFSFile);

                this.lastTime = performance.now();
                this.frames = 0;
                this.fpsTimer = 0;
            }

            updateChapterMenu() {
                const unlocked=this.chapterProgress.canTravelToHavana();
                const resume=document.getElementById('btn-resume-havana');
                if(resume)resume.classList.toggle('hidden',!unlocked);
                const missionButton=document.getElementById('btn-story-havana-lead');
                if(missionButton)missionButton.classList.toggle('hidden',!unlocked);
                if(resume)resume.textContent=this.chapterProgress.hasCompletedHavanaLead()?
                    'REPETIR HAVANA 09 • FOLLOW UP THE LEAD':
                    'INICIAR HAVANA 09 • FOLLOW UP THE LEAD';
                const status=document.getElementById('chicago-chapter-status');
                if(status)status.textContent=!unlocked?
                    'CHICAGO 08 PENDENTE • HAVANA LIVRE DISPONÍVEL':
                    this.chapterProgress.hasCompletedHavanaLead()?
                    'CHICAGO 08 E HAVANA 09 CONCLUÍDAS • PROGRESSO SALVO':
                    'CHICAGO 08 CONCLUÍDA • HAVANA 09 DISPONÍVEL';
            }

            async beginHavanaChapter() {
                return this.startHavanaLead();
            }

            async startHavanaLead() {
                if(!this.chapterProgress.canTravelToHavana() ||
                    this._startingHavana || window.DriverBoot?.busy)return false;
                this._startingHavana=true;
                try {
                    if(this.currentCityKey!=='havana'){
                        this.missionType='freeroam';
                        const loaded=await this.requestCityChange('havana');
                        if(!loaded)return false;
                    }
                    this.startMission('story_havana_lead');
                    this.updateChapterMenu();
                    return true;
                } finally {this._startingHavana=false;}
            }

            changeCity(cityKey) {
                if (!CITY_PRESETS[cityKey]) return;
                this.city.loadCityPreset(cityKey);
                this.activateCityPreset(cityKey);
            }

            requestCityChange(cityKey) {
                if (!CITY_PRESETS[cityKey])return Promise.resolve(false);
                if(window.DriverBoot)
                    return window.DriverBoot.switchCity(this,cityKey);
                this.changeCity(cityKey);
                return Promise.resolve(true);
            }

            activateCityPreset(cityKey) {
                this.currentCityKey = cityKey;
                const preset = CITY_PRESETS[cityKey];

                this.scene.background.setHex(preset.skyColor);
                this.scene.fog.color.setHex(preset.skyColor);
                this.sunLight.color.setHex(preset.sunColor);

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
                if(this.policeDoorTransition){
                    if(typeof DriverPoliceDoorRig!=='undefined')
                        DriverPoliceDoorRig.cancel(
                            this.policeDoorTransition.vehicle);
                    this.policeDoorTransition=null;
                }
                this.vehicles.forEach(v => {
                    GPUResourceUtils.disposeSubtree(v.root);
                    this.scene.remove(v.root);
                });
                this.vehicles = [];
                this.wrigleyCar=null;
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
                this.vehicles.forEach(v => {
                    v.wetRoad=this.weatherMode==='rain';
                    VehicleVisuals.setHeadlights(v, lowLight);
                });
                if (this.freeVehicleAssets) this.freeVehicleAssets.decorateFleet();
                if(typeof DriverSecretCars!=='undefined')
                    DriverSecretCars.apply(this.secretCar,this.currentCityKey);
            }

            setWeather(mode) {
                this.weatherMode = mode;
                if (this.vehicles) {
                    const lowLight = mode === 'night' || mode === 'rain';
                    this.vehicles.forEach(v => {
                        v.wetRoad=mode==='rain';
                        VehicleVisuals.setHeadlights(v, lowLight);
                    });
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
                if(type.startsWith('story_'))this.storyCampaign=true;
                if(typeof DriverRegionalMissions!=='undefined' &&
                    DriverRegionalMissions.isRegional(type)){
                    const requiredCity=DriverRegionalMissions.SPECS[type][0];
                    if(this.currentCityKey!==requiredCity){
                        // activateCityPreset normally restarts the previous
                        // mission; avoid recursive cross-city restarts when
                        // switching from one chapter straight into another.
                        this.missionType='freeroam';
                        this.changeCity(requiredCity);
                    }
                }
                this.missionToastRemaining=0;
                if(type==='story_havana_lead' && this.currentCityKey!=='havana'){
                    this.startHavanaLead();
                    return;
                }
                if((type==='story_tipoff'||type==='story_witness'||type==='story_train'||type==='story_drop'||type==='story_safehouse'||type==='story_intruder'||type==='story_caine'||type==='story_leaving') &&
                    this.currentCityKey!=='chicago')this.changeCity('chicago');
                document.getElementById('missions-modal').classList.add('hidden');
                document.getElementById('center-announcement').classList.add('hidden');

                this.inReplayMode = false;
                document.getElementById('director-banner').classList.add('hidden');

                this.missionType = type;
                this.chicagoGuidance=null;
                this.chicagoGuidanceStage=null;
                this.gameEnded = false;
                if(this.stationJones){
                    GPUResourceUtils.disposeSubtree(this.stationJones);
                    this.scene.remove(this.stationJones);this.stationJones=null;
                }
                this.briefingDirector?.cancel();
                if(typeof DriverClassicGames!=='undefined')
                    DriverClassicGames.dispose(this);
                if(typeof DriverRegionalMissions!=='undefined')
                    DriverRegionalMissions.dispose(this);
                this.clearMissionMarkers();
                this.spawnAllVehicles();
                if(this.trainLine)this.trainLine.reset(type==='story_train');
                this.trainLostSeconds=0;
                this.pedManager.spawnCityPedestrians(this.city,this.getPlayerPosition());
                this.roadblockDirector.reset();
                this.roadblocksSpawned = false;
                this.tailOutOfRangeTimer = 0;
                this.dropDirector.reset();
                this.dropStatus=null;
                this.intruderDirector.reset();
                this.intruderStatus=null;
                this.caineDirector.reset();
                this.caineStatus=null;this.caineVans=[];
                this.leavingDirector.reset();
                this.leavingStatus=null;this.leavingMafia=[];
                this.havanaLeadDirector.reset();
                this.havanaLeadStatus=null;
                this.city.caineBridgeClosed=false;
                this.city.bridgeRaised=false;
                this.intruderBlocker=null;
                this.safeHouseEscape.reset();
                this.safeHouseStatus=null;
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
                const escapePanel=document.getElementById('safehouse-escape-progress');
                if(escapePanel)escapePanel.classList.toggle('hidden',
                    type!=='story_safehouse');
                const intruderPanel=document.getElementById('intruder-chase-progress');
                if(intruderPanel)intruderPanel.classList.toggle('hidden',
                    type!=='story_intruder');
                const cainePanel=document.getElementById('caine-escape-progress');
                if(cainePanel)cainePanel.classList.toggle('hidden',
                    type!=='story_caine');
                const leavingPanel=document.getElementById('leaving-chicago-progress');
                if(leavingPanel)leavingPanel.classList.toggle('hidden',
                    type!=='story_leaving');
                const havanaPanel=document.getElementById('havana-lead-progress');
                if(havanaPanel)havanaPanel.classList.toggle('hidden',
                    type!=='story_havana_lead');

                const cityTitle = CITY_PRESETS[this.currentCityKey].name;
                const titleEl = document.getElementById('mission-title');
                const timerEl = document.getElementById('mission-timer');
                const subEl = document.getElementById('mission-subcounter');
                const objEl = document.getElementById('objective-banner');

                if(typeof DriverClassicGames!=='undefined' &&
                    DriverClassicGames.isClassic(type)){
                    DriverClassicGames.begin(this,type);
                }else if(typeof DriverRegionalMissions!=='undefined' &&
                    DriverRegionalMissions.isRegional(type)){
                    DriverRegionalMissions.begin(this,type);
                }else if (type === 'freeroam') {
                    this.missionActive = false;
                    titleEl.textContent = `TAKE A RIDE: ${cityTitle}`;
                    timerEl.classList.add('hidden');
                    objEl.innerHTML = 'Passeio livre! Pedestres saltam na calçada, <kbd class="px-1 bg-slate-800 text-amber-400 rounded">SHIFT</kbd> faz Burnout, <kbd class="px-1 bg-slate-800 text-amber-400 rounded">Q</kbd> olha para trás e <kbd class="px-1 bg-slate-800 text-amber-400 rounded">R</kbd> abre o Film Director!';
                } else if(type==='story_havana_lead'){
                    this.missionActive=true;
                    this.missionTimeLeft=DriverHavanaLead.LIMIT;
                    this.setWeather('dusk');
                    const start=DriverHavanaLead.START;
                    Object.assign(this.playerCar,{
                        x:start.x,y:0,z:start.z,heading:start.heading,
                        speed:0,damage:0
                    });
                    this.playerCar.updateTransform();
                    this.mode='driving';
                    this.tanner.setVisible(false);
                    this.targetCar=new DriverVehicle(this.scene,{
                        name:'INTERMEDIÁRIO DE HAVANA',
                        color:0x0f766e,bodyStyle:'muscle',isTarget:true,
                        x:DriverHavanaLead.SUSPECT.x,
                        z:DriverHavanaLead.SUSPECT.z,
                        heading:DriverHavanaLead.SUSPECT.heading,
                        maxSpeed:43,accel:25
                    });
                    DriverHavanaLead.attachRoute(this.targetCar);
                    this.vehicles.push(this.targetCar);
                    this.freeVehicleAssets.decorateFleet();
                    titleEl.textContent='CAPÍTULO 2 — HAVANA 09: FOLLOW UP THE LEAD';
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');
                    subEl.textContent='SIGA O SEDÃ VERDE • NÃO SE APROXIME DEMAIS';
                    objEl.textContent='Siga o intermediário pelas ruas de Havana '+
                        'até o encontro nos cais. Mantenha distância entre 16 e '+
                        '125 m, não bata no carro suspeito e não o perca de vista.';
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
                } else if(type==='story_leaving'){
                    this.missionActive=true;
                    this.missionTimeLeft=DriverLeavingChicago.LIMIT;
                    this.setWeather('rain');this.felony=38;
                    const start=DriverLeavingChicago.START;
                    Object.assign(this.playerCar,{
                        x:start.x,y:0,z:start.z,heading:start.heading,
                        speed:0,damage:0
                    });
                    this.playerCar.updateTransform();
                    this.mode='driving';this.tanner.setVisible(false);
                    this.spawnChicagoMafia();
                    this.spawnLeavingJones();
                    this.spawnMarkerRing(
                        DriverLeavingChicago.STATION.x,
                        DriverLeavingChicago.STATION.z,0x22c55e
                    );
                    titleEl.textContent='CHICAGO 08: LEAVING CHICAGO';
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');
                    subEl.textContent='ALCANCE A ESTAÇÃO • ENCONTRE JONES';
                    objEl.textContent='À noite e sob chuva, vá à estação Randolph '+
                        'antes de 3:30. Evite a máfia e pare no marcador verde '+
                        'para reencontrar Tobias Jones.';
                } else if(type === 'story_caine'){
                    this.missionActive=true;
                    this.missionTimeLeft=170;
                    this.setWeather('day');
                    this.felony=0;
                    // Tanner foge do galpão onde Jericho o deixou.
                    const room=this.city.interiors.find(p=>p.id==='warehouse');
                    this.mode='on_foot';
                    this.interiorPlace=room||null;
                    const spawn=room?room.exit:{x:200,z:-175};
                    this.tanner.setPosition(spawn.x,0,spawn.z+0.4,0);
                    this.tanner.setVisible(true);
                    this.playerCar.name='CARRO DE FUGA • CAINE';
                    this.playerCar.setPaintColor(0xeab308);
                    this.playerCar.x=DriverCaineCompound.CAR.x;
                    this.playerCar.z=DriverCaineCompound.CAR.z;
                    this.playerCar.y=0;
                    this.playerCar.heading=0;
                    this.playerCar.speed=0;
                    this.playerCar.updateTransform();
                    titleEl.textContent='CHICAGO 07: CAINE\'S COMPOUND';
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');
                    subEl.textContent='SAIA DO GALPÃO E FUJA DE CARRO';
                    objEl.textContent='Saia pela porta (E), atravesse o pátio, '+
                        'pegue o carro amarelo, escape das vans de Caine e '+
                        'atravesse a ponte levadiça antes de fechar.';
                } else if(type === 'story_intruder'){
                    this.missionActive=true;
                    this.missionTimeLeft=175;
                    this.setWeather('day');
                    this.felony=0;
                    // Após a invasão, Tanner acorda no beco. O esportivo preto
                    // está estacionado perto dele; o intruso foge de sedã.
                    this.playerCar.name='ESPORTIVO PRETO • TANNER';
                    this.playerCar.setPaintColor(0x111827);
                    this.playerCar.x=-84;
                    this.playerCar.z=-88;
                    this.playerCar.y=0;
                    this.playerCar.heading=0;
                    this.playerCar.speed=0;
                    this.playerCar.maxSpeed=57;
                    this.playerCar.accel=34;
                    this.playerCar.updateTransform();
                    this.mode='on_foot';
                    this.tanner.setPosition(-85,0,-100,0);
                    this.tanner.setVisible(true);
                    this.targetCar=new DriverVehicle(this.scene,{
                        name:'CARRO DO INVASOR',color:0x64748b,
                        bodyStyle:'muscle',isTarget:true,
                        x:-80,z:-36,heading:0,maxSpeed:51,accel:29
                    });
                    DriverIntruderPursuit.attach(this.targetCar);
                    this.vehicles.push(this.targetCar);
                    titleEl.textContent='CHICAGO 06: CHASE THE INTRUDER';
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');
                    subEl.textContent='ENTRE NO ESPORTIVO E SIGA O INVASOR';
                    objEl.textContent='O invasor escapou pela escada de incêndio! '+
                        'Pegue o carro preto (E), siga o sedã cinza sem perdê-lo '+
                        'e pare ao lado dele no pátio dos depósitos. '+
                        'Não destrua o carro: descubra para onde ele vai.';
                } else if (type === 'story_safehouse') {
                    this.missionActive=true;
                    this.missionTimeLeft=165;
                    this.setWeather('day');
                    this.felony=92;
                    // Começa sob perseguição na parte leste de Chicago.
                    this.playerCar.x=164;
                    this.playerCar.y=0;
                    this.playerCar.z=-152;
                    this.playerCar.heading=Math.PI;
                    this.playerCar.speed=0;
                    this.playerCar.damage=13;
                    this.playerCar.updateTransform();
                    const police=[
                        {x:164,z:-210,heading:0},
                        {x:244,z:-156,heading:-Math.PI/2},
                        {x:84,z:-228,heading:0}
                    ];
                    let next=0;
                    for(const cop of this.vehicles.filter(v=>v.isPolice)){
                        const spot=police[next++ % police.length];
                        cop.x=spot.x;cop.z=spot.z;
                        cop.heading=spot.heading;cop.speed=0;
                        cop.updateTransform();
                    }
                    this.roadblockDirector.cooldown=3.0;
                    titleEl.textContent='CHICAGO 05: ESCAPE TO THE SAFE HOUSE';
                    timerEl.classList.remove('hidden');
                    subEl.classList.remove('hidden');
                    subEl.textContent='DESPISTE A POLÍCIA E VOLTE À CASA SEGURA';
                    objEl.textContent='Fuja das viaturas, quebre a linha de visão e reduza '+
                        'o delito abaixo de 32%. Depois, pare junto à porta verde '+
                        'da casa segura (sudoeste). Você também pode entrar a pé.';
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
                // Undercover title card + five-second street establishing shot.
                this.briefingDirector?.begin(this,type);
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

            spawnChicagoMafia(){
                if(this.leavingMafia.length)return this.leavingMafia;
                const spots=[
                    {x:-240,z:224,heading:Math.PI},
                    {x:-320,z:160,heading:Math.PI/2},
                    {x:-160,z:160,heading:-Math.PI/2}
                ];
                for(const [i,pos] of spots.entries()){
                    const mafia=new DriverVehicle(this.scene,{
                        name:'MAFIA BRASILEIRA '+(i+1),
                        color:i%2?0x27272a:0x7f1d1d,
                        bodyStyle:'muscle',
                        x:pos.x,z:pos.z,heading:pos.heading,
                        maxSpeed:43,accel:29
                    });
                    mafia.isMafia=true;mafia.isPolice=false;
                    mafia.wetRoad=this.weatherMode==='rain';
                    this.vehicles.push(mafia);this.leavingMafia.push(mafia);
                }
                return this.leavingMafia;
            }
            spawnLeavingJones(){
                if(this.stationJones)return this.stationJones;
                const group=new THREE.Group();
                const coat=new THREE.MeshLambertMaterial({color:0x334155});
                const skin=new THREE.MeshLambertMaterial({color:0xb77954});
                const green=new THREE.MeshBasicMaterial({color:0x4ade80});
                const body=new THREE.Mesh(new THREE.BoxGeometry(.9,1.55,.5),coat);
                body.position.y=1.68;
                const head=new THREE.Mesh(new THREE.BoxGeometry(.52,.62,.5),skin);
                head.position.y=2.76;group.add(body,head);
                for(const sign of [-1,1]){
                    const leg=new THREE.Mesh(new THREE.BoxGeometry(.32,.82,.42),coat);
                    leg.position.set(sign*.28,.55,0);group.add(leg);
                }
                const arrow=new THREE.Mesh(new THREE.ConeGeometry(.68,1.25,4),green);
                arrow.position.y=4.05;arrow.rotation.z=Math.PI;
                group.add(arrow);group.position.set(-8,0,-240);
                this.scene.add(group);this.stationJones=group;
                return group;
            }
            activateCaineVans() {
                if(this.caineVans.length)return this.caineVans;
                const locations=[
                    {x:240,z:-229,heading:0},
                    {x:160,z:-195,heading:0}
                ];
                for(const spawn of locations){
                    const van=new DriverVehicle(this.scene,{
                        name:'VAN DE CAINE',color:0xeab308,bodyStyle:'truck',
                        isTarget:true,isPolice:false,
                        x:spawn.x,z:spawn.z,heading:spawn.heading,
                        maxSpeed:30,accel:19
                    });
                    this.vehicles.push(van);
                    this.caineVans.push(van);
                }
                return this.caineVans;
            }

            spawnIntruderBlocker() {
                if(this.intruderBlocker)return this.intruderBlocker;
                const van=new DriverVehicle(this.scene,{
                    name:'VAN AMARELA • EMBOSCADA',
                    color:0xeab308,bodyStyle:'truck',isSecret:true,
                    x:198,z:-137,heading:Math.PI/2,
                    maxSpeed:21,accel:17
                });
                van.isSecret=true;
                van.speed=0;
                van.updateTransform();
                this.vehicles.push(van);
                this.intruderBlocker=van;
                this.effects.spawnImpactSparks(198,0,-137,0.4);
                return van;
            }

            startPoliceDoorTransition(vehicle,kind){
                if(this.policeDoorTransition ||
                    typeof DriverPoliceDoorRig==='undefined' ||
                    !vehicle?.policeDoorRig)return false;
                const originalCar=this.playerCar;
                vehicle.speed=0;
                const done=()=>{
                    if(!this.policeDoorTransition ||
                        this.policeDoorTransition.vehicle!==vehicle)return;
                    this.policeDoorTransition=null;
                    const badge=document.getElementById('player-state-badge');
                    if(kind==='enter'){
                        const switched=vehicle!==originalCar;
                        this.playerCar=vehicle;
                        this.mode='driving';
                        this.tanner.setVisible(false);
                        if(switched&&!this.isPoliceNearPlayer(45))
                            this.felony=Math.max(0,this.felony-65);
                        else if(vehicle.isPolice)
                            this.felony=Math.min(100,this.felony+35);
                        if(badge){
                            badge.textContent=vehicle.isPolice?
                                'NO VOLANTE • POLÍCIA':'NO VOLANTE (V8)';
                            badge.className='px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold';
                        }
                    }else{
                        this.mode='on_foot';
                        const exit=DriverPoliceDoorRig.standPoint(vehicle,2.4);
                        this.tanner.setPosition(
                            exit.x,exit.y,exit.z,exit.heading);
                        this.tanner.setVisible(true);
                        if(badge){
                            badge.textContent='TANNER (A PÉ)';
                            badge.className='px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold';
                        }
                    }
                };
                if(!DriverPoliceDoorRig.start(vehicle,kind,done))
                    return false;
                this.policeDoorTransition={vehicle,kind};
                if(kind==='enter'){
                    const entry=DriverPoliceDoorRig.standPoint(vehicle,2.25);
                    this.tanner.setPosition(
                        entry.x,entry.y,entry.z,entry.heading);
                }
                return true;
            }

            updateVehicleDoorApproach(){
                const state=this.policeDoorTransition;
                const vehicle=state?.vehicle,rig=vehicle?.policeDoorRig;
                if(!rig)return;
                const elapsed=rig.clock;
                const near=DriverPoliceDoorRig.standPoint(vehicle,1.08);
                const far=DriverPoliceDoorRig.standPoint(vehicle,2.4);
                const xNear=near.x,zNear=near.z;
                const xFar=far.x,zFar=far.z;
                if(state.kind==='enter'){
                    if(elapsed>=.82){
                        this.tanner.setVisible(false);
                    }else if(elapsed>=.25){
                        const t=Math.min(1,(elapsed-.25)/.57);
                        this.tanner.setPosition(
                            xFar+(xNear-xFar)*t,vehicle.y,
                            zFar+(zNear-zFar)*t,vehicle.heading);
                    }
                }else{
                    if(elapsed>.33){
                        this.tanner.setVisible(true);
                        const t=Math.min(1,(elapsed-.33)/.60);
                        this.tanner.setPosition(
                            xNear+(xFar-xNear)*t,vehicle.y,
                            zNear+(zFar-zNear)*t,vehicle.heading);
                    }
                }
            }

            toggleVehicleEnterExit() {
                if (this.gameEnded || this.inReplayMode ||
                    this.policeDoorTransition) return;
                this.audio.init();

                if (this.mode === 'driving' && this.playerCar) {
                    if (Math.abs(this.playerCar.speed) > 13) return;
                    if(this.playerCar.policeDoorRig){
                        if(this.startPoliceDoorTransition(this.playerCar,'exit'))
                            return;
                    }
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
                    if(typeof DriverChicagoGameplay!=='undefined' &&
                        DriverChicagoGameplay.interact(this.city,this.tanner.group.position)){
                        this.showGarageStatus('WRIGLEY FIELD • PORTÃO LIBERADO');
                        return;
                    }
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

                    // Missões com C4 exigem E a pé junto ao gerador/cais.
                    if(typeof DriverRegionalMissions!=='undefined' &&
                        DriverRegionalMissions.interact(this))return;

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
                        // O V8 de Wrigley só pode ser dirigido após acionar
                        // o interruptor da bilheteria.
                        if(v.isWrigleySecret && !this.city.chicagoStadium?.open)
                            continue;
                        const d = Math.hypot(v.x - this.tanner.group.position.x, v.z - this.tanner.group.position.z);
                        if (d < minDist) {
                            minDist = d;
                            closestCar = v;
                        }
                    }

                    if (closestCar) {
                        if(closestCar.policeDoorRig){
                            if(this.startPoliceDoorTransition(closestCar,'enter'))
                                return;
                        }
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
                    if (vehicle === this.playerCar || vehicle.missionParked || vehicle.isSecret ||
                        vehicle===this.policeDoorTransition?.vehicle) continue;
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
                        if(this.missionType==='story_havana_lead' &&
                            impact.other===this.targetCar){
                            this.havanaLeadDirector.alertSeconds=Math.min(
                                DriverHavanaLead.ALERT_SECONDS,
                                this.havanaLeadDirector.alertSeconds+1.8);
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
                    },
                    event=>{
                        // CPU/colisões informam zona e intensidade para ambos
                        // os carros. Detritos são criados só nos choques fortes.
                        this.effects.spawnCarBreakaway(event.a,event.zoneA,
                            event.closingSpeed);
                        this.effects.spawnCarBreakaway(event.b,event.zoneB,
                            event.closingSpeed);
                    }
                );
            }

            updateFelonyAndMissions(dt) {
                if (this.gameEnded || this.inReplayMode) return;

                if (this.mode === 'driving' && this.playerCar) {
                    const kmh = Math.abs(this.playerCar.speed) * 3.4;
                    // Policiais do lado de fora do Lower Wacker não enxergam
                    // o veículo sob a cobertura. Os que entram continuam
                    // perseguindo normalmente, sem imunidade artificial.
                    const position=this.getPlayerPosition();
                    const covered=typeof DriverChicagoLowerWacker!=='undefined' &&
                        DriverChicagoLowerWacker.isCovered(this.city,position);
                    const seenNearby=covered ?
                        this.vehicles.some(v=>v.isPolice && v!==this.playerCar &&
                            Math.hypot(v.x-position.x,v.z-position.z)<65 &&
                            this.trafficAI.unobstructed(v,position)) :
                        this.isPoliceNearPlayer(65);
                    if (seenNearby) {
                        if (this.playerCar.isDrifting || this.playerCar.isBurnout) this.felony = Math.min(100, this.felony + 9 * dt);
                        if (kmh > 130) this.felony = Math.min(100, this.felony + 6 * dt);
                    } else if (this.felony > 0 && this.missionType !== 'survival') {
                        this.felony = Math.max(0, this.felony - (covered ? 6.5 : 3.5) * dt);
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
                    const marker = this.missionType==='story_leaving' ||
                        this.missionMarkers.some(m=>m.manualInteract)?null:
                        this.missionType==='gate_racing' &&
                            typeof DriverClassicGames!=='undefined'?
                            DriverClassicGames.findGateMarker(this,pos.x,pos.z):
                        DriverCheckpointRoute.findReached(
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
                        if(typeof DriverClassicGames!=='undefined' &&
                            DriverClassicGames.isClassic(this.missionType))
                            DriverClassicGames.marker(this,marker);
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

                // All new modes share the existing timer, HUD and damage physics.
                if(this.missionActive){
                    const result=typeof DriverClassicGames!=='undefined' &&
                        DriverClassicGames.isClassic(this.missionType)?
                        DriverClassicGames.update(this,dt):
                        typeof DriverRegionalMissions!=='undefined' &&
                        DriverRegionalMissions.isRegional(this.missionType)?
                        DriverRegionalMissions.update(this,dt):null;
                    if(result?.success||result?.failure){
                        this.triggerEndScreen(result.title,
                            result.description||result.message||'');
                        return;
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
                    if(this.missionType==='story_havana_lead'&&this.targetCar){
                        const result=this.havanaLeadDirector.update(dt,{
                            player:this.getPlayerPosition(),
                            target:this.targetCar,mode:this.mode,
                            timeLeft:this.missionTimeLeft
                        });
                        this.havanaLeadStatus=result;
                        document.getElementById('mission-subcounter').textContent=
                            result.message+' • CONTATO '+Math.floor(
                                result.tailSeconds)+'s';
                        if(result.failed){
                            this.triggerEndScreen(result.failed==='timeout'?
                                'TEMPO ESGOTADO!':'MISSÃO FALHOU!',
                                result.failed==='detected'?
                                'O intermediário percebeu Tanner. Mantenha distância.':
                                result.failed==='lost'?
                                'O sedã escapou. Continue entre 16 e 125 metros.':
                                result.failed==='destroyed'?
                                'O suspeito perdeu o carro antes de chegar aos cais.':
                                'Não foi possível acompanhar o intermediário.');
                            return;
                        }
                        if(result.complete){
                            this.triggerEndScreen('FOLLOW UP THE LEAD CONCLUÍDA!',
                                'Tanner seguiu o intermediário discretamente '+
                                'até o encontro nos cais de Havana.');
                            return;
                        }
                    }
                    if(this.missionType==='story_leaving'){
                        const result=this.leavingDirector.update(dt,{
                            position:this.getPlayerPosition(),mode:this.mode,
                            speed:this.mode==='driving'?this.playerCar?.speed||0:0,
                            damage:this.playerCar?.damage||0,
                            timeLeft:this.missionTimeLeft
                        });
                        this.leavingStatus=result;
                        document.getElementById('mission-subcounter').textContent=result.message;
                        if(result.failed){
                            this.triggerEndScreen(result.failed==='destroyed'?
                                'CARRO DESTRUÍDO!':'TEMPO ESGOTADO!',
                                'Jones não conseguiu esperar pela chegada de Tanner.');
                            return;
                        }
                        if(result.completed){
                            this.triggerEndScreen('LEAVING CHICAGO CONCLUÍDA!',
                                'Tanner reencontrou Tobias Jones. '+
                                'Chicago ficou para trás. Próximo destino: HAVANA!');
                            return;
                        }
                    }
                    if(this.missionType==='story_caine'){
                        const outcome=this.caineDirector.update(dt,{
                            position:this.getPlayerPosition(),
                            mode:this.mode,interiorId:this.interiorPlace?.id||null
                        });
                        this.caineStatus=outcome;
                        this.city.caineBridgeClosed=outcome.bridgeClosed;
                        this.city.bridgeRaised=outcome.bridgeClosing;
                        const counter=document.getElementById('mission-subcounter');
                        counter.textContent=outcome.label;
                        if(outcome.activateVans && !this.caineVans.length)
                            this.activateCaineVans();
                        if(outcome.changed){
                            const objectives={
                                find_car:'ENCONTRE O CARRO AMARELO NO PÁTIO (E PARA ENTRAR).',
                                escape:'FUJA DAS VANS PELO DISTRITO INDUSTRIAL '+
                                    'E SIGA PARA A PONTE (X=0, Z=50).',
                                bridge:'PONTE FECHANDO! ATRAVESSE ANTES DO PRAZO. '+
                                    'A SAÍDA É O ARCO VERDE APÓS A PONTE.'
                            };
                            if(objectives[outcome.phase])
                                document.getElementById('objective-banner').textContent=
                                    objectives[outcome.phase];
                        }
                        if(outcome.failed){
                            this.triggerEndScreen('PONTE FECHOU!',
                                'Tanner não conseguiu atravessar antes de a ponte levantar.');
                            return;
                        }
                        if(outcome.completed){
                            this.triggerEndScreen('CAINE\'S COMPOUND CONCLUÍDA!',
                                'Tanner escapou das vans e cruzou a ponte levadiça.');
                            return;
                        }
                    }
                    if(this.missionType==='story_intruder'&&this.targetCar){
                        const result=this.intruderDirector.update(
                            dt,this.getPlayerPosition(),this.targetCar,this.mode
                        );
                        this.intruderStatus=result;
                        const counter=document.getElementById('mission-subcounter');
                        counter.textContent=result.message||'PERSIGA O INVASOR';
                        if(result.changed && result.phase==='yard'){
                            document.getElementById('objective-banner').textContent=
                                'O INVASOR PAROU NO PÁTIO INDUSTRIAL! '+
                                'Siga até o depósito (ponto vermelho no radar) '+
                                'e pare seu carro ao lado dele.';
                        }
                        if(result.changed && result.phase==='blocked'){
                            this.spawnIntruderBlocker();
                            document.getElementById('objective-banner').textContent=
                                'ARMADILHA! Uma van amarela bloqueou a saída. '+
                                'Você encontrou o destino do invasor!';
                        }
                        if(result.failed){
                            this.triggerEndScreen(
                                result.failed==='wrecked'?
                                'CARRO DO INVASOR DESTRUÍDO!':
                                'O INVASOR ESCAPOU!',
                                'Você precisa acompanhá-lo até o pátio industrial.');
                            return;
                        }
                        if(result.complete){
                            this.triggerEndScreen('CHASE THE INTRUDER CONCLUÍDA!',
                                'Tanner seguiu o invasor até o pátio. '+
                                'Uma van amarela fechou a saída. Próximo: Caine\'s Compound.');
                            return;
                        }
                    }
                    if(this.missionType==='story_safehouse'){
                        const pos=this.getPlayerPosition();
                        const watch=DriverSafeHouseEscape.policeHasSight(
                            this.vehicles,pos,
                            (cop,p)=>this.trafficAI.unobstructed(cop,p)
                        );
                        // A fuga também conta quando policiais estão perto mas
                        // não conseguem mais ver Tanner atrás de edifícios.
                        if(!watch && this.felony>0)
                            this.felony=Math.max(0,this.felony-5.2*dt);
                        const result=this.safeHouseEscape.update(dt,{
                            position:pos,
                            safeHouseZone:this.city.safeHouseZone,
                            felony:this.felony,
                            policeWatching:watch,
                            mode:this.mode,
                            speed:this.playerCar?.speed||0,
                            interiorId:this.interiorPlace?.id||null
                        });
                        this.safeHouseStatus=result;
                        const info=document.getElementById('mission-subcounter');
                        info.textContent=result.label;
                        if(result.changed){
                            document.getElementById('objective-banner').textContent=
                                result.phase==='reach_home'?
                                'A POLÍCIA PERDEU TANNER! Siga para a casa verde '+
                                'no sudoeste de Chicago e pare no marcador. '+
                                'Também vale entrar no imóvel a pé.' :
                                'A polícia voltou a avistar você! Faça curvas, '+
                                'use os prédios como cobertura e fuja novamente.';
                        }
                        if(result.completed){
                            this.triggerEndScreen('ESCAPE TO THE SAFE HOUSE CONCLUÍDA!',
                                'Tanner despistou as viaturas e chegou à casa segura. '+
                                'Para gravar a campanha, entre na casa e use a mesa verde.');
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
                const finishedType=this.missionType;
                const failed=DriverCampaignFlow.isFailure(title);
                // Ao concluir, mantenha o carro e Tanner no local; não
                // congele a física para mostrar uma janela central.
                this.gameEnded=false;
                this.missionActive=false;
                this.missionTimeLeft=0;
                // Restore passive police and remove temporary gate cones
                // when leaving Driving Games; free roam must be unchanged.
                if(typeof DriverClassicGames!=='undefined' &&
                    DriverClassicGames.isClassic(finishedType))
                    DriverClassicGames.dispose(this);
                if(!failed){
                    this.completedMissions.add(finishedType);
                    if(typeof DriverRegionalMissions!=='undefined' &&
                        DriverRegionalMissions.isRegional(finishedType))
                        this.chapterProgress.completeRegional(finishedType);
                }
                // O checkpoint de capítulo só nasce após vitória real do diretor.
                if(this.missionType==='story_leaving' &&
                    this.leavingDirector.completed && /CONCLUÍDA/.test(title)){
                    this.chapterProgress.unlockHavana();
                    this.updateChapterMenu();
                }
                if(this.missionType==='story_havana_lead' &&
                    this.havanaLeadDirector.complete && /CONCLUÍDA/.test(title)){
                    this.chapterProgress.completeHavanaLead();
                    this.updateChapterMenu();
                }
                const continueHome=document.getElementById('btn-continue-safehouse');
                if(continueHome)continueHome.classList.toggle('hidden',
                    !(this.missionType==='story_safehouse' && /CONCLUÍDA/.test(title)));
                const roamHavana=document.getElementById('btn-havana-free-roam');
                if(roamHavana)roamHavana.classList.toggle('hidden',
                    !(this.missionType==='story_havana_lead' &&
                        this.havanaLeadDirector.complete && /CONCLUÍDA/.test(title)));
                const havana=document.getElementById('btn-continue-havana');
                if(havana)havana.classList.toggle('hidden',
                    !(this.missionType==='story_leaving' &&
                        this.leavingDirector.completed && /CONCLUÍDA/.test(title)));
                this.missionType='freeroam';
                this.chicagoGuidance=null;
                this.chicagoGuidanceStage=null;
                this.clearMissionMarkers();
                const upcoming=this.nextStoryMission();
                const notice=DriverCampaignFlow.summarize(
                    title,desc,failed,upcoming);
                const nextChapter=!failed && finishedType.startsWith('story_')?
                    DriverCampaignFlow.nextChapter(this.currentCityKey,
                        this.completedMissions):null;
                const continueHint=nextChapter?
                    'CAPÍTULO CONCLUÍDO • Próxima cidade: '+
                        DriverCampaignFlow.chapterTitle(nextChapter)+
                        ' (selecionar no menu de cidades)':
                    notice.next;
                // Exibe o motivo específico quando a missão falha.
                // Sem marcar capítulos perdidos como concluídos.
                const reason=failed&&desc?' • '+String(desc).slice(0,160):'';
                this.missionToastText=notice.message+reason+' • '+continueHint;
                this.missionToastRemaining=nextChapter?10:6;
                const toast=document.getElementById('driver-mission-toast');
                if(toast){
                    toast.textContent=this.missionToastText;
                    toast.classList.remove('hidden');
                }
                document.getElementById('center-announcement')?.
                    classList.add('hidden');
                const timer=document.getElementById('mission-timer');
                if(timer)timer.classList.add('hidden');
                const info=document.getElementById('objective-banner');
                if(info)info.textContent=failed&&desc?
                    String(desc)+' • '+continueHint:continueHint;
                this.updateChapterMenu();
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
                document.getElementById('speed-value').textContent =
                    String(kmh).padStart(3,'0');
                document.getElementById('rpm-bar').style.width =
                    `${Math.min(100,12+(kmh/185)*88)}%`;
                // Mostrador analógico inspirado nos carros dos anos 90,
                // 0..220 km/h, com ponteiro e câmbio físico (P/D/R).
                const needle=document.getElementById('speed-needle');
                if(needle){
                    const angle=-130+Math.min(220,kmh)/220*260;
                    needle.setAttribute('transform',
                        'rotate('+angle.toFixed(1)+' 120 101)');
                }
                const gear=document.getElementById('speed-gear');
                if(gear)gear.textContent=this.mode!=='driving'?'P':
                    (this.playerCar?.speed||0)<-.6?'R':'D';

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

                const cainePanel=document.getElementById('caine-escape-progress');
                if(this.missionType==='story_havana_lead'&&this.havanaLeadStatus){
                    const panel=document.getElementById('havana-lead-progress');
                    const s=this.havanaLeadStatus;
                    if(panel){
                        document.getElementById('havana-lead-phase').textContent=
                            s.phase==='meet'?'ENCONTRO NOS CAIS • CONTATO CONFIRMADO':
                            'SEGUINDO INTERMEDIÁRIO • HAVANA';
                        document.getElementById('havana-lead-fill').style.width=
                            Math.round(s.progress*100)+'%';
                        const detail=document.getElementById('havana-lead-distance');
                        detail.textContent=Math.round(s.distance)+'m • ALERTA '+
                            Math.round(s.alertSeconds/DriverHavanaLead.ALERT_SECONDS*100)+
                            '% • PERDA '+s.lostSeconds.toFixed(1)+'s';
                        detail.className='text-[10px] mt-1 '+
                            (s.zone==='safe'?'text-emerald-300':'text-rose-300');
                    }
                }
                if(this.missionType==='story_leaving'&&this.leavingStatus){
                    const panel=document.getElementById('leaving-chicago-progress');
                    const title=document.getElementById('leaving-chicago-title');
                    const fill=document.getElementById('leaving-chicago-fill');
                    const detail=document.getElementById('leaving-chicago-distance');
                    if(panel){
                        const v=this.leavingStatus;
                        if(title)title.textContent=v.phase==='reunion'?
                            'JONES À VISTA • AGUARDE NA ESTAÇÃO':
                            'ÚLTIMA MISSÃO DE CHICAGO • CHUVA';
                        if(fill)fill.style.width=Math.round(v.progress*100)+'%';
                        if(detail)detail.textContent='ESTAÇÃO: '+
                            Math.round(v.distance)+'m • MÁFIA NO ENCALÇO';
                    }
                }
                if(cainePanel && this.missionType==='story_caine' && this.caineStatus){
                    const phase=document.getElementById('caine-escape-phase');
                    const fill=document.getElementById('caine-bridge-fill');
                    const detail=document.getElementById('caine-escape-detail');
                    const status=this.caineStatus;
                    if(phase)phase.textContent=status.label;
                    if(fill)fill.style.width=Math.round(
                        status.bridgeSeconds/DriverCaineCompound.BRIDGE_SECONDS*100
                    )+'%';
                    if(detail)detail.textContent=status.bridgeClosing?
                        'PONTE LEVADIÇA: '+Math.ceil(status.bridgeRemaining)+'s PARA FECHAR':
                        'SAIA DO GALPÃO • PEGUE O CARRO • FUJA DAS VANS';
                }
                const intruderPanel=document.getElementById('intruder-chase-progress');
                if(intruderPanel && this.missionType==='story_intruder' &&
                    this.intruderStatus){
                    const data=this.intruderStatus;
                    const phase=document.getElementById('intruder-chase-phase');
                    const gauge=document.getElementById('intruder-chase-fill');
                    const distance=document.getElementById('intruder-chase-distance');
                    if(phase)phase.textContent=data.phase==='opening'?
                        'INVASOR EM FUGA • ENCONTRE O CARRO':
                        data.phase==='chase'?'SIGA O SEDÃ CINZA':
                        data.phase==='yard'?'CHEGUE AO PÁTIO DOS DEPÓSITOS':
                        'VAN AMARELA BLOQUEANDO A SAÍDA';
                    if(gauge){
                        const fill=data.phase==='opening'?0:
                            data.phase==='chase'?data.routeProgress*85:
                            data.phase==='yard'?90:100;
                        gauge.style.width=Math.round(fill)+'%';
                    }
                    if(distance)distance.textContent='INVASOR '+
                        Math.round(data.distance)+'m • PERDA '+data.lostSeconds.toFixed(1)+'/6s';
                }
                const escapeMeter=document.getElementById('safehouse-escape-progress');
                if(escapeMeter && this.missionType==='story_safehouse' &&
                    this.safeHouseStatus){
                    const s=this.safeHouseStatus;
                    const green=s.phase==='reach_home';
                    const phaseEl=document.getElementById('safehouse-phase');
                    const fill=document.getElementById('safehouse-hidden-fill');
                    const distanceEl=document.getElementById('safehouse-distance');
                    if(phaseEl)phaseEl.textContent=green?
                        'DESPISTOU A POLÍCIA • VÁ PARA CASA':'FUJA DO CERCO POLICIAL';
                    if(fill){
                        fill.style.width=Math.round(s.hiddenSeconds/
                            DriverSafeHouseEscape.LOST_SIGHT_SECONDS*100)+'%';
                        fill.className='h-full rounded '+(green?
                            'bg-emerald-400':'bg-orange-400');
                    }
                    if(distanceEl)distanceEl.textContent=
                        'CASA '+Math.round(s.distance)+'m • DELITO '+
                        Math.round(s.felony)+'%'+
                        (s.policeWatching?' • EM VISÃO':' • SEM VISÃO');
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
                    if (this.missionType === 'story_havana_lead') {
                        label='HAVANA 09 • SIGA O INTERMEDIÁRIO';
                    } else if (this.missionType === 'story_leaving') {
                        label='CHICAGO 08 • ALCANCE O TREM';
                    } else if (this.missionType === 'story_caine') {
                        label='CHICAGO 07 • COMPLEXO DE CAINE';
                    } else if (this.missionType === 'story_intruder') {
                        label='CHICAGO 06 • PERSIGA O INVASOR';
                    } else if (this.missionType === 'story_safehouse') {
                        label='CHICAGO 05 • FUGA POLICIAL';
                    } else if (this.missionType === 'story_drop') {
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
                    } else if(this.missionActive &&
                        ['story_vegas_c4','story_rio_barge'].includes(this.missionType) &&
                        this.regionalState?.sites?.[this.regionalState.phase] &&
                        !(this.regionalState.countdown>0) &&
                        Math.hypot(
                            this.tanner.group.position.x-
                                this.regionalState.sites[this.regionalState.phase].x,
                            this.tanner.group.position.z-
                                this.regionalState.sites[this.regionalState.phase].z
                        )<9){
                        promptEl.textContent='Pressione [E] para PLANTAR O C4';
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

                this.updateGarageProximity();
                this.updateCityNavigation();
                if(this.playerCar&&this.debugVehiclePhysics &&
                    typeof DriverVehicleWheelRig!=='undefined')
                    DriverVehicleWheelRig.setDebug(this.playerCar,true);
                const physicsBadge=document.getElementById('driver-physics-status');
                if(physicsBadge){
                    physicsBadge.classList.toggle('hidden',
                        !this.debugVehiclePhysics);
                    if(this.debugVehiclePhysics&&this.playerCar){
                        const d=DriverVehicleCollisions.dimensions(this.playerCar);
                        physicsBadge.textContent='EIXO VERDE = FRENTE • '+
                            'COLISOR '+d.width.toFixed(2)+'×'+
                            d.length.toFixed(2)+' • RODAS '+(
                                this.playerCar.wheelRig?.independent?
                                'INDEPENDENTES':'INTEGRADAS NA MALHA');
                    }
                }
                this.drawRadar();
            }

            updateInteriorHUD() {
                const prompt=document.getElementById('interaction-prompt');
                const banner=document.getElementById('interior-banner');
                if(banner)banner.classList.toggle('hidden',!this.interiorPlace);
                const interiorTitle=document.getElementById('interior-title');
                const saveButton=document.getElementById('btn-save-home');
                if(interiorTitle&&this.interiorPlace)
                    interiorTitle.textContent=this.interiorPlace.name||
                        this.interiorPlace.id.toUpperCase();
                if(saveButton)saveButton.classList.toggle('hidden',
                    this.interiorPlace?.id!=='home');
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

            nextStoryMission(){
                if(!this.storyCampaign)return null;
                return DriverCampaignFlow.next(this.currentCityKey,
                    this.completedMissions);
            }
            getNearbyMissionStart(){
                const start=this.city?.missionStart;
                if(!start||this.missionActive||
                    this.currentCityKey==='havana' &&
                    !this.chapterProgress.canTravelToHavana())return null;
                const next=this.nextStoryMission();
                if(this.storyCampaign&&!next)return null;
                const type=next||start.type;
                if(typeof DriverChicagoMissionHubs!=='undefined')
                    DriverChicagoMissionHubs.sync(this.city,type,false);
                const p=this.getPlayerPosition();
                return Math.hypot(p.x-start.x,p.z-start.z)<10?
                    {...start,type}:null;
            }
            activateNearbyMission(){
                const start=this.getNearbyMissionStart();
                if(!start || this.gameEnded)return false;
                if(start.type==='story_havana_lead'){
                    this.startHavanaLead();
                }else this.startMission(start.type);
                return true;
            }
            updateCityNavigation(){
                const start=this.city?.missionStart;
                if(!start)return;
                const next=this.nextStoryMission();
                const doneChapter=this.storyCampaign&&!next;
                const missionType=next||start.type;
                const spec=typeof DriverChicagoMissionHubs!=='undefined'?
                    DriverChicagoMissionHubs.sync(
                        this.city,missionType,this.missionActive||doneChapter):null;
                const completed=missionType==='story_havana_lead'?
                    this.chapterProgress.hasCompletedHavanaLead():
                    this.completedMissions?.has(missionType);
                const locked=missionType==='story_havana_lead'&&
                    !this.chapterProgress.canTravelToHavana();
                const color=locked?0x475569:
                    (completed||doneChapter)?0x94a3b8:
                    this.missionActive?0xfacc15:0x22c55e;
                start.ring.material.color.setHex(color);
                start.arrow.material.color.setHex(color);
                start.arrow.rotation.y+=.02;
                if(!spec){
                    start.ring.visible=!this.missionActive&&!doneChapter;
                    start.arrow.visible=!this.missionActive&&!doneChapter;
                }
                const nav=document.getElementById('driver-mission-start-status');
                const button=document.getElementById('btn-start-nearby-mission');
                const near=this.getNearbyMissionStart();
                const pos=this.getPlayerPosition();
                const distance=Math.round(Math.hypot(
                    pos.x-start.x,pos.z-start.z));
                const show=!this.missionActive&&!doneChapter&&!locked;
                if(nav){
                    const label=spec?spec.label+' • '+spec.place:
                        missionType.replace(/_/g,' ').toUpperCase();
                    const message=show?label+' • '+distance+'m'+
                        (near?' • '+(spec?.hint||'')+' • J OU BOTÃO PARA INICIAR':
                            ' • SIGA O NÚMERO NO RADAR'):'';
                    // Evita escrita DOM a cada frame no orçamento dos 60 FPS.
                    if(nav.textContent!==message)nav.textContent=message;
                    nav.classList.toggle('hidden',!show);
                }
                if(button){
                    button.classList.toggle('hidden',!near);
                    button.disabled=!near;
                    if(near){
                        const label='▶ INICIAR '+(spec?spec.label:'MISSÃO');
                        if(button.textContent!==label)button.textContent=label;
                    }
                }
            }

            // Pelo menu, escolha uma missão e viaje ao marcador no mundo.
            // A sequência da campanha permanece em ordem, sem teleporte.
            showStoryMissionOnMap(type){
                // Modo de teste mantém o atalho antigo das 8 missões.
                // Por padrão, o menu apenas marca o começo no mundo.
                if(document.getElementById('mission-direct-start-mode')?.checked){
                    this.startMission(type);
                    return true;
                }
                if(this.currentCityKey!=='chicago'){
                    this.missionToastText='Escolha CHICAGO no seletor de cidades antes de marcar a missão.';
                    this.missionToastRemaining=6;
                    document.getElementById('missions-modal')?.classList.add('hidden');
                    return false;
                }
                if(this.missionActive){
                    this.missionToastText='Conclua ou abandone a missão atual antes de escolher outra.';
                    this.missionToastRemaining=6;
                    document.getElementById('missions-modal')?.classList.add('hidden');
                    return false;
                }
                this.storyCampaign=true;
                const next=DriverCampaignFlow.next(this.currentCityKey,
                    this.completedMissions);
                if(next!==type){
                    const label=DriverChicagoMissionHubs?.SPECS[next]?.label||
                        'a próxima missão da campanha';
                    this.missionToastText='Primeiro conclua: '+label;
                    this.missionToastRemaining=5;
                }else{
                    this.missionToastText='VÁ ATÉ O MARCADOR VERDE NO MAPA • J PARA INICIAR';
                    this.missionToastRemaining=5;
                }
                document.getElementById('missions-modal')?.classList.add('hidden');
                this.updateCityNavigation();
                return next===type;
            }

            garageDistance(){
                const target=this.city?.garageParking;
                if(!target)return Infinity;
                const p=this.getPlayerPosition();
                return Math.hypot(p.x-target.x,p.z-target.z);
            }
            showGarageStatus(message){
                const el=document.getElementById('tanner-garage-status');
                if(el)el.textContent=message;
            }
            renderGarageList(){
                const root=document.getElementById('tanner-garage-list');
                if(!root)return;
                root.replaceChildren();
                for(const item of this.tannerGarage.list()){
                    const button=document.createElement('button');
                    button.type='button';
                    button.className='block w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 p-2 rounded mb-1 text-left';
                    button.textContent=(item.index+1)+'. '+item.name+
                        ' • '+(item.custom?'GLB / ':'')+
                        '#'+item.color.toString(16).padStart(6,'0');
                    button.addEventListener('click',()=>this.withdrawTannerVehicle(item.index));
                    root.appendChild(button);
                }
                if(!root.children.length){
                    const p=document.createElement('p');
                    p.textContent='Nenhum carro guardado (máximo 5).';
                    root.appendChild(p);
                }
            }
            parkTannerVehicle(){
                const car=this.playerCar;
                if(this.currentCityKey!=='chicago'||
                    this.missionType!=='freeroam' ||
                    this.mode!=='driving'||!car||
                    this.garageDistance()>9||Math.abs(car.speed)>2.5){
                    this.showGarageStatus(
                        'PARE NA VAGA • GARAGEM DISPONÍVEL NO PASSEIO LIVRE');
                    return false;
                }
                if(!this.tannerGarage.store(car)){
                    this.showGarageStatus('Garagem cheia ou armazenamento indisponível.');
                    return false;
                }
                const parking=this.city.garageParking;
                this.vehicles=this.vehicles.filter(v=>v!==car);
                this.scene.remove(car.root);
                if(typeof GPUResourceUtils!=='undefined')
                    GPUResourceUtils.disposeSubtree(car.root);
                // Evita selecionar a viatura/veículo secreto como o
                // carro do jogador enquanto Tanner estiver a pé.
                this.playerCar=this.vehicles.find(v=>
                    !v.isPolice&&!v.isSecret&&!v.isTarget)||
                    this.vehicles[0]||null;
                this.mode='on_foot';
                this.tanner.setVisible(true);
                this.tanner.setPosition(parking.x,0,parking.z+3,0);
                this.showGarageStatus('VEÍCULO GUARDADO • PERSISTENTE');
                this.renderGarageList();
                return true;
            }
            withdrawTannerVehicle(index){
                if(this.currentCityKey!=='chicago'||
                    this.mode!=='on_foot'||this.garageDistance()>12)
                    return false;
                const exit=this.city.garageExit;
                if(!DriverRoadGeometry.validGarageExit(
                    exit.x,exit.z,this.city,this.vehicles)){
                    this.showGarageStatus('SAÍDA OCUPADA • AFASTE OS CARROS');
                    return false;
                }
                const item=this.tannerGarage.take(index);
                if(!item)return false;
                let vehicle=null;
                try{
                    vehicle=new DriverVehicle(this.scene,{
                        name:item.name,color:item.color,
                        bodyStyle:item.bodyStyle,
                        maxSpeed:item.maxSpeed,accel:item.accel,
                        initialDamage:item.damage,
                        x:exit.x,z:exit.z,heading:exit.heading
                    });
                }catch(_){
                    this.tannerGarage.cars.splice(index,0,item);
                    this.tannerGarage.persist();
                    return false;
                }
                vehicle.prevX=vehicle.x;
                vehicle.prevZ=vehicle.z;
                this.vehicles.push(vehicle);
                this.playerCar=vehicle;
                this.mode='driving';
                this.tanner.setVisible(false);
                if(this.freeVehicleAssets?.enabled)
                    this.freeVehicleAssets.decorateFleet();
                this.showGarageStatus('VEÍCULO RETIRADO • '+item.name);
                this.renderGarageList();
                return true;
            }
            updateGarageProximity(){
                const near=this.currentCityKey==='chicago' &&
                    this.garageDistance()<13;
                const hint=document.getElementById('tanner-garage-hint');
                if(hint){
                    const stationary=this.mode==='driving' &&
                        Math.abs(this.playerCar?.speed||0)<2.5;
                    hint.textContent=stationary&&near?
                        'GARAGEM • P GUARDAR / O ABRIR':
                        near?'GARAGEM DE TANNER • O ABRIR':'';
                    hint.classList.toggle('hidden',!near);
                }
                const panel=document.getElementById('tanner-garage-panel');
                if(panel)panel.classList.toggle('hidden',
                    !this.garagePanelOpen||!near);
                const guide=document.getElementById('driver-route-status');
                if(guide){
                    const home=this.city.safeHouseZone;
                    const player=this.getPlayerPosition();
                    const distance=Math.hypot(home.x-player.x,home.z-player.z);
                    guide.textContent=this.navigationHome?
                        'CASA DE TANNER • '+Math.round(distance)+'m • 🏠':'';
                    guide.classList.toggle('hidden',!this.navigationHome);
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
                // Corte explícito: edifícios e marcadores fora da área não
                // podem vazar para cima do HUD ao ampliar o minimapa.
                ctx.beginPath();ctx.rect(2,2,w-4,h-4);ctx.clip();
                ctx.translate(cx, cy);
                // Câmera Three.js: +X aparece à ESQUERDA quando o jogador
                // aponta para +Z. Espelhar X e aplicar heading preserva a
                // frente do carro em cima e esquerda/direita como no mundo.
                ctx.rotate(pos.heading);
                ctx.scale(-1,1);
                // O espelhamento é só dos pontos; textos não devem espelhar.
                const radarLabel=(label,x,y)=>{
                    ctx.save();ctx.translate(x,y);ctx.scale(-1,1);
                    ctx.fillText(label,0,0);ctx.restore();
                };

                // Canal no radar
                if(this.currentCityKey==='chicago'){
                    const riverY=-(50-pos.z)*scale;
                    ctx.fillStyle='#0369a1';
                    ctx.fillRect(-w,riverY-9,w*2,18);
                    // As duas travessias são marcadas nas coordenadas reais
                    // da cidade, inclusive com a câmera girando no minimapa.
                    for(const bridgeX of [0,240]){
                        const px=(bridgeX-pos.x)*scale;
                        const top=-(66-pos.z)*scale;
                        ctx.fillStyle=this.city.bridgeRaised?'#f59e0b':'#aebbc6';
                        ctx.fillRect(px-10*scale,top,20*scale,32*scale);
                        ctx.strokeStyle='#475569';
                        ctx.strokeRect(px-10*scale,top,20*scale,32*scale);
                    }
                }

                // Prédios no radar
                ctx.fillStyle = '#334155';
                for (const b of this.city.buildingBoxes) {
                    if (b.minX > 1000 || b.maxX < -1000) continue;
                    if (b.maxX < pos.x-w/scale || b.minX > pos.x+w/scale ||
                        b.maxZ < pos.z-h/scale || b.minZ > pos.z+h/scale) continue;
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

                // Casa de Tanner, garagem e rota são visíveis no radar
                // próximo e no mapa ampliado, nas coordenadas da cidade.
                const homeX=(this.city.safeHouseZone.x-pos.x)*scale;
                const homeZ=-(this.city.safeHouseZone.z-pos.z)*scale;
                ctx.font='bold 16px sans-serif';
                ctx.textAlign='center';
                if(this.navigationHome){
                    ctx.beginPath();ctx.moveTo(0,0);
                    ctx.lineTo(homeX,homeZ);
                    ctx.strokeStyle='#34d399';
                    ctx.lineWidth=2;ctx.stroke();
                }
                ctx.fillStyle='#86efac';
                radarLabel('⌂',homeX,homeZ+5);
                const parking=this.city.garageParking;
                if(parking){
                    ctx.font='bold 12px sans-serif';
                    ctx.fillStyle='#a7f3d0';
                    radarLabel('P',
                        (parking.x-pos.x)*scale,
                        -(parking.z-pos.z)*scale);
                }
                const starter=this.city.missionStart;
                if(starter && !this.missionActive &&
                    !(this.storyCampaign&&!this.nextStoryMission()) &&
                    !(this.currentCityKey==='havana' &&
                    !this.chapterProgress.canTravelToHavana())){
                    ctx.font='bold 15px sans-serif';
                    ctx.fillStyle=this.completedMissions?.has(starter.type)?
                        '#94a3b8':'#facc15';
                    const mx=(starter.x-pos.x)*scale;
                    const mz=-(starter.z-pos.z)*scale;
                    // Trajeto até a próxima missão, sem poluir o radar.
                    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(mx,mz);
                    ctx.strokeStyle='#eab308';ctx.lineWidth=1.8;
                    ctx.setLineDash([3,5]);ctx.stroke();ctx.setLineDash([]);
                    ctx.beginPath();ctx.arc(mx,mz,7,0,Math.PI*2);
                    ctx.fillStyle='#1e293b';ctx.fill();
                    ctx.strokeStyle='#fbbf24';ctx.lineWidth=2;ctx.stroke();
                    const index=this.currentCityKey==='chicago'?
                        DriverCampaignFlow.CHICAGO.indexOf(starter.type):-1;
                    ctx.fillStyle='#fef3c7';
                    radarLabel(index>=0?String(index+1):'!',mx,mz+4);
                    ctx.lineWidth=1;
                }

                // Garagem Secreta (Ponto Roxo Especial no Nordeste)
                const gx = (this.city.secretGarageCenter.x - pos.x) * scale;
                const gz = -(this.city.secretGarageCenter.z - pos.z) * scale;
                ctx.fillStyle = '#c084fc';
                ctx.fillRect(gx - 4, gz - 4, 8, 8);

                if(this.missionType==='story_havana_lead'){
                    const destination=DriverHavanaLead.RENDEZVOUS;
                    ctx.fillStyle='#34d399';
                    ctx.fillRect((destination.x-pos.x)*scale-5,
                        -(destination.z-pos.z)*scale-5,10,10);
                    if(this.targetCar){
                        ctx.fillStyle='#fbbf24';
                        ctx.beginPath();
                        ctx.arc((this.targetCar.x-pos.x)*scale,
                            -(this.targetCar.z-pos.z)*scale,5,0,Math.PI*2);
                        ctx.fill();
                    }
                }
                if(this.missionType==='story_leaving'){
                    const station=DriverLeavingChicago.STATION;
                    ctx.fillStyle='#4ade80';
                    ctx.fillRect((station.x-pos.x)*scale-5,
                        -(station.z-pos.z)*scale-5,10,10);
                }
                if(this.missionType==='story_caine'){
                    const exit=DriverCaineCompound.BRIDGE;
                    ctx.fillStyle='#4ade80';
                    ctx.fillRect((exit.x-pos.x)*scale-5,
                        -(exit.z-pos.z)*scale-5,10,10);
                }
                if(this.missionType==='story_intruder'&&this.targetCar){
                    const yard=DriverIntruderPursuit.YARD;
                    const bx=(yard.x-pos.x)*scale;
                    const bz=-(yard.z-pos.z)*scale;
                    ctx.fillStyle='#facc15';
                    ctx.fillRect(bx-5,bz-5,10,10);
                }
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

                // Alvo atual da etapa (veículo, estação ou saída);
                // mesma matriz do radar para não espelhar os marcadores.
                if(typeof DriverChicagoMissionGuidance!=='undefined')
                    DriverChicagoMissionGuidance.drawRadar(
                        ctx,this,pos,scale);

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
                    const code = e.code;
                    if(code==='Escape'&&!e.repeat){
                        e.preventDefault();
                        if(window.DriverBoot)window.DriverBoot.togglePauseMenu();
                        return;
                    }
                    if(this.loadingActive||this.isPaused)return;
                    this.audio.init();
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
                    if(code === 'KeyU'&&!e.repeat&&this.city?.homeGarageDoor){
                        const p=this.getPlayerPosition(), g=this.city.garageParking;
                        if(g&&Math.hypot(p.x-g.x,p.z-(g.z+6))<18){
                            const open=this.city.toggleHomeGarageDoor();
                            this.showGarageStatus(open?'PORTA DA GARAGEM ABRINDO':'PORTA DA GARAGEM FECHANDO');
                        }
                    }
                    if (code === 'KeyM' && !e.repeat) this.freeVehicleAssets.toggle();
                    if (code === 'KeyL' && !e.repeat) this.togglePlayerHeadlights();
                    if (code === 'KeyH') this.triggerHornOrSiren();
                    if (code === 'KeyR') this.toggleReplayDirector();
                    if (code === 'KeyB') this.city.toggleBridge();
                    if(code==='KeyI'&&!e.repeat){
                        this.debugVehiclePhysics=!this.debugVehiclePhysics;
                        if(this.playerCar &&
                            typeof DriverVehicleWheelRig!=='undefined')
                            DriverVehicleWheelRig.setDebug(this.playerCar,
                                this.debugVehiclePhysics);
                    }
                    if(code==='KeyJ'&&!e.repeat)
                        this.activateNearbyMission();
                    if(code==='KeyT'&&!e.repeat)
                        this.navigationHome=!this.navigationHome;
                    if(code==='KeyP'&&!e.repeat)this.parkTannerVehicle();
                    if(code==='KeyO'&&!e.repeat){
                        this.garagePanelOpen=!this.garagePanelOpen;
                        this.renderGarageList();
                    }
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
                document.getElementById('btn-garage-store')?.
                    addEventListener('click',()=>this.parkTannerVehicle());
                document.getElementById('btn-garage-open')?.
                    addEventListener('click',()=>{
                        this.garagePanelOpen=!this.garagePanelOpen;
                        this.renderGarageList();
                    });
                document.getElementById('btn-route-home')?.
                    addEventListener('click',()=>{
                        this.navigationHome=!this.navigationHome;
                    });
                const exitButton=document.getElementById('btn-leave-interior');
                if(exitButton)exitButton.addEventListener('click',()=>this.leaveInterior());
                const loadButton=document.getElementById('btn-load-home');
                if(loadButton)loadButton.addEventListener('click',()=>{
                    if(window.DriverBoot)window.DriverBoot.loadSavedGame(this);
                    else this.loadHomeGame();
                });
                document.getElementById('btn-main-menu').addEventListener('click',()=>{
                    if(window.DriverBoot)window.DriverBoot.openMenu();
                });
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
                const havanaRoam=document.getElementById('btn-havana-free-roam');
                if(havanaRoam)havanaRoam.addEventListener('click',()=>{
                    if(this.missionType!=='story_havana_lead'||
                        !this.havanaLeadDirector.complete)return;
                    this.startMission('freeroam');
                });
                const continueHavana=document.getElementById('btn-continue-havana');
                if(continueHavana)continueHavana.addEventListener('click',()=>{
                    if(this.missionType!=='story_leaving' ||
                        !this.leavingDirector.completed ||
                        !this.completedMissions.has('story_leaving'))return;
                    this.beginHavanaChapter();
                });
                const continueHome=document.getElementById('btn-continue-safehouse');
                if(continueHome)continueHome.addEventListener('click',()=>{
                    if(this.missionType!=='story_safehouse' ||
                        !this.completedMissions.has('story_safehouse'))return;
                    this.startMission('freeroam');
                    const house=this.city.safeHouseZone;
                    // Jogador pode entrar na casa diretamente; a conquista fica
                    // no Set até salvar o progresso na mesa verde.
                    this.playerCar.x=house.x-6;
                    this.playerCar.z=house.z+9;
                    this.playerCar.speed=0;
                    this.playerCar.heading=Math.PI;
                    this.playerCar.updateTransform();
                    this.mode='on_foot';
                    this.tanner.setPosition(house.x,0,house.z+4,Math.PI);
                    this.tanner.setVisible(true);
                    this.felony=0;
                    const badge=document.getElementById('player-state-badge');
                    if(badge)badge.textContent='TANNER (A PÉ) • CASA SEGURA';
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

                if(this.loadingActive)return;
                if(this.isPaused){
                    this.renderer.render(this.scene,this.camera);
                    return;
                }
                if(this.briefingDirector?.active){
                    // Do not advance game physics or mission timer in intro.
                    this.briefingDirector.tick(dt);
                    this.updateCamera(dt);
                    this.renderer.render(this.scene,this.camera);
                    return;
                }

                if (this.inReplayMode) {
                    this.updateReplayPlayback(dt);
                    this.renderer.render(this.scene, this.camera);
                    return;
                }

                if(this.policeDoorTransition&&
                    typeof DriverPoliceDoorRig!=='undefined'){
                    DriverPoliceDoorRig.update(
                        this.policeDoorTransition.vehicle,dt);
                    if(this.policeDoorTransition)
                        this.updateVehicleDoorApproach();
                }
                if (!this.gameEnded) {
                    if(this.trainLine&&this.missionType==='story_train'&&
                        this.missionActive)this.trainLine.update(dt);
                    if(this.policeDoorTransition){
                        // Entrada/saída bloqueia controles até a porta
                        // terminar seu ciclo, sem simular direção.
                    } else if (this.mode === 'driving' && this.playerCar) {
                        this.playerCar.updatePhysics(dt, this.input, this.city, this.effects, this.audio, true);
                    } else {
                        this.tanner.update(dt, this.input, this.city);
                    }
                }

                // O carro do estádio nasce depois do carregamento progressivo.
                if(typeof DriverChicagoGameplay!=='undefined')
                    DriverChicagoGameplay.ensureWrigleyCar(this);
                
                // Transição de detalhes em orçamento limitado por quadro.
                // Não altera as caixas de colisão nem regras das missões.
                const lod=this.city.updateDistrictLOD(dt,this.getPlayerPosition());
                if(lod){
                    const value='Bairros LOD: '+lod.near+'/'+lod.total+
                        ' em detalhe • '+lod.far+' distantes • '+lod.built+
                        ' preparados'+(lod.failed?' • '+lod.failed+' falhas':'');
                    const meter=document.getElementById('district-lod-status');
                    if(meter && meter.textContent!==value)meter.textContent=value;
                }
                this.updateAIAndCollisions(dt);
                this.city.update(dt,this.vehicles,(car,prop,speed)=>{
                    if(speed>=24 && car?.lastImpactZone)
                        this.effects.spawnCarBreakaway(car,car.lastImpactZone,speed);
                    // Som/danos de cenário só para o carro controlado;
                    // NPCs ainda podem derrubar postes sem punir Tanner.
                    if(this.mode!=='driving'||car!==this.playerCar)return;
                    if(speed>9){
                        this.effects.spawnImpactSparks(car.x,car.y||0,car.z,
                            Math.min(0.9,speed/45));
                        this.audio.playCrash(Math.min(.75,speed/50));
                        this.impactFeedback.trigger(speed*.55);
                    }
                    if(this.isPoliceNearPlayer(65))
                        this.felony=Math.min(100,this.felony+5);
                },this.getPlayerPosition());
                if(this.city.bridgeBellPending){
                    this.city.bridgeBellPending=false;
                    this.audio.playBridgeBell?.();
                }
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
                    },this.getPlayerPosition());
                this.effects.update(dt);
                this.effects.updateRain(dt, this.getPlayerPosition());
                if(typeof DriverRegionalMissions!=='undefined')
                    DriverRegionalMissions.animate(this,dt);
                this.updateFelonyAndMissions(dt);
                this.updateCamera(dt);
                this.recordReplayFrame();

                const speedKmh = (this.mode === 'driving' && this.playerCar) ? this.playerCar.speed * 3.4 : 0;
                const skidding = (this.mode === 'driving' && this.playerCar) ? this.playerCar.isDrifting : false;
                const burnout = (this.mode === 'driving' && this.playerCar) ? this.playerCar.isBurnout : false;
                const sirenOn = (this.felony > 25) || (this.mode === 'driving' && this.playerCar && this.playerCar.isPolice && this.playerCar.sirenActive);
                // True slip angle = lateral velocity versus forward speed;
                // continuous tire squeal instead of a binary skid click.
                const slip=this.mode==='driving'&&this.playerCar?
                    Math.atan2(Math.abs(this.playerCar.lateralVelocity||0),
                        Math.max(1,Math.abs(this.playerCar.speed||0))):0;
                this.audio.update(dt, this.mode === 'driving',
                    speedKmh, skidding, burnout, sirenOn, slip);

                const toast=document.getElementById('driver-mission-toast');
                if(this.missionToastRemaining>0){
                    this.missionToastRemaining=Math.max(0,
                        this.missionToastRemaining-Math.max(0,dt));
                    if(toast){
                        toast.textContent=this.missionToastText;
                        toast.classList.toggle('hidden',
                            this.missionToastRemaining<=0);
                    }
                }else if(toast)toast.classList.add('hidden');
                if(typeof DriverChicagoMissionGuidance!=='undefined')
                    DriverChicagoMissionGuidance.render(this);
                this.updateHUD();
                const context=document.getElementById('driver-mission-context');
                if(context){
                    const title=document.getElementById('mission-title')?.
                        textContent||'';
                    const timer=document.getElementById('mission-timer')?.
                        textContent||'';
                    context.textContent=this.missionActive?
                        title+(timer?' • '+timer:''):'';
                    context.classList.toggle('hidden',!this.missionActive);
                }
                this.updateInteriorHUD();
                this.renderer.render(this.scene, this.camera);
            }
        }

        // O motor WebGL é criado somente após o usuário iniciar no menu.
        window.onload = function () {
            window.DriverBoot = new DriverBootFlow();
        };
    