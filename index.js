/* 
* Copyright (c) 2016, Yannis Gravezas All Rights Reserved. Available via the MIT license.
*/

var Clubber = require("clubber");

AFRAME.registerSystem("clubbers", {
  schema: {
    src: { type: "selector", default: null },
    size: { default: 2048 },
    mute: { default: false},
    lowRange: {type: "array", default: [10,32]},
    midRange: {type: "array", default: [32,48]},
    highRange: {type: "array", default: [48,128]},
    lowSmooth: {type: "array", default: [0.1,0.1,0.1,0.16]},
    midSmooth: {type: "array", default: [0.1,0.1,0.1,0.16]},
    highSmooth: {type: "array", default: [0.1,0.1,0.1,0.16]},
    
  },
  
  init: function () {
    var d = this.data;
    this.clubber = new Clubber({
      src: this.data.src,
      size: this.data.size,
      mute: this.data.mute
    });
    this.clubber.listen(d.src);
    this.low = this.clubber.band({ from: d.lowRange[0], to: d.lowRange[1], smooth: d.lowSmooth });
    this.mid = this.clubber.band({ from: d.midRange[0], to: d.midRange[1], smooth: d.midSmooth });
    this.high = this.clubber.band({ from: d.highRange[0], to: d.highRange[1], smooth: d.highSmooth });
  },
  
  updateClubber: function (time) {
    if (time === this.lastTime) return;
    this.clubber.update(time);
    this.lastTime = time;
  }
});

AFRAME.registerComponent("clubber", {
  schema: {
    exec: { type: "string", default: null },
    debug: { default: false }
  },
  
  update: function () {
    var run = ["var val;", "var mesh = this.getObject3D('mesh');"];
    if(!this.data.exec) return;
    var exec = this.data.exec.split("#");
    if(!exec.length) return;
    var values = [], vidx=0;
    exec.forEach(function (val, i) {
      var tok = val.split("=");
      if (tok.length < 2) { return; }
      var statement = tok.pop();
      values.push(0);
      run.push("prev = values[" + vidx + "];");
      run.push("values[" + vidx + "] = prev = " + statement + ";");
      vidx++;
      
      tok.forEach(function (k) {
        k = k.replace(" ","");
        if (k[0] === ".") {
              run.push("mesh" + k + " = prev;");
        } else {
          var args = k.split(".");
          var attr = args.shift().replace(" ","");
          if (attr[0] === "$" && attr === k && tok.length === 1){
            run.push(["var ", val, ";"].join(""));
            return;
          }
        
          if (args.length) {
            args.forEach(function (a) {
              a=a.replace(" ", "");
              run.push("this.setAttribute('"+attr+"','"+a+"', prev);");
            });
          } else {
            run.push("this.setAttribute('"+attr+"',prev);");
          }
        }
      })
    });
    this.values = values;
    var code = run.join("\n");
    if (this.data.debug) console.log(code);
    this.func = Function("time","values","low","mid","high",code);
  },
  
  tick: function (time, delta) {
    var s = this.el.sceneEl.systems.clubbers;
    if (!this.func || !s) return;
    
    s.updateClubber(time);
    this.func.call(this.el, time, this.values, s.low(), s.mid(), s.high());
  }
});