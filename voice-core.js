/* AngebotsPilot v11.32.10 – Shared Voice Core
   Recording stays local/private until the user sends it. AI calls are server-side only
   and remain disabled until the server integration is explicitly enabled. */
(function(){
  'use strict';

  const BUCKET='company-files';
  const LANGUAGES={de:'Deutsch',en:'English',pl:'Polski',ro:'Română',hr:'Hrvatski',bs:'Bosanski',sr:'Srpski',fr:'Français',it:'Italiano',tr:'Türkçe'};
  const PREF_DEFAULTS={preferred_language:'de',auto_translate_voice:false,voice_transcript_enabled:false,voice_ai_consent_at:null};
  let statusCache=null,statusAt=0,prefsCache=null,prefsKey='';

  const cloud=()=>globalThis.getCloudState?.()||globalThis.APCloudContext?.()||{};
  const uuid=()=>globalThis.crypto?.randomUUID?.()||('v_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
  const safeName=(name='audio')=>String(name).replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-100)||'audio';
  const cleanLang=(value,fallback='de')=>{const x=String(value||'').trim().toLowerCase().split('-')[0];return LANGUAGES[x]?x:fallback};
  const langLabel=code=>LANGUAGES[cleanLang(code,code)]||String(code||'');
  const fmtDuration=seconds=>{seconds=Math.max(0,Math.round(Number(seconds)||0));const m=Math.floor(seconds/60),s=seconds%60;return `${m}:${String(s).padStart(2,'0')}`};

  async function status(force=false){
    const {client,company}=cloud();
    if(!client||!company)return{enabled:false,error:'cloud_required',supported_languages:Object.keys(LANGUAGES),max_audio_seconds:180,max_voice_file_bytes:8*1024*1024};
    if(!force&&statusCache&&Date.now()-statusAt<60000)return statusCache;
    try{
      const {data,error}=await client.functions.invoke('voice-ai',{body:{action:'status',company_id:company.id}});
      if(error)throw error;
      statusCache={enabled:false,supported_languages:Object.keys(LANGUAGES),max_audio_seconds:180,max_voice_file_bytes:8*1024*1024,...(data||{})};
    }catch(e){
      console.warn('Voice AI status',e);
      statusCache={enabled:false,error:'status_unavailable',supported_languages:Object.keys(LANGUAGES),max_audio_seconds:180,max_voice_file_bytes:8*1024*1024};
    }
    statusAt=Date.now();return statusCache;
  }

  async function preferences(force=false){
    const {client,company,session}=cloud();
    if(!client||!company||!session?.user)return{...PREF_DEFAULTS};
    const key=`${company.id}:${session.user.id}`;
    if(!force&&prefsCache&&prefsKey===key)return{...prefsCache};
    try{
      const {data,error}=await client.from('user_preferences')
        .select('preferred_language,auto_translate_voice,voice_transcript_enabled,voice_ai_consent_at')
        .eq('company_id',company.id).eq('user_id',session.user.id).maybeSingle();
      if(error)throw error;
      prefsCache={...PREF_DEFAULTS,...(data||{}),preferred_language:cleanLang(data?.preferred_language||'de')};
    }catch(e){
      console.warn('Voice preferences',e);prefsCache={...PREF_DEFAULTS};
    }
    prefsKey=key;return{...prefsCache};
  }

  async function savePreferences(patch={}){
    const {client,company,session}=cloud();
    if(!client||!company||!session?.user)throw new Error('Cloud ist nicht verbunden.');
    const current=await preferences();
    const row={
      company_id:company.id,user_id:session.user.id,
      preferred_language:cleanLang(patch.preferred_language??current.preferred_language),
      auto_translate_voice:patch.auto_translate_voice??current.auto_translate_voice,
      voice_transcript_enabled:patch.voice_transcript_enabled??current.voice_transcript_enabled,
      voice_ai_consent_at:patch.voice_ai_consent_at===undefined?current.voice_ai_consent_at:patch.voice_ai_consent_at,
      updated_at:new Date().toISOString()
    };
    const {error}=await client.from('user_preferences').upsert(row,{onConflict:'company_id,user_id'});
    if(error)throw error;
    prefsCache={...current,...row};prefsKey=`${company.id}:${session.user.id}`;
    if(patch.preferred_language!==undefined&&globalThis.API18n?.language?.()!==row.preferred_language){
      globalThis.API18n?.setLanguage?.(row.preferred_language,{persist:false});
    }
    globalThis.JobChat?.syncVoicePreferenceUI?.();
    globalThis.OfferVoice?.syncVoicePreferenceUI?.();
    return{...prefsCache};
  }

  async function ensureConsent(){
    const cfg=await status();
    if(!cfg.enabled){globalThis.toast?.('KI-Sprachfunktionen sind vorbereitet, aber noch nicht aktiviert.');return false}
    const prefs=await preferences(true);
    if(prefs.voice_ai_consent_at)return true;
    const ok=await globalThis.appConfirm?.({
      title:'Sprach-KI aktivieren?',
      text:'Für Transkription und Übersetzung wird die ausgewählte Sprachaufnahme bzw. der Nachrichtentext serverseitig an OpenAI übertragen. Original-Audio und Originaltext bleiben erhalten; KI-Ergebnisse werden getrennt angezeigt und nicht ungeprüft in Angebote übernommen.',
      confirmLabel:'Einmalig erlauben',
      icon:'🎙️'
    });
    if(!ok)return false;
    await savePreferences({voice_ai_consent_at:new Date().toISOString()});
    return true;
  }

  async function invoke(action,body={}){
    const {client,company}=cloud();
    if(!client||!company)throw new Error('Cloud ist nicht verbunden.');
    const {data,error}=await client.functions.invoke('voice-ai',{body:{...body,action,company_id:company.id}});
    if(error){
      const message=error?.context?.message||error?.message||'Sprach-KI konnte nicht erreicht werden.';
      const ex=new Error(message);ex.code=data?.error||'';throw ex;
    }
    if(data?.error){const ex=new Error(data.message||data.error);ex.code=data.error;throw ex}
    return data||{};
  }

  function supportedMime(){
    if(!globalThis.MediaRecorder)return'';
    const candidates=['audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];
    return candidates.find(x=>{try{return MediaRecorder.isTypeSupported?.(x)}catch{return false}})||'';
  }
  function extensionFor(mime=''){
    const m=String(mime).toLowerCase();
    if(m.includes('webm'))return'webm';if(m.includes('ogg'))return'ogg';if(m.includes('wav'))return'wav';if(m.includes('mpeg'))return'mp3';return'm4a';
  }

  async function startRecorder({maxSeconds=180,onTick=null,onAutoStop=null}={}){
    if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder)throw new Error('Sprachaufnahme wird auf diesem Gerät/Browser nicht unterstützt.');
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    const mime=supportedMime();
    let recorder;
    try{recorder=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:64000}:{audioBitsPerSecond:64000})}
    catch{recorder=new MediaRecorder(stream)}
    const chunks=[];let settled=false;const started=performance.now();let interval=null,autoTimer=null;
    let resolveResult,rejectResult;
    const resultPromise=new Promise((res,rej)=>{resolveResult=res;rejectResult=rej});
    const cleanup=()=>{if(interval)clearInterval(interval);if(autoTimer)clearTimeout(autoTimer);stream.getTracks().forEach(t=>{try{t.stop()}catch{}})};
    recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
    recorder.onerror=e=>{if(settled)return;settled=true;cleanup();rejectResult(e.error||new Error('Aufnahme fehlgeschlagen.'))};
    recorder.onstop=()=>{
      if(settled)return;settled=true;cleanup();
      const durationSeconds=Math.max(.1,(performance.now()-started)/1000);
      const finalMime=recorder.mimeType||mime||chunks[0]?.type||'audio/mp4';
      const blob=new Blob(chunks,{type:finalMime});
      resolveResult({blob,durationSeconds,mimeType:finalMime,fileName:`sprachmemo-${new Date().toISOString().replace(/[:.]/g,'-')}.${extensionFor(finalMime)}`});
    };
    recorder.start(250);
    interval=setInterval(()=>{const seconds=(performance.now()-started)/1000;try{onTick?.(seconds)}catch{}},250);
    autoTimer=setTimeout(()=>{if(recorder.state!=='inactive'){try{onAutoStop?.()}catch{};recorder.stop()}},Math.max(1,Number(maxSeconds)||180)*1000);
    return{
      stop:()=>{if(recorder.state!=='inactive')recorder.stop();return resultPromise},
      cancel:()=>{if(recorder.state!=='inactive')recorder.stop();return resultPromise.then(r=>({...r,cancelled:true}))},
      state:()=>recorder.state,
      result:resultPromise
    };
  }

  async function upload(path,blob){
    const {client}=cloud();if(!client)throw new Error('Cloud ist nicht verbunden.');
    const contentType=String(blob.type||'application/octet-stream').split(';')[0].trim()||'application/octet-stream';
    const {error}=await client.storage.from(BUCKET).upload(path,blob,{contentType,upsert:false,cacheControl:'3600'});
    if(error)throw error;return path;
  }
  async function remove(path){
    const {client}=cloud();if(!client||!path)return false;
    const {error}=await client.storage.from(BUCKET).remove([path]);if(error)throw error;return true;
  }
  async function signedUrl(path,seconds=3600){
    const {client}=cloud();if(!client||!path)return'';
    const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,seconds);if(error)throw error;return data?.signedUrl||'';
  }

  globalThis.APVoice={LANGUAGES,cloud,uuid,safeName,cleanLang,langLabel,fmtDuration,status,preferences,savePreferences,ensureConsent,invoke,startRecorder,upload,remove,signedUrl,extensionFor};
})();
