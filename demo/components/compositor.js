/* global AFRAME THREE */
// The compositor. Blends the blurred renderTarget from the bloom component.
// It also checks opacity and converts parts of the frame to ascii(Alpha masking).
AFRAME.registerSystem('compositor', {

  schema: { default: true },

  init: function () {
    var self = this;
    this.setupPostState();
    this.postModified();
    this.sceneEl.addEventListener('renderstart', function () {
      self.sceneEl.renderTarget.depthTexture = new THREE.DepthTexture();
      self.sceneEl.renderTarget.stencilBuffer = false;
    });
    this.evh = this.postModified.bind(this);
    this.sceneEl.addEventListener('post-modified', this.evh);
  },

  update: function () {
    this.sceneEl.renderTarget = this.data ? this.renderTarget : null;
  },

  setupPostState: function () {
    this.renderTarget = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat });
    this.renderTarget.texture.generateMipmaps = false;
    this.renderTarget.depthTexture = new THREE.DepthTexture();
    this.renderTarget.stencilBuffer = false;
    this.scenePost = new THREE.Scene();
    this.cameraPost = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadPost = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
    this.scenePost.add(this.quadPost);
  },

  postModified: function (ev) {
    this.needsConfig = true;
  },

  // Whenever the postproc setup changes, the compositor shader is recompiled
  config: function () {
    var scene = this.sceneEl;
    var behaviors = scene.behaviors.tock;
    var bloom = behaviors.length ? behaviors[0] : null;
    console.log('POST-MODIFIED', behaviors);
    this.needsConfig = false;

    var uniforms = {
      srcTexture: { type: 't', value: scene.renderTarget },
      resolution: {type: 'v2', value: new THREE.Vector2(0, 0)}
    };
    var defines = {};
    if (bloom) {
      uniforms.bloomTexture = { type: 't', value: null };
      uniforms.bloomIntensity = { type: 'f', value: bloom.postIntensity };
      defines['BLEND_BLOOM'] = 1;
      this.bloomComponent = bloom;
    }

    uniforms.cameraNear = { type: 'f', value: scene.camera.near };
    uniforms.cameraFar = { type: 'f', value: scene.camera.far };

    if (scene.renderTarget.depthTexture) {
      uniforms.depthTexture = { type: 't', value: null };
      defines['BLEND_DEPTH'] = 1;
    }

    this.quadPost.material = new THREE.ShaderMaterial({
      defines: defines,
      uniforms: uniforms,
      vertexShader: this.vertexText,
      fragmentShader: this.fragmentText,

      depthWrite: false

    });
  },

  // Traverse scene objects and set opacity based on the postOpacity attribute set by the pulse component.
  tick: function (time) {
    var scene = this.sceneEl;
    var size= this.sceneEl.renderer.getSize();    
    var rt = this.sceneEl.renderTarget;    
    if (!rt) { return; }
    if (size.width != rt.width || size.height != rt.height) {
      rt.setSize(size.width, size.height);
    }
        
    scene.object3D.traverse(function (obj) {
      var material = obj.material;
      if (material && material.postOpacity !== undefined) {
        material.opacity = material.postOpacity;
      }
    });
  },

  tock: function () {
    var scene = this.sceneEl;
    if (!scene.renderTarget) { return; }
    var renderTarget = scene.renderTarget;
    if (this.needsConfig) { this.config(); }
    var uniforms = this.quadPost.material.uniforms;
    uniforms.resolution.value.set(renderTarget.width, renderTarget.height);
    if (uniforms.bloomIntensity) uniforms.bloomIntensity.value = this.bloomComponent.postIntensity;
    if (uniforms.bloomTexture) {
      uniforms.bloomTexture.value = this.bloomComponent.renderTarget;
    }
    if (uniforms.depthTexture) {
      uniforms.depthTexture.value = scene.renderTarget.depthTexture;
    }
    scene.renderer.render(this.scenePost, this.cameraPost);
  },

  vertexText: [
    '#include <common>',
    'uniform vec2 resolution;',
    'varying vec2 vUv;',
    'void main() {',
    '   vUv = uv;',
    '   gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
    '}'
  ].join('\n'),

  fragmentText: [
    'uniform sampler2D srcTexture;',
    'uniform vec2 resolution;',
    'uniform float cameraNear;',
    'uniform float cameraFar;',
    'varying vec2 vUv;',
    '#if defined BLEND_BLOOM',
    'uniform sampler2D bloomTexture;',
    'uniform float bloomIntensity;',
    '#endif',

    '#if defined BLEND_DEPTH',
    'uniform sampler2D depthTexture;',

    'float readDepth (vec2 uv) {',
    '  float cameraFarPlusNear = cameraFar + cameraNear;',
    '  float cameraFarMinusNear = cameraFar - cameraNear;',
    '  float cameraCoef = 2.0 * cameraNear;',
    '  return cameraCoef / (cameraFarPlusNear - texture2D(depthTexture, uv).x * cameraFarMinusNear);',
    '}',
    '#endif',

    '// Bitmap to ASCII (not really) fragment shader by movAX13h, September 2013',
    '// --- This shader is now used in Pixi JS ---',

    'float character(float n, vec2 p) // some compilers have the word "char" reserved',
    '{',
    '  p = floor(p*vec2(4.0, -4.0) + 2.5);',
    '  if (clamp(p.x, 0.0, 4.0) == p.x && clamp(p.y, 0.0, 4.0) == p.y)',
    '  {',
    '    if (int(mod(n/exp2(p.x + 5.0*p.y), 2.0)) == 1) return 1.0;',
    '  }	',
    '  return 0.0;',
    '}',

    'void main()',
    '{',
    '  vec4 col = texture2D(srcTexture, floor(gl_FragCoord.xy/8.0)*8.0/resolution);	',
    '  ',
    '  float gray = (col.r + col.g + col.b)/3.0;',
    '  ',
    '  float n = 65536.0;       // .',
    '  if (gray > 0.2) n = 65600.0;  // :',
    '  if (gray > 0.3) n = 332772.0;  // *',
    '  if (gray > 0.4) n = 15255086.0; // o ',
    '  if (gray > 0.5) n = 23385164.0; // &',
    '  if (gray > 0.6) n = 15252014.0; // 8',
    '  if (gray > 0.7) n = 13199452.0; // @',
    '  if (gray > 0.8) n = 11512810.0; // #',
    '  float split = 0.33;',
    '  #if defined BLEND_DEPTH',
    '  split = mix(0.0,0.66,readDepth(vUv));',
    '  #endif',

    '  vec2 p = mod(gl_FragCoord.xy/4.0, 2.0) - vec2(1.0);',
    '  vec4 ocol = texture2D(srcTexture, vUv );',
    '  vec3 acol = ((1.0-split) * col.rgb * character(n, p) + split * ocol.rgb);',

    '  vec3 color = mix(ocol.rgb,acol.rgb,ocol.a);',
    '  ',
    '  #if defined BLEND_BLOOM',
    '  color += texture2D(bloomTexture,vUv).rgb * bloomIntensity;',
    '  #endif',

    '  gl_FragColor = vec4(color,1.0);',

    '}'
  ].join('\n')
});
