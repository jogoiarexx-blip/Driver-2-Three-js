/**
 * Checkpoints em ordem nas missões de rota, como nos desafios clássicos Driver.
 * Missões que apenas usam marcadores isolados continuam livres.
 */
class DriverCheckpointRoute {
    static ordered(type) {
        return type === 'checkpoints' || type === 'trailblazer' ||
            type === 'mountainpass' || type === 'evidence' || type === 'pursuit' ||
            type==='gate_racing' || type==='arcade_checkpoint';
    }
    static current(markers) {
        return markers.find(marker => !marker.collected) || null;
    }
    static isActive(type, markers, marker) {
        return !!marker && !marker.collected &&
            (!this.ordered(type) || this.current(markers) === marker);
    }
    static refresh(type, markers) {
        for (const marker of markers) {
            if (!marker.mesh) continue;
            marker.mesh.visible = this.isActive(type, markers, marker);
        }
    }
    static findReached(type, markers, x, z, radius = 5.5) {
        return markers.find(marker =>
            this.isActive(type, markers, marker) &&
            Math.hypot(marker.x - x, marker.z - z) < radius
        ) || null;
    }
}
