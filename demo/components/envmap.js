/* global AFRAME THREE */

AFRAME.registerComponent('envmap', {
  dependencies: ["geometry", "material"],
  update: function () {
    this.el.envEl = document.querySelector('a-videosphere');
  },

  tick: function () {
    var environmentMap = this.el.envEl.object3DMap.mesh.material.map;
    environmentMap.mapping = THREE.EquirectangularReflectionMapping;
    this.el.object3DMap.mesh.material.map = environmentMap;
  }
});
