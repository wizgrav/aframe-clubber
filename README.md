## aframe-clubber

Audio driven visualizations for [A-Frame](https://aframe.io) using the [Clubber](https://github.com/wizgrav/clubber) rhythm analysis library.

[Demo](http://wizgrav.github.io/aframe-clubber/demo) 

### Usage

A system (`clubbers`) is responsible for fetching the frequency data from an audio element. It also creates three bands to cover the whole spectrum. Refer to [Clubber](https://github.com/wizgrav/clubber) for more details on the library itself.


The system can be configured using the following properties:

| Property              | Description                                                          | Default Value |
| --------              | -----------                                                          | ------------- |
| src                   | A selector to get the audio/video element to listen to.              | null          |
| size                  | The number of samples to grab for the fourier transform.             | 2048          |
| mute                  | If true the audio element will output to the speakers.               | true          |
| lowRange              | The range of midi notes tracked by the low band.                     | [10,32]       |
| midRange              | The range of midi notes tracked by the mid band.                     | [32,48]       |
| highRange             | The range of midi notes tracked by the high band.                    | [48,128]      |
| lowSmooth             | Exponential smoothing factors for the low band.                      | [0.1,0.1,0.1,0.16] |
| midSmooth             | Exponential smoothing factors for the mid band.                      | [0.1,0.1,0.1,0.16] |
| highSmooth            | Exponential smoothing factors for the high band.                     | [0.1,0.1,0.1,0.16] |

There's also a component(`clubber`) that performs the various modulations. To achieve optimal flexibility with minimal coding a scheme utilizing inline js assignments is employed. One or more oneliners are provided via the exec: property and they get translated into js functions to be executed on every tick. The arguments passed to these functions include the current time, previous frame's values and the vec4 arrays produced by the three clubber bands. Here are some examples of the functionality:

```html
  <a-entity clubber="exec: material.opacity = mid[3]" ></a-entity>
```
will be translated to
```js
function (time, values, low, mid, high) {
  var prev, mesh = this.getObject3D('mesh');
  prev = values[0];
  values[0] = prev =  mid[3]; // our statement goes here
  this.setAttribute('material', 'opacity', prev);
}
```
`this` refers to the element on which the component is attached. `values` is an array that persists the values from all assignments of the previous frame. Notice that `prev` is setup before the oneliner executes, which allows the developer to use the last value in the assignment eg. to smooth values like:
```html
  <a-entity clubber="exec: material.opacity = 0.33 * mid[3] + 0.66 * prev" >
  </a-entity>
```
Multiple properties can be assigned like
```html
  <a-entity clubber="exec: scale.x.y.z = low[3]" ></a-entity>
```
And multiple statements can be provided using a hash delimiter
```html
  <a-entity clubber="exec: scale.x = mid[3] # scale.y = mid[0]" ></a-entity>
```

Assignments can be as complex as one liners allow
```html
  <a-entity clubber="exec: material.opacity = 1.2 - Math.min(mid[3],low[3])" >
  </a-entity>
```
when the left side of the assignment starts with a dot, it will directly access the element's underlying mesh instead of using setAttribute() to access other components on the element, so for instance 
```html
  <a-entity clubber="exec: .material.uniforms.opacity.value = mid[3]" >
  </a-entity>
```
will translate to
```js
function (time, values, low, mid, high) {
  var prev, mesh = this.getObject3D('mesh');
  prev = values[0];
  values[0] = prev =  mid[3];
  mesh.material.uniforms.opacity.value = prev;
}
```
in this case though we can't do multiple property assignments as described above.

By setting debug:true on the component, the function body is logged on the console for inspection. 

Even though it seems(`and is`) abusive, this scheme makes the tuning of visualisations an effortless process while sacrificing very little in terms of creativity. Check the provided demo's markup. 
#### Browser Installation

Install and use by directly including the [browser files](dist):

```html
<head>
  <title>Clubber Audio Visualizer</title>
  <script src="https://aframe.io/releases/0.3.1/aframe.min.js"></script>
  <script src="https://wizgrav.github.io/aframe-clubber/dist/aframe-clubber.min.js"></script>
</head>
```

#### NPM Installation

Install via NPM:

```bash
npm install aframe-clubber
```

Then register and use.

```js
require('aframe');
require('aframe-clubber');
```