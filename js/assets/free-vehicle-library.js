
/**
 * Assets 3D opcionais CC0, provenientes do Kenney Car Kit.
 * Cache único de glTF por tipo, com fallback integral para os carros procedurais.
 * Esta biblioteca não altera o modelo da física nem depende de um build JS.
 */
class FreeVehicleAssets {
    constructor(engine) {
        this.engine = engine;
        this.enabled = true;
        this.cache = new Map();
        this.baseUrl = 'https://cdn.jsdelivr.net/gh/Hidencod/tge-assets@7be9b573bc74f32ed766b44b3f46550d02ca83b5/packs/car-kit/';
        this.failed = new Set();
        this.updateButton();
    }

    getModelName(vehicle) {
        if (vehicle.isPolice) return 'police.glb';
        if (vehicle.isSecret) return 'race.glb';
        if (vehicle === this.engine.playerCar) return 'sedan-sports.glb';
        if (vehicle.bodyStyle === 'truck') return 'truck.glb';
        // Os modelos especiais de ônibus e limusine continuam procedurais.
        if (vehicle.bodyStyle === 'bus' || vehicle.bodyStyle === 'limo') return null;
        if (vehicle.name.includes('COUPE')) return 'hatchback-sports.glb';
        return 'sedan.glb';
    }

    getScene(filename) {
        if (!this.cache.has(filename)) {
            this.cache.set(filename, new Promise(resolve => {
                if (!THREE.GLTFLoader) {
                    this.failed.add(filename);
                    resolve(null);
                    return;
                }
                const loader = new THREE.GLTFLoader();
                loader.load(this.baseUrl + filename,
                    gltf => resolve(gltf.scene),
                    undefined,
                    () => {
                        this.failed.add(filename);
                        resolve(null);
                    }
                );
            }));
        }
        return this.cache.get(filename);
    }

    decorateFleet() {
        if (!this.enabled) return;
        this.engine.vehicles.forEach(vehicle => {
            if (vehicle._userCustomModel || vehicle._cc0ModelApplied) return;
            const filename = this.getModelName(vehicle);
            if (!filename) return;
            this.getScene(filename).then(template => {
                if (!template || !this.enabled || vehicle._userCustomModel ||
                    !this.engine.vehicles.includes(vehicle) || !vehicle.root.parent) return;
                vehicle.applyCC0Model(template.clone(true));
                this.updateStatus();
            });
        });
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.decorateFleet();
        } else {
            this.engine.vehicles.forEach(v => {
                if (v._cc0ModelApplied) v.buildCarMesh();
            });
        }
        this.updateButton();
        this.updateStatus();
    }

    updateButton() {
        const button = document.getElementById('btn-free-assets');
        if (!button) return;
        button.textContent = this.enabled ? '🚘 3D CC0' : '🚘 PS1';
        button.title = this.enabled ?
            'Modelos 3D gratuitos Kenney CC0 ativos (M para alternar)' :
            'Malhas clássicas procedurais ativas (M para alternar)';
        button.setAttribute('aria-pressed', this.enabled ? 'true' : 'false');
    }

    updateStatus() {
        const el = document.getElementById('asset-loader-status');
        if (!el || this.engine.playerCar?._userCustomModel) return;
        const count = this.engine.vehicles.filter(v => v._cc0ModelApplied).length;
        el.textContent = this.enabled ?
            ('Assets CC0 Kenney: ' + count + ' veículos 3D carregados; demais usam malha PS1.' +
                (this.failed.size ? ' Alguns modelos externos indisponíveis.' : '')) :
            'Malhas PS1 procedurais ativas. Pressione M para ativar modelos CC0.';
    }
}
