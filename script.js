const KEY='digitaler_handwerker_v3';
const PRIVACY_VERSION='1.0';
const WEATHER_CACHE_KEY='dh_weather_cache_v1';
const defaultData={settings:{companyName:'',ownerName:'',phone:'',email:'',address:'',weatherLocation:'',tax:0,paymentTerm:'7 Tage',taxNumber:'',vatId:'',iban:'',bankName:''},privacy:{version:PRIVACY_VERSION,consents:{weather:false,location:false,external:false,analytics:false},role:'owner',acceptedAt:null},audit:[],customers:[],offers:[],events:[],tasks:[],jobs:[],invoices:[],catalog:[{id:uid(),name:'Gartenarbeit / Fachkraft',unit:'Std.',price:55,type:'service',trade:'garden'},{id:uid(),name:'Anfahrt',unit:'Pauschale',price:50,type:'service',trade:'garden'},{id:uid(),name:'Rasen mähen und Pflege',unit:'Std.',price:55,type:'service',trade:'garden'},{id:uid(),name:'Hecken- und Strauchschnitt',unit:'Std.',price:55,type:'service',trade:'garden'},{id:uid(),name:'Rollrasen verlegen',unit:'m²',price:18,type:'service',trade:'garden'},{id:uid(),name:'Humus / Mutterboden',unit:'m³',price:65,type:'material',trade:'garden'},{id:uid(),name:'Entsorgung Grünabfall',unit:'Pauschale',price:120,type:'service',trade:'garden'}]};

// v9.7 FIX: onboarding/product-tour state and trade catalogs
let onboardingStep=0;
let onboardingTrade='';
let onboardingTax=0;
let catalogFilter='all';

const TRADE_CATALOGS={
  garden:{name:'Garten & Landschaft',desc:'GaLaBau & Gartenpflege',icon:'🌿',items:[
    ['service','Gartenarbeit / Fachkraft','Std.'],['service','Rasen mähen und Pflege','m²'],['service','Rasen vertikutieren','m²'],['service','Rasen fräsen','m²'],['service','Hecke schneiden','m'],['service','Beetpflege','Std.'],['service','Pflanzarbeiten','Std.'],['service','Pflaster verlegen','m²'],['service','Terrassen- / Wegebau','m²'],['service','Terrassenreinigung','m²'],['service','Grünabfall entsorgen','Pauschale'],['service','Anfahrt','Pauschale'],
    ['material','Humus / Mutterboden','m³'],['material','Pflanzerde / Substrat','l'],['material','Rasensaat','kg'],['material','Rasendünger','kg'],['material','Rollrasen','m²'],['material','Rindenmulch','l'],['material','Pflanzen / Gehölze','Stk.'],['material','Pflastersteine / Platten','m²'],['material','Bettungssplitt','t'],['material','Schotter / Frostschutz','t'],['material','Kies / Splitt','t'],['material','Fugensand / Fugenmaterial','kg'],['material','Randstein / Einfassung','m']
  ]},
  caretaker:{name:'Hausmeisterservice',desc:'Objektpflege & Kleinreparaturen',icon:'🧰',items:[
    ['service','Hausmeister / Fachkraft','Std.'],['service','Objektkontrolle','Pauschale'],['service','Kleinreparatur','Std.'],['service','Montage / Befestigung','Std.'],['service','Winterdienst','Std.'],['service','Leuchtmittel wechseln','Stk.'],['service','Anfahrt','Pauschale'],
    ['material','Schrauben / Dübel','Pauschale'],['material','Silikon / Dichtstoff','Kartusche'],['material','Acryl','Kartusche'],['material','Leuchtmittel','Stk.'],['material','Batterien','Stk.'],['material','Dichtungen / Kleinbauteile','Stk.'],['material','Streusalz / Auftaumittel','kg'],['material','Reinigungsmittel','l'],['material','Müllbeutel','Rolle'],['material','Kleinmaterial','Pauschale']
  ]},
  cleaning:{name:'Gebäudereinigung',desc:'Unterhalt & Grundreinigung',icon:'✨',items:[
    ['service','Unterhaltsreinigung','Std.'],['service','Grundreinigung','m²'],['service','Fensterreinigung','m²'],['service','Glasfassadenreinigung','m²'],['service','Sanitärreinigung','Std.'],['service','Treppenhausreinigung','Pauschale'],['service','Bauschlussreinigung','m²'],['service','Anfahrt','Pauschale'],
    ['material','Universal- / Unterhaltsreiniger','l'],['material','Glasreiniger','l'],['material','Sanitärreiniger','l'],['material','Grundreiniger','l'],['material','Bodenpflegemittel','l'],['material','Desinfektionsreiniger','l'],['material','Mikrofasertücher','Stk.'],['material','Moppbezug','Stk.'],['material','Einweghandschuhe','Packung'],['material','Müllbeutel','Rolle']
  ]},
  painter:{name:'Maler & Lackierer',desc:'Innen & Außen',icon:'🎨',items:[
    ['service','Malerarbeiten innen','m²'],['service','Fassadenanstrich','m²'],['service','Spachtelarbeiten','m²'],['service','Grundieren','m²'],['service','Lackierarbeiten','m²'],['service','Tapezierarbeiten','m²'],['service','Abkleben / Abdecken','m²'],['service','Anfahrt','Pauschale'],
    ['material','Innenwandfarbe','l'],['material','Fassadenfarbe','l'],['material','Tiefgrund','l'],['material','Haftgrund','l'],['material','Spachtelmasse','kg'],['material','Lack','l'],['material','Lasur','l'],['material','Acryl','Kartusche'],['material','Malerkrepp','Rolle'],['material','Abdeckfolie / Abdeckvlies','m²'],['material','Schleifmittel','Stk.'],['material','Tapete / Vlies','m²']
  ]},
  tiler:{name:'Fliesenleger',desc:'Fliesen & Naturstein',icon:'◻️',items:[
    ['service','Fliesen verlegen','m²'],['service','Naturstein verlegen','m²'],['service','Altbelag entfernen','m²'],['service','Untergrund vorbereiten','m²'],['service','Abdichten','m²'],['service','Verfugen','m²'],['service','Silikonfugen herstellen','m'],['service','Anfahrt','Pauschale'],
    ['material','Fliesen / Platten','m²'],['material','Naturstein','m²'],['material','Fliesenkleber / Dünnbettmörtel','kg'],['material','Grundierung','l'],['material','Fugenmörtel','kg'],['material','Silikon / Dichtstoff','Kartusche'],['material','Verbundabdichtung','kg'],['material','Dichtband / Dichtecken','m'],['material','Ausgleichsmasse','kg'],['material','Abschlussprofile / Schienen','m'],['material','Nivelliersystem','Packung']
  ]},
  drywall:{name:'Trockenbau',desc:'Wände, Decken & Dämmung',icon:'🧱',items:[
    ['service','Trockenbau Montage','m²'],['service','Ständerwand erstellen','m²'],['service','Decke abhängen','m²'],['service','Dämmung einbauen','m²'],['service','Spachteln Q2','m²'],['service','Spachteln Q3 / Q4','m²'],['service','Anfahrt','Pauschale'],
    ['material','Gipskartonplatte','m²'],['material','Feuchtraumplatte','m²'],['material','CW-Profil','m'],['material','UW-Profil','m'],['material','UD / CD-Deckenprofil','m'],['material','Direktabhänger / Verbinder','Stk.'],['material','Schnellbauschrauben','Packung'],['material','Dämmstoff','m²'],['material','Fugenspachtel','kg'],['material','Fugenband','m'],['material','Dichtungsband','m']
  ]},
  electrical:{name:'Elektro',desc:'Installation & Service',icon:'⚡',items:[
    ['service','Elektriker / Fachkraft','Std.'],['service','Steckdose / Schalter montieren','Stk.'],['service','Leuchte montieren','Stk.'],['service','Leitung verlegen','m'],['service','Unterverteilung montieren','Stk.'],['service','Fehlersuche / Prüfung','Std.'],['service','Anfahrt','Pauschale'],
    ['material','Installationsleitung NYM-J','m'],['material','Installationsrohr','m'],['material','Kabelkanal','m'],['material','Gerätedose / Hohlwanddose','Stk.'],['material','Abzweigdose','Stk.'],['material','Steckdose','Stk.'],['material','Schalter / Taster','Stk.'],['material','Verbindungsklemmen','Stk.'],['material','Leitungsschutzschalter','Stk.'],['material','FI / RCD','Stk.'],['material','Kleinverteiler / Verteilung','Stk.'],['material','Befestigungs- / Kleinmaterial','Pauschale']
  ]},
  plumbing:{name:'Sanitär & Heizung',desc:'SHK & Kundendienst',icon:'🚿',items:[
    ['service','SHK / Fachkraft','Std.'],['service','Sanitärmontage','Std.'],['service','Rohrleitung montieren','m'],['service','Armatur montieren','Stk.'],['service','Heizkörper montieren','Stk.'],['service','Wartung / Kundendienst','Std.'],['service','Anfahrt','Pauschale'],
    ['material','Mehrschichtverbundrohr','m'],['material','Kupfer- / Edelstahlrohr','m'],['material','Abwasserrohr','m'],['material','Pressfitting / Formstück','Stk.'],['material','Dichtung','Stk.'],['material','Rohrdämmung','m'],['material','Rohrschelle / Befestigung','Stk.'],['material','Armatur','Stk.'],['material','Siphon / Ablaufgarnitur','Stk.'],['material','Ventil','Stk.'],['material','Dichtmaterial / PTFE / Hanf','Pauschale'],['material','Sanitär-Kleinmaterial','Pauschale']
  ]},
  roofing:{name:'Dachdecker',desc:'Dach & Abdichtung',icon:'🏠',items:[
    ['service','Dachdecker / Fachkraft','Std.'],['service','Dacheindeckung','m²'],['service','Abdichtungsarbeiten','m²'],['service','Dämmung einbauen','m²'],['service','Dachrinne montieren','m'],['service','Reparatur / Wartung','Std.'],['service','Anfahrt','Pauschale'],
    ['material','Dachziegel / Dachstein','Stk.'],['material','Bitumen- / Abdichtungsbahn','m²'],['material','Unterdeck- / Unterspannbahn','m²'],['material','Dampfbremse','m²'],['material','Dämmstoff','m²'],['material','Dachlatte','m'],['material','Konterlatte','m'],['material','Anschlussband / Dichtband','m'],['material','Blech / Abkantteil','m'],['material','Dachrinne / Fallrohr','m'],['material','Schrauben / Befestiger','Packung']
  ]}
};

function shouldShowOnboarding(){return localStorage.getItem('dh_onboarding_v8_done')!=='1'}



let positionPickerType='all',positionPickerCategory='all';
function getPositionCategory(x){const n=String(x.name||'').toLowerCase();if((x.type||'service')==='material'){if(/rasen|dünger|saat/.test(n))return'Rasen';if(/erde|humus|boden|schotter|kies|splitt/.test(n))return'Boden & Schüttgut';if(/pflanz|stauden|baum|strauch/.test(n))return'Pflanzen';if(/pflaster|stein|randstein|fliese/.test(n))return'Beläge';return'Material'}if(/anfahrt|fahrt/.test(n))return'Anfahrt';if(/stunde|fachkraft|helfer|arbeits/.test(n))return'Arbeitszeit';if(/rasen|hecke|beet|pflege|schnitt/.test(n))return'Pflege';if(/entsorg/.test(n))return'Entsorgung';if(/pflaster|verleg|montier|reinigung|streichen|spachtel|abdicht/.test(n))return'Ausführung';return'Leistungen'}
function openPositionPicker(){positionPickerType='all';positionPickerCategory='all';const s=document.getElementById('positionSearch');if(s)s.value='';document.querySelectorAll('[data-pickertype]').forEach(x=>x.classList.toggle('active',x.dataset.pickertype==='all'));document.getElementById('positionPicker').classList.remove('hidden');renderPositionPicker()}
function closePositionPicker(e){if(e&&e.target!==document.getElementById('positionPicker'))return;document.getElementById('positionPicker').classList.add('hidden')}
function setPositionPickerType(t,el){positionPickerType=t;positionPickerCategory='all';document.querySelectorAll('[data-pickertype]').forEach(x=>x.classList.remove('active'));el.classList.add('active');renderPositionPicker()}
function setPositionCategory(c,el){positionPickerCategory=c;document.querySelectorAll('.categoryChip').forEach(x=>x.classList.remove('active'));el.classList.add('active');renderPositionPickerList()}
function pickerCatalog(){
  const q=(document.getElementById('positionSearch')?.value||'').trim().toLowerCase();
  return (data.catalog||[]).filter(x=>isCurrentTradeCatalogItem(x)&&(positionPickerType==='all'||(x.type||'service')===positionPickerType)&&(!q||String(x.name).toLowerCase().includes(q)));
}
function renderPositionPicker(){const list=pickerCatalog(),cats=[...new Set(list.map(getPositionCategory))].sort();document.getElementById('positionPickerCategories').innerHTML=['all',...cats].map(c=>`<button class="categoryChip ${c===positionPickerCategory?'active':''}" onclick="setPositionCategory('${c}',this)">${c==='all'?'Alle Kategorien':escapeHTML(c)}</button>`).join('');if(positionPickerCategory!=='all'&&!cats.includes(positionPickerCategory))positionPickerCategory='all';renderPositionPickerList()}
function renderPositionPickerList(){const raw=pickerCatalog().filter(x=>positionPickerCategory==='all'||getPositionCategory(x)===positionPickerCategory);const used=new Set((data.offers||[]).flatMap(o=>(o.lines||[]).map(l=>String(l.name||'').toLowerCase())));const frequent=raw.filter(x=>used.has(String(x.name).toLowerCase())).slice(0,5),rest=raw.filter(x=>!frequent.includes(x));const card=x=>`<div class="positionCard"><div class="positionIcon">${(x.type||'service')==='material'?'📦':'🛠️'}</div><div class="positionInfo"><b>${escapeHTML(x.name)}</b><small>${escapeHTML(getPositionCategory(x))} · ${escapeHTML(x.unit||'')}</small></div><div class="positionPrice">${Number(x.price)>0?euro(x.price):'Preis offen'}<small>${Number(x.price)>0?'/ '+escapeHTML(x.unit||''):'später ergänzen'}</small></div><button class="addPosBtn" onclick="addCatalogPositionToOffer('${x.id}',this)">＋</button></div>`;if(!raw.length){document.getElementById('positionPickerContent').innerHTML='<div class="pickerEmpty">Keine Position gefunden.<br><small>Unten kannst du eine eigene Position erstellen.</small></div>';return}let out='';if(frequent.length)out+=`<div class="pickerSectionTitle"><h3>⭐ Häufig verwendet</h3><span>${frequent.length}</span></div>${frequent.map(card).join('')}`;out+=`<div class="pickerSectionTitle"><h3>${frequent.length?'Alle Positionen':'Positionen'}</h3></div>${(frequent.length?rest:raw).map(card).join('')}`;document.getElementById('positionPickerContent').innerHTML=out}
function addCatalogPositionToOffer(id,btn){
  const x=(data.catalog||[]).find(v=>v.id===id);
  if(!x)return;
  if(!Array.isArray(draftLines))draftLines=[];
  draftLines.push({
    name:x.name,
    qty:1,
    unit:x.unit||'Stk.',
    price:Number(x.price)||0,
    catalogId:x.id,
    type:x.type||'service',
    workers:1,
    hoursPerWorker:(String(x.unit||'').toLowerCase().includes('std')?1:0)
  });
  ensureLaborMeta(draftLines[draftLines.length-1]);
  renderOfferLines();
  if(btn){
    btn.disabled=true;
    btn.textContent='✓';
    btn.classList.add('added');
    setTimeout(()=>{btn.disabled=false;btn.textContent='＋';btn.classList.remove('added')},700);
  }
  if(navigator.vibrate)navigator.vibrate(18);
  showPickerSuccess(`${x.name} hinzugefügt`);
}
function showPickerSuccess(msg){const d=document.createElement('div');d.className='pickerSuccess';d.textContent='✓ '+msg;document.body.appendChild(d);setTimeout(()=>d.remove(),1000)}
function addCustomPositionFromPicker(){document.getElementById('quickEditModal').classList.remove('hidden');document.getElementById('customPosName').value='';document.getElementById('customPosUnit').value='';document.getElementById('customPosPrice').value=''}
function closeQuickEdit(e){if(e&&e.target!==document.getElementById('quickEditModal'))return;document.getElementById('quickEditModal').classList.add('hidden')}
function saveCustomPositionFromPicker(){
  const name=document.getElementById('customPosName').value.trim();
  const unit=document.getElementById('customPosUnit').value.trim()||'Stk.';
  const price=Number(document.getElementById('customPosPrice').value)||0;
  if(!name)return toast('Bezeichnung fehlt');
  if(!Array.isArray(draftLines))draftLines=[];
  draftLines.push({name,qty:1,unit,price,type:'service',workers:1,hoursPerWorker:String(unit).toLowerCase().includes('std')?1:0});ensureLaborMeta(draftLines[draftLines.length-1]);
  renderOfferLines();
  closeQuickEdit();
  showPickerSuccess(`${name} hinzugefügt`);
}
function openOnboarding(){onboardingStep=0;setOnboardingActive(true);document.getElementById('entryGate')?.classList.add('hidden');document.getElementById('onboarding').classList.remove('hidden');showOnboardingStep()}
function renderTradeGrid(){const el=document.getElementById('tradeGrid');if(!el)return;el.innerHTML=Object.entries(TRADE_CATALOGS).map(([id,t])=>`<button class="tradeCard ${onboardingTrade===id?'selected':''}" onclick="selectTrade('${id}')"><span class="tradeIcon">${t.icon}</span><span><b>${escapeHTML(t.name)}</b><small>${escapeHTML(t.desc)}</small></span></button>`).join('')}
function selectTrade(id){onboardingTrade=id;renderTradeGrid();document.getElementById('tradeNext').disabled=false}
function pickTax(v,el){onboardingTax=v;document.querySelectorAll('.choice[data-tax]').forEach(x=>x.classList.remove('active'));el.classList.add('active')}
function showOnboardingStep(){document.querySelectorAll('.onStep').forEach(x=>x.classList.add('hidden'));document.querySelector(`.onStep[data-step="${onboardingStep}"]`)?.classList.remove('hidden');const p=document.getElementById('onboardProgress');if(p)p.style.width=(onboardingStep/4*100)+'%';document.getElementById('onboardBack')?.classList.toggle('hidden',onboardingStep===0);document.getElementById('onboardBrand')?.classList.toggle('hidden',onboardingStep>0)}
function nextOnboarding(){onboardingStep=Math.min(4,onboardingStep+1);showOnboardingStep()}
function previousOnboarding(){
  if(onboardingStep<=0)return;
  onboardingStep=Math.max(0,onboardingStep-1);
  showOnboardingStep();
}
function installTradeCatalog(){
  const t=TRADE_CATALOGS[onboardingTrade];if(!t)return;
  const existing=new Set((data.catalog||[]).filter(x=>catalogTradeKey(x)===onboardingTrade).map(x=>String(x.name).toLowerCase()));
  let added=0;
  t.items.forEach(([type,name,unit])=>{
    if(!existing.has(name.toLowerCase())){
      data.catalog.push({id:uid(),name,unit,price:0,type,trade:onboardingTrade,purchasePrice:0,markup:0});added++;
    }
  });
  data.settings.trade=onboardingTrade;
  repairCatalogV102();
  saveData('Branchenkatalog eingerichtet',`${t.name}: ${added} neue Positionen`);
  document.getElementById('finishCount').textContent=t.items.length;
  onboardingStep=4;showOnboardingStep();
  if(navigator.vibrate)navigator.vibrate(35);
}
function skipOnboarding(){localStorage.setItem('dh_onboarding_v8_done','1');document.getElementById('onboarding').classList.add('hidden');setOnboardingActive(false);globalThis.requireCloudEntry?.()}
function finishOnboarding(createOffer=false){localStorage.setItem('dh_onboarding_v8_done','1');localStorage.setItem('dh_name_setup_v10_done','1');document.getElementById('onboarding').classList.add('hidden');setOnboardingActive(false);globalThis.requireCloudEntry?.()}
function resetOnboarding(){localStorage.removeItem('dh_onboarding_v8_done');openOnboarding()}
function setCatalogFilter(v,el){catalogFilter=v;document.querySelectorAll('[data-catfilter]').forEach(x=>x.classList.remove('active'));el.classList.add('active');renderCatalog()}



let catalogEditorType='material';
function setCatalogEditorType(type){
  catalogEditorType=type;
  document.getElementById('catalogTypeMaterial')?.classList.toggle('active',type==='material');
  document.getElementById('catalogTypeService')?.classList.toggle('active',type==='service');
}
function openCatalogEditor(id=''){
  const x=id?(data.catalog||[]).find(v=>v.id===id):null;
  document.getElementById('catalogEditId').value=x?.id||'';
  document.getElementById('catalogEditorTitle').textContent=x?'Position bearbeiten':'Neue Position';
  document.getElementById('catalogEditName').value=x?.name||'';
  document.getElementById('catalogEditUnit').value=x?.unit||'';
  document.getElementById('catalogEditPrice').value=Number(x?.price)||'';
  setCatalogEditorType(x?.type||'material');
  document.getElementById('catalogEditorModal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('catalogEditName')?.focus(),150);
}
function closeCatalogEditor(e){
  if(e&&e.target!==document.getElementById('catalogEditorModal'))return;
  document.getElementById('catalogEditorModal').classList.add('hidden');
}
function saveCatalogEditor(){
  const id=document.getElementById('catalogEditId').value;
  const name=document.getElementById('catalogEditName').value.trim();
  const unit=document.getElementById('catalogEditUnit').value.trim()||'Stk.';
  const raw=document.getElementById('catalogEditPrice').value;
  const price=raw===''?0:Number(String(raw).replace(',','.'));
  if(!name)return toast('Bitte eine Bezeichnung eingeben');
  if(Number.isNaN(price))return toast('Bitte einen gültigen Preis eingeben');
  if(id){
    const x=data.catalog.find(v=>v.id===id);
    if(x)Object.assign(x,{name,unit,price,type:catalogEditorType,trade:x.trade||data.settings.trade||'garden'});
  }else{
    data.catalog.push({id:uid(),name,unit,price,type:catalogEditorType,trade:data.settings.trade||''});
  }
  closeCatalogEditor();
  saveData(id?'Katalogposition geändert':'Katalogposition erstellt',name);
  renderCatalog();
  toast(id?'✓ Position gespeichert':'✓ Position hinzugefügt');
}
function closeOfferStatusModal(e){
  if(e&&e.target!==document.getElementById('offerStatusModal'))return;
  document.getElementById('offerStatusModal').classList.add('hidden');
}
async function setOfferStatusFromModal(status){
  const id=document.getElementById('statusOfferId').value;
  const o=data.offers.find(x=>x.id===id);
  if(!o)return closeOfferStatusModal();

  const previousStatus=o.status;
  o.status=status;
  closeOfferStatusModal();
  saveData('Angebotsstatus geändert',`${o.number||''} · ${statusLabel(status)}`);
  if(status==='accepted'&&previousStatus!=='accepted'){
    const c=data.customers.find(x=>x.id===o.customerId);
    globalThis.Notifications?.notifyOwnerOffice?.('Angebot angenommen',`${c?.name||'Kunde'} · ${o.subject||o.number||'Angebot'}`,{type:'offer_accepted',tag:`offer-accepted-${o.id}`,dedupeHours:1,url:'./?screen=offers'}).catch(()=>{});
  }

  if(status!=='completed'){
    toast('✓ Status geändert');
    return;
  }

  const existing=findInvoiceForOffer(o);
  if(existing){
    const openExisting=await appConfirm({
      title:'Rechnung bereits vorhanden',
      text:`Für dieses Angebot gibt es bereits die Rechnung ${existing.number}. Möchtest du sie jetzt öffnen?`,
      confirmLabel:'Rechnung öffnen',
      icon:'🧾'
    });
    if(openExisting)editInvoice(existing.id);
    else toast('✓ Angebot abgeschlossen');
    return;
  }

  const create=await appConfirm({
    title:'Angebot abgeschlossen',
    text:'Möchtest du jetzt direkt einen Rechnungsentwurf aus diesem Angebot erstellen? Positionen, Preise, Anfahrt und Rabatt werden übernommen. Vor dem Versand kannst du alles noch prüfen.',
    confirmLabel:'Rechnung erstellen',
    icon:'🧾'
  });

  if(!create){
    toast('✓ Angebot abgeschlossen · keine Rechnung erstellt');
    return;
  }

  const inv=createInvoiceFromOfferObject(o);
  if(!inv){
    toast('Rechnung konnte nicht erstellt werden');
    return;
  }

  saveData('Rechnungsentwurf erstellt',`${inv.number} aus ${o.number||'Angebot'}`);
  editInvoice(inv.id);
  toast('🧾 Rechnungsentwurf erstellt · bitte prüfen');
}

let appConfirmResolver=null;
function appConfirm({title='Bestätigen',text='',confirmLabel='Weiter',icon='🔐',danger=false}={}){
  const modal=document.getElementById('appConfirmModal');
  document.getElementById('appConfirmTitle').textContent=title;
  document.getElementById('appConfirmText').textContent=text;
  document.getElementById('appConfirmIcon').textContent=icon;
  const yes=document.getElementById('appConfirmYes');
  yes.textContent=confirmLabel;
  yes.className='btn '+(danger?'danger':'primary');
  modal.classList.remove('hidden');
  return new Promise(resolve=>{appConfirmResolver=resolve});
}
function resolveAppConfirm(value){
  document.getElementById('appConfirmModal').classList.add('hidden');
  const r=appConfirmResolver;appConfirmResolver=null;if(r)r(value);
}
function openDeleteDataModal(){
  document.getElementById('deleteDataPhrase').value='';
  document.getElementById('deleteDataModal').classList.remove('hidden');
}
function closeDeleteDataModal(e){
  if(e&&e.target!==document.getElementById('deleteDataModal'))return;
  document.getElementById('deleteDataModal').classList.add('hidden');
}
function confirmDeleteAllData(){
  if(document.getElementById('deleteDataPhrase').value.trim().toUpperCase()!=='LÖSCHEN')return toast('Bitte LÖSCHEN eingeben');
  AppRepository.clear(KEY);localStorage.removeItem(WEATHER_CACHE_KEY);location.reload();
}


const PRODUCT_TOUR_STEPS=[
  {screen:'today',selector:'.bottomNav [data-screen="today"]',icon:'☀️',title:'1. Dein Arbeitstag',text:'Auf „Heute“ siehst du Aufgaben, Termine, Wetter und die wichtigsten Schnellzugriffe. Das ist deine tägliche Startseite.'},
  {screen:'customers',selector:'#customers .btn.primary',icon:'👥',title:'2. Kunden & Kundenakten',text:'Lege einen Kunden einmal an. Tippe danach auf „Akte öffnen“: Dort sammeln wir Baustellen, Fotos, Angebote und Rechnungen zu diesem Kunden.'},
  {screen:'offers',selector:'#offers .btn.primary',icon:'📄',title:'3. Angebote erstellen',text:'Unter „Angebote“ startest du mit + Neu. Kunde auswählen, Auftrag benennen, Leistungen oder Material hinzufügen, Menge und Preis prüfen – speichern, fertig.'},
  {screen:'calendar',selector:'.bottomNav [data-screen="calendar"]',icon:'📅',title:'4. Termine planen',text:'Besichtigungen und Baustellentermine landen im Kalender. Später synchronisieren wir ihn mit den Konten des Betriebs.'},
  {screen:'more',selector:'#more .quick:nth-child(1)',icon:'🏗️',title:'5. Baustellen dokumentieren',text:'Unter „Mehr → Baustellen“ verwaltest du laufende Aufträge. In jeder Baustelle kannst du Fotos und Dokumentationsnotizen speichern.'},
  {screen:'more',selector:'#more .quick:nth-child(2)',icon:'🧾',title:'6. Rechnung nach Abschluss',text:'Wird eine Baustelle abgeschlossen, bereitet AngebotsPilot automatisch einen Rechnungsentwurf vor. Vor Versand prüft der Betrieb alles noch einmal.'},
  {screen:'more',selector:'#more .quick:nth-child(5)',icon:'📦',title:'7. Deine Preisliste',text:'Materialien und Leistungen liegen im Betriebskatalog. Standardpositionen sind vorbereitet; du ergänzt nur deine eigenen Preise und Positionen.'},
  {screen:'more',selector:'#more .quick:nth-child(7)',icon:'👑',title:'8. Chef & Mitarbeiter',text:'In der Rollen-Vorschau kannst du Chef, Büro und Mitarbeiter testen. Aktuell ist das nur lokal simuliert; echte sichere Rechte folgen später mit Benutzerkonten.'},
  {screen:'today',selector:'.bottomNav [data-screen="today"]',icon:'✓',title:'Startklar',text:'Das war die ganze App. Kunde, Adresse, Baustelle und Kalender arbeiten zusammen: einmal eintragen, an den passenden Stellen wiederverwenden. Merke dir nur: Kunde → Angebot → Baustelle → Dokumentation → Rechnung.'}
]

const OFFER_GUIDE_STEPS=[
  {screen:'offers',selector:'#offers .btn.primary',icon:'📄',title:'1. Neues Angebot',text:'Starte unter Angebote mit „+ Neu“. Wir öffnen im nächsten Schritt ein leeres Angebot für dich.'},
  {screen:'offerEditor',prepare:'newOffer',selector:'#offerCustomer',icon:'👤',title:'2. Kunde auswählen',text:'Wähle den Kunden aus – oder lege ihn direkt hier neu an, ohne das Angebot zu verlassen.'},
  {screen:'offerEditor',selector:'#offerSubject',icon:'✍️',title:'3. Auftrag benennen',text:'Schreibe kurz, worum es geht – zum Beispiel „Terrassenreinigung“ oder „Bad renovieren“. Notizen sind optional.'},
  {screen:'offerEditor',selector:'.addPositionMain',icon:'＋',title:'4. Positionen hinzufügen',text:'Tippe auf „+ Position“. Suche Material oder Leistungen aus deinem Katalog und füge sie mit dem Plus hinzu.'},
  {screen:'offerEditor',selector:'#offerLines',icon:'🧮',title:'5. Menge & Preis prüfen',text:'Jede Position erscheint hier. Prüfe Menge, Einheit und Einzelpreis. Du kannst alles direkt ändern.'},
  {screen:'offerEditor',selector:'.moreDetails',icon:'⚙️',title:'6. Nur wenn nötig',text:'Datum, Status, Anfahrt und Rabatt sind unter „Weitere Angaben“ versteckt. Für ein normales Angebot musst du hier meist nichts ändern.'},
  {screen:'offerEditor',selector:'.stickyOfferActions',icon:'✅',title:'7. Prüfen & speichern',text:'Öffne die Vorschau und kontrolliere das Angebot. Danach speichern – fertig. Später kannst du den Status auf „Versendet“ oder „Angenommen“ setzen.'}
];


function setOnboardingActive(active){
  const onboarding=document.getElementById('onboarding');
  if(onboarding) onboarding.classList.toggle('hidden',!active);
  document.body.classList.toggle('onboarding-active',!!active);
}

let productTourIndex=0;
let activeTourSteps=PRODUCT_TOUR_STEPS;
let activeTourMode='app';

function startProductTour(force=false){
  if(!force && localStorage.getItem('dh_product_tour_v1_done')==='1')return;
  const tour=document.getElementById('productTour');
  if(!tour){toast('Einführung konnte nicht geladen werden');return}
  activeTourMode='app';activeTourSteps=PRODUCT_TOUR_STEPS;productTourIndex=0;
  tour.classList.remove('hidden');
  document.body.classList.add('tour-active');
  setOnboardingActive(false);
  requestAnimationFrame(()=>renderProductTourStep());
}
function startOfferGuide(){
  const tour=document.getElementById('productTour');
  if(!tour){toast('Angebots-Guide konnte nicht geladen werden');return}
  activeTourMode='offer';activeTourSteps=OFFER_GUIDE_STEPS;productTourIndex=0;
  tour.classList.remove('hidden');
  document.body.classList.add('tour-active');
  setOnboardingActive(false);
  requestAnimationFrame(()=>renderProductTourStep());
}
function finishOnboardingWithTour(){
  localStorage.setItem('dh_onboarding_v8_done','1');localStorage.setItem('dh_name_setup_v10_done','1');
  document.getElementById('onboarding').classList.add('hidden');setOnboardingActive(false);renderAll();globalThis.requireCloudEntry?.();
  setTimeout(()=>startProductTour(true),220);
}
function renderProductTourStep(){
  document.querySelectorAll('.tour-target').forEach(x=>x.classList.remove('tour-target'));
  const step=activeTourSteps[productTourIndex];
  if(step.prepare==='newOffer'){
    if(!document.getElementById('offerEditor')?.classList.contains('active'))newOffer();
  }else{
    showScreen(step.screen);
  }
  setTimeout(()=>{
    const target=document.querySelector(step.selector);
    const spot=document.querySelector('#productTour .tourSpotlight');
    if(target&&spot){
      const r=target.getBoundingClientRect(),pad=7;
      spot.style.left=Math.max(4,r.left-pad)+'px';
      spot.style.top=Math.max(4,r.top-pad)+'px';
      spot.style.width=Math.min(window.innerWidth-8,r.width+pad*2)+'px';
      spot.style.height=(r.height+pad*2)+'px';
      target.classList.add('tour-target');
      target.scrollIntoView?.({block:'center',behavior:'smooth'});
    }
    document.getElementById('tourCounter').textContent=`${productTourIndex+1} von ${activeTourSteps.length}`;
    document.getElementById('tourIcon').textContent=step.icon;
    document.getElementById('tourTitle').textContent=step.title;
    document.getElementById('tourText').textContent=step.text;
    document.getElementById('tourDots').innerHTML=activeTourSteps.map((_,i)=>`<span class="tourDot ${i===productTourIndex?'active':''}"></span>`).join('');
    document.getElementById('tourBack').style.visibility=productTourIndex===0?'hidden':'visible';
    document.getElementById('tourNext').textContent=productTourIndex===activeTourSteps.length-1?'Fertig ✓':'Weiter →';
  },120);
}
function nextTourStep(){
  if(productTourIndex>=activeTourSteps.length-1){finishProductTour();return}
  productTourIndex++;renderProductTourStep();
}
function previousTourStep(){
  if(productTourIndex<=0)return;
  productTourIndex--;renderProductTourStep();
}
function finishProductTour(){
  if(activeTourMode==='app')localStorage.setItem('dh_product_tour_v1_done','1');
  const tour=document.getElementById('productTour');if(tour)tour.classList.add('hidden');
  document.body.classList.remove('tour-active');
  document.querySelectorAll('.tour-target').forEach(x=>x.classList.remove('tour-target'));
  showScreen(activeTourMode==='offer'?'offers':'today');
  toast(activeTourMode==='offer'?'✓ Angebots-Guide abgeschlossen':'✓ Einführung abgeschlossen');
}
let data=loadData(),currentOfferFilter='all',currentTaskFilter='open',calDate=new Date(),draftLines=[];
globalThis.data=data;

function catalogTradeKey(x){
  if(x?.trade&&TRADE_CATALOGS[x.trade])return x.trade;
  const name=String(x?.name||'').trim().toLowerCase();
  const matches=[];
  Object.entries(TRADE_CATALOGS).forEach(([trade,t])=>{
    if(t.items.some(item=>String(item[1]).toLowerCase()===name))matches.push(trade);
  });
  return matches.length===1?matches[0]:(data.settings.trade||'garden');
}
function isCurrentTradeCatalogItem(x){
  return catalogTradeKey(x)===(data.settings.trade||'garden');
}
function repairCatalogV102(){
  const current=data.settings.trade||'garden';
  data.catalog=Array.isArray(data.catalog)?data.catalog:[];
  data.catalog.forEach(x=>{
    const inferred=catalogTradeKey(x);
    x.trade=x.trade&&TRADE_CATALOGS[x.trade]?x.trade:inferred;
    const def=TRADE_CATALOGS[x.trade]?.items.find(item=>String(item[1]).toLowerCase()===String(x.name||'').toLowerCase());
    if(def){x.type=def[0];x.unit=x.unit||def[2]}
  });
  Object.entries(TRADE_CATALOGS).forEach(([trade,t])=>{
    const existing=new Set(data.catalog.filter(x=>catalogTradeKey(x)===trade).map(x=>String(x.name||'').toLowerCase()));
    t.items.forEach(([type,name,unit])=>{
      if(!existing.has(name.toLowerCase()))data.catalog.push({id:uid(),name,unit,price:0,type,trade,purchasePrice:0,markup:0});
    });
  });
  persistAppState();
}

repairCatalogV102();
migrateLegacyTravelV108();


function uid(){return AppRepository?.makeId?AppRepository.makeId():(globalThis.crypto?.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2,9))}
function loadData(){try{const raw=AppRepository.load(KEY),base=structuredClone(defaultData),merged={...base,...raw,settings:{...base.settings,...(raw.settings||{})},privacy:{...base.privacy,...(raw.privacy||{}),consents:{...base.privacy.consents,...(raw.privacy?.consents||{})}},audit:Array.isArray(raw.audit)?raw.audit:[],users:Array.isArray(raw.users)?raw.users:[],invoices:Array.isArray(raw.invoices)?raw.invoices:[],customers:(Array.isArray(raw.customers)?raw.customers:base.customers).map(c=>({...c,folderNotes:c.folderNotes||'',photos:Array.isArray(c.photos)?c.photos:[]})),jobs:(Array.isArray(raw.jobs)?raw.jobs:base.jobs).map(j=>({...j,startTime:j.startTime||'08:00',durationValue:Number(j.durationValue)||1,durationUnit:j.durationUnit==='hours'?'hours':'days',docNote:j.docNote||'',photos:Array.isArray(j.photos)?j.photos:[]}))};AppRepository.prepare(merged,raw);return merged}catch(e){const fresh=structuredClone(defaultData);AppRepository.prepare(fresh,{});return fresh}}
function addAudit(action,details=''){data.audit=data.audit||[];data.audit.unshift({id:uid(),at:new Date().toISOString(),action,details});data.audit=data.audit.slice(0,100)}
function persistAppState(){AppRepository.save(data,KEY);return data}
function saveData(action='Daten geändert',details=''){addAudit(action,details);persistAppState();renderAll()}
function euro(n){return new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)||0)}
function dateDE(s){if(!s)return'';return new Date(s+'T12:00:00').toLocaleDateString('de-DE')}
function todayISO(){return new Date().toISOString().slice(0,10)}
function toast(t){const e=document.getElementById('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');document.querySelectorAll('.navBtn').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));window.scrollTo({top:0,behavior:'smooth'});renderAll()}
document.querySelectorAll('.navBtn').forEach(b=>b.onclick=()=>showScreen(b.dataset.screen));
document.getElementById('themeBtn').onclick=()=>{document.documentElement.classList.toggle('light');localStorage.setItem('dh_theme',document.documentElement.classList.contains('light')?'light':'dark')};if(localStorage.getItem('dh_theme')==='light')document.documentElement.classList.add('light');

function maybeAskOwnerName(){
  if(localStorage.getItem('dh_name_setup_v10_done')==='1')return;
  if(shouldShowOnboarding())return;
  const modal=document.getElementById('nameSetupModal');if(!modal)return;
  const input=document.getElementById('startupOwnerName');if(input)input.value=(data.settings.ownerName&&data.settings.ownerName!=='Harun')?data.settings.ownerName:'';
  modal.classList.remove('hidden');
}
function saveStartupOwnerName(){
  const name=document.getElementById('startupOwnerName').value.trim();
  if(!name)return toast('Bitte deinen Vornamen eingeben');
  data.settings.ownerName=name;localStorage.setItem('dh_name_setup_v10_done','1');
  document.getElementById('nameSetupModal').classList.add('hidden');
  saveData('Name eingerichtet',name);toast(`Willkommen, ${name} 👋`);
}


function getCustomerById(id){return (data.customers||[]).find(c=>c.id===id)||null}
function syncJobCustomerFields(){
  const c=getCustomerById(document.getElementById('jobCustomer')?.value||'');
  const address=document.getElementById('jobAddress');
  if(c&&address){address.value=c.address||'';address.dataset.autoFilled='1'}
  refreshJobOfferOptions();
  const offers=(data.offers||[]).filter(o=>o.customerId===c?.id&&o.status==='accepted');
  const offerEl=document.getElementById('jobOffer');
  if(offerEl&&offers.length===1){offerEl.value=offers[0].id;syncJobOfferFields()}
}
function syncEventCustomerFields(){
  const c=getCustomerById(document.getElementById('eventCustomer')?.value||'');
  if(c){const a=document.getElementById('eventAddress');if(a){a.value=c.address||'';a.dataset.autoFilled='1'}}
}
function syncJobOfferFields(){
  const id=document.getElementById('jobOffer')?.value||'';if(!id)return;
  const o=(data.offers||[]).find(x=>x.id===id);if(!o)return;
  const title=document.getElementById('jobTitle');if(title&&!title.value.trim())title.value=o.subject||'';
  const c=getCustomerById(o.customerId);
  if(c){document.getElementById('jobCustomer').value=c.id;updateSoftCustomerButton('jobCustomer');document.getElementById('jobAddress').value=c.address||''}
  const notes=document.getElementById('jobNotes');if(notes&&!notes.value.trim()&&o.notes)notes.value=o.notes;
}


let customerPickerTarget='offerCustomer';
function updateSoftCustomerButton(selectId){
  const select=document.getElementById(selectId),button=document.getElementById(selectId+'Button');if(!select||!button)return;
  const c=getCustomerById(select.value);
  button.querySelector('.softSelectText').innerHTML=c?`<b>${escapeHTML(c.name)}</b><small>${escapeHTML(c.address||'Kunde ausgewählt')}</small>`:'<b>Kunde auswählen</b><small>Tippen zum Auswählen</small>';
  button.classList.toggle('hasValue',!!c);
}
function openCustomerPicker(target='offerCustomer'){
  customerPickerTarget=target;
  const q=document.getElementById('customerPickerSearch');if(q)q.value='';
  renderCustomerPicker();
  document.getElementById('customerPickerModal').classList.remove('hidden');
}
function closeCustomerPicker(e){
  if(e&&e.target!==document.getElementById('customerPickerModal'))return;
  document.getElementById('customerPickerModal').classList.add('hidden');
}
function renderCustomerPicker(){
  const q=(document.getElementById('customerPickerSearch')?.value||'').toLowerCase().trim();
  const list=(data.customers||[]).filter(c=>(c.name+' '+c.address+' '+c.phone).toLowerCase().includes(q));
  const box=document.getElementById('customerPickerList');if(!box)return;
  box.innerHTML=list.length?list.map(c=>`<button class="customerChoice" type="button" onclick="selectCustomerFromPicker('${c.id}')"><span class="customerAvatar">${escapeHTML((c.name||'?').slice(0,1).toUpperCase())}</span><span><b>${escapeHTML(c.name)}</b><small>${escapeHTML(c.address||c.phone||'Keine Adresse hinterlegt')}</small></span><strong>✓</strong></button>`).join(''):'<div class="pickerEmpty">Kein Kunde gefunden.</div>';
}
function selectCustomerFromPicker(id){
  const select=document.getElementById(customerPickerTarget);if(select){select.value=id}
  updateSoftCustomerButton(customerPickerTarget);
  if(customerPickerTarget==='eventCustomer')syncEventCustomerFields();
  if(customerPickerTarget==='jobCustomer')syncJobCustomerFields();
  closeCustomerPicker();
  if(navigator.vibrate)navigator.vibrate(10);
}
function openQuickCustomerModal(target='offerCustomer'){
  customerPickerTarget=target||'offerCustomer';
  document.getElementById('quickCustomerTarget').value=customerPickerTarget;
  ['quickCustName','quickCustAddress','quickCustPhone','quickCustEmail'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('quickCustomerModal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('quickCustName')?.focus(),120);
}
function closeQuickCustomerModal(e){
  if(e&&e.target!==document.getElementById('quickCustomerModal'))return;
  document.getElementById('quickCustomerModal').classList.add('hidden');
}
function saveQuickCustomer(){
  const name=document.getElementById('quickCustName').value.trim();
  if(!name)return toast('Bitte Name oder Firma eingeben');
  const obj={id:uid(),name,contact:'',address:document.getElementById('quickCustAddress').value.trim(),phone:document.getElementById('quickCustPhone').value.trim(),email:document.getElementById('quickCustEmail').value.trim(),notes:'',folderNotes:'',photos:[]};
  data.customers.push(obj);
  const target=document.getElementById(document.getElementById('quickCustomerTarget').value||customerPickerTarget);
  if(target){target.innerHTML=customerOptions(obj.id);target.value=obj.id}
  customerPickerTarget=document.getElementById('quickCustomerTarget').value||customerPickerTarget;
  updateSoftCustomerButton(customerPickerTarget);
  closeQuickCustomerModal();closeCustomerPicker();
  saveData('Kunde direkt angelegt',obj.name);
  renderCustomers();
  toast('✓ Kunde angelegt und ausgewählt');
}

function customerOptions(selected=''){const opts=['<option value="">– Kunde auswählen –</option>',...data.customers.map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${escapeHTML(c.name)}</option>`)];return opts.join('')}
function escapeHTML(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function statusLabel(s){return({draft:'Entwurf',sent:'Versendet',accepted:'Angenommen',rejected:'Abgelehnt',declined:'Abgelehnt',completed:'Abgeschlossen',open:'Geplant',active:'In Arbeit',done:'Abgeschlossen'})[s]||s}

function normalizeDiscountType(type){return type==='percent'?'percent':'euro'}
function discountAmount(base,value,type){
  const v=Number(value)||0,t=normalizeDiscountType(type);
  if(t==='percent')return base*(Math.max(0,Math.min(100,v))/100);
  return v;
}
function discountDisplayLabel(obj){
  const type=normalizeDiscountType(obj?.discountType),value=Number(obj?.discountValue ?? obj?.discount ?? 0)||0;
  return type==='percent'?`Rabatt (${value.toLocaleString('de-DE',{maximumFractionDigits:2})} %)`:'Rabatt';
}
function setDiscountType(owner,type){
  type=normalizeDiscountType(type);
  const hidden=document.getElementById(owner+'DiscountType');if(hidden)hidden.value=type;
  const suffix=document.getElementById(owner+'DiscountSuffix');if(suffix)suffix.textContent=type==='percent'?'%':'€';
  document.querySelectorAll(`[data-discount-owner="${owner}"]`).forEach(b=>b.classList.toggle('active',b.dataset.discountType===type));
  const input=document.getElementById(owner+'Discount');
  if(input){input.max=type==='percent'?'100':'';input.step=type==='percent'?'0.5':'0.01'}
}
function migrateLegacyTravelV108(){
  let changed=false;
  const move=(doc)=>{
    const travel=Number(doc.travel)||0;if(!travel)return;
    doc.lines=Array.isArray(doc.lines)?doc.lines:[];
    const existing=doc.lines.find(l=>String(l.name||'').trim().toLowerCase()==='anfahrt');
    if(existing)existing.price=(Number(existing.price)||0)+travel;
    else doc.lines.push({name:'Anfahrt',qty:1,unit:'Pauschale',price:travel,type:'service'});
    doc.travel=0;changed=true;
  };
  (data.offers||[]).forEach(move);(data.invoices||[]).forEach(move);
  if(changed)persistAppState();
}

function renderAll(){renderToday();renderOffers();renderInvoices();renderCustomers();renderCalendar();renderTasks();renderJobs();renderCatalog();loadSettingsForm();renderPrivacy();renderCachedWeather();applyRoleUI();if(document.getElementById('customerDetail')?.classList.contains('active'))renderCustomerFolder()}
function greetingForNow(){
  const h=new Date().getHours();
  return h<11?'Guten Morgen':h<18?'Guten Tag':'Guten Abend';
}
function workerJobStatusLabel(status){return status==='done'?'Abgeschlossen':status==='active'?'In Arbeit':'Geplant'}
function renderWorkerHome(todayTasks=[]){
  const worker=(data.privacy?.role||'owner')==='worker';
  if(!worker)return;
  const jobs=[...(data.jobs||[])].sort((a,b)=>String(a.start||'9999').localeCompare(String(b.start||'9999')));
  const today=todayISO();
  const todayJobs=jobs.filter(j=>jobWorkDates(j).includes(today)&&j.status!=='done');
  const openTasks=(todayTasks||[]).filter(x=>!x.done);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  set('workerStatJobs',jobs.filter(j=>j.status!=='done').length);
  set('workerStatToday',todayJobs.length);
  set('workerStatTasks',openTasks.length);
  set('workerHomeJobMeta',todayJobs.length?`${todayJobs.length} ${todayJobs.length===1?'Einsatz':'Einsätze'} heute`:'Deine nächsten Einsätze');

  const box=document.getElementById('workerHomeJobs');
  if(box){
    const visible=[...todayJobs,...jobs.filter(j=>j.start!==today&&j.status!=='done')].filter((j,i,a)=>a.findIndex(x=>x.id===j.id)===i).slice(0,3);
    box.innerHTML=visible.length?visible.map(j=>{
      const c=data.customers.find(x=>x.id===j.customerId);
      const isToday=jobWorkDates(j).includes(today);
      return `<div class="workerJobHomeCard ${j.status==='active'?'activeJob':''}">
        <div class="workerJobHomeTop"><div><span class="workerJobDate ${isToday?'today':''}">${isToday?'HEUTE':dateDE(j.start)}</span><h3>${escapeHTML(j.title||'Baustelle')}</h3><p>${escapeHTML(c?.name||'')}${j.address?' · '+escapeHTML(j.address):''}</p></div><span class="badge ${j.status==='done'?'done':'open'}">${workerJobStatusLabel(j.status)}</span></div>
        <div class="workerJobHomeActions"><button class="btn primary small" onclick="editJob('${j.id}')">${j.status==='active'?'⏱️ Weiterarbeiten':'Baustelle öffnen'}</button>${j.address?`<button class="btn small" onclick="openMaps('${encodeURIComponent(j.address)}')">📍 Route</button>`:''}</div>
      </div>`;
    }).join(''):'<div class="empty workerEmptyHome"><b>Heute nichts zugewiesen.</b><span>Neue Baustellen erscheinen hier automatisch, sobald der Betrieb sie dir zuweist.</span></div>';
  }
  globalThis.TimeTracking?.refreshDashboard?.();
}

function renderOfficeHome(todayEvents,openOffers,openTasks){
  const role=data.privacy?.role||'owner';
  if(role!=='office')return;

  const today=todayISO();
  const invoices=(data.invoices||[]);
  const openInvoices=invoices.filter(i=>i.status==='open');
  const overdue=openInvoices.filter(i=>i.dueDate&&i.dueDate<today);
  const acceptedOffers=(data.offers||[]).filter(o=>o.status==='accepted');

  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=String(value)};
  set('officeStatEvents',todayEvents.length);
  set('officeStatOffers',openOffers.length);
  set('officeStatInvoices',openInvoices.length);
  set('officeStatOverdue',overdue.length);

  const focus=[];
  if(overdue.length){
    focus.push(`<button class="officeFocusItem urgent" onclick="showScreen('invoices')"><span class="officeFocusIcon">⚠️</span><div><b>${overdue.length} ${overdue.length===1?'Rechnung ist':'Rechnungen sind'} überfällig</b><small>Zahlungsstatus prüfen und ggf. erinnern.</small></div><span>›</span></button>`);
  }
  if(todayEvents.length){
    const next=todayEvents[0];
    focus.push(`<button class="officeFocusItem" onclick="showScreen('calendar')"><span class="officeFocusIcon">📅</span><div><b>${todayEvents.length} ${todayEvents.length===1?'Termin':'Termine'} heute</b><small>Nächster: ${escapeHTML(next.time||'')} Uhr · ${escapeHTML(next.title||'Termin')}</small></div><span>›</span></button>`);
  }
  if(acceptedOffers.length){
    focus.push(`<button class="officeFocusItem" onclick="showScreen('offers')"><span class="officeFocusIcon">✅</span><div><b>${acceptedOffers.length} angenommene ${acceptedOffers.length===1?'Angebot':'Angebote'}</b><small>Baustelle und Ausführung im Blick behalten.</small></div><span>›</span></button>`);
  }
  if(openTasks.length){
    focus.push(`<button class="officeFocusItem" onclick="showScreen('tasks')"><span class="officeFocusIcon">☑️</span><div><b>${openTasks.length} offene ${openTasks.length===1?'Aufgabe':'Aufgaben'} heute</b><small>Prioritäten für den Tag abarbeiten.</small></div><span>›</span></button>`);
  }
  if(!focus.length){
    focus.push(`<div class="officeFocusEmpty"><span>✓</span><div><b>Alles im Blick.</b><small>Aktuell gibt es nichts Dringendes für das Büro.</small></div></div>`);
  }

  const box=document.getElementById('officeFocusList');
  if(box)box.innerHTML=focus.slice(0,4).join('');
}

function renderToday(){
  const d=new Date(),role=data.privacy?.role||'owner',worker=role==='worker',office=role==='office';
  document.getElementById('todayDate').textContent=d.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});
  document.getElementById('ownerGreeting').textContent=data.settings.ownerName||'Handwerker';
  const hero=document.querySelector('#today .hero h2');if(hero)hero.firstChild.textContent=`${greetingForNow()}, `;
  const t=todayISO(),todayTasks=data.tasks.filter(x=>x.date===t),openTasks=todayTasks.filter(x=>!x.done),todayEvents=data.events.filter(x=>eventOccursOnDate(x,t)).sort((a,b)=>a.time.localeCompare(b.time));
  const openOffers=data.offers.filter(o=>['draft','sent'].includes(o.status));
  document.getElementById('statTasks').textContent=openTasks.length;
  document.getElementById('statEvents').textContent=todayEvents.length;
  document.getElementById('statOffers').textContent=openOffers.length;
  document.getElementById('statValue').textContent=euro(openOffers.reduce((s,o)=>s+(o.total||0),0));
  document.getElementById('taskProgress').textContent=`${todayTasks.filter(x=>x.done).length} von ${todayTasks.length} erledigt`;
  document.getElementById('todayTasks').innerHTML=todayTasks.length?todayTasks.map(taskHTML).join(''):'<div class="empty">Heute ist noch nichts eingetragen.</div>';
  document.getElementById('todayEvents').innerHTML=todayEvents.length?todayEvents.map(e=>`<div class="event"><div class="eventTime">${e.time} Uhr · ${escapeHTML(e.type)}</div><b>${escapeHTML(e.title)}</b><div class="mini">${escapeHTML(e.address||'')}</div></div>`).join(''):'<div class="empty">Heute keine Termine.</div>';
  const tasksTitle=document.getElementById('todayTasksTitle');if(tasksTitle)tasksTitle.textContent=worker?'Meine Aufgaben':office?'Büro-Aufgaben heute':'Heute erledigen';
  if(worker){
    const activeJobs=(data.jobs||[]).filter(j=>j.status==='active').length,todayJobs=(data.jobs||[]).filter(j=>j.start===t&&j.status!=='done').length;
    document.getElementById('dailyMessage').textContent=activeJobs?'Eine Baustelle läuft gerade. Zeiten und Dokumentation findest du direkt im Auftrag.':todayJobs?'Deine Einsätze für heute sind vorbereitet. Öffne eine Baustelle für Navigation und Zeiterfassung.':'Dir ist heute keine Baustelle zugewiesen.';
    renderWorkerHome(todayTasks);
  }else if(office){
    renderOfficeHome(todayEvents,openOffers,openTasks);
    const overdue=(data.invoices||[]).filter(i=>i.status==='open'&&i.dueDate&&i.dueDate<t).length;
    document.getElementById('dailyMessage').textContent=overdue
      ?`${overdue} ${overdue===1?'Rechnung ist':'Rechnungen sind'} überfällig. Termine und Büroaufgaben sind darunter zusammengefasst.`
      :todayEvents.length||openTasks.length
        ?'Termine, Angebote und offene Büroaufgaben für heute sind vorbereitet.'
        :'Im Büro ist aktuell nichts Dringendes offen.';
  }else{
    document.getElementById('dailyMessage').textContent=openTasks.length||todayEvents.length?'Dein Tag ist vorbereitet. Arbeite die wichtigsten Punkte nacheinander ab.':'Heute ist noch frei – ideal für Angebote, Akquise oder Planung.';
  }
}
function taskHTML(t){return `<div class="item"><div class="taskRow"><button class="taskCheck ${t.done?'checked':''}" onclick="toggleTask('${t.id}')">${t.done?'✓':''}</button><div class="taskContent ${t.done?'doneText':''}"><h3>${escapeHTML(t.title)}</h3><p>${dateDE(t.date)}${t.notes?' · '+escapeHTML(t.notes):''}</p></div><button class="btn small" onclick="editTask('${t.id}')">✎</button></div></div>`}
function toggleTask(id){const t=data.tasks.find(x=>x.id===id);if(t){t.done=!t.done;saveData()}}
function newTask(){document.getElementById('taskId').value='';document.getElementById('taskTitle').value='';document.getElementById('taskDate').value=todayISO();document.getElementById('taskPriority').value='normal';document.getElementById('taskNotes').value='';showScreen('taskEditor')}
function editTask(id){const t=data.tasks.find(x=>x.id===id);if(!t)return;document.getElementById('taskId').value=t.id;document.getElementById('taskTitle').value=t.title;document.getElementById('taskDate').value=t.date;document.getElementById('taskPriority').value=t.priority;document.getElementById('taskNotes').value=t.notes||'';showScreen('taskEditor')}
function saveTask(){const id=document.getElementById('taskId').value,obj={id:id||uid(),title:document.getElementById('taskTitle').value.trim(),date:document.getElementById('taskDate').value,priority:document.getElementById('taskPriority').value,notes:document.getElementById('taskNotes').value.trim(),done:id?(data.tasks.find(x=>x.id===id)?.done||false):false};if(!obj.title)return toast('Aufgabe fehlt');if(id)data.tasks[data.tasks.findIndex(x=>x.id===id)]=obj;else data.tasks.push(obj);saveData();showScreen('tasks');toast('Aufgabe gespeichert')}
function renderTasks(){const list=data.tasks.filter(t=>currentTaskFilter==='all'||(currentTaskFilter==='done'?t.done:!t.done)).sort((a,b)=>a.date.localeCompare(b.date));document.getElementById('taskList').innerHTML=list.length?list.map(taskHTML).join(''):'<div class="empty">Keine Aufgaben.</div>'}
document.querySelectorAll('#taskTabs .tab').forEach(b=>b.onclick=()=>{currentTaskFilter=b.dataset.filter;document.querySelectorAll('#taskTabs .tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderTasks()});
function newCustomer(){['customerId','custName','custContact','custAddress','custPhone','custEmail','custNotes'].forEach(id=>document.getElementById(id).value='');showScreen('customerEditor')}
function editCustomer(id){const c=data.customers.find(x=>x.id===id);if(!c)return;document.getElementById('customerId').value=c.id;document.getElementById('custName').value=c.name;document.getElementById('custContact').value=c.contact||'';document.getElementById('custAddress').value=c.address||'';document.getElementById('custPhone').value=c.phone||'';document.getElementById('custEmail').value=c.email||'';document.getElementById('custNotes').value=c.notes||'';showScreen('customerEditor')}
function saveCustomer(){const id=document.getElementById('customerId').value,obj={id:id||uid(),name:document.getElementById('custName').value.trim(),contact:document.getElementById('custContact').value.trim(),address:document.getElementById('custAddress').value.trim(),phone:document.getElementById('custPhone').value.trim(),email:document.getElementById('custEmail').value.trim(),notes:document.getElementById('custNotes').value.trim()};if(!obj.name)return toast('Name fehlt');if(id)data.customers[data.customers.findIndex(x=>x.id===id)]=obj;else data.customers.push(obj);saveData();showScreen('customers');toast('Kunde gespeichert')}

const CUSTOMER_FILE_DB='angebotspilot-files-v1';
const CUSTOMER_FILE_STORE='customerFiles';
let activeCustomerFileId='';
window.customerPreviewUrls=window.customerPreviewUrls||[];

function clearCustomerPreviewUrls(){
  (window.customerPreviewUrls||[]).forEach(url=>{try{URL.revokeObjectURL(url)}catch(e){}});
  window.customerPreviewUrls=[];
}
function openCustomerFileDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(CUSTOMER_FILE_DB,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(CUSTOMER_FILE_STORE)){
        const st=db.createObjectStore(CUSTOMER_FILE_STORE,{keyPath:'id'});
        st.createIndex('customerId','customerId',{unique:false});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function putCustomerFile(rec){
  rec={...AppRepository.fileMeta(data),...rec,companyId:rec.companyId||data.meta?.companyId||'',createdBy:rec.createdBy||data.meta?.currentUserId||''};
  const db=await openCustomerFileDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(CUSTOMER_FILE_STORE,'readwrite');
    tx.objectStore(CUSTOMER_FILE_STORE).put(rec);
    tx.oncomplete=()=>{db.close();resolve(rec)};
    tx.onerror=()=>reject(tx.error);
  });
}
async function getLocalCustomerFile(id){
  const db=await openCustomerFileDB();
  return new Promise((resolve,reject)=>{
    const req=db.transaction(CUSTOMER_FILE_STORE).objectStore(CUSTOMER_FILE_STORE).get(id);
    req.onsuccess=()=>{db.close();resolve(req.result||null)};
    req.onerror=()=>reject(req.error);
  });
}
async function listLocalCustomerFiles(customerId){
  const db=await openCustomerFileDB();
  return new Promise((resolve,reject)=>{
    const req=db.transaction(CUSTOMER_FILE_STORE).objectStore(CUSTOMER_FILE_STORE).index('customerId').getAll(customerId);
    req.onsuccess=()=>{db.close();const rows=req.result||[];const ctx=AppRepository.getContext(data);rows.forEach(r=>{r.companyId=r.companyId||ctx.companyId;r.createdBy=r.createdBy||ctx.userId;r.updatedAt=r.updatedAt||r.createdAt||new Date().toISOString();r.syncState=r.syncState||'local'});rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));resolve(rows)};
    req.onerror=()=>reject(req.error);
  });
}
async function deleteLocalCustomerFile(id){
  const db=await openCustomerFileDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(CUSTOMER_FILE_STORE,'readwrite');
    tx.objectStore(CUSTOMER_FILE_STORE).delete(id);
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onerror=()=>reject(tx.error);
  });
}
function looksCloudUuid(id=''){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id))}
async function listCustomerFiles(customerId){let local=[];try{local=await listLocalCustomerFiles(customerId)}catch(e){}let cloud=[];try{if(globalThis.CloudFiles?.ready?.())cloud=await globalThis.CloudFiles.listCustomerFiles(customerId)}catch(e){console.warn('Cloud-Kundenakten konnten nicht geladen werden',e)}return[...cloud,...local].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))}
async function getCustomerFile(id){if(looksCloudUuid(id)&&globalThis.CloudFiles?.ready?.()){try{return await globalThis.CloudFiles.getCustomerFile(id)}catch(e){console.warn('Cloud-Datei konnte nicht geladen werden',e)}}return getLocalCustomerFile(id)}
async function deleteCustomerFile(id){if(looksCloudUuid(id)&&globalThis.CloudFiles?.ready?.())return globalThis.CloudFiles.deleteCloudFile(id);return deleteLocalCustomerFile(id)}
function formatFileSize(bytes=0){
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${Math.round(bytes/1024)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}
function fileIconFor(type='',name=''){
  const n=String(name).toLowerCase();
  if(String(type).startsWith('image/'))return '🖼️';
  if(type==='application/pdf'||n.endsWith('.pdf'))return '📕';
  if(n.endsWith('.doc')||n.endsWith('.docx'))return '📘';
  if(n.endsWith('.xls')||n.endsWith('.xlsx')||n.endsWith('.csv'))return '📗';
  return '📄';
}
async function compressGalleryImage(file){
  return new Promise(resolve=>{
    const reader=new FileReader();
    reader.onerror=()=>resolve(file);
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>resolve(file);
      img.onload=()=>{
        const max=1600,scale=Math.min(1,max/Math.max(img.width,img.height));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.width*scale));
        canvas.height=Math.max(1,Math.round(img.height*scale));
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        canvas.toBlob(blob=>resolve(blob||file),'image/jpeg',.78);
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
async function addCustomerGalleryPhotos(event){
  if(!currentCustomerId)return toast('Bitte zuerst eine Kundenakte öffnen');
  const files=[...(event.target.files||[])].filter(f=>String(f.type).startsWith('image/'));
  if(!files.length)return;
  toast('Fotos werden gespeichert …');
  let added=0;
  for(const f of files.slice(0,20)){
    try{
      const blob=await compressGalleryImage(f);
      if(globalThis.CloudFiles?.ready?.())await globalThis.CloudFiles.uploadCustomerFiles(currentCustomerId,[{blob,name:f.name||`Foto ${added+1}.jpg`}],'photo');
      else await putCustomerFile({id:uid(),customerId:currentCustomerId,kind:'photo',name:f.name||`Foto ${added+1}.jpg`,type:blob.type||'image/jpeg',size:blob.size,createdAt:new Date().toISOString(),blob});
      added++;
    }catch(e){}
  }
  event.target.value='';
  currentCustomerFolderTab='photos';
  document.querySelectorAll('.folderTab').forEach(b=>b.classList.toggle('active',b.dataset.foldertab==='photos'));
  await renderCustomerFolder();
  toast(`✓ ${added} Foto${added===1?'':'s'} hinzugefügt`);
}
async function addCustomerDocuments(event){
  if(!currentCustomerId)return toast('Bitte zuerst eine Kundenakte öffnen');
  const files=[...(event.target.files||[])];
  if(!files.length)return;
  toast('Dokumente werden gespeichert …');
  let added=0;
  for(const f of files.slice(0,15)){
    try{
      if(globalThis.CloudFiles?.ready?.())await globalThis.CloudFiles.uploadCustomerFiles(currentCustomerId,[{blob:f,name:f.name||'Dokument'}],'document');
      else await putCustomerFile({id:uid(),customerId:currentCustomerId,kind:'document',name:f.name||'Dokument',type:f.type||'application/octet-stream',size:f.size,createdAt:new Date().toISOString(),blob:f});
      added++;
    }catch(e){}
  }
  event.target.value='';
  currentCustomerFolderTab='docs';
  document.querySelectorAll('.folderTab').forEach(b=>b.classList.toggle('active',b.dataset.foldertab==='docs'));
  await renderCustomerFolder();
  toast(`✓ ${added} Dokument${added===1?'':'e'} hinzugefügt`);
}
async function openCustomerStoredFile(id){
  const rec=await getCustomerFile(id);if(!rec)return;
  activeCustomerFileId=id;
  document.getElementById('fileViewerTitle').textContent=rec.name;
  if(window.activeCustomerFileURL){try{URL.revokeObjectURL(window.activeCustomerFileURL)}catch(e){}}
  const url=URL.createObjectURL(rec.blob);window.activeCustomerFileURL=url;
  const content=document.getElementById('fileViewerContent');
  content.innerHTML=String(rec.type).startsWith('image/')
    ?`<img src="${url}" alt="">`
    :`<div class="filePreviewIcon">${fileIconFor(rec.type,rec.name)}</div><b>${escapeHTML(rec.name)}</b><small>${formatFileSize(rec.size)} · ${new Date(rec.createdAt).toLocaleDateString('de-DE')}</small>`;
  document.getElementById('fileViewerOpenBtn').onclick=async()=>{
    try{
      const file=new File([rec.blob],rec.name,{type:rec.type});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:rec.name});return}
    }catch(e){}
    const a=document.createElement('a');a.href=url;a.download=rec.name;a.target='_blank';a.click();
  };
  document.getElementById('fileViewerDeleteBtn').onclick=()=>removeCustomerStoredFile(id);
  document.getElementById('customerFileViewer').classList.remove('hidden');
  applyRoleUI();
}
function closeCustomerFileViewer(e){
  if(e&&e.target!==document.getElementById('customerFileViewer'))return;
  document.getElementById('customerFileViewer').classList.add('hidden');
  if(window.activeCustomerFileURL){try{URL.revokeObjectURL(window.activeCustomerFileURL)}catch(err){}window.activeCustomerFileURL=''}
}
async function removeCustomerStoredFile(id){
  await deleteCustomerFile(id);
  closeCustomerFileViewer();
  await renderCustomerFolder();
  toast('Datei gelöscht');
}

let currentCustomerId='',currentCustomerFolderTab='overview';
function renderCustomers(){
  const q=(document.getElementById('customerSearch')?.value||'').toLowerCase(),list=data.customers.filter(c=>(c.name+' '+c.address+' '+c.phone).toLowerCase().includes(q));
  document.getElementById('customerList').innerHTML=list.length?list.map(c=>{
    const offers=data.offers.filter(o=>o.customerId===c.id).length,jobs=data.jobs.filter(j=>j.customerId===c.id).length,photos=data.jobs.filter(j=>j.customerId===c.id).reduce((n,j)=>n+(j.photos?.length||0),0);
    return `<div class="item customerCard"><div class="itemTop"><div><span class="folderMini">📁 Kundenakte</span><h3>${escapeHTML(c.name)}</h3><p>${escapeHTML(c.address||'Keine Adresse')}</p></div><button class="btn small primary" onclick="openCustomerFolder('${c.id}')">Akte öffnen</button></div><div class="customerStats"><span>🏗️ ${jobs} Baustellen</span><span>📄 ${offers} Angebote</span><span>📸 ${photos} Fotos</span></div><div class="itemActions contactActionRow">${c.phone?`<button class="btn small" onclick="location.href='tel:${encodeURIComponent(c.phone)}'">📞 Anrufen</button>`:`<button class="btn small disabledAction" disabled>📞 Telefon fehlt</button>`}${c.email?`<button class="btn small" onclick="location.href='mailto:${encodeURIComponent(c.email)}'">✉️ E-Mail</button>`:`<button class="btn small disabledAction" disabled>✉️ E-Mail fehlt</button>`}${c.address?`<button class="btn small" onclick="openMaps('${encodeURIComponent(c.address)}')">📍 Route</button>`:`<button class="btn small disabledAction" disabled>📍 Adresse fehlt</button>`}</div></div>`}).join(''):'<div class="empty">Noch keine Kunden.</div>'
}
document.getElementById('customerSearch').oninput=renderCustomers;
function openCustomerFolder(id){currentCustomerId=id;currentCustomerFolderTab='overview';showScreen('customerDetail');document.querySelectorAll('.folderTab').forEach((b,i)=>b.classList.toggle('active',i===0));renderCustomerFolder()}
function editCurrentCustomer(){if(currentCustomerId)editCustomer(currentCustomerId)}
function setCustomerFolderTab(tab,btn){currentCustomerFolderTab=tab;document.querySelectorAll('.folderTab').forEach(b=>b.classList.toggle('active',b===btn));renderCustomerFolder()}
async function renderCustomerFolder(){
  const c=data.customers.find(x=>x.id===currentCustomerId),box=document.getElementById('customerFolderContent');if(!c||!box)return;
  clearCustomerPreviewUrls();
  document.getElementById('customerDetailName').textContent=c.name;
  document.getElementById('customerDetailMeta').textContent=[c.contact,c.address].filter(Boolean).join(' · ');
  const jobs=data.jobs.filter(j=>j.customerId===c.id),offers=data.offers.filter(o=>o.customerId===c.id),invoices=data.invoices.filter(i=>i.customerId===c.id);
  const jobPhotos=jobs.flatMap(j=>(j.photos||[]).map(p=>({...p,jobTitle:j.title,jobId:j.id})));
  let storedFiles=[];try{storedFiles=await listCustomerFiles(c.id)}catch(e){}
  const storedPhotos=storedFiles.filter(f=>f.kind==='photo'),storedDocs=storedFiles.filter(f=>f.kind==='document');

  if(currentCustomerFolderTab==='sites'){
    box.innerHTML=`<div class="folderSectionHead"><div><h3>🏗️ Baustellen</h3><p>${jobs.length} Projekt${jobs.length===1?'':'e'} für diesen Kunden</p></div><button class="btn primary small owner-office-only" onclick="newJobForCustomer('${c.id}')">＋ Baustelle</button></div>${jobs.length?jobs.map(j=>`<button class="folderRow" onclick="editJob('${j.id}')"><span class="folderRowIcon">🏗️</span><span><b>${escapeHTML(j.title)}</b><small>${statusLabel(j.status)} · ${dateDE(j.start)} · ${(j.photos||[]).length} Fotos</small></span><strong>›</strong></button>`).join(''):'<div class="empty">Noch keine Baustelle angelegt.</div>'}`;
  }else if(currentCustomerFolderTab==='photos'){
    const storedPhotoHTML=storedPhotos.map(f=>{let url=f.url||'';if(!url&&f.blob){url=URL.createObjectURL(f.blob);window.customerPreviewUrls.push(url)}return `<button class="customerPhoto" onclick="openCustomerStoredFile('${f.id}')"><img src="${url}" alt=""><span>${f.cloud?'☁️ Galerie':'Galerie'}</span></button>`}).join('');
    const jobPhotoHTML=jobPhotos.map(p=>`<button class="customerPhoto" onclick="editJob('${p.jobId}')"><img src="${p.data}" alt=""><span>${escapeHTML(p.jobTitle)}</span></button>`).join('');
    box.innerHTML=`<div class="folderSectionHead"><div><h3>📸 Fotos</h3><p>Galeriebilder und Baustellenfotos dieses Kunden.</p></div><label class="btn primary small customerInlineUpload">＋ Galerie<input type="file" accept="image/*" multiple hidden onchange="addCustomerGalleryPhotos(event)"></label></div>${(storedPhotos.length||jobPhotos.length)?`<div class="customerPhotoGrid">${storedPhotoHTML}${jobPhotoHTML}</div>`:'<div class="empty">Noch keine Fotos. Du kannst direkt Bilder aus deiner Fotomediathek hinzufügen.</div>'}`;
  }else if(currentCustomerFolderTab==='docs'){
    const uploaded=storedDocs.length?storedDocs.map(f=>`<button class="folderRow" onclick="openCustomerStoredFile('${f.id}')"><span class="folderRowIcon">${fileIconFor(f.type,f.name)}</span><span><b>${escapeHTML(f.name)}</b><small>${formatFileSize(f.size)} · ${new Date(f.createdAt).toLocaleDateString('de-DE')}</small></span><strong>›</strong></button>`).join(''):'<p class="mini">Noch keine eigenen Dateien hochgeladen.</p>';
    box.innerHTML=`<div class="folderSectionHead"><div><h3>📄 Dokumente</h3><p>Angebote, Rechnungen und eigene Dateien.</p></div><label class="btn primary small customerInlineUpload">＋ Datei<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.jpg,.jpeg,.png,.heic,.webp,application/pdf,image/*" multiple hidden onchange="addCustomerDocuments(event)"></label></div><div class="docGroup"><b>Eigene Dokumente</b>${uploaded}</div><div class="docGroup"><b>Angebote</b>${offers.length?offers.map(o=>`<button class="folderRow" onclick="editOffer('${o.id}')"><span class="folderRowIcon">📄</span><span><b>${escapeHTML(o.subject||'Angebot')}</b><small>${dateDE(o.date)} · ${euro(o.total)} · ${statusLabel(o.status)}</small></span><strong>›</strong></button>`).join(''):'<p class="mini">Keine Angebote</p>'}</div><div class="docGroup"><b>Rechnungen</b>${invoices.length?invoices.map(i=>`<button class="folderRow" onclick="editInvoice('${i.id}')"><span class="folderRowIcon">🧾</span><span><b>${escapeHTML(i.subject||i.number)}</b><small>${i.number} · ${euro(i.total)}</small></span><strong>›</strong></button>`).join(''):'<p class="mini">Keine Rechnungen</p>'}</div>`;
  }else{
    box.innerHTML=`<div class="folderStats"><button type="button" onclick="setCustomerFolderTab('sites',document.querySelector('[data-foldertab=sites]'))"><strong>${jobs.length}</strong><span>Baustellen</span><small>Öffnen ›</small></button><button type="button" onclick="setCustomerFolderTab('photos',document.querySelector('[data-foldertab=photos]'))"><strong>${jobPhotos.length+storedPhotos.length}</strong><span>Fotos</span><small>Öffnen ›</small></button><button type="button" class="owner-office-only" onclick="setCustomerFolderTab('docs',document.querySelector('[data-foldertab=docs]'))"><strong>${offers.length+invoices.length+storedDocs.length}</strong><span>Dokumente</span><small>Öffnen ›</small></button></div><div class="card folderContact"><h3>Kontaktdaten</h3>${c.phone?`<button class="contactLine" onclick="location.href='tel:${encodeURIComponent(c.phone)}'">📞 <span>${escapeHTML(c.phone)}</span></button>`:''}${c.email?`<button class="contactLine" onclick="location.href='mailto:${encodeURIComponent(c.email)}'">✉️ <span>${escapeHTML(c.email)}</span></button>`:''}${c.address?`<button class="contactLine" onclick="openMaps('${encodeURIComponent(c.address)}')">📍 <span>${escapeHTML(c.address)}</span></button>`:''}${c.notes?`<div class="folderNote"><b>Notizen</b><p>${escapeHTML(c.notes)}</p></div>`:''}</div><div class="folderQuick"><button onclick="setCustomerFolderTab('sites',document.querySelector('[data-foldertab=sites]'))">🏗️<b>Baustellen</b><small>Aufträge & Doku</small></button><button onclick="setCustomerFolderTab('photos',document.querySelector('[data-foldertab=photos]'))">📸<b>Fotos</b><small>Galerie & Baustellenbilder</small></button><button class="owner-office-only" onclick="setCustomerFolderTab('docs',document.querySelector('[data-foldertab=docs]'))">📄<b>Dokumente</b><small>Angebote, Rechnungen & Dateien</small></button></div>`;
  }
  applyRoleUI();
}
function newJobForCustomer(customerId){newJob();document.getElementById('jobCustomer').value=customerId;updateSoftCustomerButton('jobCustomer');const c=getCustomerById(customerId);if(c){document.getElementById('jobAddress').value=c.address||'';document.getElementById('jobAddress').dataset.autoFilled='1'}refreshJobOfferOptions();const offers=(data.offers||[]).filter(o=>o.customerId===customerId&&o.status==='accepted');if(offers.length===1){document.getElementById('jobOffer').value=offers[0].id;syncJobOfferFields()}}
async function ensureExternalConsent(service){
  if(data.privacy?.consents?.external)return true;
  const ok=await appConfirm({
    title:`${service} öffnen?`,
    text:`Für ${service} werden nur die dafür benötigten ausgewählten Angaben an den externen Dienst übergeben.`,
    confirmLabel:'Einmalig erlauben',
    icon:'↗️'
  });
  if(ok){
    data.privacy.consents.external=true;
    data.privacy.acceptedAt=new Date().toISOString();
    saveData('Einwilligung geändert',service+' erlaubt');
  }
  return ok;
}
async function openMaps(a){
  if(!await ensureExternalConsent('Google Maps'))return;
  location.href='https://www.google.com/maps/search/?api=1&query='+a;
}
function newOffer(){
  document.getElementById('offerId').value='';
  document.getElementById('offerCustomer').innerHTML=customerOptions();updateSoftCustomerButton('offerCustomer');
  document.getElementById('offerDate').value=todayISO();
  document.getElementById('offerStatus').value='draft';
  document.getElementById('offerSubject').value='';
  document.getElementById('offerNotes').value='';
  document.getElementById('offerDiscount').value=0;setDiscountType('offer','euro');
  draftLines=[];
  renderOfferLines();
  showScreen('offerEditor');
}
function editOffer(id){const o=data.offers.find(x=>x.id===id);if(!o)return;document.getElementById('offerId').value=o.id;document.getElementById('offerCustomer').innerHTML=customerOptions(o.customerId);updateSoftCustomerButton('offerCustomer');document.getElementById('offerDate').value=o.date;document.getElementById('offerStatus').value=o.status;document.getElementById('offerSubject').value=o.subject;document.getElementById('offerNotes').value=o.notes||'';document.getElementById('offerDiscount').value=Number(o.discountValue ?? o.discount ?? 0)||0;setDiscountType('offer',normalizeDiscountType(o.discountType));draftLines=structuredClone(o.lines||[]);renderOfferLines();showScreen('offerEditor')}
function addOfferLine(line={name:'',qty:1,unit:'Std.',price:0}){draftLines.push({id:uid(),...line});renderOfferLines()}

function isLaborLine(line){
  const name=String(line?.name||'').toLowerCase();
  const unit=String(line?.unit||'').toLowerCase();
  return /fachkraft|helfer|arbeitszeit|monteur|elektriker|malerarbeiten/.test(name) && /std|stunde/.test(unit);
}
function ensureLaborMeta(line){
  if(!isLaborLine(line))return line;
  if(!Number(line.workers)||Number(line.workers)<1)line.workers=1;
  if(!Number(line.hoursPerWorker)||Number(line.hoursPerWorker)<=0)line.hoursPerWorker=Math.max(.25,(Number(line.qty)||1)/Number(line.workers));
  line.qty=Number((Number(line.workers)*Number(line.hoursPerWorker)).toFixed(2));
  return line;
}
function updateLaborLine(index,field,value){
  const line=draftLines[index];if(!line)return;
  line[field]=Math.max(field==='workers'?1:.25,Number(String(value).replace(',','.'))||(field==='workers'?1:.25));
  ensureLaborMeta(line);
  renderOfferLines();
}

function renderOfferLines(){
  const el=document.getElementById('offerLines');
  if(!el)return;
  if(!Array.isArray(draftLines))draftLines=[];
  draftLines.forEach(ensureLaborMeta);
  el.innerHTML=draftLines.length?draftLines.map((l,i)=>{
    const labor=isLaborLine(l);
    return `<div class="offerLineSimple ${labor?'laborLine':''}">
      <div class="lineMain">
        <input class="input" value="${escapeHTML(l.name||'')}" placeholder="Position" oninput="draftLines[${i}].name=this.value" onchange="ensureLaborMeta(draftLines[${i}]);renderOfferLines()">
        ${labor?`<div class="laborPlanner">
          <div><label>Mitarbeiter</label><div class="stepperField"><button type="button" onclick="updateLaborLine(${i},'workers',Math.max(1,Number(draftLines[${i}].workers||1)-1))">−</button><input type="number" min="1" step="1" inputmode="numeric" value="${Number(l.workers)||1}" onchange="updateLaborLine(${i},'workers',this.value)"><button type="button" onclick="updateLaborLine(${i},'workers',Number(draftLines[${i}].workers||1)+1)">＋</button></div></div>
          <div><label>Std. je Mitarbeiter</label><input type="number" class="input laborHoursInput" min=".25" step=".25" inputmode="decimal" value="${Number(l.hoursPerWorker)||1}" onchange="updateLaborLine(${i},'hoursPerWorker',this.value)"></div>
          <div class="laborTotal"><span>Gesamt</span><strong>${Number(l.qty).toLocaleString('de-DE',{maximumFractionDigits:2})} Std.</strong><small>${Number(l.workers)||1} × ${Number(l.hoursPerWorker)||1} Std.</small></div>
        </div>`:`<div class="row3" style="margin-top:8px">
          <input type="number" class="input" value="${Number(l.qty)||1}" step="0.01" oninput="draftLines[${i}].qty=Number(this.value)||0" aria-label="Menge">
          <input class="input" value="${escapeHTML(l.unit||'Stk.')}" oninput="draftLines[${i}].unit=this.value" aria-label="Einheit">
          <input type="number" class="input" value="${Number(l.price)||0}" step="0.01" oninput="draftLines[${i}].price=Number(this.value)||0" aria-label="Preis">
        </div>`}
        ${labor?`<div class="laborPriceRow"><div><span>Stundensatz</span><b>${euro(Number(l.price)||0)} / Std.</b></div><input type="number" class="input" value="${Number(l.price)||0}" step="0.01" inputmode="decimal" oninput="draftLines[${i}].price=Number(this.value)||0" aria-label="Stundensatz"></div>`:'<div class="mini" style="margin-top:6px">Menge · Einheit · Einzelpreis</div>'}
      </div>
      <button class="btn small danger" onclick="draftLines.splice(${i},1);renderOfferLines()" aria-label="Position löschen">✕</button>
    </div>`;
  }).join(''):'<div class="empty">Noch keine Positionen. Tippe auf „＋ Position“.</div>';
}
function offerObject(){const id=document.getElementById('offerId').value,cid=document.getElementById('offerCustomer').value,baseSubtotal=draftLines.reduce((s,l)=>s+(Number(l.qty)||0)*(Number(l.price)||0),0),discountType=normalizeDiscountType(document.getElementById('offerDiscountType')?.value),discountValue=Number(document.getElementById('offerDiscount').value)||0,discount=discountAmount(baseSubtotal,discountValue,discountType),sub=baseSubtotal-discount,tax=Number(data.settings.tax)||0,total=sub*(1+tax/100),old=id?data.offers.find(x=>x.id===id):null;return{id:id||uid(),number:id?old?.number:'AP-'+new Date().getFullYear()+'-'+String(data.offers.length+1).padStart(4,'0'),customerId:cid,date:document.getElementById('offerDate').value,status:document.getElementById('offerStatus').value,subject:document.getElementById('offerSubject').value.trim(),notes:document.getElementById('offerNotes').value.trim(),lines:structuredClone(draftLines),travel:0,discountType,discountValue,discount,baseSubtotal,subtotal:sub,tax,total,eventId:old?.eventId||''}}
function persistOfferFromEditor({validate=true,audit=true}={}){
  const o=offerObject();
  if(validate){
    if(!o.customerId){toast('Kunde auswählen');return null}
    if(!o.subject){toast('Betreff fehlt');return null}
    if(!o.lines.some(l=>l.name)){toast('Position fehlt');return null}
  }
  const i=data.offers.findIndex(x=>x.id===o.id);
  const previous=i>=0?data.offers[i]:null;
  if(i>=0)data.offers[i]=o;else data.offers.push(o);
  if(o.status==='accepted'&&previous?.status!=='accepted'){
    const c=data.customers.find(x=>x.id===o.customerId);
    globalThis.Notifications?.notifyOwnerOffice?.('Angebot angenommen',`${c?.name||'Kunde'} · ${o.subject||o.number||'Angebot'}`,{type:'offer_accepted',tag:`offer-accepted-${o.id}`,dedupeHours:1,url:'./?screen=offers'}).catch(()=>{});
  }
  upsertCalendarEventForOffer(o);
  persistAppState();
  if(audit)addAudit('Angebot gespeichert',`${o.number||''} · ${o.subject||''}`);
  document.getElementById('offerId').value=o.id;
  return o;
}
function saveOffer(){
  const o=persistOfferFromEditor({validate:true,audit:true});
  if(!o)return;
  renderAll();
  showScreen('offers');
  toast('✓ Angebot gespeichert · Kalender aktualisiert');
}
function autoSaveOfferAndClose(){
  const id=document.getElementById('offerId').value;
  const hasMeaningful=!!(id||document.getElementById('offerCustomer').value||document.getElementById('offerSubject').value.trim()||draftLines.some(l=>l.name));
  if(!hasMeaningful){showScreen('offers');return}
  const existing=id?data.offers.find(x=>x.id===id):null;
  const canSave=existing||(
    document.getElementById('offerCustomer').value &&
    document.getElementById('offerSubject').value.trim() &&
    draftLines.some(l=>l.name)
  );
  if(canSave){
    const o=persistOfferFromEditor({validate:false,audit:true});
    renderAll();
    showScreen('offers');
    toast('✓ Änderungen automatisch gespeichert');
  }else{
    showScreen('offers');
    toast('Unvollständiger neuer Entwurf wurde nicht gespeichert');
  }
}
function renderOffers(){const list=data.offers.filter(o=>currentOfferFilter==='all'||o.status===currentOfferFilter).sort((a,b)=>b.date.localeCompare(a.date));document.getElementById('offerList').innerHTML=list.length?list.map(o=>{const c=data.customers.find(x=>x.id===o.customerId);return `<div class="item"><div class="itemTop"><div><span class="badge ${o.status}">${statusLabel(o.status)}</span><h3 style="margin-top:8px">${escapeHTML(o.subject)}</h3><p>${escapeHTML(c?.name||'Unbekannter Kunde')} · ${dateDE(o.date)} · ${o.number}</p></div><strong>${euro(o.total)}</strong></div><div class="itemActions"><button class="btn small" onclick="editOffer('${o.id}')">Bearbeiten</button><button class="btn small" onclick="quickOfferStatus('${o.id}')">Status</button><button class="btn small" onclick="previewSavedOffer('${o.id}')">PDF</button></div></div>`}).join(''):'<div class="empty">Noch keine Angebote.</div>'}
document.querySelectorAll('#offerTabs .tab').forEach(b=>b.onclick=()=>{currentOfferFilter=b.dataset.filter;document.querySelectorAll('#offerTabs .tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderOffers()});
function quickOfferStatus(id){
  const o=data.offers.find(x=>x.id===id);if(!o)return;
  document.getElementById('statusOfferId').value=id;
  document.getElementById('offerStatusModal').classList.remove('hidden');
}

function paperHTML(o){
  const c=data.customers.find(x=>x.id===o.customerId)||{},s=data.settings;
  const company=s.companyName||'Ihr Betrieb',owner=s.ownerName||'',mark=company.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const lineRows=o.lines.filter(l=>l.name).map((l,i)=>`<tr><td class="posCol">${String(i+1).padStart(2,'0')}</td><td><b>${escapeHTML(l.name)}</b></td><td class="num">${Number(l.qty).toLocaleString('de-DE',{maximumFractionDigits:2})} ${escapeHTML(l.unit)}</td><td class="num">${euro(l.price)}</td><td class="num strong">${euro(l.qty*l.price)}</td></tr>`).join('');
  const taxNote=o.tax?`zzgl. ${o.tax}% Umsatzsteuer`:'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.';
  return `<div class="offerPaper professionalPaper">
    <div class="proHeader">
      <div class="companyIdentity"><div class="companyMonogram">${escapeHTML(mark||'AP')}</div><div><h2>${escapeHTML(company)}</h2><p>${escapeHTML(s.address||'')}</p></div></div>
      <div class="offerTitleBlock"><span>ANGEBOT</span><strong>${escapeHTML(o.number||'')}</strong></div>
    </div>
    <div class="proContactLine">${s.phone?`<span>Tel. ${escapeHTML(s.phone)}</span>`:''}${s.email?`<span>${escapeHTML(s.email)}</span>`:''}${owner?`<span>Ansprechpartner: ${escapeHTML(owner)}</span>`:''}</div>
    <div class="proMetaGrid">
      <div class="recipientBlock"><span class="paperLabel">ANGEBOT FÜR</span><b>${escapeHTML(c.name||'')}</b>${c.contact?`<span>${escapeHTML(c.contact)}</span>`:''}<span>${escapeHTML(c.address||'')}</span>${c.email?`<span>${escapeHTML(c.email)}</span>`:''}</div>
      <div class="offerFacts"><div><span>Angebotsnummer</span><b>${escapeHTML(o.number||'—')}</b></div><div><span>Angebotsdatum</span><b>${dateDE(o.date)}</b></div></div>
    </div>
    <div class="proSubject"><span class="paperLabel">BETREFF</span><h1>${escapeHTML(o.subject||'Angebot')}</h1><p>Vielen Dank für Ihre Anfrage. Gerne bieten wir Ihnen die folgenden Leistungen und Materialien an.</p>${o.notes?`<div class="proNote">${escapeHTML(o.notes)}</div>`:''}</div>
    <table class="paperTable proTable"><thead><tr><th>Pos.</th><th>Beschreibung</th><th class="num">Menge</th><th class="num">Einzelpreis</th><th class="num">Gesamt</th></tr></thead><tbody>${lineRows}</tbody></table>
    <div class="proSummary">
      <div class="termsBox"><span class="paperLabel">HINWEISE</span><p>${escapeHTML(s.paymentTerm||'Zahlungsziel: 7 Tage')}</p><p>${taxNote}</p></div>
      <div class="totals proTotals"><div><span>Summe Positionen</span><b>${euro(o.baseSubtotal??(o.subtotal+(o.discount||0)))}</b></div>${o.discount?`<div class="discountTotal"><span>${discountDisplayLabel(o)}</span><b>− ${euro(Math.abs(o.discount))}</b></div>`:''}<div><span>Zwischensumme</span><b>${euro(o.subtotal)}</b></div>${o.tax?`<div><span>Umsatzsteuer ${o.tax}%</span><b>${euro(o.subtotal*o.tax/100)}</b></div>`:''}<div class="grand"><span>Gesamtbetrag</span><strong>${euro(o.total)}</strong></div></div>
    </div>
    <div class="acceptanceText"><b>Wir freuen uns auf die Zusammenarbeit.</b><p>Bei Fragen zu diesem Angebot stehen wir Ihnen gerne zur Verfügung.</p></div>
    <div class="paperFoot proFooter"><span>${escapeHTML(company)}</span><span>${escapeHTML(s.address||'')}</span>${s.phone?`<span>${escapeHTML(s.phone)}</span>`:''}${s.email?`<span>${escapeHTML(s.email)}</span>`:''}</div>
  </div>`;
}
function previewOffer(){const o=offerObject();document.getElementById('offerPreviewPaper').innerHTML=paperHTML(o);showScreen('offerPreview')}
function previewSavedOffer(id){const o=data.offers.find(x=>x.id===id);document.getElementById('offerId').value=id;document.getElementById('offerPreviewPaper').innerHTML=paperHTML(o);showScreen('offerPreview')}
function printOffer(){document.getElementById('printArea').innerHTML=document.getElementById('offerPreviewPaper').innerHTML;window.print()}
async function shareOfferWhatsApp(){if(!await ensureExternalConsent('WhatsApp'))return;const id=document.getElementById('offerId').value,o=id?data.offers.find(x=>x.id===id):offerObject(),c=data.customers.find(x=>x.id===o.customerId);const t=`Hallo ${c?.name||''}, Ihr Angebot „${o.subject}“ über ${euro(o.total)} ist fertig. Freundliche Grüße, ${data.settings.companyName}`;location.href='https://wa.me/?text='+encodeURIComponent(t)}

function setEventType(type){
  const input=document.getElementById('eventType');if(input)input.value=type;
  document.querySelectorAll('[data-eventtype]').forEach(b=>b.classList.toggle('active',b.dataset.eventtype===type));
  if(navigator.vibrate)navigator.vibrate(8);
}

function newEventForDate(date){if((data.privacy?.role||'owner')==='worker')return toast('Termine werden vom Büro über deine Baustellen geplant');newEvent();document.getElementById('eventDate').value=date;document.getElementById('eventEditorTitle').textContent=`Termin am ${dateDE(date)}`}
function newEvent(){
  if((data.privacy?.role||'owner')==='worker')return toast('Termine werden vom Büro geplant');
  document.getElementById('eventEditorTitle').textContent='Neuer Termin';
  document.getElementById('eventId').value='';
  document.getElementById('eventTitle').value='';
  document.getElementById('eventCustomer').innerHTML=customerOptions();updateSoftCustomerButton('eventCustomer');
  document.getElementById('eventDate').value=todayISO();
  document.getElementById('eventTime').value='08:00';
  document.getElementById('eventDurationHours').value=1;
  setEventType('Baustelle');
  document.getElementById('eventAddress').value='';
  document.getElementById('eventAddress').dataset.autoFilled='1';
  document.getElementById('eventNotes').value='';
  showScreen('eventEditor');
}
function editEvent(id){
  const e=data.events.find(x=>x.id===id);if(!e)return;
  document.getElementById('eventId').value=e.id;
  document.getElementById('eventTitle').value=e.title;
  document.getElementById('eventCustomer').innerHTML=customerOptions(e.customerId);updateSoftCustomerButton('eventCustomer');
  document.getElementById('eventDate').value=e.date;
  document.getElementById('eventTime').value=e.time;
  document.getElementById('eventDurationHours').value=Math.max(.25,(Number(e.duration)||60)/60);
  setEventType(e.type||'Baustelle');
  document.getElementById('eventAddress').value=e.address||'';
  document.getElementById('eventAddress').dataset.autoFilled='0';
  document.getElementById('eventNotes').value=e.notes||'';
  showScreen('eventEditor');
}
function saveEvent(){
  const id=document.getElementById('eventId').value,cid=document.getElementById('eventCustomer').value,old=id?data.events.find(x=>x.id===id):null;
  const hours=Math.max(.25,Number(String(document.getElementById('eventDurationHours').value).replace(',','.'))||1);
  const obj={id:id||uid(),title:document.getElementById('eventTitle').value.trim(),customerId:cid,date:document.getElementById('eventDate').value,time:document.getElementById('eventTime').value,duration:Math.round(hours*60),type:document.getElementById('eventType').value,address:document.getElementById('eventAddress').value.trim(),notes:document.getElementById('eventNotes').value.trim(),jobId:old?.jobId||'',offerId:old?.offerId||''};
  if(!obj.title)return toast('Titel fehlt');
  if(id)data.events[data.events.findIndex(x=>x.id===id)]=obj;else data.events.push(obj);
  syncLinkedJobFromEvent(obj);saveData('Termin gespeichert',obj.title);showScreen('calendar');toast(obj.jobId?'Termin gespeichert · Baustelle aktualisiert':'Termin gespeichert');
}
function renderCalendar(){
  const role=data.privacy?.role||'owner',worker=role==='worker';
  document.getElementById('monthTitle').textContent=calDate.toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  const y=calDate.getFullYear(),m=calDate.getMonth(),first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate(),heads=['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>`<div class="calHead">${x}</div>`).join('');
  let cells='';for(let i=0;i<first;i++)cells+='<div class="day muted"></div>';
  for(let d=1;d<=days;d++){
    const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,count=data.events.filter(e=>eventOccursOnDate(e,iso)).length;
    cells+=worker
      ?`<div class="day ${iso===todayISO()?'today':''} ${count?'hasEvent':''}"><span>${d}</span>${count?`<small>${count}</small>`:''}</div>`
      :`<button type="button" class="day ${iso===todayISO()?'today':''} ${count?'hasEvent':''}" onclick="newEventForDate('${iso}')"><span>${d}</span>${count?`<small>${count}</small>`:''}</button>`;
  }
  document.getElementById('calendarGrid').innerHTML=heads+cells;
  const list=[...data.events].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  document.getElementById('eventList').innerHTML=list.length?list.map(e=>{
    const c=data.customers.find(x=>x.id===e.customerId),job=e.jobId?data.jobs.find(j=>j.id===e.jobId):null;
    const action=worker?(job?`<button class="btn small primary" onclick="editJob('${job.id}')">Baustelle öffnen</button>`:''):`<button class="btn small" onclick="editEvent('${e.id}')">✎</button>`;
    return `<div class="item"><div class="itemTop"><div><span class="badge sent">${escapeHTML(e.type)}</span><h3 style="margin-top:8px">${escapeHTML(e.title)}</h3><p>${dateDE(e.date)} · ${e.time} Uhr · ${escapeHTML(c?.name||'')}</p></div>${action}</div><div class="itemActions">${e.address?`<button class="btn small" onclick="openMaps('${encodeURIComponent(e.address)}')">📍 Route</button>`:''}${!worker?`<button class="btn small" onclick="googleCalendar('${e.id}')">Google Kalender</button><button class="btn small" onclick="downloadICS('${e.id}')">Apple / Outlook</button>`:''}</div></div>`;
  }).join(''):'<div class="empty">Noch keine Termine.</div>';
}
function changeMonth(n){calDate=new Date(calDate.getFullYear(),calDate.getMonth()+n,1);renderCalendar()}
function eventDates(e){const job=e?.jobId?(data.jobs||[]).find(j=>j.id===e.jobId):null;let start=new Date(`${e.date}T${e.time||'08:00'}:00`),end;if(job&&job.durationUnit==='days'){const dates=jobWorkDates(job),last=dates[dates.length-1]||job.start;start=new Date(`${job.start}T${job.startTime||'08:00'}:00`);end=new Date(`${last}T${job.startTime||'08:00'}:00`);end=new Date(end.getTime()+8*60*60000)}else if(job&&job.durationUnit==='hours'){start=new Date(`${job.start}T${job.startTime||'08:00'}:00`);end=new Date(start.getTime()+jobDurationMinutes(job)*60000)}else end=new Date(start.getTime()+(Number(e.duration)||60)*60000);const fmt=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');return{start:fmt(start),end:fmt(end)}}
async function googleCalendar(id){if(!await ensureExternalConsent('Google Kalender'))return;const e=data.events.find(x=>x.id===id),d=eventDates(e);location.href=`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${d.start}/${d.end}&details=${encodeURIComponent(e.notes||'')}&location=${encodeURIComponent(e.address||'')}`}
function downloadICS(id){const e=data.events.find(x=>x.id===id),d=eventDates(e),ics=`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//AngebotsPilot//Digitaler Handwerker//DE\nBEGIN:VEVENT\nUID:${e.id}@angebotspilot\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}\nDTSTART:${d.start}\nDTEND:${d.end}\nSUMMARY:${e.title}\nLOCATION:${e.address||''}\nDESCRIPTION:${e.notes||''}\nEND:VEVENT\nEND:VCALENDAR`;downloadBlob(ics,`${e.title}.ics`,'text/calendar')}
function acceptedOfferOptions(selected='',customerId=''){const offers=data.offers.filter(o=>o.status==='accepted'&&(!customerId||o.customerId===customerId));return ['<option value="">– Kein Angebot verknüpft –</option>',...offers.map(o=>`<option value="${o.id}" ${o.id===selected?'selected':''}>${escapeHTML(o.number)} · ${escapeHTML(o.subject)} · ${euro(o.total)}</option>`)].join('')}
function refreshJobOfferOptions(){const el=document.getElementById('jobOffer');if(el)el.innerHTML=acceptedOfferOptions(el.value,document.getElementById('jobCustomer').value)}
let jobDraftPhotos=[];
function renderJobPhotos(){
  const grid=document.getElementById('jobPhotoGrid'),count=document.getElementById('jobPhotoCount');if(!grid)return;
  if(count)count.textContent=`${jobDraftPhotos.length} Foto${jobDraftPhotos.length===1?'':'s'}`;
  grid.innerHTML=jobDraftPhotos.length?jobDraftPhotos.map((p,i)=>{const canDelete=globalThis.CloudFiles?.canDelete?.(p)!==false;return `<div class="photoTile"><img src="${p.data||p.url||''}" alt="Baustellenfoto">${p.cloud?'<span class="cloudPhotoBadge">☁️</span>':''}${canDelete?`<button type="button" onclick="removeJobPhoto(${i})">×</button>`:''}<small>${dateDE((p.at||p.createdAt||'').slice(0,10))}</small></div>`}).join(''):'<div class="photoEmpty">Noch keine Fotos</div>';
}
async function removeJobPhoto(i){const p=jobDraftPhotos[i],jobId=document.getElementById('jobId')?.value||'';if(p?.cloud&&jobId){try{await globalThis.CloudFiles?.deleteJobPhoto?.(p,jobId);jobDraftPhotos.splice(i,1);renderJobPhotos();toast('Foto aus der Cloud gelöscht');return}catch(e){console.error(e);toast('Foto konnte nicht gelöscht werden');return}}jobDraftPhotos.splice(i,1);renderJobPhotos()}
function refreshOpenJobPhotosFromCloud(jobId){if(document.getElementById('jobId')?.value!==jobId)return;const j=(data.jobs||[]).find(x=>x.id===jobId);if(!j)return;jobDraftPhotos=structuredClone(j.photos||[]);renderJobPhotos()}
globalThis.refreshOpenJobPhotosFromCloud=refreshOpenJobPhotosFromCloud;
function compressPhoto(file){
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{const max=1100,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.72))};img.src=reader.result};reader.readAsDataURL(file)});
}
async function addJobPhotos(event){
  const files=[...(event.target.files||[])];if(!files.length)return;
  toast('Fotos werden vorbereitet …');
  for(const file of files.slice(0,8)){
    try{const dataUrl=await compressPhoto(file);jobDraftPhotos.push({id:uid(),data:dataUrl,name:file.name||'Baustellenfoto.jpg',at:new Date().toISOString(),cloud:false})}catch(e){}
  }
  event.target.value='';renderJobPhotos();toast('📸 Foto zur Baustelle hinzugefügt');
}



function upsertCalendarEventForOffer(offer){
  if(!offer||!offer.id)return;
  const customer=getCustomerById(offer.customerId);
  let ev=(data.events||[]).find(e=>e.offerId===offer.id);
  if(ev){
    ev.title=`Angebot: ${offer.subject||'Angebot'}`;
    ev.customerId=offer.customerId||'';
    ev.type='Angebot';
    ev.address=customer?.address||ev.address||'';
    ev.notes=`Angebot ${offer.number||''}${offer.status?` · ${statusLabel(offer.status)}`:''}`;
    // Datum/Uhrzeit absichtlich nicht überschreiben:
    // Der Nutzer darf den automatisch erzeugten Kalendereintrag später auf den echten Ausführungstag verschieben.
  }else{
    ev={
      id:uid(),
      title:`Angebot: ${offer.subject||'Angebot'}`,
      customerId:offer.customerId||'',
      date:offer.date||todayISO(),
      time:'08:00',
      duration:60,
      type:'Angebot',
      address:customer?.address||'',
      notes:`Angebot ${offer.number||''}${offer.status?` · ${statusLabel(offer.status)}`:''}`,
      offerId:offer.id,
      jobId:''
    };
    data.events.push(ev);
  }
  offer.eventId=ev.id;
}

function normalizeJobDurationUnit(v){return v==='hours'?'hours':'days'}
function jobWorkDates(job){const start=job?.start;if(!start)return[];const unit=normalizeJobDurationUnit(job.durationUnit);if(unit==='hours')return[start];let remaining=Math.max(1,Math.round(Number(job.durationValue)||1)),d=new Date(start+'T12:00:00'),out=[],guard=0;while(remaining>0&&guard<500){guard++;const day=d.getDay();if(day!==0&&day!==6){out.push(d.toISOString().slice(0,10));remaining--}d.setDate(d.getDate()+1)}return out}
function jobDurationMinutes(job){return normalizeJobDurationUnit(job?.durationUnit)==='hours'?Math.max(15,Math.round((Number(job?.durationValue)||1)*60)):Math.max(1,Math.round(Number(job?.durationValue)||1))*8*60}
function eventOccursOnDate(e,iso){if(!e)return false;if(e.jobId){const j=(data.jobs||[]).find(x=>x.id===e.jobId);if(j)return jobWorkDates(j).includes(iso)}return e.date===iso}
function syncJobDurationUI(){const unit=normalizeJobDurationUnit(document.getElementById('jobDurationUnit')?.value),input=document.getElementById('jobDurationValue'),hint=document.getElementById('jobDurationHint');if(input){input.step=unit==='hours'?'0.25':'1';input.min=unit==='hours'?'0.25':'1';if(unit==='days'&&Number(input.value)%1)input.value=Math.max(1,Math.round(Number(input.value)||1))}if(hint){const value=Math.max(unit==='hours'?.25:1,Number(input?.value)||1);const dates=unit==='days'?`${Math.round(value)} Arbeitstag${Math.round(value)===1?'':'e'}`:`${value.toLocaleString('de-DE',{maximumFractionDigits:2})} Std.`;hint.querySelector('small').textContent=`${dates} ab ${document.getElementById('jobStartTime')?.value||'08:00'} Uhr werden im Kalender reserviert.`}}
function upsertCalendarEventForJob(job){
  if(!job||!job.start)return;
  let ev=(data.events||[]).find(e=>e.jobId===job.id);
  const durationText=normalizeJobDurationUnit(job.durationUnit)==='hours'?`${Number(job.durationValue)||1} Std.`:`${Math.max(1,Math.round(Number(job.durationValue)||1))} Arbeitstag${Math.round(Number(job.durationValue)||1)===1?'':'e'}`;
  const payload={title:job.title||'Baustelle',customerId:job.customerId||'',date:job.start,time:job.startTime||'08:00',duration:jobDurationMinutes(job),type:'Baustelle',address:job.address||'',notes:`Geplante Dauer: ${durationText}${job.docNote||job.notes?` · ${job.docNote||job.notes}`:''}`,jobId:job.id};
  if(ev)Object.assign(ev,payload);else{ev={id:uid(),...payload};data.events.push(ev)}
  job.eventId=ev.id;
}
function syncLinkedJobFromEvent(ev){
  if(!ev?.jobId)return;const job=data.jobs.find(j=>j.id===ev.jobId);if(!job)return;
  job.start=ev.date||job.start;job.startTime=ev.time||job.startTime||'08:00';job.address=ev.address||job.address;if(ev.customerId)job.customerId=ev.customerId;
}

function setJobEditorRoleMode(){
  const worker=(data.privacy?.role||'owner')==='worker';
  document.querySelectorAll('#jobEditor .jobProtectedField').forEach(el=>{
    el.disabled=worker;
    el.classList.toggle('readonlyField',worker);
  });
  const save=document.getElementById('jobSaveBtn');
  if(save)save.textContent=worker?'Fortschritt speichern':'Baustelle speichern';
  const sub=document.getElementById('jobEditorSubtitle');
  if(sub)sub.textContent=worker?'Status & Dokumentation':'Auftrag & Dokumentation';
}

function newJob(){
  document.getElementById('jobId').value='';
  document.getElementById('jobTitle').value='';
  document.getElementById('jobCustomer').innerHTML=customerOptions();updateSoftCustomerButton('jobCustomer');
  document.getElementById('jobAddress').value='';
  document.getElementById('jobAddress').dataset.autoFilled='1';
  document.getElementById('jobStart').value=todayISO();
  document.getElementById('jobStartTime').value='08:00';
  document.getElementById('jobDurationValue').value=1;
  document.getElementById('jobDurationUnit').value='days';syncJobDurationUI();
  document.getElementById('jobStatus').value='open';
  document.getElementById('jobNotes').value='';
  document.getElementById('jobOffer').innerHTML=acceptedOfferOptions();
  jobDraftPhotos=[];
  document.getElementById('jobDocNote').value='';
  renderJobPhotos();
  setJobEditorRoleMode();
  globalThis.JobAssignments?.open([],[]);
  globalThis.TimeTracking?.open(null);
  showScreen('jobEditor');
}
function editJob(id){
  const j=data.jobs.find(x=>x.id===id);if(!j)return;
  document.getElementById('jobId').value=j.id;
  document.getElementById('jobTitle').value=j.title;
  document.getElementById('jobCustomer').innerHTML=customerOptions(j.customerId);updateSoftCustomerButton('jobCustomer');
  document.getElementById('jobAddress').value=j.address||'';
  document.getElementById('jobAddress').dataset.autoFilled='0';
  document.getElementById('jobStart').value=j.start;
  document.getElementById('jobStartTime').value=j.startTime||'08:00';
  document.getElementById('jobDurationValue').value=Number(j.durationValue)||1;
  document.getElementById('jobDurationUnit').value=normalizeJobDurationUnit(j.durationUnit);syncJobDurationUI();
  document.getElementById('jobStatus').value=j.status;
  document.getElementById('jobNotes').value=j.notes||'';
  document.getElementById('jobOffer').innerHTML=acceptedOfferOptions(j.offerId||'',j.customerId);
  jobDraftPhotos=structuredClone(j.photos||[]);
  document.getElementById('jobDocNote').value=j.docNote||'';
  renderJobPhotos();
  setJobEditorRoleMode();
  globalThis.JobAssignments?.open(j.assignedUserIds||[],j.assignedNames||[]);
  globalThis.TimeTracking?.open(j.id);
  showScreen('jobEditor');
  globalThis.CloudFiles?.refreshJob?.(j.id,{render:true}).catch(e=>console.warn('Cloud-Fotos konnten noch nicht aktualisiert werden',e));
}
function saveJob(){
  const id=document.getElementById('jobId').value;
  const old=id?data.jobs.find(x=>x.id===id):null;
  const role=data.privacy?.role||'owner';
  const worker=role==='worker';
  const assignmentState=worker
    ?{ids:old?.assignedUserIds||[],names:old?.assignedNames||[]}
    :(globalThis.JobAssignments?.selection?.()||{ids:old?.assignedUserIds||[],names:old?.assignedNames||[]});

  const obj={
    id:id||uid(),
    title:document.getElementById('jobTitle').value.trim(),
    customerId:document.getElementById('jobCustomer').value,
    address:document.getElementById('jobAddress').value.trim(),
    start:document.getElementById('jobStart').value,
    startTime:worker?(old?.startTime||'08:00'):(document.getElementById('jobStartTime').value||'08:00'),
    durationValue:worker?(Number(old?.durationValue)||1):(normalizeJobDurationUnit(document.getElementById('jobDurationUnit').value)==='days'?Math.max(1,Math.round(Number(document.getElementById('jobDurationValue').value)||1)):Math.max(.25,Number(document.getElementById('jobDurationValue').value)||1)),
    durationUnit:worker?normalizeJobDurationUnit(old?.durationUnit):normalizeJobDurationUnit(document.getElementById('jobDurationUnit').value),
    status:document.getElementById('jobStatus').value,
    notes:document.getElementById('jobNotes').value.trim(),
    offerId:worker?(old?.offerId||''):(document.getElementById('jobOffer').value||''),
    invoiceId:old?.invoiceId||'',
    eventId:old?.eventId||'',
    photos:structuredClone(jobDraftPhotos),
    docNote:document.getElementById('jobDocNote').value.trim(),
    assignedUserIds:assignmentState.ids,
    assignedNames:assignmentState.names
  };
  if(!obj.title)return toast('Name fehlt');
  const previousAssignees=new Set(old?.assignedUserIds||[]);
  const newlyAssigned=worker?[]:(obj.assignedUserIds||[]).filter(uid=>!previousAssignees.has(uid));

  if(id)data.jobs[data.jobs.findIndex(x=>x.id===id)]=obj;else data.jobs.push(obj);

  if(!worker)upsertCalendarEventForJob(obj);

  let invoiceResult=null,invoiceWasNew=false;
  if(!worker&&obj.status==='done'&&old?.status!=='done'&&!obj.invoiceId){
    const before=data.invoices.length;
    invoiceResult=createInvoiceFromJobObject(obj);
    invoiceWasNew=data.invoices.length>before;
    if(invoiceResult)obj.invoiceId=invoiceResult.id;
    data.jobs[data.jobs.findIndex(x=>x.id===obj.id)]=obj;
  }

  saveData(worker?'Baustellenfortschritt gespeichert':'Baustelle gespeichert',obj.title);
  if(!worker&&newlyAssigned.length){
    const c=data.customers.find(x=>x.id===obj.customerId);
    setTimeout(()=>globalThis.Notifications?.notifyUsers?.(newlyAssigned,'Neue Baustelle zugewiesen',`${obj.title}${c?.name?' · '+c.name:''} · ${dateDE(obj.start)} ${obj.startTime||'08:00'} Uhr`,{type:'assignment',tag:`assignment-${obj.id}-${Date.now()}`,url:'./?screen=jobs',metadata:{screen:'jobs',job_local_id:obj.id}}).catch(()=>{}),1200);
  }
  globalThis.CloudFiles?.uploadPendingForJob?.(obj.id).catch(e=>{console.error(e);globalThis.toast?.('Fotos lokal gespeichert · Cloud-Upload wird erneut versucht')});

  if(worker){
    globalThis.JobAssignments?.saveWorkerProgress?.(obj)
      .then(()=>globalThis.toast?.('✓ Fortschritt in der Cloud gespeichert'))
      .catch(e=>{console.error(e);globalThis.toast?.('Fortschritt lokal gespeichert · Cloud bitte erneut versuchen')});
  }

  showScreen(invoiceResult?'invoices':'jobs');
  toast(worker
    ?'Fortschritt gespeichert'
    :invoiceResult
      ?(invoiceWasNew?'Baustelle abgeschlossen · Rechnungsentwurf erstellt':'Baustelle abgeschlossen · vorhandene Rechnung verknüpft')
      :`Baustelle gespeichert${obj.assignedUserIds?.length?` · ${obj.assignedUserIds.length} Mitarbeiter zugewiesen`:''}`);
}
function renderJobs(){
  const box=document.getElementById('jobList');if(!box)return;
  const role=data.privacy?.role||'owner',worker=role==='worker';
  const title=document.getElementById('jobsScreenTitle');if(title)title.textContent=worker?'Meine Baustellen':'Baustellen';

  box.innerHTML=data.jobs.length?data.jobs.map(j=>{
    const c=data.customers.find(x=>x.id===j.customerId),inv=data.invoices.find(x=>x.id===j.invoiceId);
    const assignees=!worker?globalThis.JobAssignments?.chips?.(j.assignedUserIds||[],j.assignedNames||[]):'';
    const financeActions=!worker
      ?`${j.status==='done'&&!inv?`<button class="btn small primary" onclick="createInvoiceFromJob('${j.id}')">🧾 Rechnung</button>`:''}${inv?`<button class="btn small" onclick="editInvoice('${inv.id}')">🧾 Rechnung öffnen</button>`:''}`
      :'';
    return `<div class="item jobCard">
      <div class="itemTop">
        <div><span class="badge ${j.status==='done'?'done':'open'}">${statusLabel(j.status)}</span><h3 style="margin-top:8px">${escapeHTML(j.title)}</h3><p>${escapeHTML(c?.name||'')} · Start ${dateDE(j.start)} ${escapeHTML(j.startTime||'08:00')} · ${normalizeJobDurationUnit(j.durationUnit)==='hours'?`${Number(j.durationValue)||1} Std.`:`${Math.max(1,Math.round(Number(j.durationValue)||1))} ${Math.max(1,Math.round(Number(j.durationValue)||1))===1?'Tag':'Tage'}`}${!worker&&inv?' · Rechnung '+escapeHTML(inv.number):''}</p>${assignees}</div>
        <button class="btn small" onclick="editJob('${j.id}')">${worker?'Öffnen':'Bearbeiten'}</button>
      </div>
      <div class="itemActions">${j.address?`<button class="btn small" onclick="openMaps('${encodeURIComponent(j.address)}')">📍 Navigation</button><button class="btn small" onclick="openJobWeather('${j.id}')">🌦️ Wetter</button>`:''}${!worker?`<button class="btn small" onclick="jobToCalendar('${j.id}')">📅 Termin</button>`:''}${financeActions}</div>
    </div>`;
  }).join(''):`<div class="empty">${worker?'Dir ist aktuell keine Baustelle zugewiesen.':'Noch keine Baustellen.'}</div>`;
}
function jobToCalendar(id){const j=data.jobs.find(x=>x.id===id);if(!j)return;upsertCalendarEventForJob(j);persistAppState();const ev=data.events.find(e=>e.jobId===j.id);if(ev)editEvent(ev.id)}
function renderCatalog(){
  const el=document.getElementById('catalogList');if(!el)return;
  const q=(document.getElementById('catalogSearch')?.value||'').trim().toLowerCase();
  const trade=data.settings.trade||'garden',tradeName=TRADE_CATALOGS[trade]?.name||'Betrieb';
  let list=(data.catalog||[]).filter(x=>isCurrentTradeCatalogItem(x)&&(catalogFilter==='all'||(x.type||'service')===catalogFilter)&&(!q||String(x.name).toLowerCase().includes(q)));
  list.sort((a,b)=>(a.type||'service').localeCompare(b.type||'service')||a.name.localeCompare(b.name));
  el.innerHTML=`<div class="catalogTradeInfo"><span>${TRADE_CATALOGS[trade]?.icon||'🧰'}</span><div><b>${escapeHTML(tradeName)}</b><small>Es werden nur Positionen dieses Gewerks angezeigt.</small></div></div>`+(list.length?list.map(x=>`<div class="item"><div class="itemTop"><div><span class="catalogType">${(x.type||'service')==='material'?'Material':'Leistung'}</span><h3>${escapeHTML(x.name)}</h3><p>${escapeHTML(x.unit||'')}</p></div><strong>${Number(x.price)>0?euro(x.price):'<span class="mini">Preis fehlt</span>'}</strong></div><div class="itemActions"><button class="btn small" onclick="editCatalog('${x.id}')">Preis bearbeiten</button></div></div>`).join(''):'<div class="empty">Keine passenden Positionen gefunden.</div>');
}
function addCatalogItem(){openCatalogEditor()}
function editCatalogItem(id){openCatalogEditor(id)}


function nextInvoiceNumber(){const y=new Date().getFullYear(),nums=data.invoices.filter(i=>String(i.number||'').startsWith('RE-'+y+'-')).map(i=>Number(String(i.number).split('-').pop())||0);return 'RE-'+y+'-'+String((nums.length?Math.max(...nums):0)+1).padStart(4,'0')}
function paymentDays(){const m=String(data.settings.paymentTerm||'').match(/(\d+)/);return m?Number(m[1]):7}
function addDaysISO(date,days){const d=new Date((date||todayISO())+'T12:00:00');d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}

function findInvoiceForOffer(offerOrId){
  if(!offerOrId)return null;
  const offer=typeof offerOrId==='object'?offerOrId:(data.offers||[]).find(o=>o.id===offerOrId);
  const offerId=typeof offerOrId==='string'?offerOrId:offer?.id;
  const offerNumber=offer?.number||'';
  const byDirect=(data.invoices||[]).find(inv=>inv.offerId===offerId);if(byDirect)return byDirect;
  if(offerNumber){const byNumber=(data.invoices||[]).find(inv=>String(inv.offerNumber||'').trim()===String(offerNumber).trim()||String(inv.sourceOfferNumber||'').trim()===String(offerNumber).trim());if(byNumber)return byNumber}
  const job=(data.jobs||[]).find(j=>j.offerId===offerId&&j.invoiceId);if(job){const byJob=data.invoices.find(inv=>inv.id===job.invoiceId);if(byJob)return byJob}
  return null;
}
function invoiceNumberExists(number,excludeId=''){const n=String(number||'').trim().toLowerCase();if(!n)return false;return(data.invoices||[]).some(inv=>inv.id!==excludeId&&String(inv.number||'').trim().toLowerCase()===n)}
function nextUniqueInvoiceNumber(){let candidate=nextInvoiceNumber(),guard=0;while(invoiceNumberExists(candidate)&&guard<500){guard++;const m=String(candidate).match(/^(.*?)(\d+)$/);candidate=m?m[1]+String(parseInt(m[2],10)+1).padStart(m[2].length,'0'):String(candidate)+'-'+guard}return candidate}
function isInvoiceLocked(inv){return!!(inv&&(inv.finalizedAt||['open','paid','cancelled'].includes(inv.status)))}
function invoiceCalc(inv){const base=(inv.lines||[]).reduce((s,l)=>s+(Number(l.qty)||0)*(Number(l.price)||0),0);inv.travel=0;inv.discountType=normalizeDiscountType(inv.discountType);if(inv.discountValue===undefined||inv.discountValue===null)inv.discountValue=Number(inv.discount)||0;const discount=discountAmount(base,inv.discountValue,inv.discountType),sub=base-discount,tax=Number(inv.tax??data.settings.tax)||0;inv.baseSubtotal=base;inv.discount=discount;inv.subtotal=sub;inv.tax=tax;inv.total=sub*(1+tax/100);return inv}
function invoiceSnapshot(inv){return{number:inv.number,customerId:inv.customerId,date:inv.date,dueDate:inv.dueDate,subject:inv.subject,notes:inv.notes,lines:structuredClone(inv.lines||[]),travel:0,discountType:inv.discountType,discountValue:inv.discountValue,discount:inv.discount,baseSubtotal:inv.baseSubtotal,tax:inv.tax,subtotal:inv.subtotal,total:inv.total,offerId:inv.offerId||'',offerNumber:inv.offerNumber||'',jobId:inv.jobId||'',documentType:inv.documentType||'invoice'}}
function finalizeInvoiceRecord(inv,status='open'){
  if(!inv)return null;
  if(!inv.finalizedAt)inv.finalizedAt=new Date().toISOString();
  inv.status=status==='paid'?'paid':'open';
  inv.finalizedSnapshot=inv.finalizedSnapshot||invoiceSnapshot(inv);
  if(inv.documentType==='cancellation'&&inv.originalInvoiceId){const original=data.invoices.find(x=>x.id===inv.originalInvoiceId);if(original){original.status='cancelled';original.cancelledAt=new Date().toISOString();original.cancelledByInvoiceId=inv.id;addAudit('Originalrechnung storniert',`${original.number} durch ${inv.number}`)}}
  addAudit('Rechnung ausgestellt',`${inv.number} · ${euro(inv.total)}`);
  return inv;
}

function createInvoiceFromOfferObject(offer){
  if(!offer)return null;const existing=findInvoiceForOffer(offer);if(existing)return existing;
  const linkedJob=(data.jobs||[]).find(j=>j.offerId===offer.id),date=todayISO();
  const inv={id:uid(),number:nextUniqueInvoiceNumber(),customerId:offer.customerId,date,dueDate:addDaysISO(date,paymentDays()),status:'draft',subject:offer.subject||linkedJob?.title||'Ausgeführte Arbeiten',notes:'Aus dem abgeschlossenen Angebot erstellt. Bitte tatsächliche Leistungen, Mengen und Zusatzarbeiten vor Versand prüfen.',lines:structuredClone(offer.lines||[]),travel:0,discountType:normalizeDiscountType(offer.discountType),discountValue:Number(offer.discountValue ?? offer.discount ?? 0)||0,tax:Number(offer.tax??data.settings.tax)||0,offerId:offer.id,offerNumber:offer.number||'',sourceOfferNumber:offer.number||'',jobId:linkedJob?.id||'',createdAutomatically:true,documentType:'invoice'};
  invoiceCalc(inv);data.invoices.push(inv);if(linkedJob){linkedJob.invoiceId=inv.id;if(linkedJob.status!=='done')linkedJob.status='done'}addAudit('Rechnungsentwurf aus Angebot erstellt',`${inv.number} · ${offer.number||offer.subject||''}`);return inv;
}
function createInvoiceFromJobObject(job){
  const offer=data.offers.find(o=>o.id===job.offerId)||(data.offers.filter(o=>o.customerId===job.customerId&&o.status==='accepted').sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]);
  if(offer){const existing=findInvoiceForOffer(offer);if(existing){job.invoiceId=existing.id;if(!existing.jobId)existing.jobId=job.id;return existing}}
  if(job.invoiceId){const linked=data.invoices.find(i=>i.id===job.invoiceId);if(linked)return linked}
  const date=todayISO(),inv={id:uid(),number:nextUniqueInvoiceNumber(),customerId:job.customerId,date,dueDate:addDaysISO(date,paymentDays()),status:'draft',subject:job.title||offer?.subject||'Ausgeführte Arbeiten',notes:'Automatisch nach Abschluss der Baustelle erstellt. Bitte tatsächliche Leistungen und Mengen vor Versand prüfen.',lines:offer?structuredClone(offer.lines||[]):[{name:'Ausgeführte Arbeiten – '+(job.title||'Baustelle'),qty:1,unit:'Pauschale',price:0}],travel:0,discountType:normalizeDiscountType(offer?.discountType),discountValue:Number(offer?.discountValue ?? offer?.discount ?? 0)||0,tax:Number(offer?.tax??data.settings.tax)||0,offerId:offer?.id||'',offerNumber:offer?.number||'',sourceOfferNumber:offer?.number||'',jobId:job.id,createdAutomatically:true,documentType:'invoice'};
  invoiceCalc(inv);data.invoices.push(inv);job.invoiceId=inv.id;addAudit('Rechnungsentwurf automatisch erstellt',`${inv.number} · ${job.title}`);return inv;
}
function createInvoiceFromJob(id){const job=data.jobs.find(x=>x.id===id);if(!job)return;if(job.invoiceId)return editInvoice(job.invoiceId);const inv=createInvoiceFromJobObject(job);saveData('Rechnung erstellt',inv.number);editInvoice(inv.id);toast('Rechnungsentwurf erstellt')}

let invoiceDraftLines=[];
function newInvoice(){document.getElementById('invoiceId').value='';document.getElementById('invoiceCustomer').innerHTML=customerOptions();updateSoftCustomerButton('invoiceCustomer');document.getElementById('invoiceDate').value=todayISO();document.getElementById('invoiceDueDate').value=addDaysISO(todayISO(),paymentDays());document.getElementById('invoiceStatus').value='draft';document.getElementById('invoiceSubject').value='';document.getElementById('invoiceNotes').value='';document.getElementById('invoiceDiscount').value=0;setDiscountType('invoice','euro');invoiceDraftLines=[{name:'',qty:1,unit:'Pauschale',price:0}];renderInvoiceLines(false);applyInvoiceLockState(null);showScreen('invoiceEditor')}
function editInvoice(id){const inv=data.invoices.find(x=>x.id===id);if(!inv)return;document.getElementById('invoiceId').value=inv.id;document.getElementById('invoiceCustomer').innerHTML=customerOptions(inv.customerId);updateSoftCustomerButton('invoiceCustomer');document.getElementById('invoiceDate').value=inv.date||todayISO();document.getElementById('invoiceDueDate').value=inv.dueDate||addDaysISO(inv.date||todayISO(),paymentDays());document.getElementById('invoiceStatus').value=inv.status||'draft';document.getElementById('invoiceSubject').value=inv.subject||'';document.getElementById('invoiceNotes').value=inv.notes||'';document.getElementById('invoiceDiscount').value=Number(inv.discountValue ?? inv.discount ?? 0)||0;setDiscountType('invoice',normalizeDiscountType(inv.discountType));invoiceDraftLines=structuredClone(inv.lines||[]);if(!invoiceDraftLines.length)invoiceDraftLines=[{name:'',qty:1,unit:'Pauschale',price:0}];renderInvoiceLines(isInvoiceLocked(inv));applyInvoiceLockState(inv);showScreen('invoiceEditor')}
function applyInvoiceLockState(inv){const locked=isInvoiceLocked(inv),banner=document.getElementById('invoiceLockBanner'),save=document.getElementById('invoiceSaveBtn'),add=document.getElementById('invoiceAddLineBtn'),hint=document.getElementById('invoiceStatusHint');if(banner)banner.classList.toggle('hidden',!locked);document.querySelectorAll('[data-invoice-editable]').forEach(el=>el.disabled=locked);if(save)save.classList.toggle('hidden',locked);if(add)add.classList.toggle('hidden',locked);if(hint)hint.textContent=locked?`Ausgestellt am ${inv?.finalizedAt?new Date(inv.finalizedAt).toLocaleString('de-DE'):'bereits finalisiert'}. Für Änderungen bitte Korrektur oder Storno verwenden.`:'Entwürfe können frei bearbeitet werden. Beim Ausstellen wird die Rechnung gesperrt.';const corr=document.getElementById('invoiceCorrectionBtn'),cancel=document.getElementById('invoiceCancelDraftBtn');if(corr)corr.onclick=()=>createCorrectionDraft(inv?.id);if(cancel)cancel.onclick=()=>createCancellationDraft(inv?.id)}
function renderInvoiceLines(locked=false){document.getElementById('invoiceLines').innerHTML=invoiceDraftLines.map((l,i)=>`<div class="item"><div class="field"><input class="input" value="${escapeHTML(l.name)}" placeholder="Leistung" ${locked?'disabled':''} oninput="invoiceDraftLines[${i}].name=this.value"></div><div class="row3"><input type="number" class="input" value="${l.qty}" step="0.01" ${locked?'disabled':''} oninput="invoiceDraftLines[${i}].qty=Number(this.value)"><input class="input" value="${escapeHTML(l.unit)}" ${locked?'disabled':''} oninput="invoiceDraftLines[${i}].unit=this.value"><input type="number" class="input" value="${l.price}" step="0.01" ${locked?'disabled':''} oninput="invoiceDraftLines[${i}].price=Number(this.value)"></div><div class="itemActions"><span class="mini">Menge · Einheit · Einzelpreis</span>${locked?'':'<button class="btn small danger" onclick="invoiceDraftLines.splice('+i+',1);renderInvoiceLines(false)">Löschen</button>'}</div></div>`).join('')}
function addInvoiceLine(){const old=document.getElementById('invoiceId').value?data.invoices.find(x=>x.id===document.getElementById('invoiceId').value):null;if(isInvoiceLocked(old))return toast('🔒 Ausgestellte Rechnung ist gesperrt');invoiceDraftLines.push({name:'',qty:1,unit:'Pauschale',price:0});renderInvoiceLines(false)}
function invoiceObject(){const id=document.getElementById('invoiceId').value,old=id?data.invoices.find(x=>x.id===id):null,inv={id:id||uid(),number:old?.number||nextUniqueInvoiceNumber(),customerId:document.getElementById('invoiceCustomer').value,date:document.getElementById('invoiceDate').value,dueDate:document.getElementById('invoiceDueDate').value,status:document.getElementById('invoiceStatus').value,subject:document.getElementById('invoiceSubject').value.trim(),notes:document.getElementById('invoiceNotes').value.trim(),lines:structuredClone(invoiceDraftLines),travel:0,discountType:normalizeDiscountType(document.getElementById('invoiceDiscountType')?.value),discountValue:Number(document.getElementById('invoiceDiscount').value)||0,tax:Number(old?.tax??data.settings.tax)||0,offerId:old?.offerId||'',offerNumber:old?.offerNumber||'',sourceOfferNumber:old?.sourceOfferNumber||'',jobId:old?.jobId||'',createdAutomatically:old?.createdAutomatically||false,documentType:old?.documentType||'invoice',originalInvoiceId:old?.originalInvoiceId||'',correctionOf:old?.correctionOf||'',finalizedAt:old?.finalizedAt||'',finalizedSnapshot:old?.finalizedSnapshot||null};return invoiceCalc(inv)}

function persistInvoiceDraftFromEditor({audit=true}={}){
  const id=document.getElementById('invoiceId').value;
  const old=id?data.invoices.find(x=>x.id===id):null;
  if(isInvoiceLocked(old))return old||null;
  const inv=invoiceObject();
  // Closing an editor must never silently "issue" a legal invoice.
  // If user selected open/paid but closes without explicit save/finalize, preserve draft state.
  if(['open','paid'].includes(inv.status) && !(old?.finalizedAt))inv.status='draft';
  if(invoiceNumberExists(inv.number,inv.id)){toast('⚠️ Rechnungsnummer existiert bereits');return null}
  if(inv.offerId){
    const linkedOffer=(data.offers||[]).find(o=>o.id===inv.offerId);
    const duplicate=findInvoiceForOffer(linkedOffer||inv.offerId);
    if(duplicate&&duplicate.id!==inv.id)return duplicate;
  }
  const i=data.invoices.findIndex(x=>x.id===inv.id);
  if(i>=0)data.invoices[i]=inv;else data.invoices.push(inv);
  persistAppState();
  if(audit)addAudit('Rechnungsentwurf automatisch gespeichert',inv.number);
  document.getElementById('invoiceId').value=inv.id;
  return inv;
}
function autoSaveInvoiceAndClose(){
  const id=document.getElementById('invoiceId').value,old=id?data.invoices.find(x=>x.id===id):null;
  if(isInvoiceLocked(old)){showScreen('invoices');return}
  const hasMeaningful=!!(id||document.getElementById('invoiceCustomer').value||document.getElementById('invoiceSubject').value.trim()||invoiceDraftLines.some(l=>l.name));
  if(!hasMeaningful){showScreen('invoices');return}
  const canSave=old||(
    document.getElementById('invoiceCustomer').value &&
    document.getElementById('invoiceSubject').value.trim() &&
    invoiceDraftLines.some(l=>l.name)
  );
  if(canSave){
    const inv=persistInvoiceDraftFromEditor({audit:true});
    renderAll();
    showScreen('invoices');
    if(inv)toast('✓ Rechnungsentwurf automatisch gespeichert');
  }else{
    showScreen('invoices');
    toast('Unvollständiger neuer Entwurf wurde nicht gespeichert');
  }
}

async function saveInvoice(){
  const id=document.getElementById('invoiceId').value,old=id?data.invoices.find(x=>x.id===id):null;if(isInvoiceLocked(old))return toast('🔒 Ausgestellte Rechnungen können nicht überschrieben werden');
  const inv=invoiceObject();if(!inv.customerId)return toast('Kunde auswählen');if(!inv.subject)return toast('Betreff fehlt');if(!inv.lines.some(l=>l.name))return toast('Position fehlt');if(invoiceNumberExists(inv.number,inv.id))return toast('⚠️ Diese Rechnungsnummer existiert bereits');
  if(inv.offerId){const linkedOffer=(data.offers||[]).find(o=>o.id===inv.offerId),duplicate=findInvoiceForOffer(linkedOffer||inv.offerId);if(duplicate&&duplicate.id!==inv.id){toast(`⚠️ Für dieses Angebot existiert bereits Rechnung ${duplicate.number}`);editInvoice(duplicate.id);return}}
  const shouldFinalize=['open','paid'].includes(inv.status);if(shouldFinalize){const ok=await appConfirm({title:'Rechnung ausstellen?',text:`${inv.number} wird danach gegen inhaltliche Änderungen gesperrt. Falls später etwas geändert werden muss, erstellst du eine Korrektur oder ein Storno.`,confirmLabel:'Jetzt ausstellen',icon:'🔒'});if(!ok){document.getElementById('invoiceStatus').value='draft';inv.status='draft';return}}
  if(shouldFinalize)finalizeInvoiceRecord(inv,inv.status);
  const i=data.invoices.findIndex(x=>x.id===inv.id);if(i>=0)data.invoices[i]=inv;else data.invoices.push(inv);saveData(shouldFinalize?'Rechnung finalisiert':'Rechnung gespeichert',inv.number);showScreen('invoices');toast(shouldFinalize?'🔒 Rechnung ausgestellt und gesperrt':'Rechnung gespeichert')
}
async function finalizeInvoiceById(id){const inv=data.invoices.find(x=>x.id===id);if(!inv)return;if(isInvoiceLocked(inv))return editInvoice(id);const ok=await appConfirm({title:'Rechnung ausstellen?',text:`${inv.number} wird finalisiert und danach gegen Änderungen gesperrt.`,confirmLabel:'Rechnung ausstellen',icon:'🔒'});if(!ok)return;finalizeInvoiceRecord(inv,'open');saveData('Rechnung finalisiert',inv.number);toast('🔒 Rechnung ausgestellt')}
function invoiceStatusLabel(s){return({draft:'Entwurf',open:'Offen / ausgestellt',paid:'Bezahlt',cancelled:'Storniert'})[s]||s}
function invoiceTypeLabel(inv){return inv.documentType==='cancellation'?'Storno':inv.correctionOf?'Korrektur':'Rechnung'}
function renderInvoices(){const el=document.getElementById('invoiceList');if(!el)return;const list=[...data.invoices].sort((a,b)=>(b.date||'').localeCompare(a.date||''));el.innerHTML=list.length?list.map(inv=>{const c=data.customers.find(x=>x.id===inv.customerId),locked=isInvoiceLocked(inv),type=invoiceTypeLabel(inv);return `<div class="item"><div class="itemTop"><div><span class="badge ${inv.status==='paid'?'done':inv.status==='open'?'sent':inv.status==='cancelled'?'rejected':'draft'}">${invoiceStatusLabel(inv.status)}</span><h3 style="margin-top:8px">${escapeHTML(inv.subject)}</h3><p>${escapeHTML(c?.name||'Unbekannter Kunde')} · ${escapeHTML(inv.number)} · ${type} · fällig ${dateDE(inv.dueDate)}</p></div><strong>${euro(inv.total)}</strong></div><div class="itemActions"><button class="btn small" onclick="editInvoice('${inv.id}')">${locked?'Öffnen':'Bearbeiten'}</button><button class="btn small" onclick="previewInvoice('${inv.id}')">PDF</button>${inv.status==='draft'?`<button class="btn small primary" onclick="finalizeInvoiceById('${inv.id}')">🔒 Ausstellen</button>`:`<button class="btn small primary shareInvoiceBtn" onclick="shareInvoicePDF('${inv.id}')">📤 Teilen</button>`}${inv.status==='open'?`<button class="btn small" onclick="markInvoicePaid('${inv.id}')">✓ Bezahlt</button>`:''}${['open','paid'].includes(inv.status)&&inv.documentType!=='cancellation'?`<button class="btn small" onclick="createCorrectionDraft('${inv.id}')">↗ Korrektur</button><button class="btn small danger" onclick="createCancellationDraft('${inv.id}')">↩ Storno</button>`:''}</div></div>`}).join(''):'<div class="empty">Noch keine Rechnungen.</div>'}
async function markInvoicePaid(id){const inv=data.invoices.find(x=>x.id===id);if(!inv)return;if(inv.status==='draft')return toast('Rechnung zuerst ausstellen');if(inv.status==='cancelled')return toast('Stornierte Rechnung kann nicht bezahlt werden');const ok=await appConfirm({title:'Zahlung bestätigen?',text:`${inv.number} als vollständig bezahlt markieren?`,confirmLabel:'Als bezahlt markieren',icon:'✓'});if(!ok)return;inv.status='paid';inv.paidAt=todayISO();saveData('Rechnung bezahlt',inv.number);toast('✓ Als bezahlt markiert')}
function correctionAlreadyExists(originalId){return(data.invoices||[]).find(i=>i.correctionOf===originalId&&i.status!=='cancelled')||null}
async function createCorrectionDraft(id){const original=data.invoices.find(x=>x.id===id);if(!original)return;if(!isInvoiceLocked(original))return toast('Korrektur erst nach dem Ausstellen nötig');const existing=correctionAlreadyExists(id);if(existing){toast(`Korrekturentwurf ${existing.number} ist bereits vorhanden`);return editInvoice(existing.id)}const ok=await appConfirm({title:'Korrekturentwurf erstellen?',text:`Die Originalrechnung ${original.number} bleibt unverändert. Es wird ein neuer bearbeitbarer Entwurf mit neuer Rechnungsnummer angelegt.`,confirmLabel:'Korrektur erstellen',icon:'↗'});if(!ok)return;const copy={...structuredClone(original),id:uid(),number:nextUniqueInvoiceNumber(),status:'draft',date:todayISO(),dueDate:addDaysISO(todayISO(),paymentDays()),subject:`Korrektur zu ${original.number} – ${original.subject}`,notes:`Korrekturentwurf zu Rechnung ${original.number}. Bitte Änderungen vor dem Ausstellen prüfen.`,offerId:'',offerNumber:'',sourceOfferNumber:'',jobId:'',finalizedAt:'',finalizedSnapshot:null,paidAt:'',cancelledAt:'',cancelledByInvoiceId:'',correctionOf:original.id,originalInvoiceId:'',documentType:'correction',createdAutomatically:true};invoiceCalc(copy);data.invoices.push(copy);saveData('Korrekturentwurf erstellt',`${copy.number} zu ${original.number}`);editInvoice(copy.id);toast('↗ Korrekturentwurf erstellt')}
function cancellationAlreadyExists(originalId){return(data.invoices||[]).find(i=>i.originalInvoiceId===originalId&&i.documentType==='cancellation')||null}
async function createCancellationDraft(id){const original=data.invoices.find(x=>x.id===id);if(!original)return;if(!isInvoiceLocked(original)||original.status==='cancelled')return toast('Diese Rechnung kann nicht storniert werden');const existing=cancellationAlreadyExists(id);if(existing){toast(`Storno ${existing.number} ist bereits vorhanden`);return editInvoice(existing.id)}const ok=await appConfirm({title:'Stornoentwurf erstellen?',text:`Es wird ein separater Stornoentwurf mit Gegenbeträgen zu ${original.number} erstellt. Die Originalrechnung bleibt bis zum Ausstellen des Stornos unverändert.`,confirmLabel:'Storno erstellen',icon:'↩',danger:true});if(!ok)return;const inv={id:uid(),number:nextUniqueInvoiceNumber(),customerId:original.customerId,date:todayISO(),dueDate:todayISO(),status:'draft',subject:`Storno zu Rechnung ${original.number}`,notes:`Storno zu Rechnung ${original.number} vom ${dateDE(original.date)}.`,lines:(original.lines||[]).map(l=>({...structuredClone(l),price:-(Number(l.price)||0)})),travel:0,discountType:normalizeDiscountType(original.discountType),discountValue:normalizeDiscountType(original.discountType)==='percent'?(Number(original.discountValue)||0):-(Number(original.discountValue ?? original.discount)||0),tax:Number(original.tax)||0,offerId:'',offerNumber:'',sourceOfferNumber:'',jobId:'',createdAutomatically:true,documentType:'cancellation',originalInvoiceId:original.id,correctionOf:'',finalizedAt:'',finalizedSnapshot:null};invoiceCalc(inv);data.invoices.push(inv);saveData('Stornoentwurf erstellt',`${inv.number} zu ${original.number}`);editInvoice(inv.id);toast('↩ Stornoentwurf erstellt')}
function invoicePaperHTML(inv){
  const c=data.customers.find(x=>x.id===inv.customerId)||{},s=data.settings,draft=inv.status==='draft',type=invoiceTypeLabel(inv);
  const company=s.companyName||'Ihr Betrieb',owner=s.ownerName||'',mark=company.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'AP';
  const rows=(inv.lines||[]).filter(l=>l.name).map((l,i)=>`<tr><td class="posCol">${String(i+1).padStart(2,'0')}</td><td><b>${escapeHTML(l.name)}</b>${l.workers&&l.hoursPerWorker?`<small>${l.workers} Mitarbeiter × ${l.hoursPerWorker} Std.</small>`:''}</td><td class="num">${Number(l.qty).toLocaleString('de-DE',{maximumFractionDigits:2})} ${escapeHTML(l.unit)}</td><td class="num">${euro(l.price)}</td><td class="num strong">${euro(l.qty*l.price)}</td></tr>`).join('');
  const discount=inv.discount?`<tr class="discountRow"><td></td><td><b>${discountDisplayLabel(inv)}</b></td><td></td><td></td><td class="num strong">− ${euro(Math.abs(inv.discount))}</td></tr>`:'';
  return `<div class="offerPaper professionalPaper professionalInvoicePaper">
    ${draft?'<div class="invoiceDraftWatermark">ENTWURF · NICHT AUSGESTELLT</div>':''}
    <div class="proHeader invoiceProHeader">
      <div class="companyIdentity"><div class="companyMonogram">${escapeHTML(mark)}</div><div><h2>${escapeHTML(company)}</h2><p>${escapeHTML(s.address||'')}</p></div></div>
      <div class="offerTitleBlock invoiceTitleBlock"><span>${escapeHTML(String(type).toUpperCase())}</span><strong>${escapeHTML(inv.number)}</strong></div>
    </div>
    <div class="proContactLine">${s.phone?`<span>Tel. ${escapeHTML(s.phone)}</span>`:''}${s.email?`<span>${escapeHTML(s.email)}</span>`:''}${owner?`<span>Ansprechpartner: ${escapeHTML(owner)}</span>`:''}</div>
    <div class="proMetaGrid">
      <div class="recipientBlock"><span class="paperLabel">RECHNUNGSEMPFÄNGER</span><b>${escapeHTML(c.name||'')}</b>${c.contact?`<span>${escapeHTML(c.contact)}</span>`:''}<span>${escapeHTML(c.address||'')}</span>${c.email?`<span>${escapeHTML(c.email)}</span>`:''}</div>
      <div class="offerFacts">
        <div><span>Rechnungsnummer</span><b>${escapeHTML(inv.number)}</b></div>
        <div><span>Rechnungsdatum</span><b>${dateDE(inv.date)}</b></div>
        <div><span>Fällig am</span><b>${dateDE(inv.dueDate)}</b></div>
        ${inv.offerNumber?`<div><span>Angebot</span><b>${escapeHTML(inv.offerNumber)}</b></div>`:''}
      </div>
    </div>
    <div class="proSubject invoiceSubjectBlock"><span class="paperLabel">RECHNUNG FÜR</span><h1>${escapeHTML(inv.subject||'Ausgeführte Leistungen')}</h1>${inv.notes?`<div class="proNote">${escapeHTML(inv.notes)}</div>`:''}</div>
    <table class="paperTable proTable invoiceProTable"><thead><tr><th>Pos.</th><th>Beschreibung</th><th class="num">Menge</th><th class="num">Einzelpreis</th><th class="num">Gesamt</th></tr></thead><tbody>${rows}${discount}</tbody></table>
    <div class="proSummary invoiceSummary">
      <div class="termsBox invoicePaymentBox">
        <span class="paperLabel">ZAHLUNGSINFORMATION</span>
        <p>Bitte überweisen Sie den Rechnungsbetrag bis zum <b>${dateDE(inv.dueDate)}</b>.</p>
        ${s.iban?`<div class="bankGrid"><span>IBAN</span><b>${escapeHTML(s.iban)}</b>${s.bankName?`<span>Bank</span><b>${escapeHTML(s.bankName)}</b>`:''}</div>`:''}
        ${!inv.tax?`<p class="taxLegal">Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.</p>`:''}
      </div>
      <div class="totals proTotals invoiceTotals">
        <div><span>Summe Positionen</span><b>${euro(inv.baseSubtotal??(inv.subtotal+(inv.discount||0)))}</b></div>
        ${inv.discount?`<div class="discountTotal"><span>${discountDisplayLabel(inv)}</span><b>− ${euro(Math.abs(inv.discount))}</b></div>`:''}
        <div><span>Zwischensumme</span><b>${euro(inv.subtotal)}</b></div>
        ${inv.tax?`<div><span>Umsatzsteuer ${inv.tax}%</span><b>${euro(inv.subtotal*inv.tax/100)}</b></div>`:''}
        <div class="grand"><span>Rechnungsbetrag</span><strong>${euro(inv.total)}</strong></div>
      </div>
    </div>
    <div class="invoiceThankYou"><b>Vielen Dank für Ihren Auftrag.</b><span>Bei Rückfragen zu dieser Rechnung sind wir gerne für Sie da.</span></div>
    <div class="paperFoot proFooter">
      <span>${escapeHTML(company)}</span><span>${escapeHTML(s.address||'')}</span>
      ${s.taxNumber?`<span>St.-Nr. ${escapeHTML(s.taxNumber)}</span>`:''}${s.vatId?`<span>USt-IdNr. ${escapeHTML(s.vatId)}</span>`:''}
      ${s.email?`<span>${escapeHTML(s.email)}</span>`:''}
    </div>
  </div>`;
}
function previewInvoice(id){const inv=id?data.invoices.find(x=>x.id===id):invoiceObject();if(!inv)return;document.getElementById('invoicePreviewPaper').innerHTML=invoicePaperHTML(inv);document.getElementById('invoicePreviewSource').value=inv.id||'';showScreen('invoicePreview')}
function printInvoice(){const id=document.getElementById('invoicePreviewSource').value,inv=id?data.invoices.find(x=>x.id===id):invoiceObject();document.getElementById('printArea').innerHTML=invoicePaperHTML(inv);window.print()}


function pdfAscii(value){
  return String(value??'')
    .replace(/Ä/g,'Ae').replace(/Ö/g,'Oe').replace(/Ü/g,'Ue')
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue')
    .replace(/ß/g,'ss').replace(/€/g,'EUR')
    .replace(/[–—]/g,'-').replace(/×/g,'x')
    .replace(/[“”„]/g,'"').replace(/[‘’]/g,"'")
    .replace(/[^\x20-\x7E]/g,' ');
}
function pdfEsc(value){
  return pdfAscii(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
}
function pdfMoney(value){
  return `${Number(value||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})} EUR`;
}
function pdfWrap(value,maxWidth,size=10){
  const text=pdfAscii(value).trim();
  if(!text)return [''];
  const approx=Math.max(8,Math.floor(maxWidth/(size*.53)));
  const words=text.split(/\s+/),lines=[];
  let line='';
  for(const word of words){
    const next=line?`${line} ${word}`:word;
    if(next.length<=approx){line=next;continue}
    if(line)lines.push(line);
    if(word.length<=approx){line=word;continue}
    let rest=word;
    while(rest.length>approx){lines.push(rest.slice(0,approx));rest=rest.slice(approx)}
    line=rest;
  }
  if(line)lines.push(line);
  return lines.length?lines:[''];
}
function safePdfFilename(inv){
  return `${pdfAscii(inv?.number||'Rechnung').replace(/[^A-Za-z0-9._-]+/g,'-')}.pdf`;
}
function invoicePdfBlob(inv){
  const customer=data.customers.find(x=>x.id===inv.customerId)||{};
  const s=data.settings||{};
  const W=595,H=842,left=40,right=555;
  const pageStreams=[];
  let cmds=[],y=0;

  const py=top=>H-top;
  const add=x=>cmds.push(x);
  const text=(x,top,size,value,bold=false)=>{
    add(`BT /${bold?'F2':'F1'} ${size} Tf ${x.toFixed(1)} ${py(top).toFixed(1)} Td (${pdfEsc(value)}) Tj ET\n`);
  };
  const textRight=(rightX,top,size,value,bold=false)=>{
    const clean=pdfAscii(value);
    const width=clean.length*size*.52;
    text(Math.max(left,rightX-width),top,size,clean,bold);
  };
  const line=(x1,top1,x2,top2,width=.6)=>{
    add(`${width} w ${x1.toFixed(1)} ${py(top1).toFixed(1)} m ${x2.toFixed(1)} ${py(top2).toFixed(1)} l S\n`);
  };
  const finishPage=()=>{pageStreams.push(cmds.join(''));cmds=[]};
  const header=(continuation=false)=>{
    text(left,45,17,s.companyName||'Ihr Betrieb',true);
    if(s.address)text(left,63,8.5,s.address,false);
    textRight(right,45,15,inv.documentType==='cancellation'?'STORNO':inv.correctionOf?'KORREKTUR':'RECHNUNG',true);
    textRight(right,63,9,inv.number||'',true);
    line(left,80,right,80,.9);
    if(continuation)text(left,100,9,`Fortsetzung ${inv.number}`,true);
  };
  const newPage=(continuation=true)=>{
    if(cmds.length)finishPage();
    header(continuation);
    y=continuation?125:95;
  };

  header(false);

  // Empfänger + Metadaten
  text(left,110,7.5,'RECHNUNGSEMPFAENGER',true);
  text(left,128,11,customer.name||'',true);
  if(customer.contact)text(left,144,8.5,customer.contact);
  pdfWrap(customer.address||'',250,8.5).slice(0,2).forEach((ln,i)=>text(left,160+i*12,8.5,ln));
  if(customer.email)text(left,188,8,customer.email);

  text(365,110,7.5,'RECHNUNGSDATEN',true);
  text(365,129,8,'Nummer');
  textRight(right,129,8,inv.number||'',true);
  text(365,145,8,'Datum');
  textRight(right,145,8,dateDE(inv.date),true);
  text(365,161,8,'Faellig');
  textRight(right,161,8,dateDE(inv.dueDate),true);
  if(inv.offerNumber){
    text(365,177,8,'Angebot');
    textRight(right,177,8,inv.offerNumber,true);
  }

  text(left,220,7.5,'RECHNUNG FUER',true);
  pdfWrap(inv.subject||'Ausgefuehrte Leistungen',500,16).slice(0,2).forEach((ln,i)=>text(left,242+i*18,16,ln,true));
  let noteTop=inv.subject&&pdfWrap(inv.subject,500,16).length>1?286:268;
  if(inv.notes){
    const notes=pdfWrap(inv.notes,500,8.5).slice(0,3);
    notes.forEach((ln,i)=>text(left,noteTop+i*12,8.5,ln));
    noteTop+=notes.length*12+8;
  }
  y=Math.max(305,noteTop+8);

  const tableHeader=()=>{
    add(`0.95 g ${left} ${py(y+18)} ${right-left} 22 re f 0 g\n`);
    text(left+4,y+14,8,'Pos.',true);
    text(74,y+14,8,'Beschreibung',true);
    text(340,y+14,8,'Menge',true);
    textRight(468,y+14,8,'Einzelpreis',true);
    textRight(right,y+14,8,'Gesamt',true);
    y+=30;
  };
  tableHeader();

  const lines=(inv.lines||[]).filter(l=>l.name);
  lines.forEach((l,index)=>{
    const desc=pdfWrap(l.name,245,9);
    const detail=l.workers&&l.hoursPerWorker?`${l.workers} Mitarbeiter x ${l.hoursPerWorker} Std.`:'';
    const rowHeight=Math.max(24,desc.length*12+(detail?11:0)+7);
    if(y+rowHeight>690){
      newPage(true);
      tableHeader();
    }

    text(left+5,y+12,8,String(index+1).padStart(2,'0'));
    desc.forEach((ln,i)=>text(74,y+12+i*12,9,ln,i===0));
    if(detail)text(74,y+12+desc.length*12,7.5,detail);
    text(340,y+12,8,`${Number(l.qty||0).toLocaleString('de-DE',{maximumFractionDigits:2})} ${l.unit||''}`);
    textRight(468,y+12,8,pdfMoney(l.price));
    textRight(right,y+12,8,pdfMoney((Number(l.qty)||0)*(Number(l.price)||0)),true);
    line(left,y+rowHeight-2,right,y+rowHeight-2,.35);
    y+=rowHeight;
  });

  if(y>610)newPage(true);
  y+=12;

  const base=inv.baseSubtotal??(Number(inv.subtotal||0)+Number(inv.discount||0));
  text(355,y,8,'Summe Positionen');
  textRight(right,y,8,pdfMoney(base),true); y+=17;

  if(Number(inv.discount||0)){
    text(355,y,8,pdfAscii(discountDisplayLabel(inv)));
    textRight(right,y,8,`- ${pdfMoney(Math.abs(inv.discount))}`,true); y+=17;
  }

  text(355,y,8,'Zwischensumme');
  textRight(right,y,8,pdfMoney(inv.subtotal),true); y+=17;

  if(Number(inv.tax||0)){
    text(355,y,8,`Umsatzsteuer ${Number(inv.tax)}%`);
    textRight(right,y,8,pdfMoney(Number(inv.subtotal||0)*Number(inv.tax||0)/100),true); y+=18;
  }

  line(350,y-7,right,y-7,.8);
  text(350,y+10,11,'Rechnungsbetrag',true);
  textRight(right,y+10,12,pdfMoney(inv.total),true);
  y+=42;

  if(y>725)newPage(true);
  text(left,y,7.5,'ZAHLUNGSINFORMATION',true);
  text(left,y+17,8.5,`Bitte ueberweisen Sie den Betrag bis zum ${dateDE(inv.dueDate)}.`);
  if(s.iban)text(left,y+34,8.5,`IBAN: ${s.iban}`,true);
  if(s.bankName)text(left,y+50,8.5,`Bank: ${s.bankName}`);
  if(!Number(inv.tax||0))text(left,y+68,8,'Gemaess Paragraph 19 UStG wird keine Umsatzsteuer ausgewiesen.');

  const footTop=805;
  line(left,footTop-18,right,footTop-18,.45);
  const footer=[s.companyName,s.address,s.taxNumber?`St.-Nr. ${s.taxNumber}`:'',s.vatId?`USt-IdNr. ${s.vatId}`:'',s.email].filter(Boolean).join(' | ');
  pdfWrap(footer,510,7).slice(0,2).forEach((ln,i)=>text(left,footTop+i*10,7,ln));

  finishPage();

  // Build a minimal valid PDF with shared Helvetica fonts.
  const pageCount=pageStreams.length;
  const font1=3+pageCount*2;
  const font2=font1+1;
  const objects=[];
  const pageRefs=[];

  objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
  for(let i=0;i<pageCount;i++){
    const pageObj=3+i*2,contentObj=pageObj+1;
    pageRefs.push(`${pageObj} 0 R`);
    objects[pageObj]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${contentObj} 0 R >>`;
    const stream=pageStreams[i];
    objects[contentObj]=`<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
  }
  objects[2]=`<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageCount} >>`;
  objects[font1]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[font2]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  let pdf='%PDF-1.4\n';
  const offsets=[0];
  for(let i=1;i<objects.length;i++){
    if(!objects[i])continue;
    offsets[i]=pdf.length;
    pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref=pdf.length;
  pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for(let i=1;i<objects.length;i++){
    const off=offsets[i]||0;
    pdf+=`${String(off).padStart(10,'0')} 00000 n \n`;
  }
  pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([pdf],{type:'application/pdf'});
}

async function shareInvoicePDF(id){
  const sourceId=id||document.getElementById('invoicePreviewSource')?.value||document.getElementById('invoiceId')?.value||'';
  const inv=data.invoices.find(x=>x.id===sourceId);
  if(!inv)return toast('Rechnung nicht gefunden');
  if(inv.status==='draft')return toast('Rechnung zuerst ausstellen, dann teilen');

  const customer=data.customers.find(x=>x.id===inv.customerId)||{};
  const blob=invoicePdfBlob(inv);
  const filename=safePdfFilename(inv);
  const message=`Rechnung ${inv.number} von ${data.settings.companyName||'unserem Betrieb'} ueber ${pdfMoney(inv.total)}.`;

  try{
    if(typeof File!=='undefined'&&navigator.share){
      const file=new File([blob],filename,{type:'application/pdf'});
      const canFileShare=!navigator.canShare||navigator.canShare({files:[file]});
      if(canFileShare){
        await navigator.share({
          title:`Rechnung ${inv.number}`,
          text:message,
          files:[file]
        });
        return;
      }
    }
  }catch(e){
    if(e?.name==='AbortError')return;
    console.warn('PDF share failed',e);
  }

  // Fallback for browsers without file sharing.
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);

  if(customer.email){
    const openMail=await appConfirm({
      title:'PDF gespeichert',
      text:`Direktes PDF-Teilen wird von diesem Browser nicht unterstützt. E-Mail an ${customer.email} öffnen? Die PDF muss dort ggf. manuell angehängt werden.`,
      confirmLabel:'E-Mail öffnen',
      icon:'✉️'
    });
    if(openMail){
      location.href=`mailto:${encodeURIComponent(customer.email)}?subject=${encodeURIComponent(`Rechnung ${inv.number}`)}&body=${encodeURIComponent(message)}`;
      return;
    }
  }
  toast('PDF gespeichert');
}
globalThis.shareInvoicePDF=shareInvoicePDF;



function editCatalog(id){openCatalogEditor(id)}

function loadSettingsForm(){const s=data.settings;document.getElementById('companyName').value=s.companyName||'';document.getElementById('ownerName').value=s.ownerName||'';document.getElementById('companyPhone').value=s.phone||'';document.getElementById('companyAddress').value=s.address||'';document.getElementById('weatherLocation').value=s.weatherLocation||s.address||'';document.getElementById('companyEmail').value=s.email||'';document.getElementById('taxMode').value=String(s.tax||0);document.getElementById('paymentTerm').value=s.paymentTerm||'';document.getElementById('taxNumber').value=s.taxNumber||'';document.getElementById('vatId').value=s.vatId||'';document.getElementById('iban').value=s.iban||'';document.getElementById('bankName').value=s.bankName||''}
function saveSettings(){data.settings={...data.settings,companyName:document.getElementById('companyName').value.trim(),ownerName:document.getElementById('ownerName').value.trim(),phone:document.getElementById('companyPhone').value.trim(),address:document.getElementById('companyAddress').value.trim(),weatherLocation:document.getElementById('weatherLocation').value.trim(),email:document.getElementById('companyEmail').value.trim(),tax:Number(document.getElementById('taxMode').value),paymentTerm:document.getElementById('paymentTerm').value.trim(),taxNumber:document.getElementById('taxNumber').value.trim(),vatId:document.getElementById('vatId').value.trim(),iban:document.getElementById('iban').value.trim(),bankName:document.getElementById('bankName').value.trim()};localStorage.removeItem(WEATHER_CACHE_KEY);saveData();refreshWeather(true);toast('Betrieb gespeichert')}

const WEATHER_FETCH_TIMEOUT_MS=12000;
async function weatherFetch(url,timeoutMs=WEATHER_FETCH_TIMEOUT_MS){
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  let timer;
  try{
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{try{controller?.abort()}catch(e){}reject(new Error('Wetterdienst antwortet gerade nicht. Bitte erneut versuchen.'))},timeoutMs)});
    const request=fetch(url,controller?{signal:controller.signal}:undefined);
    return await Promise.race([request,timeout]);
  }catch(e){
    if(e?.name==='AbortError')throw new Error('Wetterdienst antwortet gerade nicht. Bitte erneut versuchen.');
    throw e;
  }finally{clearTimeout(timer)}
}

const weatherCodes={0:['Klar','☀️'],1:['Überwiegend klar','🌤️'],2:['Teilweise bewölkt','⛅'],3:['Bewölkt','☁️'],45:['Nebel','🌫️'],48:['Reifnebel','🌫️'],51:['Leichter Nieselregen','🌦️'],53:['Nieselregen','🌦️'],55:['Starker Nieselregen','🌧️'],61:['Leichter Regen','🌦️'],63:['Regen','🌧️'],65:['Starker Regen','🌧️'],71:['Leichter Schnee','🌨️'],73:['Schnee','🌨️'],75:['Starker Schnee','❄️'],80:['Leichte Schauer','🌦️'],81:['Schauer','🌧️'],82:['Starke Schauer','⛈️'],95:['Gewitter','⛈️'],96:['Gewitter mit Hagel','⛈️'],99:['Starkes Gewitter','⛈️']};
function weatherText(code){return weatherCodes[code]||['Wechselhaft','🌦️']}
function weatherRisk(day){const reasons=[];if((day.precipProbability||0)>=60)reasons.push(`${Math.round(day.precipProbability)} % Regenrisiko`);if((day.precipitation||0)>=5)reasons.push(`${Number(day.precipitation).toFixed(1)} mm Niederschlag`);if((day.gust||0)>=50)reasons.push(`Böen bis ${Math.round(day.gust)} km/h`);if((day.minTemp??99)<=2)reasons.push(`Tiefstwert ${Math.round(day.minTemp)} °C`);if((day.maxTemp??0)>=32)reasons.push(`Hitze bis ${Math.round(day.maxTemp)} °C`);return reasons}
function weatherPlaceCandidates(place){
  const raw=String(place||'').trim().replace(/\s+/g,' ');
  if(!raw)return [];
  const out=[];
  const add=v=>{v=String(v||'').trim().replace(/^[,;]+|[,;]+$/g,'');if(v&&!out.some(x=>x.toLowerCase()===v.toLowerCase()))out.push(v)};

  // Firmenadressen wie "Tannenstr. 10a, 85579 Neubiberg" sind für eine
  // Orts-Geocoding-API oft zu detailliert. Daher Stadt/Postleitzahl zuerst.
  const postal=raw.match(/\b(\d{5})\s+([^,;]+)/);
  if(postal){
    const city=postal[2]
      .replace(/\b(?:Deutschland|Germany)\b.*$/i,'')
      .trim();
    add(city);
    add(`${postal[1]} ${city}`);
    add(postal[1]);
  }

  const commaParts=raw.split(',').map(x=>x.trim()).filter(Boolean);
  if(commaParts.length>1){
    const last=commaParts[commaParts.length-1]
      .replace(/\b(?:Deutschland|Germany)\b/ig,'')
      .trim();
    add(last.replace(/^\d{5}\s+/,''));
    add(last);
  }

  // Wenn nur "Ort" eingegeben wurde, bleibt das natürlich der erste Kandidat.
  add(raw);
  return out;
}
async function geocodeWeatherPlace(place){
  const candidates=weatherPlaceCandidates(place);
  if(!candidates.length)throw new Error('Bitte einen Ort eingeben.');

  let serviceReached=false;
  for(const candidate of candidates){
    const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate)}&count=5&language=de&format=json`;
    const r=await weatherFetch(url);
    if(!r.ok)continue;
    serviceReached=true;
    const j=await r.json();
    if(j.results?.length){
      let x=j.results[0];
      // Bei PLZ + Ort bevorzugen wir einen exakten Ortsnamen, falls vorhanden.
      const wanted=candidate.replace(/^\d{5}\s+/,'').trim().toLowerCase();
      const exact=j.results.find(y=>String(y.name||'').toLowerCase()===wanted);
      if(exact)x=exact;
      return{
        latitude:x.latitude,
        longitude:x.longitude,
        label:[x.name,x.admin1,x.country_code].filter(Boolean).join(', '),
        query:candidate
      };
    }
  }
  if(!serviceReached)throw new Error('Ortssuche ist gerade nicht erreichbar.');
  throw new Error('Ort nicht gefunden. Bitte nur Ort oder PLZ + Ort eingeben.');
}
async function fetchWeather(lat,lon,label){const current='temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation';const daily='weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max';const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${current}&daily=${daily}&timezone=auto&forecast_days=7`;const r=await weatherFetch(url);if(!r.ok)throw new Error('Wetterdienst nicht erreichbar.');const j=await r.json();const days=j.daily.time.map((date,i)=>({date,code:j.daily.weather_code[i],maxTemp:j.daily.temperature_2m_max[i],minTemp:j.daily.temperature_2m_min[i],precipitation:j.daily.precipitation_sum[i],precipProbability:j.daily.precipitation_probability_max[i],gust:j.daily.wind_gusts_10m_max[i]}));return{label,lat,lon,current:j.current,days,fetchedAt:Date.now()}}
function selectedWeatherDay(w,date){return w.days.find(x=>x.date===date)||w.days[0]}
function renderWeatherData(w,date=todayISO()){
 const c=w.current||{},desc=weatherText(c.weather_code),day=selectedWeatherDay(w,date),risk=weatherRisk(day);
 const riskText=risk.length?`⚠️ Wetterrisiko für ${dateDE(day.date)}: ${risk.join(' · ')}. Termin und Arbeitsart bitte prüfen.`:`✓ Für ${dateDE(day.date)} sind in der Vorschau keine starken Wetterrisiken erkannt.`;
 const riskClass=risk.length?'riskBox':'riskBox okRisk';
 document.getElementById('weatherLocationLabel').textContent=w.label;document.getElementById('weatherTemp').textContent=`${Math.round(c.temperature_2m)}°`;document.getElementById('weatherDescription').textContent=desc[0];document.getElementById('weatherIcon').textContent=desc[1];document.getElementById('weatherMeta').innerHTML=`<span class="pill">Gefühlt ${Math.round(c.apparent_temperature)}°</span><span class="pill">Wind ${Math.round(c.wind_speed_10m)} km/h</span><span class="pill">Böen ${Math.round(c.wind_gusts_10m)} km/h</span>`;const dr=document.getElementById('weatherRisk');dr.className=riskClass;dr.textContent=riskText;
 document.getElementById('weatherPageLocation').textContent=w.label;document.getElementById('weatherPageTemp').textContent=`${Math.round(c.temperature_2m)}°`;document.getElementById('weatherPageDescription').textContent=desc[0];document.getElementById('weatherPageIcon').textContent=desc[1];document.getElementById('weatherPageMeta').innerHTML=`<span class="pill">Gefühlt ${Math.round(c.apparent_temperature)}°</span><span class="pill">Wind ${Math.round(c.wind_speed_10m)} km/h</span><span class="pill">Heute ${Number(c.precipitation||0).toFixed(1)} mm</span>`;const pr=document.getElementById('weatherPageRisk');pr.className=riskClass;pr.textContent=riskText;
 document.getElementById('weatherForecast').innerHTML=w.days.map(d=>{const t=weatherText(d.code),rr=weatherRisk(d);return `<div class="forecastDay" title="${escapeHTML(rr.join(', ')||'Kein starkes Risiko erkannt')}"><strong>${new Date(d.date+'T12:00').toLocaleDateString('de-DE',{weekday:'short'})}</strong><div style="font-size:25px;margin:6px 0">${t[1]}</div><b>${Math.round(d.maxTemp)}° / ${Math.round(d.minTemp)}°</b><span>💧 ${Math.round(d.precipProbability||0)} %</span><span>💨 ${Math.round(d.gust||0)} km/h</span>${rr.length?'<span style="color:var(--warn);font-weight:900">⚠ prüfen</span>':'<span style="color:var(--ok)">✓ ruhig</span>'}</div>`}).join('');
 document.getElementById('weatherSearch').value=w.label;document.getElementById('weatherDate').value=date;
}
function renderWeatherError(msg){document.getElementById('weatherRisk').className='riskBox';document.getElementById('weatherRisk').textContent=msg;document.getElementById('weatherPageRisk').className='riskBox';document.getElementById('weatherPageRisk').textContent=msg}
function renderCachedWeather(){if(!data.privacy?.consents?.weather){renderWeatherError('Wetter ist aus Datenschutzgründen deaktiviert. Unter Mehr → Datenschutz kannst du es erlauben.');return}try{const c=JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)||'null');if(c?.data){renderWeatherData(c.data,document.getElementById('weatherDate')?.value||todayISO());if(Date.now()-c.savedAt<30*60*1000)return}}catch(e){}if(!window.weatherLoading)refreshWeather(false)}
async function refreshWeather(force=false){
  const place=(data.settings.weatherLocation||data.settings.address||'').trim();
  // Bei einem frischen Konto erst warten, bis der Betrieb/die Adresse geladen ist.
  if(!place){
    renderWeatherError(force
      ?'Bitte unter Betrieb eine Firmenadresse oder einen Wetter-Standort eintragen.'
      :'Wetter wartet noch auf den Betriebsstandort.');
    const loc=document.getElementById('weatherLocationLabel');if(loc)loc.textContent='Standort noch nicht geladen';
    return;
  }
  if(!data.privacy?.consents?.weather){
    const ok=await appConfirm({title:'Wetterdienst verwenden?',text:'Für die Wetterabfrage wird dein Wetter-Ort an Open-Meteo übertragen.',confirmLabel:'Erlauben',icon:'🌦️'});
    if(ok){
      data.privacy.consents.weather=true;
      data.privacy.acceptedAt=new Date().toISOString();
      saveData('Einwilligung geändert','Wetterdienst erlaubt');
    }else return;
  }
  if(window.weatherLoading)return;
  try{
    window.weatherLoading=true;
    document.getElementById('weatherRisk').textContent='Wetterdaten werden geladen …';
    const geo=await geocodeWeatherPlace(place);
    const w=await fetchWeather(geo.latitude,geo.longitude,geo.label);
    localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify({savedAt:Date.now(),data:w}));
    renderWeatherData(w,todayISO());
  }catch(e){
    renderWeatherError(e.message||'Wetter konnte nicht geladen werden.');
  }finally{
    window.weatherLoading=false;
  }
}
async function loadWeatherFromForm(){
  const place=document.getElementById('weatherSearch').value.trim();
  const date=document.getElementById('weatherDate').value||todayISO();
  if(!data.privacy?.consents?.weather){
    const ok=await appConfirm({title:'Wetterdienst verwenden?',text:'Für die Wetterabfrage wird dein eingegebener Ort an Open-Meteo übertragen.',confirmLabel:'Erlauben',icon:'🌦️'});
    if(!ok)return;
    data.privacy.consents.weather=true;
    data.privacy.acceptedAt=new Date().toISOString();
    saveData('Einwilligung geändert','Wetterdienst erlaubt');
  }
  try{
    document.getElementById('weatherPageRisk').textContent='Wetterdaten werden geladen …';
    const geo=await geocodeWeatherPlace(place);
    const w=await fetchWeather(geo.latitude,geo.longitude,geo.label);
    localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify({savedAt:Date.now(),data:w}));
    renderWeatherData(w,date);
  }catch(e){
    renderWeatherError(e.message||'Wetter konnte nicht geladen werden.');
  }
}
async function useDeviceLocation(){
  if(!data.privacy?.consents?.weather){
    const weatherOk=await appConfirm({title:'Wetterdienst verwenden?',text:'Für die Wetterabfrage werden die Standort-Koordinaten an Open-Meteo übertragen.',confirmLabel:'Erlauben',icon:'🌦️'});
    if(!weatherOk)return;
    data.privacy.consents.weather=true;
    data.privacy.acceptedAt=new Date().toISOString();
    saveData('Einwilligung geändert','Wetterdienst erlaubt');
  }
  if(!data.privacy?.consents?.location){
    const ok=await appConfirm({title:'Standort verwenden?',text:'AngebotsPilot fragt deinen aktuellen Gerätestandort nur für diese Wetterabfrage ab.',confirmLabel:'Standort erlauben',icon:'📍'});
    if(!ok)return;
    data.privacy.consents.location=true;
    data.privacy.acceptedAt=new Date().toISOString();
    saveData('Einwilligung geändert','Standort erlaubt');
  }
  if(!navigator.geolocation){
    renderWeatherError('Dieses Gerät stellt der App keinen Standort zur Verfügung.');
    return;
  }

  const btnText='Standort wird ermittelt …';
  document.getElementById('weatherPageRisk').textContent=btnText;

  navigator.geolocation.getCurrentPosition(
    async p=>{
      try{
        const w=await fetchWeather(p.coords.latitude,p.coords.longitude,'Aktueller Standort');
        localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify({savedAt:Date.now(),data:w}));
        renderWeatherData(w,document.getElementById('weatherDate').value||todayISO());
      }catch(e){
        renderWeatherError(e.message||'Wetter für deinen Standort konnte nicht geladen werden.');
      }
    },
    err=>{
      let msg='Standort konnte nicht ermittelt werden.';
      if(err?.code===1)msg='Standortzugriff wurde vom iPhone/Safari nicht erlaubt. Bitte den Standortzugriff für diese Website in Safari erlauben.';
      if(err?.code===2)msg='Das iPhone konnte gerade keinen Standort bestimmen. Bitte kurz warten oder den Ort manuell eingeben.';
      if(err?.code===3)msg='Die Standortabfrage hat zu lange gedauert. Bitte erneut versuchen oder den Ort manuell eingeben.';
      renderWeatherError(msg);
    },
    {enableHighAccuracy:true,timeout:15000,maximumAge:300000}
  );
}
function openJobWeather(id){const j=data.jobs.find(x=>x.id===id);if(!j)return;showScreen('weather');document.getElementById('weatherSearch').value=j.address||data.settings.weatherLocation||data.settings.address;document.getElementById('weatherDate').value=j.start||todayISO();loadWeatherFromForm()}


function updateConsent(type,value){data.privacy=data.privacy||structuredClone(defaultData.privacy);data.privacy.consents[type]=!!value;data.privacy.version=PRIVACY_VERSION;data.privacy.acceptedAt=new Date().toISOString();if(type==='weather'&&!value)localStorage.removeItem(WEATHER_CACHE_KEY);saveData('Einwilligung geändert',`${type}: ${value?'erteilt':'widerrufen'}`);toast(value?'Einwilligung gespeichert':'Einwilligung widerrufen')}
function setRole(role){data.privacy.role=role;saveData('Rolle geändert',role);toast('Rolle gespeichert')}
function roleText(role){return({owner:'Chef / Inhaber: Vollzugriff auf Betrieb, Preise, Kunden und Dokumente.',office:'Büro: vorgesehen für Kunden, Angebote, Kalender und Rechnungen.',worker:'Mitarbeiter: vorgesehen für zugewiesene Baustellen, Fotos und Zeiten – ohne Preisänderungen.'})[role]||''}
function renderPrivacy(){if(!data.privacy)data.privacy=structuredClone(defaultData.privacy);const c=data.privacy.consents||{};['Weather','Location','External','Analytics'].forEach(k=>{const e=document.getElementById('consent'+k);if(e)e.checked=!!c[k.toLowerCase()]});const role=document.getElementById('currentRole');if(role)role.value=data.privacy.role||'owner';const rd=document.getElementById('roleDescription');if(rd)rd.textContent=roleText(data.privacy.role||'owner');const log=document.getElementById('auditLog');if(log)log.innerHTML=(data.audit||[]).length?(data.audit||[]).map(x=>`<div class="auditRow"><b>${escapeHTML(x.action)}</b><div class="mini">${new Date(x.at).toLocaleString('de-DE')}${x.details?' · '+escapeHTML(x.details):''}</div></div>`).join(''):'<div class="empty">Noch keine protokollierten Änderungen.</div>'}
function exportPrivacyData(){const copy={exportedAt:new Date().toISOString(),privacyVersion:PRIVACY_VERSION,meta:data.meta||{},company:data.settings,users:data.users||[],customers:data.customers,offers:data.offers,events:data.events,tasks:data.tasks,jobs:data.jobs,invoices:data.invoices,consents:data.privacy?.consents||{},audit:data.audit||[]};downloadBlob(JSON.stringify(copy,null,2),'meine-daten-angebotspilot.json','application/json');addAudit('Datenkopie exportiert');persistAppState();renderPrivacy()}
function resetAppPrivacy(){openDeleteDataModal()}

const legalDocs={
privacyPolicy:`DATENSCHUTZHINWEIS – TECHNISCHER ENTWURF\n\nVerantwortlicher\n[Unternehmensname, vollständige Anschrift, E-Mail, Telefon ergänzen]\n\nLokale Verarbeitung\nDie aktuelle Testversion speichert Firmendaten, Kundendaten, Angebote, Termine, Aufgaben und Baustellen ausschließlich im lokalen Browser-Speicher des verwendeten Geräts. Es besteht derzeit kein zentrales Benutzerkonto und keine automatische Cloud-Sicherung.\n\nWetterdienst\nNur nach Einwilligung wird der eingegebene Ort bzw. eine Baustellenadresse an Open-Meteo übertragen, um Wetterdaten abzurufen. Der Gerätestandort wird nur nach einer separaten Aktion und Browserfreigabe verwendet.\n\nExterne Dienste\nBeim bewussten Öffnen von Google Maps, Google Kalender oder WhatsApp können die ausgewählten Daten an den jeweiligen Anbieter übertragen werden. Vor der ersten Nutzung wird eine Einwilligung eingeholt.\n\nSpeicherdauer und Löschung\nDie Daten bleiben im Browser gespeichert, bis sie durch den Nutzer, den Browser oder die Funktion „Alle App-Daten löschen“ entfernt werden. Eine Datenkopie kann als JSON exportiert werden.\n\nBetroffenenrechte\nBei der späteren Cloud-Version werden Prozesse für Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch vorgesehen.\n\nHinweis\nDieser Text muss vor einem kommerziellen Start an die tatsächlichen Dienste, Rechtsgrundlagen, Auftragsverarbeiter und Kontaktdaten angepasst und rechtlich geprüft werden.`,
imprint:`IMPRESSUM – ENTWURF\n\nAngaben gemäß § 5 DDG\n${data.settings.companyName||'[Firmenname]'}\n${data.settings.ownerName||'[Vertretungsberechtigte Person]'}\n${data.settings.address||'[Vollständige Anschrift]'}\n\nKontakt\nTelefon: ${data.settings.phone||'[Telefon]'}\nE-Mail: ${data.settings.email||'[E-Mail]'}\n\nWeitere Pflichtangaben\n[Rechtsform, Register, Registernummer, Umsatzsteuer-ID, zuständige Kammer oder Berufsangaben ergänzen, soweit zutreffend.]\n\nVerantwortlich für Inhalte\n[Name und Anschrift ergänzen.]`,
terms:`NUTZUNGSBEDINGUNGEN – ENTWURF\n\n1. Zweck\nAngebotsPilot unterstützt Betriebe bei der Organisation von Kunden, Angeboten, Terminen, Aufgaben und Baustellen.\n\n2. Eigenverantwortliche Prüfung\nAlle Preise, Berechnungen, Texte, Wetterhinweise und Dokumente müssen vor Nutzung oder Versand durch den Betrieb geprüft werden. Die App ersetzt keine steuerliche, rechtliche, technische oder sicherheitsbezogene Beratung.\n\n3. Datensicherung\nIn der Offline-Testversion ist der Nutzer selbst für regelmäßige Backups verantwortlich. Browserdaten können durch Gerätewechsel, Zurücksetzen oder Browserbereinigung verloren gehen.\n\n4. Wetter\nWetterinformationen sind nur Planungshilfen. Für sicherheitskritische Arbeiten sind amtliche Warnungen und die Bedingungen vor Ort maßgeblich.\n\n5. Verfügbarkeit\nFür die Testversion wird keine ununterbrochene Verfügbarkeit oder Fehlerfreiheit garantiert.`,
architecture:`DATENSCHUTZ- UND SICHERHEITSARCHITEKTUR\n\nJETZIGE OFFLINE-VERSION\n• Lokale Speicherung im Browser\n• Keine zentrale Nutzerverwaltung\n• Keine KI-Übertragung\n• Wetter nur nach Einwilligung\n• Standort nur auf Nutzeraktion\n• Externe Apps nur nach Hinweis\n• Datenexport und vollständige Löschung\n• Lokales Änderungsprotokoll\n\nSPÄTERE CLOUD-VERSION\n• Getrennte Mandanten pro Betrieb\n• Serverseitig erzwungene Rollen: Inhaber, Büro, Mitarbeiter\n• Datenbankregeln, sodass kein Betrieb fremde Daten lesen kann\n• Verschlüsselte Übertragung per HTTPS\n• Verschlüsselte Backups und Wiederherstellungstests\n• Mehrfaktor-Authentifizierung für Inhaber\n• Protokollierung sicherheitsrelevanter Aktionen\n• Lösch- und Aufbewahrungskonzept\n• Verträge zur Auftragsverarbeitung mit Dienstleistern\n• EU/EWR-Hosting nach dokumentierter Prüfung\n• Geheimnisse nur serverseitig, niemals in App oder GitHub\n• KI nur nach Aktivierung, Datenminimierung und möglichst Pseudonymisierung\n• Regelmäßige Updates, Abhängigkeitsprüfungen und Sicherheits-Tests\n\nAPP-BERECHTIGUNGEN\n• Kamera: erst bei Fotoaufnahme\n• Mikrofon: erst bei Spracheingabe\n• Standort: erst bei Navigation/Wetter auf Nutzeraktion\n• Benachrichtigungen: erst nach verständlicher Erklärung\n• Kontakte: nicht vorgesehen\n\nVor Store-Veröffentlichung sind eine Datenschutz-Folgenprüfung je nach Funktionsumfang, ein Verzeichnis der Verarbeitungstätigkeiten, Löschfristen, Incident-Prozess und rechtliche Prüfung zu klären.`};
function openLegal(type){document.getElementById('legalTitle').textContent=({privacyPolicy:'Datenschutzhinweis',imprint:'Impressum',terms:'Nutzungsbedingungen',architecture:'Sicherheitsplan'})[type]||'Dokument';document.getElementById('legalContent').textContent=legalDocs[type]||'';showScreen('legal')}

function downloadBlob(content,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

function backendReadinessCheck(){return AppRepository.diagnostics(data)}

function exportBackup(){downloadBlob(JSON.stringify(data,null,2),'angebotspilot-backup.json','application/json')}
function importBackup(ev){const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{data=JSON.parse(r.result);globalThis.data=data;saveData();toast('Backup importiert')}catch(e){toast('Ungültiges Backup')}};r.readAsText(f)}
function resetApp(){resetAppPrivacy()}
document.getElementById('weatherDate').value=todayISO();


function workspaceKeyFor(companyId,userId){
  return `angebotspilot_workspace_${String(companyId||'none')}_${String(userId||'none')}`;
}
function cloneAppValue(value){
  try{return structuredClone(value)}
  catch(e){
    try{return JSON.parse(JSON.stringify(value))}
    catch(e2){return value}
  }
}
function safeLocalWrite(key,value){
  try{
    const raw=typeof value==='string'?value:JSON.stringify(value);
    localStorage.setItem(key,raw);
    return true;
  }catch(e){
    console.warn('Lokaler Speicher konnte nicht geschrieben werden',key,e);
    return false;
  }
}
function freshWorkspaceForRole(userId,companyId,role){
  let fresh=cloneAppValue(defaultData);
  if(!fresh||typeof fresh!=='object')fresh={settings:{},privacy:{},meta:{},customers:[],offers:[],events:[],tasks:[],jobs:[],invoices:[],catalog:[]};

  try{AppRepository.prepare(fresh,{})}
  catch(e){
    console.warn('Repository-Vorbereitung übersprungen',e);
    fresh.meta=fresh.meta||{};
  }

  fresh.meta=fresh.meta||{};
  fresh.meta.authUserId=userId;
  fresh.meta.cloudCompanyId=companyId;
  fresh.meta.storageMode='cloud-sync';

  fresh.privacy=fresh.privacy||cloneAppValue(defaultData?.privacy||{})||{};
  fresh.privacy.role=role||'worker';

  ['customers','offers','events','tasks','jobs','invoices','catalog'].forEach(k=>{
    if(!Array.isArray(fresh[k]))fresh[k]=[];
  });
  fresh.settings=fresh.settings||{};
  return fresh;
}
function activateEmergencyCloudWorkspace(userId,companyId,role){
  // Nur In-Memory-Fallback. Er verhindert, dass lokaler Browser-Speicher
  // den sicheren Cloud-Login blockiert.
  data=freshWorkspaceForRole(userId,companyId,role);
  globalThis.data=data;
  try{applyRoleUI()}catch(e){}
  return data;
}
globalThis.activateEmergencyCloudWorkspace=activateEmergencyCloudWorkspace;

function ensureWorkspaceForCloudAccount(userId,companyId,role,options={}){
  try{
    const oldUser=data?.meta?.authUserId||'';
    const oldCompany=data?.meta?.cloudCompanyId||'';

    if(oldUser===userId&&oldCompany===companyId){
      data.privacy=data.privacy||{};
      data.privacy.role=role||data.privacy.role||'worker';
      globalThis.data=data;
      safeLocalWrite(KEY,data);
      try{applyRoleUI()}catch(e){}
      return data;
    }

    // Vorherigen Stand nur als Komfort-Cache sichern. Wenn Safari dafür
    // keinen Platz mehr hat, darf der Kontowechsel trotzdem weitergehen.
    if(oldUser||oldCompany){
      safeLocalWrite(workspaceKeyFor(oldCompany,oldUser),data);
    }

    let target=null;
    if(!options.forceFresh){
      try{
        const raw=localStorage.getItem(workspaceKeyFor(companyId,userId));
        if(raw)target=JSON.parse(raw);
      }catch(e){
        console.warn('Gespeicherter Workspace konnte nicht gelesen werden',e);
        target=null;
      }
    }

    data=target&&typeof target==='object'
      ?target
      :freshWorkspaceForRole(userId,companyId,role);

    data.meta=data.meta||{};
    data.meta.authUserId=userId;
    data.meta.cloudCompanyId=companyId;
    data.meta.storageMode='cloud-sync';
    data.privacy=data.privacy||cloneAppValue(defaultData?.privacy||{})||{};
    data.privacy.role=role||'worker';
    globalThis.data=data;

    safeLocalWrite(KEY,data);

    try{
      renderAll();
    }catch(renderError){
      console.error('Workspace konnte beim Login nicht vollständig gerendert werden',renderError);
      try{applyRoleUI()}catch(e){}
    }
    return data;
  }catch(e){
    console.error('Workspace-Wechsel fehlgeschlagen – In-Memory-Fallback aktiv',e);
    return activateEmergencyCloudWorkspace(userId,companyId,role);
  }
}
globalThis.ensureWorkspaceForCloudAccount=ensureWorkspaceForCloudAccount;
globalThis.safePersistCloudIdentity=function(d){return safeLocalWrite(KEY,d)};

function setLocalRole(role){
  data.privacy=data.privacy||{};data.privacy.role=role;persistAppState();applyRoleUI();renderPrivacy();toast(role==='owner'?'👑 Chef-Ansicht':role==='office'?'🗂️ Büro-Ansicht':'🛠️ Mitarbeiter-Ansicht');
}
function applyRoleUI(){
  const role=data.privacy?.role||'owner';
  document.body.dataset.role=role;

  const title=document.getElementById('realRoleTitle');
  if(title)title.textContent=role==='owner'?'👑 Chef / Inhaber':role==='office'?'🗂️ Büro':'🛠️ Mitarbeiter';

  const desc=document.getElementById('realRoleDescription');
  if(desc)desc.textContent=role==='owner'
    ?'Vollzugriff inklusive Betriebseinstellungen und Team.'
    :role==='office'
      ?'Kunden, Angebote, Rechnungen, Kalender, Aufgaben und Baustellen. Keine kritischen Betriebseinstellungen.'
      :'Dein Arbeitsbereich: zugewiesene Baustellen, Termine, Aufgaben, Navigation, Wetter, Dokumentation und Zeiterfassung.';

  const t=document.getElementById('rolePermissionText');
  if(t)t.innerHTML=role==='owner'
    ?'<b>Chef:</b> Vollzugriff auf Betrieb, Team, Kunden, Preise, Angebote, Rechnungen und Baustellen.'
    :role==='office'
      ?'<b>Büro:</b> Büro- und Auftragsbereiche. Betriebseinstellungen und Teamänderungen bleiben beim Chef.'
      :'<b>Mitarbeiter:</b> Nur Arbeitsinformationen. Keine Angebotspreise, Rechnungen oder Unternehmensumsätze.';

  const privacyRole=document.getElementById('privacyRoleName');
  if(privacyRole)privacyRole.textContent=role==='owner'?'👑 Chef / Inhaber':role==='office'?'🗂️ Büro':'🛠️ Mitarbeiter';
  const roleDesc=document.getElementById('roleDescription');
  if(roleDesc)roleDesc.textContent=role==='owner'?'Vollzugriff auf deinen Betrieb.':role==='office'?'Bürozugriff ohne kritische Kontoeinstellungen.':'Du siehst nur die Informationen, die du für deine Arbeit brauchst.';

  const primary=document.getElementById('navPrimaryWork');
  const offers=document.getElementById('navOffers');
  if(primary){
    if(role==='worker'){
      primary.dataset.screen='jobs';
      primary.innerHTML='<b>🏗️</b>Baustellen';
    }else{
      primary.dataset.screen='customers';
      primary.innerHTML='<b>👥</b>Kunden';
    }
  }
  if(offers)offers.hidden=false;
  const label=document.getElementById('cloudModeLabel');
  if(role==='worker'&&label)label.textContent='MITARBEITER · CLOUD';
  else if(role==='office'&&label)label.textContent='BÜRO · CLOUD';
  else if(role==='owner'&&label)label.textContent='DIGITALER HANDWERKER · CLOUD';

  if(role==='worker')setTimeout(()=>globalThis.TimeTracking?.refreshDashboard?.(),100);
}
globalThis.applyRoleUI=applyRoleUI;

['jobDurationValue','jobStartTime','jobStart'].forEach(id=>document.getElementById(id)?.addEventListener('input',syncJobDurationUI));
applyRoleUI();
renderAll();
setTimeout(()=>{if(shouldShowOnboarding())openOnboarding();},120);
setTimeout(()=>{
  const place=(data.settings?.weatherLocation||data.settings?.address||'').trim();
  if(place)refreshWeather(false);
},500);


(function(){
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if(standalone){
    document.documentElement.classList.add('pwa-standalone');
    document.body.classList.add('pwa-standalone');
  }
})();


window.addEventListener('pageshow',()=>{ if(!shouldShowOnboarding()) setOnboardingActive(false); });


function bindIntroButtons(){
  const appBtn=document.getElementById('startAppTourBtn');

  if(appBtn){
    appBtn.onclick=null;
    appBtn.addEventListener('click',function(e){
      e.preventDefault();e.stopPropagation();
      startProductTour(true);
    });
  }
}

/* Fallback for iOS/PWA: delegated handler survives rerenders */
document.addEventListener('click',function(e){
  const app=e.target.closest?.('#startAppTourBtn');
  if(app){e.preventDefault();startProductTour(true);}
},false);

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',bindIntroButtons,{once:true});
}else{
  bindIntroButtons();
}

