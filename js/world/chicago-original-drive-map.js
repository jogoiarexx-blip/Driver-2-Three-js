/**
 * Mapa transitável experimental, derivado dos pisos reais dos GLBs Chicago PS1.
 * Sem grade procedural, nem rotas/missões certificadas. Não altera a física.
 * A máscara compacta é gerada offline a partir dos 54 setores originais.
 */
class DriverChicagoOriginalDriveMap {
    static FORMAT='Driver2ChicagoDriveMaskV1';
    constructor() {
        this.mask=null;this.bits=null;
        this.ready=false;this.buildingBoxes=[];
        this.preset={id:'chicago-original',name:'CHICAGO ORIGINAL • PS1'};
        this.roadExtent=330;this.worldLimit=400;
    }
    bind(data,bytes) {
        if(data?.format!==DriverChicagoOriginalDriveMap.FORMAT||
           data.tiles!==54 || !Number.isInteger(data.width) ||
           !Number.isInteger(data.height) || data.width<50 || data.height<50 ||
           !(data.stepOBJ>0)||!(data.scale>0)||
           !Array.isArray(data.centerOBJ)||data.centerOBJ.length!==2 ||
           ![data.xminOBJ,data.zmaxOBJ,...data.centerOBJ].every(Number.isFinite))
            throw Error('Máscara da Chicago PS1 incompatível');
        if(!(bytes instanceof Uint8Array)||
           bytes.length!==Math.ceil(data.width*data.height/8))
            throw Error('Bitset da máscara danificado');
        if(data.roadCertified===true||data.missionLocationsMigrated===true)
            throw Error('Metadados de certificação inesperados');
        if(![data.spawn?.x,data.spawn?.z,data.spawn?.heading].every(Number.isFinite))
            throw Error('Ponto inicial inválido');
        this.mask=data;this.bits=bytes;
        if(this.isPointBlocked(data.spawn.x,data.spawn.z,0))
            throw Error('O spawn extraído está fora do terreno transitável');
        this.ready=true;
        this.spawn={...data.spawn};
        return this;
    }
    // A escala visual deve ser igual à escala física da máscara. Ao ampliar
    // o mundo, preservamos a carroceria e os colisores existentes: o carro
    // fica proporcionalmente menor SEM adulterar a física de direção.
    rescaleWorld(scale) {
        if(!this.ready || !Number.isFinite(scale) || scale<2 || scale>9)
            throw Error('Escala da Chicago original inválida');
        const ratio=scale/this.mask.scale;
        this.mask.scale=scale;
        this.spawn={
            x:this.spawn.x*ratio,z:this.spawn.z*ratio,
            heading:this.spawn.heading
        };
        if(this.isPointBlocked(this.spawn.x,this.spawn.z,0))
            throw Error('Reprojeção tirou o carro da região transitável');
        return this.spawn;
    }
    async load(url='./chicago/drive-mask.json'){
        const response=await fetch(url);
        if(!response.ok)throw Error('Mapa de colisão HTTP '+response.status);
        const data=await response.json();
        if(typeof DecompressionStream==='undefined')
            throw Error('Navegador sem suporte à descompressão do mapa');
        const bytes=Uint8Array.from(atob(data.gzipBitsetBase64),c=>c.charCodeAt(0));
        const stream=new Blob([bytes]).stream().pipeThrough(
            new DecompressionStream('gzip'));
        const expanded=new Uint8Array(await new Response(stream).arrayBuffer());
        return this.bind(data,expanded);
    }
    worldPixel(x,z) {
        const d=this.mask;
        if(!d||!Number.isFinite(x)||!Number.isFinite(z))return null;
        return {
            col:Math.round(((x/d.scale+d.centerOBJ[0])-d.xminOBJ)/d.stepOBJ),
            row:Math.round((d.zmaxOBJ-(z/d.scale+d.centerOBJ[1]))/d.stepOBJ)
        };
    }
    permitted(x,z) {
        const pixel=this.worldPixel(x,z);
        if(!pixel||pixel.col<0||pixel.row<0||
            pixel.col>=this.mask.width||pixel.row>=this.mask.height)return false;
        const bit=pixel.row*this.mask.width+pixel.col;
        return !!(this.bits[bit>>>3]&(128>>>(bit&7)));
    }
    isPointBlocked(x,z,radius=1.55) {
        if(!this.permitted(x,z))return true;
        // Área já sofreu erosão por um raio de carro no gerador.
        // Teste lateral curto reduz transposição de obstáculos diagonais.
        const r=Math.min(Math.max(radius,0),3)*.20;
        return r>0 && (
            !this.permitted(x+r,z)||!this.permitted(x-r,z)||
            !this.permitted(x,z+r)||!this.permitted(x,z-r)
        );
    }
    isWaterAt(){return false;}
    getGroundHeightAt(){return 0;}
    getSidewalkHeightAt(){return 0;}
    isOnSidewalk(){return false;}
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoOriginalDriveMap;
