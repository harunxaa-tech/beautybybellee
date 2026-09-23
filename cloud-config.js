/* AngebotsPilot v11.32.8 – zentrale Runtime + Compliance Loader
   Der Publishable Key ist ausdrücklich für Browser-Apps gedacht.
   Keine geheimen Service-Role-Keys gehören jemals in diese Datei. */
globalThis.AP_CLOUD_CONFIG = Object.freeze({
  url: "https://haqztfpixbjqfiollazv.supabase.co",
  publishableKey: "sb_publishable_gpyLnT-j8lcLiIirHAqGUA_zvM7CuNa",
  projectRef: "haqztfpixbjqfiollazv",
  region: "eu-central-1",
  appUrl: "https://harunxaa-tech.github.io/beautybybellee/"
});

(function installAngebotsPilotRuntime(){
  'use strict';

  const VERSION='11.32.8';
  const COMPLIANCE_RUNTIME_VERSION='11.31.31';
  const COMPLIANCE_SERVER_RUNTIME_VERSION='11.31.28';
  const DATA_SAFETY_SRC='./data-safety.js?v=11.32.8';
  const COMPLIANCE_SRC='./compliance-v1131.js?v=11.32.8';
  const COMPLIANCE_HARDENING_SRC='./compliance-v113108.js?v=11.32.8';
  const COMPLIANCE_SERVER_SRC='./compliance-v113128.js?v=11.32.8';
  const COMPLIANCE_ZUGFERD_SRC='./compliance-v113131.js?v=11.32.8';
  const BOOT_KEY='__ANGEBOTSPILOT_RUNTIME_11_32_2__';

  function stampBuild(){
    document.querySelectorAll('[data-app-build]').forEach(el=>{
      if(el.textContent!==VERSION)el.textContent=VERSION;
    });
  }

  if(globalThis[BOOT_KEY]){
    stampBuild();
    globalThis.DataSafety?.refreshCard?.();
    return;
  }
  globalThis[BOOT_KEY]=true;

  globalThis.AP_BUILD_VERSION=VERSION;
  globalThis.APBuild=Object.freeze({
    version:VERSION,
    cacheTag:'angebotspilot-v11-32-0',
    stamp:stampBuild
  });

  let wrappersInstalled=false;
  let settingsObserver=null;
  let refreshTimer=null;


  // v11.31.28: Wetter-/Standort-Einwilligung pro Konto und Gerät dauerhaft merken.
  // Fix: auch direkte Wetterdialoge sichern, die updateConsent bisher umgangen haben.
  // Der Browser/iOS behält seine eigene Systemberechtigung separat; hier speichern wir
  // ausschließlich die bereits vom Nutzer in AngebotsPilot bestätigte Auswahl.
  const DEVICE_PERMISSION_PREFIX='angebotspilot_device_permissions_v1';
  let permissionGuardsInstalled=false;

  function permissionIdentity(userId='',companyId=''){
    let user=String(userId||'').trim(),company=String(companyId||'').trim();
    try{
      const ctx=globalThis.APCloudContext?.();
      user=user||String(ctx?.session?.user?.id||'').trim();
      company=company||String(ctx?.company?.id||'').trim();
    }catch(e){}
    user=user||String(globalThis.data?.meta?.authUserId||'').trim();
    company=company||String(globalThis.data?.meta?.cloudCompanyId||'').trim();
    if(!user||!company)return null;
    return{user,company,key:`${DEVICE_PERMISSION_PREFIX}_${company}_${user}`};
  }

  function readDevicePermissionPrefs(userId='',companyId=''){
    const ident=permissionIdentity(userId,companyId);if(!ident)return null;
    try{
      const raw=localStorage.getItem(ident.key);if(!raw)return null;
      const parsed=JSON.parse(raw);
      return parsed&&typeof parsed==='object'?{...parsed,key:ident.key}:null;
    }catch(e){return null}
  }

  function writeDevicePermissionPrefs(patch={},userId='',companyId=''){
    const ident=permissionIdentity(userId,companyId);if(!ident)return false;
    try{
      let current={};
      try{current=JSON.parse(localStorage.getItem(ident.key)||'{}')||{}}catch(e){}
      const next={
        ...current,
        ...patch,
        version:1,
        companyId:ident.company,
        userId:ident.user,
        savedAt:new Date().toISOString()
      };
      localStorage.setItem(ident.key,JSON.stringify(next));
      return true;
    }catch(e){
      console.warn('Geräte-Einwilligung konnte nicht gespeichert werden',e);
      return false;
    }
  }

  function persistCurrentDevicePermissionPrefs(userId='',companyId=''){
    const c=globalThis.data?.privacy?.consents;
    if(!c)return false;
    return writeDevicePermissionPrefs({weather:!!c.weather,location:!!c.location},userId,companyId);
  }

  function restoreDevicePermissionPrefs(userId='',companyId=''){
    const ident=permissionIdentity(userId,companyId);if(!ident||!globalThis.data)return false;
    globalThis.data.privacy=globalThis.data.privacy||{};
    globalThis.data.privacy.consents=globalThis.data.privacy.consents||{};
    const c=globalThis.data.privacy.consents;
    const stored=readDevicePermissionPrefs(ident.user,ident.company);

    if(stored){
      if(typeof stored.weather==='boolean')c.weather=stored.weather;
      if(typeof stored.location==='boolean')c.location=stored.location;
    }else if(c.weather===true||c.location===true){
      // Migration: eine bereits bestätigte Auswahl aus 11.31.10 einmalig übernehmen.
      writeDevicePermissionPrefs({weather:!!c.weather,location:!!c.location},ident.user,ident.company);
    }else{
      return false;
    }

    try{globalThis.safePersistCloudIdentity?.(globalThis.data)}catch(e){}
    try{globalThis.renderPrivacy?.()}catch(e){}
    return true;
  }

  let cloudPermissionLoadedKey='';
  let cloudPermissionLoadPromise=null;

  function permissionCloudContext(userId='',companyId=''){
    const ident=permissionIdentity(userId,companyId);if(!ident)return null;
    try{
      const ctx=globalThis.APCloudContext?.();
      if(!ctx?.client||!ctx?.session?.user?.id||!ctx?.company?.id)return null;
      if(String(ctx.session.user.id)!==ident.user||String(ctx.company.id)!==ident.company)return null;
      return{...ident,client:ctx.client};
    }catch(e){return null}
  }

  function permissionLocalTimestamp(stored){
    const ms=Date.parse(stored?.savedAt||'');
    return Number.isFinite(ms)?ms:0;
  }

  function permissionCloudTimestamp(row){
    const ms=Date.parse(row?.consent_updated_at||row?.updated_at||'');
    return Number.isFinite(ms)?ms:0;
  }

  async function saveCloudPermissionPrefs(patch={},userId='',companyId=''){
    const ctx=permissionCloudContext(userId,companyId);if(!ctx)return false;
    globalThis.data.privacy=globalThis.data.privacy||{};
    globalThis.data.privacy.consents=globalThis.data.privacy.consents||{};
    const c=globalThis.data.privacy.consents;
    const weather=typeof patch.weather==='boolean'?patch.weather:!!c.weather;
    const location=typeof patch.location==='boolean'?patch.location:!!c.location;
    const now=new Date().toISOString();
    const {error}=await ctx.client.from('user_preferences').upsert({
      company_id:ctx.company,
      user_id:ctx.user,
      weather_consent:weather,
      location_consent:location,
      consent_updated_at:now,
      updated_at:now
    },{onConflict:'company_id,user_id'});
    if(error)throw error;
    writeDevicePermissionPrefs({weather,location},ctx.user,ctx.company);
    cloudPermissionLoadedKey=`${ctx.company}:${ctx.user}`;
    return true;
  }

  async function loadCloudPermissionPrefs(userId='',companyId='',force=false){
    const ctx=permissionCloudContext(userId,companyId);if(!ctx)return false;
    const key=`${ctx.company}:${ctx.user}`;
    if(!force&&cloudPermissionLoadedKey===key)return true;
    if(cloudPermissionLoadPromise)return cloudPermissionLoadPromise;

    cloudPermissionLoadPromise=(async()=>{
      const {data:row,error}=await ctx.client.from('user_preferences')
        .select('weather_consent,location_consent,consent_updated_at,updated_at')
        .eq('company_id',ctx.company).eq('user_id',ctx.user).maybeSingle();
      if(error)throw error;

      globalThis.data.privacy=globalThis.data.privacy||{};
      globalThis.data.privacy.consents=globalThis.data.privacy.consents||{};
      const c=globalThis.data.privacy.consents;
      const local=readDevicePermissionPrefs(ctx.user,ctx.company);
      const localTs=permissionLocalTimestamp(local),cloudTs=permissionCloudTimestamp(row);
      const localHas=local&&(typeof local.weather==='boolean'||typeof local.location==='boolean');
      const cloudHas=row&&(typeof row.weather_consent==='boolean'||typeof row.location_consent==='boolean');

      if(localHas&&localTs>cloudTs){
        if(typeof local.weather==='boolean')c.weather=local.weather;
        if(typeof local.location==='boolean')c.location=local.location;
        await saveCloudPermissionPrefs({weather:!!c.weather,location:!!c.location},ctx.user,ctx.company);
      }else if(cloudHas){
        if(typeof row.weather_consent==='boolean')c.weather=row.weather_consent;
        if(typeof row.location_consent==='boolean')c.location=row.location_consent;
        writeDevicePermissionPrefs({weather:!!c.weather,location:!!c.location},ctx.user,ctx.company);
      }else if(localHas||c.weather===true||c.location===true){
        if(localHas){
          if(typeof local.weather==='boolean')c.weather=local.weather;
          if(typeof local.location==='boolean')c.location=local.location;
        }
        await saveCloudPermissionPrefs({weather:!!c.weather,location:!!c.location},ctx.user,ctx.company);
      }

      cloudPermissionLoadedKey=key;
      try{globalThis.safePersistCloudIdentity?.(globalThis.data)}catch(e){}
      try{globalThis.renderPrivacy?.()}catch(e){}
      return !!(cloudHas||localHas||c.weather===true||c.location===true);
    })().catch(error=>{
      console.warn('Cloud-Einwilligung konnte noch nicht geladen werden',error);
      return false;
    }).finally(()=>{cloudPermissionLoadPromise=null});
    return cloudPermissionLoadPromise;
  }

  async function waitForPermissionCloudContext(timeoutMs=2200){
    const start=Date.now();
    while(Date.now()-start<timeoutMs){
      const ctx=permissionCloudContext();if(ctx)return ctx;
      await new Promise(resolve=>setTimeout(resolve,80));
    }
    return permissionCloudContext();
  }

  async function restoreBestPermissionPrefs({waitForCloud=false}={}){
    restoreDevicePermissionPrefs();
    if(waitForCloud&&!permissionCloudContext())await waitForPermissionCloudContext();
    await loadCloudPermissionPrefs();
    restoreDevicePermissionPrefs();
    return !!globalThis.data?.privacy?.consents?.weather;
  }

  function installPersistentPermissionGuards(){
    restoreDevicePermissionPrefs();

    const consentFn=globalThis.updateConsent;
    if(typeof consentFn==='function'&&!consentFn.__apPersistentPermissions){
      const wrapped=function(type,value){
        const result=consentFn.apply(this,arguments);
        if(type==='weather'||type==='location'){
          writeDevicePermissionPrefs({[type]:!!value});
          // Falls nur eine der beiden Entscheidungen geändert wurde, die andere aus
          // dem aktuellen App-Zustand ebenfalls konsistent festhalten.
          persistCurrentDevicePermissionPrefs();
          saveCloudPermissionPrefs({[type]:!!value}).catch(error=>console.warn('Cloud-Einwilligung konnte noch nicht gespeichert werden',error));
        }
        return result;
      };
      wrapped.__apPersistentPermissions=true;
      wrapped.__apOriginal=consentFn;
      globalThis.updateConsent=wrapped;
    }

    // Auch die Wetterdialoge in refreshWeather/loadWeatherFromForm/useDeviceLocation
    // speichern die Auswahl direkt und umgehen updateConsent. Deshalb sichern wir jede
    // echte Einwilligungsänderung zusätzlich an der gemeinsamen saveData-Stelle.
    const saveFn=globalThis.saveData;
    if(typeof saveFn==='function'&&!saveFn.__apPersistentPermissions){
      const wrapped=function(action,details){
        const result=saveFn.apply(this,arguments);
        if(String(action||'')==='Einwilligung geändert'){
          persistCurrentDevicePermissionPrefs();
          saveCloudPermissionPrefs().catch(error=>console.warn('Cloud-Einwilligung konnte noch nicht gespeichert werden',error));
        }
        return result;
      };
      wrapped.__apPersistentPermissions=true;
      wrapped.__apOriginal=saveFn;
      globalThis.saveData=wrapped;
    }

    for(const name of ['refreshWeather','loadWeatherFromForm','useDeviceLocation']){
      const fn=globalThis[name];
      if(typeof fn!=='function'||fn.__apPersistentPermissions)continue;
      const wrapped=async function(){
        // Nach einem Safari-Neustart im Privatmodus kann localStorage leer sein.
        // Beim automatischen Wetter kurz auf das Cloud-Konto warten und die Entscheidung
        // serverseitig wiederherstellen, bevor irgendein Dialog angezeigt wird.
        const automatic=name==='refreshWeather'&&!arguments[0];
        await restoreBestPermissionPrefs({waitForCloud:automatic});
        try{
          return await fn.apply(this,arguments);
        }finally{
          // Direkte Dialogpfade setzen data.privacy.consents selbst; lokal + Cloud sichern.
          persistCurrentDevicePermissionPrefs();
          saveCloudPermissionPrefs().catch(error=>console.warn('Cloud-Einwilligung konnte noch nicht gespeichert werden',error));
        }
      };
      wrapped.__apPersistentPermissions=true;
      wrapped.__apOriginal=fn;
      globalThis[name]=wrapped;
    }

    const workspaceFn=globalThis.ensureWorkspaceForCloudAccount;
    if(typeof workspaceFn==='function'&&!workspaceFn.__apPersistentPermissions){
      const wrapped=function(userId,companyId){
        // Vor einem Kontowechsel die Auswahl des bisherigen Kontos sichern.
        persistCurrentDevicePermissionPrefs();
        const result=workspaceFn.apply(this,arguments);
        restoreDevicePermissionPrefs(userId,companyId);
        loadCloudPermissionPrefs(userId,companyId,true).catch(error=>console.warn('Cloud-Einwilligung konnte nach Kontowechsel noch nicht geladen werden',error));
        return result;
      };
      wrapped.__apPersistentPermissions=true;
      wrapped.__apOriginal=workspaceFn;
      globalThis.ensureWorkspaceForCloudAccount=wrapped;
    }

    permissionGuardsInstalled=true;
    return true;
  }

  globalThis.APPermissionPrefs={
    version:'11.31.28',
    restore:restoreDevicePermissionPrefs,
    restoreCloud:loadCloudPermissionPrefs,
    persist:persistCurrentDevicePermissionPrefs,
    persistCloud:saveCloudPermissionPrefs,
    state:()=>readDevicePermissionPrefs()
  };

  // v11.31.28: Die Datenmodelle konnten E-Rechnungs-/Kundentyp-Felder bereits speichern,
  // der alte statische Kundeneditor zeigte sie aber noch nicht an. Diese UI wird bewusst
  // kompakt ergänzt: Kundentyp + Land sichtbar, Spezialfelder in einem optionalen Bereich.
  function ensureCustomerComplianceUi(){
    const editor=document.getElementById('customerEditor');
    const card=editor?.querySelector?.('.card');
    if(!editor||!card)return false;
    if(document.getElementById('custCustomerType')&&document.getElementById('custCountryCode'))return true;

    const notes=document.getElementById('custNotes')?.closest?.('.field');
    const save=card.querySelector('button[onclick="saveCustomer()"]');
    const anchor=notes||save;
    if(!anchor)return false;

    const block=document.createElement('div');
    block.id='customerComplianceFields';
    block.className='apCustomerComplianceFields';
    block.innerHTML=`
      <div class="row">
        <div class="field">
          <label>Kundentyp</label>
          <select id="custCustomerType" class="input">
            <option value="auto">Automatisch erkennen</option>
            <option value="private">Privatkunde</option>
            <option value="business">Unternehmen</option>
            <option value="public">Behörde / öffentlich</option>
          </select>
          <small>Wichtig für die passende Rechnungs- und E-Rechnungsart.</small>
        </div>
        <div class="field">
          <label>Land</label>
          <select id="custCountryCode" class="input">
            <option value="DE">Deutschland</option>
            <option value="AT">Österreich</option>
            <option value="CH">Schweiz</option>
          </select>
        </div>
      </div>
      <details class="apCustomerEInvoiceDetails" style="margin:6px 0 18px">
        <summary class="apCustomerEInvoiceSummary" style="cursor:pointer;font-weight:800;padding:14px 15px;border:1px solid rgba(160,180,210,.25);border-radius:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(120,140,170,.08)"><span class="apCustomerEInvoiceSummaryText">🧾 E-Rechnung & Steuerdaten</span><span class="apCustomerEInvoiceSummaryState mini">Bei Bedarf</span></summary>
        <div class="field"><label>USt-ID / UID / MWST-Nr.</label><input class="input" id="custVatId" autocomplete="off" placeholder="z. B. DE123456789"></div>
        <div class="field"><label>Käuferreferenz / Leitweg-ID</label><input class="input" id="custBuyerReference" autocomplete="off" placeholder="Bei Behörden bzw. wenn vom Kunden vorgegeben"><small>Für XRechnung entspricht dies typischerweise der Käuferreferenz (BT-10).</small></div>
        <div class="field"><label>E-Rechnungsadresse</label><input class="input" id="custEInvoiceAddress" autocomplete="off" placeholder="z. B. Leitweg-ID / Peppol-ID"><small>Nur ausfüllen, wenn der Empfänger eine spezielle elektronische Adresse vorgibt.</small></div>
        <div class="field"><label>Lieferantennummer</label><input class="input" id="custSupplierNumber" autocomplete="off" placeholder="Optional / vom Auftraggeber vergeben"></div>
        <label style="display:flex;gap:10px;align-items:flex-start;margin:12px 0 4px">
          <input type="checkbox" id="custEInvoiceRequired" style="margin-top:3px">
          <span><b>E-Rechnung für diesen Kunden erzwingen</b><small style="display:block">Nur aktivieren, wenn der Empfänger ausdrücklich eine strukturierte E-Rechnung verlangt.</small></span>
        </label>
      </details>`;
    anchor.insertAdjacentElement('beforebegin',block);

    const country=document.getElementById('custCountryCode');
    if(country&&!country.value)country.value=globalThis.data?.settings?.countryCode||'DE';
    return true;
  }

  // v11.31.28: Geführte Fehlerbehebung – fehlende Angaben führen direkt zum richtigen Feld und automatisch zum nächsten offenen Punkt.
  let complianceRepairState=null;

  function customerComplianceRequirement(){
    const type=document.getElementById('custCustomerType')?.value||'auto';
    const country=document.getElementById('custCountryCode')?.value||'DE';
    const forced=!!document.getElementById('custEInvoiceRequired')?.checked;
    const required=[];
    let title='🧾 E-Rechnung & Steuerdaten',state='Bei Bedarf',open=false;
    if(type==='public'&&country==='DE'){
      title='🧾 Pflichtangaben für XRechnung';required.push('custBuyerReference','custEInvoiceAddress');state='Pflicht';open=true;
    }else if(type==='public'&&country==='AT'){
      title='🧾 Pflichtangaben für Behördenrechnung';required.push('custBuyerReference','custSupplierNumber','custEInvoiceAddress');state='Pflicht';open=true;
    }else if(type==='public'){
      title='🧾 Angaben für Behördenrechnung';required.push('custBuyerReference');state='Prüfen';open=true;
    }else if(type==='business'){
      state=forced?'E-Rechnung aktiv':'Für E-Rechnung prüfen';open=forced;if(forced)required.push('custEInvoiceAddress');
    }else if(type==='private'){
      title='🧾 Steuer- & E-Rechnungsdaten';state='Nur bei Bedarf';
    }
    return{type,country,forced,required,title,state,open};
  }

  function setComplianceFieldState(id,required,missing){
    const el=document.getElementById(id);if(!el)return;
    const field=el.closest?.('.field')||el.parentElement;
    if(field){
      field.style.borderRadius='12px';field.style.padding=required?'8px':'';field.style.marginLeft=required?'-8px':'';field.style.marginRight=required?'-8px':'';
      field.style.background=missing?'rgba(255,84,84,.08)':required?'rgba(190,220,80,.05)':'';
      const label=field.querySelector?.('label');
      if(label){const clean=String(label.textContent||'').replace(/\s*\*\s*$/,'');label.textContent=required?clean+' *':clean;}
    }
    el.style.outline=missing?'2px solid rgba(255,96,96,.72)':'';el.style.outlineOffset=missing?'2px':'';
  }

  function updateCustomerComplianceUi(){
    if(!ensureCustomerComplianceUi())return;
    const req=customerComplianceRequirement();
    const details=document.querySelector('#customerEditor .apCustomerEInvoiceDetails');
    const summary=details?.querySelector('.apCustomerEInvoiceSummary');
    const text=summary?.querySelector('.apCustomerEInvoiceSummaryText');
    const badge=summary?.querySelector('.apCustomerEInvoiceSummaryState');
    const missing=req.required.filter(id=>!String(document.getElementById(id)?.value||'').trim());
    if(text)text.textContent=req.title;
    if(badge){
      badge.textContent=missing.length?`${missing.length} Angabe${missing.length===1?'':'n'} fehlt${missing.length===1?'':'en'}`:(req.required.length?'✓ vollständig':req.state);
      badge.style.fontWeight='800';badge.style.color=missing.length?'#ffaaaa':req.required.length?'#d8ff62':'';
    }
    if(summary){
      summary.style.borderColor=missing.length?'rgba(255,96,96,.55)':req.required.length?'rgba(200,255,70,.35)':'rgba(160,180,210,.25)';
      summary.style.background=missing.length?'rgba(255,84,84,.07)':req.required.length?'rgba(190,220,80,.06)':'rgba(120,140,170,.08)';
    }
    if(details&&(req.open||missing.length||details.dataset.apForceOpen==='1'))details.open=true;
    ['custVatId','custBuyerReference','custEInvoiceAddress','custSupplierNumber'].forEach(id=>{
      const required=req.required.includes(id);setComplianceFieldState(id,required,required&&!String(document.getElementById(id)?.value||'').trim());
    });
  }

  function bindCustomerComplianceUi(){
    if(!ensureCustomerComplianceUi())return;
    ['custCustomerType','custCountryCode','custVatId','custBuyerReference','custEInvoiceAddress','custSupplierNumber','custEInvoiceRequired'].forEach(id=>{
      const el=document.getElementById(id);if(!el||el.dataset.apComplianceBound==='1')return;
      el.dataset.apComplianceBound='1';el.addEventListener('change',updateCustomerComplianceUi);el.addEventListener('input',updateCustomerComplianceUi);
    });
    updateCustomerComplianceUi();
  }

  function companyReadiness(){
    const get=id=>String(document.getElementById(id)?.value??'').trim();
    const address=[get('companyStreet'),get('companyHouseNumber')].filter(Boolean).join(' ') + ((get('companyPostalCode')||get('companyCity'))?`, ${[get('companyPostalCode'),get('companyCity')].filter(Boolean).join(' ')}`:'');
    const resolvedAddress=address.trim()||String(globalThis.data?.settings?.address||'').trim();
    const email=get('companyEmail')||String(globalThis.data?.settings?.email||'').trim();
    const iban=(get('iban')||String(globalThis.data?.settings?.iban||'')).replace(/\s+/g,'').toUpperCase();
    const country=document.getElementById('companyCountry')?.value||globalThis.data?.settings?.countryCode||'DE';
    const taxNumber=get('taxNumber')||String(globalThis.data?.settings?.taxNumber||'').trim();
    const vatId=get('vatId')||String(globalThis.data?.settings?.vatId||'').trim();
    const missing=[];
    let addressOk=false;
    try{const parsed=globalThis.APCompliance?.parseAddress?.(resolvedAddress,country);addressOk=!!(parsed?.street&&parsed?.postalCode&&parsed?.city)}catch(e){}
    if(!addressOk)addressOk=/\d{4,5}\s+\S+/.test(resolvedAddress)&&resolvedAddress.length>=8;
    if(!addressOk)missing.push({id:'companyStreet',label:'vollständige Firmenadresse'});
    if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))missing.push({id:'companyEmail',label:'Firmen-E-Mail'});
    const ibanOk=typeof globalThis.APCompliance?.ibanIsValid==='function'
      ?globalThis.APCompliance.ibanIsValid(iban,country)
      :((String(country).toUpperCase()==='DE'&&/^DE\d{20}$/.test(iban))||(String(country).toUpperCase()==='AT'&&/^AT\d{18}$/.test(iban))||(String(country).toUpperCase()==='CH'&&/^CH[A-Z0-9]{19}$/.test(iban)));
    if(!ibanOk)missing.push({id:'iban',label:'gültige IBAN'});
    if(String(country).toUpperCase()==='DE'&&!taxNumber&&!vatId)missing.push({id:'taxNumber',label:'Steuernummer oder USt-ID'});
    return{missing};
  }

  function complianceGuidance(target){
    const id=target?.id||'';
    const map={
      companyStreet:{
        title:'Vollständige Firmenadresse fehlt',
        text:'Für die XRechnung braucht AngebotsPilot hier Straße, Hausnummer, PLZ und Ort – z. B. „Musterstraße 12, 85579 Neubiberg“. Der Wetter-Standort kann weiterhin nur „München“ sein.'
      },
      companyEmail:{
        title:'Firmen-E-Mail ergänzen',
        text:'Trage hier eine gültige E-Mail-Adresse deines Betriebs ein. Sie wird als Kontaktangabe der Rechnung verwendet.'
      },
      iban:{
        title:'IBAN ergänzen',
        text:'Für eine zahlbare strukturierte E-Rechnung muss ein plausibles Zahlungskonto hinterlegt sein. Trage hier deine echte Geschäfts-IBAN ein.'
      },
      taxNumber:{
        title:'Steuernummer oder USt-ID ergänzen',
        text:'Für diese XRechnung verlangt EN16931 bei steuerbefreiten/Kleinunternehmer-Positionen mindestens eine steuerliche Verkäuferkennung. Trage hier deine echte Steuernummer ein – alternativ genügt eine vorhandene USt-ID im entsprechenden Feld.'
      },
      vatId:{
        title:'USt-ID / UID ergänzen',
        text:'Trage hier die für dein Land gültige Umsatzsteuer-/UID-Nummer ein.'
      },
      custBuyerReference:{
        title:'Käuferreferenz / Leitweg-ID fehlt',
        text:'Bei einer deutschen Behördenrechnung wird hier normalerweise die vom Auftraggeber mitgeteilte Leitweg-ID bzw. Käuferreferenz eingetragen.'
      },
      custEInvoiceAddress:{
        title:'E-Rechnungsadresse fehlt',
        text:'Trage die elektronische Adresse ein, die dir der Empfänger für die E-Rechnung vorgegeben hat, z. B. Leitweg-ID oder Peppol-ID.'
      },
      custSupplierNumber:{
        title:'Lieferantennummer fehlt',
        text:'Wenn der öffentliche Auftraggeber dir eine Lieferantennummer zugeteilt hat, trage sie hier ein.'
      },
      custVatId:{
        title:'USt-ID / UID des Kunden fehlt',
        text:'Trage die vom Kunden angegebene Umsatzsteuer-/UID-Nummer ein.'
      },
      custStreet:{
        title:'Kundenadresse unvollständig',
        text:'Für die strukturierte Rechnung braucht die Kundenadresse Straße, Hausnummer, PLZ und Ort.'
      },
      invoiceServiceDate:{
        title:'Leistungsdatum fehlt',
        text:'Trage das Datum ein, an dem die Leistung ausgeführt oder abgeschlossen wurde.'
      },
      invoiceDueDate:{
        title:'Fälligkeit fehlt',
        text:'Lege fest, bis wann die Rechnung bezahlt werden soll.'
      },
      invoiceSubject:{
        title:'Betreff fehlt',
        text:'Gib der Rechnung einen kurzen eindeutigen Betreff.'
      }
    };
    return map[id]||{
      title:'Diese Angabe fehlt noch',
      text:target?.message||'Bitte ergänze oder korrigiere dieses Feld. AngebotsPilot prüft danach automatisch erneut.'
    };
  }

  function clearComplianceGuidance(){
    document.querySelectorAll('.apComplianceGuidance').forEach(el=>el.remove());
  }

  function showComplianceGuidance(target,position=0,total=0){
    const el=document.getElementById(target?.id||'');if(!el)return false;
    clearComplianceGuidance();
    const g=complianceGuidance(target);
    const box=document.createElement('div');
    box.className='apComplianceGuidance';
    box.style.cssText='margin:10px 0 4px;padding:12px 14px;border:1px solid rgba(215,255,45,.45);border-radius:12px;background:rgba(215,255,45,.07);line-height:1.45';
    box.innerHTML=`<b style="display:block;margin-bottom:4px">💡 ${g.title}</b><span class="mini">${g.text}</span>${total>1?`<div class="mini" style="margin-top:7px;font-weight:800">Schritt ${Math.max(1,position)} von ${total}</div>`:''}`;
    const field=el.closest?.('.field')||el.parentElement;
    (field||el).insertAdjacentElement('afterend',box);
    return true;
  }

  function focusComplianceField(id,target=null,position=0,total=0){
    const el=document.getElementById(id);if(!el)return false;
    const details=el.closest?.('details');if(details)details.open=true;
    el.style.outline='3px solid rgba(215,255,45,.9)';el.style.outlineOffset='3px';el.style.scrollMarginTop='145px';
    if(target)showComplianceGuidance(target,position,total);
    setTimeout(()=>{
      try{el.scrollIntoView({behavior:'smooth',block:'center'});el.focus({preventScroll:true})}
      catch(e){el.focus?.()}
    },120);
    setTimeout(()=>{el.style.outline='';el.style.outlineOffset=''},6000);
    return true;
  }

  // v11.31.28: Eingaben in Rechnungsangaben lokal als ENTWURF puffern.
  // Sie werden erst durch den vorhandenen Speichern-Button in den Betrieb/Cloud-Datensatz übernommen.
  const SETTINGS_DRAFT_PREFIX='angebotspilot_invoice_settings_draft_v1';
  const SETTINGS_DRAFT_FIELDS=['taxNumber','vatId','iban','bankName'];
  function settingsDraftKey(){
    let company='',user='';
    try{const ctx=globalThis.APCloudContext?.();company=String(ctx?.company?.id||'');user=String(ctx?.session?.user?.id||'')}catch(e){}
    company=company||String(globalThis.data?.meta?.cloudCompanyId||'');
    user=user||String(globalThis.data?.meta?.authUserId||'');
    return company&&user?`${SETTINGS_DRAFT_PREFIX}_${company}_${user}`:SETTINGS_DRAFT_PREFIX;
  }
  function saveInvoiceSettingsDraft(){
    try{
      const values={};let any=false;
      for(const id of SETTINGS_DRAFT_FIELDS){const el=document.getElementById(id);if(!el)continue;values[id]=String(el.value??'');any=true}
      if(any)localStorage.setItem(settingsDraftKey(),JSON.stringify({values,savedAt:Date.now()}));
    }catch(e){console.warn('Rechnungsangaben-Entwurf konnte nicht lokal gepuffert werden',e)}
  }
  function restoreInvoiceSettingsDraft(){
    try{
      const raw=localStorage.getItem(settingsDraftKey());if(!raw)return false;
      const parsed=JSON.parse(raw);if(!parsed?.values||Date.now()-Number(parsed.savedAt||0)>86400000){localStorage.removeItem(settingsDraftKey());return false}
      for(const id of SETTINGS_DRAFT_FIELDS){
        const el=document.getElementById(id);if(!el||document.activeElement===el)continue;
        if(Object.prototype.hasOwnProperty.call(parsed.values,id))el.value=String(parsed.values[id]??'');
      }
      return true;
    }catch(e){return false}
  }
  function clearInvoiceSettingsDraftIfSaved(){
    try{
      const s=globalThis.data?.settings||{};
      const map={taxNumber:'taxNumber',vatId:'vatId',iban:'iban',bankName:'bankName'};
      const allMatch=Object.entries(map).every(([id,key])=>{
        const el=document.getElementById(id);return !el||String(el.value??'').trim()===String(s[key]??'').trim();
      });
      if(allMatch)localStorage.removeItem(settingsDraftKey());
    }catch(e){}
  }
  function bindInvoiceSettingsDraft(){
    restoreInvoiceSettingsDraft();
    for(const id of SETTINGS_DRAFT_FIELDS){
      const el=document.getElementById(id);if(!el||el.dataset.apSettingsDraftBound==='1')continue;
      el.dataset.apSettingsDraftBound='1';
      el.addEventListener('input',saveInvoiceSettingsDraft);
      el.addEventListener('change',saveInvoiceSettingsDraft);
      el.addEventListener('blur',saveInvoiceSettingsDraft);
    }
  }

  function ensureCompanyEInvoiceReadiness(){
    const screen=document.getElementById('settings');if(!screen)return false;
    bindInvoiceSettingsDraft();
    let card=document.getElementById('companyEInvoiceReadiness');
    if(!card){
      const anchor=[...screen.querySelectorAll('.sectionTitle')].find(x=>(x.textContent||'').includes('Rechnungsangaben'));if(!anchor)return false;
      card=document.createElement('div');card.id='companyEInvoiceReadiness';card.className='card';card.style.border='1px solid rgba(160,180,210,.25)';card.style.marginBottom='14px';anchor.insertAdjacentElement('beforebegin',card);
    }
    const r=companyReadiness();
    card.innerHTML=r.missing.length
      ?`<div style="display:flex;gap:12px;align-items:flex-start"><span style="font-size:28px">🧾</span><div style="flex:1"><b style="font-size:18px">E-Rechnung noch nicht startklar</b><p class="mini" style="margin:5px 0 10px">${r.missing.map(x=>x.label).join(' · ')}</p><button type="button" class="btn small" id="apFixCompanyEInvoice">Fehlende Angabe öffnen →</button></div></div>`
      :'<div style="display:flex;gap:12px;align-items:flex-start"><span style="font-size:28px">✅</span><div><b style="font-size:18px">E-Rechnung bereit</b><p class="mini" style="margin:5px 0 0">Firmenadresse, E-Mail und Zahlungskonto sind vollständig hinterlegt.</p></div></div>';
    const btn=document.getElementById('apFixCompanyEInvoice');if(btn)btn.onclick=()=>{const first=r.missing[0];if(first)focusComplianceField(first.id,{scope:'settings',id:first.id,message:first.label},1,r.missing.length)};
    ['companyStreet','companyHouseNumber','companyPostalCode','companyCity','companyEmail','iban','taxNumber','vatId'].forEach(id=>{const el=document.getElementById(id);if(el&&el.dataset.apReadinessBound!=='1'){el.dataset.apReadinessBound='1';el.addEventListener('input',ensureCompanyEInvoiceReadiness);el.addEventListener('change',ensureCompanyEInvoiceReadiness)}});
    return true;
  }

  function classifyComplianceError(message){
    const m=String(message||'');
    const customer=[[/Kundentyp/i,'custCustomerType'],[/Kundenname|Kundenname\/Firma/i,'custName'],[/Kundenadresse/i,'custStreet'],[/Leitweg|Käuferreferenz|BuyerReference|BT-10/i,'custBuyerReference'],[/elektronische Adresse des Kunden|E-Rechnungsadresse/i,'custEInvoiceAddress'],[/Lieferantennummer/i,'custSupplierNumber'],[/UID des Kunden|USt-ID.*Kunden|USt-Id.*Kunden/i,'custVatId']];
    const settings=[[/Firmenname/i,'companyName'],[/Firmenadresse/i,'companyStreet'],[/Firmen-E-Mail/i,'companyEmail'],[/IBAN|Zahlungsweg|Zahlungskonto/i,'iban'],[/Steuernummer|USt-IdNr\. des Betriebs/i,'taxNumber'],[/UID des österreichischen Betriebs|MWST-\/UID-Nummer des schweizerischen Betriebs/i,'vatId']];
    const invoice=[[/Rechnungsnummer/i,'invoiceNumber'],[/Rechnungsdatum/i,'invoiceDate'],[/Leistungsdatum|Lieferdatum/i,'invoiceServiceDate'],[/Fälligkeitsdatum|Fälligkeit/i,'invoiceDueDate'],[/Betreff/i,'invoiceSubject'],[/Rechnungsposition|Position .*Menge|Einheit fehlt/i,'invoiceLines'],[/Steuersatz|Steuerbehandlung/i,'invoiceTaxTreatment']];
    for(const [rx,id] of customer)if(rx.test(m))return{scope:'customer',id,message:m};
    for(const [rx,id] of settings)if(rx.test(m))return{scope:'settings',id,message:m};
    for(const [rx,id] of invoice)if(rx.test(m))return{scope:'invoice',id,message:m};
    return{scope:'invoice',id:'invoiceComplianceBox',message:m};
  }

  function complianceTechnicalFailure(result){
    const server=result?.serverValidation||result?.server_validation||null;
    if(result?.technicalError===true||result?.failureKind==='technical')return true;
    if(!server)return false;
    const official=server?.official_kosit||server?.officialKosit||{};
    const preflight=server?.server_preflight||server?.serverPreflight||{};
    return server?.transport==='error'||official?.status==='error'||preflight?.status==='error';
  }

  function complianceValidatorRejected(result){
    if(result?.fixableInputErrors===true||result?.failureKind==='input')return false;
    const server=result?.serverValidation||result?.server_validation||null;
    const official=server?.official_kosit||server?.officialKosit||{};
    return official?.status==='failed'||result?.failureKind==='validator-rejected';
  }

  function renderComplianceSystemMessage(inv,result,kind='technical'){
    complianceRepairState=null;globalThis.__apComplianceRepair=null;clearComplianceGuidance();
    const box=document.getElementById('invoiceComplianceBox');
    const number=String(inv?.number||document.getElementById('invoiceNumber')?.value||'').trim();
    const errors=(result?.errors||[]).map(x=>String(x||'').trim()).filter(Boolean);
    const first=errors[0]||'';
    const technical=kind==='technical';
    const title=technical?'Technische E-Rechnungsprüfung nicht erreichbar':'KoSIT hat die XRechnung abgelehnt';
    const text=technical
      ?'Deine Rechnungsangaben sind nicht automatisch falsch. Der externe Prüfservice konnte die XML gerade technisch nicht abschließend prüfen. Die Rechnung bleibt sicher als Entwurf gespeichert.'
      :'Der offizielle KoSIT-Validator hat den technischen XML-Aufbau abgelehnt. Das ist kein fehlendes Eingabefeld. AngebotsPilot blockiert die Ausstellung und zeigt die Validator-Regel, bis der XML-Generator korrigiert ist.';
    if(box){
      box.innerHTML=`<div class="invoiceComplianceHead"><span>${technical?'🛠️':'⛔'}</span><div><b>${title}</b><small>${text}</small></div></div>${first?`<div class="mini" style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(255,110,110,.08)">${first}</div>`:''}<div class="mini" style="margin-top:10px">${number?number+' · ':''}Nicht ausgestellt · Daten bleiben unverändert.</div>`;
      try{box.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}
    }
    (globalThis.toast||globalThis.showToast)?.(technical?'Prüfservice technisch nicht erreichbar – es fehlt kein Eingabefeld.':'XRechnung technisch noch nicht gültig – Rechnung bleibt sicher als Entwurf.','warning');
  }

  function openComplianceRepair(inv,result,options={}){
    const errors=result?.errors||[];
    if(!errors.length){
      clearComplianceGuidance();
      complianceRepairState=null;globalThis.__apComplianceRepair=null;
      if(inv&&typeof globalThis.editInvoice==='function'){
        globalThis.editInvoice(inv.id);
        setTimeout(()=>globalThis.refreshInvoiceComplianceUI?.(inv),150);
      }
      (globalThis.toast||globalThis.showToast)?.('✓ Alle Pflichtangaben vollständig · Rechnung erneut geprüft','success');
      return;
    }

    const target=classifyComplianceError(errors[0]||'');
    const previous=complianceRepairState||globalThis.__apComplianceRepair||{};
    const invoiceId=inv?.id||previous.invoiceId||document.getElementById('invoiceId')?.value||'';
    const customerId=inv?.customerId||previous.customerId||'';
    const total=errors.length;
    const position=Math.max(1,Number(options.position)||1);

    complianceRepairState={invoiceId,customerId,target,errors:[...errors],position,total};
    globalThis.__apComplianceRepair=complianceRepairState;

    const guidance=complianceGuidance(target);
    (globalThis.toast||globalThis.showToast)?.(`${guidance.title} – ich öffne direkt das richtige Feld.`,'warning');

    if(target.scope==='customer'&&customerId){
      globalThis.editCustomer?.(customerId);
      setTimeout(()=>{
        ensureCustomerComplianceUi();bindCustomerComplianceUi();
        const details=document.querySelector('#customerEditor .apCustomerEInvoiceDetails');
        if(details){details.dataset.apForceOpen='1';details.open=true}
        updateCustomerComplianceUi();
        focusComplianceField(target.id,target,position,total);
      },180);
      return;
    }
    if(target.scope==='settings'){
      globalThis.showScreen?.('settings');
      setTimeout(()=>{
        ensureCompanyEInvoiceReadiness();
        focusComplianceField(target.id,target,position,total);
      },200);
      return;
    }
    focusComplianceField(target.id,target,position,total);
  }

  function complianceCheckForInvoice(invoiceId){
    const inv=(globalThis.data?.invoices||[]).find(x=>String(x.id)===String(invoiceId));
    if(!inv||!globalThis.APCompliance)return{inv,result:null};
    try{
      globalThis.APCompliance.prepareInvoice?.(inv);
      const result=globalThis.APCompliance.check(inv);
      globalThis.refreshInvoiceComplianceUI?.(inv);
      return{inv,result};
    }catch(e){
      console.warn('Rechnungsprüfung nach Korrektur fehlgeschlagen',e);
      return{inv,result:null};
    }
  }

  function advanceComplianceRepairAfterSave(kind){
    const state=complianceRepairState||globalThis.__apComplianceRepair;
    if(!state||state.target?.scope!==kind)return;
    const invoiceId=state.invoiceId;if(!invoiceId)return;

    setTimeout(()=>{
      const checked=complianceCheckForInvoice(invoiceId);
      const inv=checked.inv,result=checked.result;
      if(!inv||!result){
        (globalThis.toast||globalThis.showToast)?.('Angabe gespeichert. Bitte Rechnung erneut prüfen.','success');
        return;
      }

      const remaining=result.errors||[];
      if(!remaining.length){
        complianceRepairState=null;globalThis.__apComplianceRepair=null;
        clearComplianceGuidance();
        if(typeof globalThis.editInvoice==='function')globalThis.editInvoice(invoiceId);
        setTimeout(()=>globalThis.refreshInvoiceComplianceUI?.(inv),160);
        (globalThis.toast||globalThis.showToast)?.('✓ Alle Pflichtangaben vollständig · zurück zur Rechnung','success');
        return;
      }

      const next=classifyComplianceError(remaining[0]||'');
      const sameTarget=next.scope===state.target?.scope&&next.id===state.target?.id;
      if(sameTarget){
        complianceRepairState={...state,target:next,errors:[...remaining],total:remaining.length};
        globalThis.__apComplianceRepair=complianceRepairState;
        focusComplianceField(next.id,next,1,remaining.length);
        (globalThis.toast||globalThis.showToast)?.('Die Angabe ist noch nicht vollständig – bitte direkt hier korrigieren.','warning');
        return;
      }

      // Nicht erst zurück zur Rechnung: automatisch zum nächsten fehlenden Feld weiterführen.
      openComplianceRepair(inv,result,{position:Math.min((state.position||1)+1,Math.max(1,remaining.length))});
    },260);
  }

  function resumeInvoiceAfterComplianceRepair(kind){
    // Kompatibilitätsname für ältere Hooks; v11.31.28 führt jetzt Schritt für Schritt
    // durch alle noch fehlenden Angaben und kehrt erst am Ende zur Rechnung zurück.
    advanceComplianceRepairAfterSave(kind);
  }

  function installGuidedComplianceRepair(){
    const fn=globalThis.runInvoiceComplianceBeforeFinalize;
    if(typeof fn==='function'&&!fn.__apGuidedComplianceRepair){
      const wrapped=async function(inv){
        if(!globalThis.APCompliance)return fn.apply(this,arguments);
        let result;
        if(typeof globalThis.APCompliance.preflightForFinalization==='function'){
          result=await globalThis.APCompliance.preflightForFinalization(inv);
        }else{
          globalThis.APCompliance.prepareInvoice?.(inv);
          result=globalThis.APCompliance.check(inv);
        }
        globalThis.refreshInvoiceComplianceUI?.(inv);
        if(!result?.ok){
          if(complianceTechnicalFailure(result)){
            renderComplianceSystemMessage(inv,result,'technical');
            return result;
          }
          if(complianceValidatorRejected(result)){
            renderComplianceSystemMessage(inv,result,'validator');
            return result;
          }
          openComplianceRepair(inv,result||{errors:['Rechnungsprüfung konnte nicht abgeschlossen werden.']});
          return result;
        }
        return result;
      };
      wrapped.__apGuidedComplianceRepair=true;wrapped.__apOriginal=fn;globalThis.runInvoiceComplianceBeforeFinalize=wrapped;
    }
    const settingsFn=globalThis.saveSettings;
    if(typeof settingsFn==='function'&&!settingsFn.__apGuidedComplianceRepair){
      const wrappedSettings=function(){
        const shouldResume=(complianceRepairState||globalThis.__apComplianceRepair)?.target?.scope==='settings';
        const result=settingsFn.apply(this,arguments);
        clearInvoiceSettingsDraftIfSaved();
        ensureCompanyEInvoiceReadiness();
        if(shouldResume)resumeInvoiceAfterComplianceRepair('settings');
        return result;
      };
      wrappedSettings.__apGuidedComplianceRepair=true;wrappedSettings.__apOriginal=settingsFn;globalThis.saveSettings=wrappedSettings;
    }
  }

  function installCustomerComplianceGuards(){
    ensureCustomerComplianceUi();
    for(const name of ['newCustomer','editCustomer','saveCustomer']){
      const fn=globalThis[name];
      if(typeof fn!=='function'||fn.__apCustomerComplianceGuard)continue;
      const wrapped=function(){
        ensureCustomerComplianceUi();bindCustomerComplianceUi();
        const shouldResume=name==='saveCustomer'&&(complianceRepairState||globalThis.__apComplianceRepair)?.target?.scope==='customer';
        const result=fn.apply(this,arguments);
        setTimeout(()=>{bindCustomerComplianceUi();updateCustomerComplianceUi()},0);
        if(shouldResume)resumeInvoiceAfterComplianceRepair('customer');
        return result;
      };
      wrapped.__apCustomerComplianceGuard=true;
      wrapped.__apOriginal=fn;
      globalThis[name]=wrapped;
    }
  }

  // v11.31.0-r3: Rechnungseditor robust gegen fehlende/alte HTML-Felder machen.
  function ensureInvoiceEditorUi(){
    const editor=document.getElementById('invoiceEditor');
    if(!editor)return false;

    let serviceDate=document.getElementById('invoiceServiceDate');
    if(!serviceDate){
      const due=document.getElementById('invoiceDueDate');
      const dateRow=due?.closest?.('.row');
      if(dateRow){
        const field=document.createElement('div');
        field.className='field apInvoiceServiceDateField';
        field.innerHTML='<label>Leistungsdatum</label><input type="date" class="input" id="invoiceServiceDate" data-invoice-editable><small>Datum, an dem die Leistung ausgeführt bzw. abgeschlossen wurde.</small>';
        dateRow.insertAdjacentElement('afterend',field);
        serviceDate=field.querySelector('#invoiceServiceDate');
      }
    }

    // Die Compliance-Anzeige war im alten HTML noch nicht vorhanden. Sie ist optional,
    // soll aber sichtbar sein, sobald v11.31 aktiv ist.
    let complianceBox=document.getElementById('invoiceComplianceBox');
    if(!complianceBox){
      const lines=document.getElementById('invoiceLines');
      const lineCard=lines?.closest?.('.card');
      if(lineCard){
        complianceBox=document.createElement('div');
        complianceBox.id='invoiceComplianceBox';
        complianceBox.className='invoiceComplianceBox';
        complianceBox.innerHTML='<div class="invoiceComplianceHead"><span>🛡️</span><div><b>Rechnungsprüfung bereit</b><small>Pflichtfelder und E‑Rechnungsregeln werden vor dem Ausstellen geprüft.</small></div></div>';
        lineCard.insertAdjacentElement('beforebegin',complianceBox);
      }
    }

    return !!serviceDate;
  }

  function installInvoiceActionGuards(){
    ensureInvoiceEditorUi();
    const names=['newInvoice','editInvoice','createCorrectionDraft','createCancellationDraft','saveInvoice','autoSaveInvoiceAndClose'];
    for(const name of names){
      const fn=globalThis[name];
      if(typeof fn!=='function'||fn.__apInvoiceUiGuard)continue;
      const wrapped=function(){
        ensureInvoiceEditorUi();
        snapshotLinkedInvoiceDrafts();
        try{
          const result=fn.apply(this,arguments);
          if(result&&typeof result.then==='function'){
            return result.then(value=>{
              snapshotLinkedInvoiceDrafts();
              scheduleInvoiceSafetyRepair(250);
              setTimeout(polishInvoiceUi,0);
              return value;
            }).catch(error=>{
              console.error(`AngebotsPilot Rechnungsaktion ${name} fehlgeschlagen`,error);
              const message='Rechnungsaktion konnte nicht abgeschlossen werden. Bitte App einmal neu laden.';
              if(globalThis.toast)globalThis.toast(message,'error');
              else if(globalThis.showToast)globalThis.showToast(message,'error');
              return undefined;
            });
          }
          snapshotLinkedInvoiceDrafts();
          scheduleInvoiceSafetyRepair(250);
          setTimeout(polishInvoiceUi,0);
          return result;
        }catch(error){
          console.error(`AngebotsPilot Rechnungsaktion ${name} fehlgeschlagen`,error);
          const message='Rechnungsansicht konnte nicht geöffnet werden. Bitte App einmal neu laden.';
          if(globalThis.toast)globalThis.toast(message,'error');
          else if(globalThis.showToast)globalThis.showToast(message,'error');
          return undefined;
        }
      };
      wrapped.__apInvoiceUiGuard=true;
      wrapped.__apOriginal=fn;
      globalThis[name]=wrapped;
    }
  }


  // v11.31.03: Rechnungsstatus und Aktionen eindeutig darstellen.
  // Keine Buchungslogik wird hier verändert; es geht um klare UI und sichere Aktionsgrenzen.
  function invoiceUiStatusLabel(inv){
    if(!inv)return'';
    if(inv.status==='draft'){
      if(inv.documentType==='cancellation')return'Storno · Entwurf';
      if(inv.correctionOf||inv.documentType==='correction')return'Korrektur · Entwurf';
      return'Entwurf';
    }
    if(inv.status==='cancelled')return'Storniert';
    if(inv.status==='paid'){
      if(inv.correctionOf||inv.documentType==='correction')return'Korrektur · bezahlt';
      return'Bezahlt';
    }
    if(inv.status==='open'){
      if(inv.documentType==='cancellation')return'Storno · ausgestellt';
      if(inv.correctionOf||inv.documentType==='correction')return'Korrektur · ausgestellt';
      return'Ausgestellt · offen';
    }
    return String(inv.status||'');
  }

  function invoiceUiTypeTitle(inv){
    if(inv?.documentType==='cancellation')return'Storno';
    if(inv?.correctionOf||inv?.documentType==='correction')return'Korrektur';
    return'Rechnung';
  }

  function isInvoiceUiLocked(inv){
    return !!(inv&&(inv.finalizedAt||['open','paid','cancelled'].includes(inv.status)));
  }

  function cardForInvoice(inv){
    const cards=[...document.querySelectorAll('#invoiceList .invoiceListCard')];
    return cards.find(card=>{
      const meta=[...card.querySelectorAll('p')].find(p=>(p.textContent||'').includes(`· ${inv.number} ·`));
      return !!meta;
    })||null;
  }

  function polishInvoiceListUi(){
    const invoices=globalThis.data?.invoices||[];
    for(const inv of invoices){
      const card=cardForInvoice(inv);if(!card)continue;
      const badge=card.querySelector('.badge');
      if(badge)badge.textContent=invoiceUiStatusLabel(inv);

      const payBtn=card.querySelector('button[onclick*="markInvoicePaid"]');
      const nonPayable=inv.documentType==='cancellation'||Number(inv.total)<=0||inv.status!=='open';
      if(payBtn){
        payBtn.hidden=nonPayable;
        if(!nonPayable)payBtn.textContent='Als bezahlt markieren';
      }

      if(inv.documentType==='cancellation'){
        card.querySelectorAll('.invoiceFollowupState,.invoiceReminderBtn,.invoiceDunningBtn,.invoicePaidConfirmBtn')
          .forEach(el=>el.remove());
        const meta=[...card.querySelectorAll('p')].find(p=>(p.textContent||'').includes(`· ${inv.number} ·`));
        if(meta){
          const customer=globalThis.data?.customers?.find?.(x=>x.id===inv.customerId);
          const date=inv.date?new Date(`${inv.date}T12:00:00`).toLocaleDateString('de-DE'):'';
          meta.textContent=`${customer?.name||'Unbekannter Kunde'} · ${inv.number} · Storno${date?` · ausgestellt ${date}`:''}`;
        }
      }
    }
  }

  function polishInvoiceEditorUi(){
    const editor=document.getElementById('invoiceEditor');if(!editor)return;
    const id=document.getElementById('invoiceId')?.value||'';
    const inv=(globalThis.data?.invoices||[]).find(x=>String(x.id)===String(id))||null;
    const locked=isInvoiceUiLocked(inv);

    const title=document.getElementById('invoiceEditorTitle');
    if(title)title.textContent=invoiceUiTypeTitle(inv);

    const finish=editor.querySelector('.finishBtn');
    if(finish)finish.textContent=locked?'Schließen':'✓ Fertig';

    const numberState=editor.querySelector('.documentNumberField .discountFieldHead .mini');
    if(numberState)numberState.textContent=locked?'Ausgestellt':'Entwurf';

    const numberHint=document.getElementById('invoiceNumberHint');
    if(numberHint)numberHint.textContent=locked
      ?'Ausgestellt und gesperrt. Die Rechnungsnummer kann nicht mehr geändert werden.'
      :'Wird automatisch vorgeschlagen. Vor dem Ausstellen kannst du sie ändern.';

    const status=document.getElementById('invoiceStatus');
    if(status){
      const labels={draft:'Entwurf',open:'Ausgestellt · offen',paid:'Bezahlt',cancelled:'Storniert'};
      [...status.options].forEach(opt=>{if(labels[opt.value])opt.textContent=labels[opt.value]});
    }

    const banner=document.getElementById('invoiceLockBanner');
    if(banner&&locked){
      const head=banner.querySelector('b');
      if(head){
        head.textContent=inv?.documentType==='cancellation'
          ?'Ausgestellter Stornobeleg – gesperrt'
          :(inv?.correctionOf||inv?.documentType==='correction')
            ?'Ausgestellte Korrektur – gesperrt'
            :'Ausgestellte Rechnung – gesperrt';
      }
    }

    const corr=document.getElementById('invoiceCorrectionBtn');
    const cancel=document.getElementById('invoiceCancelDraftBtn');
    const hideLegalActions=!!inv&&(inv.documentType==='cancellation'||inv.status==='cancelled');
    if(corr)corr.hidden=hideLegalActions;
    if(cancel)cancel.hidden=hideLegalActions;
    const actionBox=editor.querySelector('.invoiceLockActions');
    if(actionBox)actionBox.hidden=hideLegalActions;

    // Gesperrte Felder optisch klarer machen, ohne Stylesheets anfassen zu müssen.
    editor.querySelectorAll('[data-invoice-editable]').forEach(el=>{
      if(locked){
        el.setAttribute('aria-disabled','true');
        el.style.opacity='0.72';
      }else{
        el.removeAttribute('aria-disabled');
        el.style.opacity='';
      }
    });
  }

  function polishInvoiceUi(){
    polishInvoiceListUi();
    polishInvoiceEditorUi();
  }

  function installPaymentActionGuard(){
    const fn=globalThis.markInvoicePaid;
    if(typeof fn!=='function'||fn.__apPaymentGuard)return;
    const wrapped=async function(id){
      const inv=(globalThis.data?.invoices||[]).find(x=>x.id===id);
      if(inv&&(inv.documentType==='cancellation'||Number(inv.total)<=0)){
        globalThis.toast?.('Dieser Beleg hat keinen normalen Zahlungseingang.');
        return;
      }
      return fn.apply(this,arguments);
    };
    wrapped.__apPaymentGuard=true;
    wrapped.__apOriginal=fn;
    globalThis.markInvoicePaid=wrapped;
  }

  function invoiceButtonDiagnostics(){
    const required=[
      'newInvoice','editInvoice','previewInvoice','finalizeInvoiceById','shareInvoicePDF',
      'markInvoicePaid','createCorrectionDraft','createCancellationDraft','addInvoiceLine',
      'saveInvoice','autoSaveInvoiceAndClose','printInvoice'
    ];
    const missing=required.filter(name=>typeof globalThis[name]!=='function');
    const ids=['invoiceEditor','invoiceId','invoiceNumber','invoiceCustomer','invoiceDate','invoiceDueDate','invoiceServiceDate','invoiceStatus','invoiceSubject','invoiceNotes','invoiceLines','invoiceAddLineBtn','invoiceDiscountType','invoiceDiscount','invoiceTaxTreatment','invoiceTaxRate','invoiceTaxNote','invoiceSaveBtn','invoicePreviewPaper','invoicePreviewSource'];
    const missingIds=ids.filter(id=>!document.getElementById(id));
    return{ok:missing.length===0&&missingIds.length===0,missingFunctions:missing,missingElements:missingIds};
  }

  globalThis.APInvoiceUI={version:'11.31.28',ensure:ensureInvoiceEditorUi,diagnostics:invoiceButtonDiagnostics};
  globalThis.APComplianceUX={version:'11.31.28',updateCustomer:updateCustomerComplianceUi,companyReadiness,openFirstCompanyMissing:()=>{const x=companyReadiness().missing[0];if(x)focusComplianceField(x.id)},focus:focusComplianceField};


  // v11.31.04: Rechnungsnummern werden serverseitig atomar reserviert.
  // Die Datenbank erzwingt zusätzlich Mandant + normalisierte Nummer eindeutig.
  let invoiceNumberingGuardsInstalled=false;

  function invoiceNumberingContext(){
    try{return globalThis.APCloudContext?.()||null}catch(e){return null}
  }

  function invoiceNumberingError(error){
    const code=String(error?.code||'');
    const raw=String(error?.message||error||'Rechnungsnummer konnte nicht reserviert werden.');
    if(code==='23505'||/bereits vergeben|duplicate|unique/i.test(raw)){
      return'Diese Rechnungsnummer ist bereits vergeben. Bitte eine andere Nummer verwenden.';
    }
    if(code==='42501'||/Berechtigung/i.test(raw))return'Keine Berechtigung zum Vergeben von Rechnungsnummern.';
    return raw;
  }

  async function reserveInvoiceNumber({localId,proposed,manual=false,required=false}={}){
    const requested=String(proposed||'').trim();
    if(!requested)throw new Error('Rechnungsnummer fehlt.');
    if(!localId)throw new Error('Rechnungs-ID fehlt.');

    const ctx=invoiceNumberingContext();
    if(!ctx?.client||!ctx?.company?.id){
      if(required)throw new Error('Zum Ausstellen muss die Cloud verbunden sein, damit die Rechnungsnummer sicher reserviert werden kann.');
      return requested;
    }

    try{
      const {data:allocated,error}=await ctx.client.rpc('reserve_invoice_number',{
        p_company_id:ctx.company.id,
        p_local_id:String(localId),
        p_requested_number:requested,
        p_manual:!!manual
      });
      if(error)throw error;
      const result=String(allocated||'').trim();
      if(!result)throw new Error('Die Cloud hat keine Rechnungsnummer zurückgegeben.');
      return result;
    }catch(error){
      const msg=invoiceNumberingError(error);
      const duplicate=String(error?.code||'')==='23505'||/bereits vergeben|duplicate|unique/i.test(String(error?.message||''));
      if(required||manual||duplicate)throw new Error(msg);
      console.warn('Rechnungsnummer vorerst nur lokal vergeben',error);
      return requested;
    }
  }

  function persistInvoiceNumberState(){
    try{
      if(globalThis.safePersistCloudIdentity)return globalThis.safePersistCloudIdentity(globalThis.data);
      localStorage.setItem('digitaler_handwerker_v3',JSON.stringify(globalThis.data||{}));
      return true;
    }catch(error){
      console.warn('Rechnungsnummer konnte lokal nicht zwischengespeichert werden',error);
      return false;
    }
  }

  function editorInvoiceId(){
    const field=document.getElementById('invoiceId');
    if(!field)return'';
    let id=String(field.value||'').trim();
    if(!id){
      id=globalThis.crypto?.randomUUID?.()||globalThis.uid?.()||('inv_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
      field.value=id;
    }
    return id;
  }

  async function reserveEditorInvoiceNumber({required=false}={}){
    const input=document.getElementById('invoiceNumber');
    if(!input)return'';
    const localId=editorInvoiceId();
    let proposed=String(input.value||'').trim();
    if(!proposed&&typeof globalThis.nextUniqueInvoiceNumber==='function'){
      proposed=String(globalThis.nextUniqueInvoiceNumber()||'').trim();
      input.value=proposed;
    }
    const manual=input.dataset.manual==='1';
    const allocated=await reserveInvoiceNumber({localId,proposed,manual,required});
    if(allocated!==proposed){
      input.value=allocated;
      input.dataset.manual='0';
      globalThis.toast?.(`Rechnungsnummer sicher auf ${allocated} gesetzt`);
    }
    return allocated;
  }

  async function reserveInvoiceRecord(inv,{manual=false,required=false}={}){
    if(!inv?.id||!inv?.number)return inv?.number||'';
    const before=String(inv.number).trim();
    const allocated=await reserveInvoiceNumber({localId:inv.id,proposed:before,manual,required});
    if(allocated!==before){
      inv.number=allocated;
      const openId=document.getElementById('invoiceId')?.value||'';
      if(String(openId)===String(inv.id)){
        const input=document.getElementById('invoiceNumber');
        if(input){input.value=allocated;input.dataset.manual='0'}
      }
      persistInvoiceNumberState();
      globalThis.toast?.(`Rechnungsnummer sicher auf ${allocated} gesetzt`);
    }
    return allocated;
  }

  function sleepInvoiceGuard(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

  async function waitForInvoiceCloudIdle(timeoutMs=10000){
    const started=Date.now();
    while(globalThis.CloudSync?.state?.().syncing){
      if(Date.now()-started>timeoutMs)throw new Error('Cloud-Synchronisierung läuft noch. Bitte kurz warten und erneut versuchen.');
      await sleepInvoiceGuard(120);
    }
  }

  async function pushInvoiceSnapshotRequired(){
    const sync=globalThis.CloudSync;
    if(!sync?.pushSnapshot)throw new Error('Cloud-Synchronisierung ist nicht bereit.');
    await waitForInvoiceCloudIdle();
    await sync.pushSnapshot();
    await waitForInvoiceCloudIdle();
  }

  async function verifyInvoiceReadyForFinalize(inv){
    const ctx=invoiceNumberingContext();
    if(!ctx?.client||!ctx?.company?.id)throw new Error('Zum Ausstellen muss die Cloud verbunden sein.');
    const {data:ready,error}=await ctx.client.rpc('verify_invoice_finalization_ready',{
      p_company_id:ctx.company.id,
      p_local_id:String(inv.id),
      p_number:String(inv.number||'').trim()
    });
    if(error)throw error;
    return ready===true;
  }

  async function ensureInvoiceFinalizationReady(inv){
    if(!inv?.id||!inv?.number)throw new Error('Rechnungsnummer oder Rechnungs-ID fehlt.');
    await reserveInvoiceRecord(inv,{manual:true,required:true});

    // Der Entwurf muss vor der rechtlichen Finalisierung bereits mit genau dieser
    // Nummer in der Cloud stehen. Ein zweites Gerät kann die Nummer dann nicht mehr nehmen.
    for(let attempt=0;attempt<3;attempt++){
      await pushInvoiceSnapshotRequired();
      if(await verifyInvoiceReadyForFinalize(inv))return true;
      await sleepInvoiceGuard(250*(attempt+1));
    }
    throw new Error('Die Rechnungsnummer konnte vor dem Ausstellen nicht eindeutig in der Cloud bestätigt werden. Bitte synchronisieren und erneut versuchen.');
  }

  const ATOMIC_FINALIZATION_LOCK='__AP_INVOICE_FINALIZATION_LOCK__';

  function beginAtomicInvoiceFinalization(inv){
    const lock={active:true,localId:String(inv?.id||''),number:String(inv?.number||''),startedAt:new Date().toISOString()};
    globalThis[ATOMIC_FINALIZATION_LOCK]=lock;
    return lock;
  }

  function endAtomicInvoiceFinalization(lock){
    if(globalThis[ATOMIC_FINALIZATION_LOCK]===lock)delete globalThis[ATOMIC_FINALIZATION_LOCK];
  }

  async function atomicCommitInvoiceFinalization(inv){
    if(!inv?.id||!inv?.number||!inv?.finalizedAt)throw new Error('Finalisierter Rechnungsstand fehlt.');
    const ctx=invoiceNumberingContext();
    if(!ctx?.client||!ctx?.company?.id)throw new Error('Cloud-Verbindung fehlt.');

    const {data,error}=await ctx.client.rpc('commit_invoice_finalization',{
      p_company_id:ctx.company.id,
      p_local_id:String(inv.id),
      p_number:String(inv.number||'').trim(),
      p_finalized_at:inv.finalizedAt,
      p_status:inv.status==='paid'?'paid':'open',
      p_finalized_snapshot:inv.finalizedSnapshot||null,
      p_structured_storage_path:inv.structuredStoragePath||'',
      p_structured_sha256:inv.structuredSha256||'',
      p_compliance_status:inv.complianceStatus||null,
      p_compliance_report:inv.complianceReport||null,
      p_compliance_checked_at:inv.complianceCheckedAt||null
    });
    if(error)throw error;
    if(!data?.ok)throw new Error('Die Cloud konnte die Ausstellung nicht atomar bestätigen.');

    if(data.finalized_at)inv.finalizedAt=data.finalized_at;
    if(data.status)inv.status=data.status;
    if(data.structured_storage_path)inv.structuredStoragePath=data.structured_storage_path;
    if(data.structured_sha256)inv.structuredSha256=data.structured_sha256;
    if(inv.finalizationCloudPending)delete inv.finalizationCloudPending;
    persistInvoiceNumberState();
    return data;
  }

  async function confirmInvoiceFinalizationInCloud(inv){
    if(!inv?.id||!inv?.number||!inv?.finalizedAt)return false;
    const ctx=invoiceNumberingContext();
    if(!ctx?.client||!ctx?.company?.id)throw new Error('Cloud-Verbindung fehlt.');

    // v11.31.28: Finalisierung ist ein einzelner serverseitiger Commit. Dadurch kann
    // ein Storno nicht mehr die Originalrechnung markieren, während der Stornobeleg
    // selbst noch Entwurf bleibt.
    await waitForInvoiceCloudIdle();
    await atomicCommitInvoiceFinalization(inv);

    const {data:rows,error}=await ctx.client.from('invoices')
      .select('number,status,finalized_at,deleted_at,structured_storage_path,structured_sha256')
      .eq('company_id',ctx.company.id)
      .eq('local_id',String(inv.id))
      .limit(1);
    if(error)throw error;
    const row=rows?.[0];
    if(row?.finalized_at && !row?.deleted_at && String(row.number||'').trim().toLowerCase()===String(inv.number||'').trim().toLowerCase()){
      if(row.structured_storage_path)inv.structuredStoragePath=row.structured_storage_path;
      if(row.structured_sha256)inv.structuredSha256=row.structured_sha256;
      if(inv.finalizationCloudPending)delete inv.finalizationCloudPending;
      persistInvoiceNumberState();
      return true;
    }
    throw new Error('Die ausgestellte Rechnung wurde noch nicht von der Cloud bestätigt.');
  }

  async function recoverPendingAtomicFinalizations(){
    const pending=(globalThis.data?.invoices||[]).filter(inv=>inv?.finalizationCloudPending&&inv?.finalizedAt&&inv?.id&&inv?.number);
    if(!pending.length)return true;
    for(const inv of pending){
      await reserveInvoiceRecord(inv,{manual:true,required:true});
      await atomicCommitInvoiceFinalization(inv);
    }
    return true;
  }
  globalThis.APAtomicInvoiceRecovery=recoverPendingAtomicFinalizations;

  async function prepareFinalizedInvoiceClaimsForRestore(){
    const finalized=(globalThis.data?.invoices||[]).filter(inv=>inv?.finalizedAt&&inv?.id&&inv?.number);
    for(const inv of finalized){
      await reserveInvoiceNumber({localId:inv.id,proposed:inv.number,manual:true,required:true});
    }
    return true;
  }

  async function prepareAllDraftInvoiceNumbers(){
    const drafts=(globalThis.data?.invoices||[]).filter(inv=>inv?.status==='draft'&&!inv?.finalizedAt&&inv?.id&&inv?.number);
    let changed=false;
    for(const inv of drafts){
      const before=String(inv.number||'').trim();
      if(!before)continue;
      const allocated=await reserveInvoiceNumber({localId:inv.id,proposed:before,manual:false,required:false});
      if(allocated&&allocated!==before){inv.number=allocated;changed=true}
    }
    if(changed){
      persistInvoiceNumberState();
      globalThis.renderInvoices?.();
      polishInvoiceUi();
    }
    return true;
  }

  let invoiceDraftClaimTimer=null;

  function scheduleDraftInvoiceClaims(delay=500){
    clearTimeout(invoiceDraftClaimTimer);
    invoiceDraftClaimTimer=setTimeout(async()=>{
      try{
        const ctx=invoiceNumberingContext();
        if(!ctx?.client||!ctx?.company?.id)return;
        await prepareAllDraftInvoiceNumbers();
      }catch(error){
        console.warn('Entwurfs-Rechnungsnummern konnten noch nicht automatisch abgesichert werden',error);
      }
    },delay);
  }

  function invoiceEditorHasSaveableContent(){
    const id=String(document.getElementById('invoiceId')?.value||'').trim();
    const customer=String(document.getElementById('invoiceCustomer')?.value||'').trim();
    const subject=String(document.getElementById('invoiceSubject')?.value||'').trim();
    const line=[...document.querySelectorAll('#invoiceLines .item .field input')].some(input=>String(input.value||'').trim());
    return !!(id||(customer&&subject&&line));
  }

  async function reserveNewInvoicesCreatedBy(action){
    const before=new Set((globalThis.data?.invoices||[]).map(inv=>String(inv.id)));
    const result=await action();
    const created=(globalThis.data?.invoices||[]).filter(inv=>!before.has(String(inv.id))&&inv?.status==='draft'&&!inv?.finalizedAt);
    let changed=false;
    for(const inv of created){
      const old=String(inv.number||'').trim();
      if(!old)continue;
      const allocated=await reserveInvoiceNumber({localId:inv.id,proposed:old,manual:false,required:false});
      if(allocated!==old){inv.number=allocated;changed=true}
    }
    if(created.length){
      if(changed)persistInvoiceNumberState();
      const openId=document.getElementById('invoiceId')?.value||'';
      const open=created.find(inv=>String(inv.id)===String(openId));
      if(open){
        const input=document.getElementById('invoiceNumber');
        if(input){input.value=open.number;input.dataset.manual='0'}
      }
      try{await globalThis.CloudSync?.pushSnapshot?.()}catch(error){console.warn('Neuer Rechnungsentwurf wird beim nächsten Sync erneut gespeichert',error)}
      globalThis.renderInvoices?.();
      polishInvoiceUi();
    }
    return result;
  }

  function installInvoiceNumberingGuards(){
    if(invoiceNumberingGuardsInstalled)return;
    if(typeof globalThis.saveInvoice!=='function'||typeof globalThis.finalizeInvoiceById!=='function')return;
    invoiceNumberingGuardsInstalled=true;

    const save=globalThis.saveInvoice;
    if(!save.__apNumberGuard){
      const wrapped=async function(){
        let status=document.getElementById('invoiceStatus')?.value||'draft';
        let required=['open','paid'].includes(status);
        const localId=editorInvoiceId();
        try{
          if(invoiceEditorHasSaveableContent())await reserveEditorInvoiceNumber({required:false});
          let existing=(globalThis.data?.invoices||[]).find(x=>String(x.id)===String(localId));

          // Eine neue Rechnung, die direkt als „offen/bezahlt“ gespeichert werden soll,
          // wird zuerst unsichtbar als Cloud-Entwurf angelegt. So gibt es keinen Pfad mehr,
          // der eine bereits finalisierte Rechnung ohne serverseitigen Claim einfügen kann.
          if(required&&!existing){
            const statusField=document.getElementById('invoiceStatus');
            if(statusField)statusField.value='draft';
            await save.apply(this,arguments);
            existing=(globalThis.data?.invoices||[]).find(x=>String(x.id)===String(localId));
            if(!existing)throw new Error('Rechnungsentwurf konnte nicht vorbereitet werden.');
            await ensureInvoiceFinalizationReady(existing);
            return globalThis.finalizeInvoiceById(localId);
          }

          if(required&&existing&&!isInvoiceUiLocked(existing))await ensureInvoiceFinalizationReady(existing);
        }catch(error){
          globalThis.toast?.(invoiceNumberingError(error),'error');
          return;
        }

        const existing=(globalThis.data?.invoices||[]).find(x=>String(x.id)===String(localId));
        const beforeFinalized=existing?.finalizedAt||'';
        const lock=required&&existing&&!beforeFinalized?beginAtomicInvoiceFinalization(existing):null;
        let result;
        let committed=false;
        try{
          result=await save.apply(this,arguments);
          const finalized=(globalThis.data?.invoices||[]).find(x=>String(x.id)===String(localId));
          if(required&&finalized?.finalizedAt&&!beforeFinalized){
            try{
              await confirmInvoiceFinalizationInCloud(finalized);
              committed=true;
              globalThis.toast?.('✓ Ausstellung in der Cloud bestätigt');
            }catch(error){
              finalized.finalizationCloudPending=true;persistInvoiceNumberState();
              console.error('Atomare Cloud-Bestätigung der Ausstellung fehlt',error);
              globalThis.toast?.('⚠️ Ausstellung noch nicht von der Cloud bestätigt. Bitte Rechnung noch nicht versenden.','error');
            }
          }
        }finally{
          if(lock)endAtomicInvoiceFinalization(lock);
        }
        if(committed){
          try{await pushInvoiceSnapshotRequired()}catch(error){console.warn('Nachlaufender Cloud-Sync wird erneut versucht',error)}
        }
        return result;
      };
      wrapped.__apNumberGuard=true;
      wrapped.__apInvoiceUiGuard=!!save.__apInvoiceUiGuard;
      wrapped.__apOriginal=save;
      globalThis.saveInvoice=wrapped;
    }

    const autoClose=globalThis.autoSaveInvoiceAndClose;
    if(typeof autoClose==='function'&&!autoClose.__apNumberGuard){
      const wrapped=async function(){
        try{
          if(invoiceEditorHasSaveableContent())await reserveEditorInvoiceNumber({required:false});
        }catch(error){
          globalThis.toast?.(invoiceNumberingError(error),'error');
          return;
        }
        return autoClose.apply(this,arguments);
      };
      wrapped.__apNumberGuard=true;
      wrapped.__apInvoiceUiGuard=!!autoClose.__apInvoiceUiGuard;
      wrapped.__apOriginal=autoClose;
      globalThis.autoSaveInvoiceAndClose=wrapped;
    }

    const finalize=globalThis.finalizeInvoiceById;
    if(!finalize.__apNumberGuard){
      const wrapped=async function(id){
        const inv=(globalThis.data?.invoices||[]).find(x=>String(x.id)===String(id));
        const beforeFinalized=inv?.finalizedAt||'';
        if(inv&&!isInvoiceUiLocked(inv)){
          try{await ensureInvoiceFinalizationReady(inv)}
          catch(error){globalThis.toast?.(invoiceNumberingError(error),'error');return}
        }

        const lock=inv&&!beforeFinalized?beginAtomicInvoiceFinalization(inv):null;
        let result;
        let committed=false;
        try{
          result=await finalize.apply(this,arguments);
          if(inv?.finalizedAt&&!beforeFinalized){
            try{
              await confirmInvoiceFinalizationInCloud(inv);
              committed=true;
              globalThis.toast?.('✓ Ausstellung in der Cloud bestätigt');
            }catch(error){
              inv.finalizationCloudPending=true;persistInvoiceNumberState();
              console.error('Atomare Cloud-Bestätigung der Ausstellung fehlt',error);
              globalThis.toast?.('⚠️ Ausstellung noch nicht von der Cloud bestätigt. Bitte Rechnung noch nicht versenden.','error');
            }
          }
        }finally{
          if(lock)endAtomicInvoiceFinalization(lock);
        }
        if(committed){
          try{await pushInvoiceSnapshotRequired()}catch(error){console.warn('Nachlaufender Cloud-Sync wird erneut versucht',error)}
        }
        return result;
      };
      wrapped.__apNumberGuard=true;
      wrapped.__apOriginal=finalize;
      globalThis.finalizeInvoiceById=wrapped;
    }

    for(const name of ['createCorrectionDraft','createCancellationDraft','createInvoiceFromJob','saveJob','setOfferStatusFromModal']){
      const fn=globalThis[name];
      if(typeof fn!=='function'||fn.__apNumberGuard)continue;
      const wrapped=async function(){
        try{return await reserveNewInvoicesCreatedBy(()=>Promise.resolve(fn.apply(this,arguments)))}
        catch(error){
          console.error(`Rechnungsnummern-Schutz bei ${name} fehlgeschlagen`,error);
          globalThis.toast?.(invoiceNumberingError(error),'error');
          return;
        }
      };
      wrapped.__apNumberGuard=true;
      wrapped.__apInvoiceUiGuard=!!fn.__apInvoiceUiGuard;
      wrapped.__apOriginal=fn;
      globalThis[name]=wrapped;
    }
  }

  globalThis.APInvoiceNumbering={
    version:'11.31.28',
    reserve:reserveInvoiceNumber,
    prepareLocalDrafts:prepareAllDraftInvoiceNumbers,
    diagnostics:()=>({
      version:'11.31.28',
      cloudReady:!!invoiceNumberingContext()?.client,
      companyId:invoiceNumberingContext()?.company?.id||'',
      localDrafts:(globalThis.data?.invoices||[]).filter(inv=>inv?.status==='draft').length,
      finalizationGuard:true,
      finalizedLineGuard:true
    })
  };

  // v11.31.0-r4: Rechnungsbeziehungen nach dem Cloud-Push robust nachziehen.
  // Wichtig: Nur vorhandene lokale Beziehungen werden gesetzt; bestehende Cloud-Beziehungen
  // werden niemals durch leere lokale Werte auf NULL zurückgesetzt.
  let invoiceRelationRepairTimer=null;
  let invoiceRelationRepairRunning=false;

  async function repairInvoiceCloudRelations(){
    if(invoiceRelationRepairRunning)return;
    const linked=(globalThis.data?.invoices||[]).filter(inv=>inv?.correctionOf||inv?.originalInvoiceId||inv?.cancelledByInvoiceId);
    if(!linked.length)return;
    let ctx=null;
    try{ctx=globalThis.APCloudContext?.()||null}catch(e){ctx=null}
    if(!ctx?.client||!ctx?.company?.id||!ctx?.session?.user?.id)return;

    invoiceRelationRepairRunning=true;
    try{
      const {data:rows,error}=await ctx.client.from('invoices')
        .select('id,local_id,correction_of_id,original_invoice_id,cancelled_by_invoice_id')
        .eq('company_id',ctx.company.id)
        .is('deleted_at',null);
      if(error)throw error;
      const byLocal=new Map((rows||[]).filter(r=>r?.local_id).map(r=>[String(r.local_id),r]));

      for(const inv of linked){
        const cloud=byLocal.get(String(inv.id));
        if(!cloud)continue;
        const patch={};
        if(inv.correctionOf){
          const original=byLocal.get(String(inv.correctionOf));
          if(original?.id&&cloud.correction_of_id!==original.id)patch.correction_of_id=original.id;
        }
        if(inv.originalInvoiceId){
          const original=byLocal.get(String(inv.originalInvoiceId));
          if(original?.id&&cloud.original_invoice_id!==original.id)patch.original_invoice_id=original.id;
        }
        if(inv.cancelledByInvoiceId){
          const cancellation=byLocal.get(String(inv.cancelledByInvoiceId));
          if(cancellation?.id&&cloud.cancelled_by_invoice_id!==cancellation.id)patch.cancelled_by_invoice_id=cancellation.id;
        }
        if(!Object.keys(patch).length)continue;
        const {error:updateError}=await ctx.client.from('invoices')
          .update(patch)
          .eq('company_id',ctx.company.id)
          .eq('id',cloud.id);
        if(updateError)throw updateError;
      }
    }catch(error){
      console.warn('Rechnungsbeziehungen konnten noch nicht nachgezogen werden',error);
    }finally{
      invoiceRelationRepairRunning=false;
    }
  }

  function scheduleInvoiceRelationRepair(delay=450){
    clearTimeout(invoiceRelationRepairTimer);
    invoiceRelationRepairTimer=setTimeout(()=>repairInvoiceCloudRelations(),delay);
  }

  // v11.31.02: Schutzschicht für Korrektur-/Stornoentwürfe.
  // Sie verhindert, dass ein unvollständiger Cloud-Zwischenstand Positionen oder
  // die Verknüpfung zur Originalrechnung vernichtet.
  const INVOICE_SAFETY_KEY='angebotspilot_invoice_safety_v113102';
  let invoiceSafetyRepairTimer=null;
  let invoiceSafetyRepairRunning=false;
  let manualSyncInstalled=false;

  const cloneInvoiceSafety=value=>{
    try{return structuredClone(value)}catch(e){return JSON.parse(JSON.stringify(value))}
  };

  function readInvoiceSafetyShadow(){
    try{
      const raw=JSON.parse(localStorage.getItem(INVOICE_SAFETY_KEY)||'{}');
      return raw&&typeof raw==='object'?raw:{};
    }catch(e){return {}}
  }

  function writeInvoiceSafetyShadow(shadow){
    try{localStorage.setItem(INVOICE_SAFETY_KEY,JSON.stringify(shadow));return true}
    catch(e){console.warn('Rechnungs-Sicherheitskopie konnte lokal nicht gespeichert werden',e);return false}
  }

  function meaningfulInvoiceLines(inv){
    return (inv?.lines||[]).filter(line=>String(line?.name||'').trim());
  }

  function isProtectedInvoiceDraft(inv){
    return !!inv && inv.status==='draft' && !!(
      inv.correctionOf ||
      inv.originalInvoiceId ||
      inv.documentType==='correction' ||
      inv.documentType==='cancellation'
    );
  }

  function snapshotLinkedInvoiceDrafts(){
    const invoices=globalThis.data?.invoices||[];
    const shadow=readInvoiceSafetyShadow();
    let changed=false;
    for(const inv of invoices){
      if(!isProtectedInvoiceDraft(inv))continue;
      const lines=meaningfulInvoiceLines(inv);
      const old=shadow[String(inv.id)]?.invoice;
      // Einen bereits reicheren Snapshot niemals mit einem leeren Zwischenstand überschreiben.
      if(!lines.length && old && meaningfulInvoiceLines(old).length)continue;
      shadow[String(inv.id)]={
        capturedAt:new Date().toISOString(),
        number:inv.number||'',
        invoice:cloneInvoiceSafety(inv)
      };
      changed=true;
    }
    if(changed)writeInvoiceSafetyShadow(shadow);
    return shadow;
  }

  function restoreLocalInvoiceFromShadow(current,saved){
    if(!current||!saved||current.status!=='draft')return false;
    let changed=false;
    if(!current.correctionOf && saved.correctionOf){current.correctionOf=saved.correctionOf;changed=true}
    if(!current.originalInvoiceId && saved.originalInvoiceId){current.originalInvoiceId=saved.originalInvoiceId;changed=true}
    if(!current.cancelledByInvoiceId && saved.cancelledByInvoiceId){current.cancelledByInvoiceId=saved.cancelledByInvoiceId;changed=true}

    const currentLines=meaningfulInvoiceLines(current),savedLines=meaningfulInvoiceLines(saved);
    if(!currentLines.length && savedLines.length){
      current.lines=cloneInvoiceSafety(saved.lines||[]);
      for(const key of ['baseSubtotal','subtotal','total','discount','discountType','discountValue','tax']){
        if(saved[key]!==undefined)current[key]=cloneInvoiceSafety(saved[key]);
      }
      if(!String(current.subject||'').trim()&&saved.subject)current.subject=saved.subject;
      if(!String(current.notes||'').trim()&&saved.notes)current.notes=saved.notes;
      changed=true;
    }
    return changed;
  }

  async function repairInvoiceSafety(){
    if(invoiceSafetyRepairRunning)return;
    const shadow=readInvoiceSafetyShadow();
    const entries=Object.values(shadow||{}).filter(x=>x?.invoice&&isProtectedInvoiceDraft(x.invoice));
    if(!entries.length)return;

    invoiceSafetyRepairRunning=true;
    try{
      const invoices=globalThis.data?.invoices||[];
      let localChanged=false;
      for(const entry of entries){
        const saved=entry.invoice;
        const current=invoices.find(x=>String(x.id)===String(saved.id));
        if(current && restoreLocalInvoiceFromShadow(current,saved))localChanged=true;
      }
      if(localChanged){
        try{
          if(globalThis.safePersistCloudIdentity)globalThis.safePersistCloudIdentity(globalThis.data);
          else localStorage.setItem('digitaler_handwerker_v3',JSON.stringify(globalThis.data));
        }catch(e){console.warn('Lokaler Rechnungsentwurf konnte nicht geschützt werden',e)}
        globalThis.renderAll?.();
      }

      let ctx=null;
      try{ctx=globalThis.APCloudContext?.()||null}catch(e){ctx=null}
      if(!ctx?.client||!ctx?.company?.id)return;

      const {data:rows,error}=await ctx.client.from('invoices')
        .select('id,local_id,status,total,subtotal,correction_of_id,original_invoice_id,cancelled_by_invoice_id,finalized_at')
        .eq('company_id',ctx.company.id)
        .is('deleted_at',null);
      if(error)throw error;
      const byLocal=new Map((rows||[]).filter(r=>r?.local_id).map(r=>[String(r.local_id),r]));
      const protectedCloudIds=[];

      for(const entry of entries){
        const saved=entry.invoice;
        const current=(globalThis.data?.invoices||[]).find(x=>String(x.id)===String(saved.id));
        const source=(current&&meaningfulInvoiceLines(current).length)?current:saved;
        const cloud=byLocal.get(String(saved.id));
        if(!cloud||cloud.finalized_at||cloud.status!=='draft')continue;
        protectedCloudIds.push(cloud.id);

        const patch={};
        if(source.correctionOf){
          const original=byLocal.get(String(source.correctionOf));
          if(original?.id&&cloud.correction_of_id!==original.id)patch.correction_of_id=original.id;
        }
        if(source.originalInvoiceId){
          const original=byLocal.get(String(source.originalInvoiceId));
          if(original?.id&&cloud.original_invoice_id!==original.id)patch.original_invoice_id=original.id;
        }
        if(source.cancelledByInvoiceId){
          const cancellation=byLocal.get(String(source.cancelledByInvoiceId));
          if(cancellation?.id&&cloud.cancelled_by_invoice_id!==cancellation.id)patch.cancelled_by_invoice_id=cancellation.id;
        }
        if(Object.keys(patch).length){
          const {error:updateError}=await ctx.client.from('invoices')
            .update(patch).eq('company_id',ctx.company.id).eq('id',cloud.id);
          if(updateError)throw updateError;
        }
      }

      if(protectedCloudIds.length){
        const {data:cloudLines,error:lineReadError}=await ctx.client.from('invoice_lines')
          .select('id,invoice_id').in('invoice_id',protectedCloudIds);
        if(lineReadError)throw lineReadError;
        const countByInvoice=new Map();
        for(const line of cloudLines||[])countByInvoice.set(line.invoice_id,(countByInvoice.get(line.invoice_id)||0)+1);

        for(const entry of entries){
          const saved=entry.invoice;
          const current=(globalThis.data?.invoices||[]).find(x=>String(x.id)===String(saved.id));
          const source=(current&&meaningfulInvoiceLines(current).length)?current:saved;
          const cloud=byLocal.get(String(saved.id));
          if(!cloud||cloud.finalized_at||cloud.status!=='draft')continue;
          const lines=meaningfulInvoiceLines(source);
          if(!lines.length || (countByInvoice.get(cloud.id)||0)>0)continue;

          const payload=lines.map((line,index)=>({
            invoice_id:cloud.id,
            local_id:String(line.id||`${source.id}:line:${index}`),
            position:index+1,
            name:String(line.name||'').trim(),
            qty:Number(line.qty)||1,
            unit:line.unit||'Stk.',
            price:Number(line.price)||0,
            workers:line.workers?Number(line.workers):null,
            hours_per_worker:line.hoursPerWorker?Number(line.hoursPerWorker):null
          }));
          const {error:insertError}=await ctx.client.from('invoice_lines').insert(payload);
          if(insertError)throw insertError;

          // Nur einen eindeutig beschädigten Entwurf (keine Cloud-Positionen) wieder auf
          // den bereits lokal gesicherten Betrag bringen. Finalisierte Rechnungen werden nie angefasst.
          const amountPatch={};
          for(const [localKey,cloudKey] of [['subtotal','subtotal'],['total','total']]){
            if(source[localKey]!==undefined)amountPatch[cloudKey]=Number(source[localKey])||0;
          }
          if(Object.keys(amountPatch).length){
            const {error:amountError}=await ctx.client.from('invoices')
              .update(amountPatch).eq('company_id',ctx.company.id).eq('id',cloud.id).is('finalized_at',null);
            if(amountError)throw amountError;
          }
        }
      }
    }catch(error){
      console.warn('Rechnungs-Sicherheitsprüfung konnte noch nicht vollständig abgeschlossen werden',error);
    }finally{
      invoiceSafetyRepairRunning=false;
    }
  }

  function scheduleInvoiceSafetyRepair(delay=300){
    clearTimeout(invoiceSafetyRepairTimer);
    invoiceSafetyRepairTimer=setTimeout(()=>repairInvoiceSafety(),delay);
  }

  // v11.31.08: Finalisierte Rechnungspositionen werden aus dem unveränderbaren
  // Finalisierungs-Snapshot rekonstruiert. Der ältere Sync-Pfad löscht Positionen
  // vor dem Neu-Einfügen; bei einem unvollständigen lokalen Zustand konnte dadurch
  // eine ausgestellte Rechnung in der Cloud ohne Positionen enden.
  let finalizedLineGuardInstalled=false;
  let finalizedLineRepairRunning=false;
  let finalizedLineRepairTimer=null;

  function cloneFinalizedLines(lines){
    try{return structuredClone(lines||[])}catch(e){return JSON.parse(JSON.stringify(lines||[]))}
  }

  function snapshotLinesForFinalized(inv){
    return (inv?.finalizedSnapshot?.lines||[]).filter(line=>String(line?.name||'').trim());
  }

  function normalizeFinalizedInvoiceLinesLocal(){
    let changed=false;
    for(const inv of (globalThis.data?.invoices||[])){
      if(!inv?.finalizedAt)continue;
      const canonical=snapshotLinesForFinalized(inv);
      if(!canonical.length)continue;
      const current=(inv.lines||[]).filter(line=>String(line?.name||'').trim());
      const sig=list=>JSON.stringify(list.map(line=>({
        name:String(line?.name||''),qty:Number(line?.qty)||0,unit:String(line?.unit||''),price:Number(line?.price)||0,
        workers:line?.workers==null?null:Number(line.workers),hoursPerWorker:line?.hoursPerWorker==null?null:Number(line.hoursPerWorker)
      })));
      if(sig(current)!==sig(canonical)){
        inv.lines=cloneFinalizedLines(canonical);
        changed=true;
      }
    }
    if(changed)persistInvoiceNumberState();
    return changed;
  }

  async function repairFinalizedInvoiceLinesCloud(){
    if(finalizedLineRepairRunning)return;
    const ctx=invoiceNumberingContext();
    if(!ctx?.client||!ctx?.company?.id)return;
    const finalized=(globalThis.data?.invoices||[]).filter(inv=>inv?.finalizedAt&&snapshotLinesForFinalized(inv).length);
    if(!finalized.length)return;
    finalizedLineRepairRunning=true;
    try{
      // Seit v11.31.07 sind Positionen finalisierter Rechnungen in der Datenbank unveränderbar.
      // Diese Prüfung ist deshalb bewusst read-only: lokal wird der Finalisierungs-Snapshot
      // als kanonisch gesetzt; in der Cloud wird nur noch auf Abweichungen geprüft.
      normalizeFinalizedInvoiceLinesLocal();
      const {data:rows,error}=await ctx.client.from('invoices')
        .select('id,local_id,finalized_at,deleted_at')
        .eq('company_id',ctx.company.id)
        .is('deleted_at',null);
      if(error)throw error;
      const byLocal=new Map((rows||[]).filter(r=>r?.local_id&&r?.finalized_at).map(r=>[String(r.local_id),r]));
      for(const inv of finalized){
        const cloud=byLocal.get(String(inv.id));if(!cloud)continue;
        const canonical=snapshotLinesForFinalized(inv);
        const {data:existing,error:lineError}=await ctx.client.from('invoice_lines')
          .select('position,name,qty,unit,price,workers,hours_per_worker')
          .eq('invoice_id',cloud.id).order('position');
        if(lineError)throw lineError;
        const sig=list=>JSON.stringify((list||[]).map(line=>({
          name:String(line?.name||''),qty:Number(line?.qty)||0,unit:String(line?.unit||''),price:Number(line?.price)||0,
          workers:line?.workers==null?null:Number(line.workers),hoursPerWorker:(line?.hours_per_worker??line?.hoursPerWorker)==null?null:Number(line?.hours_per_worker??line?.hoursPerWorker)
        })));
        if(sig(existing)!==sig(canonical)){
          console.error(`Integritätswarnung: finalisierte Rechnungspositionen weichen ab (${inv.number||inv.id}). Cloud bleibt wegen Unveränderbarkeit unangetastet.`);
        }
      }
    }catch(error){
      console.warn('Finalisierte Rechnungspositionen konnten noch nicht vollständig read-only geprüft werden',error);
    }finally{
      finalizedLineRepairRunning=false;
    }
  }

  function scheduleFinalizedInvoiceLineRepair(delay=350){
    clearTimeout(finalizedLineRepairTimer);
    finalizedLineRepairTimer=setTimeout(()=>repairFinalizedInvoiceLinesCloud(),delay);
  }

  function installFinalizedInvoiceLineGuard(){
    const sync=globalThis.CloudSync;
    if(!sync||finalizedLineGuardInstalled||typeof sync.pushSnapshot!=='function')return;
    finalizedLineGuardInstalled=true;
    const original=sync.pushSnapshot;
    const wrapped=async function(){
      normalizeFinalizedInvoiceLinesLocal();
      const result=await original.apply(sync,arguments);
      scheduleFinalizedInvoiceLineRepair(180);
      return result;
    };
    wrapped.__apFinalizedLineGuard=true;
    wrapped.__apOriginal=original;
    sync.pushSnapshot=wrapped;
  }

  async function waitForCloudSyncIdle(sync,timeoutMs=15000){
    const started=Date.now();
    while(sync?.state?.().syncing){
      if(Date.now()-started>timeoutMs){
        throw new Error('Cloud-Synchronisierung läuft noch. Bitte kurz erneut versuchen.');
      }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    return true;
  }

  function installManualSyncGuard(){
    installFinalizedInvoiceLineGuard();
    const sync=globalThis.CloudSync;
    if(!sync||manualSyncInstalled||typeof sync.pushSnapshot!=='function'||typeof sync.pullCloud!=='function')return;
    manualSyncInstalled=true;

    const safeManual=async()=>{
      // Immer erst einen laufenden Auto-Sync beenden lassen. Sonst kann pushSnapshot()
      // nur "queued" setzen und ein direkt folgendes pullCloud() lokale Änderungen
      // mit dem älteren Cloud-Stand überschreiben.
      await waitForCloudSyncIdle(sync);
      snapshotLinkedInvoiceDrafts();
      normalizeFinalizedInvoiceLinesLocal();
      await prepareAllDraftInvoiceNumbers();

      await sync.pushSnapshot();
      // Falls exakt zwischen Idle-Check und Push ein anderer Sync gestartet ist,
      // wartet dieser Schritt auch auf den von CloudSync eingeplanten Queue-Push.
      await waitForCloudSyncIdle(sync);

      await repairInvoiceSafety();
      await repairFinalizedInvoiceLinesCloud();
      await waitForCloudSyncIdle(sync);
      await sync.pullCloud();

      normalizeFinalizedInvoiceLinesLocal();
      await repairInvoiceSafety();
      await repairFinalizedInvoiceLinesCloud();
      snapshotLinkedInvoiceDrafts();
      return true;
    };

    sync.manual=safeManual;
    globalThis.manualCloudSync=async()=>{
      try{
        await safeManual();
        globalThis.toast?.('☁️ Synchronisiert');
      }catch(error){
        console.error(error);
        globalThis.toast?.(String(error?.message||'Cloud-Sync fehlgeschlagen'));
      }
    };
  }

  function dataSafetyCardIsCurrent(){
    const card=document.getElementById('dataSafetyCard');
    if(!card)return false;
    return card.querySelector('h3')?.textContent?.trim()==='Datensicherung & Archiv' && !!card.querySelector('.dsGrid');
  }

  function scheduleDataSafetyRefresh(force=false){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{
      const refresh=globalThis.DataSafety?.refreshCard;
      if(typeof refresh!=='function')return;
      if(force||!dataSafetyCardIsCurrent()){
        Promise.resolve(refresh()).catch(err=>console.warn('Datensicherung konnte nicht aktualisiert werden',err));
      }
    },50);
  }

  function claimCentralBuildVersion(){
    // cloud-config ist die einzige Build-Versionsquelle.
    // script.js übernimmt AP_BUILD_VERSION und die sichtbare Anzeige bleibt zentral.
    if(typeof globalThis.syncVisibleBuildVersion==='function'){
      globalThis.syncVisibleBuildVersion=stampBuild;
    }
  }

  function installWrappers(){
    claimCentralBuildVersion();
    if(wrappersInstalled)return;
    const render=globalThis.renderAll;
    const show=globalThis.showScreen;
    if(typeof render!=='function'||typeof show!=='function')return;

    if(!render.__apCentralRuntime){
      const wrappedRender=function(){
        const result=render.apply(this,arguments);
        ensureInvoiceEditorUi();
        installInvoiceActionGuards();
        installInvoiceNumberingGuards();
        installPaymentActionGuard();
        polishInvoiceUi();
        stampBuild();
        scheduleDataSafetyRefresh();
        return result;
      };
      wrappedRender.__apCentralRuntime=true;
      globalThis.renderAll=wrappedRender;
    }

    if(!show.__apCentralRuntime){
      const wrappedShow=function(){
        if(arguments[0]==='invoiceEditor')ensureInvoiceEditorUi();
        const result=show.apply(this,arguments);
        if(arguments[0]==='invoiceEditor')ensureInvoiceEditorUi();
        installInvoiceActionGuards();
        installInvoiceNumberingGuards();
        installPaymentActionGuard();
        polishInvoiceUi();
        stampBuild();
        if(arguments[0]==='settings')scheduleDataSafetyRefresh(true);
        return result;
      };
      wrappedShow.__apCentralRuntime=true;
      globalThis.showScreen=wrappedShow;
    }
    wrappersInstalled=true;
  }

  function installSettingsObserver(){
    if(settingsObserver)return;
    const settings=document.getElementById('settings');
    if(!settings)return;
    settingsObserver=new MutationObserver(()=>{
      const legacy=[...settings.querySelectorAll('h3')].some(h=>h.textContent.trim()==='Datensicherung');
      if(legacy||!dataSafetyCardIsCurrent())scheduleDataSafetyRefresh();
    });
    settingsObserver.observe(settings,{childList:true,subtree:true});
  }

  function installRestoreSafetyGuard(){
    const ds=globalThis.DataSafety;
    if(!ds||ds.__apRestoreSafetyGuard)return;
    ds.__apRestoreSafetyGuard=true;

    const CORE=['customers','offers','events','tasks','jobs','invoices','catalog'];
    const FORMAT='angebotspilot-backup';
    const MAX_FORMAT_VERSION=2;
    const decoder=new TextDecoder();
    const encoder=new TextEncoder();
    let safeRestoreState=null;

    const clone=value=>{
      try{return structuredClone(value)}catch(e){return JSON.parse(JSON.stringify(value))}
    };
    const nowIso=()=>new Date().toISOString();
    const total=obj=>Object.values(obj||{}).reduce((sum,n)=>sum+(Number(n)||0),0);
    const notify=(message,type='info')=>{
      if(globalThis.toast)return globalThis.toast(message,type);
      if(globalThis.showToast)return globalThis.showToast(message,type);
      console[type==='error'?'error':'log'](message);
    };
    const currentContext=()=>{
      try{return globalThis.APCloudContext?.()||null}catch(e){return null}
    };
    const canManage=()=>['owner','office'].includes(currentContext()?.membership?.role||globalThis.data?.privacy?.role||'owner');

    function readStoredZip(buffer){
      const view=new DataView(buffer),bytes=new Uint8Array(buffer),files={};let pos=0;
      const u16=o=>view.getUint16(o,true),u32=o=>view.getUint32(o,true);
      while(pos+30<=bytes.length&&u32(pos)===0x04034b50){
        const flags=u16(pos+6),method=u16(pos+8),size=u32(pos+18),nameLen=u16(pos+26),extraLen=u16(pos+28);
        if(method!==0)throw new Error('Dieses ZIP verwendet eine nicht unterstützte Komprimierung. Bitte ein AngebotsPilot-Backup verwenden.');
        if(flags&0x08)throw new Error('Dieses ZIP-Format kann nicht sicher geprüft werden.');
        const name=decoder.decode(bytes.slice(pos+30,pos+30+nameLen));
        const begin=pos+30+nameLen+extraLen,end=begin+size;
        if(end>bytes.length)throw new Error('Backup-ZIP ist beschädigt.');
        files[name]=bytes.slice(begin,end);pos=end;
      }
      return files;
    }

    async function sha256(text){
      if(!crypto?.subtle)return '';
      const digest=await crypto.subtle.digest('SHA-256',encoder.encode(text));
      return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    }

    function normalizeBackup(raw){
      if(raw?.format===FORMAT&&raw?.data)return raw;
      if(raw&&typeof raw==='object'&&(Array.isArray(raw.customers)||Array.isArray(raw.offers)||raw.settings)){
        return {format:FORMAT,formatVersion:0,appBuild:'legacy',companyId:raw?.meta?.cloudCompanyId||raw?.meta?.companyId||'',data:raw,integrity:{},legacy:true};
      }
      throw new Error('Datei ist kein gültiges AngebotsPilot-Backup.');
    }

    async function parseForSafeRestore(file){
      if(!file)throw new Error('Keine Datei ausgewählt.');
      if(file.size>120*1024*1024)throw new Error('Backup ist zu groß für die sichere Browser-Wiederherstellung.');
      const buffer=await file.arrayBuffer();let raw;
      if(file.name.toLowerCase().endsWith('.zip')||file.type==='application/zip'){
        const files=readStoredZip(buffer),payload=files['backup/arbeitsdaten.json'];
        if(!payload)throw new Error('Im ZIP fehlt backup/arbeitsdaten.json.');
        raw=JSON.parse(decoder.decode(payload));
      }else raw=JSON.parse(decoder.decode(new Uint8Array(buffer)));
      const backup=normalizeBackup(raw);
      if((Number(backup.formatVersion)||0)>MAX_FORMAT_VERSION)throw new Error('Dieses Backup stammt aus einer neueren AngebotsPilot-Version. Bitte zuerst die App aktualisieren.');
      if(!backup.data||typeof backup.data!=='object')throw new Error('Backup enthält keine Arbeitsdaten.');
      const context=currentContext(),activeCompany=context?.company?.id||globalThis.data?.meta?.cloudCompanyId||globalThis.data?.meta?.companyId||'';
      if(context?.company?.id&&backup.companyId&&backup.companyId!==context.company.id&&backup.companyId!==globalThis.data?.meta?.companyId){
        throw new Error('Sicherheitsstopp: Dieses Backup gehört zu einem anderen Betrieb.');
      }
      if(backup.integrity?.dataSha256){
        const actual=await sha256(JSON.stringify(backup.data));
        if(actual!==backup.integrity.dataSha256)throw new Error('Integritätsprüfung fehlgeschlagen. Das Backup wurde möglicherweise verändert oder beschädigt.');
      }
      return {fileName:file.name,backup,activeCompany};
    }

    function timestampOf(row){
      if(!row||typeof row!=='object')return 0;
      const keys=['client_updated_at','clientUpdatedAt','updated_at','updatedAt','modified_at','modifiedAt'];
      let best=0;
      for(const key of keys){
        const value=row[key];if(!value)continue;
        const ms=Date.parse(value);if(Number.isFinite(ms)&&ms>best)best=ms;
      }
      return best;
    }

    function sameRecord(a,b){
      try{return JSON.stringify(a)===JSON.stringify(b)}catch(e){return false}
    }

    function currentTombstones(current,collection){
      return new Set((current?.meta?.deletedEntities||[])
        .filter(x=>x&&x.collection===collection)
        .map(x=>String(x.id??''))
        .filter(Boolean));
    }

    function mergeCollection(currentRows,incomingRows,collection){
      const out=(Array.isArray(currentRows)?currentRows:[]).map(clone);
      const byId=new Map();
      out.forEach((row,index)=>{if(row&&row.id!==undefined&&row.id!==null)byId.set(String(row.id),index)});
      const tombstones=currentTombstones(globalThis.data||{},collection);
      const stats={added:0,backupNewer:0,currentProtected:0,identical:0,deletedProtected:0,noIdSkipped:0};

      for(const incoming of Array.isArray(incomingRows)?incomingRows:[]){
        if(!incoming||typeof incoming!=='object')continue;
        const id=incoming.id===undefined||incoming.id===null?'':String(incoming.id);
        if(!id){stats.noIdSkipped++;continue}
        if(tombstones.has(id)){stats.deletedProtected++;continue}
        if(!byId.has(id)){
          byId.set(id,out.length);out.push(clone(incoming));stats.added++;continue;
        }
        const index=byId.get(id),current=out[index];
        if(sameRecord(current,incoming)){stats.identical++;continue}
        const currentTs=timestampOf(current),backupTs=timestampOf(incoming);
        if(currentTs&&backupTs&&backupTs>currentTs){
          out[index]=clone(incoming);stats.backupNewer++;
        }else{
          stats.currentProtected++;
        }
      }
      return {rows:out,stats};
    }

    function fillMissing(currentValue,backupValue){
      if(currentValue===undefined||currentValue===null||currentValue==='')return clone(backupValue);
      if(Array.isArray(currentValue))return clone(currentValue);
      if(currentValue&&backupValue&&typeof currentValue==='object'&&typeof backupValue==='object'){
        const out=clone(currentValue);
        for(const [key,value] of Object.entries(backupValue)){
          out[key]=key in out?fillMissing(out[key],value):clone(value);
        }
        return out;
      }
      return clone(currentValue);
    }

    function buildSafeMerge(current,incoming){
      const merged=clone(current||{}),details={},summary={added:0,backupNewer:0,currentProtected:0,identical:0,deletedProtected:0,noIdSkipped:0};
      for(const collection of CORE){
        const result=mergeCollection(current?.[collection],incoming?.[collection],collection);
        merged[collection]=result.rows;details[collection]=result.stats;
        for(const key of Object.keys(summary))summary[key]+=result.stats[key]||0;
      }
      merged.settings=fillMissing(current?.settings||{},incoming?.settings||{});
      merged.privacy=clone(current?.privacy||{});
      merged.users=clone(current?.users||[]);
      merged.audit=clone(current?.audit||[]);
      merged.meta={...(clone(current?.meta||{})),lastRestoreAt:nowIso(),lastRestoreBuild:VERSION,lastRestoreMode:'conflict-aware-current-protected'};
      // Aktuelle Löschmarker bleiben erhalten. Backup-Löschmarker werden bewusst nicht importiert.
      merged.meta.deletedEntities=clone(current?.meta?.deletedEntities||[]);
      return {merged,summary,details};
    }

    function savePreRestoreSnapshot(){
      try{
        const prefix='angebotspilot_pre_restore_',key=prefix+Date.now();
        localStorage.setItem(key,JSON.stringify({savedAt:nowIso(),data:clone(globalThis.data||{})}));
        Object.keys(localStorage).filter(k=>k.startsWith(prefix)).sort().reverse().slice(3).forEach(k=>localStorage.removeItem(k));
        return key;
      }catch(e){console.warn('Lokaler Vorher-Snapshot nicht möglich',e);return ''}
    }

    async function writeRestoreAudit(state,beforeKey){
      try{
        const c=currentContext();if(!c?.client||!c?.company?.id||!c?.session?.user?.id)return;
        await c.client.from('data_operation_events').insert({
          company_id:c.company.id,user_id:c.session.user.id,event_type:'restore_applied',entity_type:'backup',entity_id:'',
          metadata:{app_build:VERSION,source_file:state.fileName,format_version:state.backup.formatVersion||0,pre_restore_snapshot:!!beforeKey,mode:'conflict-aware-current-protected',merge_summary:state.plan.summary}
        });
      }catch(e){console.warn('Restore-Audit konnte nicht geschrieben werden',e)}
    }

    function decorateSafePreview(state){
      const body=document.getElementById('dataSafetyRestoreBody');if(!body)return;
      body.querySelector('.apRestoreConflictGuard')?.remove();
      body.querySelector('.apRestoreSafeMerge')?.remove();
      const s=state.plan.summary;
      const box=document.createElement('div');box.className='dsSafe apRestoreSafeMerge';
      box.innerHTML=`<b>✓ Konfliktsicherer Merge bereit</b><br>${s.added} fehlende Datensätze werden ergänzt · ${s.backupNewer} nachweislich neuere Backup-Datensätze werden übernommen · ${s.currentProtected} aktuelle Konflikte bleiben geschützt · ${s.identical} identische Datensätze bleiben unverändert${s.deletedProtected?` · ${s.deletedProtected} aktuelle Löschungen bleiben geschützt`:''}.`;
      body.querySelector('.dsSheetActions')?.before(box);
      const apply=[...body.querySelectorAll('button')].find(b=>/Backup zusammenführen|Merge-Schutz aktiv|Sicher zusammenführen/.test(b.textContent||''));
      if(apply){apply.disabled=false;apply.textContent='Sicher zusammenführen';}
    }

    function decorateRestoreError(message){
      const body=document.getElementById('dataSafetyRestoreBody');if(!body)return;
      const box=document.createElement('div');box.className='dsWarn apRestoreConflictGuard';
      box.innerHTML=`<b>🛡️ Sicherheitsstopp</b><br>${String(message||'Backup konnte nicht für den sicheren Merge vorbereitet werden.')}`;
      body.querySelector('.dsSheetActions')?.before(box);
      const apply=[...body.querySelectorAll('button')].find(b=>/Backup zusammenführen|Sicher zusammenführen/.test(b.textContent||''));
      if(apply){apply.disabled=true;apply.textContent='Merge nicht freigegeben';}
    }

    const originalChoose=ds.chooseBackup?.bind(ds);
    if(originalChoose){
      ds.chooseBackup=async function(event){
        const file=event?.target?.files?.[0]||null;
        safeRestoreState=null;
        const safeParse=file?parseForSafeRestore(file):Promise.reject(new Error('Keine Datei ausgewählt.'));
        const result=await originalChoose(event);
        try{
          const parsed=await safeParse,current=globalThis.data||{},plan=buildSafeMerge(current,parsed.backup.data);
          safeRestoreState={...parsed,plan};
          setTimeout(()=>decorateSafePreview(safeRestoreState),0);
        }catch(e){
          console.error(e);safeRestoreState=null;
          setTimeout(()=>decorateRestoreError(e?.message),0);
        }
        return result;
      };
    }

    const originalClose=ds.closeRestore?.bind(ds);
    ds.closeRestore=function(){safeRestoreState=null;return originalClose?.()};

    ds.applyRestore=async function(){
      if(!safeRestoreState)return notify('Bitte Backup erneut auswählen und prüfen.','warning');
      if(!canManage())return notify('Nur Inhaber oder Büro können ein Backup einspielen.','error');
      const state=safeRestoreState,current=globalThis.data||{},freshPlan=buildSafeMerge(current,state.backup.data);
      state.plan=freshPlan;
      const s=freshPlan.summary;
      const text=`Die Sicherung wird konfliktbewusst mit dem aktuellen Betrieb zusammengeführt. Aktuelle Datensätze werden niemals von älteren oder unklaren Backup-Ständen überschrieben.\n\nNeu ergänzen: ${s.added}\nBackup nachweislich neuer: ${s.backupNewer}\nAktuelle Konflikte geschützt: ${s.currentProtected}\nIdentisch: ${s.identical}\nAktuelle Löschungen geschützt: ${s.deletedProtected}`;
      const ok=globalThis.appConfirm?!!(await globalThis.appConfirm({title:'Backup sicher zusammenführen?',text,confirmLabel:'Sicher zusammenführen',icon:'🛡️'})):confirm(`Backup sicher zusammenführen?\n\n${text}`);
      if(!ok)return;
      const beforeKey=savePreRestoreSnapshot();
      try{
        Object.keys(current).forEach(key=>delete current[key]);Object.assign(current,freshPlan.merged);globalThis.data=current;
        if(globalThis.AppRepository?.prepare)globalThis.AppRepository.prepare(current,null);
        if(globalThis.safePersistCloudIdentity)globalThis.safePersistCloudIdentity(current);else localStorage.setItem('digitaler_handwerker_v3',JSON.stringify(current));
        const c=currentContext();
        if(c?.company?.id&&globalThis.CloudSync?.pushSnapshot){
          // Restore kann historische, bereits finalisierte Rechnungen neu in die Cloud bringen.
          // Dafür werden ihre Nummern vor dem Push kontrolliert beansprucht; bestehende
          // Rechnungen desselben lokalen Datensatzes bleiben idempotent.
          await prepareFinalizedInvoiceClaimsForRestore();
          await globalThis.CloudSync.pushSnapshot();
          await globalThis.CloudSync.pullCloud();
        }
        await writeRestoreAudit(state,beforeKey);
        document.getElementById('dataSafetyRestoreModal')?.classList.add('hidden');
        safeRestoreState=null;
        globalThis.renderAll?.();
        notify(`✓ Backup sicher zusammengeführt. ${s.added+s.backupNewer} Datensätze übernommen, ${s.currentProtected} aktuelle Konflikte geschützt.`,'success');
      }catch(e){
        console.error(e);notify(String(e?.message||'Wiederherstellung fehlgeschlagen.'),'error');
      }
    };
  }

  function ensureDataSafetyLoaded(){
    if(globalThis.DataSafety?.refreshCard){
      installRestoreSafetyGuard();
      installSettingsObserver();
      scheduleDataSafetyRefresh(true);
      return;
    }

    const existing=[...document.scripts].find(s=>/data-safety\.js(?:\?|$)/.test(s.src||''));
    if(existing){
      existing.addEventListener('load',()=>{
        installSettingsObserver();
        scheduleDataSafetyRefresh(true);
      },{once:true});
      return;
    }

    // Direkt aus dem Hauptdokument-Bootstrap laden; nicht mehr vom Service Worker abhängig.
    const script=document.createElement('script');
    script.src=DATA_SAFETY_SRC;
    script.defer=true;
    script.dataset.apRuntimeLoader='cloud-config';
    script.onload=()=>{
      installRestoreSafetyGuard();
      installSettingsObserver();
      scheduleDataSafetyRefresh(true);
    };
    script.onerror=()=>console.error('AngebotsPilot Datensicherung konnte nicht geladen werden.');
    document.head.appendChild(script);
  }

  function ensureComplianceLoaded(){
    // v11.31.28: Loader-Dateien werden aus den zentralen SRC-Konstanten abgeleitet.
    // Dadurch kann ein Versionswechsel nicht mehr an einer vergessenen alten
    // Regex/Dateinummer hängen bleiben.
    const runtime=globalThis.APCompliance?.runtimeVersion||'';
    if(runtime===COMPLIANCE_RUNTIME_VERSION)return;

    const fileOf=src=>String(src||'').split('/').pop().split('?')[0];
    const findScript=src=>{
      const file=fileOf(src);
      return [...document.scripts].find(node=>{
        try{return new URL(node.src,location.href).pathname.endsWith('/'+file)}
        catch(e){return String(node.src||'').includes(file)}
      });
    };
    const loadScript=(src,tag,errorText)=>{
      const script=document.createElement('script');
      script.src=src;script.defer=true;script.dataset.apRuntimeLoader=tag;
      script.onload=()=>setTimeout(ensureComplianceLoaded,0);
      script.onerror=()=>console.error(errorText);
      document.head.appendChild(script);
      return script;
    };

    const core=findScript(COMPLIANCE_SRC);
    const hardening=findScript(COMPLIANCE_HARDENING_SRC);
    const currentServer=findScript(COMPLIANCE_SERVER_SRC);
    const currentZugferd=findScript(COMPLIANCE_ZUGFERD_SRC);

    if(!runtime){
      if(!core)loadScript(COMPLIANCE_SRC,'compliance-core','AngebotsPilot Rechnungs-Compliance-Core konnte nicht geladen werden.');
      else setTimeout(ensureComplianceLoaded,80);
      return;
    }

    if(runtime==='11.31.0'){
      if(!hardening)loadScript(COMPLIANCE_HARDENING_SRC,'compliance-hardening','AngebotsPilot Compliance-Hardening konnte nicht geladen werden.');
      else setTimeout(ensureComplianceLoaded,80);
      return;
    }

    if(runtime===COMPLIANCE_SERVER_RUNTIME_VERSION){
      if(currentZugferd){
        try{
          if(globalThis.APComplianceUpgradeTo113131?.(globalThis.APCompliance)){
            setTimeout(ensureComplianceLoaded,0);
            return;
          }
        }catch(error){console.warn('ZUGFeRD-Upgrade '+VERSION+' wird erneut versucht.',error)}
        setTimeout(ensureComplianceLoaded,80);
        return;
      }
      loadScript(COMPLIANCE_ZUGFERD_SRC,'compliance-zugferd','AngebotsPilot '+VERSION+' ZUGFeRD-Layer konnte nicht geladen werden.');
      return;
    }

    const supported=['11.31.08','11.31.16','11.31.17','11.31.18','11.31.19','11.31.20','11.31.21','11.31.22','11.31.23','11.31.24','11.31.25','11.31.26','11.31.27'];
    if(supported.includes(runtime)){
      if(currentServer){
        try{
          if(globalThis.APComplianceUpgradeTo113128?.(globalThis.APCompliance)){
            setTimeout(ensureComplianceLoaded,0);
            return;
          }
        }catch(error){console.warn('Compliance-Upgrade '+VERSION+' wird erneut versucht.',error)}
        setTimeout(ensureComplianceLoaded,80);
        return;
      }
      loadScript(COMPLIANCE_SERVER_SRC,'compliance-current','AngebotsPilot '+VERSION+' Server-Validierung konnte nicht geladen werden.');
      return;
    }

    console.warn('Unbekannte Compliance-Runtime:',runtime);
  }

  function installRefreshHooks(){
    const refresh=()=>scheduleDataSafetyRefresh(true);
    window.addEventListener('angebotspilot:syncstate',event=>{
      refresh();
      installManualSyncGuard();
      installInvoiceNumberingGuards();
      if(event?.detail?.syncing===true)snapshotLinkedInvoiceDrafts();
      if(event?.detail?.syncing===false){
        scheduleDraftInvoiceClaims(180);
        scheduleFinalizedInvoiceLineRepair(220);
        scheduleInvoiceRelationRepair(250);
        scheduleInvoiceSafetyRepair(300);
        setTimeout(polishInvoiceUi,0);
      }
    });
    window.addEventListener('focus',()=>{
      refresh();installPersistentPermissionGuards();bindCustomerComplianceUi();installGuidedComplianceRepair();ensureCompanyEInvoiceReadiness();installFinalizedInvoiceLineGuard();installManualSyncGuard();installInvoiceNumberingGuards();snapshotLinkedInvoiceDrafts();
      polishInvoiceUi();scheduleDraftInvoiceClaims(220);scheduleFinalizedInvoiceLineRepair(260);
      scheduleInvoiceRelationRepair(450);scheduleInvoiceSafetyRepair(500);
    });
    window.addEventListener('pageshow',()=>{
      refresh();installPersistentPermissionGuards();bindCustomerComplianceUi();installGuidedComplianceRepair();ensureCompanyEInvoiceReadiness();installFinalizedInvoiceLineGuard();installManualSyncGuard();installInvoiceNumberingGuards();snapshotLinkedInvoiceDrafts();
      polishInvoiceUi();scheduleDraftInvoiceClaims(220);scheduleFinalizedInvoiceLineRepair(260);
      scheduleInvoiceRelationRepair(450);scheduleInvoiceSafetyRepair(500);
    });
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){
      refresh();installPersistentPermissionGuards();bindCustomerComplianceUi();installGuidedComplianceRepair();ensureCompanyEInvoiceReadiness();installFinalizedInvoiceLineGuard();installManualSyncGuard();installInvoiceNumberingGuards();snapshotLinkedInvoiceDrafts();
      polishInvoiceUi();scheduleDraftInvoiceClaims(220);scheduleFinalizedInvoiceLineRepair(260);
      scheduleInvoiceRelationRepair(450);scheduleInvoiceSafetyRepair(500);
    }});
  }

  function runtimeDiagnostics(){
    try{ensureInvoiceEditorUi()}catch(e){}
    const duplicateIds=[...document.querySelectorAll('[id]')]
      .map(el=>el.id).filter((id,index,all)=>id&&all.indexOf(id)!==index);
    const criticalFunctions=['renderAll','showScreen','saveSettings','newInvoice','editInvoice','finalizeInvoiceById'];
    const missingFunctions=criticalFunctions.filter(name=>typeof globalThis[name]!=='function');
    const invoiceUi=globalThis.APInvoiceUI?.diagnostics?.()||null;
    const sync=globalThis.CloudSync?.state?.()||null;
    const complianceRuntime=String(globalThis.APCompliance?.runtimeVersion||'');
    const checks={
      build:globalThis.APBuild?.version===VERSION,
      compliance:complianceRuntime===VERSION,
      invoiceUi:invoiceUi?.ok!==false,
      cloudSync:!!(globalThis.CloudSync?.pushSnapshot&&globalThis.CloudSync?.pullCloud&&globalThis.CloudSync?.manual),
      duplicateDomIds:duplicateIds.length===0,
      criticalFunctions:missingFunctions.length===0
    };
    return{
      version:VERSION,
      ok:Object.values(checks).every(Boolean),
      checks,
      complianceRuntime,
      invoiceUi,
      sync,
      duplicateIds:[...new Set(duplicateIds)],
      missingFunctions
    };
  }
  globalThis.APRuntimeDiagnostics={version:VERSION,run:runtimeDiagnostics};

  function forceServiceWorkerCheck(){
    if(!('serviceWorker' in navigator))return;
    navigator.serviceWorker.getRegistration().then(reg=>reg?.update?.()).catch(()=>{});
  }

  function boot(){
    stampBuild();
    installPersistentPermissionGuards();
    ensureCustomerComplianceUi();
    bindCustomerComplianceUi();
    installCustomerComplianceGuards();
    installGuidedComplianceRepair();
    ensureCompanyEInvoiceReadiness();
    ensureInvoiceEditorUi();
    installInvoiceActionGuards();
    installInvoiceNumberingGuards();
    installPaymentActionGuard();
    polishInvoiceUi();
    installWrappers();
    installSettingsObserver();
    ensureDataSafetyLoaded();
    ensureComplianceLoaded();
    installRefreshHooks();
    installFinalizedInvoiceLineGuard();
    installManualSyncGuard();
    snapshotLinkedInvoiceDrafts();
    normalizeFinalizedInvoiceLinesLocal();
    scheduleDraftInvoiceClaims(700);
    scheduleFinalizedInvoiceLineRepair(850);
    scheduleInvoiceSafetyRepair(600);
    forceServiceWorkerCheck();

    // Späte App-/Cloud-Initialisierung abfangen, ohne dauerhaft renderAll zu pollen.
    [0,250,800,1800].forEach(ms=>setTimeout(()=>{
      installPersistentPermissionGuards();
      ensureCustomerComplianceUi();
      bindCustomerComplianceUi();
      installCustomerComplianceGuards();
      installGuidedComplianceRepair();
      ensureCompanyEInvoiceReadiness();
      ensureInvoiceEditorUi();
      installInvoiceActionGuards();
      installInvoiceNumberingGuards();
      installPaymentActionGuard();
      polishInvoiceUi();
      installWrappers();
      stampBuild();
      ensureDataSafetyLoaded();
      ensureComplianceLoaded();
      scheduleDataSafetyRefresh(true);
      installFinalizedInvoiceLineGuard();
      installManualSyncGuard();
      snapshotLinkedInvoiceDrafts();
      normalizeFinalizedInvoiceLinesLocal();
      scheduleDraftInvoiceClaims(220);
      scheduleFinalizedInvoiceLineRepair(280);
      scheduleInvoiceRelationRepair(250);
      scheduleInvoiceSafetyRepair(350);
    },ms));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
