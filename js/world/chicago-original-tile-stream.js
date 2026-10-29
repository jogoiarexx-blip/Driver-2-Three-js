/**
 * Chicago original (PS1) — stream SOMENTE VISUAL para comparação geográfica.
 * Não registra geometria física, terreno, vias, malha navegável ou colisores.
 * O atlas único é compartilhado por todos os chunks, inclusive durante descarte.
 * Three.js r128 + GLTFLoader, sem dependências de build.
 */
class DriverChicagoOriginalTileStream {
    static FORMAT = 'Driver2ChicagoVisualTilesV1';
    constructor({scene, THREE: T, baseUrl = './chicago/',
        maxLoaded=16, loadRadius=37, unloadRadius=55, maxParallel=2,
        scale=3.4, onError=null, onChange=null}={}) {
        if(!scene||!T)throw Error('Chicago original precisa de scene e THREE');
        this.scene=scene;this.THREE=T;
        this.baseUrl=baseUrl.endsWith('/')?baseUrl:baseUrl+'/';
        this.maxLoaded=Math.max(1,maxLoaded);
        this.loadRadius=Math.max(1,loadRadius);
        this.unloadRadius=Math.max(this.loadRadius+2,unloadRadius);
        this.maxParallel=Math.max(1,Math.min(4,maxParallel));
        this.scale=Number(scale)||3.4;
        this.onError=onError;this.onChange=onChange;
        this.root=new T.Group();
        this.root.name='driver2-original-chicago-visual-no-physics';
        this.root.userData.chicagoVisualOnly=true;
        this.scene.add(this.root);
        this.manifest=null;this.material=null;this.texture=null;
        this.loaded=new Map();this.pending=new Set();this.failed=new Set();
        this.queue=[];this.inFlight=0;this.disposed=false;
        this.focus={x:0,z:0};this.generation=0;this.lastError=null;
    }
    bindManifest(data){
        if(!data||data.format!==DriverChicagoOriginalTileStream.FORMAT||
            !Array.isArray(data.tiles)||!Array.isArray(data.center)||
            !Array.isArray(data.bounds?.min))throw Error('Manifest de Chicago incompatível');
        if(data.visualOnly!==true||data.collisionReady!==false)
            throw Error('Manifest não garante isolamento da física');
        for(const tile of data.tiles){
            if(!tile.id||!/^chunks\/[0-9_]+\.glb$/.test(tile.url)||
                !tile.bounds?.min?.every(Number.isFinite)||
                !tile.bounds?.max?.every(Number.isFinite))
                throw Error('Chunk inválido: '+tile?.id);
        }
        this.manifest=data;
        this.root.scale.setScalar(this.scale);
        this.root.position.set(-data.center[0]*this.scale,
            -data.bounds.min[1]*this.scale,-data.center[2]*this.scale);
        return this;
    }
    async start(){
        if(this.disposed)throw Error('Streamer já encerrado');
        const response=await fetch(this.baseUrl+'manifest.json');
        if(!response.ok)throw Error('Manifest HTTP '+response.status);
        this.bindManifest(await response.json());
        if(!this.THREE.GLTFLoader||!this.THREE.TextureLoader)
            throw Error('É necessário Three.js + GLTFLoader');
        const texture=new this.THREE.TextureLoader().load(
            this.baseUrl+this.manifest.atlas,
            ()=>this.onChange?.(this.stats()),undefined,
            err=>this._error(err));
        texture.flipY=false; // UVs gerados no espaço glTF com V para baixo.
        texture.generateMipmaps=true;
        texture.minFilter=this.THREE.NearestMipmapNearestFilter;
        texture.magFilter=this.THREE.NearestFilter;
        texture.wrapS=texture.wrapT=this.THREE.ClampToEdgeWrapping;
        this.texture=texture;
        this.material=new this.THREE.MeshBasicMaterial({
            map:texture,alphaTest:.4,side:this.THREE.DoubleSide,
            transparent:false,depthWrite:true,toneMapped:false
        });
        this.onChange?.(this.stats());
        return this;
    }
    _error(e){this.lastError=String(e?.message||e);this.onError?.(e);}
    _distance(tile){
        const b=tile.bounds;
        const dx=Math.max(b.min[0]-this.focus.x,0,this.focus.x-b.max[0]);
        const dz=Math.max(b.min[2]-this.focus.z,0,this.focus.z-b.max[2]);
        return Math.hypot(dx,dz);
    }
    update(focusWorld){
        if(this.disposed||!this.manifest||!this.material||!focusWorld)return this.stats();
        this.focus.x=(focusWorld.x-this.root.position.x)/this.scale;
        this.focus.z=(focusWorld.z-this.root.position.z)/this.scale;
        // Geometry out of range gets unloaded even when it has never been visible.
        for(const [id,entry] of this.loaded){
            if(this._distance(entry.tile)>this.unloadRadius){
                this._release(entry.group);this.loaded.delete(id);
            }
        }
        this.queue=this.manifest.tiles
            .filter(t=>this._distance(t)<=this.loadRadius &&
                !this.loaded.has(t.id)&&!this.pending.has(t.id)&&!this.failed.has(t.id))
            .sort((a,b)=>this._distance(a)-this._distance(b));
        // Reserve cache slots for the closest sectors, including pending loads.
        // A small distance margin avoids churn at a boundary between two tiles.
        for(const tile of this.queue){
            if(this.loaded.size+this.pending.size<this.maxLoaded)break;
            const farthest=[...this.loaded.entries()].sort(
                (a,b)=>this._distance(b[1].tile)-this._distance(a[1].tile))[0];
            if(!farthest||this._distance(farthest[1].tile)<=this._distance(tile)+2)break;
            this._release(farthest[1].group);
            this.loaded.delete(farthest[0]);
        }
        this._pump();return this.stats();
    }
    _pump(){
        if(this.disposed||!this.manifest||!this.material)return;
        while(this.inFlight<this.maxParallel && this.queue.length &&
            this.loaded.size+this.pending.size<this.maxLoaded){
            const tile=this.queue.shift();
            if(this.loaded.has(tile.id)||this.pending.has(tile.id))continue;
            this.pending.add(tile.id);this.inFlight++;
            const loader=new this.THREE.GLTFLoader();
            loader.load(this.baseUrl+tile.url, gltf=>{
                this.pending.delete(tile.id);this.inFlight--;
                const group=gltf.scene;
                if(!this.disposed&&this.manifest&&
                    this._distance(tile)<=this.unloadRadius){
                    group.traverse?.(obj=>{
                        if(obj.isMesh){
                            obj.material?.dispose?.(); // material simples do GLB
                            obj.material=this.material; // nunca descartar por chunk
                            obj.castShadow=false;obj.receiveShadow=false;
                        }
                    });
                    group.userData.chicagoVisualOnly=true;
                    this.root.add(group);
                    this.loaded.set(tile.id,{tile,group});
                }else this._release(group);
                this.onChange?.(this.stats());this._pump();
            },undefined,e=>{
                this.pending.delete(tile.id);this.inFlight--;this.failed.add(tile.id);
                if(!this.disposed)this._error(e);
                this.onChange?.(this.stats());this._pump();
            });
        }
    }
    _release(group){
        group.parent?.remove(group);
        group.traverse?.(obj=>{
            if(obj.isMesh){
                obj.geometry?.dispose?.();
                if(obj.material!==this.material)obj.material?.dispose?.();
            }
        });
    }
    stats(){return {
        tilesTotal:this.manifest?.tiles?.length||0,
        tilesLoaded:this.loaded.size,loading:this.inFlight,
        pending:this.pending.size,trianglesLoaded:[...this.loaded.values()]
            .reduce((n,e)=>n+(e.tile.triangles||0),0),
        visualOnly:true,collidersCreated:0,error:this.lastError
    };}
    dispose(){
        if(this.disposed)return;
        this.disposed=true;this.generation++;
        this.queue=[];
        for(const entry of this.loaded.values())this._release(entry.group);
        this.loaded.clear();this.root.parent?.remove(this.root);
        this.material?.dispose?.();this.texture?.dispose?.();
        this.material=null;this.texture=null;
    }
}
if(typeof module!=='undefined'&&module.exports)module.exports=DriverChicagoOriginalTileStream;
