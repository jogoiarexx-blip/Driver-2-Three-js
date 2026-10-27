/**
 * Tela inicial e carregamento entre cidades.
 * Só inicia WebGL ao selecionar um modo. O progresso mede trabalho real:
 * cidade procedural dividida por fileiras, veículos GLB, compilação de shaders.
 */
class DriverBootFlow {
    constructor() {
        this.game=null;
        this.pendingUserCarFile=null;
        this.sessionReady=false;
        this.loopStarted=false;
        this.busy=false;
        this.menuVisible=true;
        this.selectedCity='chicago';
        this.menu=document.getElementById('driver-main-menu');
        this.loading=document.getElementById('driver-loading');
        this.hud=document.getElementById('hud-layer');
        this.settings=this.readSettings();
        this.moveInGameControlsToMenu();
        this.setupEvents();
        this.refreshSave();
        this.applySettings();
    }

    moveInGameControlsToMenu(){
        // Todos os controles extras ficam no menu de pausa. Os elementos
        // são movidos, não copiados: listeners e IDs continuam únicos.
        const holder=document.getElementById('d2-game-controls');
        if(!holder)return;
        const menuIds=[
            'btn-missions','btn-architecture','btn-director',
            'btn-audio','btn-free-assets','btn-headlights','btn-camera',
            'btn-radar-zoom','btn-route-home'
        ];
        for(const id of menuIds){
            const element=document.getElementById(id);
            if(element)holder.appendChild(element);
        }
        for(const control of document.querySelectorAll('[data-weather]')){
            control.addEventListener('click',()=>{
                if(this.game)this.game.setWeather(control.dataset.weather);
            });
        }
    }
    readSettings() {
        const defaults={models:true,scanlines:true,
            reducedMotion:false,playerColor:'#d53934'};
        try {
            const raw=localStorage.getItem('driver2-menu-preferences-v1');
            const saved=raw ? JSON.parse(raw) : null;
            if(saved && typeof saved==='object')
                for(const key of Object.keys(defaults))
                    if(typeof saved[key]==='boolean')defaults[key]=saved[key];
            if(typeof saved?.playerColor==='string' &&
                /^#[a-f0-9]{6}$/i.test(saved.playerColor))
                defaults.playerColor=saved.playerColor;
        } catch(_) {}
        return defaults;
    }
    saveSettings() {
        try{localStorage.setItem('driver2-menu-preferences-v1',JSON.stringify(this.settings))}
        catch(_) {}
    }
    availableSave() {
        try {
            return new DriverHomeSave(window.localStorage).read();
        } catch(_) {return null;}
    }
    refreshSave() {
        const save=this.availableSave();
        const button=document.getElementById('d2-continue');
        if(button)button.disabled=!save;
        const label=document.getElementById('d2-save-label');
        if(label)label.textContent=save?
            'Continuar em '+save.city.toUpperCase():'Sem save da casa';
        const resume=document.getElementById('d2-resume');
        if(resume)resume.classList.toggle('hidden',!this.sessionReady);
    }
    setupEvents() {
        const listen=(id,fn)=>{
            const el=document.getElementById(id);
            if(el)el.addEventListener('click',fn);
        };
        listen('d2-start-story',()=>this.start('story'));
        listen('d2-start-ride',()=>this.start('ride'));
        listen('d2-continue',()=>this.start('continue'));
        listen('d2-driving-games',()=>this.start('driving'));
        listen('d2-resume',()=>this.resume());
        listen('d2-options-btn',()=>{
            document.getElementById('d2-options').classList.toggle('hidden');
        });
        listen('d2-load-return',()=>this.openMenu());
        const uploader=document.getElementById('driver-car-file');
        for(const button of document.querySelectorAll('[data-import-driver-car]'))
            button.addEventListener('click',()=>{
                if(!this.busy && uploader)uploader.click();
            });
        if(uploader)uploader.addEventListener('change',async()=>{
            const file=uploader.files?.[0];
            uploader.value='';
            if(!file || this.busy)return;
            if(!this.game){
                this.pendingUserCarFile=file;
                this.showCarStatus('Modelo selecionado: '+file.name+
                    '. Será preparado ao iniciar o jogo.');
                return;
            }
            this.showCarStatus('Validando e aplicando o modelo...');
            try{
                const ok=await this.game.freeVehicleAssets.importUserCar(file);
                if(ok){
                    this.settings.models=true;this.saveSettings();
                    const toggle=document.getElementById('d2-opt-models');
                    if(toggle)toggle.checked=true;
                    this.showCarStatus('GLB aplicado. Carros com cores independentes.');
                }else this.showCarStatus('Falha ao ler GLB. Use um arquivo válido até 12 MB.');
            }catch(_){this.showCarStatus('GLB inválido ou memória insuficiente.')}
        });
        for(const input of document.querySelectorAll('[data-driver-paint]')){
            input.value=this.settings.playerColor;
            input.addEventListener('input',()=>{
                const color=input.value;
                if(!/^#[a-f0-9]{6}$/i.test(color))return;
                this.settings.playerColor=color;this.saveSettings();
                for(const other of document.querySelectorAll('[data-driver-paint]'))
                    if(other!==input)other.value=color;
                if(this.game?.playerCar)
                    this.game.playerCar.setPaintColor(parseInt(color.slice(1),16));
            });
        }
        for(const btn of document.querySelectorAll('#d2-city-list [data-city]')){
            btn.addEventListener('click',()=>{
                this.selectedCity=btn.dataset.city;
                this.updateCitySelection();
            });
        }
        const settingIds={
            models:'d2-opt-models',
            scanlines:'d2-opt-scanlines',
            reducedMotion:'d2-opt-reduced-motion'
        };
        for(const [key,id] of Object.entries(settingIds)){
            const input=document.getElementById(id);
            if(!input)continue;
            input.checked=this.settings[key];
            input.addEventListener('change',()=>{
                this.settings[key]=input.checked;
                this.saveSettings();
                this.applySettings();
            });
        }
        document.addEventListener('keydown',e=>{
            if(this.busy||!this.menuVisible)return;
            if(e.key==='Enter' && e.target===document.body){
                e.preventDefault();this.start('story');
            }
        });
        this.updateCitySelection();
    }
    showCarStatus(message){
        const label=document.getElementById('d2-car-status');
        if(label)label.textContent=message;
        const hud=document.getElementById('asset-loader-status');
        if(hud)hud.textContent=message;
    }

    updateCitySelection() {
        for(const btn of document.querySelectorAll('#d2-city-list [data-city]')){
            const selected=btn.dataset.city===this.selectedCity;
            btn.classList.toggle('selected',selected);
            btn.setAttribute('aria-pressed',String(selected));
        }
        const message=document.getElementById('d2-city-hint');
        if(message)message.textContent='Passeio livre: '+this.selectedCity.toUpperCase()+
            '. A campanha Undercover começa em Chicago.';
    }
    applySettings() {
        const scanlines=document.getElementById('scanline-overlay');
        if(scanlines)scanlines.style.display=this.settings.scanlines?'':'none';
        document.body.classList.toggle('d2-reduced-motion',this.settings.reducedMotion);
        if(!this.game)return;
        this.game.reducedMotion=this.settings.reducedMotion ||
            !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        if(this.game.freeVehicleAssets &&
            this.game.freeVehicleAssets.enabled!==this.settings.models)
            this.game.freeVehicleAssets.toggle();
        if(this.game.playerCar)
            this.game.playerCar.setPaintColor(
                parseInt(this.settings.playerColor.slice(1),16));
    }
    openMenu() {
        if(this.busy)return false;
        this.refreshSave();
        this.menuVisible=true;
        if(this.game){
            this.game.isPaused=true;
            this.game.loadingActive=false;
            Object.keys(this.game.input).forEach(k=>{this.game.input[k]=false});
            this.game.lookBackActive=false;
        }
        this.loading.classList.add('hidden');
        this.menu.classList.remove('hidden');
        this.hud.classList.add('hidden');
        for(const id of ['missions-modal','architecture-modal'])
            document.getElementById(id)?.classList.add('hidden');
        return true;
    }
    resume() {
        if(this.busy||!this.game||!this.sessionReady)return false;
        this.game.isPaused=false;
        this.game.loadingActive=false;
        this.game.lastTime=performance.now();
        this.menu.classList.add('hidden');
        this.loading.classList.add('hidden');
        this.hud.classList.remove('hidden');
        this.menuVisible=false;
        return true;
    }
    togglePauseMenu() {
        if(this.busy||!this.game||!this.sessionReady)return false;
        return this.menuVisible?this.resume():this.openMenu();
    }
    paintProgress(data) {
        const percent=Math.max(0,Math.min(100,Math.round(data.fraction*100)));
        const fill=document.getElementById('d2-progress-fill');
        if(fill)fill.style.width=percent+'%';
        document.getElementById('d2-load-percent').textContent=percent+'%';
        document.getElementById('d2-load-status').textContent=data.label;
        document.getElementById('d2-progress-track').setAttribute('aria-valuenow',String(percent));
    }
    static nextPaint() {
        // Dois frames garantem que o DOM da barra seja pintado antes da
        // próxima tarefa pesada; nenhuma contagem fictícia de tempo.
        return new Promise(resolve=>requestAnimationFrame(()=>
            requestAnimationFrame(resolve)));
    }
    async runLoading(title,tasks) {
        if(this.busy)return false;
        this.busy=true;
        this.menuVisible=false;
        this.menu.classList.add('hidden');
        this.hud.classList.add('hidden');
        this.loading.classList.remove('hidden');
        document.getElementById('d2-load-title').textContent=title;
        document.getElementById('d2-load-errors').textContent=
            'Modelos externos opcionais usam alternativas low-poly se falharem.';
        document.getElementById('d2-load-return').classList.add('hidden');
        this.paintProgress({fraction:0,label:'Verificando recursos necessários'});
        try {
            await DriverLoadScheduler.execute(tasks,
                update=>this.paintProgress(update),DriverBootFlow.nextPaint);
            this.loading.classList.add('hidden');
            this.hud.classList.remove('hidden');
            return true;
        } catch(error) {
            document.getElementById('d2-load-errors').textContent=
                'Falha no carregamento: '+(error?.message||'erro desconhecido');
            document.getElementById('d2-load-return').classList.remove('hidden');
            return false;
        } finally {
            this.busy=false;
        }
    }

    async preloadModels(game,report) {
        if(!this.settings.models||!game.freeVehicleAssets?.enabled){
            report(1,'Malhas low-poly procedurais prontas');
            return;
        }
        const library=game.freeVehicleAssets;
        if(this.pendingUserCarFile){
            const file=this.pendingUserCarFile;
            this.pendingUserCarFile=null;
            const ok=await library.importUserCar(file);
            this.showCarStatus(ok?
                'Carro 3D personalizado carregado e aplicado.':
                'Não foi possível aplicar o GLB, mantidas malhas alternativas.');
        }
        // GLB publicado em assets/vehicles é prioridade. Esperamos a
        // aplicação no jogador antes de compilar shaders/câmera, evitando
        // primeiro frame com carro provisório e troca brusca de modelo.
        let userTemplate=null;
        let userTimer=null;
        try{
            userTemplate=await Promise.race([
                library.getUserTemplate(),
                new Promise(resolve=>{
                    userTimer=setTimeout(()=>resolve(null),6500);
                })
            ]);
        }catch(_){userTemplate=null}
        finally{if(userTimer!==null)clearTimeout(userTimer)}
        if(userTemplate){
            library.decorateFleet();
            await Promise.resolve();
            report(.25,'GLB Driver 2 carregado ('+
                library.userModelSource+') • pintura e escala prontas');
        }else{
            report(.25,'GLB ainda indisponível • modelo provisório mantido');
        }
        // A viatura enviada pelo usuário tem prioridade sobre o
        // police.glb genérico do pacote CC0. Sem o asset publicado,
        // o modo procedural/CC0 permanece disponível.
        let policeTemplate=null,policeTimer=null;
        try{
            policeTemplate=await Promise.race([
                library.getPoliceTemplate(),
                new Promise(resolve=>{
                    policeTimer=setTimeout(()=>resolve(null),6500);
                })
            ]);
        }catch(_){policeTemplate=null}
        finally{if(policeTimer!==null)clearTimeout(policeTimer)}
        if(policeTemplate){
            library.decorateFleet();
            report(.35,'Viatura personalizada GLB pronta • portas articuladas');
        }else{
            report(.35,'Police GLB ausente • viatura alternativa ativa');
        }
        const names=[...new Set(game.vehicles
            .filter(v=>!(userTemplate && library.canUseDriver2Model(v)))
            .filter(v=>!(policeTemplate&&v.isPolice))
            .map(v=>library.getModelName(v)).filter(Boolean))];
        if(!names.length) {
            report(1,userTemplate?'Carro GLB pronto':'Malhas alternativas prontas');
            return;
        }
        let finished=0,success=0,skipped=0;
        const TIMEOUT=4500;
        // Promises genuínas de GLTFLoader. Sem resposta em 4,5 segundos,
        // os carros procedurais garantem jogabilidade offline.
        await Promise.all(names.map(async name=>{
            let timeoutId=null;
            const fallback=new Promise(resolve=>{
                timeoutId=setTimeout(()=>resolve(null),TIMEOUT);
            });
            let model=null;
            try {
                model=await Promise.race([library.getScene(name),fallback]);
            } catch(_) {model=null}
            finally{if(timeoutId!==null)clearTimeout(timeoutId)}
            if(model)success++;else skipped++;
            finished++;
            report(.25+.75*finished/names.length,
                'Modelos externos: '+success+' carregados, '+skipped+
                ' usando fallback ('+finished+'/'+names.length+')');
        }));
        game.freeVehicleAssets.decorateFleet();
        if(skipped){
            document.getElementById('d2-load-errors').textContent=
                skipped+' asset(s) externos indisponíveis. Usando malhas PS1 sem bloquear o jogo.';
        }
    }

    static shaderTask(game,report) {
        // Os bairros ao redor do jogador já entram com detalhes prontos,
        // antes da primeira pintura visível, sem pops iniciais.
        game.city.updateDistrictLOD(0,game.getPlayerPosition(),true);
        game.renderer.compile(game.scene,game.camera);
        // Força a alocação inicial dos recursos WebGL necessários à cena.
        game.renderer.render(game.scene,game.camera);
        report(1,'Materiais e shaders prontos');
    }

    async start(mode) {
        if(this.busy)return false;
        if(mode==='resume')return this.resume();
        const save=mode==='continue'?this.availableSave():null;
        if(mode==='continue'&&!save){this.refreshSave();return false}
        const city=mode==='story'?'chicago':
            mode==='continue'?save.city:this.selectedCity;
        const first=!this.game;
        const needsCity=first || this.game.currentCityKey!==city ||
            !this.game.city.ready;
        let game=this.game;
        if(game)game.loadingActive=true;
        const tasks=[];
        if(first)tasks.push({
            label:'Inicializando Three.js, cena e controles',weight:12,
            run:()=>{
                if(!window.THREE || !THREE.WebGLRenderer)
                    throw new Error('Three.js não carregou. Verifique a conexão.');
                game=new Driver2GameEngine({deferCityBuild:true});
                this.game=game;window.DriverGame=game;
                game.loadingActive=true;
                this.applySettings();
            }
        });
        if(needsCity)tasks.push({
            label:'Construindo o mapa de '+city.toUpperCase(),weight:50,
            run:report=>game.city.loadCityPresetProgressive(city,report)
        });
        tasks.push({
            label:'Criando veículos, pedestres e objetivos',weight:16,
            run:()=>{
                // Uma única criação de frota no início da missão,
                // evitando recriar todos os veículos duas vezes.
                // UNDERCOVER começa explorando Chicago: o marcador
                // da missão é acionado somente por J, não no loader.
                game.storyCampaign=mode==='story' ||
                    (mode==='continue'&&!!save?.completed?.some(
                        type=>type.startsWith('story_')));
                game.missionType='freeroam';
                if(needsCity)game.activateCityPreset(city);
                if(mode==='continue'){
                    if(!game.homeSave.restore(game,save))
                        throw new Error('Save incompatível. Nada foi apagado.');
                }else if(!needsCity){
                    game.startMission(game.missionType);
                }
                this.applySettings();
            }
        });
        tasks.push({
            label:'Preparando modelos opcionais dos veículos',weight:14,
            run:report=>this.preloadModels(game,report)
        });
        tasks.push({
            label:'Compilando materiais e shaders WebGL',weight:8,
            run:report=>DriverBootFlow.shaderTask(game,report)
        });
        const success=await this.runLoading(
            'CARREGANDO '+city.toUpperCase(),tasks);
        if(!success)return false;
        this.sessionReady=true;
        if(!this.loopStarted){game.animate();this.loopStarted=true}
        this.resume();
        if(mode==='driving')
            document.getElementById('missions-modal').classList.remove('hidden');
        if(mode==='story'){
            game.missionToastText='UNDERCOVER • Dirija ao marcador verde e pressione J para começar.';
            game.missionToastRemaining=6;
        }
        return true;
    }

    async switchCity(game,cityKey) {
        if(this.busy)return false;
        if(!CITY_PRESETS[cityKey])return false;
        if(game.currentCityKey===cityKey)return true;
        const previous=game.currentCityKey;
        game.loadingActive=true;
        const tasks=[
            {label:'Construindo o mapa de '+cityKey.toUpperCase(),
                weight:70,run:report=>game.city.loadCityPresetProgressive(cityKey,report)},
            {label:'Posicionando frota e personagens',weight:12,run:()=>{
                game.missionType='freeroam';
                game.activateCityPreset(cityKey);
                this.applySettings();
            }},
            {label:'Baixando e preparando modelos 3D',weight:12,
                run:report=>this.preloadModels(game,report)},
            {label:'Compilando shaders',weight:6,
                run:report=>DriverBootFlow.shaderTask(game,report)}
        ];
        const success=await this.runLoading('CARREGANDO '+cityKey.toUpperCase(),tasks);
        if(!success){
            // Nunca deixar a cidade incompleta visível após falha.
            try{game.missionType='freeroam';game.changeCity(previous)}catch(_){}
            game.loadingActive=false;
            return false;
        }
        game.loadingActive=false;
        this.resume();
        return true;
    }

    async loadSavedGame(game) {
        const save=this.availableSave();
        if(!save){
            game.showSaveStatus('Nenhuma partida salva válida neste navegador.');
            return false;
        }
        if(game.currentCityKey===save.city)return game.loadHomeGame();
        if(this.busy)return false;
        game.loadingActive=true;
        const tasks=[
            {label:'Gerando a cidade do save',weight:72,
                run:report=>game.city.loadCityPresetProgressive(save.city,report)},
            {label:'Restaurando missão, posição e carros',weight:16,run:()=>{
                game.missionType='freeroam';
                game.activateCityPreset(save.city);
                if(!game.homeSave.restore(game,save))
                    throw new Error('Save não pôde ser restaurado');
                this.applySettings();
            }},
            {label:'Preparando modelos',weight:7,
                run:report=>this.preloadModels(game,report)},
            {label:'Compilando shaders',weight:5,
                run:report=>DriverBootFlow.shaderTask(game,report)}
        ];
        const ok=await this.runLoading('CARREGANDO PARTIDA',tasks);
        if(ok){
            this.resume();
            game.showSaveStatus('Partida carregada com sucesso!');
        }else game.loadingActive=false;
        return ok;
    }
}
