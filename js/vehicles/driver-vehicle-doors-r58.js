/**
 * R58 — low-cost car door hinges for native procedural Driver vehicles.
 * Not used for GLB imports with their own authored hinges or motorcycle.
 * Everything is chassis-local; vehicle collision shapes never change.
 */
class DriverVehicleDoorsR58 {
    static clamp(t){return Math.max(0,Math.min(1,Number(t)||0));}
    static smooth(t){t=this.clamp(t);return t*t*(3-2*t);}
    static attach(vehicle,paint,glass){
        if(!vehicle?.chassisTilt||vehicle.bodyStyle==='motorcycle' ||
           vehicle.bodyStyle==='bus'||vehicle.bodyStyle==='truck' ||
           typeof THREE==='undefined')return null;
        const left=new THREE.Group(),right=new THREE.Group();
        const dark=new THREE.MeshLambertMaterial({color:0x141a20});
        const metal=new THREE.MeshLambertMaterial({color:0xb8bec5});
        const pieces={};
        for(const side of [-1,1]){
            const hinge=side<0?left:right;
            hinge.name=side<0?'driver-door-left-hinge-r58':
                'driver-door-right-hinge-r58';
            hinge.position.set(side*1.22,0,.78);
            const panel=new THREE.Mesh(
                new THREE.BoxGeometry(.075,.69,1.25),paint);
            panel.position.set(side*.025,.77,-.625);
            panel.name=side<0?'driver-door-left-panel-r58':
                'driver-door-right-panel-r58';
            panel.castShadow=true;
            const window=new THREE.Mesh(
                new THREE.BoxGeometry(.042,.40,1.13),glass);
            window.position.set(side*.026,1.31,-.625);
            // Handles are separate details attached to the swinging panel.
            const handle=new THREE.Mesh(
                new THREE.BoxGeometry(.08,.055,.21),metal);
            handle.position.set(side*.078,1.00,-.87);
            hinge.add(panel,window,handle);
            const cavity=new THREE.Mesh(
                new THREE.BoxGeometry(.035,1.05,1.20),dark);
            cavity.position.set(side*1.225,1.04,.15);
            cavity.name='driver-door-interior-r58';
            cavity.visible=false;
            vehicle.chassisTilt.add(cavity,hinge);
            pieces[side]={hinge,cavity};
        }
        vehicle.entryDoorsR58={pieces,openSide:0,amount:0};
        return vehicle.entryDoorsR58;
    }
    static set(vehicle,side,amount){
        const doors=vehicle?.entryDoorsR58;
        if(!doors)return false;
        const chosen=side===1?1:-1,opening=this.clamp(amount);
        doors.amount=opening;doors.openSide=opening>0?chosen:0;
        for(const s of [-1,1]){
            const piece=doors.pieces[s];
            if(!piece)continue;
            const a=s===chosen?opening:0;
            // Local -Z panel swings outward from the front door jamb.
            piece.hinge.rotation.y=-s*1.12*a;
            piece.cavity.visible=a>.04;
        }
        return true;
    }
    static transition(vehicle,side,kind,t){
        if(!vehicle?.entryDoorsR58)return false;
        const p=this.clamp(t);
        // Early opening; leave clear doorway while knees and torso cross.
        const opening=this.smooth(p/.27);
        const closing=1-this.smooth((p-.78)/.22);
        return this.set(vehicle,side,Math.min(opening,closing));
    }
    static close(vehicle){return this.set(vehicle,-1,0);}
}
if(typeof module!=='undefined'&&module.exports)
    module.exports=DriverVehicleDoorsR58;
