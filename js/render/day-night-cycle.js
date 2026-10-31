/**
 * Sol e lua visuais com ciclo completo de 15 minutos (Three.js r128).
 * A mesma direção que desenha o sol controla a luz e a projeção da sombra.
 * Sem fontes externas, física ou geometria de mapa; sprites não recebem fog.
 */
class DriverDayNightCycle {
    static DURATION = 900;
    static clamp(value,min=0,max=1) {
        return Math.max(min,Math.min(max,value));
    }
    static smooth(a,b,value) {
        const t=this.clamp((value-a)/(b-a));
        return t*t*(3-2*t);
    }
    constructor(game,{duration=DriverDayNightCycle.DURATION,time=0.47}={}) {
        this.game=game;
        this.time=((time%1)+1)%1;
        this.duration=Math.max(60,Number(duration)||900);
        this.shadowsEnabled=true;
        this.rain=false;
        this.lastHeadlights=null;
        this.lastBadge='';
        this.sky=new THREE.Color();
        this.nightSky=new THREE.Color(0x10192d);
        this.twilightSky=new THREE.Color(0xc08165);
        this.daySky=new THREE.Color();
        this.daySun=new THREE.Color();
        this.sunsetSun=new THREE.Color(0xffa266);
        this.nightAmbient=new THREE.Color(0x8198c4);
        this.dayAmbient=new THREE.Color(0xf1f5f9);

        this.moonLight=new THREE.DirectionalLight(0x9ab5e8,0);
        this.moonLight.castShadow=false;
        game.scene.add(this.moonLight);
        game.scene.add(this.moonLight.target);
        game.scene.add(game.sunLight.target);

        const sun=game.sunLight;
        sun.shadow.mapSize.set(1024,1024);
        sun.shadow.camera.left=-78;
        sun.shadow.camera.right=78;
        sun.shadow.camera.top=78;
        sun.shadow.camera.bottom=-78;
        sun.shadow.camera.near=1;
        sun.shadow.camera.far=390;
        sun.shadow.bias=-0.0004;
        sun.shadow.normalBias=0.025;
        game.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
        game.renderer.shadowMap.enabled=true;

        this.sunSprite=this.createDisc('sun');
        this.moonSprite=this.createDisc('moon');
        game.scene.add(this.sunSprite,this.moonSprite);
        this.apply(0,true);
    }
    createDisc(kind) {
        const canvas=document.createElement('canvas');
        canvas.width=canvas.height=128;
        const ctx=canvas.getContext('2d');
        const isSun=kind==='sun';
        const grad=ctx.createRadialGradient(64,64,2,64,64,63);
        if(isSun) {
            grad.addColorStop(0,'rgba(255,255,228,1)');
            grad.addColorStop(.36,'rgba(255,238,165,1)');
            grad.addColorStop(.48,'rgba(255,190,86,.92)');
            grad.addColorStop(.67,'rgba(255,165,56,.13)');
        } else {
            grad.addColorStop(0,'rgba(245,249,255,1)');
            grad.addColorStop(.42,'rgba(223,231,246,1)');
            grad.addColorStop(.50,'rgba(191,207,232,.9)');
            grad.addColorStop(.63,'rgba(174,191,223,.10)');
        }
        grad.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=grad;
        ctx.fillRect(0,0,128,128);
        const texture=new THREE.CanvasTexture(canvas);
        texture.name='driver-day-night-'+kind;
        const material=new THREE.SpriteMaterial({
            map:texture,transparent:true,depthWrite:false,depthTest:true,
            fog:false,toneMapped:false
        });
        const sprite=new THREE.Sprite(material);
        const size=isSun?42:31;
        sprite.scale.set(size,size,1);
        sprite.name='driver-sky-'+kind;
        sprite.frustumCulled=false;
        return sprite;
    }
    setShadowsEnabled(enabled) {
        this.shadowsEnabled=!!enabled;
        this.game.renderer.shadowMap.enabled=this.shadowsEnabled;
        this.apply(0,true);
    }
    setWeather(mode) {
        if(mode==='day')this.time=0.49;       // quase meio-dia
        else if(mode==='dusk')this.time=0.72; // pôr do sol
        else if(mode==='night')this.time=0.95;// noite com lua
        this.rain=mode==='rain';
        this.game.effects.rainEnabled=this.rain;
        this.apply(0,true);
    }
    isDark() {
        const angle=(this.time-.25)*Math.PI*2;
        return Math.sin(angle)<0.22 || this.rain;
    }
    update(dt) {
        this.apply(dt,false);
    }
    apply(dt=0,force=false) {
        if(Number.isFinite(dt)&&dt>0)
            this.time=(this.time+Math.min(.05,dt)/this.duration)%1;
        const game=this.game;
        const angle=(this.time-.25)*Math.PI*2;
        const height=Math.sin(angle);
        const daylight=DriverDayNightCycle.smooth(-.08,.32,height);
        const horizon=DriverDayNightCycle.smooth(-.22,.06,height);
        const dark=height<.22 || this.rain;
        const dayColor=game.currentCityKey==='vegas'?0x737b9e:
            game.currentCityKey==='havana'?0x96b5cb:
            game.currentCityKey==='rio'?0x70b8dd:0x87b5d3;
        const preset=CITY_PRESETS[game.currentCityKey]||CITY_PRESETS.chicago;
        this.daySky.setHex(dayColor);
        this.daySun.setHex(preset.sunColor);
        // Horizonte laranja somente na alvorada/crepúsculo.
        this.sky.copy(this.nightSky).lerp(this.twilightSky,horizon);
        this.sky.lerp(this.daySky,DriverDayNightCycle.smooth(.08,.55,height));
        if(this.rain)this.sky.lerp(new THREE.Color(0x303d50),.70);
        game.scene.background.copy(this.sky);
        if(game.scene.fog?.color)game.scene.fog.color.copy(this.sky);

        const sunX=Math.cos(angle)*.90;
        const sunY=height*.83;
        const sunZ=-.28+Math.cos(angle)*.32;
        const len=Math.hypot(sunX,sunY,sunZ)||1;
        const dx=sunX/len,dy=sunY/len,dz=sunZ/len;
        const focus=typeof game.getPlayerPosition==='function'?
            game.getPlayerPosition():null;
        const fx=Number.isFinite(focus?.x)?focus.x:0;
        const fy=Number.isFinite(focus?.y)?focus.y:0;
        const fz=Number.isFinite(focus?.z)?focus.z:0;
        const sun=game.sunLight;
        // Luz e sprite usam exatamente a mesma direção, evitando sombra invertida.
        sun.position.set(fx+dx*190,fy+dy*190,fz+dz*190);
        sun.target.position.set(fx,fy,fz);
        sun.target.updateMatrixWorld();
        sun.color.copy(this.sunsetSun).lerp(this.daySun,
            DriverDayNightCycle.smooth(.06,.54,height));
        sun.intensity=Math.max(0,height)*1.12*(this.rain?.45:1);
        sun.castShadow=this.shadowsEnabled && !this.rain && height>.16;

        this.moonLight.position.set(fx-dx*180,fy-dy*180,fz-dz*180);
        this.moonLight.target.position.set(fx,fy,fz);
        this.moonLight.target.updateMatrixWorld();
        this.moonLight.intensity=Math.max(0,-height)*.26*
            (this.rain?.45:1);
        game.ambientLight.color.copy(this.nightAmbient).lerp(
            this.dayAmbient,daylight);
        game.ambientLight.intensity=(.30+.44*daylight)*
            (this.rain?.73:1);

        // Ancorados na câmera: nunca ficam para trás quando o carro avança.
        const cx=game.camera?.position?.x||0;
        const cy=game.camera?.position?.y||0;
        const cz=game.camera?.position?.z||0;
        this.sunSprite.position.set(cx+dx*260,cy+dy*260,cz+dz*260);
        this.moonSprite.position.set(cx-dx*260,cy-dy*260,cz-dz*260);
        this.sunSprite.visible=height>-.035 && !this.rain;
        this.moonSprite.visible=height<.035 && !this.rain;
        this.sunSprite.material.opacity=DriverDayNightCycle.smooth(-.035,.12,height);
        this.moonSprite.material.opacity=DriverDayNightCycle.smooth(-.035,.13,-height);

        // Só troca faróis ao cruzar o limiar; não reinicializa assets por frame.
        if(force||this.lastHeadlights!==dark){
            this.lastHeadlights=dark;
            if(Array.isArray(game.vehicles)&&typeof VehicleVisuals!=='undefined'){
                for(const v of game.vehicles)
                    VehicleVisuals.setHeadlights(v,dark);
            }
            const btn=document.getElementById('btn-headlights');
            if(btn&&game.playerCar)
                btn.textContent=game.playerCar.headlightsOn?'💡 ON':'💡 OFF';
        }
        const hours=Math.floor(this.time*24);
        const minutes=Math.floor(this.time*1440)%60;
        const clock=String(hours).padStart(2,'0')+':'+
            String(minutes).padStart(2,'0');
        const part=this.rain?'CHUVA':height<=-.07?'NOITE':
            height<.13?(this.time<.5?'AMANHECER':'ENTARDECER'):
            this.time<.5?'MANHÃ':'TARDE';
        const badge=clock+' • '+part;
        if(force||this.lastBadge!==badge){
            const el=document.getElementById('weather-badge');
            if(el)el.textContent=badge;
            this.lastBadge=badge;
        }
    }
}
