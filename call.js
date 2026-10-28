window.Call={api:null,async toggle(box,game,mute){
 if(this.api){this.api.dispose();this.api=null;box.innerHTML='';box.style.cssText='';return}
 box.textContent='Connecting to the call...';
 const{data,error}=await sb.functions.invoke('jaas-token',{body:{game}});
 if(error||!data||!data.jwt){let e=data&&data.error;if(!e&&error&&error.context&&error.context.json){try{e=(await error.context.json()).error}catch(_){}}
  box.textContent=e==='not_player'?'Join a team first, then start the call.':e==='no_jaas'?'The call keys are missing in Supabase.':'Could not start the call. Please try again.';return}
 const go=()=>{box.innerHTML='';box.style.cssText='height:420px;border-radius:20px;overflow:hidden;margin-top:14px';
  this.api=new JitsiMeetExternalAPI('8x8.vc',{roomName:data.appId+'/'+data.room,jwt:data.jwt,parentNode:box,width:'100%',height:'100%',configOverwrite:{startWithVideoMuted:mute,prejoinPageEnabled:false,disableDeepLinking:true}})};
 if(window.JitsiMeetExternalAPI)return go();
 const s=document.createElement('script');s.src='https://8x8.vc/'+data.appId+'/external_api.js';s.onload=go;s.onerror=()=>{box.textContent='Could not load the call. Check your connection.'};document.head.appendChild(s)}};
