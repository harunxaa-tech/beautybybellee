/* AngebotsPilot v11.1.1 – klarer Konto-Wizard, echter Ein-Schritt-Zustand */
(function(){
  'use strict';

  let client=null,session=null,cloudCompany=null,cloudMembership=null;
  let refreshPromise=null;
  let signupDraft={};

  const PENDING='angebotspilot_pending_company_v1';
  const INVITE_KEY='angebotspilot_pending_invite_v1';
  let blockingInviteError='';
  let inviteConflictInfo=null;
  let invitePreview=null;
  let inviteFromCurrentUrl=false;
  const q=id=>document.getElementById(id);
  const cfg=()=>globalThis.AP_CLOUD_CONFIG||{};
  const validEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e||'');
  const roleLabel=r=>r==='owner'?'Chef / Inhaber':r==='office'?'Büro':r==='worker'?'Mitarbeiter':r||'–';
  const appRedirectUrl=()=>cfg().appUrl||'https://harunxaa-tech.github.io/beautybybellee/';
  const inviteRedirectUrl=()=>{
    try{
      const u=new URL(appRedirectUrl());
      const token=pendingInvite();
      if(token)u.searchParams.set('invite',token);
      return u.toString();
    }catch(e){return appRedirectUrl()}
  };

  function pendingData(){try{return JSON.parse(localStorage.getItem(PENDING)||'null')}catch(e){return null}}
  function savePending(v){localStorage.setItem(PENDING,JSON.stringify(v))}
  function localSettings(){return globalThis.data?.settings||{}}
  function pendingInvite(){return localStorage.getItem(INVITE_KEY)||''}
  function captureInviteFromUrl(){
    try{
      const u=new URL(location.href),token=u.searchParams.get('invite');
      if(token){
        inviteFromCurrentUrl=true;
        localStorage.setItem(INVITE_KEY,token);
        u.searchParams.delete('invite');
        history.replaceState({},'',u.pathname+(u.search||'')+(u.hash||''));
      }
    }catch(e){}
  }
  function recoverInviteFromSessionMetadata(){
    const token=session?.user?.user_metadata?.pending_invite_token||'';
    if(token&&!pendingInvite())localStorage.setItem(INVITE_KEY,token);
  }

  async function loadInvitePreview(){
    const token=pendingInvite();
    invitePreview=null;
    if(!token||!client)return null;
    try{
      const {data,error}=await client.rpc('get_team_invitation_preview',{invite_token:token});
      if(error)throw error;
      if(data?.status==='open'){
        invitePreview=data;
        return data;
      }
    }catch(e){console.warn('Invite preview failed',e)}
    return null;
  }

  function updateInviteUI(){
    const has=!!pendingInvite();
    setHidden(q('entryInviteBanner'),!has);

    if(has&&invitePreview){
      if(q('entryInviteTitle'))q('entryInviteTitle').textContent=`Einladung von ${invitePreview.company_name||'einem Betrieb'}`;
      if(q('entryInviteSubtitle'))q('entryInviteSubtitle').textContent=`${invitePreview.invitee_name||'Teammitglied'} · ${roleLabel(invitePreview.role)}`;
    }else{
      if(q('entryInviteTitle'))q('entryInviteTitle').textContent='Teameinladung erkannt';
      if(q('entryInviteSubtitle'))q('entryInviteSubtitle').textContent='Anmelden oder neues Konto erstellen.';
    }

    const invited=has&&!!invitePreview;
    setHidden(q('entryRegisterNameField'),invited);
    setHidden(q('entryRegisterProgressLabel'),invited);
    setHidden(q('entryRegisterProgressTrack'),invited);

    if(q('entryRegisterHeading'))q('entryRegisterHeading').textContent=invited
      ?`Konto für ${invitePreview.invitee_name||'dich'}`
      :'Erst einmal du.';
    if(q('entryRegisterText'))q('entryRegisterText').textContent=invited
      ?`Du trittst ${invitePreview.company_name||'dem Betrieb'} als ${roleLabel(invitePreview.role)} bei. Trage nur deine eigene E-Mail ein und lege dein Passwort fest.`
      :'Damit dein persönliches Betriebskonto erstellt werden kann.';

    if(invited&&q('entryRegisterName'))q('entryRegisterName').value=invitePreview.invitee_name||'Teammitglied';

    const regBtn=q('entryRegister1')?.querySelector('.entryPrimary');
    if(regBtn)regBtn.textContent=has?'Konto erstellen & Betrieb beitreten':'Weiter →';
  }
  function inviteStatusMessage(result){
    const state=result?.status||'';
    if(state==='wrong_email')return 'Dieser Einladungslink gehört zu einer anderen E-Mail-Adresse. Bitte mit der eingeladenen Adresse anmelden.';
    if(state==='expired')return 'Diese Einladung ist abgelaufen. Bitte den Chef um einen neuen Einladungslink.';
    if(state==='revoked')return 'Diese Einladung wurde zurückgezogen. Bitte den Chef um einen neuen Einladungslink.';
    if(state==='used')return 'Diese Einladung wurde bereits verwendet.';
    if(state==='multiple')return 'Für diese E-Mail liegen mehrere Einladungen vor. Bitte den ursprünglichen Einladungslink erneut öffnen.';
    if(state==='invalid')return 'Diese Einladung ist ungültig. Bitte einen neuen Einladungslink erstellen lassen.';
    return 'Einladung konnte nicht angenommen werden.';
  }

  async function claimInvitation(token=null,replaceEmptyCompany=false){
    const {data,error:rpcError}=await client.rpc('claim_team_invitation',{
      invite_token:token||null,
      replace_empty_company:!!replaceEmptyCompany
    });
    if(rpcError){
      blockingInviteError=rpcError.message||'Einladung konnte nicht angenommen werden.';
      inviteConflictInfo=null;
      return null;
    }

    if(data?.status==='accepted'){
      localStorage.removeItem(INVITE_KEY);
      blockingInviteError='';
      inviteConflictInfo=null;
      invitePreview=null;
      try{await client.auth.updateUser({data:{pending_invite_token:null}})}catch(e){}
      return data;
    }

    if(data?.status==='none')return null;

    if(data?.status==='conflict'){
      inviteConflictInfo=data;
      blockingInviteError='INVITE_COMPANY_CONFLICT';
      return null;
    }

    inviteConflictInfo=null;
    blockingInviteError=inviteStatusMessage(data);
    return null;
  }

  async function acceptPendingInvitation(){
    const token=pendingInvite();
    if(!token||!session?.user?.email_confirmed_at)return null;
    return claimInvitation(token,false);
  }

  async function acceptInvitationByVerifiedEmail(){
    if(!session?.user?.email_confirmed_at)return null;
    return claimInvitation(null,false);
  }

  function setHidden(el,hidden){
    if(!el)return;
    el.hidden=!!hidden;
    el.classList.toggle('hidden',!!hidden);
    if(hidden)el.setAttribute('aria-hidden','true'); else el.removeAttribute('aria-hidden');
  }

  function showStep(id){
    document.querySelectorAll('#entryGate .entryStep').forEach(el=>setHidden(el,true));
    setHidden(q(id),false);
    setHidden(q('entryError'),true);
    q('entryGate')?.classList.remove('hidden');
    q('entryGate')?.removeAttribute('hidden');
    window.scrollTo?.(0,0);
  }

  function hideGate(){
    q('entryGate')?.classList.add('hidden');
    q('entryGate')?.setAttribute('hidden','');
    setHidden(q('entryError'),true);
  }

  function error(text=''){
    const el=q('entryError');if(!el)return;
    el.textContent=text;
    setHidden(el,!text);
  }

  function cloudMsg(text,type='info'){
    const el=q('cloudMessage');if(!el)return;
    el.textContent=text;el.classList.remove('hidden','error','success');
    if(type==='error')el.classList.add('error');
    if(type==='success')el.classList.add('success');
  }
  function clearCloudMsg(){q('cloudMessage')?.classList.add('hidden')}

  async function getMembership(){
    if(!session?.user)return null;
    const {data,error}=await client.from('company_members')
      .select('company_id,role,status')
      .eq('user_id',session.user.id)
      .eq('status','active')
      .limit(1);
    if(error)throw error;
    return data?.[0]||null;
  }

  async function getCompany(id){
    const {data,error}=await client.from('companies').select('*').eq('id',id).single();
    if(error)throw error;
    return data;
  }

  async function ensureExistingCompany(){
    cloudMembership=await getMembership();
    if(!cloudMembership){cloudCompany=null;return null}
    cloudCompany=await getCompany(cloudMembership.company_id);
    return cloudCompany;
  }

  async function createCompanyFromPending(){
    const p=pendingData()||{};
    const sameUser=!!(session?.user?.id&&globalThis.data?.meta?.authUserId===session.user.id);
    const l=sameUser?localSettings():{};
    const companyName=(p.companyName||l.companyName||'').trim();
    const trade=p.trade||l.trade||'garden';
    if(!companyName)throw new Error('Firmenname fehlt.');

    const {data:id,error:rpcError}=await client.rpc('create_company',{
      company_name:companyName,
      company_trade:trade
    });
    if(rpcError)throw rpcError;

    cloudMembership={company_id:id,role:'owner',status:'active'};
    cloudCompany=await getCompany(id);

    const patch={
      name:companyName,
      trade,
      address:p.address||l.address||'',
      tax_rate:Number(p.tax??l.tax??0)||0,
      email:session?.user?.email||p.email||l.email||''
    };
    const {error:updateError}=await client.from('companies').update(patch).eq('id',id);
    if(updateError)throw updateError;
    cloudCompany={...cloudCompany,...patch};
    localStorage.removeItem(PENDING);
    return cloudCompany;
  }

  function syncLocalIdentity(){
    if(!session?.user||!cloudCompany||!globalThis.data)return;
    const d=globalThis.data;
    d.meta=d.meta||{};
    d.meta.cloudCompanyId=cloudCompany.id;
    d.meta.authUserId=session.user.id;
    d.meta.storageMode=d.meta.storageMode==='cloud-sync'?'cloud-sync':'local+cloud-account';
    d.settings=d.settings||{};
    d.settings.companyName=cloudCompany.name||d.settings.companyName||'';
    d.settings.trade=cloudCompany.trade||d.settings.trade||'garden';
    d.settings.address=cloudCompany.address||d.settings.address||'';
    d.settings.email=cloudCompany.email||session.user.email||d.settings.email||'';
    d.settings.tax=Number(cloudCompany.tax_rate)||0;
    d.settings.ownerName=session.user.user_metadata?.full_name||d.settings.ownerName||'';
    d.privacy=d.privacy||{};
    d.privacy.role=cloudMembership?.role||'owner';
    try{
      if(globalThis.safePersistCloudIdentity){
        globalThis.safePersistCloudIdentity(d);
      }else{
        localStorage.setItem('digitaler_handwerker_v3',JSON.stringify(d));
      }
    }catch(e){
      console.warn('Cloud-Identität konnte lokal nicht gespeichert werden',e);
    }
    globalThis.applyRoleUI?.();
    // Bei neuen Konten ist die Firmenadresse erst jetzt sicher verfügbar.
    setTimeout(()=>{
      const place=(d.settings.weatherLocation||d.settings.address||'').trim();
      if(place)globalThis.refreshWeather?.(false);
    },350);
  }

  function renderAccount(){
    const logged=!!session?.user;
    const confirmed=!!session?.user?.email_confirmed_at;
    const ready=!!(logged&&confirmed&&cloudCompany&&cloudMembership);

    setHidden(q('cloudSignedOut'),logged);
    setHidden(q('cloudSignedIn'),!logged);

    if(logged){
      if(q('cloudAccountEmail'))q('cloudAccountEmail').textContent=session.user.email||'';
      if(q('cloudCompanyName'))q('cloudCompanyName').textContent=ready?cloudCompany.name:(confirmed?'Konto bestätigt':'E-Mail bestätigen');
      if(q('cloudRole'))q('cloudRole').textContent=ready?roleLabel(cloudMembership.role):'Noch offen';
      if(q('cloudConnectionBadge'))q('cloudConnectionBadge').textContent=ready?'VERBUNDEN':confirmed?'KONTO BESTÄTIGT':'BESTÄTIGUNG OFFEN';

      setHidden(q('cloudCompanySetupCard'),ready||!confirmed);

      const check=(id,done,text)=>{
        q(id)?.classList.toggle('done',done);
        if(q(id+'Icon'))q(id+'Icon').textContent=done?'✓':'→';
        if(q(id+'Text'))q(id+'Text').textContent=text;
      };
      check('cloudCheckAccount',confirmed,confirmed?'E-Mail bestätigt und Login aktiv.':'E-Mail-Bestätigung offen.');
      check('cloudCheckCompany',ready,ready?`${cloudCompany.name} · ${roleLabel(cloudMembership.role)}`:'Betrieb noch einrichten.');
      check('cloudCheckSecurity',ready,ready?'Serverseitiger RLS-Zugriffsschutz aktiv.':'Wird nach der Betriebseinrichtung aktiv.');
    }

    if(q('cloudModeLabel'))q('cloudModeLabel').textContent=ready?'DIGITALER HANDWERKER · CLOUD':logged?'DIGITALER HANDWERKER · KONTO':'DIGITALER HANDWERKER · LOKAL';
    if(q('cloudQuickStatus'))q('cloudQuickStatus').textContent=ready?cloudCompany.name:logged?'Konto einrichten':'Noch nicht verbunden';
    if(q('privacyCloudStatus'))q('privacyCloudStatus').textContent=ready?'Konto & Betrieb verbunden':logged?'Einrichtung offen':'Anmeldung erforderlich';
    globalThis.CloudSync?.renderStatus?.();
  }

  async function refreshCore(){
    if(!client)return;
    const {data}=await client.auth.getSession();
    session=data?.session||null;
    cloudCompany=null;
    cloudMembership=null;

    if(!session){
      globalThis.CloudSync?.detach?.();
      globalThis.Notifications?.detach?.();
      renderAccount();
      requireEntry();
      return;
    }

    recoverInviteFromSessionMetadata();
    if(pendingInvite()&&!invitePreview)await loadInvitePreview();

    let membership=await getMembership();

    if(membership){
      // Bereits vorhandene aktive Rolle gewinnt immer.
      localStorage.removeItem(INVITE_KEY);
      invitePreview=null;
      blockingInviteError='';
      inviteConflictInfo=null;
      cloudMembership=membership;

      try{
        if(session.user.user_metadata?.pending_invite_token){
          client.auth.updateUser({data:{pending_invite_token:null}}).catch(()=>{});
        }
      }catch(e){}
    }else{
      if(pendingInvite()&&session.user.email_confirmed_at){
        await acceptPendingInvitation();
      }else if(session.user.email_confirmed_at){
        await acceptInvitationByVerifiedEmail();
      }
      membership=await getMembership();
      cloudMembership=membership;
    }

    if(cloudMembership){
      cloudCompany=await getCompany(cloudMembership.company_id);

      // Lokale Browserdaten sind nur Cache. Selbst wenn Safari-Speicher
      // voll/defekt ist, muss das Cloud-Konto geöffnet werden können.
      try{
        globalThis.ensureWorkspaceForCloudAccount?.(
          session.user.id,
          cloudCompany.id,
          cloudMembership.role
        );
      }catch(localError){
        console.error('Lokaler Workspace konnte nicht aktiviert werden',localError);
        globalThis.activateEmergencyCloudWorkspace?.(
          session.user.id,
          cloudCompany.id,
          cloudMembership.role
        );
      }

      try{syncLocalIdentity()}
      catch(identityError){
        console.error('Lokale Cloud-Identität konnte nicht gespeichert werden',identityError);
        if(globalThis.data){
          globalThis.data.privacy=globalThis.data.privacy||{};
          globalThis.data.privacy.role=cloudMembership.role;
          globalThis.data.meta=globalThis.data.meta||{};
          globalThis.data.meta.authUserId=session.user.id;
          globalThis.data.meta.cloudCompanyId=cloudCompany.id;
          globalThis.data.settings=globalThis.data.settings||{};
          globalThis.data.settings.companyName=cloudCompany.name||'';
          globalThis.applyRoleUI?.();
        }
      }

      // WICHTIG: Erst Zugang freigeben, dann Cloud-Sync im Hintergrund.
      renderAccount();
      requireEntry();
      Promise.resolve(globalThis.Notifications?.attach?.(client,session,cloudCompany,cloudMembership)).catch(e=>console.warn('Notifications attach failed',e));

      const startCloudSync=async()=>{
        try{
          await globalThis.CloudSync?.attach?.(client,session,cloudCompany,cloudMembership);
        }catch(firstError){
          console.warn('Erster Cloud-Sync-Versuch fehlgeschlagen – Retry',firstError);
          await new Promise(resolve=>setTimeout(resolve,1200));
          try{
            await globalThis.CloudSync?.attach?.(client,session,cloudCompany,cloudMembership);
          }catch(secondError){
            console.error('Cloud-Sync auch nach Wiederholung fehlgeschlagen',secondError);
            globalThis.toast?.('Cloud-Sync derzeit nicht möglich · später erneut versuchen');
          }
        }
      };
      startCloudSync();
      return;
    }

    renderAccount();
    requireEntry();
  }

  async function refresh(){
    if(refreshPromise)return refreshPromise;
    refreshPromise=refreshCore().catch(async e=>{
      console.error('Cloud refresh failed',e);

      // Niemals auf „Neues Konto erstellen“ zurückwerfen, wenn Supabase
      // bereits eine gültige Session kennt.
      try{
        const {data}=await client.auth.getSession();
        session=data?.session||session||null;
      }catch(ignore){}

      if(localStorage.getItem('dh_onboarding_v8_done')==='1'){
        if(session?.user){
          showStep('entryLoading');
          error('Dein Konto ist angemeldet. Der Betrieb wird erneut geladen …');
          setTimeout(()=>refresh(),900);
        }else{
          showStep('entryChoice');
          error('Verbindung konnte nicht geladen werden. Bitte erneut versuchen.');
        }
      }
    }).finally(()=>{refreshPromise=null});
    return refreshPromise;
  }

  function fillRegistrationDefaults(){
    // Ein bewusst neu gestartetes Konto darf niemals Daten des vorherigen
    // Cloud-/Gerätekontos übernehmen. Nur der aktuelle Wizard-Entwurf zählt.
    const p=pendingInvite()?(pendingData()||{}):signupDraft;
    if(!pendingInvite()&&!Object.keys(signupDraft||{}).length)signupDraft={};
    if(q('entryRegisterName'))q('entryRegisterName').value=signupDraft.name||p?.name||'';
    if(q('entryRegisterEmail'))q('entryRegisterEmail').value=signupDraft.email||p?.email||'';
    if(q('entryRegisterCompany'))q('entryRegisterCompany').value=signupDraft.companyName||'';
    if(q('entryRegisterTrade'))q('entryRegisterTrade').value=signupDraft.trade||'garden';
    if(q('entryRegisterAddress'))q('entryRegisterAddress').value=signupDraft.address||'';
    if(q('entryRegisterTax'))q('entryRegisterTax').value=String(signupDraft.tax??0);
  }

  function fillRecoveryDefaults(){
    const p=pendingData()||{};
    const sameUser=!!(session?.user?.id&&globalThis.data?.meta?.authUserId===session.user.id);
    const s=sameUser?localSettings():{};
    if(q('entrySetupCompany'))q('entrySetupCompany').value=p.companyName||s.companyName||'';
    if(q('entrySetupTrade'))q('entrySetupTrade').value=p.trade||s.trade||'garden';
    if(q('entrySetupAddress'))q('entrySetupAddress').value=p.address||s.address||'';
    if(q('entrySetupTax'))q('entrySetupTax').value=String(p.tax??s.tax??0);
  }

  function requireEntry(){
    updateInviteUI();
    if(localStorage.getItem('dh_onboarding_v8_done')!=='1'){
      hideGate();
      return;
    }

    const confirmed=!!session?.user?.email_confirmed_at;
    const ready=!!(confirmed&&cloudCompany&&cloudMembership);

    // Sobald ein bestätigtes Konto eine aktive Firmenmitgliedschaft hat,
    // wird die App geöffnet. Invite-/Sync-Fehler dürfen das nicht überstimmen.
    if(ready){
      blockingInviteError='';
      inviteConflictInfo=null;
      const gateWasVisible=!q('entryGate')?.classList.contains('hidden');
      hideGate();
      globalThis.applyRoleUI?.();
      if(gateWasVisible || !document.querySelector('.screen.active')){
        globalThis.showScreen?.('today');
      }
      return;
    }

    if(blockingInviteError){
      const repairBtn=q('entryInviteRepairBtn');
      const canRepair=!!inviteConflictInfo?.can_replace_empty_company;
      setHidden(repairBtn,!canRepair);

      if(q('entryInviteErrorTitle'))q('entryInviteErrorTitle').textContent=canRepair?'Einladung reparieren':'Konto prüfen';
      if(q('entryInviteErrorText')){
        if(blockingInviteError==='INVITE_COMPANY_CONFLICT'){
          const current=inviteConflictInfo?.current_company_name||'der versehentlich angelegte Betrieb';
          const target=inviteConflictInfo?.target_company_name||'der eingeladene Betrieb';
          q('entryInviteErrorText').textContent=canRepair
            ?`Dieses Konto hat versehentlich den leeren Betrieb „${current}“ erhalten. Du kannst ihn entfernen und direkt „${target}“ beitreten.`
            :'Dieses Konto gehört bereits zu einem anderen Betrieb. Eine bestehende Firma mit Geschäftsdaten wird niemals automatisch ersetzt.';
        }else{
          q('entryInviteErrorText').textContent=blockingInviteError;
        }
      }
      showStep('entryInviteError');
      return;
    }

    if(!session){
      showStep('entryChoice');
      return;
    }

    if(!confirmed){
      showStep('entryConfirmEmail');
      return;
    }

    fillRecoveryDefaults();
    showStep('entryRecoverCompany1');
  }

  globalThis.requireCloudEntry=requireEntry;
  globalThis.entryShowStep=showStep;

  globalThis.entryGoChoice=function(){
    error('');
    showStep('entryChoice');
  };

  globalThis.entryGoLogin=function(){
    error('');
    showStep('entryLogin');
  };

  globalThis.entryStartRegister=async function(){
    error('');
    signupDraft={};
    if(!pendingInvite())localStorage.removeItem(PENDING);
    if(pendingInvite()&&!invitePreview)await loadInvitePreview();
    fillRegistrationDefaults();
    updateInviteUI();
    showStep('entryRegister1');
  };

  globalThis.entryRegisterNext1=function(){
    error('');
    const invited=!!pendingInvite();
    const name=invited?(invitePreview?.invitee_name||q('entryRegisterName')?.value.trim()||'Teammitglied'):(q('entryRegisterName')?.value.trim()||'');
    const email=q('entryRegisterEmail')?.value.trim().toLowerCase()||'';
    const password=q('entryRegisterPassword')?.value||'';
    if(!invited&&!name)return error('Bitte deinen Namen eingeben.');
    if(!validEmail(email))return error('Bitte eine gültige E-Mail-Adresse eingeben.');
    if(password.length<6)return error('Das Passwort muss mindestens 6 Zeichen haben.');
    signupDraft={...signupDraft,name,email,password};
    if(invited){
      savePending({name,email});
      showStep('entryLoading');
      const inviteToken=pendingInvite();
      client.auth.signUp({
        email,password,
        options:{
          data:{full_name:name,pending_invite_token:inviteToken},
          emailRedirectTo:inviteRedirectUrl()
        }
      }).then(async({data,error:signUpError})=>{
        if(signUpError){
          showStep('entryRegister1');
          error(signUpError.message||'Registrierung fehlgeschlagen.');
          return;
        }
        session=data.session||null;
        if(!session){showStep('entryConfirmEmail');return}
        await refresh();
      });
      return;
    }
    showStep('entryRegister2');
  };

  globalThis.entryRegisterNext2=function(){
    error('');
    const companyName=q('entryRegisterCompany')?.value.trim()||'';
    const trade=q('entryRegisterTrade')?.value||'garden';
    if(!companyName)return error('Bitte deinen Firmennamen eingeben.');
    signupDraft={...signupDraft,companyName,trade};
    showStep('entryRegister3');
  };

  globalThis.entryRegisterSubmit=async function(){
    error('');
    const address=q('entryRegisterAddress')?.value.trim()||'';
    const tax=Number(q('entryRegisterTax')?.value)||0;
    if(!address)return error('Bitte die Firmenadresse eingeben.');
    signupDraft={...signupDraft,address,tax};
    savePending(signupDraft);
    showStep('entryLoading');

    const {data,error:signUpError}=await client.auth.signUp({
      email:signupDraft.email,
      password:signupDraft.password,
      options:{
        data:{full_name:signupDraft.name},
        emailRedirectTo:appRedirectUrl()
      }
    });

    if(signUpError){
      showStep('entryRegister3');
      return error(signUpError.message||'Registrierung fehlgeschlagen.');
    }

    session=data.session||null;
    if(!session){
      showStep('entryConfirmEmail');
      return;
    }

    await refresh();
  };

  globalThis.entryCloudSignIn=async function(){
    error('');
    const email=q('entryLoginEmail')?.value.trim().toLowerCase()||'';
    const password=q('entryLoginPassword')?.value||'';
    if(!validEmail(email))return error('Bitte eine gültige E-Mail-Adresse eingeben.');
    if(!password)return error('Bitte dein Passwort eingeben.');

    showStep('entryLoading');

    const {data,error:loginError}=await client.auth.signInWithPassword({email,password});
    if(loginError){
      showStep('entryLogin');
      return error(loginError.message||'Anmeldung fehlgeschlagen.');
    }

    session=data.session;
    await refresh();
    if(cloudCompany&&cloudMembership)return;
    // Kein falsches „Passwort/Account“-Problem anzeigen. Die Session ist gültig.
    showStep('entryLoading');
    error('Anmeldung erfolgreich. Betrieb wird geladen …');
  };

  globalThis.entryRecoverNext=function(){
    error('');
    const companyName=q('entrySetupCompany')?.value.trim()||'';
    const trade=q('entrySetupTrade')?.value||'garden';
    if(!companyName)return error('Bitte deinen Firmennamen eingeben.');
    const p={...(pendingData()||{}),companyName,trade,email:session?.user?.email||''};
    savePending(p);
    showStep('entryRecoverCompany2');
  };

  globalThis.entryCompleteCompanySetup=async function(){
    error('');
    const p=pendingData()||{};
    p.address=q('entrySetupAddress')?.value.trim()||'';
    p.tax=Number(q('entrySetupTax')?.value)||0;
    p.email=session?.user?.email||p.email||'';
    if(!p.address)return error('Bitte die Firmenadresse eingeben.');
    savePending(p);
    showStep('entryLoading');

    try{
      await createCompanyFromPending();

      // KRITISCH: Ein neu angelegter Betrieb startet IMMER leer.
      // Der alte lokale Betrieb wird vorher unter seinem eigenen Workspace gesichert.
      globalThis.ensureWorkspaceForCloudAccount?.(
        session.user.id,
        cloudCompany.id,
        cloudMembership.role,
        {forceFresh:true}
      );

      syncLocalIdentity();
      await globalThis.CloudSync?.attach?.(client,session,cloudCompany,cloudMembership);
      await globalThis.Notifications?.attach?.(client,session,cloudCompany,cloudMembership);
      renderAccount();
      requireEntry();
    }catch(e){
      console.error(e);
      showStep('entryRecoverCompany2');
      error(e.message||'Betrieb konnte nicht angelegt werden.');
    }
  };

  globalThis.repairEmptyCompanyAndAcceptInvitation=async function(){
    if(!inviteConflictInfo?.can_replace_empty_company)return;
    const current=inviteConflictInfo.current_company_name||'den leeren Betrieb';
    const target=inviteConflictInfo.target_company_name||'den eingeladenen Betrieb';
    const ok=await globalThis.appConfirm?.({
      title:'Leeren Betrieb entfernen?',
      text:`„${current}“ enthält keine Kunden, Angebote, Baustellen oder Rechnungen. Er wird gelöscht und dieses Konto tritt anschließend „${target}“ bei.`,
      confirmLabel:'Löschen & beitreten',
      icon:'👥'
    });
    if(!ok)return;

    showStep('entryLoading');
    const result=await claimInvitation(pendingInvite()||null,true);
    if(result?.status==='accepted'){
      cloudCompany=null;cloudMembership=null;
      await refresh();
      return;
    }
    requireEntry();
  };

  globalThis.inviteSignOutAndRetry=async function(){
    await client.auth.signOut();
    session=cloudCompany=cloudMembership=null;
    blockingInviteError='';
    inviteConflictInfo=null;
    globalThis.CloudSync?.detach?.();
    globalThis.Notifications?.detach?.();
    showStep('entryChoice');
    updateInviteUI();
  };

  globalThis.cancelPendingInvitation=function(){
    localStorage.removeItem(INVITE_KEY);
    blockingInviteError='';
    inviteConflictInfo=null;
    requireEntry();
  };

  // Compatibility with the account page under "Mehr"
  globalThis.setCloudAuthMode=function(mode){
    document.querySelectorAll('[data-cloud-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.cloudAuthTab===mode));
    setHidden(q('cloudLoginPanel'),mode!=='login');
    setHidden(q('cloudRegisterPanel'),mode!=='register');
  };

  globalThis.openCloudAccount=function(){
    clearCloudMsg();
    globalThis.showScreen?.('cloudAccount');
    renderAccount();
  };

  globalThis.cloudSignIn=async function(){
    const email=q('cloudLoginEmail')?.value.trim().toLowerCase()||'';
    const password=q('cloudLoginPassword')?.value||'';
    if(!validEmail(email)||!password)return cloudMsg('Bitte E-Mail und Passwort prüfen.','error');
    const {error:e}=await client.auth.signInWithPassword({email,password});
    if(e)return cloudMsg(e.message,'error');
    await refresh();
    cloudMsg('✓ Angemeldet','success');
  };

  globalThis.cloudSignUp=function(){
    globalThis.showScreen?.('today');
    globalThis.entryStartRegister();
  };

  globalThis.completeCloudCompanySetup=function(){
    fillRecoveryDefaults();
    showStep('entryRecoverCompany1');
  };

  globalThis.linkLocalAppToCloud=function(){
    cloudMsg('Die Geräteverknüpfung läuft automatisch.','success');
  };

  globalThis.cloudRefresh=refresh;

  globalThis.cloudSignOut=async function(){
    clearCloudMsg();
    await client.auth.signOut();
    session=cloudCompany=cloudMembership=null;
    globalThis.CloudSync?.detach?.();
    globalThis.Notifications?.detach?.();
    renderAccount();
    requireEntry();
  };

  globalThis.getCloudState=()=>({session,company:cloudCompany,membership:cloudMembership,client});

  function start(){
    captureInviteFromUrl();
    if(!globalThis.supabase?.createClient)return;
    client=globalThis.supabase.createClient(cfg().url,cfg().publishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });

    client.auth.onAuthStateChange(()=>setTimeout(()=>refresh(),0));

    loadInvitePreview().then(()=>updateInviteUI());

    if(localStorage.getItem('dh_onboarding_v8_done')==='1'){
      showStep('entryLoading');
    }
    refresh();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start,{once:true});
  }else{
    start();
  }
})();