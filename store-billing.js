/* AngebotsPilot v11.32.6 – Store-Billing channel guard / provider abstraction
   Web stays on Stripe. Native iOS/Android never opens Stripe checkout or portal.
   Actual App Store / Play purchases are enabled only after a verified native adapter
   and configured product ids exist. */
(function(){
  'use strict';

  const BUILD='11.32.6';
  const PLAN_ORDER=['solo','team','pro'];
  const PLAN_NAMES={solo:'Solo',team:'Team',pro:'Pro'};
  let adapter=null;
  let applying=false;
  let applyTimer=0;
  let catalog={provider:'',environment:'production',configured:false,verification_ready:false,verification_mode:'disabled',products:[]};
  let catalogPromise=null;
  let storeProducts=[];
  let storeProductsPromise=null;

  const q=id=>document.getElementById(id);
  const cloud=()=>{try{return globalThis.APCloudContext?.()||null}catch{return null}};
  const toast=(message,type='info')=>{
    if(globalThis.toast)return globalThis.toast(message,type);
    if(globalThis.showToast)return globalThis.showToast(message,type);
    console[type==='error'?'error':'log'](message);
  };

  function detectPlatform(){
    let platform='';
    try{platform=String(globalThis.Capacitor?.getPlatform?.()||'').toLowerCase()}catch{}
    if(!['ios','android'].includes(platform)){
      const hinted=String(globalThis.__AP_NATIVE_PLATFORM__||document.documentElement?.dataset?.nativePlatform||'').toLowerCase();
      if(['ios','android'].includes(hinted))platform=hinted;
    }
    const nativeFlag=!!globalThis.__ANGEBOTSPILOT_NATIVE__;
    let capNative=false;
    try{capNative=!!globalThis.Capacitor?.isNativePlatform?.()}catch{}
    if(!nativeFlag&&!capNative)return 'web';
    return ['ios','android'].includes(platform)?platform:'web';
  }
  function isNative(){return detectPlatform()!=='web'}
  function providerFor(platform=detectPlatform()){return platform==='ios'?'apple':platform==='android'?'google':'stripe'}
  function providerLabel(provider=providerFor()){
    return provider==='apple'?'Apple App Store':provider==='google'?'Google Play':'Stripe';
  }
  function storeEnvironment(){
    const explicit=String(globalThis.__AP_NATIVE_STORE_ENVIRONMENT__||'').toLowerCase();
    return explicit==='sandbox'?'sandbox':'production';
  }
  function billingState(){return globalThis.SubscriptionBilling?._state?.()||{} }
  function access(){return billingState().access||{} }
  function owner(){return cloud()?.membership?.role==='owner'}
  function hasActiveProviderSubscription(a=access()){return !!(a.has_provider_subscription&&a.status!=='cancelled')}
  function sameNativeProvider(a=access()){return a.billing_provider===providerFor()}
  function nativeAdapter(){return adapter||globalThis.APNativeStoreBilling||null}
  function adapterReady(){const a=nativeAdapter();return !!(a&&typeof a.purchase==='function'&&typeof a.restore==='function')}
  function productFor(plan){return (catalog.products||[]).find(p=>p.plan===plan)||null}
  function storeProductFor(plan){return (storeProducts||[]).find(p=>p.plan===plan)||null}
  function expectedVerificationMode(){return providerFor()==='apple'?'app_store_server_api':providerFor()==='google'?'google_play_developer_api':'disabled'}
  function verificationReady(){return !!(catalog.verification_ready&&catalog.verification_mode===expectedVerificationMode())}

  async function loadStoreProducts(force=false){
    if(!isNative()||!catalog.configured||!verificationReady()||!adapterReady()||!(catalog.products||[]).length){storeProducts=[];return storeProducts}
    if(storeProductsPromise&&!force)return storeProductsPromise;
    const bridge=nativeAdapter();
    if(typeof bridge?.loadProducts!=='function'){storeProducts=[];return storeProducts}
    storeProductsPromise=(async()=>{
      try{
        const items=await bridge.loadProducts({provider:providerFor(),environment:catalog.environment,products:catalog.products});
        storeProducts=Array.isArray(items)?items.filter(x=>PLAN_ORDER.includes(x?.plan)):[];
      }catch(e){console.warn('Store-Produkte konnten nicht geladen werden',e);storeProducts=[]}
      return storeProducts;
    })().finally(()=>{storeProductsPromise=null;scheduleApply()});
    return storeProductsPromise;
  }

  async function loadCatalog(force=false){
    if(!isNative())return catalog;
    if(catalogPromise&&!force)return catalogPromise;
    catalogPromise=(async()=>{
      const ctx=cloud(),provider=providerFor(),environment=storeEnvironment();
      catalog={provider,environment,configured:false,verification_ready:false,verification_mode:'disabled',products:[]};
      storeProducts=[];
      if(!ctx?.client||!ctx?.session)return catalog;
      try{
        const {data,error}=await ctx.client.rpc('get_store_billing_catalog',{target_provider:provider,target_environment:environment});
        if(error)throw error;
        catalog={
          provider:data?.provider||provider,
          environment:data?.environment||environment,
          configured:!!data?.configured,
          verification_ready:!!data?.verification_ready,
          verification_mode:String(data?.verification_mode||'disabled'),
          products:Array.isArray(data?.products)?data.products:[]
        };
        if(catalog.configured&&verificationReady()&&adapterReady())await loadStoreProducts(true);
      }catch(e){
        console.warn('Store-Billing-Katalog konnte nicht geladen werden',e);
      }
      return catalog;
    })().finally(()=>{catalogPromise=null;scheduleApply()});
    return catalogPromise;
  }

  function nativeUnavailableText(){
    if(!verificationReady())return providerFor()==='apple'?'App-Store-Verifikation wird eingerichtet.':'Google-Play-Verifikation wird eingerichtet.';
    return providerFor()==='apple'?'App-Store-Abos werden eingerichtet.':'Google-Play-Abos werden eingerichtet.';
  }
  function externalProviderMessage(a=access()){
    if(a.billing_provider==='stripe')return 'Dieses Abo wurde außerhalb der App abgeschlossen. Es bleibt hier vollständig gültig. Vertrags- und Zahlungsverwaltung erfolgen dort, wo das Abo abgeschlossen wurde.';
    if(a.billing_provider==='apple')return 'Dieses Abo wird über den Apple App Store verwaltet.';
    if(a.billing_provider==='google')return 'Dieses Abo wird über Google Play verwaltet.';
    return 'Dieses Abo wird über den ursprünglichen Zahlungsanbieter verwaltet.';
  }

  async function purchase(plan){
    if(!isNative())return globalThis.SubscriptionBilling?.__webStartCheckout?.(plan);
    if(!owner())return toast('Nur der Inhaber kann das Abo verwalten.','error');
    if(!PLAN_ORDER.includes(plan))return toast('Unbekannter Tarif.','error');
    const a=access();
    if(hasActiveProviderSubscription(a)&&!sameNativeProvider(a))return toast(externalProviderMessage(a),'info');
    await loadCatalog();
    const product=productFor(plan);
    if(!catalog.configured||!verificationReady()||!product)return toast(nativeUnavailableText(),'info');
    const bridge=nativeAdapter();
    if(!adapterReady())return toast('Store-Kauf ist in diesem Build noch nicht freigeschaltet.','info');
    await loadStoreProducts();
    if(!storeProductFor(plan))return toast('Der Store-Tarif konnte nicht sicher geladen werden. Bitte später erneut versuchen.','error');
    try{
      const result=await bridge.purchase({provider:providerFor(),environment:catalog.environment,plan,productId:product.product_id,planIdentifier:product.plan_identifier||'',companyId:cloud()?.company?.id||''});
      if(result?.cancelled)return;
      toast('Store-Kauf wurde übermittelt. Der Abo-Status wird serverseitig geprüft.','success');
      setTimeout(()=>globalThis.SubscriptionBilling?.refresh?.({silent:true}),900);
    }catch(e){console.error(e);toast(String(e?.message||'Store-Kauf konnte nicht abgeschlossen werden.'),'error')}
  }

  async function restore(){
    if(!isNative())return;
    if(!owner())return toast('Nur der Inhaber kann Käufe wiederherstellen.','error');
    await loadCatalog();
    if(!catalog.configured||!verificationReady())return toast(nativeUnavailableText(),'info');
    const bridge=nativeAdapter();
    if(!adapterReady())return toast('Käufe wiederherstellen ist in diesem Build noch nicht freigeschaltet.','info');
    try{
      await bridge.restore({provider:providerFor(),environment:catalog.environment,companyId:cloud()?.company?.id||'',products:catalog.products});
      toast('Käufe wurden geprüft. Der Abo-Status wird aktualisiert.','success');
      setTimeout(()=>globalThis.SubscriptionBilling?.refresh?.({silent:true}),700);
    }catch(e){console.error(e);toast(String(e?.message||'Käufe konnten nicht wiederhergestellt werden.'),'error')}
  }

  async function manage(){
    if(!isNative())return globalThis.SubscriptionBilling?.__webOpenPortal?.();
    if(!owner())return toast('Nur der Inhaber kann das Abo verwalten.','error');
    const a=access();
    if(!hasActiveProviderSubscription(a))return toast('Noch kein aktives Abo vorhanden.','info');
    if(!sameNativeProvider(a))return toast(externalProviderMessage(a),'info');
    const bridge=nativeAdapter();
    if(typeof bridge?.manage!=='function')return toast(`Öffne die Abo-Verwaltung in ${providerLabel()}.`,'info');
    try{await bridge.manage({provider:providerFor(),productId:a.provider_product_id||'',companyId:cloud()?.company?.id||''})}
    catch(e){console.error(e);toast(String(e?.message||'Abo-Verwaltung konnte nicht geöffnet werden.'),'error')}
  }

  function ensureStyles(){
    if(q('apStoreBillingStyles'))return;
    const style=document.createElement('style');style.id='apStoreBillingStyles';style.textContent=`
      .storeBillingCard{margin-top:12px}.storeBillingHead{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}.storeBillingHead h3{margin:3px 0 4px}.storeBillingHead p{margin:0;color:var(--muted);font-size:.78rem;line-height:1.45}.storeBillingBadge{font-size:.68rem;font-weight:850;padding:6px 8px;border-radius:999px;border:1px solid var(--line);white-space:nowrap}.storeBillingActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.storeBillingActions .btn{flex:1;min-width:150px}.storeBillingNotice{padding:11px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.025);font-size:.78rem;line-height:1.45;margin-top:10px}@media(max-width:720px){.storeBillingActions .btn{width:100%;flex-basis:100%}}
    `;document.head.appendChild(style);
  }

  function hideStripeBillingForm(){
    const save=q('subscriptionBillingSave');
    const card=save?.closest?.('.card');
    if(card)card.hidden=true;
    const title=card?.previousElementSibling;
    if(title?.classList?.contains('sectionTitle'))title.hidden=true;
  }
  function showStripeBillingForm(){
    const save=q('subscriptionBillingSave');
    const card=save?.closest?.('.card');
    if(card)card.hidden=false;
    const title=card?.previousElementSibling;
    if(title?.classList?.contains('sectionTitle'))title.hidden=false;
  }

  function renderNativePlanActions(){
    const host=q('subscriptionPlanGrid');if(!host)return;
    const a=access(),active=hasActiveProviderSubscription(a),nativeProvider=sameNativeProvider(a);
    [...host.querySelectorAll('.subscriptionPlanCard')].forEach((card,index)=>{
      const plan=PLAN_ORDER[index];if(!plan)return;
      const product=productFor(plan),storeProduct=storeProductFor(plan);
      const priceBox=card.querySelector('.subscriptionPricePending');
      if(priceBox&&(!active||nativeProvider)){
        priceBox.replaceChildren();
        const strong=document.createElement('strong');
        strong.textContent=storeProduct?.priceString||(!catalog.configured?'Store-Preis folgt':'Preis wird geladen …');
        priceBox.append(strong);
        if(storeProduct?.priceString)priceBox.append(document.createTextNode(' / Monat'));
      }
      let btn=card.querySelector('.subscriptionPlanAction');
      if(!btn){btn=document.createElement('button');btn.type='button';btn.className='btn small subscriptionPlanAction';card.appendChild(btn)}
      btn.onclick=null;btn.removeAttribute('onclick');btn.disabled=false;
      if(!owner()){btn.hidden=true;return}
      btn.hidden=false;
      if(active&&!nativeProvider){btn.textContent='Externes Abo aktiv';btn.disabled=true;return}
      if(active&&nativeProvider&&plan===a.plan){btn.textContent='Abo verwalten';btn.onclick=()=>manage();return}
      const ready=!!(catalog.configured&&verificationReady()&&product&&storeProduct&&adapterReady());
      if(active&&nativeProvider){btn.textContent=ready?`Zu ${PLAN_NAMES[plan]} wechseln`:'Store-Tarif nicht verfügbar';btn.disabled=!ready;if(ready)btn.onclick=()=>purchase(plan);return}
      btn.textContent=ready?(providerFor()==='apple'?'Im App Store wählen':'Bei Google Play wählen'):'Store-Billing folgt';
      btn.disabled=!ready;
      if(ready)btn.onclick=()=>purchase(plan);
    });
  }

  function renderNativeManagement(){
    const planGrid=q('subscriptionPlanGrid');if(!planGrid)return;
    let host=q('storeBillingManagementCard');
    if(!host){host=document.createElement('div');host.id='storeBillingManagementCard';host.className='card storeBillingCard';planGrid.insertAdjacentElement('afterend',host)}
    const a=access(),active=hasActiveProviderSubscription(a),same=sameNativeProvider(a);
    const period=a.current_period_end?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(a.current_period_end)):'–';
    const label=providerLabel(a.billing_provider);
    const html=`<div class="storeBillingHead"><div><span class="subscriptionEyebrow">STORE & ZUGANG</span><h3>${active?`${PLAN_NAMES[a.plan]||'Abo'} aktiv`:'Abo über den Store'}</h3><p>${active?externalProviderMessage(a):`Neue Käufe in dieser App werden ausschließlich über ${providerLabel()} abgewickelt.`}</p></div><span class="storeBillingBadge">${active?label:providerLabel()}</span></div>${active&&a.current_period_end?`<div class="storeBillingNotice">${a.cancel_at_period_end?'Nutzbar bis':'Aktuelle Periode bis'} <b>${period}</b></div>`:''}<div class="storeBillingActions">${active&&same?'<button class="btn primary" type="button" id="storeBillingManageButton">Abo verwalten</button>':''}<button class="btn" type="button" id="storeBillingRestoreButton" ${catalog.configured&&verificationReady()&&adapterReady()?'':'disabled'}>Käufe wiederherstellen</button></div>${(!catalog.configured||!verificationReady())?`<div class="storeBillingNotice">${nativeUnavailableText()} Bestehende Web-Abos funktionieren weiterhin.</div>`:''}`;
    if(host.innerHTML!==html)host.innerHTML=html;
    q('storeBillingManageButton')?.addEventListener('click',manage);
    q('storeBillingRestoreButton')?.addEventListener('click',restore);
  }

  function renderNativeProviderUI(){
    const a=access();
    const provider=q('subscriptionPaymentProvider');
    if(provider){
      const label=hasActiveProviderSubscription(a)?(a.billing_provider==='stripe'?'Web-Abo · aktiv':`${providerLabel(a.billing_provider)} · aktiv`):`${providerLabel()} · noch kein Store-Abo`;if(provider.textContent!==label)provider.textContent=label;
    }
    const gateway=q('subscriptionGatewayStatus');if(gateway)gateway.hidden=true;
    const portal=q('subscriptionPortalButton');if(portal)portal.hidden=true;
    const paymentHint=document.querySelector('#subscription .subscriptionPaymentHint');
    if(paymentHint){const label=`Käufe in dieser App werden über ${providerLabel()} abgewickelt. Bestehende Web-Abos bleiben gültig; die App öffnet dafür keinen externen Checkout.`;if(paymentHint.textContent!==label)paymentHint.textContent=label}
    const oldManage=q('subscriptionManagementCard');if(oldManage)oldManage.hidden=true;
    hideStripeBillingForm();
    const status=q('subscriptionStatusCard')?.querySelector('.subscriptionStatusHead p');
    if(status&&hasActiveProviderSubscription(a)&&a.billing_provider!=='test'){
      const extra=a.current_period_end?` · bis ${new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(a.current_period_end))}`:'';
      const label=`${a.billing_provider==='stripe'?'Web-Abo':providerLabel(a.billing_provider)} aktiv${extra}`;if(status.textContent!==label)status.textContent=label;
    }
    const legal=q('subscriptionLegalCard');
    if(legal){
      const boxes=[...legal.querySelectorAll('.subscriptionLegalGrid small')];
      const payment=boxes.find(x=>/Zahlungsdaten verarbeitet Stripe|Abo-Belege/i.test(x.textContent||''));
      if(payment){const label=`Käufe innerhalb der nativen App werden über ${providerLabel()} abgewickelt. Bestehende Abos anderer Anbieter behalten ihren Zugang und werden beim ursprünglichen Anbieter verwaltet.`;if(payment.textContent!==label)payment.textContent=label}
    }
  }

  function applyUI(){
    if(applying)return;applying=true;
    try{
      document.documentElement.dataset.billingChannel=isNative()?providerFor():'stripe';
      if(!isNative()){
        q('subscriptionGatewayStatus')?.removeAttribute('hidden');
        showStripeBillingForm();
        q('storeBillingManagementCard')?.remove();
        return;
      }
      ensureStyles();
      renderNativeProviderUI();
      renderNativePlanActions();
      renderNativeManagement();
    }finally{applying=false}
  }
  function scheduleApply(){clearTimeout(applyTimer);applyTimer=setTimeout(applyUI,40)}

  function installGuards(){
    const b=globalThis.SubscriptionBilling;if(!b||b.__storeChannelGuardInstalled)return false;
    b.__storeChannelGuardInstalled=true;
    b.__webStartCheckout=b.startCheckout?.bind(b);
    b.__webChangePlan=b.changePlan?.bind(b);
    b.__webCancelSubscription=b.cancelSubscription?.bind(b);
    b.__webResumeSubscription=b.resumeSubscription?.bind(b);
    b.__webOpenPortal=b.openPortal?.bind(b);
    b.startCheckout=(plan)=>isNative()?purchase(plan):b.__webStartCheckout?.(plan);
    b.changePlan=(plan)=>isNative()?purchase(plan):b.__webChangePlan?.(plan);
    b.cancelSubscription=()=>isNative()?manage():b.__webCancelSubscription?.();
    b.resumeSubscription=()=>isNative()?manage():b.__webResumeSubscription?.();
    b.openPortal=()=>isNative()?manage():b.__webOpenPortal?.();
    b.scrollManage=()=>isNative()?manage():(q('subscriptionManagementCard')&&!q('subscriptionManagementCard').hidden?q('subscriptionManagementCard').scrollIntoView({behavior:'smooth',block:'center'}):b.__webOpenPortal?.());
    const originalRefresh=b.refresh?.bind(b);
    if(originalRefresh)b.refresh=async function(){const result=await originalRefresh(...arguments);scheduleApply();return result};
    const originalExplain=b.explainPayment?.bind(b);
    b.explainPayment=()=>isNative()?toast(`Käufe in dieser App laufen über ${providerLabel()}. AngebotsPilot erhält keine Karten- oder Bankdaten. Bestehende Web-Abos bleiben gültig.`,'info'):originalExplain?.();
    return true;
  }

  function registerAdapter(next){adapter=next||null;storeProducts=[];loadCatalog(true);scheduleApply()}

  globalThis.StoreBilling={BUILD,detectPlatform,isNative,providerFor,providerLabel,storeEnvironment,loadCatalog,loadStoreProducts,purchase,restore,manage,registerAdapter,applyUI,_state:()=>({platform:detectPlatform(),provider:providerFor(),environment:storeEnvironment(),catalog:{...catalog},storeProducts:[...storeProducts],adapterReady:adapterReady()})};

  document.addEventListener('DOMContentLoaded',()=>{
    const boot=setInterval(()=>{if(installGuards()){clearInterval(boot);loadCatalog();scheduleApply()}},80);
    setTimeout(()=>clearInterval(boot),8000);
    const root=q('subscription');if(root){const observer=new MutationObserver(scheduleApply);observer.observe(root,{childList:true,subtree:true,characterData:true})}
    window.addEventListener('angebotspilot:syncstate',scheduleApply);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleApply()});
  });
})();
