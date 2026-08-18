const KEY='digitaler_handwerker_v3';
const PRIVACY_VERSION='1.0';
const WEATHER_CACHE_KEY='dh_weather_cache_v1';
const defaultData={settings:{companyName:'Facility & Care',ownerName:'',phone:'',email:'',address:'Neubiberg',weatherLocation:'Neubiberg',tax:0,paymentTerm:'7 Tage',taxNumber:'',vatId:'',iban:'',bankName:''},privacy:{version:PRIVACY_VERSION,consents:{weather:false,location:false,external:false,analytics:false},role:'owner',acceptedAt:null},audit:[],customers:[],offers:[],events:[],tasks:[],jobs:[],invoices:[],catalog:[{id:uid(),name:'Gartenarbeit / Fachkraft',unit:'Std.',price:55,type:'service',trade:'garden'},{id:uid(),name:'Anfahrt',unit:'Pauschale',price:50,type:'service',trade:'garden'},{id:uid(),name:'Rasen mähen und Pflege',unit:'Std.',price:55,type:'service',trade:'garden'},{id:uid(),name:'Hecken- und Strauchschnitt',unit:'Std.',price:55,type:'service',trade:'garden'},{id:uid(),name:'Rollrasen verlegen',unit:'m²',price:18,type:'service',trade:'garden'},{id:uid(),name:'Humus / Mutterboden',unit:'m³',price:65,type:'material',trade:'garden'},{id:uid(),name:'Entsorgung Grünabfall',unit:'Pauschale',price:120,type:'service',trade:'garden'}]};

// v9.7 FIX: onboarding/product-tour state and trade catalogs
let onboardingStep=0;
let onboardingTrade='';
let onboardingTax=0;
let catalogFilter='all';

const TRADE_CATALOGS={
  garden:{name:'Garten & Landschaft',desc:'GaLaBau & Gartenpflege',icon:'🌿',items:[
    ['service','Gartenarbeit / Fachkraft','Std.'],['service','Rasen mähen und Pflege','m²'],['service','Rasen vertikutieren','m²'],['service','Rasen fräsen','m²'],['service','Hecke schneiden','m'],['service','Beetpflege','Std.'],['service','Pflanzarbeiten','Std.'],['service','Pflaster verlegen','m²'],['service','Terrassenreinigung','m²'],['service','Grünabfall entsorgen','Pauschale'],['service','Anfahrt','Pauschale'],
    ['material','Humus / Mutterboden','m³'],['material','Rasensaat','kg'],['material','Rasendünger','kg'],['material','Rollrasen','m²'],['material','Rindenmulch','l'],['material','Kies / Splitt','t']
  ]},
  caretaker:{name:'Hausmeisterservice',desc:'Objektpflege & Kleinreparaturen',icon:'🧰',items:[['service','Hausmeister / Fachkraft','Std.'],['service','Objektkontrolle','Pauschale'],['service','Kleinreparatur','Std.'],['service','Winterdienst','Std.'],['service','Anfahrt','Pauschale'],['material','Kleinmaterial','Pauschale']]},
  cleaning:{name:'Gebäudereinigung',desc:'Unterhalt & Grundreinigung',icon:'✨',items:[['service','Unterhaltsreinigung','Std.'],['service','Grundreinigung','m²'],['service','Fensterreinigung','m²'],['service','Treppenhausreinigung','Pauschale'],['service','Anfahrt','Pauschale'],['material','Reinigungsmittel','Pauschale']]},
  painter:{name:'Maler & Lackierer',desc:'Innen & Außen',icon:'🎨',items:[['service','Malerarbeiten','m²'],['service','Spachtelarbeiten','m²'],['service','Lackierarbeiten','Std.'],['service','Anfahrt','Pauschale'],['material','Wandfarbe','l'],['material','Spachtelmasse','kg']]},
  tiler:{name:'Fliesenleger',desc:'Fliesen & Naturstein',icon:'◻️',items:[['service','Fliesen verlegen','m²'],['service','Altbelag entfernen','m²'],['service','Verfugen','m²'],['service','Anfahrt','Pauschale'],['material','Fliesen','m²'],['material','Fliesenkleber','kg']]},
  drywall:{name:'Trockenbau',desc:'Wände, Decken & Dämmung',icon:'🧱',items:[['service','Trockenbau Montage','m²'],['service','Spachteln','m²'],['service','Anfahrt','Pauschale'],['material','Gipskartonplatte','m²'],['material','Dämmung','m²'],['material','Profile','m']]},
  electrical:{name:'Elektro',desc:'Installation & Service',icon:'⚡',items:[['service','Elektriker / Fachkraft','Std.'],['service','Montage Steckdose / Schalter','Stk.'],['service','Anfahrt','Pauschale'],['material','Kabel','m'],['material','Steckdose / Schalter','Stk.']]},
  plumbing:{name:'Sanitär & Heizung',desc:'SHK & Kundendienst',icon:'🚿',items:[['service','SHK / Fachkraft','Std.'],['service','Wartung / Kundendienst','Std.'],['service','Anfahrt','Pauschale'],['material','Rohr / Leitung','m'],['material','Fitting / Kleinmaterial','Pauschale']]},
  roofing:{name:'Dachdecker',desc:'Dach & Abdichtung',icon:'🏠',items:[['service','Dachdecker / Fachkraft','Std.'],['service','Abdichtungsarbeiten','m²'],['service','Anfahrt','Pauschale'],['material','Dachbahn','m²'],['material','Dämmstoff','m²']]}
};

function shouldShowOnboarding(){return localStorage.getItem('dh_onboarding_v8_done')!=='1'}



let positionPickerType='all',positionPickerCategory='all';
function getPositionCategory(x){const n=String(x.name||'').toLowerCase();if((x.type||'service')==='material'){if(/rasen|dünger|saat/.test(n))return'Rasen';if(/erde|humus|boden|schotter|kies|splitt/.test(n))return'Boden & Schüttgut';if(/pflanz|stauden|baum|strauch/.test(n))return'Pflanzen';if(/pflaster|stein|randstein|fliese/.test(n))return'Beläge';return'Material'}if(/anfahrt|fahrt/.test(n))return'Anfahrt';if(/stunde|fachkraft|helfer|arbeits/.test(n))return'Arbeitszeit';if(/rasen|hecke|beet|pflege|schnitt/.test(n))return'Pflege';if(/entsorg/.test(n))return'Entsorgung';if(/pflaster|verleg|montier|reinigung|streichen|spachtel|abdicht/.test(n))return'Ausführung';return'Leistungen'}
function openPositionPicker(){positionPickerType='all';positionPickerCategory='all';const s=document.getElementById('positionSearch');if(s)s.value='';document.querySelectorAll('[data-pickertype]').forEach(x=>x.classList.toggle('active',x.dataset.pickertype==='all'));document.getElementById('positionPicker').classList.remove('hidden');renderPositionPicker()}
function closePositionPicker(e){if(e&&e.target!==document.getElementById('positionPicker'))return;document.getElementById('positionPicker').classList.add('hidden')}
function setPositionPickerType(t,el){positionPickerType=t;positionPickerCategory='all';document.querySelectorAll('[data-pickertype]').forEach(x=>x.classList.remove('active'));el.classList.add('active');renderPositionPicker()}
function setPositionCategory(c,el){positionPickerCategory=c;document.querySelectorAll('.categoryChip').forEach(x=>x.classList.remove('active'));el.classList.add('active');renderPositionPickerList()}
function pickerCatalog(){const q=(document.getElementById('positionSearch')?.value||'').trim().toLowerCase();return(data.catalog||[]).filter(x=>(positionPickerType==='all'||(x.type||'service')===positionPickerType)&&(!q||String(x.name).toLowerCase().includes(q)))}
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
    type:x.type||'service'
  });
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
  draftLines.push({name,qty:1,unit,price,type:'service'});
  renderOfferLines();
  closeQuickEdit();
  showPickerSuccess(`${name} hinzugefügt`);
}
function openOnboarding(){onboardingStep=0;setOnboardingActive(true);document.getElementById('onboarding').classList.remove('hidden');const owner=document.getElementById('onOwnerName');if(owner)owner.value=data.settings.ownerName||'';const company=document.getElementById('onCompany');if(company)company.value=data.settings.companyName||'';const loc=document.getElementById('onLocation');if(loc)loc.value=data.settings.address||'';renderTradeGrid();showOnboardingStep()}
function renderTradeGrid(){const el=document.getElementById('tradeGrid');if(!el)return;el.innerHTML=Object.entries(TRADE_CATALOGS).map(([id,t])=>`<button class="tradeCard ${onboardingTrade===id?'selected':''}" onclick="selectTrade('${id}')"><span class="tradeIcon">${t.icon}</span><span><b>${escapeHTML(t.name)}</b><small>${escapeHTML(t.desc)}</small></span></button>`).join('')}
function selectTrade(id){onboardingTrade=id;renderTradeGrid();document.getElementById('tradeNext').disabled=false}
function pickTax(v,el){onboardingTax=v;document.querySelectorAll('.choice[data-tax]').forEach(x=>x.classList.remove('active'));el.classList.add('active')}
function showOnboardingStep(){document.querySelectorAll('.onStep').forEach(x=>x.classList.add('hidden'));const step=document.querySelector(`.onStep[data-step="${onboardingStep}"]`);if(step)step.classList.remove('hidden');document.getElementById('onboardProgress').style.width=(onboardingStep/4*100)+'%';if(onboardingStep===3){const t=TRADE_CATALOGS[onboardingTrade];if(t){const m=t.items.filter(x=>x[0]==='material').length,s=t.items.filter(x=>x[0]==='service').length;document.getElementById('catalogIntro').textContent=`Für ${t.name} haben wir die wichtigsten Startpositionen vorbereitet.`;document.getElementById('catalogStats').innerHTML=`<div><span>${m}</span><small>Materialien</small></div><div><span>${s}</span><small>Leistungen</small></div>`}};const back=document.getElementById('onboardBack');const brand=document.getElementById('onboardBrand');if(back)back.classList.toggle('hidden',onboardingStep===0);if(brand)brand.classList.toggle('hidden',onboardingStep>0);}
function nextOnboarding(){if(onboardingStep===1&&!onboardingTrade)return; if(onboardingStep===2){const owner=document.getElementById('onOwnerName')?.value.trim()||'',name=document.getElementById('onCompany').value.trim(),loc=document.getElementById('onLocation').value.trim();if(!owner)return toast('Bitte deinen Vornamen eingeben');data.settings.ownerName=owner;if(name)data.settings.companyName=name;if(loc){data.settings.address=loc;data.settings.weatherLocation=loc}data.settings.tax=onboardingTax;saveData('Ersteinrichtung','Betriebsdaten gespeichert')}onboardingStep=Math.min(4,onboardingStep+1);showOnboardingStep()}
function previousOnboarding(){
  if(onboardingStep<=0)return;
  onboardingStep=Math.max(0,onboardingStep-1);
  showOnboardingStep();
}
function installTradeCatalog(){const t=TRADE_CATALOGS[onboardingTrade];if(!t)return;const existing=new Set((data.catalog||[]).map(x=>String(x.name).toLowerCase()));let added=0;t.items.forEach(([type,name,unit])=>{if(!existing.has(name.toLowerCase())){data.catalog.push({id:uid(),name,unit,price:0,type,trade:onboardingTrade,purchasePrice:0,markup:0});added++}});data.settings.trade=onboardingTrade;saveData('Branchenkatalog eingerichtet',`${t.name}: ${added} Positionen`);document.getElementById('finishCount').textContent=t.items.length;onboardingStep=4;showOnboardingStep();if(navigator.vibrate)navigator.vibrate(35)}
function skipOnboarding(){localStorage.setItem('dh_onboarding_v8_done','1');document.getElementById('onboarding').classList.add('hidden');setOnboardingActive(false);toast('Du kannst alles später unter Betrieb einrichten')}
function finishOnboarding(createOffer=true){localStorage.setItem('dh_onboarding_v8_done','1');localStorage.setItem('dh_name_setup_v10_done','1');document.getElementById('onboarding').classList.add('hidden');setOnboardingActive(false);renderAll();toast('✨ Dein Betrieb ist startklar');if(createOffer)setTimeout(()=>newOffer(),250);else showScreen('today')}
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
    if(x)Object.assign(x,{name,unit,price,type:catalogEditorType});
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
function setOfferStatusFromModal(status){
  const id=document.getElementById('statusOfferId').value;
  const o=data.offers.find(x=>x.id===id);
  if(!o)return closeOfferStatusModal();
  o.status=status;
  closeOfferStatusModal();
  saveData('Angebotsstatus geändert',`${o.number||''} · ${statusLabel(status)}`);
  toast('✓ Status geändert');
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
  localStorage.removeItem(KEY);localStorage.removeItem(WEATHER_CACHE_KEY);location.reload();
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
  document.getElementById('onboarding').classList.add('hidden');setOnboardingActive(false);renderAll();showScreen('today');
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

function repairCatalogV101(){
  data.catalog=Array.isArray(data.catalog)?data.catalog:[];
  const trade=data.settings.trade||'garden';
  const defs=TRADE_CATALOGS[trade]?.items||[];
  const defMap=new Map(defs.map(([type,name,unit])=>[name.toLowerCase(),{type,name,unit}]));
  const knownMaterials=new Set(['humus / mutterboden','rasensaat','rasendünger','rollrasen','rindenmulch','kies / splitt','kleinmaterial','reinigungsmittel','wandfarbe','spachtelmasse','fliesen','fliesenkleber','gipskartonplatte','dämmung','profile','kabel','steckdose / schalter','rohr / leitung','fitting / kleinmaterial','dachbahn','dämmstoff']);
  data.catalog.forEach(x=>{
    const key=String(x.name||'').toLowerCase();
    const def=defMap.get(key);
    if(def){x.type=def.type;x.unit=x.unit||def.unit;x.trade=x.trade||trade}
    else if(knownMaterials.has(key)){x.type='material'}
    else if(!x.type){x.type='service'}
  });
  if(localStorage.getItem('dh_catalog_v101_repaired')!=='1' && defs.length){
    const existing=new Set(data.catalog.map(x=>String(x.name||'').toLowerCase()));
    defs.forEach(([type,name,unit])=>{
      if(!existing.has(name.toLowerCase()))data.catalog.push({id:uid(),name,unit,price:0,type,trade,purchasePrice:0,markup:0});
    });
    localStorage.setItem('dh_catalog_v101_repaired','1');
    localStorage.setItem(KEY,JSON.stringify(data));
  }
}

repairCatalogV101();
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function loadData(){try{const raw=JSON.parse(localStorage.getItem(KEY)||'{}'),base=structuredClone(defaultData);return {...base,...raw,settings:{...base.settings,...(raw.settings||{})},privacy:{...base.privacy,...(raw.privacy||{}),consents:{...base.privacy.consents,...(raw.privacy?.consents||{})}},audit:Array.isArray(raw.audit)?raw.audit:[],invoices:Array.isArray(raw.invoices)?raw.invoices:[],customers:(Array.isArray(raw.customers)?raw.customers:base.customers).map(c=>({...c,folderNotes:c.folderNotes||'',photos:Array.isArray(c.photos)?c.photos:[]})),jobs:(Array.isArray(raw.jobs)?raw.jobs:base.jobs).map(j=>({...j,docNote:j.docNote||'',photos:Array.isArray(j.photos)?j.photos:[]}))}}catch(e){return structuredClone(defaultData)}}
function addAudit(action,details=''){data.audit=data.audit||[];data.audit.unshift({id:uid(),at:new Date().toISOString(),action,details});data.audit=data.audit.slice(0,100)}
function saveData(action='Daten geändert',details=''){addAudit(action,details);localStorage.setItem(KEY,JSON.stringify(data));renderAll()}
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
  if(c){document.getElementById('jobCustomer').value=c.id;document.getElementById('jobAddress').value=c.address||''}
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
function statusLabel(s){return({draft:'Entwurf',sent:'Versendet',accepted:'Angenommen',rejected:'Abgelehnt',open:'Geplant',active:'In Arbeit',done:'Abgeschlossen'})[s]||s}
function renderAll(){renderToday();renderOffers();renderInvoices();renderCustomers();renderCalendar();renderTasks();renderJobs();renderCatalog();loadSettingsForm();renderPrivacy();renderCachedWeather();applyRoleUI();if(document.getElementById('customerDetail')?.classList.contains('active'))renderCustomerFolder()}
function renderToday(){const d=new Date();document.getElementById('todayDate').textContent=d.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});document.getElementById('ownerGreeting').textContent=data.settings.ownerName||'Handwerker';const t=todayISO(),todayTasks=data.tasks.filter(x=>x.date===t),openTasks=todayTasks.filter(x=>!x.done),todayEvents=data.events.filter(x=>x.date===t).sort((a,b)=>a.time.localeCompare(b.time));const openOffers=data.offers.filter(o=>['draft','sent'].includes(o.status));document.getElementById('statTasks').textContent=openTasks.length;document.getElementById('statEvents').textContent=todayEvents.length;document.getElementById('statOffers').textContent=openOffers.length;document.getElementById('statValue').textContent=euro(openOffers.reduce((s,o)=>s+(o.total||0),0));document.getElementById('taskProgress').textContent=`${todayTasks.filter(x=>x.done).length} von ${todayTasks.length} erledigt`;document.getElementById('todayTasks').innerHTML=todayTasks.length?todayTasks.map(taskHTML).join(''):'<div class="empty">Heute ist noch nichts eingetragen.</div>';document.getElementById('todayEvents').innerHTML=todayEvents.length?todayEvents.map(e=>`<div class="event"><div class="eventTime">${e.time} Uhr · ${escapeHTML(e.type)}</div><b>${escapeHTML(e.title)}</b><div class="mini">${escapeHTML(e.address||'')}</div></div>`).join(''):'<div class="empty">Heute keine Termine.</div>';document.getElementById('dailyMessage').textContent=openTasks.length||todayEvents.length?'Dein Tag ist vorbereitet. Arbeite die wichtigsten Punkte nacheinander ab.':'Heute ist noch frei – ideal für Angebote, Akquise oder Planung.'}
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
let currentCustomerId='',currentCustomerFolderTab='overview';
function renderCustomers(){
  const q=(document.getElementById('customerSearch')?.value||'').toLowerCase(),list=data.customers.filter(c=>(c.name+' '+c.address+' '+c.phone).toLowerCase().includes(q));
  document.getElementById('customerList').innerHTML=list.length?list.map(c=>{
    const offers=data.offers.filter(o=>o.customerId===c.id).length,jobs=data.jobs.filter(j=>j.customerId===c.id).length,photos=data.jobs.filter(j=>j.customerId===c.id).reduce((n,j)=>n+(j.photos?.length||0),0);
    return `<div class="item customerCard"><div class="itemTop"><div><span class="folderMini">📁 Kundenakte</span><h3>${escapeHTML(c.name)}</h3><p>${escapeHTML(c.address||'Keine Adresse')}</p></div><button class="btn small primary" onclick="openCustomerFolder('${c.id}')">Akte öffnen</button></div><div class="customerStats"><span>🏗️ ${jobs} Baustellen</span><span>📄 ${offers} Angebote</span><span>📸 ${photos} Fotos</span></div><div class="itemActions">${c.phone?`<button class="btn small" onclick="location.href='tel:${encodeURIComponent(c.phone)}'">📞 Anrufen</button>`:''}${c.address?`<button class="btn small" onclick="openMaps('${encodeURIComponent(c.address)}')">📍 Route</button>`:''}</div></div>`}).join(''):'<div class="empty">Noch keine Kunden.</div>'
}
document.getElementById('customerSearch').oninput=renderCustomers;
function openCustomerFolder(id){currentCustomerId=id;currentCustomerFolderTab='overview';showScreen('customerDetail');document.querySelectorAll('.folderTab').forEach((b,i)=>b.classList.toggle('active',i===0));renderCustomerFolder()}
function editCurrentCustomer(){if(currentCustomerId)editCustomer(currentCustomerId)}
function setCustomerFolderTab(tab,btn){currentCustomerFolderTab=tab;document.querySelectorAll('.folderTab').forEach(b=>b.classList.toggle('active',b===btn));renderCustomerFolder()}
function renderCustomerFolder(){
  const c=data.customers.find(x=>x.id===currentCustomerId),box=document.getElementById('customerFolderContent');if(!c||!box)return;
  document.getElementById('customerDetailName').textContent=c.name;
  document.getElementById('customerDetailMeta').textContent=[c.contact,c.address].filter(Boolean).join(' · ');
  const jobs=data.jobs.filter(j=>j.customerId===c.id),offers=data.offers.filter(o=>o.customerId===c.id),invoices=data.invoices.filter(i=>i.customerId===c.id);
  const photos=jobs.flatMap(j=>(j.photos||[]).map(p=>({...p,jobTitle:j.title,jobId:j.id})));
  if(currentCustomerFolderTab==='sites'){
    box.innerHTML=`<div class="folderSectionHead"><div><h3>🏗️ Baustellen</h3><p>${jobs.length} Projekt${jobs.length===1?'':'e'} für diesen Kunden</p></div><button class="btn primary small owner-office-only" onclick="newJobForCustomer('${c.id}')">＋ Baustelle</button></div>${jobs.length?jobs.map(j=>`<button class="folderRow" onclick="editJob('${j.id}')"><span class="folderRowIcon">🏗️</span><span><b>${escapeHTML(j.title)}</b><small>${statusLabel(j.status)} · ${dateDE(j.start)} · ${(j.photos||[]).length} Fotos</small></span><strong>›</strong></button>`).join(''):'<div class="empty">Noch keine Baustelle angelegt.</div>'}`;
  }else if(currentCustomerFolderTab==='photos'){
    box.innerHTML=`<div class="folderSectionHead"><div><h3>📸 Baustellenfotos</h3><p>Fotos werden in der jeweiligen Baustelle aufgenommen.</p></div></div>${photos.length?`<div class="customerPhotoGrid">${photos.map(p=>`<button class="customerPhoto" onclick="editJob('${p.jobId}')"><img src="${p.data}" alt=""><span>${escapeHTML(p.jobTitle)}</span></button>`).join('')}</div>`:'<div class="empty">Noch keine Fotos. Öffne eine Baustelle und füge dort die Dokumentation hinzu.</div>'}`;
  }else if(currentCustomerFolderTab==='docs'){
    box.innerHTML=`<div class="folderSectionHead"><div><h3>📄 Dokumente</h3><p>Angebote und Rechnungen dieses Kunden</p></div></div><div class="docGroup"><b>Angebote</b>${offers.length?offers.map(o=>`<button class="folderRow" onclick="editOffer('${o.id}')"><span class="folderRowIcon">📄</span><span><b>${escapeHTML(o.subject||'Angebot')}</b><small>${dateDE(o.date)} · ${euro(o.total)}</small></span><strong>›</strong></button>`).join(''):'<p class="mini">Keine Angebote</p>'}</div><div class="docGroup"><b>Rechnungen</b>${invoices.length?invoices.map(i=>`<button class="folderRow" onclick="editInvoice('${i.id}')"><span class="folderRowIcon">🧾</span><span><b>${escapeHTML(i.subject||i.number)}</b><small>${i.number} · ${euro(i.total)}</small></span><strong>›</strong></button>`).join(''):'<p class="mini">Keine Rechnungen</p>'}</div>`;
  }else{
    box.innerHTML=`<div class="folderStats"><div><strong>${jobs.length}</strong><span>Baustellen</span></div><div><strong>${photos.length}</strong><span>Fotos</span></div><div class="owner-office-only"><strong>${offers.length+invoices.length}</strong><span>Dokumente</span></div></div><div class="card folderContact"><h3>Kontaktdaten</h3>${c.phone?`<button class="contactLine" onclick="location.href='tel:${encodeURIComponent(c.phone)}'">📞 <span>${escapeHTML(c.phone)}</span></button>`:''}${c.email?`<button class="contactLine" onclick="location.href='mailto:${encodeURIComponent(c.email)}'">✉️ <span>${escapeHTML(c.email)}</span></button>`:''}${c.address?`<button class="contactLine" onclick="openMaps('${encodeURIComponent(c.address)}')">📍 <span>${escapeHTML(c.address)}</span></button>`:''}${c.notes?`<div class="folderNote"><b>Notizen</b><p>${escapeHTML(c.notes)}</p></div>`:''}</div><div class="folderQuick"><button onclick="setCustomerFolderTab('sites',document.querySelector('[data-foldertab=sites]'))">🏗️<b>Baustellen</b><small>Aufträge & Doku</small></button><button onclick="setCustomerFolderTab('photos',document.querySelector('[data-foldertab=photos]'))">📸<b>Fotos</b><small>Baustellenbilder</small></button><button class="owner-office-only" onclick="setCustomerFolderTab('docs',document.querySelector('[data-foldertab=docs]'))">📄<b>Dokumente</b><small>Angebote & Rechnungen</small></button></div>`;
  }
  applyRoleUI();
}
function newJobForCustomer(customerId){newJob();document.getElementById('jobCustomer').value=customerId;const c=getCustomerById(customerId);if(c){document.getElementById('jobAddress').value=c.address||'';document.getElementById('jobAddress').dataset.autoFilled='1'}refreshJobOfferOptions();const offers=(data.offers||[]).filter(o=>o.customerId===customerId&&o.status==='accepted');if(offers.length===1){document.getElementById('jobOffer').value=offers[0].id;syncJobOfferFields()}}
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
  document.getElementById('offerTravel').value=0;
  document.getElementById('offerDiscount').value=0;
  draftLines=[];
  renderOfferLines();
  showScreen('offerEditor');
}
function editOffer(id){const o=data.offers.find(x=>x.id===id);if(!o)return;document.getElementById('offerId').value=o.id;document.getElementById('offerCustomer').innerHTML=customerOptions(o.customerId);updateSoftCustomerButton('offerCustomer');document.getElementById('offerDate').value=o.date;document.getElementById('offerStatus').value=o.status;document.getElementById('offerSubject').value=o.subject;document.getElementById('offerNotes').value=o.notes||'';document.getElementById('offerTravel').value=o.travel||0;document.getElementById('offerDiscount').value=o.discount||0;draftLines=structuredClone(o.lines||[]);renderOfferLines();showScreen('offerEditor')}
function addOfferLine(line={name:'',qty:1,unit:'Std.',price:0}){draftLines.push({id:uid(),...line});renderOfferLines()}
function renderOfferLines(){
  const el=document.getElementById('offerLines');
  if(!el)return;
  if(!Array.isArray(draftLines))draftLines=[];
  el.innerHTML=draftLines.length?draftLines.map((l,i)=>`
    <div class="offerLineSimple">
      <div class="lineMain">
        <input class="input" value="${escapeHTML(l.name||'')}" placeholder="Position" oninput="draftLines[${i}].name=this.value">
        <div class="row3" style="margin-top:8px">
          <input type="number" class="input" value="${Number(l.qty)||1}" step="0.01" oninput="draftLines[${i}].qty=Number(this.value)||0" aria-label="Menge">
          <input class="input" value="${escapeHTML(l.unit||'Stk.')}" oninput="draftLines[${i}].unit=this.value" aria-label="Einheit">
          <input type="number" class="input" value="${Number(l.price)||0}" step="0.01" oninput="draftLines[${i}].price=Number(this.value)||0" aria-label="Preis">
        </div>
        <div class="mini" style="margin-top:6px">Menge · Einheit · Einzelpreis</div>
      </div>
      <button class="btn small danger" onclick="draftLines.splice(${i},1);renderOfferLines()" aria-label="Position löschen">✕</button>
    </div>`).join(''):'<div class="empty">Noch keine Positionen. Tippe auf „＋ Position“.</div>';
}
function offerObject(){const id=document.getElementById('offerId').value,cid=document.getElementById('offerCustomer').value,travel=Number(document.getElementById('offerTravel').value)||0,discount=Number(document.getElementById('offerDiscount').value)||0,sub=draftLines.reduce((s,l)=>s+(Number(l.qty)||0)*(Number(l.price)||0),0)+travel-discount,tax=Number(data.settings.tax)||0,total=sub*(1+tax/100);return{id:id||uid(),number:id?(data.offers.find(x=>x.id===id)?.number):'AP-'+new Date().getFullYear()+'-'+String(data.offers.length+1).padStart(4,'0'),customerId:cid,date:document.getElementById('offerDate').value,status:document.getElementById('offerStatus').value,subject:document.getElementById('offerSubject').value.trim(),notes:document.getElementById('offerNotes').value.trim(),lines:structuredClone(draftLines),travel,discount,subtotal:sub,tax,total}}
function saveOffer(){const o=offerObject();if(!o.customerId)return toast('Kunde auswählen');if(!o.subject)return toast('Betreff fehlt');if(!o.lines.some(l=>l.name))return toast('Position fehlt');const i=data.offers.findIndex(x=>x.id===o.id);if(i>=0)data.offers[i]=o;else data.offers.push(o);saveData();document.getElementById('offerId').value=o.id;showScreen('offers');toast('Angebot gespeichert')}
function renderOffers(){const list=data.offers.filter(o=>currentOfferFilter==='all'||o.status===currentOfferFilter).sort((a,b)=>b.date.localeCompare(a.date));document.getElementById('offerList').innerHTML=list.length?list.map(o=>{const c=data.customers.find(x=>x.id===o.customerId);return `<div class="item"><div class="itemTop"><div><span class="badge ${o.status}">${statusLabel(o.status)}</span><h3 style="margin-top:8px">${escapeHTML(o.subject)}</h3><p>${escapeHTML(c?.name||'Unbekannter Kunde')} · ${dateDE(o.date)} · ${o.number}</p></div><strong>${euro(o.total)}</strong></div><div class="itemActions"><button class="btn small" onclick="editOffer('${o.id}')">Bearbeiten</button><button class="btn small" onclick="quickOfferStatus('${o.id}')">Status</button><button class="btn small" onclick="previewSavedOffer('${o.id}')">PDF</button></div></div>`}).join(''):'<div class="empty">Noch keine Angebote.</div>'}
document.querySelectorAll('#offerTabs .tab').forEach(b=>b.onclick=()=>{currentOfferFilter=b.dataset.filter;document.querySelectorAll('#offerTabs .tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderOffers()});
function quickOfferStatus(id){
  const o=data.offers.find(x=>x.id===id);if(!o)return;
  document.getElementById('statusOfferId').value=id;
  document.getElementById('offerStatusModal').classList.remove('hidden');
}

function paperHTML(o){const c=data.customers.find(x=>x.id===o.customerId)||{},s=data.settings;return `<div class="offerPaper"><div class="paperHead"><div><h2>${escapeHTML(s.companyName)}</h2><div>${escapeHTML(s.address||'')}</div></div><div class="paperMeta"><b>Angebot ${escapeHTML(o.number||'')}</b><br>Datum: ${dateDE(o.date)}<br>${escapeHTML(s.email||'')}<br>${escapeHTML(s.phone||'')}</div></div><div class="paperCustomer"><b>${escapeHTML(c.name||'')}</b><br>${escapeHTML(c.contact||'')}<br>${escapeHTML(c.address||'')}</div><h2>${escapeHTML(o.subject)}</h2>${o.notes?`<p>${escapeHTML(o.notes)}</p>`:''}<table class="paperTable"><thead><tr><th>Pos.</th><th>Leistung</th><th>Menge</th><th>Preis</th><th>Gesamt</th></tr></thead><tbody>${o.lines.filter(l=>l.name).map((l,i)=>`<tr><td>${i+1}</td><td>${escapeHTML(l.name)}</td><td>${l.qty} ${escapeHTML(l.unit)}</td><td>${euro(l.price)}</td><td>${euro(l.qty*l.price)}</td></tr>`).join('')}${o.travel?`<tr><td></td><td>Anfahrt</td><td>1 Pauschale</td><td>${euro(o.travel)}</td><td>${euro(o.travel)}</td></tr>`:''}</tbody></table><div class="totals"><div><span>Zwischensumme</span><b>${euro(o.subtotal)}</b></div>${o.tax?`<div><span>MwSt. ${o.tax}%</span><b>${euro(o.subtotal*o.tax/100)}</b></div>`:`<div><span>Umsatzsteuer</span><b>§ 19 UStG</b></div>`}<div class="grand"><span>Gesamt</span><span>${euro(o.total)}</span></div></div><p>Dieses Angebot ist freibleibend. Zahlungsziel: ${escapeHTML(s.paymentTerm||'7 Tage')}.</p><div class="paperFoot">${escapeHTML(s.companyName)} · ${escapeHTML(s.address||'')} · ${escapeHTML(s.phone||'')} · ${escapeHTML(s.email||'')}</div></div>`}
function previewOffer(){const o=offerObject();document.getElementById('offerPreviewPaper').innerHTML=paperHTML(o);showScreen('offerPreview')}
function previewSavedOffer(id){const o=data.offers.find(x=>x.id===id);document.getElementById('offerId').value=id;document.getElementById('offerPreviewPaper').innerHTML=paperHTML(o);showScreen('offerPreview')}
function printOffer(){document.getElementById('printArea').innerHTML=document.getElementById('offerPreviewPaper').innerHTML;window.print()}
async function shareOfferWhatsApp(){if(!await ensureExternalConsent('WhatsApp'))return;const id=document.getElementById('offerId').value,o=id?data.offers.find(x=>x.id===id):offerObject(),c=data.customers.find(x=>x.id===o.customerId);const t=`Hallo ${c?.name||''}, Ihr Angebot „${o.subject}“ über ${euro(o.total)} ist fertig. Freundliche Grüße, ${data.settings.companyName}`;location.href='https://wa.me/?text='+encodeURIComponent(t)}

function setEventType(type){
  const input=document.getElementById('eventType');if(input)input.value=type;
  document.querySelectorAll('[data-eventtype]').forEach(b=>b.classList.toggle('active',b.dataset.eventtype===type));
  if(navigator.vibrate)navigator.vibrate(8);
}

function newEventForDate(date){newEvent();document.getElementById('eventDate').value=date;document.getElementById('eventEditorTitle').textContent=`Termin am ${dateDE(date)}`}
function newEvent(){
  document.getElementById('eventEditorTitle').textContent='Neuer Termin';
  document.getElementById('eventId').value='';
  document.getElementById('eventTitle').value='';
  document.getElementById('eventCustomer').innerHTML=customerOptions();
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
  document.getElementById('eventCustomer').innerHTML=customerOptions(e.customerId);
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
  const obj={id:id||uid(),title:document.getElementById('eventTitle').value.trim(),customerId:cid,date:document.getElementById('eventDate').value,time:document.getElementById('eventTime').value,duration:Math.round(hours*60),type:document.getElementById('eventType').value,address:document.getElementById('eventAddress').value.trim(),notes:document.getElementById('eventNotes').value.trim(),jobId:old?.jobId||''};
  if(!obj.title)return toast('Titel fehlt');
  if(id)data.events[data.events.findIndex(x=>x.id===id)]=obj;else data.events.push(obj);
  syncLinkedJobFromEvent(obj);saveData('Termin gespeichert',obj.title);showScreen('calendar');toast(obj.jobId?'Termin gespeichert · Baustelle aktualisiert':'Termin gespeichert');
}
function renderCalendar(){document.getElementById('monthTitle').textContent=calDate.toLocaleDateString('de-DE',{month:'long',year:'numeric'});const y=calDate.getFullYear(),m=calDate.getMonth(),first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate(),heads=['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>`<div class="calHead">${x}</div>`).join('');let cells='';for(let i=0;i<first;i++)cells+='<div class="day muted"></div>';for(let d=1;d<=days;d++){const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,count=data.events.filter(e=>e.date===iso).length;cells+=`<button type="button" class="day ${iso===todayISO()?'today':''} ${count?'hasEvent':''}" onclick="newEventForDate('${iso}')"><span>${d}</span>${count?`<small>${count}</small>`:''}</button>`}document.getElementById('calendarGrid').innerHTML=heads+cells;const list=[...data.events].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));document.getElementById('eventList').innerHTML=list.length?list.map(e=>{const c=data.customers.find(x=>x.id===e.customerId);return `<div class="item"><div class="itemTop"><div><span class="badge sent">${escapeHTML(e.type)}</span><h3 style="margin-top:8px">${escapeHTML(e.title)}</h3><p>${dateDE(e.date)} · ${e.time} Uhr · ${escapeHTML(c?.name||'')}</p></div><button class="btn small" onclick="editEvent('${e.id}')">✎</button></div><div class="itemActions">${e.address?`<button class="btn small" onclick="openMaps('${encodeURIComponent(e.address)}')">📍 Route</button>`:''}<button class="btn small" onclick="googleCalendar('${e.id}')">Google Kalender</button><button class="btn small" onclick="downloadICS('${e.id}')">Apple / Outlook</button></div></div>`}).join(''):'<div class="empty">Noch keine Termine.</div>'}
function changeMonth(n){calDate=new Date(calDate.getFullYear(),calDate.getMonth()+n,1);renderCalendar()}
function eventDates(e){const start=new Date(`${e.date}T${e.time}:00`),end=new Date(start.getTime()+e.duration*60000);const fmt=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');return{start:fmt(start),end:fmt(end)}}
async function googleCalendar(id){if(!await ensureExternalConsent('Google Kalender'))return;const e=data.events.find(x=>x.id===id),d=eventDates(e);location.href=`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${d.start}/${d.end}&details=${encodeURIComponent(e.notes||'')}&location=${encodeURIComponent(e.address||'')}`}
function downloadICS(id){const e=data.events.find(x=>x.id===id),d=eventDates(e),ics=`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//AngebotsPilot//Digitaler Handwerker//DE\nBEGIN:VEVENT\nUID:${e.id}@angebotspilot\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}\nDTSTART:${d.start}\nDTEND:${d.end}\nSUMMARY:${e.title}\nLOCATION:${e.address||''}\nDESCRIPTION:${e.notes||''}\nEND:VEVENT\nEND:VCALENDAR`;downloadBlob(ics,`${e.title}.ics`,'text/calendar')}
function acceptedOfferOptions(selected='',customerId=''){const offers=data.offers.filter(o=>o.status==='accepted'&&(!customerId||o.customerId===customerId));return ['<option value="">– Kein Angebot verknüpft –</option>',...offers.map(o=>`<option value="${o.id}" ${o.id===selected?'selected':''}>${escapeHTML(o.number)} · ${escapeHTML(o.subject)} · ${euro(o.total)}</option>`)].join('')}
function refreshJobOfferOptions(){const el=document.getElementById('jobOffer');if(el)el.innerHTML=acceptedOfferOptions(el.value,document.getElementById('jobCustomer').value)}
let jobDraftPhotos=[];
function renderJobPhotos(){
  const grid=document.getElementById('jobPhotoGrid'),count=document.getElementById('jobPhotoCount');if(!grid)return;
  if(count)count.textContent=`${jobDraftPhotos.length} Foto${jobDraftPhotos.length===1?'':'s'}`;
  grid.innerHTML=jobDraftPhotos.length?jobDraftPhotos.map((p,i)=>`<div class="photoTile"><img src="${p.data}" alt="Baustellenfoto"><button type="button" onclick="removeJobPhoto(${i})">×</button><small>${dateDE((p.at||'').slice(0,10))}</small></div>`).join(''):'<div class="photoEmpty">Noch keine Fotos</div>';
}
function removeJobPhoto(i){jobDraftPhotos.splice(i,1);renderJobPhotos()}
function compressPhoto(file){
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{const max=1100,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.72))};img.src=reader.result};reader.readAsDataURL(file)});
}
async function addJobPhotos(event){
  const files=[...(event.target.files||[])];if(!files.length)return;
  toast('Fotos werden vorbereitet …');
  for(const file of files.slice(0,8)){
    try{const dataUrl=await compressPhoto(file);jobDraftPhotos.push({id:uid(),data:dataUrl,at:new Date().toISOString()})}catch(e){}
  }
  event.target.value='';renderJobPhotos();toast('📸 Foto zur Baustelle hinzugefügt');
}


function upsertCalendarEventForJob(job){
  if(!job||!job.start)return;
  let ev=(data.events||[]).find(e=>e.jobId===job.id);
  const payload={title:job.title||'Baustelle',customerId:job.customerId||'',date:job.start,time:ev?.time||'08:00',duration:ev?.duration||480,type:'Baustelle',address:job.address||'',notes:job.docNote||job.notes||'',jobId:job.id};
  if(ev)Object.assign(ev,payload);else{ev={id:uid(),...payload};data.events.push(ev)}
  job.eventId=ev.id;
}
function syncLinkedJobFromEvent(ev){
  if(!ev?.jobId)return;const job=data.jobs.find(j=>j.id===ev.jobId);if(!job)return;
  job.start=ev.date||job.start;job.address=ev.address||job.address;if(ev.customerId)job.customerId=ev.customerId;
}

function newJob(){document.getElementById('jobId').value='';document.getElementById('jobTitle').value='';document.getElementById('jobCustomer').innerHTML=customerOptions();document.getElementById('jobAddress').value='';document.getElementById('jobAddress').dataset.autoFilled='1';document.getElementById('jobStart').value=todayISO();document.getElementById('jobStatus').value='open';document.getElementById('jobNotes').value='';document.getElementById('jobOffer').innerHTML=acceptedOfferOptions();jobDraftPhotos=[];document.getElementById('jobDocNote').value='';renderJobPhotos();showScreen('jobEditor')}
function editJob(id){const j=data.jobs.find(x=>x.id===id);if(!j)return;document.getElementById('jobId').value=j.id;document.getElementById('jobTitle').value=j.title;document.getElementById('jobCustomer').innerHTML=customerOptions(j.customerId);document.getElementById('jobAddress').value=j.address||'';document.getElementById('jobAddress').dataset.autoFilled='0';document.getElementById('jobStart').value=j.start;document.getElementById('jobStatus').value=j.status;document.getElementById('jobNotes').value=j.notes||'';document.getElementById('jobOffer').innerHTML=acceptedOfferOptions(j.offerId||'',j.customerId);jobDraftPhotos=structuredClone(j.photos||[]);document.getElementById('jobDocNote').value=j.docNote||'';renderJobPhotos();showScreen('jobEditor')}
function saveJob(){const id=document.getElementById('jobId').value,old=id?data.jobs.find(x=>x.id===id):null,obj={id:id||uid(),title:document.getElementById('jobTitle').value.trim(),customerId:document.getElementById('jobCustomer').value,address:document.getElementById('jobAddress').value.trim(),start:document.getElementById('jobStart').value,status:document.getElementById('jobStatus').value,notes:document.getElementById('jobNotes').value.trim(),offerId:document.getElementById('jobOffer').value||'',invoiceId:old?.invoiceId||'',eventId:old?.eventId||'',photos:structuredClone(jobDraftPhotos),docNote:document.getElementById('jobDocNote').value.trim()};if(!obj.title)return toast('Name fehlt');if(id)data.jobs[data.jobs.findIndex(x=>x.id===id)]=obj;else data.jobs.push(obj);upsertCalendarEventForJob(obj);let createdInvoice=null;if(obj.status==='done'&&old?.status!=='done'&&!obj.invoiceId){createdInvoice=createInvoiceFromJobObject(obj);if(createdInvoice)obj.invoiceId=createdInvoice.id;if(id)data.jobs[data.jobs.findIndex(x=>x.id===obj.id)]=obj;else data.jobs[data.jobs.findIndex(x=>x.id===obj.id)]=obj}saveData('Baustelle gespeichert',obj.title);showScreen(createdInvoice?'invoices':'jobs');toast(createdInvoice?'Baustelle abgeschlossen · Rechnungsentwurf erstellt':'Baustelle gespeichert · Kalender aktualisiert')}
function renderJobs(){document.getElementById('jobList').innerHTML=data.jobs.length?data.jobs.map(j=>{const c=data.customers.find(x=>x.id===j.customerId),inv=data.invoices.find(x=>x.id===j.invoiceId);return `<div class="item"><div class="itemTop"><div><span class="badge ${j.status==='done'?'done':'open'}">${statusLabel(j.status)}</span><h3 style="margin-top:8px">${escapeHTML(j.title)}</h3><p>${escapeHTML(c?.name||'')} · Start ${dateDE(j.start)}${inv?' · Rechnung '+escapeHTML(inv.number):''}</p></div><button class="btn small" onclick="editJob('${j.id}')">Öffnen</button></div><div class="itemActions">${j.address?`<button class="btn small" onclick="openMaps('${encodeURIComponent(j.address)}')">📍 Navigation</button><button class="btn small" onclick="openJobWeather('${j.id}')">🌦️ Wetter</button>`:''}<button class="btn small" onclick="jobToCalendar('${j.id}')">📅 Termin</button>${j.status==='done'&&!inv?`<button class="btn small primary" onclick="createInvoiceFromJob('${j.id}')">🧾 Rechnung</button>`:''}${inv?`<button class="btn small" onclick="editInvoice('${inv.id}')">🧾 Rechnung öffnen</button>`:''}</div></div>`}).join(''):'<div class="empty">Noch keine Baustellen.</div>'}
function jobToCalendar(id){const j=data.jobs.find(x=>x.id===id);if(!j)return;upsertCalendarEventForJob(j);localStorage.setItem(KEY,JSON.stringify(data));const ev=data.events.find(e=>e.jobId===j.id);if(ev)editEvent(ev.id)}
function renderCatalog(){const el=document.getElementById('catalogList');if(!el)return;const q=(document.getElementById('catalogSearch')?.value||'').trim().toLowerCase();let list=(data.catalog||[]).filter(x=>(catalogFilter==='all'||(x.type||'service')===catalogFilter)&&(!q||String(x.name).toLowerCase().includes(q)));list.sort((a,b)=>(a.type||'service').localeCompare(b.type||'service')||a.name.localeCompare(b.name));el.innerHTML=list.length?list.map(x=>`<div class="item"><div class="itemTop"><div><span class="catalogType">${(x.type||'service')==='material'?'Material':'Leistung'}</span><h3>${escapeHTML(x.name)}</h3><p>${escapeHTML(x.unit||'')} ${x.trade&&TRADE_CATALOGS[x.trade]?'· '+TRADE_CATALOGS[x.trade].name:''}</p></div><strong>${Number(x.price)>0?euro(x.price):'<span class="mini">Preis fehlt</span>'}</strong></div><div class="itemActions"><button class="btn small" onclick="editCatalog('${x.id}')">Preis bearbeiten</button></div></div>`).join(''):'<div class="empty">Keine passenden Positionen gefunden.</div>'}
function addCatalogItem(){openCatalogEditor()}
function editCatalogItem(id){openCatalogEditor(id)}


function nextInvoiceNumber(){const y=new Date().getFullYear(),nums=data.invoices.filter(i=>String(i.number||'').startsWith('RE-'+y+'-')).map(i=>Number(String(i.number).split('-').pop())||0);return 'RE-'+y+'-'+String((nums.length?Math.max(...nums):0)+1).padStart(4,'0')}
function paymentDays(){const m=String(data.settings.paymentTerm||'').match(/(\d+)/);return m?Number(m[1]):7}
function addDaysISO(date,days){const d=new Date((date||todayISO())+'T12:00:00');d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function invoiceCalc(inv){const sub=(inv.lines||[]).reduce((s,l)=>s+(Number(l.qty)||0)*(Number(l.price)||0),0)+(Number(inv.travel)||0)-(Number(inv.discount)||0),tax=Number(inv.tax ?? data.settings.tax)||0;inv.subtotal=sub;inv.tax=tax;inv.total=sub*(1+tax/100);return inv}
function createInvoiceFromJobObject(job){const offer=data.offers.find(o=>o.id===job.offerId)||(data.offers.filter(o=>o.customerId===job.customerId&&o.status==='accepted').sort((a,b)=>b.date.localeCompare(a.date))[0]);const date=todayISO(),inv={id:uid(),number:nextInvoiceNumber(),customerId:job.customerId,date,dueDate:addDaysISO(date,paymentDays()),status:'draft',subject:job.title||offer?.subject||'Ausgeführte Arbeiten',notes:'Automatisch nach Abschluss der Baustelle erstellt. Bitte tatsächliche Leistungen und Mengen vor Versand prüfen.',lines:offer?structuredClone(offer.lines||[]):[{name:'Ausgeführte Arbeiten – '+(job.title||'Baustelle'),qty:1,unit:'Pauschale',price:0}],travel:offer?.travel||0,discount:offer?.discount||0,tax:Number(data.settings.tax)||0,offerId:offer?.id||'',jobId:job.id,createdAutomatically:true};invoiceCalc(inv);data.invoices.push(inv);job.invoiceId=inv.id;addAudit('Rechnungsentwurf automatisch erstellt',`${inv.number} · ${job.title}`);return inv}
function createInvoiceFromJob(id){const job=data.jobs.find(x=>x.id===id);if(!job)return;if(job.invoiceId)return editInvoice(job.invoiceId);const inv=createInvoiceFromJobObject(job);saveData('Rechnung erstellt',inv.number);editInvoice(inv.id);toast('Rechnungsentwurf erstellt')}
let invoiceDraftLines=[];
function newInvoice(){document.getElementById('invoiceId').value='';document.getElementById('invoiceCustomer').innerHTML=customerOptions();document.getElementById('invoiceDate').value=todayISO();document.getElementById('invoiceDueDate').value=addDaysISO(todayISO(),paymentDays());document.getElementById('invoiceStatus').value='draft';document.getElementById('invoiceSubject').value='';document.getElementById('invoiceNotes').value='';document.getElementById('invoiceTravel').value=0;document.getElementById('invoiceDiscount').value=0;invoiceDraftLines=[{name:'',qty:1,unit:'Pauschale',price:0}];renderInvoiceLines();showScreen('invoiceEditor')}
function editInvoice(id){const inv=data.invoices.find(x=>x.id===id);if(!inv)return;document.getElementById('invoiceId').value=inv.id;document.getElementById('invoiceCustomer').innerHTML=customerOptions(inv.customerId);document.getElementById('invoiceDate').value=inv.date||todayISO();document.getElementById('invoiceDueDate').value=inv.dueDate||addDaysISO(inv.date||todayISO(),paymentDays());document.getElementById('invoiceStatus').value=inv.status||'draft';document.getElementById('invoiceSubject').value=inv.subject||'';document.getElementById('invoiceNotes').value=inv.notes||'';document.getElementById('invoiceTravel').value=inv.travel||0;document.getElementById('invoiceDiscount').value=inv.discount||0;invoiceDraftLines=structuredClone(inv.lines||[]);if(!invoiceDraftLines.length)invoiceDraftLines=[{name:'',qty:1,unit:'Pauschale',price:0}];renderInvoiceLines();showScreen('invoiceEditor')}
function renderInvoiceLines(){document.getElementById('invoiceLines').innerHTML=invoiceDraftLines.map((l,i)=>`<div class="item"><div class="field"><input class="input" value="${escapeHTML(l.name)}" placeholder="Leistung" oninput="invoiceDraftLines[${i}].name=this.value"></div><div class="row3"><input type="number" class="input" value="${l.qty}" step="0.01" oninput="invoiceDraftLines[${i}].qty=Number(this.value)"><input class="input" value="${escapeHTML(l.unit)}" oninput="invoiceDraftLines[${i}].unit=this.value"><input type="number" class="input" value="${l.price}" step="0.01" oninput="invoiceDraftLines[${i}].price=Number(this.value)"></div><div class="itemActions"><span class="mini">Menge · Einheit · Einzelpreis</span><button class="btn small danger" onclick="invoiceDraftLines.splice(${i},1);renderInvoiceLines()">Löschen</button></div></div>`).join('')}
function addInvoiceLine(){invoiceDraftLines.push({name:'',qty:1,unit:'Pauschale',price:0});renderInvoiceLines()}
function invoiceObject(){const id=document.getElementById('invoiceId').value,old=id?data.invoices.find(x=>x.id===id):null,inv={id:id||uid(),number:old?.number||nextInvoiceNumber(),customerId:document.getElementById('invoiceCustomer').value,date:document.getElementById('invoiceDate').value,dueDate:document.getElementById('invoiceDueDate').value,status:document.getElementById('invoiceStatus').value,subject:document.getElementById('invoiceSubject').value.trim(),notes:document.getElementById('invoiceNotes').value.trim(),lines:structuredClone(invoiceDraftLines),travel:Number(document.getElementById('invoiceTravel').value)||0,discount:Number(document.getElementById('invoiceDiscount').value)||0,tax:Number(data.settings.tax)||0,offerId:old?.offerId||'',jobId:old?.jobId||'',createdAutomatically:old?.createdAutomatically||false};return invoiceCalc(inv)}
function saveInvoice(){const inv=invoiceObject();if(!inv.customerId)return toast('Kunde auswählen');if(!inv.subject)return toast('Betreff fehlt');if(!inv.lines.some(l=>l.name))return toast('Position fehlt');const i=data.invoices.findIndex(x=>x.id===inv.id);if(i>=0)data.invoices[i]=inv;else data.invoices.push(inv);saveData('Rechnung gespeichert',inv.number);showScreen('invoices');toast('Rechnung gespeichert')}
function invoiceStatusLabel(s){return({draft:'Entwurf',open:'Offen',paid:'Bezahlt',cancelled:'Storniert'})[s]||s}
function renderInvoices(){const el=document.getElementById('invoiceList');if(!el)return;const list=[...data.invoices].sort((a,b)=>(b.date||'').localeCompare(a.date||''));el.innerHTML=list.length?list.map(inv=>{const c=data.customers.find(x=>x.id===inv.customerId);return `<div class="item"><div class="itemTop"><div><span class="badge ${inv.status==='paid'?'done':inv.status==='open'?'sent':'draft'}">${invoiceStatusLabel(inv.status)}</span><h3 style="margin-top:8px">${escapeHTML(inv.subject)}</h3><p>${escapeHTML(c?.name||'Unbekannter Kunde')} · ${inv.number} · fällig ${dateDE(inv.dueDate)}</p></div><strong>${euro(inv.total)}</strong></div><div class="itemActions"><button class="btn small" onclick="editInvoice('${inv.id}')">Bearbeiten</button><button class="btn small" onclick="previewInvoice('${inv.id}')">PDF</button>${inv.status!=='paid'?`<button class="btn small" onclick="markInvoicePaid('${inv.id}')">✓ Bezahlt</button>`:''}</div></div>`}).join(''):'<div class="empty">Noch keine Rechnungen.</div>'}
function markInvoicePaid(id){const inv=data.invoices.find(x=>x.id===id);if(!inv)return;inv.status='paid';inv.paidAt=todayISO();saveData('Rechnung bezahlt',inv.number);toast('Als bezahlt markiert')}
function invoicePaperHTML(inv){const c=data.customers.find(x=>x.id===inv.customerId)||{},s=data.settings;return `<div class="offerPaper"><div class="paperHead"><div><h2>${escapeHTML(s.companyName)}</h2><div>${escapeHTML(s.address||'')}</div></div><div class="paperMeta"><b>Rechnung ${escapeHTML(inv.number)}</b><br>Rechnungsdatum: ${dateDE(inv.date)}<br>Fällig: ${dateDE(inv.dueDate)}<br>${escapeHTML(s.email||'')}<br>${escapeHTML(s.phone||'')}</div></div><div class="paperCustomer"><b>${escapeHTML(c.name||'')}</b><br>${escapeHTML(c.contact||'')}<br>${escapeHTML(c.address||'')}</div><h2>${escapeHTML(inv.subject)}</h2>${inv.notes?`<p>${escapeHTML(inv.notes)}</p>`:''}<table class="paperTable"><thead><tr><th>Pos.</th><th>Leistung</th><th>Menge</th><th>Preis</th><th>Gesamt</th></tr></thead><tbody>${(inv.lines||[]).filter(l=>l.name).map((l,i)=>`<tr><td>${i+1}</td><td>${escapeHTML(l.name)}</td><td>${l.qty} ${escapeHTML(l.unit)}</td><td>${euro(l.price)}</td><td>${euro(l.qty*l.price)}</td></tr>`).join('')}${inv.travel?`<tr><td></td><td>Anfahrt</td><td>1 Pauschale</td><td>${euro(inv.travel)}</td><td>${euro(inv.travel)}</td></tr>`:''}${inv.discount?`<tr><td></td><td>Rabatt</td><td></td><td></td><td>− ${euro(inv.discount)}</td></tr>`:''}</tbody></table><div class="totals"><div><span>Zwischensumme</span><b>${euro(inv.subtotal)}</b></div>${inv.tax?`<div><span>MwSt. ${inv.tax}%</span><b>${euro(inv.subtotal*inv.tax/100)}</b></div>`:`<div><span>Umsatzsteuer</span><b>Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.</b></div>`}<div class="grand"><span>Rechnungsbetrag</span><span>${euro(inv.total)}</span></div></div><p>Bitte überweisen Sie den Rechnungsbetrag bis zum ${dateDE(inv.dueDate)}.${s.iban?`<br>IBAN: ${escapeHTML(s.iban)}${s.bankName?' · '+escapeHTML(s.bankName):''}`:''}</p>${s.taxNumber||s.vatId?`<p class="mini">${s.taxNumber?'Steuernummer: '+escapeHTML(s.taxNumber):''}${s.taxNumber&&s.vatId?' · ':''}${s.vatId?'USt-IdNr.: '+escapeHTML(s.vatId):''}</p>`:''}<div class="paperFoot">${escapeHTML(s.companyName)} · ${escapeHTML(s.address||'')} · ${escapeHTML(s.phone||'')} · ${escapeHTML(s.email||'')}</div></div>`}
function previewInvoice(id){const inv=id?data.invoices.find(x=>x.id===id):invoiceObject();if(!inv)return;document.getElementById('invoicePreviewPaper').innerHTML=invoicePaperHTML(inv);document.getElementById('invoicePreviewSource').value=inv.id||'';showScreen('invoicePreview')}
function printInvoice(){const id=document.getElementById('invoicePreviewSource').value,inv=id?data.invoices.find(x=>x.id===id):invoiceObject();document.getElementById('printArea').innerHTML=invoicePaperHTML(inv);window.print()}


function editCatalog(id){openCatalogEditor(id)}

function loadSettingsForm(){const s=data.settings;document.getElementById('companyName').value=s.companyName||'';document.getElementById('ownerName').value=s.ownerName||'';document.getElementById('companyPhone').value=s.phone||'';document.getElementById('companyAddress').value=s.address||'';document.getElementById('weatherLocation').value=s.weatherLocation||s.address||'';document.getElementById('companyEmail').value=s.email||'';document.getElementById('taxMode').value=String(s.tax||0);document.getElementById('paymentTerm').value=s.paymentTerm||'';document.getElementById('taxNumber').value=s.taxNumber||'';document.getElementById('vatId').value=s.vatId||'';document.getElementById('iban').value=s.iban||'';document.getElementById('bankName').value=s.bankName||''}
function saveSettings(){data.settings={...data.settings,companyName:document.getElementById('companyName').value.trim(),ownerName:document.getElementById('ownerName').value.trim(),phone:document.getElementById('companyPhone').value.trim(),address:document.getElementById('companyAddress').value.trim(),weatherLocation:document.getElementById('weatherLocation').value.trim(),email:document.getElementById('companyEmail').value.trim(),tax:Number(document.getElementById('taxMode').value),paymentTerm:document.getElementById('paymentTerm').value.trim(),taxNumber:document.getElementById('taxNumber').value.trim(),vatId:document.getElementById('vatId').value.trim(),iban:document.getElementById('iban').value.trim(),bankName:document.getElementById('bankName').value.trim()};localStorage.removeItem(WEATHER_CACHE_KEY);saveData();refreshWeather(true);toast('Betrieb gespeichert')}

const weatherCodes={0:['Klar','☀️'],1:['Überwiegend klar','🌤️'],2:['Teilweise bewölkt','⛅'],3:['Bewölkt','☁️'],45:['Nebel','🌫️'],48:['Reifnebel','🌫️'],51:['Leichter Nieselregen','🌦️'],53:['Nieselregen','🌦️'],55:['Starker Nieselregen','🌧️'],61:['Leichter Regen','🌦️'],63:['Regen','🌧️'],65:['Starker Regen','🌧️'],71:['Leichter Schnee','🌨️'],73:['Schnee','🌨️'],75:['Starker Schnee','❄️'],80:['Leichte Schauer','🌦️'],81:['Schauer','🌧️'],82:['Starke Schauer','⛈️'],95:['Gewitter','⛈️'],96:['Gewitter mit Hagel','⛈️'],99:['Starkes Gewitter','⛈️']};
function weatherText(code){return weatherCodes[code]||['Wechselhaft','🌦️']}
function weatherRisk(day){const reasons=[];if((day.precipProbability||0)>=60)reasons.push(`${Math.round(day.precipProbability)} % Regenrisiko`);if((day.precipitation||0)>=5)reasons.push(`${Number(day.precipitation).toFixed(1)} mm Niederschlag`);if((day.gust||0)>=50)reasons.push(`Böen bis ${Math.round(day.gust)} km/h`);if((day.minTemp??99)<=2)reasons.push(`Tiefstwert ${Math.round(day.minTemp)} °C`);if((day.maxTemp??0)>=32)reasons.push(`Hitze bis ${Math.round(day.maxTemp)} °C`);return reasons}
async function geocodeWeatherPlace(place){const q=(place||'').trim();if(!q)throw new Error('Bitte einen Ort eingeben.');const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=de&format=json`;const r=await fetch(url);if(!r.ok)throw new Error('Ortssuche fehlgeschlagen.');const j=await r.json();if(!j.results?.length)throw new Error('Ort nicht gefunden. Bitte Ort oder Postleitzahl eingeben.');const x=j.results[0];return{latitude:x.latitude,longitude:x.longitude,label:[x.name,x.admin1,x.country_code].filter(Boolean).join(', ')}}
async function fetchWeather(lat,lon,label){const current='temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation';const daily='weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max';const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${current}&daily=${daily}&timezone=auto&forecast_days=7`;const r=await fetch(url);if(!r.ok)throw new Error('Wetterdienst nicht erreichbar.');const j=await r.json();const days=j.daily.time.map((date,i)=>({date,code:j.daily.weather_code[i],maxTemp:j.daily.temperature_2m_max[i],minTemp:j.daily.temperature_2m_min[i],precipitation:j.daily.precipitation_sum[i],precipProbability:j.daily.precipitation_probability_max[i],gust:j.daily.wind_gusts_10m_max[i]}));return{label,lat,lon,current:j.current,days,fetchedAt:Date.now()}}
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
async function refreshWeather(force=false){if(!data.privacy?.consents?.weather){
  const ok=await appConfirm({title:'Wetterdienst verwenden?',text:'Für die Wetterabfrage wird der eingetragene Ort an Open-Meteo übertragen.',confirmLabel:'Erlauben',icon:'🌦️'});
  if(ok){data.privacy.consents.weather=true;data.privacy.acceptedAt=new Date().toISOString();saveData('Einwilligung geändert','Wetterdienst erlaubt')}else return
}if(window.weatherLoading)return;const place=(data.settings.weatherLocation||data.settings.address||'Neubiberg').trim();if(!place)return renderWeatherError('Bitte in Betrieb → Wetter-Standort einen Ort eintragen.');try{window.weatherLoading=true;document.getElementById('weatherRisk').textContent='Wetterdaten werden geladen …';const geo=await geocodeWeatherPlace(place),w=await fetchWeather(geo.latitude,geo.longitude,geo.label);localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify({savedAt:Date.now(),data:w}));renderWeatherData(w,todayISO())}catch(e){renderWeatherError(e.message||'Wetter konnte nicht geladen werden.')}finally{window.weatherLoading=false}}
async function loadWeatherFromForm(){if(!data.privacy?.consents?.weather){toast('Wetter zuerst unter Datenschutz erlauben');return}const place=document.getElementById('weatherSearch').value,date=document.getElementById('weatherDate').value||todayISO();try{document.getElementById('weatherPageRisk').textContent='Wetterdaten werden geladen …';const geo=await geocodeWeatherPlace(place),w=await fetchWeather(geo.latitude,geo.longitude,geo.label);renderWeatherData(w,date)}catch(e){renderWeatherError(e.message)}}
async function useDeviceLocation(){if(!data.privacy?.consents?.location){
  const ok=await appConfirm({title:'Standort verwenden?',text:'Die App fragt deinen aktuellen Gerätestandort nur für diese Wetterfunktion ab.',confirmLabel:'Standort erlauben',icon:'📍'});
  if(ok){data.privacy.consents.location=true;data.privacy.acceptedAt=new Date().toISOString();saveData('Einwilligung geändert','Standort erlaubt')}else return
}if(!navigator.geolocation)return toast('Standort wird nicht unterstützt');navigator.geolocation.getCurrentPosition(async p=>{try{const w=await fetchWeather(p.coords.latitude,p.coords.longitude,'Aktueller Standort');renderWeatherData(w,document.getElementById('weatherDate').value||todayISO())}catch(e){renderWeatherError(e.message)}},()=>toast('Standortzugriff nicht erlaubt'),{enableHighAccuracy:false,timeout:10000})}
function openJobWeather(id){const j=data.jobs.find(x=>x.id===id);if(!j)return;showScreen('weather');document.getElementById('weatherSearch').value=j.address||data.settings.weatherLocation||data.settings.address;document.getElementById('weatherDate').value=j.start||todayISO();loadWeatherFromForm()}


function updateConsent(type,value){data.privacy=data.privacy||structuredClone(defaultData.privacy);data.privacy.consents[type]=!!value;data.privacy.version=PRIVACY_VERSION;data.privacy.acceptedAt=new Date().toISOString();if(type==='weather'&&!value)localStorage.removeItem(WEATHER_CACHE_KEY);saveData('Einwilligung geändert',`${type}: ${value?'erteilt':'widerrufen'}`);toast(value?'Einwilligung gespeichert':'Einwilligung widerrufen')}
function setRole(role){data.privacy.role=role;saveData('Rolle geändert',role);toast('Rolle gespeichert')}
function roleText(role){return({owner:'Chef / Inhaber: Vollzugriff auf Betrieb, Preise, Kunden und Dokumente.',office:'Büro: vorgesehen für Kunden, Angebote, Kalender und Rechnungen.',worker:'Mitarbeiter: vorgesehen für zugewiesene Baustellen, Fotos und Zeiten – ohne Preisänderungen.'})[role]||''}
function renderPrivacy(){if(!data.privacy)data.privacy=structuredClone(defaultData.privacy);const c=data.privacy.consents||{};['Weather','Location','External','Analytics'].forEach(k=>{const e=document.getElementById('consent'+k);if(e)e.checked=!!c[k.toLowerCase()]});const role=document.getElementById('currentRole');if(role)role.value=data.privacy.role||'owner';const rd=document.getElementById('roleDescription');if(rd)rd.textContent=roleText(data.privacy.role||'owner');const log=document.getElementById('auditLog');if(log)log.innerHTML=(data.audit||[]).length?(data.audit||[]).map(x=>`<div class="auditRow"><b>${escapeHTML(x.action)}</b><div class="mini">${new Date(x.at).toLocaleString('de-DE')}${x.details?' · '+escapeHTML(x.details):''}</div></div>`).join(''):'<div class="empty">Noch keine protokollierten Änderungen.</div>'}
function exportPrivacyData(){const copy={exportedAt:new Date().toISOString(),privacyVersion:PRIVACY_VERSION,company:data.settings,customers:data.customers,offers:data.offers,events:data.events,tasks:data.tasks,jobs:data.jobs,invoices:data.invoices,consents:data.privacy?.consents||{},audit:data.audit||[]};downloadBlob(JSON.stringify(copy,null,2),'meine-daten-angebotspilot.json','application/json');addAudit('Datenkopie exportiert');localStorage.setItem(KEY,JSON.stringify(data));renderPrivacy()}
function resetAppPrivacy(){openDeleteDataModal()}

const legalDocs={
privacyPolicy:`DATENSCHUTZHINWEIS – TECHNISCHER ENTWURF\n\nVerantwortlicher\n[Unternehmensname, vollständige Anschrift, E-Mail, Telefon ergänzen]\n\nLokale Verarbeitung\nDie aktuelle Testversion speichert Firmendaten, Kundendaten, Angebote, Termine, Aufgaben und Baustellen ausschließlich im lokalen Browser-Speicher des verwendeten Geräts. Es besteht derzeit kein zentrales Benutzerkonto und keine automatische Cloud-Sicherung.\n\nWetterdienst\nNur nach Einwilligung wird der eingegebene Ort bzw. eine Baustellenadresse an Open-Meteo übertragen, um Wetterdaten abzurufen. Der Gerätestandort wird nur nach einer separaten Aktion und Browserfreigabe verwendet.\n\nExterne Dienste\nBeim bewussten Öffnen von Google Maps, Google Kalender oder WhatsApp können die ausgewählten Daten an den jeweiligen Anbieter übertragen werden. Vor der ersten Nutzung wird eine Einwilligung eingeholt.\n\nSpeicherdauer und Löschung\nDie Daten bleiben im Browser gespeichert, bis sie durch den Nutzer, den Browser oder die Funktion „Alle App-Daten löschen“ entfernt werden. Eine Datenkopie kann als JSON exportiert werden.\n\nBetroffenenrechte\nBei der späteren Cloud-Version werden Prozesse für Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch vorgesehen.\n\nHinweis\nDieser Text muss vor einem kommerziellen Start an die tatsächlichen Dienste, Rechtsgrundlagen, Auftragsverarbeiter und Kontaktdaten angepasst und rechtlich geprüft werden.`,
imprint:`IMPRESSUM – ENTWURF\n\nAngaben gemäß § 5 DDG\n${data.settings.companyName||'[Firmenname]'}\n${data.settings.ownerName||'[Vertretungsberechtigte Person]'}\n${data.settings.address||'[Vollständige Anschrift]'}\n\nKontakt\nTelefon: ${data.settings.phone||'[Telefon]'}\nE-Mail: ${data.settings.email||'[E-Mail]'}\n\nWeitere Pflichtangaben\n[Rechtsform, Register, Registernummer, Umsatzsteuer-ID, zuständige Kammer oder Berufsangaben ergänzen, soweit zutreffend.]\n\nVerantwortlich für Inhalte\n[Name und Anschrift ergänzen.]`,
terms:`NUTZUNGSBEDINGUNGEN – ENTWURF\n\n1. Zweck\nAngebotsPilot unterstützt Betriebe bei der Organisation von Kunden, Angeboten, Terminen, Aufgaben und Baustellen.\n\n2. Eigenverantwortliche Prüfung\nAlle Preise, Berechnungen, Texte, Wetterhinweise und Dokumente müssen vor Nutzung oder Versand durch den Betrieb geprüft werden. Die App ersetzt keine steuerliche, rechtliche, technische oder sicherheitsbezogene Beratung.\n\n3. Datensicherung\nIn der Offline-Testversion ist der Nutzer selbst für regelmäßige Backups verantwortlich. Browserdaten können durch Gerätewechsel, Zurücksetzen oder Browserbereinigung verloren gehen.\n\n4. Wetter\nWetterinformationen sind nur Planungshilfen. Für sicherheitskritische Arbeiten sind amtliche Warnungen und die Bedingungen vor Ort maßgeblich.\n\n5. Verfügbarkeit\nFür die Testversion wird keine ununterbrochene Verfügbarkeit oder Fehlerfreiheit garantiert.`,
architecture:`DATENSCHUTZ- UND SICHERHEITSARCHITEKTUR\n\nJETZIGE OFFLINE-VERSION\n• Lokale Speicherung im Browser\n• Keine zentrale Nutzerverwaltung\n• Keine KI-Übertragung\n• Wetter nur nach Einwilligung\n• Standort nur auf Nutzeraktion\n• Externe Apps nur nach Hinweis\n• Datenexport und vollständige Löschung\n• Lokales Änderungsprotokoll\n\nSPÄTERE CLOUD-VERSION\n• Getrennte Mandanten pro Betrieb\n• Serverseitig erzwungene Rollen: Inhaber, Büro, Mitarbeiter\n• Datenbankregeln, sodass kein Betrieb fremde Daten lesen kann\n• Verschlüsselte Übertragung per HTTPS\n• Verschlüsselte Backups und Wiederherstellungstests\n• Mehrfaktor-Authentifizierung für Inhaber\n• Protokollierung sicherheitsrelevanter Aktionen\n• Lösch- und Aufbewahrungskonzept\n• Verträge zur Auftragsverarbeitung mit Dienstleistern\n• EU/EWR-Hosting nach dokumentierter Prüfung\n• Geheimnisse nur serverseitig, niemals in App oder GitHub\n• KI nur nach Aktivierung, Datenminimierung und möglichst Pseudonymisierung\n• Regelmäßige Updates, Abhängigkeitsprüfungen und Sicherheits-Tests\n\nAPP-BERECHTIGUNGEN\n• Kamera: erst bei Fotoaufnahme\n• Mikrofon: erst bei Spracheingabe\n• Standort: erst bei Navigation/Wetter auf Nutzeraktion\n• Benachrichtigungen: erst nach verständlicher Erklärung\n• Kontakte: nicht vorgesehen\n\nVor Store-Veröffentlichung sind eine Datenschutz-Folgenprüfung je nach Funktionsumfang, ein Verzeichnis der Verarbeitungstätigkeiten, Löschfristen, Incident-Prozess und rechtliche Prüfung zu klären.`};
function openLegal(type){document.getElementById('legalTitle').textContent=({privacyPolicy:'Datenschutzhinweis',imprint:'Impressum',terms:'Nutzungsbedingungen',architecture:'Sicherheitsplan'})[type]||'Dokument';document.getElementById('legalContent').textContent=legalDocs[type]||'';showScreen('legal')}

function downloadBlob(content,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportBackup(){downloadBlob(JSON.stringify(data,null,2),'angebotspilot-backup.json','application/json')}
function importBackup(ev){const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{data=JSON.parse(r.result);saveData();toast('Backup importiert')}catch(e){toast('Ungültiges Backup')}};r.readAsText(f)}
function resetApp(){resetAppPrivacy()}
document.getElementById('weatherDate').value=todayISO();

function setLocalRole(role){
  data.privacy=data.privacy||{};data.privacy.role=role;localStorage.setItem(KEY,JSON.stringify(data));applyRoleUI();renderPrivacy();toast(role==='owner'?'👑 Chef-Ansicht':role==='office'?'🗂️ Büro-Ansicht':'🛠️ Mitarbeiter-Ansicht');
}
function applyRoleUI(){
  const role=data.privacy?.role||'owner';
  document.body.dataset.role=role;
  document.querySelectorAll('[data-rolechoice]').forEach(b=>b.classList.toggle('active',b.dataset.rolechoice===role));
  const t=document.getElementById('rolePermissionText');
  if(t)t.innerHTML=role==='owner'?'<b>Chef:</b> Vollzugriff auf Kunden, Preise, Angebote, Rechnungen, Betrieb und Dokumentation.':role==='office'?'<b>Büro:</b> Kunden, Angebote, Rechnungen, Kalender und Dokumentation. Keine kritischen Betriebseinstellungen.':'<b>Mitarbeiter:</b> Vorgesehene Ansicht für zugewiesene Baustellen, Fotos, Notizen und Zeiten. Preise, Rechnungen und Betrieb bleiben verborgen.';
}

applyRoleUI();
renderAll();
setTimeout(()=>{if(shouldShowOnboarding())openOnboarding();else maybeAskOwnerName();},120);
setTimeout(()=>refreshWeather(false),250);


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

