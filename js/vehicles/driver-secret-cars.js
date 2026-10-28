/**
 * One unlockable secret vehicle per city. The four variants share
 * existing garage gate, storage and driver physics; only tuning and
 * small render-only parts differ. The custom GLB remains replaceable.
 */
class DriverSecretCars {
    static CONFIG={
        chicago:{maxSpeed:69,accel:42,trim:0x9e7bcb,
            feature:'street-racer'},
        havana:{maxSpeed:62,accel:38,trim:0xffc8d6,
            feature:'classic-cruiser'},
        vegas:{maxSpeed:75,accel:46,trim:0x46e2fa,
            feature:'nitro-rod'},
        rio:{maxSpeed:71,accel:43,trim:0x58e0a5,
            feature:'rally-gt'}
    };
    static apply(car,cityId){
        if(!car?.root)return false;
        const config=this.CONFIG[cityId];
        if(!config)return false;
        if(car.secretCityStyle?.parent)
            car.secretCityStyle.parent.remove(car.secretCityStyle);
        car.maxSpeed=config.maxSpeed;
        car.accel=config.accel;
        car.secretVariant=config.feature;
        const group=new THREE.Group();
        group.name='driver2-secret-car-'+cityId;
        const color=new THREE.MeshLambertMaterial({color:config.trim});
        const dark=new THREE.MeshLambertMaterial({color:0x313544});
        const add=(w,h,d,x,y,z,mat=color)=>{
            const part=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
            part.position.set(x,y,z);group.add(part);
        };
        if(cityId==='chicago'){
            add(1.8,.12,.28,0,1.61,-1.55);
            add(.13,.56,.13,-.83,1.33,-1.54,dark);
            add(.13,.56,.13,.83,1.33,-1.54,dark);
            add(.13,.05,2.5,-.52,1.16,0);
            add(.13,.05,2.5,.52,1.16,0);
        }else if(cityId==='havana'){
            // Polished hood and rounded-style chrome strips.
            add(1.66,.08,.28,0,1.12,1.68);
            add(1.70,.12,.22,0,.53,2.64);
            add(1.70,.12,.22,0,.53,-2.64);
            for(const side of [-1,1])
                add(.15,.14,2.2,side*1.12,1.11,0);
        }else if(cityId==='vegas'){
            add(2.13,.16,.48,0,1.54,-1.58);
            for(const side of [-1,1]){
                add(.13,.63,.14,side*.88,1.24,-1.58,dark);
                add(.14,.08,3.3,side*.53,1.17,0);
            }
        }else{
            add(1.86,.14,.38,0,1.50,-1.58);
            for(const side of [-1,1]){
                add(.16,.52,.13,side*.82,1.25,-1.58,dark);
                add(.08,.07,2.9,side*.65,1.10,0);
            }
            add(1.75,.09,.24,0,1.15,1.5);
        }
        // Mounted on root, not on a replaceable GLB body. No second
        // chassis or physics volume is spawned.
        car.root.add(group);
        car.secretCityStyle=group;
        return true;
    }
}
