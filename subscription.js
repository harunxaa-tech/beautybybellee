/* AngebotsPilot v11.30.1 – Stripe test-billing foundation
   Shared by Web, iOS and later Android. Stripe secrets stay server-side in Supabase Edge Functions. */
(function(){
  'use strict';

  const BUILD='11.30.1';
  const q=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const state={access:null,invoices:[],gateway:{configured:false,webhook_configured:false,plans:{solo:false,team:false,pro:false},has_customer:false,has_subscription:false},loading:false,lastCompanyId:'',refreshTimer:null};

  const PLANS={
    solo:{name:'Solo',icon:'👤',summary:'Für Selbstständige und Ein-Personen-Betriebe',details:'Kunden, Angebote, Rechnungen, Baustellen und Kalender.'},
    team:{name:'Team',icon:'👥',summary:'Für kleine Teams',details:'Gemeinsame Arbeit mit Team, Zuweisungen und Zeiterfassung.'},
    pro:{name:'Pro',icon:'✦',summary:'Für Betriebe mit mehr Automatisierung',details:'Erweiterte Abläufe wie Sekretariat, Automationen und zusätzliche Profi-Funktionen.'}
  };

  const STATUS={
    trial:{label:'Testphase',tone:'info',icon:'⏳'},
    active:{label:'Aktiv',tone:'success',icon:'✓'},
    past_due:{label:'Zahlung offen',tone:'warning',icon:'!'},
    grace_period:{label:'Kulanzfrist',tone:'warning',icon:'!'},
    restricted:{label:'Eingeschränkt',tone:'danger',icon:'🔒'},
    cancelled:{label:'Beendet',tone:'danger',icon:'×'}
  };

  function ctx(){
    try{return globalThis.APCloudContext?.()||null}catch(e){return null}
  }

  function toast(message,type='info'){
    if(globalThis.toast){globalThis.toast(message,type);return}
    if(globalThis.showToast){globalThis.showToast(message,type);return}
    if(globalThis.appToast){globalThis.appToast(message,type);return}
    console[type==='error'?'error':'log'](message);
  }

  function formatDate(value){
    if(!value)return '–';
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return '–';
    return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
  }

  function formatMoney(cents,currency='EUR'){
    return new Intl.NumberFormat('de-DE',{style:'currency',currency:currency||'EUR'}).format((Number(cents)||0)/100);
  }

  function daysLeft(value){
    if(!value)return null;
    const ms=new Date(value).getTime()-Date.now();
    if(!Number.isFinite(ms))return null;
    return Math.max(0,Math.ceil(ms/86400000));
  }

  function statusInfo(access=state.access){
    const key=access?.effective_status||access?.status||'active';
    return {key,...(STATUS[key]||STATUS.active)};
  }

  function isOwner(){return ctx()?.membership?.role==='owner'}

  function gatewayReady(plan=''){
    const g=state.gateway||{};
    return !!(g.configured&&g.webhook_configured&&(!plan||g.plans?.[plan]));
  }

  async function openExternal(url){
    if(!url)return;
    try{
      const browser=globalThis.Capacitor?.Plugins?.Browser;
      if(globalThis.__ANGEBOTSPILOT_NATIVE__&&browser?.open){await browser.open({url});return}
    }catch(e){console.warn('Native Browser konnte nicht geöffnet werden',e)}
    location.assign(url);
  }

  async function invokeBilling(action,extra={}){
    const context=ctx();
    if(!context?.client||!context?.company?.id)throw new Error('Betriebskonto fehlt.');
    const {data,error}=await context.client.functions.invoke('stripe-billing',{body:{action,company_id:context.company.id,return_url:location.origin+location.pathname,...extra}});
    if(error){
      const message=data?.message||data?.error||error?.context?.message||error?.message||'Stripe-Anfrage fehlgeschlagen.';
      const err=new Error(String(message));err.code=data?.error||'';throw err;
    }
    if(data?.error){const err=new Error(String(data.message||data.error));err.code=data.error;throw err}
    return data||{};
  }

  async function refreshGateway(){
    if(!isOwner()){state.gateway={configured:false,webhook_configured:false,plans:{solo:false,team:false,pro:false},has_customer:false,has_subscription:false};return state.gateway}
    try{
      const data=await invokeBilling('status');
      state.gateway={configured:!!data.configured,webhook_configured:!!data.webhook_configured,plans:{solo:!!data.plans?.solo,team:!!data.plans?.team,pro:!!data.plans?.pro},has_customer:!!data.has_customer,has_subscription:!!data.has_subscription,livemode:!!data.livemode};
    }catch(e){console.warn('Stripe-Status nicht verfügbar',e);state.gateway={configured:false,webhook_configured:false,plans:{solo:false,team:false,pro:false},has_customer:!!state.access?.has_provider_customer,has_subscription:!!state.access?.has_provider_subscription}}
    return state.gateway;
  }

  function stampBuild(){
    document.querySelectorAll('[data-app-build]').forEach(el=>{el.textContent=BUILD});
  }


  function wrapBuildStamp(){
    const original=globalThis.renderAll;
    if(typeof original==='function'&&!original.__subscriptionBuildWrapped){
      const wrapped=function(){const result=original.apply(this,arguments);stampBuild();return result};
      wrapped.__subscriptionBuildWrapped=true;
      globalThis.renderAll=wrapped;
    }
    const originalShow=globalThis.showScreen;
    if(typeof originalShow==='function'&&!originalShow.__subscriptionBuildWrapped){
      const wrappedShow=function(){const result=originalShow.apply(this,arguments);stampBuild();return result};
      wrappedShow.__subscriptionBuildWrapped=true;
      globalThis.showScreen=wrappedShow;
    }
  }

  function ensureBanner(){
    let el=q('subscriptionGlobalBanner');
    if(el)return el;
    el=document.createElement('button');
    el.type='button';
    el.id='subscriptionGlobalBanner';
    el.className='subscriptionGlobalBanner hidden';
    el.addEventListener('click',()=>globalThis.openSubscription?.());
    const header=document.querySelector('.top');
    header?.insertAdjacentElement('afterend',el);
    return el;
  }

  function renderBanner(){
    const el=ensureBanner();
    const a=state.access;
    if(!a){el.classList.add('hidden');return}
    const s=statusInfo(a);
    let show=false,title='',text='';
    if(s.key==='trial'){
      const left=daysLeft(a.trial_ends_at);
      show=left!==null&&left<=3;
      title='Testphase endet bald';
      text=left===0?'Heute endet deine Testphase.':`Noch ${left} ${left===1?'Tag':'Tage'} kostenlos testen.`;
    }else if(s.key==='past_due'){
      show=true;title='Zahlung konnte nicht abgeschlossen werden';text='Bitte prüfe bald deine Zahlungsmethode. Dein Betrieb bleibt vorerst aktiv.';
    }else if(s.key==='grace_period'){
      show=true;title='Kulanzfrist läuft';
      const left=daysLeft(a.grace_ends_at);text=left===null?'Bitte Zahlungsdaten prüfen.':`Noch ${left} ${left===1?'Tag':'Tage'}, bevor neue Änderungen eingeschränkt werden.`;
    }else if(s.key==='restricted'){
      show=true;title='AngebotsPilot ist im Lesemodus';text='Deine Daten bleiben sichtbar und exportierbar. Für neue Änderungen muss das Abo wieder aktiviert werden.';
    }else if(s.key==='cancelled'){
      show=true;title='Abo beendet';text='Deine vorhandenen Daten bleiben erreichbar. Neue Änderungen sind eingeschränkt.';
    }
    el.className=`subscriptionGlobalBanner subscriptionBanner-${s.tone}${show?'':' hidden'}`;
    el.innerHTML=show?`<span class="subscriptionBannerIcon">${s.icon}</span><span><b>${esc(title)}</b><small>${esc(text)}</small></span><em>Öffnen ›</em>`:'';
  }

  function applyAccessMode(){
    const restricted=state.access&&state.access.can_write===false;
    document.body.classList.toggle('subscriptionReadOnly',!!restricted);
    document.documentElement.dataset.subscriptionAccess=restricted?'restricted':'write';
    renderBanner();
  }

  function renderPlanCards(){
    const host=q('subscriptionPlanGrid');
    if(!host)return;
    const current=state.access?.plan||'solo';
    const stripeSub=state.access?.billing_provider==='stripe'&&state.access?.has_provider_subscription;
    host.innerHTML=Object.entries(PLANS).map(([code,p])=>{
      const ready=gatewayReady(code),same=code===current;
      let action='';
      if(isOwner()&&stripeSub)action=`<button class="btn small subscriptionPlanAction" type="button" onclick="SubscriptionBilling.openPortal()">${same?'Abo verwalten':'Tarif im Portal ändern'}</button>`;
      else if(isOwner())action=`<button class="btn small subscriptionPlanAction" type="button" ${ready?'': 'disabled'} onclick="SubscriptionBilling.startCheckout('${code}')">${ready?'Im Test-Checkout wählen':'Stripe-Testkonto fehlt'}</button>`;
      return `<article class="subscriptionPlanCard ${same?'current':''}">
        <div class="subscriptionPlanTop"><span>${p.icon}</span>${same?'<em>Aktuell</em>':''}</div>
        <h3>${esc(p.name)}</h3><p>${esc(p.summary)}</p><small>${esc(p.details)}</small>
        <div class="subscriptionPricePending">Preis wird vor der Beta festgelegt</div>${action}
      </article>`;
    }).join('');
  }

  function renderInvoices(){
    const host=q('subscriptionInvoiceList');
    if(!host)return;
    if(!state.invoices.length){
      host.innerHTML='<div class="subscriptionEmpty"><span>🧾</span><b>Noch keine Abo-Rechnungen</b><p>Nach einer Stripe-Testzahlung erscheint der Beleg hier automatisch. Vor dem Livegang archivieren wir zusätzlich eine eigene unveränderbare Belegkopie.</p></div>';
      return;
    }
    host.innerHTML=state.invoices.map(inv=>{
      const title=inv.invoice_number||'Abo-Rechnung';
      const status=inv.status==='paid'?'Bezahlt':inv.status==='open'?'Offen':inv.status==='void'?'Storniert':inv.status==='uncollectible'?'Nicht einziehbar':'Entwurf';
      const url=inv.provider_pdf_url||inv.hosted_invoice_url||'';
      const action=url?`<button class="btn small" type="button" onclick="SubscriptionBilling.openInvoice(decodeURIComponent('${encodeURIComponent(url)}'))">Beleg öffnen</button>`:'';
      return `<div class="subscriptionInvoiceRow"><div><b>${esc(title)}</b><small>${formatDate(inv.invoice_date||inv.created_at)} · ${esc(status)}</small></div><strong>${formatMoney(inv.total_cents,inv.currency_code)}</strong>${action}</div>`;
    }).join('');
  }

  function hydrateBillingForm(){
    const a=state.access||{};
    const address=a.billing_address||{};
    if(q('subscriptionBillingName'))q('subscriptionBillingName').value=a.billing_name||ctx()?.company?.name||'';
    if(q('subscriptionBillingEmail'))q('subscriptionBillingEmail').value=a.billing_email||ctx()?.company?.email||'';
    if(q('subscriptionBillingStreet'))q('subscriptionBillingStreet').value=address.street||address.address||ctx()?.company?.address||'';
    if(q('subscriptionBillingPostal'))q('subscriptionBillingPostal').value=address.postal_code||'';
    if(q('subscriptionBillingCity'))q('subscriptionBillingCity').value=address.city||'';
    if(q('subscriptionBillingCountry'))q('subscriptionBillingCountry').value=a.billing_country_code||ctx()?.company?.country_code||'DE';
    if(q('subscriptionBillingVat'))q('subscriptionBillingVat').value=a.billing_vat_id||ctx()?.company?.vat_id||'';
  }

  function renderAccess(){
    const host=q('subscriptionStatusCard');
    if(!host)return;
    const context=ctx();
    if(!context?.session||!context?.company){
      if(q('subscriptionQuickStatus'))q('subscriptionQuickStatus').textContent='Konto verbinden';
      host.innerHTML='<div class="subscriptionEmpty"><span>☁️</span><b>Noch kein Cloud-Konto verbunden</b><p>Abo und Abrechnung werden dem Betriebskonto zugeordnet.</p><button class="btn primary" type="button" onclick="openCloudAccount()">Konto & Cloud öffnen</button></div>';
      q('subscriptionMainContent')?.classList.add('subscriptionUnavailable');
      return;
    }
    q('subscriptionMainContent')?.classList.remove('subscriptionUnavailable');
    const a=state.access||{};
    const s=statusInfo(a);
    const p=PLANS[a.plan]||PLANS.solo;
    if(q('subscriptionQuickStatus'))q('subscriptionQuickStatus').textContent=`${p.name} · ${s.label}`;
    let meta='';
    if(s.key==='trial'){
      const left=daysLeft(a.trial_ends_at);meta=left===null?'Kostenlose Testphase':`${left} ${left===1?'Tag':'Tage'} verbleibend · bis ${formatDate(a.trial_ends_at)}`;
    }else if(s.key==='active') meta=a.billing_provider==='test'?'Beta-Testmodus · keine Abbuchung':'Abo aktiv';
    else if(s.key==='past_due'||s.key==='grace_period') meta=a.grace_ends_at?`Kulanz bis ${formatDate(a.grace_ends_at)}`:'Zahlung prüfen';
    else if(s.key==='restricted') meta='Lesen und Exportieren bleiben möglich';
    else if(s.key==='cancelled') meta='Abo wurde beendet';

    host.innerHTML=`
      <div class="subscriptionStatusHead"><div class="subscriptionStatusIcon subscriptionTone-${s.tone}">${s.icon}</div><div><span class="subscriptionEyebrow">ABO-STATUS</span><h2>${esc(s.label)}</h2><p>${esc(meta)}</p></div><span class="subscriptionPlanBadge">${p.icon} ${esc(p.name)}</span></div>
      <div class="subscriptionTrustRow"><span>✓ Daten bleiben Eigentum des Betriebs</span><span>✓ Bei Sperre kein Datenverlust</span><span>✓ Abrechnung serverseitig geprüft</span></div>`;

    const provider=q('subscriptionPaymentProvider');
    if(provider)provider.textContent=a.billing_provider==='stripe'?(a.provider_livemode?'Stripe · Live':'Stripe · Testmodus'):state.gateway?.configured?'Stripe-Testkonto bereit · noch kein Abo':'Stripe technisch vorbereitet · noch nicht verbunden';
    const gateway=q('subscriptionGatewayStatus');
    if(gateway){
      const g=state.gateway||{};
      let text='Stripe-Testkonto noch nicht verbunden.';
      if(g.configured&&!g.webhook_configured)text='Stripe-Key erkannt · Webhook-Signatur fehlt noch.';
      else if(gatewayReady())text=g.livemode?'Stripe Live-Billing verbunden.':'Stripe Testmodus vollständig verbunden.';
      gateway.textContent=text;
      gateway.className=`subscriptionGatewayStatus ${gatewayReady()?'ready':g.configured?'partial':'pending'}`;
    }
    const portal=q('subscriptionPortalButton');if(portal)portal.hidden=!(isOwner()&&(a.has_provider_customer||state.gateway?.has_customer));

    const readOnly=q('subscriptionReadOnlyNote');
    if(readOnly)readOnly.hidden=a.can_write!==false;

    const ownerOnly=document.querySelectorAll('#subscription .subscriptionOwnerOnly');
    ownerOnly.forEach(el=>el.hidden=!isOwner());
    const nonOwner=q('subscriptionNonOwnerNote');if(nonOwner)nonOwner.hidden=isOwner();

    const testCard=q('subscriptionTestCard');
    if(testCard)testCard.hidden=!(isOwner()&&a.test_mode_enabled&&a.billing_provider==='test');
    if(q('subscriptionTestPlan'))q('subscriptionTestPlan').value=a.plan||'solo';
    if(q('subscriptionTestStatus'))q('subscriptionTestStatus').value=a.status||'active';
    hydrateBillingForm();
    renderPlanCards();
    renderInvoices();
    applyAccessMode();
  }

  function renderLoading(){
    const host=q('subscriptionStatusCard');
    if(host)host.innerHTML='<div class="subscriptionLoading"><span></span><div><b>Abo wird geprüft …</b><small>Sicherer Abgleich mit deinem Betriebskonto</small></div></div>';
  }

  async function loadInvoices(client,companyId){
    if(!isOwner()){state.invoices=[];return}
    const {data,error}=await client.from('subscription_invoices')
      .select('id,invoice_number,status,currency_code,total_cents,invoice_date,due_date,paid_at,document_storage_path,hosted_invoice_url,provider_pdf_url,period_start,period_end,created_at')
      .eq('company_id',companyId)
      .order('created_at',{ascending:false})
      .limit(24);
    if(error)throw error;
    state.invoices=data||[];
  }

  async function refresh(options={}){
    if(state.loading)return state.access;
    const context=ctx();
    stampBuild();
    if(!context?.client||!context?.session||!context?.company?.id){
      state.access=null;state.invoices=[];renderAccess();applyAccessMode();return null;
    }
    state.loading=true;
    if(!options.silent)renderLoading();
    try{
      const {data,error}=await context.client.rpc('get_subscription_access',{target_company:context.company.id});
      if(error)throw error;
      state.access=data||null;
      state.lastCompanyId=context.company.id;
      try{await refreshGateway()}catch(e){console.warn('Stripe-Status konnte nicht geladen werden',e)}
      try{await loadInvoices(context.client,context.company.id)}catch(e){console.warn('Abo-Rechnungen konnten nicht geladen werden',e);state.invoices=[]}
      renderAccess();
      return state.access;
    }catch(e){
      console.error('Subscription refresh failed',e);
      if(!options.silent)toast('Abo-Status konnte gerade nicht geladen werden.','error');
      renderAccess();
      return null;
    }finally{state.loading=false}
  }

  async function saveBillingProfile(){
    const context=ctx();
    if(!context?.client||!context?.company?.id)return toast('Bitte zuerst dein Betriebskonto verbinden.','error');
    if(!isOwner())return toast('Nur der Inhaber kann Rechnungsdaten ändern.','error');
    const name=q('subscriptionBillingName')?.value.trim()||'';
    const email=q('subscriptionBillingEmail')?.value.trim()||'';
    const street=q('subscriptionBillingStreet')?.value.trim()||'';
    const postal=q('subscriptionBillingPostal')?.value.trim()||'';
    const city=q('subscriptionBillingCity')?.value.trim()||'';
    const country=q('subscriptionBillingCountry')?.value||'DE';
    const vat=q('subscriptionBillingVat')?.value.trim()||'';
    if(!name)return toast('Bitte einen Rechnungsempfänger eintragen.','error');
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return toast('Bitte eine gültige Rechnungs-E-Mail eintragen.','error');
    const btn=q('subscriptionBillingSave');if(btn){btn.disabled=true;btn.textContent='Speichert …'}
    try{
      const {data,error}=await context.client.rpc('update_subscription_billing_profile',{
        target_company:context.company.id,
        new_billing_name:name,
        new_billing_email:email,
        new_billing_address:{street,postal_code:postal,city},
        new_billing_country_code:country,
        new_billing_vat_id:vat
      });
      if(error)throw error;
      if(!data)throw new Error('Rechnungsdaten wurden nicht gespeichert.');
      toast('Rechnungsdaten gespeichert.','success');
      await refresh({silent:true});
    }catch(e){console.error(e);toast('Rechnungsdaten konnten nicht gespeichert werden.','error')}
    finally{if(btn){btn.disabled=false;btn.textContent='Rechnungsdaten speichern'}}
  }

  async function simulate(){
    const context=ctx();
    if(!context?.client||!context?.company?.id||!isOwner())return;
    if(!state.access?.test_mode_enabled)return toast('Der Beta-Testmodus ist für diesen Betrieb nicht aktiv.','error');
    const plan=q('subscriptionTestPlan')?.value||state.access.plan||'solo';
    const status=q('subscriptionTestStatus')?.value||state.access.status||'active';
    const label=STATUS[status]?.label||status;
    const question=`Beta-Test: Abo-Status wirklich auf „${label}“ setzen?\n\nDamit kannst du auch den späteren Lesemodus testen. Du kannst jederzeit wieder „Aktiv“ wählen.`;
    const ok=globalThis.appConfirm?await globalThis.appConfirm({title:'Beta-Teststatus ändern',text:question,confirmLabel:'Teststatus anwenden',icon:'🧪'}):confirm(question);
    if(!ok)return;
    const btn=q('subscriptionTestApply');if(btn){btn.disabled=true;btn.textContent='Wird gesetzt …'}
    try{
      const {error}=await context.client.rpc('set_subscription_test_state',{target_company:context.company.id,new_status:status,new_plan:plan});
      if(error)throw error;
      await refresh({silent:true});
      toast(`Beta-Status: ${label}.`,'success');
    }catch(e){console.error(e);toast('Teststatus konnte nicht geändert werden.','error')}
    finally{if(btn){btn.disabled=false;btn.textContent='Teststatus anwenden'}}
  }

  async function startCheckout(plan){
    if(!isOwner())return toast('Nur der Inhaber kann das Abo verwalten.','error');
    if(!gatewayReady(plan))return toast('Stripe ist technisch vorbereitet. Als Nächstes verbinden wir das kostenlose Stripe-Testkonto und die Testpreise.','info');
    if(!state.access?.billing_name||!state.access?.billing_email)return toast('Bitte zuerst Rechnungsempfänger und Rechnungs-E-Mail speichern.','warning');
    try{
      toast('Stripe Test-Checkout wird geöffnet …','info');
      const data=await invokeBilling('checkout',{plan});
      if(data.url)await openExternal(data.url);
    }catch(e){
      console.error(e);
      if(e?.code==='subscription_exists')return openPortal();
      toast(String(e?.message||'Test-Checkout konnte nicht geöffnet werden.'),'error');
    }
  }

  async function openPortal(){
    if(!isOwner())return toast('Nur der Inhaber kann Zahlungsdaten verwalten.','error');
    try{
      const data=await invokeBilling('portal');
      if(data.url)await openExternal(data.url);
    }catch(e){console.error(e);toast(String(e?.message||'Stripe-Kundenportal konnte nicht geöffnet werden.'),'error')}
  }

  async function openInvoice(url){
    try{const u=new URL(String(url));if(!['https:'].includes(u.protocol))throw new Error('Ungültiger Beleg-Link');await openExternal(u.toString())}
    catch(e){toast('Der Beleg-Link ist ungültig.','error')}
  }

  function explainPayment(){
    toast('Stripe Checkout und Kundenportal sind serverseitig vorbereitet. Karten- und Bankdaten bleiben ausschließlich bei Stripe und werden nicht in AngebotsPilot gespeichert.','info');
  }

  function blockKnownWriteClick(event){
    if(!state.access||state.access.can_write!==false)return;
    const target=event.target?.closest?.('button,[role="button"],label,a');
    if(!target)return;
    if(target.closest('#subscription'))return;
    const code=(target.getAttribute('onclick')||'')+' '+(target.id||'')+' '+(target.textContent||'');
    const writeIntent=/(\bnew(?:Offer|Customer|Event|Task|Job|Invoice)\b|editCurrentCustomer|saveOffer|saveCustomer|saveInvoice|deleteOffer|addCatalog|upload|import|Zeit starten|Neue?s? |＋ Neu|Hinzufügen)/i.test(code);
    if(!writeIntent)return;
    event.preventDefault();event.stopImmediatePropagation();
    toast('Lesemodus: Neue Änderungen sind erst nach Reaktivierung des Abos möglich. Deine vorhandenen Daten bleiben verfügbar.','error');
    globalThis.openSubscription?.();
  }

  function handleSubscriptionError(event){
    const reason=event?.reason||event?.error;
    const text=String(reason?.message||reason||'');
    if(!text.includes('SUBSCRIPTION_RESTRICTED'))return;
    toast('Abo im Lesemodus: Diese Änderung wurde nicht gespeichert. Deine Daten bleiben erhalten.','error');
    refresh({silent:true});
  }

  globalThis.openSubscription=function(){
    globalThis.showScreen?.('subscription');
    refresh();
  };
  globalThis.SubscriptionBilling={refresh,saveBillingProfile,simulate,startCheckout,openPortal,openInvoice,explainPayment,_state:()=>({...state})};

  document.addEventListener('click',blockKnownWriteClick,true);
  window.addEventListener('unhandledrejection',handleSubscriptionError);
  window.addEventListener('error',handleSubscriptionError);
  window.addEventListener('angebotspilot:syncstate',event=>{
    const text=String(event?.detail?.lastError||'');
    if(!text.includes('SUBSCRIPTION_RESTRICTED'))return;
    toast('Abo im Lesemodus: Cloud-Änderungen sind bis zur Reaktivierung gesperrt.','error');
    refresh({silent:true});
  });

  document.addEventListener('DOMContentLoaded',()=>{
    stampBuild();wrapBuildStamp();ensureBanner();renderAccess();
    try{
      const u=new URL(location.href),billing=u.searchParams.get('billing');
      if(billing==='success'){
        toast('Stripe-Testzahlung abgeschlossen. Der Abo-Status wird automatisch abgeglichen.','success');
        u.searchParams.delete('billing');u.searchParams.delete('session_id');history.replaceState({},'',u.pathname+(u.search||'')+(u.hash||''));
        let n=0;const poll=setInterval(async()=>{n++;await refresh({silent:true});if(state.access?.billing_provider==='stripe'||n>=6)clearInterval(poll)},1800);
      }else if(billing==='cancelled'){
        toast('Stripe-Checkout wurde abgebrochen. Es wurde nichts geändert.','info');u.searchParams.delete('billing');history.replaceState({},'',u.pathname+(u.search||'')+(u.hash||''));
      }
    }catch(e){}
    let tries=0;
    const boot=setInterval(async()=>{
      tries++;
      const context=ctx();
      if(context?.session&&context?.company?.id){clearInterval(boot);await refresh({silent:true})}
      else if(tries>40){clearInterval(boot);renderAccess()}
    },500);

    state.refreshTimer=setInterval(()=>{
      const context=ctx();
      if(context?.company?.id&&(context.company.id!==state.lastCompanyId||!state.access))refresh({silent:true});
    },15000);
  });
})();
