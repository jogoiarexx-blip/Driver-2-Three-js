/**
 * Navegação urbana em uma malha de avenidas espaçadas em 80 unidades.
 * Carros civis respeitam limites e semáforos; viaturas procuram Tanner
 * pelas ruas, mas entram em perseguição direta onde não há prédios.
 * Não depende de módulos/bundlers, compatível com GitHub Pages.
 */
class DriverTrafficAI {
    constructor(city) {
        this.city = city;
        this.routes = new WeakMap();
        this.roadLimit = city.roadExtent || 320;
        this.blockSize = 80;
        this.laneOffset = 4;
        this.policeRoadblocks = [];
        this.policeMemory = new WeakMap();
    }

    reset() {
        this.routes = new WeakMap();
        this.policeMemory = new WeakMap();
    }

    nearestGrid(value) {
        return THREE.MathUtils.clamp(
            Math.round(value / this.blockSize) * this.blockSize,
            -this.roadLimit, this.roadLimit
        );
    }

    positionInLane(axis, sign, road, along) {
        if (axis === 'z') {
            return { x: road + (sign > 0 ? this.laneOffset : -this.laneOffset), z: along };
        }
        return { x: along, z: road + (sign > 0 ? -this.laneOffset : this.laneOffset) };
    }

    getRoute(car) {
        let route = this.routes.get(car);
        if (route) return route;
        const headingX = Math.sin(car.heading);
        const headingZ = Math.cos(car.heading);
        const axis = Math.abs(headingX) > Math.abs(headingZ) ? 'x' : 'z';
        const sign = (axis === 'z' ? headingZ : headingX) >= 0 ? 1 : -1;
        const road = this.nearestGrid(axis === 'z' ? car.x : car.z);
        const along = axis === 'z' ? car.z : car.x;
        let next = sign > 0 ?
            (Math.floor(along / this.blockSize) + 1) * this.blockSize :
            (Math.ceil(along / this.blockSize) - 1) * this.blockSize;
        next = THREE.MathUtils.clamp(next, -this.roadLimit, this.roadLimit);
        if (next === along || Math.abs(next - along) < 4) {
            next = THREE.MathUtils.clamp(next + sign * this.blockSize,
                -this.roadLimit, this.roadLimit);
        }
        // Nunca atribuir uma rota inicial atravessando água ou paredes.
        // Na margem de um canal o veículo retorna ao cruzamento anterior
        // para escolher uma direção terrestre.
        const current=this.positionInLane(axis,sign,road,along);
        const goal=this.positionInLane(axis,sign,road,next);
        if(typeof DriverRoadGeometry!=='undefined' &&
            !DriverRoadGeometry.segmentDrivable(this.city,
                current.x,current.z,goal.x,goal.z)){
            next=this.nearestGrid(along);
        }
        route = {
            axis, sign, road,
            target: this.positionInLane(axis, sign, road, next),
            reverseTimer: 0, stuckSeconds: 0,
            previousX: car.x, previousZ: car.z
        };
        this.routes.set(car, route);
        return route;
    }

    chooseNext(car, route, playerPos, wanted) {
        const crossX = this.nearestGrid(route.target.x);
        const crossZ = this.nearestGrid(route.target.z);
        const possible = [];
        for (const axis of ['x', 'z']) {
            for (const sign of [-1, 1]) {
                const nextX = crossX + (axis === 'x' ? sign * this.blockSize : 0);
                const nextZ = crossZ + (axis === 'z' ? sign * this.blockSize : 0);
                if (Math.abs(nextX) > this.roadLimit || Math.abs(nextZ) > this.roadLimit) continue;
                if (this.city.isPointBlocked(nextX, nextZ, 2)) continue;
                // O destino livre não garante a passagem: há canais entre
                // cruzamentos. Validar faixas no corredor inteiro.
                if(typeof DriverRoadGeometry!=='undefined' &&
                    !DriverRoadGeometry.laneSegment(this.city,
                        axis,sign,crossX,crossZ,nextX,nextZ,
                        this.laneOffset))continue;
                const backwards = axis === route.axis && sign === -route.sign;
                const straight = axis === route.axis && sign === route.sign;
                const lane = this.positionInLane(axis, sign,
                    axis === 'z' ? crossX : crossZ, axis === 'z' ? nextZ : nextX);
                possible.push({ axis, sign, lane, straight, backwards });
            }
        }
        if (!possible.length) {
            // Evita fallback apontando para água/obstáculo invisível.
            // Segure no cruzamento, depois a rotina de encalhe poderá ré.
            route.target=this.positionInLane(route.axis,route.sign,route.road,
                route.axis==='z'?crossZ:crossX);
            route.reverseTimer=0.85;
            return;
        }

        let selected;
        const intercept = wanted && playerPos ?
            PolicePursuitTactics.targetFor(car, playerPos, 90) : playerPos;
        const routeGoal = wanted && PolicePursuitTactics.targetIsSafe(this.city, intercept) ?
            intercept : playerPos;
        if (routeGoal && (wanted || car.isTarget)) {
            const ranked = possible.map(item => {
                const d = Math.abs(item.lane.x - routeGoal.x) + Math.abs(item.lane.z - routeGoal.z);
                return { item, score: car.isTarget ? -d : d };
            }).sort((a, b) => a.score - b.score);
            selected = ranked[0].item;
        } else {
            const candidates = possible.filter(p => !p.backwards);
            const pool = candidates.length ? candidates : possible;
            const straight = pool.find(p => p.straight);
            selected = straight && Math.random() < 0.68 ?
                straight : pool[Math.floor(Math.random() * pool.length)];
        }
        route.axis = selected.axis;
        route.sign = selected.sign;
        route.road = selected.axis === 'z' ? crossX : crossZ;
        route.target = selected.lane;
    }

    unobstructed(car, target) {
        // O teto do Lower Wacker interrompe rastreamento de policiais externos.
        if(typeof DriverChicagoLowerWacker!=='undefined' &&
            DriverChicagoLowerWacker.blocksPoliceSight(this.city,car,target))
            return false;
        // Predição curta ao invés de atravessar prédios em perseguição direta.
        const dx = target.x - car.x;
        const dz = target.z - car.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 75 || distance < 0.01) return false;
        // Obstáculos e rio devem interromper a perseguição direta.
        // Amostragem curta com retorno antecipado (sem raycast WebGL).
        const samples=Math.max(2,Math.ceil(distance/6));
        for(let i=1;i<samples;i++){
            const p=i/samples,x=car.x+dx*p,z=car.z+dz*p;
            if(this.city.isPointBlocked(x,z,2) ||
                this.city.isWaterAt?.(x,z))return false;
        }
        return true;
    }

    pursuitInformation(car, dt, playerPos, felony) {
        if (!playerPos) return null;
        let memory=this.policeMemory.get(car);
        if (!memory) {
            memory={lastKnown:null,remaining:0,radioCooldown:0,visible:false};
            this.policeMemory.set(car,memory);
        }
        memory.radioCooldown=Math.max(0,memory.radioCooldown-dt);
        const visible=this.unobstructed(car,playerPos);
        memory.visible=visible;
        if (visible) {
            memory.lastKnown={
                x:playerPos.x,z:playerPos.z,heading:playerPos.heading||0,
                speed:playerPos.speed||0
            };
            memory.remaining=7;
        } else {
            memory.remaining=Math.max(0,memory.remaining-dt);
            // Informação de rádio esporádica e imprecisa quando está distante;
            // sem linha de visão a IA não recebe a localização exata contínua.
            if (memory.remaining<=0 && memory.radioCooldown<=0 && felony>=35) {
                memory.lastKnown={
                    x:this.nearestGrid(playerPos.x),
                    z:this.nearestGrid(playerPos.z),
                    heading:0,speed:0
                };
                memory.remaining=5;
                memory.radioCooldown=10;
            }
        }
        return memory.remaining>0 ? memory.lastKnown : null;
    }

    barrierAhead(car) {
        const fx=Math.sin(car.heading), fz=Math.cos(car.heading);
        let nearest=Infinity;
        for (const barrier of this.policeRoadblocks || []) {
            if (!barrier || barrier.smashed || (barrier.arming || 0)>0) continue;
            const dx=barrier.x-car.x,dz=barrier.z-car.z;
            const forward=dx*fx+dz*fz;
            const side=Math.abs(dx*fz-dz*fx);
            if (forward>0 && forward<44 && side<4.1) {
                nearest=Math.min(nearest,forward);
            }
        }
        return nearest;
    }

    vehicleAhead(car, vehicles) {
        const dirX = Math.sin(car.heading), dirZ = Math.cos(car.heading);
        for (const other of vehicles) {
            if (other === car ||
                Math.abs((other.y||0)-(car.y||0))>3.2) continue;
            const dx = other.x - car.x, dz = other.z - car.z;
            const forward = dx * dirX + dz * dirZ;
            const side = Math.abs(dx * dirZ - dz * dirX);
            const gap = car.bodyStyle === 'bus' || car.bodyStyle === 'truck' ? 9 : 7;
            if (forward > 0 && forward < 18 + Math.abs(car.speed) * 0.3 && side < gap * 0.5) {
                return forward;
            }
        }
        return Infinity;
    }

    getInput(car, dt, vehicles, playerPos, felony) {
        const route = this.getRoute(car);
        const scripted = car.scriptedDrive || null;
        // Aberturas cinematográficas: o suspeito aguarda Tanner entrar
        // no carro, mas não altera o relógio das rotas preexistentes.
        if(scripted && scripted.waitSeconds>0){
            scripted.waitSeconds=Math.max(0,scripted.waitSeconds-
                Math.min(0.05,Math.max(0,dt)));
            return {
                up:false,down:car.speed>1,left:false,right:false,
                handbrake:false,sprint:false
            };
        }
        const waypoint = scripted ?
            DriverTailingDropMission.advanceRoute(car) : null;
        // Missões seguem o waypoint original, mas o volante recebe
        // uma sub-rota segura (pontes, cruzamentos e caixas AABB).
        const missionRoute=scripted && waypoint &&
            this.city?.preset?.id==='chicago' &&
            typeof DriverPursuitNavigation!=='undefined'?
            DriverPursuitNavigation.follow(
                this.city,car,waypoint,route,dt):null;
        const wanted = car.isPolice && felony > 25;
        const hostile = !!car.isMafia;
        // Mafiosos seguem Tanner sem sirene nem depender de felony.
        const pursuing = wanted || hostile;
        const pursuitTarget = wanted ?
            this.pursuitInformation(car,dt,playerPos,felony) :
            (hostile && playerPos ? playerPos : null);
        const previousTarget = route.target;
        if (!scripted &&
            Math.hypot(car.x - previousTarget.x, car.z - previousTarget.z) < 10) {
            this.chooseNext(car, route,
                pursuing ? pursuitTarget : (car.isTarget ? playerPos : null),
                pursuing && !!pursuitTarget);
        }

        let target = scripted ?
            (missionRoute?
                (missionRoute.target || {x:car.x,z:car.z}):
                (waypoint || {x:car.x,z:car.z})) : route.target;
        const distanceToPlayer = playerPos ?
            Math.hypot(car.x - playerPos.x, car.z - playerPos.z) : Infinity;
        let maneuver=null;
        if(hostile && pursuitTarget && this.unobstructed(car,pursuitTarget)){
            // A máfia tenta aproximar-se do carro, mas usa a rua nas esquinas.
            target=pursuitTarget;
        }
        if (wanted && pursuitTarget) {
            // Somente policiais que enxergam Tanner tentam fechar a trajetória.
            // Caso haja edifício ou obstáculo no trajeto, permanecem nas ruas.
            const seen = !!this.policeMemory.get(car)?.visible;
            const candidate = PolicePursuitTactics.maneuverFor(
                car,pursuitTarget,felony,this.city,seen
            );
            if (candidate && this.unobstructed(car,candidate)) {
                maneuver=candidate;
                target=candidate;
            }
            const formation = PolicePursuitTactics.targetFor(car,pursuitTarget,felony);
            if (!maneuver) {
                if (PolicePursuitTactics.targetIsSafe(this.city,formation) &&
                    this.unobstructed(car,formation)) {
                    target = formation;
                } else if (this.unobstructed(car,pursuitTarget)) {
                    target = pursuitTarget;
                }
            }
        }

        if(wanted && pursuitTarget &&
            this.city?.preset?.id==='chicago' &&
            !this.policeMemory.get(car)?.visible &&
            typeof DriverPursuitNavigation!=='undefined'){
            // Sem enxergar Tanner, a viatura vai até o último cruzamento
            // conhecido pela rede de ruas, sem atravessar rio ou prédio.
            const destination={
                x:this.nearestGrid(pursuitTarget.x),
                z:this.nearestGrid(pursuitTarget.z)
            };
            route.policeNavHolder=route.policeNavHolder||{};
            const policePath=DriverPursuitNavigation.follow(
                this.city,car,destination,route.policeNavHolder,dt);
            if(policePath.target && !policePath.blocked)
                target=policePath.target;
        }

        const desiredHeading = Math.atan2(target.x - car.x, target.z - car.z);
        const angle = Math.atan2(
            Math.sin(desiredHeading - car.heading),
            Math.cos(desiredHeading - car.heading)
        );
        const turn = Math.abs(angle);
        const input = {
            up: false, down: false, left: angle < -0.10,
            right: angle > 0.10, handbrake: false, sprint: false
        };

        let maxSpeed = hostile ? 38 : wanted ? 40 : car.isTarget ? 34 :
            (car.bodyStyle === 'bus' || car.bodyStyle === 'truck' ? 17 : 23);
        if (maneuver) maxSpeed=Math.min(maxSpeed,maneuver.speedLimit);
        if (scripted) maxSpeed=scripted.done||missionRoute?.blocked?0:
            Math.min(maxSpeed,scripted.maxSpeed||23);
        car.policeManeuver = maneuver ? maneuver.mode : null;
        // A velocidade recomendada cai progressivamente quando a curva
        // aproxima de 90 graus; viaturas não fazem curvas a 140 km/h.
        if (turn > 0.24) {
            maxSpeed = Math.min(maxSpeed, Math.max(8, 31 / (1 + turn * 1.7)));
        }
        // Desaceleração preventiva nas interseções urbanas.
        const toJunction = scripted && waypoint ?
            Math.hypot(car.x-waypoint.x,car.z-waypoint.z) :
            Math.hypot(car.x - route.target.x, car.z - route.target.z);
        if (toJunction < 28 && Math.abs(car.speed) > 19) {
            maxSpeed = Math.min(maxSpeed, 19);
        }

        const distanceToIntersection = scripted ? toJunction :
            Math.hypot(car.x-route.target.x,car.z-route.target.z);
        const junctionAxis=scripted && waypoint ?
            (Math.abs(waypoint.x-car.x)>Math.abs(waypoint.z-car.z)?'x':'z') :
            route.axis;
        const stopForRed=!pursuing && (!car.isTarget || !!scripted) &&
            (!scripted || !scripted.done) &&
            distanceToIntersection<28 && distanceToIntersection>7 &&
            !this.city.isTrafficGreen(junctionAxis);
        const distanceAhead = this.vehicleAhead(car, vehicles);
        const stopForCar = distanceAhead < 8 + Math.max(0, car.speed) * 0.33;
        const slowForCar = distanceAhead < 14 + Math.max(0, car.speed) * 0.45;
        if (slowForCar) maxSpeed = Math.min(maxSpeed, 7);
        // Civis e polícia reduzem e param antes de cavaletes intactos.
        // Não atravessam o bloqueio invisivelmente enquanto Tanner o enfrenta.
        const barrierDistance = this.barrierAhead(car);
        if (barrierDistance < 38) {
            maxSpeed = Math.min(maxSpeed, barrierDistance < 17 ? 0 : 10);
        }
        // Civis cedem passagem quando há alguém efetivamente na
        // faixa. Perseguições de missão/polícia mantêm seus controles.
        if(!pursuing&&!scripted &&
            typeof DriverPedestrianSidewalks!=='undefined'){
            const pedDistance=DriverPedestrianSidewalks.approachingCrossing(
                car,this.city.activePedestrianCrossings||[],23);
            if(pedDistance<22){
                maxSpeed=Math.min(maxSpeed,pedDistance<10?0:
                    Math.max(5,(pedDistance-9)*.65));
            }
        }
        if (stopForRed || stopForCar) maxSpeed = 0;

        // Saída de encalhe após colisão, sem teleportes pela cidade.
        const moved = Math.hypot(car.x - route.previousX, car.z - route.previousZ);
        route.previousX = car.x;
        route.previousZ = car.z;
        if (maxSpeed > 0 && moved < 0.04 && Math.abs(car.speed) < 1.6) {
            route.stuckSeconds += dt;
        } else {
            route.stuckSeconds = 0;
        }
        if(route.stuckSeconds>(scripted?1.75:2.2)){
            // Mesmo os suspeitos de missões podem dar ré e tentar
            // outro percurso, sem teleportar ou avançar waypoint.
            route.reverseTimer=scripted?.65:.85;
            route.stuckSeconds=0;
            if(scripted)route.missionNavigation=null;
        }
        if (route.reverseTimer > 0) {
            route.reverseTimer -= dt;
            input.up = false;
            input.down = true;
            input.handbrake = false;
            // Virar o volante no sentido oposto durante a ré.
            input.left=angle>=0;
            input.right=!input.left;
        } else if (car.speed > maxSpeed + 1.5) {
            input.down = true;
        } else if (maxSpeed > 0 && car.speed < maxSpeed) {
            input.up = true;
        } else if (maxSpeed === 0 && car.speed > 0.5) {
            input.down = true;
        }
        car.sirenActive = wanted && !hostile;
        car.policeLineOfSight = wanted &&
            !!this.policeMemory.get(car)?.visible;
        return input;
    }
}
