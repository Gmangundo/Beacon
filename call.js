window.Call={api:null,toggle(box,room,name,mute){
 if(this.api){this.api.dispose();this.api=null;box.innerHTML='';box.style.cssText='';return}
 const d=window.CALL_DOMAIN||'meet.jit.si';
 const go=()=>{box.innerHTML='';box.style.cssText='height:420px;border-radius:20px;overflow:hidden;margin-top:14px';
  this.api=new JitsiMeetExternalAPI(d,{roomName:'BeaconFeud'+String(room).replace(/-/g,''),parentNode:box,width:'100%',height:'100%',userInfo:{displayName:name},configOverwrite:{startWithVideoMuted:mute,prejoinPageEnabled:false,disableDeepLinking:true}})};
 if(window.JitsiMeetExternalAPI)return go();
 const s=document.createElement('script');s.src='https://'+d+'/external_api.js';s.onload=go;s.onerror=()=>{box.textContent='Could not load the call. Check your connection.'};document.head.appendChild(s)}};
