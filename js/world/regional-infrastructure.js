/**
 * Four regional draw-only bridge approaches and lift-bridge identities.
 * Geometry is attached to the two actual bascule leaves (so it opens),
 * not a fake second bridge. Ground ramps reuse existing height queries,
 * collisions, AI roads, port doors and mission checkpoints untouched.
 */
class DriverRegionalInfrastructure {
    static THEMES={
        chicago:{metal:0x394e62,trim:0xa7b8ca,accent:0xaf5e4c,
            lamp:0xffdaa0,type:'industrial',secret:0x9333ea},
        havana:{metal:0xa67e63,trim:0xe7d3ad,accent:0x5d9a8d,
            lamp:0xffe0a8,type:'colonial',secret:0xf472b6},
        vegas:{metal:0x4b3f67,trim:0xce9dcf,accent:0xeb55cd,
            lamp:0x3bdde9,type:'neon',secret:0x22d3ee},
        rio:{metal:0x617d81,trim:0xe0dfd1,accent:0x209e83,
            lamp:0xffd58d,type:'coastal',secret:0x10b981}
    };
    // One actual, low-poly, driveable stunt-ramp per city. These lie
    // inside clear 80m road segments near the map edge, outside the
    // campaign routes, bridges, parking and garage approaches.
    static RAMP_ZONES={
        chicago:{x:320,z:-306,height:1.8,length:18},
        havana:{x:-320,z:-306,height:1.55,length:18},
        vegas:{x:320,z:181,height:1.75,length:18},
        rio:{x:-320,z:181,height:1.70,length:18}
    };
    static rampHeight(city,x,z){
        const r=this.RAMP_ZONES[city?.preset?.id];
        if(!r || !Number.isFinite(x)||!Number.isFinite(z))
            return 0;
        if(Math.abs(x-r.x)>=5||z<r.z||z>r.z+r.length)
            return 0;
        const lateral=Math.max(0,Math.min(1,
            (5-Math.abs(x-r.x))/.7));
        return (z-r.z)/r.length*r.height*lateral;
    }
    static buildRamp(city,theme){
        const r=this.RAMP_ZONES[city?.preset?.id];
        if(!r||typeof THREE==='undefined')return null;
        // A mesma inclinação também alimenta getGroundHeightAt,
        // evitando rampas visuais com rodas atravessando o asfalto.
        const slope=Math.atan2(r.height,r.length);
        const ramp=new THREE.Mesh(
            new THREE.BoxGeometry(8,.15,r.length),
            new THREE.MeshLambertMaterial({color:theme.metal}));
        ramp.rotation.x=-slope;
        ramp.position.set(r.x,r.height/2+.075,r.z+r.length/2);
        ramp.name='driver2-driveable-ramp-'+city.preset.id;
        ramp.castShadow=false;
        city.cityGroup.add(ramp);
        return ramp;
    }
    static build(city){
        const theme=this.THEMES[city?.preset?.id];
        if(!theme||!city.bridgeSouthLeaf||!city.bridgeNorthLeaf)
            return null;
        const info={city:city.preset.id,type:theme.type,
            movingLeaves:0,approachParts:0,collidersAdded:0};
        for(const [index,leaf] of [
            city.bridgeSouthLeaf,city.bridgeNorthLeaf].entries()){
            const sign=index===0?1:-1;
            const parts=[],add=(x,y,z,w,h,d,color,glow=false)=>
                parts.push([x,y,z,w,h,d,color,glow]);
            // All figures use leaf-local coordinates; the real hinge
            // remains where it was and only this geometry is animated.
            for(let i=1;i<=7;i++){
                const z=sign*(i*2);
                for(const side of [-1,1]){
                    const x=side*10.6;
                    if(theme.type==='industrial'){
                        add(x,2.75,z,.33,3.5,.33,theme.metal);
                        add(x,4.4,z,.8,.22,1.8,theme.trim);
                        add(x,1.4,z,.12,2.1,1.15,theme.accent);
                    }else if(theme.type==='colonial'){
                        add(x,1.8,z,.45,2.1,.65,theme.trim);
                        add(x,2.85,z,.9,.28,.9,theme.metal);
                        add(x,1.9,z,.14,1.2,1.25,theme.accent);
                    }else if(theme.type==='neon'){
                        add(x,1.65,z,.25,2.7,.3,theme.metal);
                        add(x,3.1,z,.45,.22,.8,theme.lamp,true);
                        add(x,1.55,z,.11,1.2,1.2,theme.accent,true);
                    }else{
                        add(x,1.6,z,.28,2.4,.3,theme.metal);
                        add(x,2.85,z,.72,.18,.72,theme.trim);
                        add(x,1.42,z,.12,.5,1.12,theme.accent);
                    }
                }
            }
            // Weathered deck seams remain below the wheels.
            for(let z=1.5;z<16;z+=2.25)
                add(0,.29,sign*z,18,.055,.09,theme.trim);
            DriverSpecialStructures.pack(leaf,parts,
                'regional-bridge-'+city.preset.id+'-leaf');
            info.movingLeaves++;
        }
        // Approach surfaces are flush with the existing pavement.
        // They visually connect the bridge to the road; no second ramp
        // or unvalidated height field is generated.
        const approaches=[],add=(...v)=>approaches.push(v);
        for(const z of [27.4,72.6]){
            add(0,.085,z,21.0,.025,8.5,theme.metal,false);
            for(const side of [-1,1]){
                add(side*10.3,.105,z,.18,.06,9.3,theme.trim,false);
                for(const dz of [-3.2,0,3.2])
                    add(side*9.6,.13,z+dz,.42,.06,.75,
                        theme.accent,theme.type==='neon');
            }
            for(let dz=-3.25;dz<=3.25;dz+=1.5)
                add(0,.116,z+dz,16.2,.025,.10,theme.trim,false);
        }
        DriverSpecialStructures.pack(city.cityGroup,approaches,
            'regional-bridge-approach-'+city.preset.id);
        info.approachParts=approaches.length;
        this.buildRamp(city,theme);
        info.ramp={...this.RAMP_ZONES[city.preset.id]};
        // The secret gate and secret vehicle are intentionally not moved:
        // they are mission-critical, but their presentation is now local.
        city.regionalInfrastructureStats=info;
        return info;
    }
}
