/** Libera recursos WebGL privados; modelos GLB compartilhados ficam em cache. */
class GPUResourceUtils {
  static disposeSubtree(root) {
    if (!root) return;
    const meshes = new Set(), materials = new Set(), textures = new Set();
    root.traverse(node => {
      if (node.userData && node.userData.cc0SharedAsset) return;
      if (node.geometry) meshes.add(node.geometry);
      if (node.material) {
        (Array.isArray(node.material) ? node.material : [node.material])
          .forEach(material => materials.add(material));
      }
    });
    materials.forEach(material => {
      Object.values(material).forEach(value => {
        if (value && value.isTexture) textures.add(value);
      });
    });
    textures.forEach(texture => texture.dispose());
    materials.forEach(material => material.dispose());
    meshes.forEach(geometry => geometry.dispose());
  }
}
