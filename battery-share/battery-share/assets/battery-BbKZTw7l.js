(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=`battery.settings.v1`,t={bg:{base:`#6c9fdc`,tint:`#00ff11`,tintAmount:1,blur:6,rotate:!0,imageOpacity:1,image:null},orb:{stops:[`#050509`,`#ff751a`,`#6b70b8`,`#5c8538`,`#ff4da8`,`#470829`],idle:[`#96b8e1`,`#c2bff0`,`#edc7ff`],grain:.09},links:[{id:`charged`,label:`Battery Charged`,src:`./battery/charged.wav`,hue:0},{id:`charging`,label:`Battery Charging`,src:`./battery/charging.wav`,hue:.33},{id:`low`,label:`Battery Low`,src:`./battery/low.wav`,hue:.66}]},n=(()=>{try{let n=JSON.parse(localStorage.getItem(e)||`null`);return n?{bg:{...t.bg,...n.bg},orb:{...t.orb,...n.orb},links:n.links||structuredClone(t.links)}:structuredClone(t)}catch{return structuredClone(t)}})(),r=new Set,i=e=>r.add(e),a;function o(t,i){i(n[t]),clearTimeout(a),a=setTimeout(()=>localStorage.setItem(e,JSON.stringify(n)),150),r.forEach(e=>e(n,t))}var s=new Promise((e,t)=>{let n=indexedDB.open(`battery-files`,1);n.onupgradeneeded=()=>n.result.createObjectStore(`f`),n.onsuccess=()=>e(n.result),n.onerror=()=>t(n.error)}),c=async(e,t)=>{let n=await s;return new Promise((r,i)=>{let a=n.transaction(`f`,e),o=t(a.objectStore(`f`));a.oncomplete=()=>r(o.result),a.onerror=()=>i(a.error)})},l=async e=>{let t=crypto.randomUUID();return await c(`readwrite`,n=>n.put(e,t)),t},u=new Map;async function d(e){if(u.has(e))return u.get(e);let t=await c(`readonly`,t=>t.get(e));if(!t)return null;let n=URL.createObjectURL(t);return u.set(e,n),n}var f=(e,t={},...n)=>{let r=Object.assign(document.createElement(e),t);return n.flat().forEach(e=>r.append(e)),r},p=(e,t)=>f(`label`,{className:`row`},f(`span`,{textContent:e}),t),m=(e,t)=>f(`input`,{type:`color`,value:e,oninput:e=>t(e.target.value)}),h=(e,t,n,r,i)=>{let a=f(`output`,{textContent:e});return f(`span`,{className:`ctl`},f(`input`,{type:`range`,min:t,max:n,step:r,value:e,oninput:e=>{a.textContent=e.target.value,i(+e.target.value)}}),a)},g=(e,t)=>{let n=f(`input`,{type:`file`,accept:e,onchange:()=>n.files[0]&&t(n.files[0])});n.click()};function ee(){let t=f(`div`,{className:`panel__body`}),r=f(`aside`,{className:`panel`,hidden:!0},t),i=f(`button`,{className:`panel__toggle`,textContent:`Edit`,onclick:()=>{r.hidden=!r.hidden,i.classList.toggle(`open`,!r.hidden)}}),a=e=>f(`h3`,{textContent:e}),s=f(`span`,{className:`file`,textContent:n.bg.image?`custom image`:`board.png`});t.append(a(`Background`),p(`Colour (behind image)`,m(n.bg.base,e=>o(`bg`,t=>t.base=e))),p(`Reference image`,f(`span`,{className:`ctl`},s,f(`button`,{textContent:`Upload`,onclick:()=>g(`image/*`,async e=>{let t=await l(e);o(`bg`,e=>{e.image=t,e.rotate=!1}),s.textContent=e.name,c.checked=!1})}),f(`button`,{textContent:`Reset`,onclick:()=>{o(`bg`,e=>{e.image=null,e.rotate=!0}),s.textContent=`board.png`,c.checked=!0}}))),p(`Image opacity`,h(n.bg.imageOpacity,0,1,.01,e=>o(`bg`,t=>t.imageOpacity=e))),p(`Image tint`,m(n.bg.tint,e=>o(`bg`,t=>t.tint=e))),p(`Tint strength`,h(n.bg.tintAmount,0,1,.01,e=>o(`bg`,t=>t.tintAmount=e))),p(`Blur (px)`,h(n.bg.blur,0,40,1,e=>o(`bg`,t=>t.blur=e))));let c=f(`input`,{type:`checkbox`,checked:n.bg.rotate,onchange:e=>o(`bg`,t=>t.rotate=e.target.checked)});t.append(p(`Rotate 90°`,c)),t.append(a(`Circle — playing`)),[`Rim`,`Band 1`,`Band 2`,`Band 3`,`Band 4`,`Core`].forEach((e,r)=>t.append(p(e,m(n.orb.stops[r],e=>o(`orb`,t=>t.stops=t.stops.map((t,n)=>n===r?e:t)))))),t.append(a(`Circle — idle`)),[`Centre`,`Middle`,`Edge`].forEach((e,r)=>t.append(p(e,m(n.orb.idle[r],e=>o(`orb`,t=>t.idle=t.idle.map((t,n)=>n===r?e:t)))))),t.append(p(`Grain`,h(n.orb.grain,0,.3,.005,e=>o(`orb`,t=>t.grain=e))));let u=f(`div`,{className:`links`}),d=()=>{u.replaceChildren(...n.links.map(e=>f(`div`,{className:`link`},f(`input`,{type:`text`,value:e.label,oninput:t=>o(`links`,r=>{n.links.find(t=>t.id===e.id).label=t.target.value})}),f(`span`,{className:`ctl`},f(`span`,{className:`file`,textContent:e.fileName||(e.src?e.src.split(`/`).pop():``)}),f(`button`,{textContent:`Sound`,onclick:()=>g(`audio/*`,async t=>{let r=await l(t);o(`links`,()=>{let i=n.links.find(t=>t.id===e.id);i.file=r,i.fileName=t.name,delete i.src}),d()})}),f(`button`,{textContent:`×`,title:`Remove link`,onclick:()=>{o(`links`,()=>{n.links=n.links.filter(t=>t.id!==e.id)}),d()}})),p(`Hue`,h(e.hue,0,1,.01,t=>o(`links`,()=>{n.links.find(t=>t.id===e.id).hue=t}))))))};d(),t.append(a(`Links`),u,f(`button`,{className:`wide`,textContent:`+ Add link with sound`,onclick:()=>g(`audio/*`,async e=>{let t=await l(e),r=e.name.replace(/\.[^.]+$/,``).replace(/[_-]+/g,` `);o(`links`,()=>{n.links=[...n.links,{id:crypto.randomUUID(),label:r,file:t,fileName:e.name,hue:Math.random()}]}),d()})}),f(`button`,{className:`wide`,textContent:`Reset all to defaults`,onclick:()=>{localStorage.removeItem(e),location.reload()}})),document.body.append(i,r)}var te=document.getElementById(`scene`),_=()=>te.style.setProperty(`--s`,Math.max(innerWidth/1440,innerHeight/1045));addEventListener(`resize`,_),_();var v,y,b,x,S,C=null,w=.5,T=document.getElementById(`list`);function E(){v||(v=new(window.AudioContext||window.webkitAudioContext),y=v.createAnalyser(),y.fftSize=1024,y.smoothingTimeConstant=.7,y.connect(v.destination),S=new Uint8Array(y.frequencyBinCount))}function D(){x&&(x.pause(),x.onended=null),b&&b.disconnect(),x=b=null,C=null,T.querySelectorAll(`a`).forEach(e=>e.classList.remove(`on`))}async function O(e){E(),v.state===`suspended`&&await v.resume();let t=C===e.id;if(D(),t)return;let n=e.file?await d(e.file):e.src;n&&(x=new Audio(n),b=v.createMediaElementSource(x),b.connect(y),w=e.hue,C=e.id,x.onended=D,x.play(),k())}function k(){T.replaceChildren(...n.links.map(e=>{let t=document.createElement(`a`);t.href=`#`,t.textContent=e.label,e.id===C&&t.classList.add(`on`),t.onclick=t=>{t.preventDefault(),O(e)};let n=document.createElement(`li`);return n.append(t),n}))}k();var A=document.querySelector(`.board`),j=document.getElementById(`boardImg`),M;async function N(){let e=n.bg,t=document.documentElement.style;t.setProperty(`--bg`,e.base),t.setProperty(`--tint`,e.tint),t.setProperty(`--tint-a`,e.tintAmount),t.setProperty(`--img-a`,e.imageOpacity),t.setProperty(`--blur`,e.blur+`px`),t.setProperty(`--rot`,e.rotate?`90deg`:`0deg`),A.classList.toggle(`flat`,!e.rotate),e.image!==M&&(M=e.image,j.src=e.image&&await d(e.image)||`./battery/board.png`)}N();var P=document.getElementById(`orb`),F=Math.min(devicePixelRatio||1,2),I=P.getContext(`webgl`,{premultipliedAlpha:!0,alpha:!0}),L=`attribute vec2 p; varying vec2 v; void main(){ v=p; gl_Position=vec4(p,0.,1.); }`,ne=`
precision highp float;
varying vec2 v;
uniform float uT, uBass, uMid, uHigh, uE, uHue, uGrain;
uniform vec3 uC[6];
uniform vec3 uI[3];
uniform sampler2D uSpec;

vec3 pal(float t, float h){
  return 0.5 + 0.5*cos(6.28318*(t + h + vec3(0.0, 0.33, 0.67)));
}
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// banded ramp: black -> orange -> slate -> olive -> hot pink -> burgundy core
vec3 ramp(float t){
  vec3 c = uC[0];
  c = mix(c, uC[1], smoothstep(.10,.26,t));
  c = mix(c, uC[2], smoothstep(.40,.48,t));
  c = mix(c, uC[3], smoothstep(.50,.57,t));
  c = mix(c, uC[4], smoothstep(.60,.70,t));
  c = mix(c, uC[5], smoothstep(.88,.99,t));
  return c;
}

void main(){
  vec2 q = v;
  float r = length(q);
  if (r > 1.0) discard;

  // Figma idle look: diamond gradient, blue centre -> lavender edge
  float d = clamp((abs(q.x)+abs(q.y)), 0., 1.4);
  vec3 idle = mix(mix(uI[0], uI[1], smoothstep(0.,.5,d)), uI[2], smoothstep(.5,1.,d));

  // mirrored left/right; the top/bottom fold breathes in and out
  vec2 p = vec2(abs(q.x), q.y) * 2.1;
  p.y = mix(p.y, abs(p.y) - .15, .5 + .5*sin(uT*.35));

  float sp = texture2D(uSpec, vec2(abs(p.y)*.5 + .1, .5)).r;
  float f = 0.;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float band = fi < 2. ? uBass : (fi < 4. ? uMid : uHigh);
    vec2 c = vec2(.7*abs(sin(uT*.31 + fi*2.1)), 1.1*sin(uT*.27 + fi*1.3));
    float w = .06 + .22*band + .04*sp;
    f += w / (dot(p-c, p-c) + .06);
  }
  // flowing ripple so the edges ooze rather than hold still
  f += .10*sin(p.y*3. + uT*.8 + uMid*4.) * (.5 + uBass);

  float t = f / (f + 1.6 - .6*uBass);
  // film grain, re-rolled ~14x/s, strongest where the bands are soft
  float g = hash(gl_FragCoord.xy + floor(uT*14.)) - .5;
  t += g * uGrain;

  vec3 col = ramp(t);
  col *= .85 + .25*uHigh;

  float m = smoothstep(0., .15, uE);
  gl_FragColor = vec4(mix(idle, col, m), 1.);
}`;function R(e,t){let n=I.createShader(e);return I.shaderSource(n,t),I.compileShader(n),I.getShaderParameter(n,I.COMPILE_STATUS)||console.error(I.getShaderInfoLog(n)),n}var z=I.createProgram();I.attachShader(z,R(I.VERTEX_SHADER,L)),I.attachShader(z,R(I.FRAGMENT_SHADER,ne)),I.linkProgram(z),I.useProgram(z);var re=I.createBuffer();I.bindBuffer(I.ARRAY_BUFFER,re),I.bufferData(I.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),I.STATIC_DRAW);var B=I.getAttribLocation(z,`p`);I.enableVertexAttribArray(B),I.vertexAttribPointer(B,2,I.FLOAT,!1,0,0);var V=e=>I.getUniformLocation(z,e),H={t:V(`uT`),bass:V(`uBass`),mid:V(`uMid`),high:V(`uHigh`),e:V(`uE`),hue:V(`uHue`)};I.uniform1i(V(`uSpec`),0),H.grain=V(`uGrain`),H.c=V(`uC`),H.i=V(`uI`);var U=e=>[1,3,5].map(t=>parseInt(e.slice(t,t+2),16)/255);function W(){I.uniform3fv(H.c,new Float32Array(n.orb.stops.flatMap(U))),I.uniform3fv(H.i,new Float32Array(n.orb.idle.flatMap(U))),I.uniform1f(H.grain,n.orb.grain)}W(),i((e,t)=>{t===`bg`?N():t===`orb`?W():t===`links`&&(C&&!e.links.some(e=>e.id===C)&&D(),k())}),ee();var G=256,K=new Uint8Array(G),q=I.createTexture();I.bindTexture(I.TEXTURE_2D,q),I.texParameteri(I.TEXTURE_2D,I.TEXTURE_MIN_FILTER,I.LINEAR),I.texParameteri(I.TEXTURE_2D,I.TEXTURE_MAG_FILTER,I.LINEAR),I.texParameteri(I.TEXTURE_2D,I.TEXTURE_WRAP_S,I.CLAMP_TO_EDGE),I.texParameteri(I.TEXTURE_2D,I.TEXTURE_WRAP_T,I.CLAMP_TO_EDGE),I.pixelStorei(I.UNPACK_ALIGNMENT,1);var J=()=>{P.width=P.height=Math.round(P.clientWidth*F),I.viewport(0,0,P.width,P.height)};new ResizeObserver(J).observe(P),J();var Y={bass:0,mid:0,high:0,e:0,hue:.5},X=0,Z=performance.now(),Q=(e,t,n)=>{let r=0;for(let i=t;i<n;i++)r+=e[i];return r/(n-t)/255};function $(e){let t=Math.min((e-Z)/1e3,.1);Z=e;let n=0,r=0,i=0;if(y&&x){y.getByteFrequencyData(S),n=Q(S,1,6),r=Q(S,6,40),i=Q(S,40,200);for(let e=0;e<G;e++)K[e]=S[Math.min(S.length-1,Math.floor((e/G)**2*300))]}else K.fill(0);let a=(n+r+i)/3,o=(e,n,r,i)=>e+(n-e)*(1-Math.exp(-t*(n>e?r:i)));Y.bass=o(Y.bass,n,30,5),Y.mid=o(Y.mid,r,30,5),Y.high=o(Y.high,i,30,6),Y.e=o(Y.e,x?Math.max(a,.12):0,12,2.5),Y.hue=o(Y.hue,w,3,3),X+=t*(.3+Y.e*5+Y.bass*4),I.bindTexture(I.TEXTURE_2D,q),I.texImage2D(I.TEXTURE_2D,0,I.LUMINANCE,G,1,0,I.LUMINANCE,I.UNSIGNED_BYTE,K),I.uniform1f(H.t,X),I.uniform1f(H.bass,Y.bass),I.uniform1f(H.mid,Y.mid),I.uniform1f(H.high,Y.high),I.uniform1f(H.e,Y.e),I.uniform1f(H.hue,Y.hue),I.drawArrays(I.TRIANGLE_STRIP,0,4),requestAnimationFrame($)}requestAnimationFrame($);