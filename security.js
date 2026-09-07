/* AngebotsPilot v11.27 – Sicherheitscenter, Passkeys/WebAuthn-Vorbereitung & App-Sperre */
(function(){
  'use strict';

  let client=null, session=null, company=null, membership=null;
  let passkeys=[];
  let autoLockMinutes=15;
  let lastActivityAt=Date.now();
  let lastPersistAt=0;
  let locked=false;
  let activityBound=false;
  let passkeyServerState='unknown'; // enabled | disabled | unknown
  let authSubscription=null;

  const q=id=>document.getElementById(id);
  const APP_URL=()=>globalThis.AP_CLOUD_CONFIG?.appUrl||location.origin+location.pathname;
  const LOCK_KEY=()=>`angebotspilot_last_activity_${session?.user?.id||'anon'}`;
  const webAuthnSupported=()=>!!(window.PublicKeyCredential&&navigator.credentials);
  const isSignedIn=()=>!!session?.user;
  const roleLabel=r=>r==='owner'?'Chef / Inhaber':r==='office'?'Büro':r==='worker'?'Mitarbeiter':r||'–';

  function setText(id,text){const el=q(id);if(el)el.textContent=text}
  function setHidden(id,hidden){const el=q(id);if(!el)return;el.hidden=!!hidden;el.classList.toggle('hidden',!!hidden)}
  function toast(msg){globalThis.toast?.(msg)}
  function cloudMsg(msg,type='info'){
    const gate=q('entryGate');
    if(gate && !gate.hidden && !gate.classList.contains('hidden')){
      const el=q('entryError');
      if(el){
        el.textContent=msg;el.hidden=false;el.classList.remove('hidden','error','success');
        if(type==='error')el.classList.add('error');
        if(type==='success')el.classList.add('success');
        return;
      }
    }
    const el=q('cloudMessage');
    if(!el){toast(msg);return}
    el.textContent=msg;el.classList.remove('hidden','error','success');
    if(type==='error')el.classList.add('error');
    if(type==='success')el.classList.add('success');
  }

  function friendlyPasskeyName(pk){
    return pk?.friendly_name||pk?.friendlyName||'Passkey';
  }
  function fmtDate(v){
    if(!v)return 'noch nicht verwendet';
    try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(v))}catch(e){return '–'}
  }

  async function readPreferences(){
    if(!client||!session?.user||!company?.id)return;
    try{
      const {data,error}=await client.from('user_preferences')
        .select('auto_lock_minutes,security_notice_dismissed')
        .eq('company_id',company.id)
        .eq('user_id',session.user.id)
        .maybeSingle();
      if(error)throw error;
      autoLockMinutes=Number(data?.auto_lock_minutes ?? 15);
      if(![0,5,15,30,60].includes(autoLockMinutes))autoLockMinutes=15;
      const sel=q('securityAutoLock');if(sel)sel.value=String(autoLockMinutes);
    }catch(e){console.warn('Sicherheitseinstellungen konnten nicht geladen werden',e)}
  }

  async function savePreferences(){
    if(!client||!session?.user||!company?.id)return;
    const value=Number(q('securityAutoLock')?.value??autoLockMinutes);
    autoLockMinutes=[0,5,15,30,60].includes(value)?value:15;
    try{
      const {error}=await client.from('user_preferences').upsert({
        company_id:company.id,
        user_id:session.user.id,
        auto_lock_minutes:autoLockMinutes,
        updated_at:new Date().toISOString()
      },{onConflict:'company_id,user_id'});
      if(error)throw error;
      touchActivity(true);
      renderSecurity();
      toast(autoLockMinutes?`Automatische Sperre: ${autoLockMinutes} Minuten`:'Automatische Sperre deaktiviert');
    }catch(e){
      console.error(e);
      toast('Sicherheitseinstellung konnte nicht gespeichert werden.');
    }
  }

  async function probePasskeys(){
    passkeys=[];
    if(!client||!session?.user||!webAuthnSupported()){
      passkeyServerState=webAuthnSupported()?'unknown':'disabled';
      renderSecurity();
      return;
    }
    try{
      if(!client.auth?.passkey?.list){
        passkeyServerState='disabled';
        renderSecurity();
        return;
      }
      const {data,error}=await client.auth.passkey.list();
      if(error)throw error;
      passkeys=Array.isArray(data)?data:(data?.passkeys||[]);
      passkeyServerState='enabled';
    }catch(e){
      const code=e?.code||e?.name||'';
      if(code==='passkey_disabled'||String(e?.message||'').toLowerCase().includes('passkey')) passkeyServerState='disabled';
      else passkeyServerState='unknown';
      console.warn('Passkey-Status',e);
    }
    renderSecurity();
  }

  function renderPasskeyList(){
    const host=q('securityPasskeyList');if(!host)return;
    host.innerHTML='';
    if(!passkeys.length){
      host.innerHTML='<div class="securityEmpty">Noch kein Passkey für dieses Konto hinterlegt.</div>';
      return;
    }
    passkeys.forEach(pk=>{
      const row=document.createElement('div');row.className='securityPasskeyRow';
      const info=document.createElement('div');
      const b=document.createElement('b');b.textContent=friendlyPasskeyName(pk);
      const s=document.createElement('small');s.textContent=`Zuletzt genutzt: ${fmtDate(pk.last_used_at||pk.lastUsedAt)}`;
      info.append(b,s);
      const btn=document.createElement('button');btn.className='btn small danger';btn.textContent='Entfernen';
      btn.onclick=()=>deletePasskey(pk.id);
      row.append(info,btn);host.append(row);
    });
  }

  function passkeyOriginReady(){
    // Passkeys are RP-ID/origin-bound. Do not invite users to enroll/sign in on the temporary GitHub Pages host.
    const host=String(location.hostname||'').toLowerCase();
    return !host.endsWith('github.io');
  }

  function renderSecurity(){
    const supported=webAuthnSupported();
    const originReady=passkeyOriginReady();
    setText('securityDeviceStatus',supported?'Biometrie/Passkeys unterstützt':'Passkeys auf diesem Gerät nicht verfügbar');
    setText('securityPasskeyCount',passkeys.length?`${passkeys.length} aktiv`:passkeyServerState==='disabled'?'vorbereitet':'0 aktiv');
    setText('securitySessionRole',membership?roleLabel(membership.role):'–');
    setText('securityAutoLockStatus',autoLockMinutes?`${autoLockMinutes} Min.`:'Aus');

    const reg=q('securityRegisterPasskey');
    if(reg){
      reg.disabled=!supported||!originReady||passkeyServerState==='disabled';
      reg.textContent=!originReady||passkeyServerState==='disabled'?'🔐 Aktivierung mit finaler App-Domain':passkeys.length?'＋ Weiteren Passkey hinzufügen':'🔐 Face ID / Fingerabdruck aktivieren';
    }

    const info=q('securityPasskeyInfo');
    if(info){
      if(!supported){
        info.textContent='Dieses Gerät bzw. dieser Browser unterstützt WebAuthn nicht.';
      }else if(!originReady||passkeyServerState==='disabled'){
        info.innerHTML='<b>Technik vorbereitet.</b> Die endgültige Passkey-Aktivierung erfolgt erst auf der finalen AngebotsPilot-Domain, damit später keine bereits angelegten Passkeys durch einen Domainwechsel ungültig werden.';
      }else if(passkeys.length){
        info.textContent='Deine Passkeys sind an dein Konto gebunden. Biometrische Daten verlassen dein Gerät nicht.';
      }else{
        info.textContent='Mit einem Passkey kannst du dich künftig per Face ID, Touch ID, Fingerabdruck, Geräte-PIN oder Sicherheitsschlüssel anmelden.';
      }
    }

    document.querySelectorAll('[data-passkey-login]').forEach(btn=>{
      const show=supported&&originReady&&passkeyServerState!=='disabled';
      btn.classList.toggle('hidden',!show);
      btn.hidden=!show;
    });
    renderPasskeyList();
  }

  async function registerPasskey(){
    if(!client||!session?.user)return cloudMsg('Bitte zuerst anmelden.','error');
    if(!webAuthnSupported())return cloudMsg('Dieses Gerät unterstützt Passkeys nicht.','error');
    if(passkeyServerState==='disabled')return cloudMsg('Face ID / Passkeys sind vorbereitet. Wir aktivieren sie mit der endgültigen AngebotsPilot-App-Domain, damit angelegte Passkeys dauerhaft gültig bleiben.','error');
    try{
      const {data,error}=await client.auth.registerPasskey();
      if(error)throw error;
      passkeyServerState='enabled';
      await probePasskeys();
      cloudMsg(`✓ ${friendlyPasskeyName(data)} wurde sicher hinterlegt.`,'success');
    }catch(e){
      console.error(e);
      if(e?.code==='passkey_disabled'||String(e?.message||'').toLowerCase().includes('disabled')){
        passkeyServerState='disabled';renderSecurity();
        cloudMsg('Passkeys sind technisch vorbereitet. Vor der Aktivierung legen wir zuerst die endgültige App-Domain fest, damit deine Passkeys später gültig bleiben.','error');
      }else if(e?.name==='NotAllowedError'){
        cloudMsg('Passkey-Einrichtung wurde abgebrochen.','error');
      }else{
        cloudMsg(e?.message||'Passkey konnte nicht eingerichtet werden.','error');
      }
    }
  }

  async function deletePasskey(id){
    if(!client?.auth?.passkey?.delete||!id)return;
    const ok=await globalThis.appConfirm?.({
      title:'Passkey entfernen?',
      text:'Dieser Passkey kann danach nicht mehr zur Anmeldung verwendet werden. Andere Passkeys und dein Passwort bleiben erhalten.',
      confirmLabel:'Passkey entfernen',icon:'🔐'
    });
    if(!ok)return;
    try{
      const {error}=await client.auth.passkey.delete({passkeyId:id});
      if(error)throw error;
      await probePasskeys();toast('Passkey entfernt.');
    }catch(e){cloudMsg(e?.message||'Passkey konnte nicht entfernt werden.','error')}
  }

  async function signInWithPasskey(source='login'){
    if(!client||!webAuthnSupported())return false;
    try{
      const {data,error}=await client.auth.signInWithPasskey();
      if(error)throw error;
      session=data?.session||session;
      passkeyServerState='enabled';
      unlockApp(false);
      await globalThis.cloudRefresh?.();
      return true;
    }catch(e){
      console.warn('Passkey-Anmeldung fehlgeschlagen',e);
      if(e?.code==='passkey_disabled'||String(e?.message||'').toLowerCase().includes('disabled')){
        passkeyServerState='disabled';renderSecurity();
        const msg='Passkey-Anmeldung ist vorbereitet, wird aber erst mit der finalen App-Domain aktiviert.';
        if(source==='lock')setText('securityLockError',msg); else cloudMsg(msg,'error');
      }else if(e?.name!=='NotAllowedError'){
        const msg=e?.message||'Passkey-Anmeldung nicht möglich.';
        if(source==='lock')setText('securityLockError',msg); else cloudMsg(msg,'error');
      }
      return false;
    }
  }

  async function signOutOthers(){
    if(!client||!session)return;
    const ok=await globalThis.appConfirm?.({
      title:'Andere Geräte abmelden?',
      text:'Alle anderen aktiven Sitzungen werden beendet. Dieses Gerät bleibt angemeldet.',
      confirmLabel:'Andere Geräte abmelden',icon:'🛡️'
    });
    if(!ok)return;
    try{
      const {error}=await client.auth.signOut({scope:'others'});
      if(error)throw error;
      toast('Andere Geräte wurden abgemeldet.');
    }catch(e){cloudMsg(e?.message||'Andere Geräte konnten nicht abgemeldet werden.','error')}
  }

  function touchActivity(force=false){
    if(!isSignedIn()||locked)return;
    const now=Date.now();lastActivityAt=now;
    if(force||now-lastPersistAt>30000){
      try{localStorage.setItem(LOCK_KEY(),String(now))}catch(e){}
      lastPersistAt=now;
    }
  }

  function readLastActivity(){
    try{
      const v=Number(localStorage.getItem(LOCK_KEY())||0);
      return Number.isFinite(v)&&v>0?v:Date.now();
    }catch(e){return Date.now()}
  }

  function shouldLock(){
    if(!isSignedIn()||!autoLockMinutes)return false;
    const elapsed=Date.now()-Math.max(lastActivityAt||0,readLastActivity()||0);
    return elapsed>=autoLockMinutes*60*1000;
  }

  function lockApp(){
    if(locked||!isSignedIn())return;
    locked=true;
    setHidden('securityLockOverlay',false);
    document.documentElement.classList.add('appSecurityLocked');
    setText('securityLockError','');
    const email=session?.user?.email||'';setText('securityLockEmail',email);
    setTimeout(()=>q('securityUnlockPassword')?.focus(),250);
  }

  function unlockApp(markActivity=true){
    locked=false;
    setHidden('securityLockOverlay',true);
    document.documentElement.classList.remove('appSecurityLocked');
    if(q('securityUnlockPassword'))q('securityUnlockPassword').value='';
    setText('securityLockError','');
    if(markActivity)touchActivity(true);
  }

  async function unlockWithPassword(){
    if(!client||!session?.user?.email)return;
    const password=q('securityUnlockPassword')?.value||'';
    if(!password){setText('securityLockError','Bitte dein Passwort eingeben.');return}
    setText('securityLockError','Wird geprüft …');
    try{
      const {data,error}=await client.auth.signInWithPassword({email:session.user.email,password});
      if(error)throw error;
      session=data.session||session;
      unlockApp(true);
    }catch(e){setText('securityLockError','Passwort nicht korrekt.')}
  }

  function checkLock(){if(shouldLock())lockApp()}

  function bindActivity(){
    if(activityBound)return;activityBound=true;
    ['pointerdown','touchstart','keydown','scroll'].forEach(evt=>window.addEventListener(evt,()=>touchActivity(false),{passive:true,capture:true}));
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){touchActivity(true)}else{lastActivityAt=readLastActivity();checkLock()}
    });
    window.addEventListener('focus',()=>{lastActivityAt=readLastActivity();checkLock()});
    setInterval(checkLock,30000);
  }

  async function requestPasswordReset(inputId){
    if(!client)return;
    const email=(q(inputId)?.value||session?.user?.email||'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      if(inputId==='entryLoginEmail'){
        const el=q('entryError');if(el){el.textContent='Bitte zuerst deine E-Mail-Adresse eingeben.';el.hidden=false;el.classList.remove('hidden')}
      }else cloudMsg('Bitte zuerst eine gültige E-Mail-Adresse eingeben.','error');
      return;
    }
    try{
      const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:APP_URL()});
      if(error)throw error;
      if(inputId==='entryLoginEmail'){
        const el=q('entryError');if(el){el.textContent='✓ E-Mail zum Zurücksetzen wurde gesendet.';el.hidden=false;el.classList.remove('hidden')}
      }else cloudMsg('✓ E-Mail zum Zurücksetzen wurde gesendet.','success');
    }catch(e){cloudMsg(e?.message||'E-Mail konnte nicht gesendet werden.','error')}
  }

  function openPasswordChange(recovery=false){
    setHidden('securityPasswordModal',false);
    q('securityPasswordModal')?.classList.add('open');
    setHidden('securityCurrentPasswordWrap',recovery);
    setText('securityPasswordTitle',recovery?'Neues Passwort festlegen':'Passwort ändern');
    setText('securityPasswordError','');
    if(q('securityCurrentPassword'))q('securityCurrentPassword').value='';
    if(q('securityNewPassword'))q('securityNewPassword').value='';
    if(q('securityNewPassword2'))q('securityNewPassword2').value='';
    const modal=q('securityPasswordModal');if(modal)modal.dataset.recovery=recovery?'1':'0';
  }
  function closePasswordChange(){setHidden('securityPasswordModal',true);q('securityPasswordModal')?.classList.remove('open')}

  async function submitPasswordChange(){
    if(!client||!session?.user)return;
    const recovery=q('securityPasswordModal')?.dataset.recovery==='1';
    const current=q('securityCurrentPassword')?.value||'';
    const p1=q('securityNewPassword')?.value||'';
    const p2=q('securityNewPassword2')?.value||'';
    if(p1.length<10)return setText('securityPasswordError','Mindestens 10 Zeichen verwenden.');
    if(p1!==p2)return setText('securityPasswordError','Die neuen Passwörter stimmen nicht überein.');
    try{
      setText('securityPasswordError','Wird gespeichert …');
      if(!recovery){
        if(!current)return setText('securityPasswordError','Bitte dein aktuelles Passwort eingeben.');
        const {error:reauthError}=await client.auth.signInWithPassword({email:session.user.email,password:current});
        if(reauthError)throw new Error('Aktuelles Passwort ist nicht korrekt.');
      }
      const {error}=await client.auth.updateUser({password:p1});
      if(error)throw error;
      closePasswordChange();
      toast('Passwort geändert.');
      if(recovery)await globalThis.cloudRefresh?.();
    }catch(e){setText('securityPasswordError',e?.message||'Passwort konnte nicht geändert werden.')}
  }

  function setClient(c){client=c||client;renderSecurity()}

  async function attach(c,s,co,m){
    client=c||client;session=s;company=co;membership=m;
    if(!client||!session?.user){session=null;company=null;membership=null;passkeys=[];renderSecurity();return}
    bindActivity();
    lastActivityAt=readLastActivity();
    await readPreferences();
    await probePasskeys();
    checkLock();

    try{authSubscription?.data?.subscription?.unsubscribe?.()}catch(e){}
    try{
      authSubscription=client.auth.onAuthStateChange((event,newSession)=>{
        if(newSession)session=newSession;
        if(event==='PASSWORD_RECOVERY')setTimeout(()=>openPasswordChange(true),120);
        if(event==='SIGNED_OUT')detach();
      });
    }catch(e){}
  }

  function detach(){
    session=null;company=null;membership=null;passkeys=[];passkeyServerState='unknown';
    unlockApp(false);renderSecurity();
  }

  // Public API / onclick handlers
  globalThis.SecurityCenter={setClient,attach,detach,render:renderSecurity,checkLock};
  globalThis.securitySaveAutoLock=savePreferences;
  globalThis.securityRegisterPasskey=registerPasskey;
  globalThis.securitySignInWithPasskey=()=>signInWithPasskey('login');
  globalThis.securityUnlockWithPasskey=()=>signInWithPasskey('lock');
  globalThis.securityUnlockWithPassword=unlockWithPassword;
  globalThis.securitySignOutOthers=signOutOthers;
  globalThis.securityRequestPasswordReset=requestPasswordReset;
  globalThis.securityOpenPasswordChange=()=>openPasswordChange(false);
  globalThis.securityOpenPasswordRecovery=()=>openPasswordChange(true);
  globalThis.securityClosePasswordChange=closePasswordChange;
  globalThis.securitySubmitPasswordChange=submitPasswordChange;

  document.addEventListener('DOMContentLoaded',()=>{renderSecurity();bindActivity()},{once:true});
})();
