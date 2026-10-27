/**
 * Pintura independente para o atlas verde-oliva de carro_driver2_otimizado.glb.
 * Cada clone tem material próprio, mas compartilha geometria e textura.
 * Apenas tons de carroceria são recoloridos; pretos, cinzas, vidros e
 * lanternas permanecem próximos da textura original.
 */
class DriverUserCarPaint {
    static prepare(root,hex){
        if(!root)return root;
        root.traverse(node=>{
            if(!node.isMesh)return;
            const source=Array.isArray(node.material)?node.material:[node.material];
            const make=mat=>{
                const copy=mat.clone();
                const paintColor=new THREE.Color(hex);
                copy.userData={...copy.userData,driverUserPaint:true,
                    driverPaintColor:paintColor};
                copy.onBeforeCompile=shader=>{
                    shader.uniforms.driverPaintColor={
                        value:copy.userData.driverPaintColor
                    };
                    shader.fragmentShader='uniform vec3 driverPaintColor;\n'+shader.fragmentShader;
                    shader.fragmentShader=shader.fragmentShader.replace(
                        '#include <map_fragment>',
                        `#include <map_fragment>
                        // Atlas original: tons verde-oliva identificam a lataria.
                        // Preserve pneus, peças pretas, vidros, cromados e faróis.
                        float paintMax = max(diffuseColor.r, diffuseColor.b);
                        float olive = diffuseColor.g - paintMax;
                        float mask = smoothstep(0.008, 0.057, olive);
                        float value = dot(diffuseColor.rgb,
                            vec3(0.30, 0.59, 0.11));
                        mask *= smoothstep(0.065, 0.15, value);
                        mask *= 1.0-smoothstep(0.57,0.86,value);
                        vec3 recolor = driverPaintColor *
                            clamp(value / 0.26,0.50,1.35);
                        diffuseColor.rgb = mix(diffuseColor.rgb,recolor,
                            mask * 0.94);`
                    );
                };
                copy.customProgramCacheKey=()=> 'driver-user-atlas-paint-v1';
                return copy;
            };
            node.material=Array.isArray(node.material)?
                source.map(make):make(source[0]);
            node.userData.cc0SharedAsset=true;
        });
        root.userData.driverPaintRoot=true;
        return root;
    }
    static setColor(root,hex){
        if(!root)return;
        root.traverse(node=>{
            if(!node.isMesh)return;
            const mats=Array.isArray(node.material)?node.material:[node.material];
            for(const mat of mats){
                const color=mat?.userData?.driverPaintColor;
                if(color)color.setHex(hex);
            }
        });
    }
}
