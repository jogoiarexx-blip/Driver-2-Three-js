/**
 * Passeio Livre experimental sobre a geometria extraída do Driver 2 PS1.
 * Reutiliza DriverVehicle.updatePhysics/DriverArcadePhysics do jogo.
 * NÃO habilita missão, polícia/tráfego em grade procedural ou saves antigos.
 */
class DriverChicagoOriginalFreeRide {
    constructor({root=document.getElementById('chicago-ride-root'),
        status=document.getElementById('chicago-ride-status')}={}) {
        this.root=root;this.status=status;
        this.world=new DriverChicagoOriginalDriveMap();
        this.scene=new THREE.Scene();
        this.scene.background=new THREE.Color(0x9db1b9);
        this.scene.fog=new THREE.Fog(0x9db1b9,175,540);
        this.camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.15,720);
        this.scene.add(new THREE.HemisphereLight(0xc6e4ff,0x525861,1.18));
        const sun=new THREE.DirectionalLight(0xffebc4,.82);
        sun.position.set(-90,140,-70);
        this.scene.add(sun);
        this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
        this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));
        this.renderer.setSize(innerWidth,innerHeight);
        this.renderer.outputEncoding=THREE.sRGBEncoding;
        root.appendChild(this.renderer.domElement);
        this.stream=new DriverChicagoOriginalTileStream({
            scene:this.scene,THREE,baseUrl:'./chicago/',
            maxLoaded:22,loadRadius:55,unloadRadius:75,maxParallel:3,
            onError:e=>this.show('Setor 3D: '+String(e?.message||e)),
            onChange:stats=>{this.stats=stats;}
        });
        this.keys=new Set();
        this.paused=false;this.quality=1;this.started=false;this.last=0;
        this.cameraMode=0;this.cameraFocus=new THREE.Vector3();
        this.effects={
            addSkidMark:()=>{},spawnTireSmoke:()=>{},
            spawnWaterSplash:()=>{},spawnImpactSparks:()=>{},
            spawnCarBreakaway:()=>{},ejectHubcap:()=>{}
        };
        this._keydown=e=>{
            const k=e.key.toLowerCase();
            if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))
                e.preventDefault();
            if(e.repeat && ['p','c','r','q','escape'].includes(k))return;
            if(k==='p'||k==='escape')this.paused=!this.paused;
            if(k==='c')this.cameraMode=(this.cameraMode+1)%3;
            if(k==='r')this.resetVehicle();
            if(k==='q')this.switchQuality();
            this.keys.add(k);
        };
        this._keyup=e=>this.keys.delete(e.key.toLowerCase());
        this._blur=()=>this.keys.clear();
        this._resize=()=>{
            this.camera.aspect=innerWidth/innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(innerWidth,innerHeight);
        };
        window.addEventListener('keydown',this._keydown);
        window.addEventListener('keyup',this._keyup);
        window.addEventListener('blur',this._blur);
        window.addEventListener('resize',this._resize);
        document.querySelector('#chicago-ride-reset')?.addEventListener(
            'click',()=>this.resetVehicle());
        document.querySelector('#chicago-ride-camera')?.addEventListener(
            'click',()=>this.cameraMode=(this.cameraMode+1)%3);
        document.querySelector('#chicago-ride-pause')?.addEventListener(
            'click',()=>this.paused=!this.paused);
        document.querySelector('#chicago-ride-quality')?.addEventListener(
            'click',()=>this.switchQuality());
    }
    show(message){if(this.status)this.status.textContent=message;}
    async start() {
        this.show('Lendo solo e colisões da Chicago original...');
        await this.world.load('./chicago/drive-mask.json');
        this.show('Preparando os 54 setores do mapa PS1...');
        await this.stream.start();
        // O plano quase horizontal do original é Y=0; seu menor vértice
        // está abaixo desse plano, portanto NÃO usar -minY para o piso.
        this.stream.root.position.y=0;
        this.car=new DriverVehicle(this.scene,{
            name:'TANNER • CHICAGO ORIGINAL',bodyStyle:'muscle',
            color:0xa41e24,x:this.world.spawn.x,z:this.world.spawn.z,
            heading:this.world.spawn.heading,maxSpeed:49,accel:28
        });
        this.resetVehicle();
        this.started=true;
        this.show('Mapa original carregado. WASD/setas para dirigir.');
        this.last=performance.now();
        requestAnimationFrame(now=>this.frame(now));
        window.DriverChicagoOriginalRide=this;
        return this;
    }
    resetVehicle(){
        if(!this.car||!this.world.ready)return;
        const pos=this.world.spawn;
        this.car.x=pos.x;this.car.z=pos.z;this.car.heading=pos.heading;
        this.car.y=0;this.car.vy=0;this.car.speed=0;
        this.car.lateralVelocity=0;this.car.damage=0;
        this.car.isSubmerged=false;this.car.surfaceSlope=0;
        this.car.lastDryPosition={x:pos.x,z:pos.z,heading:pos.heading};
        this.car.updateTransform();
        this.camera.position.set(pos.x,7,pos.z-15);
        this.cameraFocus.set(pos.x,1,pos.z);
    }
    switchQuality(){
        this.quality=(this.quality+1)%3;
        const factors=[1,1.35,1.8];
        this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,factors[this.quality]));
        this.stream.maxLoaded=[15,22,30][this.quality];
        this.stream.loadRadius=[42,55,70][this.quality];
        this.stream.unloadRadius=[62,75,92][this.quality];
    }
    input(){
        const has=(...keys)=>keys.some(k=>this.keys.has(k));
        return {
            up:has('w','arrowup'),down:has('s','arrowdown'),
            left:has('a','arrowleft'),right:has('d','arrowright'),
            handbrake:has(' '),sprint:has('shift')
        };
    }
    updateCamera(dt){
        const car=this.car,sy=Math.sin(car.heading),cz=Math.cos(car.heading);
        const spec=this.cameraMode===1?
            {x:car.x+sy*.9,y:car.y+1.75,z:car.z+cz*.9,
                tx:car.x+sy*24,tz:car.z+cz*24,ty:car.y+1.4}:
            this.cameraMode===2?
            {x:car.x+sy*10+cz*19,y:car.y+20,z:car.z+cz*10-sy*19,
                tx:car.x+sy*3,tz:car.z+cz*3,ty:car.y+1.2}:
            {x:car.x-sy*11,y:car.y+4.1,z:car.z-cz*11,
                tx:car.x+sy*5,tz:car.z+cz*5,ty:car.y+1.35};
        const response=1-Math.exp(-Math.min(.06,dt)*7);
        this.camera.position.lerp(new THREE.Vector3(spec.x,spec.y,spec.z),response);
        this.cameraFocus.lerp(new THREE.Vector3(spec.tx,spec.ty,spec.tz),response);
        this.camera.lookAt(this.cameraFocus);
    }
    frame(now) {
        if(!this.started)return;
        const dt=Math.min(.05,Math.max(0,(now-this.last)*.001));this.last=now;
        if(!this.paused) {
            this.car.updatePhysics(dt,this.input(),this.world,this.effects,null,true);
            this.updateCamera(dt);
        }
        this.stream.update({x:this.car.x,z:this.car.z});
        this.renderer.render(this.scene,this.camera);
        const kmh=Math.round(Math.abs(this.car.speed)*3.4);
        const stat=this.stats||{};
        const speed=document.getElementById('chicago-ride-speed');
        if(speed)speed.textContent=String(kmh).padStart(3,'0');
        const count=document.getElementById('chicago-ride-sectors');
        if(count)count.textContent=(stat.tilesLoaded||0)+'/54';
        const damage=document.getElementById('chicago-ride-damage');
        if(damage)damage.textContent=Math.round(this.car.damage)+'%';
        const notice=document.getElementById('chicago-ride-notice');
        if(notice)notice.textContent=this.paused?'PAUSADO • P para voltar':
            this.world.isPointBlocked(this.car.x+Math.sin(this.car.heading)*4,
                this.car.z+Math.cos(this.car.heading)*4,1.55)?
                'OBSTÁCULO / BORDA DO PISO À FRENTE':'PASSEIO LIVRE • CHICAGO ORIGINAL PS1';
        requestAnimationFrame(t=>this.frame(t));
    }
    dispose(){
        this.started=false;
        this.stream.dispose();
        if(this.car){GPUResourceUtils.disposeSubtree(this.car.root);
            this.scene.remove(this.car.root);}
        this.renderer.dispose();
        window.removeEventListener('keydown',this._keydown);
        window.removeEventListener('keyup',this._keyup);
        window.removeEventListener('blur',this._blur);
        window.removeEventListener('resize',this._resize);
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoOriginalFreeRide;
