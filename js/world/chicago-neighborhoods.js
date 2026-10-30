/**
 * Chicago — orientação por bairros inspirada no mapa de Driver 2 (PS1).
 * Coordenadas APROXIMADAS na cidade procedural atual, não extraídas da ROM.
 *
 * Exclusivamente visual: não registra colisores, ruas, missões, saves nem IA.
 * A camada é recriada com a cidade e descartada junto ao cityGroup.
 */
class DriverChicagoNeighborhoods {
    static DISTRICTS = typeof DriverChicagoCityPlan!=='undefined'?
        DriverChicagoCityPlan.DISTRICTS : [
        {id:'wrigleyville',name:'WRIGLEYVILLE',x:-278,z:220,color:0x67e8f9},
        {id:'lincoln-park',name:'LINCOLN PARK',x:280,z:236,color:0x86efac},
        {id:'gold-coast',name:'GOLD COAST',x:230,z:124,color:0xfde68a},
        {id:'downtown',name:'DOWNTOWN / LOOP',x:64,z:-65,color:0xfbbf24},
        {id:'grant-park',name:'GRANT PARK',x:280,z:-120,color:0x4ade80},
        {id:'navy-pier',name:'NAVY PIER',x:353,z:-40,color:0x38bdf8},
        {id:'greektown',name:'GREEKTOWN',x:-156,z:-72,color:0xf9a8d4},
        {id:'chinatown',name:'CHINATOWN',x:-115,z:-275,color:0xfb7185},
        {id:'prairie-ave',name:'PRAIRIE AVE',x:145,z:-228,color:0xc4b5fd},
        {id:'meigs-field',name:'MEIGS FIELD',x:334,z:-290,color:0xfda4af}
    ];

    static isChicago(city) {
        return city?.preset?.id==='chicago';
    }

    static label(text,color) {
        if(typeof document==='undefined')return null;
        const canvas=document.createElement('canvas');
        canvas.width=512;canvas.height=128;
        const ctx=canvas.getContext('2d');
        if(!ctx)return null;
        // Placa urbana discreta; evitar os letreiros flutuantes e cores
        // neon que não pertencem à Chicago do PS1.
        ctx.fillStyle='rgba(26,35,39,0.94)';
        ctx.fillRect(2,14,508,100);
        ctx.fillStyle='#a5b6b0';
        ctx.fillRect(2,14,508,4);
        ctx.fillRect(2,110,508,4);
        ctx.fillStyle='#f2eee2';
        ctx.font='bold '+(text.length>14?29:35)+'px sans-serif';
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(text,266,63,470);
        const texture=new THREE.CanvasTexture(canvas);
        texture.needsUpdate=true;
        const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
            map:texture,transparent:true,depthWrite:false
        }));
        sprite.name='chicago-sign-'+text.toLowerCase().replace(/[^a-z0-9]+/g,'-');
        sprite.scale.set(15.5,3.6,1);
        sprite.userData.chicagoVisualOnly=true;
        return sprite;
    }

    static buildMarkers(root) {
        const parts=[];
        let labels=0;
        for(const d of this.DISTRICTS) {
            // No canto da quadra: placa baixa de bairro, não um farol
            // colorido de 14 m no centro da avenida.
            const x=d.x+18,z=d.z+18;
            parts.push([x,2.4,z,.17,4.7,.17,0x637475,false]);
            parts.push([x,4.85,z,3.2,.13,.32,0xb2b9b4,false]);
            const label=this.label(d.name,d.color);
            if(label){
                label.position.set(x,5.25,z);
                root.add(label);
                labels++;
            }
        }
        DriverSpecialStructures.pack(root,parts,'chicago-neighborhood-beacons');
        return labels;
    }

    static buildRiverEdges(city,root) {
        // Usa os trechos das paredes existentes como fonte da verdade.
        // Logo, as aberturas das pontes x~0 e x~240 são preservadas.
        const sections=city.canalWallSegments||[];
        const parts=[];
        for(const s of sections){
            if(![s.minX,s.maxX,s.z].every(Number.isFinite)||
                s.maxX<=s.minX)continue;
            const x=(s.minX+s.maxX)/2;
            const width=s.maxX-s.minX;
            const front=s.z<50?-1:1;
            parts.push([x,1.56,s.z+front*.46,width,.14,.36,
                0xc1b9a8,false]);
            parts.push([x,.63,s.z+front*.78,width,.16,.18,
                0x374151,false]);
            parts.push([x,.22,s.z+front*1.05,width,.10,.14,
                0xa7b7be,false]);
            for(let p=s.minX+12;p<s.maxX-8;p+=16){
                parts.push([p,1.10,s.z+front*.63,.35,.66,.24,
                    0x8c9aa4,false]);
            }
        }
        return DriverSpecialStructures.pack(root,parts,'chicago-river-edge-reinforcement');
    }

    static buildWrigley(root,city) {
        // O Wrigley Field REAL é construído por DriverChicagoGameplay
        // (portão, secret car e colisores). Aqui só entram detalhes extras.
        if(!city.chicagoStadium)return null;
        const {x,z}=city.chicagoStadium;
        const parts=[
            [x,8.1,z-19,26,.35,.5,0xd6d3c5,false],
            [x,11.2,z-19.4,18,5.2,.65,0x14532d,false],
            [x,13.1,z-19.83,13,.28,.16,0xfde68a,true],
            [x,9.7,z-19.83,13,.28,.16,0xfde68a,true],
            [x-16,9.3,z-19,1,5.5,1,0x6b7280,false],
            [x+16,9.3,z-19,1,5.5,1,0x6b7280,false]
        ];
        DriverSpecialStructures.pack(root,parts,'chicago-wrigley-visual-trim');
        const title=this.label('WRIGLEY FIELD',0x86efac);
        if(title){
            title.position.set(x,7.1,z-19.75);
            title.scale.set(18,4.1,1);
            root.add(title);
        }
        return {x,z,enhanced:true};
    }

    static buildNavyPier(root) {
        // O deck fica a leste da malha viária existente. Não altera a
        // colisão nem cria um falso atalho sobre a estrada x=320.
        const parts=[
            [369,.29,-40,84,.5,16,0x9c8367,false],
            [369,.58,-46,84,.13,.5,0xd4b896,false],
            [369,.58,-34,84,.13,.5,0xd4b896,false],
            [333,1.0,-40,5,.50,14,0x64748b,false]
        ];
        for(let x=333;x<=405;x+=12){
            parts.push([x,.82,-46,.45,1.5,.45,0x587186,false]);
            parts.push([x,.82,-34,.45,1.5,.45,0x587186,false]);
            parts.push([x,-.55,-45.2,1.6,2.2,1.5,0x475569,false]);
            parts.push([x,-.55,-34.8,1.6,2.2,1.5,0x475569,false]);
        }
        DriverSpecialStructures.pack(root,parts,'chicago-navy-pier-deck');
        const wheel=new THREE.Group();
        wheel.name='chicago-navy-pier-ferris-wheel';
        wheel.position.set(379,17,-40);
        const steel=new THREE.MeshLambertMaterial({color:0xcbd5e1});
        const cabinMaterial=new THREE.MeshLambertMaterial({color:0x38bdf8});
        const rim=new THREE.Mesh(new THREE.TorusGeometry(10.2,.34,5,40),steel);
        wheel.add(rim);
        for(let n=0;n<10;n++){
            const a=n*Math.PI/5;
            const spoke=new THREE.Mesh(new THREE.BoxGeometry(20,.18,.22),steel);
            spoke.rotation.z=a;
            wheel.add(spoke);
            const cabin=new THREE.Mesh(new THREE.BoxGeometry(2,1.7,1.6),
                cabinMaterial);
            cabin.position.set(Math.cos(a)*10.2,Math.sin(a)*10.2,0);
            wheel.add(cabin);
        }
        const hub=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,2.8,8),
            new THREE.MeshLambertMaterial({color:0xfbbf24}));
        hub.rotation.x=Math.PI/2;
        wheel.add(hub);
        root.add(wheel);
        const supports=[];
        for(const side of [-1,1]){
            const beam=new THREE.Mesh(new THREE.CylinderGeometry(.45,.55,19,6),steel);
            beam.position.set(379+side*5,9.4,-41);
            beam.rotation.z=side*.33;
            root.add(beam);
            supports.push(beam);
        }
        const title=this.label('NAVY PIER',0x38bdf8);
        if(title){
            title.position.set(344,5.7,-32.0);
            title.scale.set(17,3.8,1);
            root.add(title);
        }
        return {x:379,z:-40,wheel,parts:parts.length};
    }

    static build(city) {
        if(!this.isChicago(city))return null;
        if(city.chicagoNeighborhoods?.root?.parent===city.cityGroup)
            return city.chicagoNeighborhoods;
        const root=new THREE.Group();
        root.name='chicago-neighborhood-visual-layer';
        root.userData.chicagoVisualOnly=true;
        city.cityGroup.add(root);
        const labels=this.buildMarkers(root);
        const riverMeshes=this.buildRiverEdges(city,root);
        const stadium=this.buildWrigley(root,city);
        const pier=this.buildNavyPier(root);
        city.chicagoNeighborhoods={
            root,labels,districts:this.DISTRICTS.length,
            riverMeshes:riverMeshes.length,stadium,pier,
            addedColliders:0,mode:'visual-only'
        };
        return city.chicagoNeighborhoods;
    }
}
