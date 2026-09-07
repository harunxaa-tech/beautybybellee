/* AngebotsPilot v11.28 – geführte Betriebseinrichtung */
(function(){
  'use strict';

  const VERSION=1128;
  let client=null,session=null,company=null,membership=null;
  let step=0,manualOpen=false,saving=false;
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
    return {
      countryCode:['DE','AT','CH'].includes(country)?country:'DE',
      businessMode:c.business_mode||'solo',
      modules,
      taxTreatment:treatment,
      taxRate:Number(c.tax_rate??globalThis.data?.settings?.tax??profile.standardRate??0)||0,
      paymentDays:Math.max(0,Number(c.payment_days??7)||7),
      taxNumber:c.tax_number||'',
      vatId:c.vat_id||'',
      iban:c.iban||'',
      bankName:c.bank_name||''
    };
  }

  function setHidden(el,hidden){
    if(!el)return;
    el.hidden=!!hidden;
    el.classList.toggle('hidden',!!hidden);
    if(hidden)el.setAttribute('aria-hidden','true');else el.removeAttribute('aria-hidden');
  }

  function treatmentOptions(){
    const country=state.countryCode||'DE';
    const profile=globalThis.APCountry?.country?.(country);
    const list=profile?.treatments||['standard'];
    const labels=globalThis.APCountry?.TREATMENTS||{};
    return list.map(code=>`<option value="${code}" ${code===state.taxTreatment?'selected':''}>${escapeHtml(labels[code]?.label||code)}</option>`).join('');
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
    const progress=q('businessSetupProgress');if(progress)progress.style.width=`${((step+1)/4)*100}%`;
    const back=q('businessSetupBack');if(back)setHidden(back,step===0);
    const skip=q('businessSetupLater');if(skip)setHidden(skip,step===3&&!manualOpen);

    document.querySelectorAll('[data-setup-country]').forEach(btn=>btn.classList.toggle('active',btn.dataset.setupCountry===state.countryCode));
    document.querySelectorAll('[data-setup-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.setupMode===state.businessMode));
    document.querySelectorAll('[data-setup-module]').forEach(btn=>{
      const key=btn.dataset.setupModule;
      btn.classList.toggle('active',!!state.modules[key]);
      btn.setAttribute('aria-pressed',String(!!state.modules[key]));
      if(key==='team')btn.classList.toggle('suggested',state.businessMode==='team');
    });

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
      const labels=['Angebote & Rechnungen'];
      if(state.modules.jobs)labels.push('Baustellen');
      if(state.modules.secretariat)labels.push('Sekretariat');
      if(state.modules.team)labels.push('Team & Zeiten');
      q('setupModuleSummary').textContent=labels.join(' · ');
    }
  }

  async function markStarted(){
    if(!client||!company?.id||membership?.role!=='owner'||company.onboarding_started_at)return;
    const started=now();
    const {error}=await client.from('companies').update({onboarding_started_at:started}).eq('id',company.id);
    if(!error)company.onboarding_started_at=started;
  }

  function open(isManual=false){
    if(!company||membership?.role!=='owner')return;
    manualOpen=!!isManual;
    state=initialState();
    if(state.businessMode==='team'){state.modules.team=true;state.modules.time_tracking=true;}
    syncTaxForCountry();
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

  function readFields(){
    if(q('setupTaxTreatment'))state.taxTreatment=q('setupTaxTreatment').value||state.taxTreatment;
    if(q('setupTaxRate')&&!q('setupTaxRate').disabled)state.taxRate=Number(q('setupTaxRate').value)||0;
    if(forcesZero(state.taxTreatment))state.taxRate=0;
    state.paymentDays=Math.min(365,Math.max(0,Number(q('setupPaymentDays')?.value)||7));
    state.taxNumber=q('setupTaxNumber')?.value.trim()||'';
    state.vatId=q('setupVatId')?.value.trim()||'';
    state.iban=q('setupIban')?.value.trim()||'';
    state.bankName=q('setupBankName')?.value.trim()||'';
  }

  function next(){
    readFields();
    if(step===0){
      if(state.businessMode==='team'){
        state.modules.team=true;
        state.modules.time_tracking=true;
      }
    }
    step=Math.min(3,step+1);render();
  }
  function back(){step=Math.max(0,step-1);render()}

  function selectCountry(code){
    if(!['DE','AT','CH'].includes(code))return;
    state.countryCode=code;syncTaxForCountry();render();
  }
  function selectMode(mode){
    if(!['solo','team'].includes(mode))return;
    state.businessMode=mode;
    if(mode==='team'){state.modules.team=true;state.modules.time_tracking=true}
    else {state.modules.team=false;state.modules.time_tracking=false}
    render();
  }
  function toggleModule(key){
    if(!['jobs','secretariat','team'].includes(key))return;
    state.modules[key]=!state.modules[key];
    if(key==='jobs'){
      state.modules.weather=state.modules.jobs;
      state.modules.acceptance=state.modules.jobs;
    }
    if(key==='team'){
      state.modules.time_tracking=state.modules.team;
      state.businessMode=state.modules.team?'team':'solo';
    }
    render();
  }

  function onTaxTreatmentChange(){
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

  async function finish(destination='today'){
    if(saving)return;
    readFields();syncTaxForCountry();
    const profile=globalThis.APCountry?.country?.(state.countryCode)||{};
    const modules=normalizeModules(state.modules);
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
    q('businessSetupFinish')?.setAttribute('disabled','');
    try{
      const {data,error}=await client.from('companies').update(patch).eq('id',company.id).select('*').single();
      if(error)throw error;
      company=Object.assign(company,data||patch);
      localApply(patch);
      applyFeatureProfile(modules,state.businessMode);
      globalThis.reconcileHomeQuickActionsForFeatures?.(true);
      close();
      globalThis.toast?.('✓ Betrieb eingerichtet');
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
    }catch(e){
      console.error('Onboarding speichern fehlgeschlagen',e);
      globalThis.toast?.('Einrichtung konnte nicht gespeichert werden');
    }finally{
      saving=false;
      q('businessSetupFinish')?.removeAttribute('disabled');
    }
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

  globalThis.BusinessSetup={attach,detach,open,close,applyFeatureProfile,version:VERSION};
  globalThis.openBusinessSetup=()=>open(true);
  globalThis.setupNext=next;
  globalThis.setupBack=back;
  globalThis.setupSelectCountry=selectCountry;
  globalThis.setupSelectMode=selectMode;
  globalThis.setupToggleModule=toggleModule;
  globalThis.setupTaxTreatmentChanged=onTaxTreatmentChange;
  globalThis.setupFinish=finish;
  globalThis.setupClose=close;
})();
