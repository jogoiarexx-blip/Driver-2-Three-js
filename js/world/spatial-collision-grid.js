/** Exact AABB broad-phase in 80m cells; 3x3 neighboring grid,
 * no removed collision volumes, safe on gate open/city reload. */
class DriverSpatialCollisionGrid {
    constructor(cellSize=80){
        this.cellSize=cellSize;this.buckets=new Map();
        this.boxes=null;this.count=-1;
    }
    key(x,z){return x+':'+z;}
    rebuild(boxes){
        this.buckets.clear();
        this.boxes=boxes;
        this.count=boxes.length;
        const cell=this.cellSize;
        for(const box of boxes){
            if(![box.minX,box.maxX,box.minZ,box.maxZ].every(Number.isFinite))
                continue;
            const x0=Math.floor(box.minX/cell),x1=Math.floor(box.maxX/cell);
            const z0=Math.floor(box.minZ/cell),z1=Math.floor(box.maxZ/cell);
            for(let x=x0;x<=x1;x++){
                for(let z=z0;z<=z1;z++){
                    const key=this.key(x,z);
                    if(!this.buckets.has(key))this.buckets.set(key,[]);
                    this.buckets.get(key).push(box);
                }
            }
        }
    }
    blocked(boxes,x,z,radius=1.2){
        if(!Array.isArray(boxes))return false;
        if(this.boxes!==boxes||this.count!==boxes.length)
            this.rebuild(boxes);
        const cell=this.cellSize;
        const x0=Math.floor((x-radius)/cell),
            x1=Math.floor((x+radius)/cell);
        const z0=Math.floor((z-radius)/cell),
            z1=Math.floor((z+radius)/cell);
        const checked=new Set();
        for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){
            for(const box of this.buckets.get(this.key(i,j))||[]){
                if(checked.has(box))continue;
                checked.add(box);
                if(x+radius>box.minX&&x-radius<box.maxX&&
                    z+radius>box.minZ&&z-radius<box.maxZ)return true;
            }
        }
        return false;
    }
}
