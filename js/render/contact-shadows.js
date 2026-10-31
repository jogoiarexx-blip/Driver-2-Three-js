/**
 * Sombras de contato em um único WebP compartilhado. Não usa shadow maps.
 * As malhas marcam recursos compartilhados para o descarte de cidades.
 */
class DriverFakeShadows {
    static init() {
        if (this.material) return;
        const texture = new THREE.TextureLoader().load('data:image/webp;base64,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');
        this.geometry = new THREE.PlaneGeometry(1, 1);
        this.material = new THREE.MeshBasicMaterial({
            map: texture, transparent: true, opacity: 0.8,
            depthWrite: false, polygonOffset: true,
            polygonOffsetFactor: -1, polygonOffsetUnits: -1
        });
        this.material.visible = this.enabled !== false;
    }
    static create(width, length) {
        this.init();
        const mesh = new THREE.Mesh(this.geometry, this.material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.scale.set(width, length, 1);
        mesh.position.y = 0.045;
        mesh.userData.cc0SharedAsset = true;
        mesh.renderOrder = 2;
        return mesh;
    }
    static setEnabled(enabled) {
        this.enabled = !!enabled;
        if (this.material) this.material.visible = this.enabled;
    }
}
