/* AngebotsPilot v11.1 – Auth, Betrieb, Pflicht-Login und Cloud-Handoff */
(function(){
  'use strict';
  let client=null,session=null,cloudCompany=null,cloudMembership=null;
  const PENDING='angebotspilot_pending_company_v1';
  const q=id=>document.getElementById(id);
  const cfg=()=>globalThis.AP_CLOUD_CONFIG||{};
  const validEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e||'');
  const roleLabel=r=>r==='owner'?'Chef / Inhaber':r==='office'?'Büro':r==='worker'?'Mitarbeiter':r||'–';
  function appRedirectUrl(){return cfg().appUrl||'https://harunxaa-tech.github.io/beautybybellee/'}
  function setEntryError(text=''){const e=q('entryError');if(!e)return;e.textContent=text;e.classList.toggle('hidden',!text)}
  function hideEntryPanels(){['entryLoading','entrySignedOut','entryConfirmEmail','entryCompanySetup','entrySyncing'].forEach(id=>q(id)?.classList.add('hidden'))}
  function showEntry(id){hideEntryPanels();q('entryGate')?.classList.remove('hidden');q(id)?.classList.remove('hidden')}
  function hideGate(){q('entryGate')?.classList.add('hidden');setEntryError('')}
  function pendingData(){try{return JSON.parse(localStorage.getItem(PENDING)||'null')}catch(e){return null}}
  function savePending(x){localStorage.setItem(PENDING,JSON.stringify(x))}
  function msg(text,type='info'){const el=q('cloudMessage');if(!el)return;el.textContent=text;el.classList.remove('hidden','error','success');if(type==='error')el.classList.add('error');if(type==='success')el.classList.add('success')}
  function clearMsg(){q('cloudMessage')?.classList.add('hidden')}
  async function membership(){
    if(!session?.user)return null;
    const {data,error}=await client.from('company_members').select('company_id,role,status').eq('user_id',session.user.id).eq('status','active').limit(1);
    if(error)throw error;return data?.[0]||null;
  }
  async function company(id){const {data,error}=await client.from('companies').select('*').eq('id',id).single();if(error)throw error;return data}
  async function ensureCompany(){
    cloudMembership=await membership();
    if(cloudMembership){cloudCompany=await company(cloudMembership.company_id);return cloudCompany}
    const p=pendingData(),local=globalThis.data?.settings||{};
    const name=(p?.companyName||local.companyName||'').trim(),trade=p?.trade||local.trade||'garden';
    if(!name)return null;
    const {data:id,error}=await client.rpc('create_company',{company_name:name,company_trade:trade});if(error)throw error;
    cloudMembership={company_id:id,role:'owner',status:'active'};cloudCompany=await company(id);
    const address=p?.address||local.address||'',tax=Number(p?.tax??local.tax??0)||0;
    await client.from('companies').update({address,tax_rate:tax,email:session.user.email||'',name,trade}).eq('id',id);
    cloudCompany={...cloudCompany,address,tax_rate:tax,email:session.user.email||''};
    localStorage.removeItem(PENDING);return cloudCompany;
  }
  function syncLocalIdentity(){
    if(!session?.user||!cloudCompany)return;
    const d=globalThis.data;if(!d)return;
    d.meta=d.meta||{};d.meta.cloudCompanyId=cloudCompany.id;d.meta.authUserId=session.user.id;d.meta.storageMode=d.meta.storageMode==='cloud-sync'?'cloud-sync':'local+cloud-account';
    d.settings=d.settings||{};
    d.settings.companyName=cloudCompany.name||d.settings.companyName||'';
    d.settings.trade=cloudCompany.trade||d.settings.trade||'garden';
    d.settings.address=cloudCompany.address||d.settings.address||'';
    d.settings.email=cloudCompany.email||session.user.email||d.settings.email||'';
    d.settings.tax=Number(cloudCompany.tax_rate)||0;
    d.settings.ownerName=session.user.user_metadata?.full_name||d.settings.ownerName||'';
    d.privacy=d.privacy||{};d.privacy.role=cloudMembership?.role||'owner';
    localStorage.setItem('digitaler_handwerker_v3',JSON.stringify(d));
    globalThis.applyRoleUI?.();
  }
  function renderAccount(){
    const logged=!!session?.user,confirmed=!!session?.user?.email_confirmed_at,ready=!!(logged&&confirmed&&cloudCompany&&cloudMembership);
    q('cloudSignedOut')?.classList.toggle('hidden',logged);
    q('cloudSignedIn')?.classList.toggle('hidden',!logged);
    if(logged){
      if(q('cloudAccountEmail'))q('cloudAccountEmail').textContent=session.user.email||'';
      if(q('cloudCompanyName'))q('cloudCompanyName').textContent=ready?cloudCompany.name:(confirmed?'Konto bestätigt':'E-Mail bestätigen');
      if(q('cloudRole'))q('cloudRole').textContent=ready?roleLabel(cloudMembership.role):'Noch offen';
      if(q('cloudConnectionBadge'))q('cloudConnectionBadge').textContent=ready?'VERBUNDEN':confirmed?'KONTO BESTÄTIGT':'BESTÄTIGUNG OFFEN';
      q('cloudCompanySetupCard')?.classList.toggle('hidden',ready||!confirmed);
      const check=(id,done,text)=>{q(id)?.classList.toggle('done',done);if(q(id+'Icon'))q(id+'Icon').textContent=done?'✓':'→';if(q(id+'Text'))q(id+'Text').textContent=text};
      check('cloudCheckAccount',confirmed,confirmed?'E-Mail bestätigt und Login aktiv.':'E-Mail-Bestätigung offen.');
      check('cloudCheckCompany',ready,ready?`${cloudCompany.name} · ${roleLabel(cloudMembership.role)}`:'Betrieb noch einrichten.');
      check('cloudCheckSecurity',ready,ready?'Serverseitiger RLS-Zugriffsschutz aktiv.':'Wird nach der Betriebseinrichtung aktiv.');
    }
    if(q('cloudModeLabel'))q('cloudModeLabel').textContent=ready?'DIGITALER HANDWERKER · CLOUD':logged?'DIGITALER HANDWERKER · KONTO':'DIGITALER HANDWERKER · LOKAL';
    if(q('cloudQuickStatus'))q('cloudQuickStatus').textContent=ready?cloudCompany.name:logged?'Konto einrichten':'Noch nicht verbunden';
    if(q('privacyCloudStatus'))q('privacyCloudStatus').textContent=ready?'Konto & Betrieb verbunden':logged?'Einrichtung offen':'Anmeldung erforderlich';
    globalThis.CloudSync?.renderStatus?.();
  }
  async function refresh(){
    if(!client)return;
    const {data}=await client.auth.getSession();session=data?.session||null;cloudCompany=null;cloudMembership=null;
    if(session){
      try{await ensureCompany()}catch(e){console.error(e)}
      if(cloudCompany&&cloudMembership){syncLocalIdentity();await globalThis.CloudSync?.attach?.(client,session,cloudCompany,cloudMembership)}
    }else globalThis.CloudSync?.detach?.();
    renderAccount();requireCloudEntry();
  }
  globalThis.requireCloudEntry=function(){
    if(localStorage.getItem('dh_onboarding_v8_done')!=='1'){hideGate();return}
    const confirmed=!!session?.user?.email_confirmed_at,ready=!!(confirmed&&cloudCompany&&cloudMembership);
    if(ready){hideGate();globalThis.showScreen?.('today');return}
    q('entryGate')?.classList.remove('hidden');
    setEntryError('');
    if(!session){showEntry('entrySignedOut');return}
    if(!confirmed){showEntry('entryConfirmEmail');return}
    showEntry('entryCompanySetup');
    const p=pendingData(),l=globalThis.data?.settings||{};
    if(q('entrySetupCompany'))q('entrySetupCompany').value=p?.companyName||l.companyName||'';
    if(q('entrySetupTrade'))q('entrySetupTrade').value=p?.trade||l.trade||'garden';
    if(q('entrySetupAddress'))q('entrySetupAddress').value=p?.address||l.address||'';
    if(q('entrySetupTax'))q('entrySetupTax').value=String(p?.tax??l.tax??0);
  };
  globalThis.setEntryAuthMode=function(mode){
    document.querySelectorAll('[data-entry-tab]').forEach(b=>b.classList.toggle('active',b.dataset.entryTab===mode));
    q('entryLoginPanel')?.classList.toggle('hidden',mode!=='login');q('entryRegisterPanel')?.classList.toggle('hidden',mode!=='register');setEntryError('');
    if(mode==='register'){
      const s=globalThis.data?.settings||{};
      if(q('entryRegisterName')&&!q('entryRegisterName').value)q('entryRegisterName').value=s.ownerName||'';
      if(q('entryRegisterCompany')&&!q('entryRegisterCompany').value)q('entryRegisterCompany').value=s.companyName||'';
      if(q('entryRegisterAddress')&&!q('entryRegisterAddress').value)q('entryRegisterAddress').value=s.address||'';
      if(q('entryRegisterTrade'))q('entryRegisterTrade').value=s.trade||'garden';
      if(q('entryRegisterTax'))q('entryRegisterTax').value=String(s.tax||0);
    }
  };
  globalThis.entryShowSignedOut=function(){session=null;showEntry('entrySignedOut')};
  globalThis.entryCloudSignIn=async function(){
    setEntryError('');const email=q('entryLoginEmail')?.value.trim().toLowerCase()||'',password=q('entryLoginPassword')?.value||'';
    if(!validEmail(email))return setEntryError('Bitte eine gültige E-Mail-Adresse eingeben.');
    if(!password)return setEntryError('Bitte dein Passwort eingeben.');
    showEntry('entryLoading');
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error){showEntry('entrySignedOut');return setEntryError(error.message||'Anmeldung fehlgeschlagen.')}
    session=data.session;await refresh();
  };
  globalThis.entryCloudSignUp=async function(){
    setEntryError('');
    const p={name:q('entryRegisterName')?.value.trim()||'',email:q('entryRegisterEmail')?.value.trim().toLowerCase()||'',password:q('entryRegisterPassword')?.value||'',companyName:q('entryRegisterCompany')?.value.trim()||'',trade:q('entryRegisterTrade')?.value||'garden',address:q('entryRegisterAddress')?.value.trim()||'',tax:Number(q('entryRegisterTax')?.value)||0};
    if(!p.name)return setEntryError('Bitte deinen Namen eingeben.');
    if(!validEmail(p.email))return setEntryError('Bitte eine gültige E-Mail-Adresse eingeben.');
    if(p.password.length<6)return setEntryError('Das Passwort muss mindestens 6 Zeichen haben.');
    if(!p.companyName)return setEntryError('Bitte deinen Firmennamen eingeben.');
    if(!p.address)return setEntryError('Bitte die Firmenadresse eingeben.');
    savePending(p);showEntry('entryLoading');
    const {data,error}=await client.auth.signUp({email:p.email,password:p.password,options:{data:{full_name:p.name},emailRedirectTo:appRedirectUrl()}});
    if(error){showEntry('entrySignedOut');setEntryAuthMode('register');return setEntryError(error.message||'Registrierung fehlgeschlagen.')}
    session=data.session||null;
    if(!session){showEntry('entryConfirmEmail');return}
    await refresh();
  };
  globalThis.entryCompleteCompanySetup=async function(){
    const p=pendingData()||{};
    p.companyName=q('entrySetupCompany')?.value.trim()||'';p.trade=q('entrySetupTrade')?.value||'garden';p.address=q('entrySetupAddress')?.value.trim()||'';p.tax=Number(q('entrySetupTax')?.value)||0;p.email=session?.user?.email||p.email||'';
    if(!p.companyName)return setEntryError('Bitte deinen Firmennamen eingeben.');
    if(!p.address)return setEntryError('Bitte die Firmenadresse eingeben.');
    savePending(p);showEntry('entryLoading');
    try{await ensureCompany();syncLocalIdentity();await globalThis.CloudSync?.attach?.(client,session,cloudCompany,cloudMembership);renderAccount();requireCloudEntry()}
    catch(e){console.error(e);showEntry('entryCompanySetup');setEntryError(e.message||'Betrieb konnte nicht angelegt werden.')}
  };

  // Account page compatibility
  globalThis.setCloudAuthMode=function(mode){document.querySelectorAll('[data-cloud-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.cloudAuthTab===mode));q('cloudLoginPanel')?.classList.toggle('hidden',mode!=='login');q('cloudRegisterPanel')?.classList.toggle('hidden',mode!=='register')};
  globalThis.openCloudAccount=function(){clearMsg();globalThis.showScreen?.('cloudAccount');renderAccount()};
  globalThis.cloudSignIn=async function(){const email=q('cloudLoginEmail')?.value.trim().toLowerCase()||'',password=q('cloudLoginPassword')?.value||'';if(!validEmail(email)||!password)return msg('Bitte E-Mail und Passwort prüfen.','error');const {error}=await client.auth.signInWithPassword({email,password});if(error)return msg(error.message,'error');await refresh();msg('✓ Angemeldet','success')};
  globalThis.cloudSignUp=function(){globalThis.requireCloudEntry();globalThis.setEntryAuthMode('register')};
  globalThis.completeCloudCompanySetup=function(){globalThis.requireCloudEntry()};
  globalThis.linkLocalAppToCloud=function(){msg('Die Geräteverknüpfung läuft in v11.1 automatisch.','success')};
  globalThis.cloudRefresh=refresh;
  globalThis.cloudSignOut=async function(){clearMsg();await client.auth.signOut();session=cloudCompany=cloudMembership=null;globalThis.CloudSync?.detach?.();renderAccount();requireCloudEntry()};
  globalThis.getCloudState=()=>({session,company:cloudCompany,membership:cloudMembership,client});

  function start(){
    if(!globalThis.supabase?.createClient)return;
    client=globalThis.supabase.createClient(cfg().url,cfg().publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    client.auth.onAuthStateChange(()=>setTimeout(refresh,0));
    showEntry('entryLoading');refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();