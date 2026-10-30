/**
 * Driver 2 / Chicago R24
 * Auditoria geométrica das 4.279 conexões candidatas dos 54 setores PS1.
 * Usa camadas de pavimento extraídas do atlas original (R14).
 *
 * IMPORTANTE: confiança = evidência de superfície pavimentada, NÃO prova
 * de rua real nem de direção, altura, largura oficial ou navegabilidade.
 * Não altera colisores, tráfego, missões ou geografia do Undercover.
 */
class DriverChicagoRoadEvidenceR24 {
    static LAYERS=['markedPaving','plainPaving','grass','water'];
    static OFFSET_OBJ=[0,-.2,.2,-.45,.45,-.7,.7];
    static CLASS_IDS={reject:0,review:1,medium:2,strong:3};
    static bit(buffer,index){
        return !!(buffer[index>>>3]&(128>>>(index&7)));
    }
    static sample(survey,masks,x,z){
        const col=Math.round((x-survey.xminOBJ)/survey.stepOBJ);
        const row=Math.round((survey.zmaxOBJ-z)/survey.stepOBJ);
        if(!Number.isFinite(col)||!Number.isFinite(row)||
           col<0||row<0||col>=survey.width||row>=survey.height)
            return {outside:true,paving:false,marked:false,grass:false,water:false};
        const i=row*survey.width+col;
        const marked=this.bit(masks.markedPaving,i);
        const plain=this.bit(masks.plainPaving,i);
        return {outside:false,paving:marked||plain,marked,
            grass:this.bit(masks.grass,i),water:this.bit(masks.water,i)};
    }
    static profile(edge,survey,masks){
        const counts=this.OFFSET_OBJ.map(()=>({
            n:0,paved:0,marked:0,grass:0,water:0,outside:0
        }));
        const points=edge?.pointsOBJ||[];
        let length=0;
        for(let j=1;j<points.length;j++){
            const a=points[j-1],b=points[j];
            if(!a||!b)continue;
            const dx=b[0]-a[0],dz=b[1]-a[1];
            const segment=Math.hypot(dx,dz);
            if(!Number.isFinite(segment)||segment<1e-7)continue;
            length+=segment;
            const nx=-dz/segment,nz=dx/segment;
            const steps=Math.max(1,Math.ceil(segment/survey.stepOBJ));
            for(let k=0;k<=steps;k++){
                const t=k/steps,x=a[0]+dx*t,z=a[1]+dz*t;
                for(let n=0;n<this.OFFSET_OBJ.length;n++){
                    const offset=this.OFFSET_OBJ[n];
                    const value=this.sample(survey,masks,x+nx*offset,z+nz*offset);
                    const c=counts[n];
                    c.n++;
                    if(value.paving)c.paved++;
                    if(value.marked)c.marked++;
                    if(value.grass)c.grass++;
                    if(value.water)c.water++;
                    if(value.outside)c.outside++;
                }
            }
        }
        const fraction=(c,key)=>c.n?c[key]/c.n:0;
        const paved=counts.map(c=>fraction(c,'paved'));
        const center=paved[0];
        const shoulders=Math.min(paved[1],paved[2]);
        const laneEdges=Math.min(paved[3],paved[4]);
        const outerEdges=Math.min(paved[5],paved[6]);
        const water=Math.max(...counts.map(c=>fraction(c,'water')));
        const grass=Math.max(...counts.map(c=>fraction(c,'grass')));
        const outside=counts.some(c=>c.outside>0);
        const marked=fraction(counts[0],'marked');
        // A máscara com textura de calçada pode continuar pavimentada
        // numa faixa larga. Classificar isso como pista seria falso;
        // "strong" continua sendo apenas um INDÍCIO para revisão.
        let confidence='reject';
        if(!outside&&water<=.005&&length>=2.0&&
           center>=.94&&shoulders>=.9&&laneEdges>=.80&&
           outerEdges>=.55&&grass<=.08)
            confidence='strong';
        else if(!outside&&water<=.025&&length>=1.25&&
            center>=.84&&shoulders>=.75&&laneEdges>=.58)
            confidence='medium';
        else if(!outside&&water<=.08&&length>=.5&&
            center>=.65)
            confidence='review';
        return {
            lengthOBJ:+length.toFixed(3),confidence,
            center:+center.toFixed(3),
            shoulders:+shoulders.toFixed(3),
            laneEdges:+laneEdges.toFixed(3),
            outerEdges:+outerEdges.toFixed(3),
            marked:+marked.toFixed(3),
            grass:+grass.toFixed(3),water:+water.toFixed(3),
            outside,gradeCertified:false,roadCertified:false
        };
    }
    static classify(graph,survey,masks){
        if(!graph||!Array.isArray(graph.edges)||!Array.isArray(graph.nodes))
            throw Error('Grafo de superfície inválido');
        if(!survey||!Number.isFinite(survey.width)||
           !Number.isFinite(survey.stepOBJ)||survey.stepOBJ<=0)
            throw Error('Grade de materiais inválida');
        const bytes=Math.ceil(survey.width*survey.height/8);
        for(const name of this.LAYERS)
            if(!masks?.[name]||masks[name].length!==bytes)
                throw Error('Bitset inválido: '+name);
        const counts={strong:0,medium:0,review:0,reject:0};
        const lengths={strong:0,medium:0,review:0,reject:0};
        const records=graph.edges.map((edge,id)=>{
            const p=this.profile(edge,survey,masks);
            counts[p.confidence]++;
            lengths[p.confidence]+=p.lengthOBJ;
            return {id,from:edge.from,to:edge.to,...p};
        });
        const ranked=records
            .filter(e=>e.confidence==='strong'||e.confidence==='medium')
            .sort((a,b)=>b.lengthOBJ-a.lengthOBJ).slice(0,40);
        const groups=this.connectedCandidates(records);
        return {
            format:'Driver2ChicagoPS1SurfaceEvidenceR24',
            tilesRead:survey.tilesRead,graphNodes:graph.nodes.length,
            graphEdges:graph.edges.length,sourceSHA256:graph.sourceSHA256,
            counts,lengthsOBJ:Object.fromEntries(Object.entries(lengths)
                .map(([k,v])=>[k,+v.toFixed(2)])),
            topEdges:ranked.map(e=>({id:e.id,confidence:e.confidence,
                lengthOBJ:e.lengthOBJ,center:e.center,
                laneEdges:e.laneEdges,marked:e.marked})),
            components:groups.slice(0,20),
            records,
            roadCertified:false,gradedCrossingsCertified:false,
            missionsMigrated:false,wholeMapReconstructed:false,
            caveat:'Material/width evidence only: pavements include sidewalks, yards and elevated structures. Results are not driveable-road certifications.'
        };
    }
    static connectedCandidates(records){
        const adj=new Map();
        for(const e of records){
            if(!['strong','medium'].includes(e.confidence))continue;
            for(const node of [e.from,e.to]){
                if(!adj.has(node))adj.set(node,[]);
                adj.get(node).push(e.id);
            }
        }
        const seen=new Set(),groups=[];
        for(const e of records){
            if(!['strong','medium'].includes(e.confidence)||seen.has(e.id))
                continue;
            const stack=[e.id];seen.add(e.id);
            const nodes=new Set(),edges=[];
            let lengthOBJ=0;
            while(stack.length){
                const id=stack.pop(),item=records[id];
                edges.push(id);lengthOBJ+=item.lengthOBJ;
                for(const node of [item.from,item.to]){
                    nodes.add(node);
                    for(const next of (adj.get(node)||[]))
                        if(!seen.has(next)){seen.add(next);stack.push(next);}
                }
            }
            groups.push({edges:edges.length,nodes:nodes.size,
                lengthOBJ:+lengthOBJ.toFixed(2),
                firstEdge:Math.min(...edges),
                // IDs dos primeiros 30: para investigar rotas sem
                // transportar todos os segmentos no HUD.
                sampleEdgeIds:edges.slice(0,30)});
        }
        return groups.sort((a,b)=>b.lengthOBJ-a.lengthOBJ);
    }
    static async browserMasks(survey){
        if(typeof DecompressionStream==='undefined')
            throw Error('Navegador sem suporte a gzip');
        const masks={};
        for(const name of this.LAYERS){
            const base64=survey.layers?.[name]?.gzipBitsetBase64;
            if(!base64)throw Error('Camada de material ausente: '+name);
            const input=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
            const stream=new Blob([input]).stream()
                .pipeThrough(new DecompressionStream('gzip'));
            masks[name]=new Uint8Array(await new Response(stream).arrayBuffer());
        }
        return masks;
    }
    static makeOverlay(sceneRoot,THREE,graph,result){
        const positions={strong:[],medium:[],review:[]};
        for(const record of result.records){
            const p=positions[record.confidence];
            if(!p)continue;
            const points=graph.edges[record.id]?.pointsOBJ||[];
            for(let i=1;i<points.length;i++){
                const a=points[i-1],b=points[i];
                for(const vertex of [a,b])
                    p.push(vertex[0],.19,vertex[1]);
            }
        }
        const group=new THREE.Group();
        group.name='chicago-r24-uncertified-pavement-candidates';
        group.visible=false;
        group.userData.sourceSurfaceOnly=true;
        group.userData.collidersCreated=0;
        const colors={strong:0x72e5b1,medium:0xe4c67b,review:0x6e8ba8};
        for(const [level,points] of Object.entries(positions)){
            if(!points.length)continue;
            const geo=new THREE.BufferGeometry();
            geo.setAttribute('position',
                new THREE.Float32BufferAttribute(points,3));
            const lines=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({
                color:colors[level],depthTest:false,transparent:true,
                opacity:level==='review'?.35:.9
            }));
            lines.name='source-only-'+level;
            lines.renderOrder=8;
            group.add(lines);
        }
        sceneRoot.add(group);
        return group;
    }
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverChicagoRoadEvidenceR24;
