/**
 * R50: one small, seamless 96px ripple texture shared by Chicago water.
 * No reflection targets, shaders, normal maps or per-frame pixel uploads.
 */
class DriverChicagoWaterR50 {
    static texture=null;
    static make(){
        if(this.texture)return this.texture;
        if(typeof document==='undefined'||typeof THREE==='undefined')return null;
        const canvas=document.createElement('canvas');
        canvas.width=canvas.height=96;
        const ctx=canvas.getContext('2d');
        if(!ctx)return null;
        const image=ctx.createImageData(96,96);
        for(let y=0;y<96;y++)for(let x=0;x<96;x++){
            const p=(y*96+x)*4;
            const a=Math.sin(y*.42+Math.sin(x*.26)*1.5);
            const b=Math.cos(x*.22-y*.11);
            const n=Math.sin((x+y)*.13)*Math.cos((x-y)*.19);
            const wave=Math.max(0,Math.min(255,172+a*18+b*10+n*14));
            image.data[p]=wave;
            image.data[p+1]=wave;
            image.data[p+2]=wave;
            image.data[p+3]=255;
        }
        ctx.putImageData(image,0,0);
        const texture=new THREE.CanvasTexture(canvas);
        texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
        texture.repeat.set(4,4);
        texture.magFilter=THREE.LinearFilter;
        texture.minFilter=THREE.LinearMipmapLinearFilter;
        texture.anisotropy=1;
        this.texture=texture;
        return texture;
    }
    static apply(material){
        const texture=this.make();
        if(texture){material.map=texture;material.needsUpdate=true;}
        return material;
    }
    static update(dt){
        if(!this.texture)return;
        const step=Math.min(.06,Math.max(0,dt));
        this.texture.offset.x=(this.texture.offset.x+step*.003)%1;
        this.texture.offset.y=(this.texture.offset.y+step*.0015)%1;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoWaterR50;
