/** Plano de orientação gerado da máscara extraída dos 54 setores PS1.
 * As áreas claras são pisos candidatos, não ruas certificadas.
 */
class DriverChicagoOriginalMinimap {
    constructor(canvas,world){
        this.canvas=canvas;this.world=world;
        const d=world.mask;
        this.layer=document.createElement('canvas');
        this.layer.width=d.width;this.layer.height=d.height;
        const ctx=this.layer.getContext('2d');
        const pixels=ctx.createImageData(d.width,d.height);
        for(let bit=0;bit<d.width*d.height;bit++){
            const safe=!!(world.bits[bit>>>3]&(128>>>(bit&7)));
            const i=bit*4;
            pixels.data.set(safe?[170,187,170,255]:[18,31,42,255],i);
        }
        ctx.putImageData(pixels,0,0);
    }
    draw(car){
        const c=this.canvas,ctx=c?.getContext('2d');
        if(!ctx||!car)return;
        const d=this.world.mask,pad=10;
        const scale=Math.min((c.width-pad*2)/d.width,(c.height-pad*2)/d.height);
        const w=d.width*scale,h=d.height*scale;
        const left=(c.width-w)/2,top=(c.height-h)/2;
        ctx.fillStyle='#071321';ctx.fillRect(0,0,c.width,c.height);
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(this.layer,left,top,w,h);
        const pixel=this.world.worldPixel(car.x,car.z);
        ctx.save();ctx.translate(left+pixel.col*scale,top+pixel.row*scale);
        // World +Z projects upward; heading 0 points north on this plan.
        ctx.rotate(car.heading);ctx.beginPath();
        ctx.moveTo(0,-7);ctx.lineTo(5,5);ctx.lineTo(0,2);ctx.lineTo(-5,5);
        ctx.closePath();ctx.fillStyle='#ffdf79';ctx.fill();
        ctx.strokeStyle='#101820';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
    }
}
if(typeof module!=='undefined'&&module.exports)module.exports=DriverChicagoOriginalMinimap;
