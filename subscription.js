/* AngebotsPilot v11.30.5 – direct plan changes, Stripe billing, cancellation & B2B contract UX
   Shared by Web, iOS and later Android. Stripe secrets stay server-side in Supabase Edge Functions. */
(function(){
  'use strict';

  const BUILD='11.30.5';
  const TERMS_VERSION='2026-09-16-beta-b2b-v1';
  const q=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const state={access:null,invoices:[],gateway:{configured:false,webhook_configured:false,plans:{solo:false,team:false,pro:false},has_customer:false,has_subscription:false},loading:false,lastCompanyId:'',refreshTimer:null};

  const PLANS={
    solo:{name:'Solo',icon:'👤',priceCents:1900,summary:'Für Selbstständige und Ein-Personen-Betriebe',details:'Kunden, Angebote, Rechnungen, Baustellen und Kalender.'},
    team:{name:'Team',icon:'👥',priceCents:4900,summary:'Für kleine Teams',details:'Gemeinsame Arbeit mit Team, Zuweisungen und Zeiterfassung.'},
    pro:{name:'Pro',icon:'✦',priceCents:7900,summary:'Für Betriebe mit mehr Automatisierung',details:'Erweiterte Abläufe wie Sekretariat, Automationen und zusätzliche Profi-Funktionen.'}
  };

  const STATUS={
    trial:{label:'Testphase',tone:'info',icon:'⏳'},
    active:{label:'Aktiv',tone:'success',icon:'✓'},
    past_due:{label:'Zahlung offen',tone:'warning',icon:'!'},
    grace_period:{label:'Kulanzfrist',tone:'warning',icon:'!'},
    restricted:{label:'Eingeschränkt',tone:'danger',icon:'🔒'},
    cancelled:{label:'Beendet',tone:'danger',icon:'×'}
  };

  function ctx(){try{return globalThis.APCloudContext?.()||null}catch(e){return null}}
  function toast(message,type='info'){
    if(globalThis.toast){globalThis.toast(message,type);return}
    if(globalThis.showToast){globalThis.showToast(message,type);return}
    if(globalThis.appToast){globalThis.appToast(message,type);return}
    console[type==='error'?'error':'log'](message);
  }
  function formatDate(value){
    if(!value)return '–';
    const d=new Date(value);if(Number.isNaN(d.getTime()))return '–';
    return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
  }
  function formatMoney(cents,currency='EUR'){
    return new Intl.NumberFormat('de-DE',{style:'currency',currency:currency||'EUR'}).format((Number(cents)||0)/100);
  }
  function daysLeft(value){
    if(!value)return null;const ms=new Date(value).getTime()-Date.now();if(!Number.isFinite(ms))return null;
    return Math.max(0,Math.ceil(ms/86400000));
  }
  function statusInfo(access=state.access){const key=access?.effective_status||access?.status||'active';return {key,...(STATUS[key]||STATUS.active)}}
  function isOwner(){return ctx()?.membership?.role==='owner'}
  function gatewayReady(plan=''){const g=state.gateway||{};return !!(g.configured&&g.webhook_configured&&(!plan||g.plans?.[plan]))}
  function currentPlan(){return PLANS[state.access?.plan]||PLANS.solo}

  async function openExternal(url){
    if(!url)return;
    try{const browser=globalThis.Capacitor?.Plugins?.Browser;if(globalThis.__ANGEBOTSPILOT_NATIVE__&&browser?.open){await browser.open({url});return}}
    catch(e){console.warn('Native Browser konnte nicht geöffnet werden',e)}
    location.assign(url);
  }

  async function invokeBilling(action,extra={}){
    const context=ctx();if(!context?.client||!context?.company?.id)throw new Error('Betriebskonto fehlt.');
    const {data,error}=await context.client.functions.invoke('stripe-billing',{body:{action,company_id:context.company.id,return_url:location.origin+location.pathname,...extra}});
    if(error){const message=data?.message||data?.error||error?.context?.message||error?.message||'Stripe-Anfrage fehlgeschlagen.';const err=new Error(String(message));err.code=data?.error||'';throw err}
    if(data?.error){const err=new Error(String(data.message||data.error));err.code=data.error;throw err}
    return data||{};
  }

  async function refreshGateway(){
    if(!isOwner()){state.gateway={configured:false,webhook_configured:false,plans:{solo:false,team:false,pro:false},has_customer:false,has_subscription:false};return state.gateway}
    try{
      const data=await invokeBilling('status');
      state.gateway={configured:!!data.configured,webhook_configured:!!data.webhook_configured,plans:{solo:!!data.plans?.solo,team:!!data.plans?.team,pro:!!data.plans?.pro},has_customer:!!data.has_customer,has_subscription:!!data.has_subscription,livemode:!!data.livemode,terms_version:data.terms_version||TERMS_VERSION};
    }catch(e){
      console.warn('Stripe-Status nicht verfügbar',e);
      state.gateway={configured:false,webhook_configured:false,plans:{solo:false,team:false,pro:false},has_customer:!!state.access?.has_provider_customer,has_subscription:!!state.access?.has_provider_subscription};
    }
    return state.gateway;
  }

  function stampBuild(){document.querySelectorAll('[data-app-build]').forEach(el=>{el.textContent=BUILD})}
  function wrapBuildStamp(){
    const original=globalThis.renderAll;
    if(typeof original==='function'&&!original.__subscriptionBuildWrapped){const wrapped=function(){const result=original.apply(this,arguments);stampBuild();return result};wrapped.__subscriptionBuildWrapped=true;globalThis.renderAll=wrapped}
    const originalShow=globalThis.showScreen;
    if(typeof originalShow==='function'&&!originalShow.__subscriptionBuildWrapped){const wrappedShow=function(){const result=originalShow.apply(this,arguments);stampBuild();return result};wrappedShow.__subscriptionBuildWrapped=true;globalThis.showScreen=wrappedShow}
  }

  function ensureEnhancedStyles(){
    if(q('subscriptionEnhancedStyles'))return;
    const style=document.createElement('style');style.id='subscriptionEnhancedStyles';style.textContent=`
      .subscriptionLiveFacts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:14px}
      .subscriptionLiveFacts>div{padding:11px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.025);display:grid;gap:3px}
      .subscriptionLiveFacts span{font-size:.68rem;color:var(--muted);font-weight:750;text-transform:uppercase;letter-spacing:.04em}
      .subscriptionLiveFacts strong{font-size:.86rem}
      .subscriptionManagementCard{margin-top:12px}
      .subscriptionManageHead{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}
      .subscriptionManageHead h3{margin:3px 0 4px}.subscriptionManageHead p{margin:0;color:var(--muted);font-size:.78rem;line-height:1.4}
      .subscriptionModePill{font-size:.68rem;font-weight:850;padding:6px 8px;border-radius:999px;background:rgba(95,220,140,.08);border:1px solid rgba(95,220,140,.18);white-space:nowrap}
      .subscriptionManageActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.subscriptionManageActions .btn{flex:1;min-width:160px}
      .subscriptionCancelNotice{margin-top:11px;padding:11px;border-radius:12px;background:rgba(255,190,80,.07);border:1px solid rgba(255,190,80,.18);font-size:.78rem;line-height:1.45}
      .subscriptionLegalCard{margin-top:14px}.subscriptionLegalCard h3{margin:0 0 7px}.subscriptionLegalCard>p{margin:0;color:var(--muted);font-size:.78rem;line-height:1.5}
      .subscriptionLegalGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.subscriptionLegalGrid>div{padding:11px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.025)}
      .subscriptionLegalGrid b{display:block;font-size:.78rem;margin-bottom:3px}.subscriptionLegalGrid small{display:block;color:var(--muted);line-height:1.4}
      .subscriptionLegalActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.subscriptionLegalActions .btn{flex:1;min-width:145px}
      .subscriptionBetaLegal{margin-top:10px;font-size:.72rem;line-height:1.45;color:var(--muted)}
      .subscriptionPricePending{color:var(--text)!important;font-size:.83rem!important}.subscriptionPricePending strong{font-size:1.05rem}
      @media(max-width:720px){.subscriptionLiveFacts,.subscriptionLegalGrid{grid-template-columns:1fr}.subscriptionManageActions .btn,.subscriptionLegalActions .btn{width:100%;flex-basis:100%}}
    `;document.head.appendChild(style);
  }

  function ensureEnhancedUI(){
    ensureEnhancedStyles();
    const planGrid=q('subscriptionPlanGrid');
    if(planGrid&&!q('subscriptionManagementCard')){
      planGrid.insertAdjacentHTML('afterend',`<div class="card subscriptionManagementCard subscriptionOwnerOnly subscriptionRequiresAccount" id="subscriptionManagementCard" hidden></div>`);
    }
    const invoices=q('subscriptionInvoiceList');
    if(invoices&&!q('subscriptionLegalCard')){
      invoices.insertAdjacentHTML('afterend',`<div class="card subscriptionLegalCard subscriptionRequiresAccount" id="subscriptionLegalCard"></div>`);
    }
    const planTitle=planGrid?.previousElementSibling?.querySelector?.('p');
    if(planTitle)planTitle.textContent='Klare Monatspreise. Das Abo verlängert sich monatlich und kann zum Ende der laufenden Abrechnungsperiode gekündigt werden.';
    const paymentHint=document.querySelector('#subscription .subscriptionPaymentHint');
    if(paymentHint)paymentHint.textContent='Zahlungsdaten werden von Stripe verarbeitet und nicht in AngebotsPilot gespeichert. Kündigung und Reaktivierung sind direkt hier möglich.';
    const roadmap=document.querySelector('#subscription .subscriptionRoadmapNote');
    if(roadmap)roadmap.hidden=true;
  }

  function ensureBanner(){
    let el=q('subscriptionGlobalBanner');if(el)return el;
    el=document.createElement('button');el.type='button';el.id='subscriptionGlobalBanner';el.className='subscriptionGlobalBanner hidden';el.addEventListener('click',()=>globalThis.openSubscription?.());
    document.querySelector('.top')?.insertAdjacentElement('afterend',el);return el;
  }
  function renderBanner(){
    const el=ensureBanner(),a=state.access;if(!a){el.classList.add('hidden');return}
    const s=statusInfo(a);let show=false,title='',text='';
    if(a.cancel_at_period_end&&a.current_period_end){show=true;title='Abo gekündigt';text=`Nutzbar bis ${formatDate(a.current_period_end)}. Bis dahin kannst du die Kündigung zurücknehmen.`}
    else if(s.key==='trial'){const left=daysLeft(a.trial_ends_at);show=left!==null&&left<=3;title='Testphase endet bald';text=left===0?'Heute endet deine Testphase.':`Noch ${left} ${left===1?'Tag':'Tage'} kostenlos testen.`}
    else if(s.key==='past_due'){show=true;title='Zahlung konnte nicht abgeschlossen werden';text='Bitte prüfe bald deine Zahlungsmethode. Dein Betrieb bleibt vorerst aktiv.'}
    else if(s.key==='grace_period'){show=true;title='Kulanzfrist läuft';const left=daysLeft(a.grace_ends_at);text=left===null?'Bitte Zahlungsdaten prüfen.':`Noch ${left} ${left===1?'Tag':'Tage'}, bevor neue Änderungen eingeschränkt werden.`}
    else if(s.key==='restricted'){show=true;title='AngebotsPilot ist im Lesemodus';text='Deine Daten bleiben sichtbar und exportierbar. Für neue Änderungen muss das Abo wieder aktiviert werden.'}
    else if(s.key==='cancelled'){show=true;title='Abo beendet';text='Deine vorhandenen Daten bleiben erreichbar. Neue Änderungen sind eingeschränkt.'}
    el.className=`subscriptionGlobalBanner subscriptionBanner-${s.tone}${show?'':' hidden'}`;
    el.innerHTML=show?`<span class="subscriptionBannerIcon">${s.icon}</span><span><b>${esc(title)}</b><small>${esc(text)}</small></span><em>Öffnen ›</em>`:'';
  }
  function applyAccessMode(){const restricted=state.access&&state.access.can_write===false;document.body.classList.toggle('subscriptionReadOnly',!!restricted);document.documentElement.dataset.subscriptionAccess=restricted?'restricted':'write';renderBanner()}

  function renderPlanCards(){
    const host=q('subscriptionPlanGrid');if(!host)return;
    const current=state.access?.plan||'solo';const stripeSub=state.access?.billing_provider==='stripe'&&state.access?.has_provider_subscription;
    host.innerHTML=Object.entries(PLANS).map(([code,p])=>{
      const ready=gatewayReady(code),same=code===current;let action='';
      if(isOwner()&&stripeSub&&same)action=`<button class="btn small subscriptionPlanAction" type="button" onclick="SubscriptionBilling.scrollManage()">Abo verwalten</button>`;
      else if(isOwner()&&stripeSub&&!same){
        const ending=!!state.access?.cancel_at_period_end;
        action=`<button class="btn small subscriptionPlanAction" type="button" ${ending?'disabled':''} onclick="SubscriptionBilling.changePlan('${code}')">${ending?'Erst Kündigung zurücknehmen':`Zu ${esc(p.name)} wechseln`}</button>`;
      }else if(isOwner())action=`<button class="btn small subscriptionPlanAction" type="button" ${ready?'':'disabled'} onclick="SubscriptionBilling.startCheckout('${code}')">${ready?'Im Test-Checkout wählen':'Stripe-Testkonto fehlt'}</button>`;
      return `<article class="subscriptionPlanCard ${same?'current':''}"><div class="subscriptionPlanTop"><span>${p.icon}</span>${same?'<em>Aktuell</em>':''}</div><h3>${esc(p.name)}</h3><p>${esc(p.summary)}</p><small>${esc(p.details)}</small><div class="subscriptionPricePending"><strong>${formatMoney(p.priceCents)}</strong> / Monat</div>${action}</article>`;
    }).join('');
  }

  function renderManagement(){
    const host=q('subscriptionManagementCard');if(!host)return;
    const a=state.access||{},p=currentPlan();const stripeSub=a.billing_provider==='stripe'&&a.has_provider_subscription;
    host.hidden=!(isOwner()&&stripeSub);if(host.hidden){host.innerHTML='';return}
    const test=!a.provider_livemode;const ending=!!a.cancel_at_period_end;
    const periodLabel=ending?'Nutzbar bis':'Nächste Abrechnung';
    const periodValue=formatDate(a.current_period_end);
    host.innerHTML=`
      <div class="subscriptionManageHead"><div><span class="subscriptionEyebrow">VERTRAG & VERWALTUNG</span><h3>${p.icon} ${esc(p.name)} · ${formatMoney(p.priceCents)}/Monat</h3><p>${ending?'Die automatische Verlängerung ist beendet. Der Tarif bleibt bis zum Periodenende nutzbar.':'Monatliche Abrechnung · automatische Verlängerung bis zur Kündigung.'}</p></div><span class="subscriptionModePill">${test?'TESTMODUS':'LIVE'}</span></div>
      <div class="subscriptionLiveFacts"><div><span>Preis</span><strong>${formatMoney(p.priceCents)} / Monat</strong></div><div><span>${periodLabel}</span><strong>${periodValue}</strong></div><div><span>Zahlung</span><strong>Stripe · ${test?'Test':'Live'}</strong></div></div>
      ${ending?`<div class="subscriptionCancelNotice"><b>✓ Kündigung vorgemerkt</b><br>Es erfolgt nach dem ${periodValue} keine weitere Verlängerung. Deine gespeicherten Betriebsdaten werden dadurch nicht gelöscht.</div>`:''}
      <div class="subscriptionManageActions"><button class="btn" type="button" onclick="SubscriptionBilling.openPortal()">Zahlungsdaten verwalten</button>${ending?`<button class="btn primary" type="button" onclick="SubscriptionBilling.resumeSubscription()">Kündigung zurücknehmen</button>`:`<button class="btn danger" type="button" onclick="SubscriptionBilling.cancelSubscription()">Abo zum Periodenende kündigen</button>`}</div>`;
  }

  function renderLegal(){
    const host=q('subscriptionLegalCard');if(!host)return;
    const test=state.access?.billing_provider==='stripe'&&!state.access?.provider_livemode;
    host.innerHTML=`<span class="subscriptionEyebrow">VERTRAGSINFORMATIONEN</span><h3>Wichtig zum AngebotsPilot-Abo</h3><p>AngebotsPilot wird als B2B-Software für Betriebe, Gewerbetreibende und selbständig Tätige angeboten. Ein kostenpflichtiger Abschluss ist nur für Unternehmer im Rahmen ihrer gewerblichen oder selbständigen beruflichen Tätigkeit vorgesehen.</p>
      <div class="subscriptionLegalGrid"><div><b>Laufzeit & Verlängerung</b><small>Monatliche Abrechnung. Das Abo verlängert sich jeweils um einen weiteren Monat, solange es nicht zum Ende der laufenden Abrechnungsperiode gekündigt wird.</small></div><div><b>Kündigung</b><small>Direkt in AngebotsPilot zum Periodenende möglich. Bis dahin bleibt der Tarif nutzbar; eine vorgemerkte Kündigung kann vor Periodenende zurückgenommen werden.</small></div><div><b>Daten nach Kündigung</b><small>Eine Kündigung löscht keine Betriebsdaten automatisch. Bei beendetem Zugang bleiben vorhandene Daten nach unserem Zugriffskonzept lesbar/exportierbar.</small></div><div><b>Zahlung & Belege</b><small>Zahlungsdaten verarbeitet Stripe. Abo-Belege stehen im Bereich „Abo-Rechnungen“ zur Verfügung.</small></div></div>
      <div class="subscriptionLegalActions"><button class="btn" type="button" onclick="showScreen('privacy')">Datenschutz öffnen</button><button class="btn" type="button" onclick="SubscriptionBilling.showLegalReadiness()">Impressum & AGB</button></div>
      <p class="subscriptionBetaLegal">${test?'🧪 Testmodus: Es wird aktuell kein echtes Geld abgebucht. ':''}Vor einem öffentlichen Live-Verkauf müssen Betreiberangaben/Impressum, AGB und die Datenschutzerklärung mit den endgültigen AngebotsPilot-Anbieterangaben veröffentlicht und rechtlich geprüft werden.</p>`;
  }

  function renderInvoices(){
    const host=q('subscriptionInvoiceList');if(!host)return;
    if(!state.invoices.length){host.innerHTML='<div class="subscriptionEmpty"><span>🧾</span><b>Noch keine Abo-Rechnungen</b><p>Nach einer Stripe-Zahlung erscheint der Beleg hier automatisch.</p></div>';return}
    host.innerHTML=state.invoices.map(inv=>{
      const title=inv.invoice_number||'Abo-Rechnung';const status=inv.status==='paid'?'Bezahlt':inv.status==='open'?'Offen':inv.status==='void'?'Storniert':inv.status==='uncollectible'?'Nicht einziehbar':'Entwurf';const url=inv.provider_pdf_url||inv.hosted_invoice_url||'';
      const action=url?`<button class="btn small" type="button" onclick="SubscriptionBilling.openInvoice(decodeURIComponent('${encodeURIComponent(url)}'))">Beleg öffnen</button>`:'';
      return `<div class="subscriptionInvoiceRow"><div><b>${esc(title)}</b><small>${formatDate(inv.invoice_date||inv.created_at)} · ${esc(status)}</small></div><strong>${formatMoney(inv.total_cents,inv.currency_code)}</strong>${action}</div>`;
    }).join('');
  }

  function hydrateBillingForm(){
    const a=state.access||{},address=a.billing_address||{};
    if(q('subscriptionBillingName'))q('subscriptionBillingName').value=a.billing_name||ctx()?.company?.name||'';
    if(q('subscriptionBillingEmail'))q('subscriptionBillingEmail').value=a.billing_email||ctx()?.company?.email||'';
    if(q('subscriptionBillingStreet'))q('subscriptionBillingStreet').value=address.street||address.address||ctx()?.company?.address||'';
    if(q('subscriptionBillingPostal'))q('subscriptionBillingPostal').value=address.postal_code||'';
    if(q('subscriptionBillingCity'))q('subscriptionBillingCity').value=address.city||'';
    if(q('subscriptionBillingCountry'))q('subscriptionBillingCountry').value=a.billing_country_code||ctx()?.company?.country_code||'DE';
    if(q('subscriptionBillingVat'))q('subscriptionBillingVat').value=a.billing_vat_id||ctx()?.company?.vat_id||'';
  }

  function renderAccess(){
    ensureEnhancedUI();
    const host=q('subscriptionStatusCard');if(!host)return;const context=ctx();
    if(!context?.session||!context?.company){
      if(q('subscriptionQuickStatus'))q('subscriptionQuickStatus').textContent='Konto verbinden';
      host.innerHTML='<div class="subscriptionEmpty"><span>☁️</span><b>Noch kein Cloud-Konto verbunden</b><p>Abo und Abrechnung werden dem Betriebskonto zugeordnet.</p><button class="btn primary" type="button" onclick="openCloudAccount()">Konto & Cloud öffnen</button></div>';
      q('subscriptionMainContent')?.classList.add('subscriptionUnavailable');renderLegal();return;
    }
    q('subscriptionMainContent')?.classList.remove('subscriptionUnavailable');
    const a=state.access||{},s=statusInfo(a),p=currentPlan();
    if(q('subscriptionQuickStatus'))q('subscriptionQuickStatus').textContent=`${p.name} · ${s.label}`;
    let meta='';
    if(a.cancel_at_period_end&&a.current_period_end)meta=`Gekündigt · nutzbar bis ${formatDate(a.current_period_end)} · keine weitere Verlängerung`;
    else if(s.key==='trial'){const left=daysLeft(a.trial_ends_at);meta=left===null?'Kostenlose Testphase':`${left} ${left===1?'Tag':'Tage'} verbleibend · bis ${formatDate(a.trial_ends_at)}`}
    else if(s.key==='active'&&a.billing_provider==='stripe')meta=`${a.provider_livemode?'Abo':'Stripe-Testabo'} aktiv · ${formatMoney(p.priceCents)}/Monat${a.current_period_end?` · nächste Abrechnung ${formatDate(a.current_period_end)}`:''}`;
    else if(s.key==='active')meta=a.billing_provider==='test'?'Beta-Testmodus · keine Abbuchung':'Abo aktiv';
    else if(s.key==='past_due'||s.key==='grace_period')meta=a.grace_ends_at?`Kulanz bis ${formatDate(a.grace_ends_at)}`:'Zahlung prüfen';
    else if(s.key==='restricted')meta='Lesen und Exportieren bleiben möglich';
    else if(s.key==='cancelled')meta='Abo wurde beendet';
    host.innerHTML=`<div class="subscriptionStatusHead"><div class="subscriptionStatusIcon subscriptionTone-${s.tone}">${s.icon}</div><div><span class="subscriptionEyebrow">ABO-STATUS</span><h2>${esc(s.label)}</h2><p>${esc(meta)}</p></div><span class="subscriptionPlanBadge">${p.icon} ${esc(p.name)}</span></div><div class="subscriptionTrustRow"><span>✓ Daten bleiben Eigentum des Betriebs</span><span>✓ Bei Sperre kein Datenverlust</span><span>✓ Abrechnung serverseitig geprüft</span></div>`;

    const provider=q('subscriptionPaymentProvider');if(provider)provider.textContent=a.billing_provider==='stripe'?(a.provider_livemode?'Stripe · Live':'Stripe · Testmodus'):state.gateway?.configured?'Stripe-Testkonto bereit · noch kein Abo':'Stripe technisch vorbereitet · noch nicht verbunden';
    const gateway=q('subscriptionGatewayStatus');
    if(gateway){const g=state.gateway||{};let text='Stripe-Testkonto noch nicht verbunden.';if(g.configured&&!g.webhook_configured)text='Stripe-Key erkannt · Webhook-Signatur fehlt noch.';else if(gatewayReady())text=g.livemode?'Stripe Live-Billing verbunden.':'Stripe Testmodus vollständig verbunden.';gateway.textContent=text;gateway.className=`subscriptionGatewayStatus ${gatewayReady()?'ready':g.configured?'partial':'pending'}`}
    const portal=q('subscriptionPortalButton');if(portal){portal.hidden=!(isOwner()&&(a.has_provider_customer||state.gateway?.has_customer));portal.textContent='Zahlungsmethode ändern'};
    const readOnly=q('subscriptionReadOnlyNote');if(readOnly)readOnly.hidden=a.can_write!==false;
    document.querySelectorAll('#subscription .subscriptionOwnerOnly').forEach(el=>el.hidden=!isOwner());
    const nonOwner=q('subscriptionNonOwnerNote');if(nonOwner)nonOwner.hidden=isOwner();
    const testCard=q('subscriptionTestCard');if(testCard)testCard.hidden=!(isOwner()&&a.test_mode_enabled&&a.billing_provider==='test');
    if(q('subscriptionTestPlan'))q('subscriptionTestPlan').value=a.plan||'solo';if(q('subscriptionTestStatus'))q('subscriptionTestStatus').value=a.status||'active';
    hydrateBillingForm();renderPlanCards();renderManagement();renderInvoices();renderLegal();applyAccessMode();
  }

  function renderLoading(){const host=q('subscriptionStatusCard');if(host)host.innerHTML='<div class="subscriptionLoading"><span></span><div><b>Abo wird geprüft …</b><small>Sicherer Abgleich mit deinem Betriebskonto</small></div></div>'}
  async function loadInvoices(client,companyId){
    if(!isOwner()){state.invoices=[];return}
    const {data,error}=await client.from('subscription_invoices').select('id,invoice_number,status,currency_code,total_cents,invoice_date,due_date,paid_at,document_storage_path,hosted_invoice_url,provider_pdf_url,period_start,period_end,created_at').eq('company_id',companyId).order('created_at',{ascending:false}).limit(24);
    if(error)throw error;state.invoices=data||[];
  }
  async function refresh(options={}){
    if(state.loading)return state.access;const context=ctx();stampBuild();ensureEnhancedUI();
    if(!context?.client||!context?.session||!context?.company?.id){state.access=null;state.invoices=[];renderAccess();applyAccessMode();return null}
    state.loading=true;if(!options.silent)renderLoading();
    try{
      const {data,error}=await context.client.rpc('get_subscription_access',{target_company:context.company.id});if(error)throw error;
      state.access=data||null;state.lastCompanyId=context.company.id;
      try{await refreshGateway()}catch(e){console.warn('Stripe-Status konnte nicht geladen werden',e)}
      try{await loadInvoices(context.client,context.company.id)}catch(e){console.warn('Abo-Rechnungen konnten nicht geladen werden',e);state.invoices=[]}
      renderAccess();return state.access;
    }catch(e){console.error('Subscription refresh failed',e);if(!options.silent)toast('Abo-Status konnte gerade nicht geladen werden.','error');renderAccess();return null}
    finally{state.loading=false}
  }

  async function saveBillingProfile(){
    const context=ctx();if(!context?.client||!context?.company?.id)return toast('Bitte zuerst dein Betriebskonto verbinden.','error');if(!isOwner())return toast('Nur der Inhaber kann Rechnungsdaten ändern.','error');
    const name=q('subscriptionBillingName')?.value.trim()||'',email=q('subscriptionBillingEmail')?.value.trim()||'',street=q('subscriptionBillingStreet')?.value.trim()||'',postal=q('subscriptionBillingPostal')?.value.trim()||'',city=q('subscriptionBillingCity')?.value.trim()||'',country=q('subscriptionBillingCountry')?.value||'DE',vat=q('subscriptionBillingVat')?.value.trim()||'';
    if(!name)return toast('Bitte einen Rechnungsempfänger eintragen.','error');if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return toast('Bitte eine gültige Rechnungs-E-Mail eintragen.','error');
    const btn=q('subscriptionBillingSave');if(btn){btn.disabled=true;btn.textContent='Speichert …'}
    try{const {data,error}=await context.client.rpc('update_subscription_billing_profile',{target_company:context.company.id,new_billing_name:name,new_billing_email:email,new_billing_address:{street,postal_code:postal,city},new_billing_country_code:country,new_billing_vat_id:vat});if(error)throw error;if(!data)throw new Error('Rechnungsdaten wurden nicht gespeichert.');toast('Rechnungsdaten gespeichert.','success');await refresh({silent:true})}
    catch(e){console.error(e);toast('Rechnungsdaten konnten nicht gespeichert werden.','error')}
    finally{if(btn){btn.disabled=false;btn.textContent='Rechnungsdaten speichern'}}
  }

  async function simulate(){
    const context=ctx();if(!context?.client||!context?.company?.id||!isOwner())return;if(!state.access?.test_mode_enabled)return toast('Der Beta-Testmodus ist für diesen Betrieb nicht aktiv.','error');
    const plan=q('subscriptionTestPlan')?.value||state.access.plan||'solo',status=q('subscriptionTestStatus')?.value||state.access.status||'active',label=STATUS[status]?.label||status;
    const question=`Beta-Test: Abo-Status wirklich auf „${label}“ setzen?\n\nDamit kannst du auch den späteren Lesemodus testen. Du kannst jederzeit wieder „Aktiv“ wählen.`;
    const ok=globalThis.appConfirm?await globalThis.appConfirm({title:'Beta-Teststatus ändern',text:question,confirmLabel:'Teststatus anwenden',icon:'🧪'}):confirm(question);if(!ok)return;
    const btn=q('subscriptionTestApply');if(btn){btn.disabled=true;btn.textContent='Wird gesetzt …'}
    try{const {error}=await context.client.rpc('set_subscription_test_state',{target_company:context.company.id,new_status:status,new_plan:plan});if(error)throw error;await refresh({silent:true});toast(`Beta-Status: ${label}.`,'success')}
    catch(e){console.error(e);toast('Teststatus konnte nicht geändert werden.','error')}
    finally{if(btn){btn.disabled=false;btn.textContent='Teststatus anwenden'}}
  }

  async function startCheckout(plan){
    if(!isOwner())return toast('Nur der Inhaber kann das Abo verwalten.','error');if(!gatewayReady(plan))return toast('Stripe-Testkonto oder Tarifpreis ist noch nicht vollständig verbunden.','info');if(!state.access?.billing_name||!state.access?.billing_email)return toast('Bitte zuerst Rechnungsempfänger und Rechnungs-E-Mail speichern.','warning');
    const p=PLANS[plan]||PLANS.solo;
    const text=`${p.name} kostet ${formatMoney(p.priceCents)} pro Monat und verlängert sich monatlich bis zur Kündigung.\n\nIch bestätige, dass ich den Tarif ausschließlich für meine gewerbliche oder selbständige berufliche Tätigkeit als Unternehmer abschließe.`;
    const ok=globalThis.appConfirm?await globalThis.appConfirm({title:'B2B-Abo bestätigen',text,confirmLabel:'Als Unternehmer fortfahren',icon:'🏢'}):confirm(text);if(!ok)return;
    try{toast('Stripe Test-Checkout wird geöffnet …','info');const data=await invokeBilling('checkout',{plan,business_confirmation:true,terms_version:TERMS_VERSION});if(data.url)await openExternal(data.url)}
    catch(e){console.error(e);if(e?.code==='subscription_exists')return scrollManage();toast(String(e?.message||'Test-Checkout konnte nicht geöffnet werden.'),'error')}
  }

  async function changePlan(plan){
    if(!isOwner())return toast('Nur der Inhaber kann den Tarif wechseln.','error');
    const a=state.access||{},from=currentPlan(),to=PLANS[plan];
    if(!to)return toast('Unbekannter Tarif.','error');
    if(!a.has_provider_subscription)return toast('Kein aktives Stripe-Abo gefunden.','error');
    if(a.cancel_at_period_end)return toast('Bitte zuerst die vorgemerkte Kündigung zurücknehmen.','warning');
    if(a.plan===plan)return scrollManage();
    const text=`Du wechselst von ${from.name} (${formatMoney(from.priceCents)}/Monat) zu ${to.name} (${formatMoney(to.priceCents)}/Monat).\
\
Der Tarifwechsel gilt sofort. Stripe berechnet die anteilige Preisdifferenz bzw. Gutschrift für den laufenden Zeitraum und berücksichtigt sie bei der nächsten Rechnung. Dein bisheriger Abrechnungstag bleibt gleich.`;
    const ok=globalThis.appConfirm?await globalThis.appConfirm({title:`Zu ${to.name} wechseln?`,text,confirmLabel:`Zu ${to.name} wechseln`,icon:'↔️'}):confirm(text);if(!ok)return;
    const buttons=[...document.querySelectorAll('#subscriptionPlanGrid .subscriptionPlanAction')];buttons.forEach(b=>b.disabled=true);
    try{
      const data=await invokeBilling('change_plan',{plan});
      if(state.access){state.access.plan=data.plan||plan;if(data.current_period_end)state.access.current_period_end=data.current_period_end}
      renderAccess();
      toast(`Tarif gewechselt: ${to.name}. Die anteilige Verrechnung erfolgt über Stripe.`, 'success');
      setTimeout(()=>refresh({silent:true}),1200);
    }catch(e){
      console.error(e);
      if(e?.code==='cancellation_pending')toast('Bitte zuerst die vorgemerkte Kündigung zurücknehmen.','warning');
      else toast(String(e?.message||'Tarif konnte nicht gewechselt werden.'),'error');
    }finally{buttons.forEach(b=>b.disabled=false)}
  }

  async function cancelSubscription(){
    if(!isOwner())return toast('Nur der Inhaber kann das Abo kündigen.','error');const a=state.access||{},p=currentPlan();if(!a.has_provider_subscription)return toast('Kein aktives Stripe-Abo gefunden.','error');
    const end=formatDate(a.current_period_end);
    const text=`Dein ${p.name}-Abo bleibt bis ${end} aktiv. Danach wird es nicht erneut verlängert und es erfolgt keine weitere monatliche Abbuchung.\n\nDeine gespeicherten Betriebsdaten werden durch die Kündigung nicht gelöscht.`;
    const ok=globalThis.appConfirm?await globalThis.appConfirm({title:'Abo zum Periodenende kündigen?',text,confirmLabel:'Abo kündigen',icon:'🧾'}):confirm(text);if(!ok)return;
    try{const data=await invokeBilling('cancel');if(state.access){state.access.cancel_at_period_end=!!data.cancel_at_period_end;if(data.current_period_end)state.access.current_period_end=data.current_period_end}renderAccess();toast(`Kündigung vorgemerkt. Abo läuft bis ${formatDate(data.current_period_end||a.current_period_end)}.`, 'success');setTimeout(()=>refresh({silent:true}),1200)}
    catch(e){console.error(e);toast(String(e?.message||'Abo konnte nicht gekündigt werden.'),'error')}
  }

  async function resumeSubscription(){
    if(!isOwner())return toast('Nur der Inhaber kann das Abo verwalten.','error');
    const text='Die vorgemerkte Kündigung wird zurückgenommen. Das Abo verlängert sich danach wieder monatlich, bis du erneut kündigst.';
    const ok=globalThis.appConfirm?await globalThis.appConfirm({title:'Kündigung zurücknehmen?',text,confirmLabel:'Abo weiterführen',icon:'↩️'}):confirm(text);if(!ok)return;
    try{const data=await invokeBilling('resume');if(state.access)state.access.cancel_at_period_end=!!data.cancel_at_period_end;renderAccess();toast('Kündigung zurückgenommen. Das Abo läuft weiter.','success');setTimeout(()=>refresh({silent:true}),1200)}
    catch(e){console.error(e);toast(String(e?.message||'Kündigung konnte nicht zurückgenommen werden.'),'error')}
  }

  async function openPortal(){if(!isOwner())return toast('Nur der Inhaber kann Zahlungsdaten verwalten.','error');try{const data=await invokeBilling('portal');if(data.url)await openExternal(data.url)}catch(e){console.error(e);toast(String(e?.message||'Stripe-Kundenportal konnte nicht geöffnet werden.'),'error')}}
  async function openInvoice(url){try{const u=new URL(String(url));if(u.protocol!=='https:')throw new Error('Ungültiger Beleg-Link');await openExternal(u.toString())}catch(e){toast('Der Beleg-Link ist ungültig.','error')}}
  function explainPayment(){toast('Zahlungsdaten wie Karten- oder Bankdaten verarbeitet Stripe. AngebotsPilot speichert diese Zahlungsdaten nicht. Abo-Status und Beleginformationen werden serverseitig abgeglichen.','info')}
  function showLegalReadiness(){toast('Beta-Hinweis: Vor dem öffentlichen Live-Verkauf werden Impressum, AGB und Datenschutz mit den endgültigen Betreiberangaben veröffentlicht und rechtlich geprüft. Das aktuelle Abo ist ein Stripe-Testabo.','info')}
  function scrollManage(){const el=q('subscriptionManagementCard');if(el&&!el.hidden){el.scrollIntoView({behavior:'smooth',block:'center'});return}openPortal()}

  function blockKnownWriteClick(event){
    if(!state.access||state.access.can_write!==false)return;const target=event.target?.closest?.('button,[role="button"],label,a');if(!target||target.closest('#subscription'))return;
    const code=(target.getAttribute('onclick')||'')+' '+(target.id||'')+' '+(target.textContent||'');const writeIntent=/(\bnew(?:Offer|Customer|Event|Task|Job|Invoice)\b|editCurrentCustomer|saveOffer|saveCustomer|saveInvoice|deleteOffer|addCatalog|upload|import|Zeit starten|Neue?s? |＋ Neu|Hinzufügen)/i.test(code);if(!writeIntent)return;
    event.preventDefault();event.stopImmediatePropagation();toast('Lesemodus: Neue Änderungen sind erst nach Reaktivierung des Abos möglich. Deine vorhandenen Daten bleiben verfügbar.','error');globalThis.openSubscription?.();
  }
  function handleSubscriptionError(event){const reason=event?.reason||event?.error,text=String(reason?.message||reason||'');if(!text.includes('SUBSCRIPTION_RESTRICTED'))return;toast('Abo im Lesemodus: Diese Änderung wurde nicht gespeichert. Deine Daten bleiben erhalten.','error');refresh({silent:true})}

  globalThis.openSubscription=function(){globalThis.showScreen?.('subscription');refresh()};
  globalThis.SubscriptionBilling={refresh,saveBillingProfile,simulate,startCheckout,changePlan,cancelSubscription,resumeSubscription,openPortal,openInvoice,explainPayment,showLegalReadiness,scrollManage,_state:()=>({...state})};

  document.addEventListener('click',blockKnownWriteClick,true);
  window.addEventListener('unhandledrejection',handleSubscriptionError);
  window.addEventListener('error',handleSubscriptionError);
  window.addEventListener('angebotspilot:syncstate',event=>{const text=String(event?.detail?.lastError||'');if(!text.includes('SUBSCRIPTION_RESTRICTED'))return;toast('Abo im Lesemodus: Cloud-Änderungen sind bis zur Reaktivierung gesperrt.','error');refresh({silent:true})});

  document.addEventListener('DOMContentLoaded',()=>{
    stampBuild();wrapBuildStamp();ensureBanner();ensureEnhancedUI();renderAccess();
    try{
      const u=new URL(location.href),billing=u.searchParams.get('billing');
      if(billing==='success'){
        toast('Stripe-Testzahlung abgeschlossen. Der Abo-Status wird automatisch abgeglichen.','success');u.searchParams.delete('billing');u.searchParams.delete('session_id');history.replaceState({},'',u.pathname+(u.search||'')+(u.hash||''));
        let n=0;const poll=setInterval(async()=>{n++;await refresh({silent:true});if(state.access?.billing_provider==='stripe'||n>=6)clearInterval(poll)},1800);
      }else if(billing==='cancelled'){
        toast('Stripe-Checkout wurde abgebrochen. Es wurde nichts geändert.','info');u.searchParams.delete('billing');history.replaceState({},'',u.pathname+(u.search||'')+(u.hash||''));
      }
    }catch(e){}
    let tries=0;const boot=setInterval(async()=>{tries++;const context=ctx();if(context?.session&&context?.company?.id){clearInterval(boot);await refresh({silent:true})}else if(tries>40){clearInterval(boot);renderAccess()}},500);
    state.refreshTimer=setInterval(()=>{const context=ctx();if(context?.company?.id&&(context.company.id!==state.lastCompanyId||!state.access))refresh({silent:true})},15000);
  });
})();
