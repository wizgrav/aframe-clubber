/* global AFRAME THREE */

/*
Kawase bloom, described here
https://software.intel.com/en-us/blogs/2014/07/15/an-investigation-of-fast-real-time-gpu-based-image-blur-algorithms
*/

AFRAME.registerComponent('bloom', {

  schema: {
    passes: { default: '1 2 3 4' },
    threxp: { type: 'vec2', default: new THREE.Vector2(16, 0) },
    intensity: { type: 'float', default: 1.0 }
  },

  setupPostState: function () {
    this.scenePost = new THREE.Scene();
    this.cameraPost = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadPost = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
    this.scenePost.add(this.quadPost);
  },

  init: function () {
    this.setupPostState();
    this.brightMaterial = new THREE.ShaderMaterial({
      uniforms: {
        srcTexture: { type: 't', value: null },
        threxp: { type: 'v2', value: new THREE.Vector2(0, 0) }
      },
      vertexShader: this.vertexBrightText,
      fragmentShader: this.fragmentBrightText,

      depthWrite: false

    });
    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        iteration: { type: 'f', value: 0 },
        srcTexture: { type: 't', value: null },
        pixelSize: { type: 'v2', value: new THREE.Vector2(0, 0) }
      },
      vertexShader: this.vertexBlurText,
      fragmentShader: this.fragmentBlurText,

      depthWrite: false

    });
    this.quadPost.material = this.brightMaterial;
    var rtOptions = { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat };
    this.renderTargets = [
      new THREE.WebGLRenderTarget(1, 1, rtOptions),
      new THREE.WebGLRenderTarget(1, 1, rtOptions)
    ];
    this.el.emit('post-modified');
  },

  remove: function () {
    this.el.emit('post-modified');
  },

  update: function (oldData) {
    this.postIntensity = this.data.intensity;
  },

  // We're doing bloom at half resolution for performance. Most blurry effects can get away with that.
  getTargets: function () {
    var srt = this.el.sceneEl.renderTarget;
    for (var i = 0; i < 2; i++) {
      var rt = this.renderTargets[i];
      if (rt.width !== srt.width  || rt.height !== srt.height ) {
        rt.setSize(srt.width / 2, srt.height / 2);
      }
    }
    return this.renderTargets;
  },

  tock: function () {
    var rts = this.getTargets();
    var el = this.el;
    var scene = el.sceneEl;
    var uns = this.brightMaterial.uniforms;
    var rt = scene.renderTarget;
    // Bright pass: isolate and highlight the brightest parts of the scene.
    this.scenePost.overrideMaterial = this.brightMaterial;
    uns.threxp.value = this.data.threxp;
    uns.srcTexture.value = rt;
    rt = rts[0]; // Output to the first of the ping pong targets.
    scene.renderer.render(this.scenePost, this.cameraPost, rt);

    // Ping pong the render targets progressively blurring more on each pass.
    uns = this.blurMaterial.uniforms;
    this.scenePost.overrideMaterial = this.blurMaterial;
    var passes = this.data.passes.split(' ');
    for (var i = 0; i < passes.length; i++) {
      var ps = +(passes[i]);
      uns.srcTexture.value = rt;
      rt = rts[(i + 1) & 1];
      uns.pixelSize.value.set(1 / rt.width, 1 / rt.height);
      uns.iteration.value = ps;
      scene.renderer.render(this.scenePost, this.cameraPost, rt);
    }
    this.renderTarget = rt;
  },

  vertexBrightText: [
    '#include <common>',
    'varying vec2 vUv;',
    'void main() {',
    '   vUv = uv;',
    '   gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
    '}'
  ].join('\n'),

  vertexBlurText: [
    '#include <common>',
    'uniform vec2 pixelSize;',
    'uniform float iteration;',
    'varying vec2 vUv1;',
    'varying vec2 vUv2;',
    'varying vec2 vUv3;',
    'varying vec2 vUv4;',
    'void main() {',
    '   vec2 halfPixelSize = pixelSize / 2.0;',
    '   vec2 step = ( pixelSize.xy * vec2( iteration, iteration ) ) + halfPixelSize.xy;',
    '   vUv1 = uv + step;',
    '   vUv2 = uv - step;',
    '   vUv3 = uv + vec2(step.x, -step.y);',
    '   vUv4 = uv + vec2(-step.x, step.y);',
    '   gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
    '}'
  ].join('\n'),

  fragmentBrightText: [
    'uniform sampler2D srcTexture;',
    'uniform vec2 threxp;',
    'varying vec2 vUv;',

    'void main(){',
    '    vec4 color = texture2D(srcTexture, vUv);',
    '    gl_FragColor = vec4(pow(color.rgb,vec3(threxp.x))+vec3(threxp.y), 1.0);',
    '}'
  ].join('\n'),

  fragmentBlurText: [
    'uniform sampler2D srcTexture;',
    'varying vec2 vUv1;',
    'varying vec2 vUv2;',
    'varying vec2 vUv3;',
    'varying vec2 vUv4;',

    'void main(){',
    '    vec3 color = vec3(0.0);',
    '    color += texture2D(srcTexture,vUv1).rgb;',
    '    color += texture2D(srcTexture,vUv2).rgb;',
    '    color += texture2D(srcTexture,vUv3).rgb;',
    '    color += texture2D(srcTexture,vUv4).rgb;',
    '    gl_FragColor = vec4(color*0.25,1.0);',
    '}'
  ].join('\n')
});
