/* AngebotsPilot v11.32.8 – global fuzzy Smart Search (offline, no AI costs). */
(function(){
  'use strict';

  const MAX_RESULTS=14;
  const MIN_SCORE=0.36;
  let openState=false;
  let selectedIndex=0;
  let currentResults=[];
  let inputTimer=null;

  const UI={
    de:{title:'In AngebotsPilot suchen',placeholder:'z. B. offene Rechnung, Müller, Baustellenchat …',hint:'Du kannst auch ungenau schreiben. Tippfehler und ähnliche Begriffe werden erkannt.',no:'Nichts Passendes gefunden',noSub:'Versuche einen kürzeren oder ähnlichen Begriff.',quick:'Schnell finden',close:'Schließen',section:'Bereich',action:'Aktion',customer:'Kunde',offer:'Angebot',invoice:'Rechnung',job:'Baustelle',task:'Aufgabe',event:'Termin',catalog:'Katalog',open:'Öffnen',shortcut:'⌘/Ctrl + K',result:'Treffer'},
    en:{title:'Search AngebotsPilot',placeholder:'e.g. open invoice, customer, site chat …',hint:'You can type naturally. Typos and similar terms are recognised.',no:'No matching result',noSub:'Try a shorter or similar phrase.',quick:'Quick find',close:'Close',section:'Section',action:'Action',customer:'Customer',offer:'Offer',invoice:'Invoice',job:'Job',task:'Task',event:'Appointment',catalog:'Catalog',open:'Open',shortcut:'⌘/Ctrl + K',result:'results'},
    pl:{title:'Szukaj w AngebotsPilot',placeholder:'np. otwarta faktura, klient, czat budowy …',hint:'Możesz pisać niedokładnie. Literówki i podobne pojęcia są rozpoznawane.',no:'Brak pasujących wyników',noSub:'Spróbuj krótszego lub podobnego hasła.',quick:'Szybkie wyszukiwanie',close:'Zamknij',section:'Obszar',action:'Akcja',customer:'Klient',offer:'Oferta',invoice:'Faktura',job:'Budowa',task:'Zadanie',event:'Termin',catalog:'Katalog',open:'Otwórz',shortcut:'⌘/Ctrl + K',result:'wyniki'},
    ro:{title:'Caută în AngebotsPilot',placeholder:'ex. factură deschisă, client, chat șantier …',hint:'Poți scrie aproximativ. Greșelile și termenii similari sunt recunoscuți.',no:'Niciun rezultat potrivit',noSub:'Încearcă un termen mai scurt sau similar.',quick:'Căutare rapidă',close:'Închide',section:'Secțiune',action:'Acțiune',customer:'Client',offer:'Ofertă',invoice:'Factură',job:'Șantier',task:'Sarcină',event:'Programare',catalog:'Catalog',open:'Deschide',shortcut:'⌘/Ctrl + K',result:'rezultate'},
    hr:{title:'Pretraži AngebotsPilot',placeholder:'npr. otvoreni račun, klijent, chat gradilišta …',hint:'Možeš pisati približno. Prepoznaju se tipfeleri i slični pojmovi.',no:'Nema odgovarajućih rezultata',noSub:'Pokušaj kraći ili sličan pojam.',quick:'Brza pretraga',close:'Zatvori',section:'Područje',action:'Radnja',customer:'Klijent',offer:'Ponuda',invoice:'Račun',job:'Gradilište',task:'Zadatak',event:'Termin',catalog:'Katalog',open:'Otvori',shortcut:'⌘/Ctrl + K',result:'rezultati'},
    bs:{title:'Pretraži AngebotsPilot',placeholder:'npr. otvoreni račun, klijent, chat gradilišta …',hint:'Možeš pisati približno. Tipfeleri i slični pojmovi se prepoznaju.',no:'Nema odgovarajućih rezultata',noSub:'Pokušaj kraći ili sličan pojam.',quick:'Brza pretraga',close:'Zatvori',section:'Područje',action:'Radnja',customer:'Klijent',offer:'Ponuda',invoice:'Račun',job:'Gradilište',task:'Zadatak',event:'Termin',catalog:'Katalog',open:'Otvori',shortcut:'⌘/Ctrl + K',result:'rezultati'},
    sr:{title:'Pretraži AngebotsPilot',placeholder:'npr. otvoren račun, klijent, chat gradilišta …',hint:'Možeš pisati približno. Greške i slični pojmovi se prepoznaju.',no:'Nema odgovarajućih rezultata',noSub:'Pokušaj kraći ili sličan pojam.',quick:'Brza pretraga',close:'Zatvori',section:'Oblast',action:'Radnja',customer:'Klijent',offer:'Ponuda',invoice:'Račun',job:'Gradilište',task:'Zadatak',event:'Termin',catalog:'Katalog',open:'Otvori',shortcut:'⌘/Ctrl + K',result:'rezultati'},
    fr:{title:'Rechercher dans AngebotsPilot',placeholder:'ex. facture ouverte, client, chat chantier …',hint:'Tu peux écrire approximativement. Les fautes et termes proches sont reconnus.',no:'Aucun résultat correspondant',noSub:'Essaie un terme plus court ou similaire.',quick:'Recherche rapide',close:'Fermer',section:'Rubrique',action:'Action',customer:'Client',offer:'Devis',invoice:'Facture',job:'Chantier',task:'Tâche',event:'Rendez-vous',catalog:'Catalogue',open:'Ouvrir',shortcut:'⌘/Ctrl + K',result:'résultats'},
    it:{title:'Cerca in AngebotsPilot',placeholder:'es. fattura aperta, cliente, chat cantiere …',hint:'Puoi scrivere in modo approssimativo. Refusi e termini simili vengono riconosciuti.',no:'Nessun risultato corrispondente',noSub:'Prova un termine più breve o simile.',quick:'Ricerca rapida',close:'Chiudi',section:'Sezione',action:'Azione',customer:'Cliente',offer:'Preventivo',invoice:'Fattura',job:'Cantiere',task:'Attività',event:'Appuntamento',catalog:'Catalogo',open:'Apri',shortcut:'⌘/Ctrl + K',result:'risultati'},
    tr:{title:'AngebotsPilot içinde ara',placeholder:'örn. açık fatura, müşteri, şantiye sohbeti …',hint:'Yaklaşık yazabilirsin. Yazım hataları ve benzer terimler algılanır.',no:'Uygun sonuç bulunamadı',noSub:'Daha kısa veya benzer bir terim dene.',quick:'Hızlı bul',close:'Kapat',section:'Bölüm',action:'İşlem',customer:'Müşteri',offer:'Teklif',invoice:'Fatura',job:'Şantiye',task:'Görev',event:'Randevu',catalog:'Katalog',open:'Aç',shortcut:'⌘/Ctrl + K',result:'sonuç'}
  };

  const STOP=new Set(('der die das ein eine einer einen einem und oder ich du wir ihr mein meine meiner meinen wo wie was ist sind kann koennen konnte bitte mir im in am an auf zu zum zur von fuer fur mit bei als auch noch mal etwas den dem des finde finden zeigen oeffnen öffnen go gehe möchte moechte will brauche suchen suche such').split(/\s+/));
  const SYNONYM_GROUPS=[
    ['rechnung','rechnungen','invoice','invoices','faktura','facture','fattura','fatura','racun','račun','rechnung schreiben','zahlung','bezahlen','fällig','faellig','mahnung'],
    ['angebot','angebote','quote','estimate','devis','preventivo','oferta','ponuda','teklif','kostenvoranschlag','preisangebot'],
    ['kunde','kunden','customer','client','klient','cliente','müşteri','musteri','auftraggeber','kontakt'],
    ['baustelle','baustellen','job','jobs','chantier','cantiere','santier','șantier','gradiliste','gradilište','şantiye','santiye','auftrag','projekt','einsatz'],
    ['aufgabe','aufgaben','task','tasks','zadanie','sarcina','sarcină','zadatak','tache','tâche','attivita','attività','gorev','görev','todo'],
    ['termin','termine','kalender','calendar','appointment','appointments','rendezvous','rendez-vous','appuntamento','programare','randevu','spotkanie'],
    ['team','mitarbeiter','mitarbeiterin','kollege','arbeiter','employee','employees','staff','pracownik','angajat','zaposlenik','dipendente','employe','employé','çalışan','calisan','einladen','einladung'],
    ['chat','baustellenchat','nachricht','nachrichten','message','messages','sohbet','wiadomosc','wiadomość','poruka','messaggio','mesaj'],
    ['sprachmemo','sprachnachricht','voice','audio','aufnahme','diktat','sesli','memo'],
    ['einstellung','einstellungen','settings','betrieb','firma','company','ustawienia','setari','setări','impostazioni','parametres','paramètres','ayarlar'],
    ['datenschutz','privacy','gizlilik','confidentialite','confidentialité','prywatnosc','prywatność','protectia datelor','protecția datelor','privatnost','privacy'],
    ['sicherheit','security','passwort','password','kennwort','şifre','sifre','mot de passe','haslo','hasło','lozinka','parola'],
    ['abo','abonnement','subscription','billing','abrechnung','tarif','plan','zahlungsmethode'],
    ['wetter','weather','meteo','hava','pogoda','vremea','vrijeme','meteo'],
    ['katalog','material','leistung','catalog','catalogue','catalogo','pozycja','position','artikel'],
    ['postfach','email','e-mail','mail','sekretariat','secretariat','assistant','inbox','posta','casella'],
    ['backup','datensicherung','sicherung','export','import','wiederherstellen'],
    ['benachrichtigung','benachrichtigungen','notification','notifications','push','meldung','meldungen'],
    ['heute','today','bugun','bugün','dzis','dziś','astazi','astăzi','danas','aujourdhui','aujourd’hui','oggi']
  ];
  const SYN=new Map();

  function normalize(value){
    return String(value??'')
      .toLowerCase()
      .replace(/ß/g,'ss')
      .replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[-_/]+/g,' ')
      .replace(/[^a-z0-9@.+]+/g,' ')
      .trim().replace(/\s+/g,' ');
  }
  for(const group of SYNONYM_GROUPS){
    const canon=normalize(group[0]);
    for(const term of group)SYN.set(normalize(term),canon);
  }
  function stemRaw(token){
    let t=token;
    if(t.length>6)t=t.replace(/(ungen|ung|ern|est|isch|en|er|es|e|n|s)$/,'');
    return t;
  }
  function tokens(value){
    const n=normalize(value);if(!n)return[];
    const out=[];
    for(const x of n.split(' ').filter(Boolean).filter(x=>!STOP.has(x))){
      const raw=stemRaw(x);if(raw)out.push(raw);
      const canon=SYN.get(x);if(canon){const c=stemRaw(canon);if(c&&c!==raw)out.push(c)}
    }
    return out;
  }
  // Small Damerau-Levenshtein optimized for search tokens.
  function distance(a,b){
    if(a===b)return 0;
    const m=a.length,n=b.length;
    const d=Array.from({length:m+1},()=>new Array(n+1).fill(0));
    for(let i=0;i<=m;i++)d[i][0]=i;for(let j=0;j<=n;j++)d[0][j]=j;
    for(let i=1;i<=m;i++)for(let j=1;j<=n;j++){
      const cost=a[i-1]===b[j-1]?0:1;
      d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+cost);
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+cost);
    }
    return d[m][n];
  }
  function tokenSimilarity(a,b){
    if(!a||!b)return 0;
    if(a===b)return 1;
    if(a.length>=3&&b.startsWith(a))return .93;
    if(b.length>=3&&a.startsWith(b))return .88;
    if(a.length>=4&&b.includes(a))return .84;
    if(b.length>=4&&a.includes(b))return .8;
    const longest=Math.max(a.length,b.length),dist=distance(a,b);
    if(longest<=3)return dist===1?.62:0;
    if(dist===1)return .82;
    if(dist===2&&longest>=6)return .66;
    const ratio=1-dist/longest;
    return ratio>=.62?ratio*.78:0;
  }
  function score(query,text){
    const qn=normalize(query),tn=normalize(text);if(!qn||!tn)return 0;
    if(tn===qn)return 1.15;
    if(tn.startsWith(qn))return 1.05;
    if(tn.includes(qn))return .98;
    const qt=tokens(qn),tt=tokens(tn);if(!qt.length||!tt.length)return 0;
    let total=0,matched=0;
    for(const q of qt){
      let best=0;
      for(const t of tt)best=Math.max(best,tokenSimilarity(q,t));
      total+=best;if(best>=.55)matched++;
    }
    const coverage=matched/qt.length;
    return (total/qt.length)*(.72+.28*coverage);
  }
  function intentBoost(query,item){
    const q=normalize(query);let b=0;
    const has=(re)=>re.test(q);
    if(item.type==='invoice'&&has(/\b(rechn|rechnung|invoice|faktura|facture|fattura|fatura|racun)\w*/))b+=.13;
    if(item.type==='offer'&&has(/\b(angebot|quote|estimate|devis|preventivo|oferta|ponuda|teklif)\w*/))b+=.12;
    if(item.type==='customer'&&has(/\b(kund|kunde|customer|client|klient|cliente|musteri)\w*/))b+=.12;
    if(item.type==='job'&&has(/\b(baust|job|chantier|cantiere|santier|gradili|projekt|auftrag)\w*/))b+=.12;
    if(item.type==='task'&&has(/\b(aufgab|task|zadani|sarcin|zadat|tache|attivit|gorev|todo)\w*/))b+=.12;
    if(item.type==='event'&&has(/\b(termin|kalender|calendar|appointment|rendez|appuntament|programar|randevu)\w*/))b+=.12;
    if(item.type==='catalog'&&has(/\b(katalog|catalog|catalogue|catalogo|material|leistung|position|artikel)\w*/))b+=.16;
    return b;
  }
  function combinedScore(query,item){
    const fields=[item.title,item.subtitle,item.keywords,item.number,item.status].filter(Boolean);
    let best=0;
    fields.forEach((f,i)=>{const s=score(query,f)*(i===0?1.05:1);if(s>best)best=s});
    const all=fields.join(' '),whole=score(query,all);if(whole>best)best=whole;
    const q=tokens(query),allTokens=new Set(tokens(all));
    if(q.length>1&&q.every(t=>[...allTokens].some(a=>tokenSimilarity(t,a)>=.66)))best+=.08;
    return Math.min(1.2,best+(Number(item.boost)||0)+intentBoost(query,item));
  }

  function lang(){return globalThis.API18n?.language?.()||document?.documentElement?.dataset?.uiLanguage||'de'}
  function ui(key){const l=lang();return UI[l]?.[key]||UI.de[key]||key}
  function t(key,fallback){return globalThis.API18n?.t?.(key)||fallback||key}
  function role(){return globalThis.data?.privacy?.role||'owner'}
  function canOffice(){return role()!=='worker'}
  function canOwner(){return role()==='owner'}
  function customerName(id){return (globalThis.data?.customers||[]).find(c=>c.id===id)?.name||''}
  function statusLabel(v){
    const map={draft:'Entwurf',sent:'Versendet',accepted:'Angenommen',open:'Offen',paid:'Bezahlt',done:'Erledigt',active:'Aktiv',planned:'Geplant'};
    return map[v]||v||'';
  }
  function fmtDate(v){if(!v)return'';try{return globalThis.API18n?.formatDate?.(v,{day:'2-digit',month:'2-digit',year:'numeric'})||v}catch{return v}}
  function screen(id){if(document.getElementById(id))globalThis.showScreen?.(id)}
  function safeCall(name,...args){const fn=globalThis[name];if(typeof fn==='function')return fn(...args)}

  function staticItems(){
    const all=[
      {id:'section-today',icon:'⌂',type:'section',title:t('today','Heute'),subtitle:'Startseite & Tagesübersicht',keywords:'heute start home dashboard tagesübersicht wichtig',run:()=>screen('today')},
      {id:'customers',icon:'👤',type:'section',title:t('customers','Kunden'),subtitle:'Kundenakten, Kontakte und Adressen',keywords:'kunde kunden kontakt adresse telefon email kundenakte auftraggeber',office:true,run:()=>screen('customers')},
      {id:'new-customer',icon:'＋',type:'action',title:t('new_customer','Neuer Kunde'),subtitle:'Kunden neu anlegen',keywords:'neuen kunde anlegen erstellen hinzufügen kontakt erfassen',office:true,boost:.03,run:()=>safeCall('newCustomer')},
      {id:'offers',icon:'📄',type:'section',title:t('offers','Angebote'),subtitle:'Angebote suchen, bearbeiten und versenden',keywords:'angebot angebote kostenvoranschlag preisangebot quote estimate',office:true,run:()=>screen('offers')},
      {id:'new-offer',icon:'＋',type:'action',title:t('new_offer','Neues Angebot'),subtitle:'Ein neues Angebot erstellen',keywords:'angebot schreiben erstellen machen neu kostenvoranschlag',office:true,boost:.03,run:()=>safeCall('newOffer')},
      {id:'invoices',icon:'🧾',type:'section',title:t('invoices','Rechnungen'),subtitle:'Rechnungen, Zahlungen und Mahnungen',keywords:'rechnung rechnungen faktura invoice zahlung bezahlt offen fällig mahnung',office:true,run:()=>screen('invoices')},
      {id:'new-invoice',icon:'＋',type:'action',title:t('new_invoice','Neue Rechnung erstellen'),subtitle:'Eine neue Rechnungsposition starten',keywords:'rechnung schreiben erstellen machen neu faktura invoice abrechnen',office:true,boost:.04,run:()=>safeCall('newInvoice')},
      {id:'jobs',icon:'🏗️',type:'section',title:t('jobs','Baustellen'),subtitle:'Baustellen, Einsätze, Fotos und Dokumentation',keywords:'baustelle baustellen auftrag job projekt einsatz zeiterfassung fotos dokumente',run:()=>screen('jobs')},
      {id:'job-chat',icon:'💬',type:'action',title:t('chat','Baustellenchat'),subtitle:'Nachrichten und Sprachmemos einer Baustelle',keywords:'baustelle baustellen baustellenchat chat nachricht schreiben sprachmemo sprachnachricht übersetzen team kommunikation teilnehmer chef büro hinzufügen entfernen eingeteilt zugewiesen foto bilder galerie akte speichern teilen',run:()=>screen('jobs')},
      {id:'offer-voice',icon:'🎙️',type:'action',title:t('offer_voice','Sprachmemo zum Angebot'),subtitle:'Diktat und interner Voice-Hinweis im Angebot',keywords:'angebot sprachmemo sprachnachricht diktat voice notiz transkript angebotstext einsprechen',office:true,run:()=>screen('offers')},
      {id:'tasks',icon:'✓',type:'section',title:t('tasks','Aufgaben'),subtitle:'Offene und erledigte Aufgaben',keywords:'aufgabe aufgaben todo erledigen offen',run:()=>screen('tasks')},
      {id:'new-task',icon:'＋',type:'action',title:'Neue Aufgabe',subtitle:'Eine Aufgabe anlegen',keywords:'aufgabe erstellen anlegen neu todo',run:()=>safeCall('newTask')},
      {id:'calendar',icon:'🗓️',type:'section',title:t('calendar','Kalender'),subtitle:'Termine und Baustellenplanung',keywords:'kalender termin termine planung datum appointment',run:()=>screen('calendar')},
      {id:'new-event',icon:'＋',type:'action',title:'Neuer Termin',subtitle:'Einen Termin anlegen',keywords:'termin erstellen anlegen neu kalender appointment',office:true,run:()=>safeCall('newEvent')},
      {id:'catalog',icon:'🧰',type:'section',title:'Material & Leistungen',subtitle:'Leistungskatalog, Material und Preise',keywords:'katalog material leistung position artikel preis standardposition',office:true,run:()=>screen('catalog')},
      {id:'team',icon:'👥',type:'section',title:t('team','Team'),subtitle:'Mitarbeiter, Einladungen und Arbeitszeiten',keywords:'team mitarbeiter einladen kollege arbeiter zeiten arbeitszeit rollen',office:true,run:()=>safeCall('openTeam')||screen('team')},
      {id:'mail',icon:'✦',type:'section',title:t('secretariat','Sekretariat'),subtitle:'Postfach, Kundenmails und Antwortfreigaben',keywords:'sekretariat postfach mail email e-mail inbox antwort freigabe',office:true,run:()=>safeCall('openEmailAssistant')||screen('emailAssistant')},
      {id:'notifications',icon:'🔔',type:'section',title:t('notifications','Benachrichtigungen'),subtitle:'Meldungen und Push-Nachrichten',keywords:'benachrichtigung meldung push notification',run:()=>safeCall('openNotifications')||screen('notifications')},
      {id:'weather',icon:'🌦️',type:'section',title:t('weather','Wetter'),subtitle:'Wetter und Außenarbeiten planen',keywords:'wetter regen sonne temperatur wetterbericht außenarbeit weather',run:()=>screen('weather')},
      {id:'settings',icon:'⚙️',type:'section',title:t('settings','Einstellungen'),subtitle:'Firmendaten, Steuern, Dokumentdesign und Backup',keywords:'einstellung einstellungen betrieb firma firmendaten steuer steuersatz iban logo design backup datensicherung app sprache',owner:true,run:()=>screen('settings')},
      {id:'backup',icon:'💾',type:'action',title:t('backup','Datensicherung'),subtitle:'Backup exportieren oder importieren',keywords:'backup datensicherung sichern wiederherstellen export import daten sichern',owner:true,run:()=>screen('settings')},
      {id:'privacy',icon:'🔐',type:'section',title:t('privacy_security','Datenschutz & Sicherheit'),subtitle:'Einwilligungen, Berechtigungen und Datenexport',keywords:'datenschutz privacy sicherheit berechtigungen einwilligung daten löschen datenexport',run:()=>screen('privacy')},
      {id:'password',icon:'🔑',type:'action',title:t('change_password','Passwort ändern'),subtitle:'Kontosicherheit und Passwort',keywords:'passwort ändern vergessen kennwort password sicherheit konto',run:()=>safeCall('securityOpenPasswordChange')||screen('cloudAccount')},
      {id:'account',icon:'☁️',type:'section',title:t('account','Konto'),subtitle:'Betriebskonto, Cloud und Anmeldung',keywords:'konto account cloud anmelden abmelden login email passwort',run:()=>safeCall('openCloudAccount')||screen('cloudAccount')},
      {id:'subscription',icon:'💳',type:'section',title:t('subscription','Abo & Abrechnung'),subtitle:'Tarif, Zahlungsstatus und Abo-Belege',keywords:'abo abonnement subscription tarif plan abrechnung zahlung belege billing',owner:true,run:()=>safeCall('openSubscription')||screen('subscription')},
      {id:'legal',icon:'⚖️',type:'section',title:t('legal','Rechtliches'),subtitle:'Datenschutz, Impressum, Nutzung und Sicherheitsplan',keywords:'recht rechtliches impressum datenschutz nutzung agb sicherheitsplan',owner:true,run:()=>screen('legal')},
      {id:'import',icon:'⇩',type:'action',title:'Bestandskunden importieren',subtitle:'CSV/XLSX Kundenimport',keywords:'kunden importieren csv xlsx excel bestandskunden import',office:true,run:()=>screen('customerImport')}
    ];
    return all.filter(x=>(!x.office||canOffice())&&(!x.owner||canOwner()));
  }

  function dataItems(){
    const d=globalThis.data||{},items=[];
    if(canOffice()){
      for(const c of d.customers||[])items.push({id:'customer-'+c.id,icon:'👤',type:'customer',title:c.name||'Kunde',subtitle:[c.address,c.phone,c.email].filter(Boolean).join(' · '),keywords:[c.contact,c.notes,c.vatId,c.city,c.postalCode].filter(Boolean).join(' '),boost:.05,run:()=>safeCall('openCustomerFolder',c.id)});
      for(const o of d.offers||[])items.push({id:'offer-'+o.id,icon:'📄',type:'offer',title:o.number||o.subject||'Angebot',subtitle:[o.subject,customerName(o.customerId),statusLabel(o.status)].filter(Boolean).join(' · '),keywords:[o.notes,...(o.lines||[]).map(l=>l.name)].filter(Boolean).join(' '),number:o.number,status:o.status,boost:.04,run:()=>safeCall('editOffer',o.id)});
      for(const inv of d.invoices||[])items.push({id:'invoice-'+inv.id,icon:'🧾',type:'invoice',title:inv.number||inv.subject||'Rechnung',subtitle:[inv.subject,customerName(inv.customerId),statusLabel(inv.status),inv.dueDate?('Fällig '+fmtDate(inv.dueDate)):''].filter(Boolean).join(' · '),keywords:[inv.notes,inv.offerNumber,...(inv.lines||[]).map(l=>l.name)].filter(Boolean).join(' '),number:inv.number,status:inv.status,boost:.05,run:()=>safeCall('editInvoice',inv.id)});
    }
    for(const j of d.jobs||[])items.push({id:'job-'+j.id,icon:'🏗️',type:'job',title:j.title||'Baustelle',subtitle:[customerName(j.customerId),j.address,statusLabel(j.status),j.start?fmtDate(j.start):''].filter(Boolean).join(' · '),keywords:[j.notes,j.docNote,j.assigneeNames?.join?.(' ')].filter(Boolean).join(' '),status:j.status,boost:.04,run:()=>safeCall('editJob',j.id)});
    for(const task of d.tasks||[])items.push({id:'task-'+task.id,icon:task.done?'✓':'○',type:'task',title:task.title||'Aufgabe',subtitle:[task.date?fmtDate(task.date):'',task.done?'Erledigt':'Offen',task.notes].filter(Boolean).join(' · '),keywords:[task.priority,task.notes].filter(Boolean).join(' '),status:task.done?'done':'open',run:()=>safeCall('editTask',task.id)});
    for(const ev of d.events||[])items.push({id:'event-'+ev.id,icon:'🗓️',type:'event',title:ev.title||'Termin',subtitle:[ev.date?fmtDate(ev.date):'',ev.time,ev.address,customerName(ev.customerId)].filter(Boolean).join(' · '),keywords:[ev.type,ev.notes].filter(Boolean).join(' '),run:()=>safeCall('editEvent',ev.id)});
    if(canOffice())for(const c of d.catalog||[])items.push({id:'catalog-'+c.id,icon:(c.type==='material'?'📦':'🛠️'),type:'catalog',title:c.name||'Position',subtitle:[c.type==='material'?'Material':'Leistung',c.unit,Number(c.price)>0?`${c.price} €`:null].filter(Boolean).join(' · '),keywords:[c.trade,c.type,c.unit].filter(Boolean).join(' '),run:()=>{screen('catalog');setTimeout(()=>{const el=document.getElementById('catalogSearch');if(el){el.value=c.name||'';globalThis.renderCatalog?.();el.focus()}},40)}});
    return items;
  }
  function buildIndex(){return [...staticItems(),...dataItems()]}

  function search(query){
    const q=String(query||'').trim();
    if(!q)return quickItems();
    return buildIndex().map(item=>({...item,_score:combinedScore(q,item)})).filter(x=>x._score>=MIN_SCORE).sort((a,b)=>b._score-a._score||String(a.title).localeCompare(String(b.title))).slice(0,MAX_RESULTS);
  }
  function quickItems(){
    const ids=canOffice()?['new-offer','new-invoice','new-customer','jobs','tasks','calendar']:['jobs','job-chat','tasks','calendar','notifications','today'];
    const map=new Map(staticItems().map(x=>[x.id,x]));return ids.map(x=>map.get(x)).filter(Boolean).slice(0,8);
  }

  function els(){return{root:document.getElementById('apSmartSearch'),input:document.getElementById('apSmartSearchInput'),results:document.getElementById('apSmartSearchResults'),title:document.getElementById('apSmartSearchTitle'),hint:document.getElementById('apSmartSearchHint'),close:document.getElementById('apSmartSearchClose'),button:document.getElementById('globalSearchBtn')}}
  function typeLabel(type){return ui(type)||type}
  function render(){
    const {input,results}=els();if(!results)return;
    const q=input?.value||'';currentResults=search(q);selectedIndex=Math.min(selectedIndex,Math.max(0,currentResults.length-1));
    results.replaceChildren();
    const heading=document.createElement('div');heading.className='apSearchGroupLabel';heading.textContent=q.trim()?`${currentResults.length} ${ui('result')}`:ui('quick');results.appendChild(heading);
    if(!currentResults.length){const empty=document.createElement('div');empty.className='apSearchEmpty';const b=document.createElement('b');b.textContent=ui('no');const s=document.createElement('span');s.textContent=ui('noSub');empty.append(b,s);results.appendChild(empty);return}
    currentResults.forEach((item,i)=>{
      const btn=document.createElement('button');btn.type='button';btn.className='apSearchResult'+(i===selectedIndex?' selected':'');btn.dataset.index=String(i);btn.setAttribute('role','option');btn.setAttribute('aria-selected',i===selectedIndex?'true':'false');
      const icon=document.createElement('span');icon.className='apSearchIcon';icon.textContent=item.icon||'⌕';
      const body=document.createElement('span');body.className='apSearchBody';const top=document.createElement('span');top.className='apSearchTitle';top.textContent=item.title||'';const sub=document.createElement('span');sub.className='apSearchSubtitle';sub.textContent=item.subtitle||'';body.append(top);if(item.subtitle)body.append(sub);
      const meta=document.createElement('span');meta.className='apSearchMeta';meta.textContent=typeLabel(item.type);
      btn.append(icon,body,meta);btn.addEventListener('click',()=>activate(i));results.appendChild(btn);
    });
  }
  function updateSelection(next){
    if(!currentResults.length)return;selectedIndex=(next+currentResults.length)%currentResults.length;
    document.querySelectorAll('.apSearchResult').forEach((el,i)=>{el.classList.toggle('selected',i===selectedIndex);el.setAttribute('aria-selected',i===selectedIndex?'true':'false')});
    document.querySelector(`.apSearchResult[data-index="${selectedIndex}"]`)?.scrollIntoView?.({block:'nearest'});
  }
  function activate(index=selectedIndex){const item=currentResults[index];if(!item)return;close();setTimeout(()=>{try{item.run?.()}catch(e){console.error('Smart Search action',e);globalThis.toast?.('Bereich konnte nicht geöffnet werden.')}},30)}
  function localize(){
    const {input,title,hint,close:closeBtn,button}=els();if(title)title.textContent=ui('title');if(input)input.placeholder=ui('placeholder');if(hint)hint.textContent=ui('hint');if(closeBtn){closeBtn.setAttribute('aria-label',ui('close'));closeBtn.title=ui('close')}if(button){button.setAttribute('aria-label',ui('title'));button.title=ui('title')}
  }
  function open(prefill=''){
    const {root,input}=els();if(!root)return;openState=true;root.hidden=false;root.classList.remove('hidden');document.body.classList.add('smartSearchOpen');localize();if(typeof prefill==='string')input.value=prefill;selectedIndex=0;render();setTimeout(()=>{input.focus();input.select?.()},30);
  }
  function close(){const {root}=els();if(!root)return;openState=false;root.classList.add('hidden');root.hidden=true;document.body.classList.remove('smartSearchOpen')}
  function onInput(){clearTimeout(inputTimer);inputTimer=setTimeout(()=>{selectedIndex=0;render()},45)}
  function onKey(e){
    if((e.metaKey||e.ctrlKey)&&String(e.key).toLowerCase()==='k'){e.preventDefault();open();return}
    if(!openState)return;
    if(e.key==='Escape'){e.preventDefault();close()}
    else if(e.key==='ArrowDown'){e.preventDefault();updateSelection(selectedIndex+1)}
    else if(e.key==='ArrowUp'){e.preventDefault();updateSelection(selectedIndex-1)}
    else if(e.key==='Enter'&&document.activeElement?.id==='apSmartSearchInput'){e.preventDefault();activate()}
  }
  function start(){
    const {root,input}=els();if(!root||!input)return;
    input.addEventListener('input',onInput);root.addEventListener('click',e=>{if(e.target===root||e.target?.classList?.contains('apSearchBackdrop'))close()});document.addEventListener('keydown',onKey);document.addEventListener('ap-language-changed',()=>{localize();if(openState)render()});localize();
  }

  globalThis.APSmartSearch={open,close,search,buildIndex,_test:{normalize,tokens,distance,score,combinedScore}};
  globalThis.openSmartSearch=open;
  if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}
})();
