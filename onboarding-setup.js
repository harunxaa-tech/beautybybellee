/* AngebotsPilot v11.28.2 – geführte Betriebseinrichtung + Stabilitäts-QA */
(function(){
  'use strict';

  const VERSION=1128;
  let client=null,session=null,company=null,membership=null;
  let step=0,manualOpen=false,saving=false,saved=false;
  let state={};
  const q=id=>document.getElementById(id);
  const now=()=>new Date().toISOString();

  const DEFAULT_MODULES={offers:true,invoices:true,jobs:true,calendar:true,secretariat:true,team:false,time_tracking:false,weather:true,tasks:true,acceptance:true};

  function normalizeModules(value){
    const m={...DEFAULT_MODULES,...((value&&typeof value==='object'&&!Array.isArray(value))?value:{})};
    m.offers=true;m.invoices=true;m.calendar=true;m.tasks=true;
    m.weather=!!m.jobs;
    m.acceptance=!!m.jobs;
    if(!m.team)m.time_tracking=false;
    return m;
  }

  function initialState(){
    const c=company||{};
    const modules=normalizeModules(c.enabled_modules);
    const country=(c.country_code||globalThis.data?.settings?.countryCode||'DE').toUpperCase();
    const profile=globalThis.APCountry?.country?.(country)||{};
    const treatment=c.tax_treatment||globalThis.data?.settings?.taxTreatment||((Number(c.tax_rate)||0)===0?(country==='CH'?'non_registered':'small_business'):'standard');
    const businessMode=c.business_mode==='team'?'team':'solo';
    if(modules.team)modules.time_tracking=true; // UI führt Team + Zeiterfassung bewusst als ein Modul.
    if(businessMode==='team'){modules.team=true;modules.time_tracking=true;}
    const local=globalThis.data?.settings||{};
    return {
      countryCode:['DE','AT','CH'].includes(country)?country:'DE',
      businessMode,
      modules,
      taxTreatment:treatment,
      taxRate:Number(c.tax_rate??local.tax??profile.standardRate??0)||0,
      paymentDays:Math.max(0,Number(c.payment_days??7)||7),
      taxNumber:c.tax_number??local.taxNumber??'',
      vatId:c.vat_id??local.vatId??'',
      iban:c.iban??local.iban??'',
      bankName:c.bank_name??local.bankName??''
    };
  }

  function setHidden(el,hidden){
    if(!el)return;
    el.hidden=!!hidden;
    el.classList.toggle('hidden',!!hidden);
    if(hidden)el.setAttribute('aria-hidden','true');else el.removeAttribute('aria-hidden');
  }

  function treatmentLabel(code=state.taxTreatment,country=state.countryCode){
    const labels=globalThis.APCountry?.TREATMENTS||{};
    if(code==='small_business'&&country==='DE')return 'Kleinunternehmer (§ 19 UStG)';
    if(code==='small_business'&&country==='AT')return 'Kleinunternehmerregelung';
    if(code==='non_registered'&&country==='CH')return 'Nicht MWST-pflichtig / nicht registriert';
    return labels[code]?.label||code;
  }

  function treatmentOptions(){
    const country=state.countryCode||'DE';
    const profile=globalThis.APCountry?.country?.(country);
    const list=profile?.treatments||['standard'];
    return list.map(code=>`<option value="${code}" ${code===state.taxTreatment?'selected':''}>${escapeHtml(treatmentLabel(code,country))}</option>`).join('');
  }

  function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function forcesZero(t){return ['small_business','reverse_charge','exempt','non_registered'].includes(t)}

  function syncTaxForCountry(){
    const p=globalThis.APCountry?.country?.(state.countryCode)||{};
    const allowed=p.treatments||['standard'];
    if(!allowed.includes(state.taxTreatment))state.taxTreatment=state.countryCode==='CH'?'non_registered':'small_business';
    if(state.taxTreatment==='standard'){
      const rates=p.rates||[p.standardRate||0];
      if(!rates.some(x=>Math.abs(Number(x)-Number(state.taxRate))<0.001))state.taxRate=Number(p.standardRate)||0;
    }else state.taxRate=0;
  }

  function render(){
    document.querySelectorAll('#businessSetupWizard .setupStep').forEach(el=>setHidden(el,Number(el.dataset.step)!==step));
    const progress=q('businessSetupProgress');if(progress)progress.style.width=`${Math.min(100,((Math.min(step,3)+1)/4)*100)}%`;
    const back=q('businessSetupBack');if(back)setHidden(back,step===0||step>=4);
    const skip=q('businessSetupLater');
    if(skip){
      skip.textContent=manualOpen?'Schließen':'Später';
      setHidden(skip,step>=4||(step===3&&!manualOpen));
    }

    document.querySelectorAll('[data-setup-country]').forEach(btn=>btn.classList.toggle('active',btn.dataset.setupCountry===state.countryCode));
    document.querySelectorAll('[data-setup-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.setupMode===state.businessMode));
    document.querySelectorAll('[data-setup-module]').forEach(btn=>{
      const key=btn.dataset.setupModule;
      btn.classList.toggle('active',!!state.modules[key]);
      btn.setAttribute('aria-pressed',String(!!state.modules[key]));
      if(key==='team')btn.classList.toggle('suggested',state.businessMode==='team');
    });
    const teamNote=q('setupTeamModeNote');
    if(teamNote){
      const active=!!state.modules.team;
      setHidden(teamNote,!active);
      if(active){
        teamNote.textContent=state.businessMode==='team'
          ?'👥 Bei „Mit Team“ ist Team & Zeiterfassung automatisch aktiv.'
          :'👥 Teamfunktionen sind aktiv. Deine Arbeitsweise bleibt „Allein / kleiner Betrieb“.';
      }
    }

    const treatment=q('setupTaxTreatment');
    if(treatment){treatment.innerHTML=treatmentOptions();treatment.value=state.taxTreatment;}
    const rate=q('setupTaxRate');
    if(rate){
      const p=globalThis.APCountry?.country?.(state.countryCode)||{};
      rate.innerHTML=(p.rates||[p.standardRate||0]).map(r=>`<option value="${r}" ${Math.abs(Number(r)-Number(state.taxRate))<.001?'selected':''}>${escapeHtml(p.rateLabels?.[r]||String(r).replace('.',',')+' %')}</option>`).join('');
      rate.disabled=forcesZero(state.taxTreatment);
      if(forcesZero(state.taxTreatment))rate.innerHTML='<option value="0">0 % · kein Steuerausweis</option>';
    }
    if(q('setupPaymentDays'))q('setupPaymentDays').value=String(state.paymentDays||7);
    if(q('setupTaxNumber'))q('setupTaxNumber').value=state.taxNumber||'';
    if(q('setupVatId'))q('setupVatId').value=state.vatId||'';
    if(q('setupIban'))q('setupIban').value=state.iban||'';
    if(q('setupBankName'))q('setupBankName').value=state.bankName||'';

    const flag=globalThis.APCountry?.country?.(state.countryCode)?.flag||'';
    if(q('setupCountrySummary'))q('setupCountrySummary').textContent=`${flag} ${globalThis.APCountry?.country?.(state.countryCode)?.name||state.countryCode}`;
    if(q('setupCountrySummaryFinal'))q('setupCountrySummaryFinal').textContent=`${flag} ${globalThis.APCountry?.country?.(state.countryCode)?.name||state.countryCode}`;
    if(q('setupModeSummary'))q('setupModeSummary').textContent=state.businessMode==='team'?'👥 Betrieb mit Team':'👤 Solo / kleiner Betrieb';
    if(q('setupFinishMail'))setHidden(q('setupFinishMail'),!state.modules.secretariat);
    if(q('setupModuleSummary')){
      const labels=['Kunden','Angebote','Kalender','Rechnungen'];
      if(state.modules.jobs)labels.push('Baustellen & Abnahme');
      if(state.modules.secretariat)labels.push('Sekretariat');
      if(state.modules.team)labels.push('Team & Zeiten');
      q('setupModuleSummary').textContent=labels.join(' · ');
    }
    if(q('setupInvoiceSummary')){
      const profile=globalThis.APCountry?.country?.(state.countryCode)||{};
      const taxText=state.taxTreatment==='standard'?`${treatmentLabel()} · ${Number(state.taxRate)||0} %`:treatmentLabel();
      q('setupInvoiceSummary').textContent=`${profile.currency||'EUR'} · ${taxText} · ${state.paymentDays||7} Tage`;
    }
  }

  async function markStarted(){
    if(!client||!company?.id||membership?.role!=='owner'||company.onboarding_started_at)return;
    const started=now();
    const {error}=await client.from('companies').update({onboarding_started_at:started}).eq('id',company.id);
    if(!error)company.onboarding_started_at=started;
  }

  function hydrateContext(){
    try{
      const ctx=globalThis.APCloudContext?.();
      if(ctx?.client)client=ctx.client;
      if(ctx?.session)session=ctx.session;
      if(ctx?.company)company=ctx.company;
      if(ctx?.membership)membership=ctx.membership;
    }catch(e){console.warn('BusinessSetup context refresh failed',e)}
  }

  function open(isManual=false){
    hydrateContext();
    if(!company){
      globalThis.toast?.('Betrieb wird noch geladen · bitte kurz erneut versuchen');
      return;
    }
    if(membership?.role!=='owner'){
      globalThis.toast?.('Nur der Inhaber kann die Betriebseinrichtung ändern');
      return;
    }
    manualOpen=!!isManual;
    saved=false;
    state=initialState();
    syncTaxForCountry();
    ['setupTaxNumber','setupVatId','setupIban','setupBankName'].forEach(id=>{const el=q(id);if(el)el.dataset.setupTouched='0'});
    setSaveError('');
    step=0;
    setHidden(q('businessSetupWizard'),false);
    document.body.classList.add('businessSetupActive');
    render();
    markStarted().catch(()=>{});
  }

  function close(){
    setHidden(q('businessSetupWizard'),true);
    document.body.classList.remove('businessSetupActive');
  }

  function setSaveError(message=''){
    const el=q('businessSetupError');if(!el)return;
    el.textContent=message;
    setHidden(el,!message);
  }

  function readOptional(id,key){
    const el=q(id);if(!el)return;
    const value=el.value.trim();
    // Leere, unberührte optionale Felder überschreiben vorhandene Firmendaten nicht versehentlich.
    if(value||el.dataset.setupTouched==='1'||!state[key])state[key]=value;
  }

  function readFields(){
    if(q('setupTaxTreatment'))state.taxTreatment=q('setupTaxTreatment').value||state.taxTreatment;
    if(q('setupTaxRate')&&!q('setupTaxRate').disabled)state.taxRate=Number(q('setupTaxRate').value)||0;
    if(forcesZero(state.taxTreatment))state.taxRate=0;
    const days=Number(q('setupPaymentDays')?.value);
    state.paymentDays=Math.min(365,Math.max(0,Number.isFinite(days)?days:7));
    readOptional('setupTaxNumber','taxNumber');
    readOptional('setupVatId','vatId');
    readOptional('setupIban','iban');
    readOptional('setupBankName','bankName');
  }

  function next(){
    readFields();
    if(step===0&&state.businessMode==='team'){
      state.modules.team=true;
      state.modules.time_tracking=true;
    }
    step=Math.min(3,step+1);render();
  }
  function back(){readFields();step=Math.max(0,step-1);render()}

  function selectCountry(code){
    if(!['DE','AT','CH'].includes(code))return;
    state.countryCode=code;syncTaxForCountry();render();
  }
  function selectMode(mode){
    if(!['solo','team'].includes(mode))return;
    state.businessMode=mode;
    // „Mit Team“ braucht die Teamfunktionen. Solo darf Teamfunktionen optional trotzdem nutzen.
    if(mode==='team'){state.modules.team=true;state.modules.time_tracking=true}
    render();
  }
  function toggleModule(key){
    if(!['jobs','secretariat','team'].includes(key))return;
    if(key==='team'){
      const nextValue=!state.modules.team;
      if(!nextValue&&state.businessMode==='team'){
        globalThis.toast?.('Bei „Mit Team“ bleibt Team & Zeiterfassung aktiv. In Schritt 1 kannst du auf Solo wechseln.');
        render();
        return;
      }
      state.modules.team=nextValue;
      state.modules.time_tracking=nextValue;
      render();
      return;
    }
    state.modules[key]=!state.modules[key];
    if(key==='jobs'){
      state.modules.weather=state.modules.jobs;
      state.modules.acceptance=state.modules.jobs;
    }
    render();
  }

  function onTaxTreatmentChange(){
    readFields();
    state.taxTreatment=q('setupTaxTreatment')?.value||state.taxTreatment;
    if(forcesZero(state.taxTreatment))state.taxRate=0;
    else syncTaxForCountry();
    render();
  }

  function localApply(patch){
    if(!globalThis.data)return;
    const s=globalThis.data.settings=globalThis.data.settings||{};
    const p=globalThis.APCountry?.country?.(patch.country_code)||{};
    Object.assign(s,{
      countryCode:patch.country_code,currency:patch.currency_code,businessMode:patch.business_mode,enabledModules:patch.enabled_modules,
      taxTreatment:patch.tax_treatment,tax:Number(patch.tax_rate)||0,taxNote:globalThis.APCountry?.legalTaxNote?.(patch.country_code,patch.tax_treatment)||'',
      paymentTerm:`${patch.payment_days} Tage`,taxNumber:patch.tax_number||'',vatId:patch.vat_id||'',iban:patch.iban||'',bankName:patch.bank_name||''
    });
    try{globalThis.saveData?.()}catch(e){}
  }

  async function finish(){
    if(saving||saved)return;
    readFields();syncTaxForCountry();
    if(!client||!company?.id){
      setSaveError('Die Cloud-Verbindung ist gerade nicht bereit. Bitte Verbindung prüfen und erneut versuchen.');
      return;
    }
    const profile=globalThis.APCountry?.country?.(state.countryCode)||{};
    const modules=normalizeModules(state.modules);
    if(modules.team)modules.time_tracking=true;
    const patch={
      country_code:state.countryCode,
      currency_code:profile.currency||'EUR',
      business_mode:state.businessMode,
      enabled_modules:modules,
      tax_treatment:state.taxTreatment,
      tax_rate:forcesZero(state.taxTreatment)?0:Number(state.taxRate)||0,
      tax_note:globalThis.APCountry?.legalTaxNote?.(state.countryCode,state.taxTreatment)||'',
      payment_days:state.paymentDays,
      tax_number:state.taxNumber,
      vat_id:state.vatId,
      iban:state.iban,
      bank_name:state.bankName,
      onboarding_version:VERSION,
      onboarding_completed_at:now(),
      onboarding_started_at:company.onboarding_started_at||now()
    };
    saving=true;
    setSaveError('');
    const finishBtn=q('businessSetupFinish');
    if(finishBtn){finishBtn.disabled=true;finishBtn.textContent='Speichert …'}
    try{
      const {data,error}=await client.from('companies').update(patch).eq('id',company.id).select('*').single();
      if(error)throw error;
      company=Object.assign(company,data||patch);
      localApply(patch);
      applyFeatureProfile(modules,state.businessMode);
      globalThis.reconcileHomeQuickActionsForFeatures?.(true);
      saved=true;
      step=4;
      render();
      globalThis.toast?.('✓ Einrichtung gespeichert');
      q('businessSetupWizard')?.querySelector?.('.businessSetupShell')?.scrollTo?.({top:0,behavior:'smooth'});
      setTimeout(()=>globalThis.renderAll?.(),80);
    }catch(e){
      console.error('Onboarding speichern fehlgeschlagen',e);
      const offline=globalThis.navigator&&navigator.onLine===false;
      const message=offline
        ?'Keine Internetverbindung. Deine Auswahl bleibt erhalten – bitte online erneut speichern.'
        :'Einrichtung konnte nicht in der Cloud gespeichert werden. Deine Auswahl bleibt erhalten – bitte erneut versuchen.';
      setSaveError(message);
      globalThis.toast?.('Speichern fehlgeschlagen · bitte erneut versuchen');
    }finally{
      saving=false;
      if(finishBtn&&!saved){finishBtn.disabled=false;finishBtn.textContent='✓ Einrichtung speichern'}
    }
  }

  function go(destination='today'){
    if(!saved)return;
    close();
    if(destination==='import'){
      globalThis.showScreen?.('customers');
      setTimeout(()=>globalThis.openCustomerImport?.(),80);
    }else if(destination==='mail'){
      globalThis.openEmailAssistant?.();
    }else if(destination==='brand'){
      globalThis.showScreen?.('settings');
      setTimeout(()=>document.getElementById('brandLogoInput')?.scrollIntoView?.({behavior:'smooth',block:'center'}),120);
    }else globalThis.showScreen?.('today');
    setTimeout(()=>globalThis.renderAll?.(),80);
  }

  function applyFeatureProfile(modulesArg,businessModeArg){
    const modules=normalizeModules(modulesArg||company?.enabled_modules||globalThis.data?.settings?.enabledModules);
    const businessMode=businessModeArg||company?.business_mode||globalThis.data?.settings?.businessMode||'solo';
    document.documentElement.dataset.businessMode=businessMode;
    document.querySelectorAll('[data-feature]').forEach(el=>{
      const keys=(el.dataset.feature||'').split(',').map(x=>x.trim()).filter(Boolean);
      const visible=keys.every(k=>modules[k]!==false);
      el.classList.toggle('featureHidden',!visible);
      if(!visible)el.setAttribute('hidden','');else el.removeAttribute('hidden');
    });
    globalThis.data&&(globalThis.data.settings.enabledModules=modules,globalThis.data.settings.businessMode=businessMode);
  }

  async function attach(c,s,co,m){
    client=c;session=s;company=co;membership=m;
    applyFeatureProfile(company?.enabled_modules,company?.business_mode);
    if(membership?.role==='owner'&&(!company?.onboarding_completed_at||Number(company?.onboarding_version||0)<VERSION)){
      setTimeout(()=>open(false),260);
    }
  }
  function detach(){client=session=company=membership=null;close()}

  function bindOpenButtons(){
    document.querySelectorAll('[data-open-business-setup]').forEach(btn=>{
      if(btn.dataset.setupBound==='1')return;
      btn.dataset.setupBound='1';
      btn.addEventListener('click',e=>{e.preventDefault();open(true)});
    });
    ['setupTaxNumber','setupVatId','setupIban','setupBankName'].forEach(id=>{
      const el=q(id);if(!el||el.dataset.setupTouchBound==='1')return;
      el.dataset.setupTouchBound='1';
      el.addEventListener('input',()=>{el.dataset.setupTouched='1'});
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindOpenButtons,{once:true});
  else bindOpenButtons();

  globalThis.BusinessSetup={attach,detach,open,close,applyFeatureProfile,version:VERSION};
  globalThis.openBusinessSetup=()=>open(true);
  globalThis.setupNext=next;
  globalThis.setupBack=back;
  globalThis.setupSelectCountry=selectCountry;
  globalThis.setupSelectMode=selectMode;
  globalThis.setupToggleModule=toggleModule;
  globalThis.setupTaxTreatmentChanged=onTaxTreatmentChange;
  globalThis.setupFinish=finish;
  globalThis.setupGo=go;
  globalThis.setupClose=close;
})();
