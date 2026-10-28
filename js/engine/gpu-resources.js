/**
 * Descarte de recursos gráficos sob posse do objeto removido.
 * Object3D.clone(true) do GLTFLoader compartilha geometria, material e textura
 * com o template em cache. Não destruí-los ao trocar carro ou reiniciar cidade.
 * Materiais clonados para pintura e índices de portas gerados em runtime
 * pertencem à instância e precisam ser liberados.
 */
class GPUResourceUtils {
  static disposeSubtree(root) {
    if (!root) return;
    const geometries = new Set(), materials = new Set(), textures = new Set();
    const visit = (node, sharedParent = false) => {
      const shared = sharedParent || node.userData?.cc0SharedAsset === true;
      if (node.geometry && (!shared || node.userData?.driverOwnedGeometry === true))
        geometries.add(node.geometry);
      const mats = node.material ?
        (Array.isArray(node.material) ? node.material : [node.material]) : [];
      for (const material of mats) {
        if (!material) continue;
        const instancePaint = material.userData?.driverUserPaint === true;
        if (!shared || instancePaint) {
          materials.add(material);
          // A pintura personalizada compartilha o atlas de textura do GLB.
          if (!shared) {
            for (const value of Object.values(material))
              if (value?.isTexture) textures.add(value);
          }
        }
      }
      for (const child of node.children || []) visit(child, shared);
    };
    visit(root);
    textures.forEach(texture => texture.dispose());
    materials.forEach(material => material.dispose());
    geometries.forEach(geometry => geometry.dispose());
  }
}
