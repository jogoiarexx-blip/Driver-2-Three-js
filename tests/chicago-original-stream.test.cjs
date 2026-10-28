'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Stream=require('../js/world/chicago-original-tile-stream.js');
class Group{
    constructor(){
        this.children=[];this.userData={};this.parent=null;
        this.position={x:0,z:0,set:(x,y,z)=>{
            this.position.x=x;this.position.z=z;
        }};
        this.scale={setScalar:v=>{this.scale.value=v;}};
    }
    add(c){this.children.push(c);c.parent=this;}
    remove(c){this.children=this.children.filter(x=>x!==c);c.parent=null;}
    traverse(cb){for(const c of this.children){cb(c);c.traverse?.(cb);}}
}
const THREE={
    Group,DoubleSide:2,ClampToEdgeWrapping:1,
    NearestFilter:1,NearestMipmapNearestFilter:1,
    TextureLoader:class{
        load(url){const t={uri:url,dispose(){this.disposed=true;}};return t;}
    },
    MeshBasicMaterial:class{
        constructor(args){this.args=args;}
        dispose(){this.disposed=true;}
    },
    GLTFLoader:class{
        load(uri,success){
            const g=new Group();
            g.add({isMesh:true,geometry:{dispose(){this.disposed=true;}},
                material:{dispose(){this.disposed=true;}}});
            success({scene:g});
        }
    }
};
const manifest={
    format:'Driver2ChicagoVisualTilesV1',
    visualOnly:true,collisionReady:false,
    atlas:'chicago_atlas.webp',center:[-60,0,125],
    bounds:{min:[-110,-1,32],max:[-10,2,224]},
    tiles:[
        {id:'00_00',url:'chunks/00_00.glb',
            bounds:{min:[-65,0,120],max:[-55,1,130]},triangles:123},
        {id:'02_00',url:'chunks/02_00.glb',
            bounds:{min:[-25,0,120],max:[-18,1,130]},triangles:345}
    ]
};
const make=(options={})=>new Stream({
    scene:new Group(),THREE,maxLoaded:1,
    loadRadius:13,unloadRadius:18,...options
});
test('mantém a geometria original isolada da física',()=>{
    const s=make();
    s.bindManifest(manifest);
    assert.equal(s.root.position.x,204);
    assert.equal(s.root.position.z,-425);
    s.material={dispose(){this.disposed=true;}};
    s.texture={dispose(){this.disposed=true;}};
    s.update({x:0,z:0});
    assert.equal(s.loaded.size,1);
    assert.equal(s.stats().trianglesLoaded,123);
    assert.equal(s.stats().collidersCreated,0);
    s.dispose();
    assert.equal(s.scene.children.length,0);
});
test('não duplica setores e descarrega geometria',()=>{
    const s=make({maxLoaded:2});
    s.bindManifest(manifest);
    s.material={dispose(){this.disposed=true;}};
    s.update({x:0,z:0});s.update({x:0,z:0});
    assert.equal(s.loaded.size,1);
    s.update({x:200,z:0});
    assert.equal(s.loaded.size,0);
    s.dispose();s.dispose();
    assert.equal(s.stats().tilesLoaded,0);
});
test('impede paths inválidos e manifest incompatível',()=>{
    const s=make();
    assert.throws(()=>s.bindManifest({...manifest,collisionReady:true}),/isolamento/);
    assert.throws(()=>s.bindManifest({
        ...manifest,tiles:[{id:'unsafe',url:'../../evil.glb',
            bounds:manifest.tiles[0].bounds}]}),/Chunk inválido/);
    assert.throws(()=>s.bindManifest({}),/Manifest/);
});
