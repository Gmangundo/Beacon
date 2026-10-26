window.Stage3D=(()=>{let R,S,C,on=0,buzz=null;const pods={},sprites={};
function tex(e){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.font='96px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(e,64,70);return new THREE.CanvasTexture(c)}
function init(cv){if(on||!window.THREE)return;try{R=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true})}catch(e){return}on=1;
 S=new THREE.Scene();C=new THREE.PerspectiveCamera(40,2,.1,50);C.position.set(0,3.2,10);C.lookAt(0,1.4,0);S.add(new THREE.AmbientLight(0xffffff,.6));
 [['red',-3.4,0xff6b6b],['blue',3.4,0x5aa9ff]].forEach(([k,x,col])=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.9,.5,48),new THREE.MeshStandardMaterial({color:col,metalness:.3,roughness:.4,emissive:col,emissiveIntensity:.15}));m.position.set(x,0,0);S.add(m);const l=new THREE.PointLight(col,1.2,12);l.position.set(x,4,3);S.add(l);pods[k]={m,x}});
 const f=new THREE.Mesh(new THREE.CircleGeometry(9,64),new THREE.MeshStandardMaterial({color:0x131a30,roughness:.8}));f.rotation.x=-Math.PI/2;f.position.y=-.26;S.add(f);
 let mx=0;addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5});
 (function loop(t){requestAnimationFrame(loop);const w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;
  if(cv.width!==Math.floor(w*devicePixelRatio)){R.setPixelRatio(devicePixelRatio);R.setSize(w,h,false);C.aspect=w/h;C.updateProjectionMatrix()}
  const s=t/1000;C.position.x=mx*3;C.lookAt(0,1.4,0);
  for(const id in sprites){const o=sprites[id];o.position.y=1.6+Math.sin(s*1.6+o.userData.i)*.18}
  for(const k in pods){const p=pods[k];p.m.material.emissiveIntensity=buzz===k?.6+Math.sin(s*8)*.3:.15;p.m.rotation.y=s*.2}
  R.render(S,C)})(0)}
function set(P,b){buzz=b;if(!on)return;const seen={};
 ['red','blue'].forEach(k=>{const L=P.filter(p=>p.team===k);L.forEach((p,i)=>{const id=k+p.nickname;seen[id]=1;let o=sprites[id];
  if(!o){o=new THREE.Sprite(new THREE.SpriteMaterial({map:tex(p.emoji),transparent:true}));S.add(o);sprites[id]=o}
  o.userData.i=i*1.3;o.position.x=pods[k].x+(i-(L.length-1)/2)*1.05})});
 for(const id in sprites)if(!seen[id]){S.remove(sprites[id]);delete sprites[id]}}
return{init,set}})();
