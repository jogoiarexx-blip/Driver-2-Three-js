/**
 * Garagem pessoal independente do save de campanha. Dados pequenos e
 * versionados, sempre restritos à origem local do GitHub Pages.
 */
class DriverTannerGarage {
    static KEY='driver2-tanner-garage-v1';
    static VERSION=1;
    static MAX_CARS=5;
    constructor(storage){
        this.storage=storage;
        this.cars=this.read();
    }
    static sanitize(item){
        if(!item||typeof item!=='object')return null;
        const bodyStyle=['muscle','truck','limo','bus'].includes(item.bodyStyle)?
            item.bodyStyle:'muscle';
        const color=Number(item.color);
        if(!Number.isInteger(color)||color<0||color>0xffffff)return null;
        const str=value=>String(value||'').slice(0,60);
        return {
            name:str(item.name)||'VEÍCULO',
            color,
            bodyStyle,
            maxSpeed:Math.max(18,Math.min(90,Number(item.maxSpeed)||52)),
            accel:Math.max(8,Math.min(60,Number(item.accel)||28)),
            custom:item.custom===true,
            damage:Math.max(0,Math.min(100,Number(item.damage)||0))
        };
    }
    read(){
        try{
            const raw=this.storage?.getItem(this.constructor.KEY);
            if(!raw||raw.length>6000)return [];
            const obj=JSON.parse(raw);
            if(obj?.version!==this.constructor.VERSION ||
                !Array.isArray(obj.cars))return [];
            return obj.cars.slice(0,this.constructor.MAX_CARS).
                map(this.constructor.sanitize).filter(Boolean);
        }catch(_){return []}
    }
    persist(){
        try{
            if(!this.storage)return false;
            this.storage.setItem(this.constructor.KEY,JSON.stringify({
                version:this.constructor.VERSION,cars:this.cars
            }));
            return true;
        }catch(_){return false}
    }
    snapshot(vehicle){
        return this.constructor.sanitize({
            name:vehicle?.name,color:vehicle?.color,
            bodyStyle:vehicle?.bodyStyle,maxSpeed:vehicle?.maxSpeed,
            accel:vehicle?.accel,
            custom:vehicle?._userCustomModel===true,
            damage:vehicle?.damage
        });
    }
    canStore(vehicle){
        return this.cars.length<this.constructor.MAX_CARS &&
            !!vehicle && !vehicle.isPolice && !vehicle.isTarget &&
            !vehicle.isSecret;
    }
    store(vehicle){
        if(!this.canStore(vehicle))return false;
        const value=this.snapshot(vehicle);
        if(!value)return false;
        this.cars.push(value);
        if(this.persist())return true;
        this.cars.pop();
        return false;
    }
    take(index){
        const n=Number(index);
        if(!Number.isInteger(n)||n<0||n>=this.cars.length)return null;
        const [car]=this.cars.splice(n,1);
        if(this.persist())return car;
        this.cars.splice(n,0,car);
        return null;
    }
    list(){return this.cars.map((car,index)=>({...car,index}))}
}
