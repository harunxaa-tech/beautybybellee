/* AngebotsPilot v11.0 – Auth + Firmenkonto */
(function(){
  'use strict';
  let client=null;
  let session=null;
  let cloudCompany=null;
  let cloudMembership=null;
  const PENDING_COMPANY_KEY='angebotspilot_pending_company_v1';

  function qs(id){return document.getElementById(id)}
  function msg(text,type='info'){
    const el=qs('cloudMessage');if(!el)return;
    el.textContent=text;el.classList.remove('hidden','error','success');
    if(type==='error')el.classList.add('error');if(type==='success')el.classList.add('success');
  }
  function clearMsg(){qs('cloudMessage')?.classList.add('hidden')}
  function roleLabel(role){return role==='owner'?'Chef / Inhaber':role==='office'?'Büro':role==='worker'?'Mitarbeiter':role||'–'}
  function validEmail(email){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}

  function initClient(){
    const cfg=globalThis.AP_CLOUD_CONFIG;
    if(!cfg||!globalThis.supabase?.createClient)return null;
    client=globalThis.supabase.createClient(cfg.url,cfg.publishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    return client;
  }

  async function getMembership(){
    if(!client||!session?.user)return null;
    const {data:members,error}=await client.from('company_members').select('company_id,role,status').eq('user_id',session.user.id).eq('status','active').limit(1);
    if(error)throw error;
    return members?.[0]||null;
  }
  async function getCompany(companyId){
    const {data,error}=await client.from('companies').select('*').eq('id',companyId).single();
    if(error)throw error;
    return data;
  }
  async function pushLocalCompanyProfile(){
    if(!cloudCompany||!client||!globalThis.data)return;
    const s=globalThis.data.settings||{};
    const payload={
      name:s.companyName||cloudCompany.name,
      trade:s.trade||cloudCompany.trade||'garden',
      address:s.address||'',
      phone:s.phone||'',
      email:s.email||session?.user?.email||'',
      tax_number:s.taxNumber||'',
      vat_id:s.vatId||'',
      iban:s.iban||'',
      bank_name:s.bankName||'',
      tax_rate:Number(s.tax)||0,
      payment_days:(()=>{const m=String(s.paymentTerm||'7').match(/\d+/);return Math.max(0,Math.min(365,Number(m?.[0])||7))})()
    };
    const {error}=await client.from('companies').update(payload).eq('id',cloudCompany.id);
    if(error)throw error;
    cloudCompany={...cloudCompany,...payload};
  }
  async function ensureCompany(){
    cloudMembership=await getMembership();
    if(cloudMembership){
      cloudCompany=await getCompany(cloudMembership.company_id);
      return cloudCompany;
    }
    const pending=JSON.parse(localStorage.getItem(PENDING_COMPANY_KEY)||'null');
    const localSettings=globalThis.data?.settings||{};
    const companyName=(pending?.companyName||localSettings.companyName||'').trim();
    const trade=pending?.trade||localSettings.trade||'garden';
    if(!companyName)return null;

    const {data:companyId,error}=await client.rpc('create_company',{company_name:companyName,company_trade:trade});
    if(error)throw error;
    localStorage.removeItem(PENDING_COMPANY_KEY);
    cloudMembership={company_id:companyId,role:'owner',status:'active'};
    cloudCompany=await getCompany(companyId);
    await pushLocalCompanyProfile();
    return cloudCompany;
  }
  async function refreshAccount(){
    if(!client)return;
    const {data}=await client.auth.getSession();
    session=data?.session||null;
    if(session){
      try{await ensureCompany()}catch(e){console.error(e);msg('Konto ist angemeldet, aber der Betrieb konnte noch nicht geladen werden: '+(e.message||e),'error')}
    }else{
      cloudCompany=null;cloudMembership=null;
    }
    render();
  }
  function render(){
    const out=qs('cloudSignedOut'),inside=qs('cloudSignedIn');
    const mode=qs('cloudModeLabel'),quick=qs('cloudQuickStatus'),privacy=qs('privacyCloudStatus');
    if(session){
      out?.classList.add('hidden');inside?.classList.remove('hidden');
      if(mode)mode.textContent='DIGITALER HANDWERKER · CLOUD-KONTO';
      if(quick)quick.textContent=cloudCompany?cloudCompany.name:'Angemeldet';
      if(privacy)privacy.textContent='Konto verbunden';
      if(qs('cloudAccountEmail'))qs('cloudAccountEmail').textContent=session.user.email||'';
      if(qs('cloudCompanyName'))qs('cloudCompanyName').textContent=cloudCompany?.name||'Betrieb noch einrichten';
      if(qs('cloudRole'))qs('cloudRole').textContent=roleLabel(cloudMembership?.role);
      const linked=globalThis.data?.meta?.cloudCompanyId===cloudCompany?.id&&globalThis.data?.meta?.authUserId===session.user.id;
      qs('cloudLinkedInfo')?.classList.toggle('hidden',!linked);
      if(qs('cloudLinkBtn')){qs('cloudLinkBtn').textContent=linked?'✓ Verknüpft':'Lokale App verknüpfen';qs('cloudLinkBtn').disabled=linked}
      if(cloudMembership?.role&&globalThis.data?.privacy){
        globalThis.data.privacy.role=cloudMembership.role;
        try{globalThis.applyRoleUI?.()}catch(e){}
      }
    }else{
      out?.classList.remove('hidden');inside?.classList.add('hidden');
      if(mode)mode.textContent='DIGITALER HANDWERKER · LOKAL';
      if(quick)quick.textContent='Noch nicht verbunden';
      if(privacy)privacy.textContent='Optional aktivierbar';
    }
  }

  globalThis.setCloudAuthMode=function(mode){
    clearMsg();
    document.querySelectorAll('[data-cloud-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.cloudAuthTab===mode));
    qs('cloudLoginPanel')?.classList.toggle('hidden',mode!=='login');
    qs('cloudRegisterPanel')?.classList.toggle('hidden',mode!=='register');
    if(mode==='register'){
      const s=globalThis.data?.settings||{};
      if(qs('cloudRegisterName')&&!qs('cloudRegisterName').value)qs('cloudRegisterName').value=s.ownerName||'';
      if(qs('cloudRegisterCompany')&&!qs('cloudRegisterCompany').value)qs('cloudRegisterCompany').value=s.companyName||'';
      if(qs('cloudRegisterTrade'))qs('cloudRegisterTrade').value=s.trade||'garden';
      if(qs('cloudRegisterEmail')&&!qs('cloudRegisterEmail').value)qs('cloudRegisterEmail').value=s.email||'';
    }
  };
  globalThis.openCloudAccount=function(){clearMsg();globalThis.showScreen?.('cloudAccount');refreshAccount()};
  globalThis.cloudSignUp=async function(){
    clearMsg();
    const name=qs('cloudRegisterName')?.value.trim()||'',email=qs('cloudRegisterEmail')?.value.trim().toLowerCase()||'',password=qs('cloudRegisterPassword')?.value||'',companyName=qs('cloudRegisterCompany')?.value.trim()||'',trade=qs('cloudRegisterTrade')?.value||'garden';
    if(!name)return msg('Bitte deinen Namen eingeben.','error');
    if(!validEmail(email))return msg('Bitte eine gültige E-Mail-Adresse eingeben.','error');
    if(password.length<6)return msg('Das Passwort muss mindestens 6 Zeichen haben.','error');
    if(!companyName)return msg('Bitte deinen Firmennamen eingeben.','error');
    localStorage.setItem(PENDING_COMPANY_KEY,JSON.stringify({companyName,trade,name,email}));
    msg('Konto wird erstellt …');
    const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:location.origin+location.pathname}});
    if(error)return msg(error.message||'Registrierung fehlgeschlagen.','error');
    session=data.session||null;
    if(session){
      try{await ensureCompany();await linkLocal(false);render();msg('✓ Konto und Betrieb wurden erstellt.','success')}
      catch(e){msg('Konto erstellt, aber Betrieb konnte noch nicht angelegt werden: '+(e.message||e),'error')}
    }else{
      msg('✓ Konto erstellt. Bitte bestätige jetzt die E-Mail. Danach kannst du dich hier anmelden.','success');
    }
  };
  globalThis.cloudSignIn=async function(){
    clearMsg();
    const email=qs('cloudLoginEmail')?.value.trim().toLowerCase()||'',password=qs('cloudLoginPassword')?.value||'';
    if(!validEmail(email))return msg('Bitte eine gültige E-Mail-Adresse eingeben.','error');
    if(!password)return msg('Bitte dein Passwort eingeben.','error');
    msg('Anmeldung läuft …');
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error)return msg(error.message||'Anmeldung fehlgeschlagen.','error');
    session=data.session;
    try{
      await ensureCompany();
      await linkLocal(false);
      render();
      msg('✓ Erfolgreich angemeldet.','success');
    }catch(e){render();msg('Angemeldet, aber der Betrieb konnte noch nicht vollständig eingerichtet werden: '+(e.message||e),'error')}
  };
  async function linkLocal(showMessage=true){
    if(!session?.user||!cloudCompany||!globalThis.data)return;
    globalThis.data.meta=globalThis.data.meta||{};
    globalThis.data.meta.cloudCompanyId=cloudCompany.id;
    globalThis.data.meta.authUserId=session.user.id;
    globalThis.data.meta.cloudLinkedAt=new Date().toISOString();
    globalThis.data.meta.storageMode='local+cloud-account';
    globalThis.data.meta.cloudReady=true;
    globalThis.AppRepository?.save(globalThis.data,'digitaler_handwerker_v3');
    if(showMessage)msg('✓ Lokale App wurde mit deinem Cloud-Betrieb verknüpft. Geschäftsdaten bleiben bis zur nächsten Migrationsstufe lokal.','success');
    render();
  }
  globalThis.linkLocalAppToCloud=()=>linkLocal(true);
  globalThis.cloudSignOut=async function(){
    clearMsg();await client.auth.signOut();session=null;cloudCompany=null;cloudMembership=null;render();msg('Du bist abgemeldet. Deine lokalen Testdaten bleiben erhalten.','success');
  };
  globalThis.cloudRefresh=refreshAccount;
  globalThis.getCloudState=()=>({session,company:cloudCompany,membership:cloudMembership,client});

  function start(){
    if(!initClient()){
      console.warn('Supabase Client konnte nicht initialisiert werden.');
      return;
    }
    client.auth.onAuthStateChange(()=>setTimeout(refreshAccount,0));
    refreshAccount();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();