/* AngebotsPilot v11.13 – E-Mail-Sekretärin + Terminlogik + DE/AT/CH-Korrespondenz + echte Mailbox-Grundlage
   Sicherer Testmodus ohne automatischen Mailversand und ohne kostenpflichtige KI-API.
   Klassifikation ist regelbasiert. Aktionen werden erst nach ausdrücklicher Bestätigung ausgeführt. */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const cloud=()=>globalThis.getCloudState?.()||{};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let active=null;
  let items=[];
  let sourceMailMessageId='';

  const intentMeta={
    accepted:{label:'Angebot angenommen',icon:'✅',tone:'accepted'},
    declined:{label:'Angebot abgelehnt',icon:'↩️',tone:'declined'},
    appointment:{label:'Termin / Startanfrage',icon:'📅',tone:'appointment'},
    question:{label:'Kundenfrage',icon:'💬',tone:'question'},
    unknown:{label:'Nicht eindeutig',icon:'🔎',tone:'unknown'}
  };

  function normalize(s){return String(s||'').toLocaleLowerCase('de-DE').replace(/\s+/g,' ').trim()}
  function customerById(id){return (globalThis.data?.customers||[]).find(x=>x.id===id)}
  function offerById(id){return (globalThis.data?.offers||[]).find(x=>x.id===id)}
  function activeJobByOffer(id){return (globalThis.data?.jobs||[]).find(x=>x.offerId===id&&!['done','cancelled','canceled'].includes(String(x.status||'').toLowerCase()))||null}
  function companyName(){return globalThis.data?.settings?.companyName||cloud().company?.name||'Ihr Betrieb'}
  function companyCountryCode(){return String(globalThis.data?.settings?.countryCode||cloud().company?.country_code||'DE').toUpperCase()}
  function correspondenceProfile(){
    const code=companyCountryCode();
    if(code==='CH')return{code,locale:'de-CH',flag:'🇨🇭',label:'Schweizer Hochdeutsch',greetingName:n=>`Grüezi ${n},`,greetingGeneric:'Grüezi,',signoff:'Freundliche Grüsse',thanks:'Besten Dank',offerDative:'unserer Offerte',offerObject:'die Offerte',offerMatchDative:'zur passenden Offerte',offerIndefiniteDative:'einer Offerte',acceptanceLabel:'Annahme der Offerte'};
    if(code==='AT')return{code,locale:'de-AT',flag:'🇦🇹',label:'Österreichisches Standarddeutsch',greetingName:n=>`Grüß Gott ${n},`,greetingGeneric:'Grüß Gott,',signoff:'Freundliche Grüße',thanks:'Vielen Dank',offerDative:'unserem Angebot',offerObject:'das Angebot',offerMatchDative:'zum passenden Angebot',offerIndefiniteDative:'einem Angebot',acceptanceLabel:'Auftragsannahme'};
    return{code:'DE',locale:'de-DE',flag:'🇩🇪',label:'Standarddeutsch (Deutschland)',greetingName:n=>`Guten Tag ${n},`,greetingGeneric:'Guten Tag,',signoff:'Freundliche Grüße',thanks:'Vielen Dank',offerDative:'unserem Angebot',offerObject:'das Angebot',offerMatchDative:'zum passenden Angebot',offerIndefiniteDative:'einem Angebot',acceptanceLabel:'Auftragsannahme'};
  }
  function localizeOutbound(text){const p=correspondenceProfile();return p.code==='CH'?String(text).replace(/ß/g,'ss'):String(text)}
  function deDate(iso){if(!iso)return '–';const p=correspondenceProfile();return new Date(iso+'T12:00:00').toLocaleDateString(p.locale,{day:'2-digit',month:'2-digit',year:'numeric'})}
  function durationLabel(v,u){const p=correspondenceProfile();v=Math.max(u==='hours'?.25:1,Number(v)||1);return u==='hours'?`${v.toLocaleString(p.locale,{maximumFractionDigits:2})} Stunde${v===1?'':'n'}`:`${Math.round(v)} Arbeitstag${Math.round(v)===1?'':'e'}`}
  function updateLocaleHint(){const el=q('emailCorrespondenceLocale');if(!el)return;const p=correspondenceProfile();el.textContent=`${p.flag} Antwortstil: ${p.label} · automatisch nach Firmenland`;}

  function classify(subject,body){
    const t=normalize(`${subject} ${body}`);

    // Negationen haben immer Vorrang vor positiven Treffern.
    // So darf z. B. "wir nehmen das Angebot nicht an" nie als Zusage gelten.
    const declined=[
      /nicht\s+(?:annehmen|annehmen\s+wollen|beauftragen|akzeptieren)/,
      /(?:angebot|auftrag).{0,70}nicht.{0,35}(?:annehmen|an|beauftragen|akzeptieren)/,
      /(?:nehme|nehmen).{0,45}(?:angebot|auftrag).{0,35}nicht.{0,20}an/,
      /kein interesse/,/zu teuer/,/anderweitig entschieden/,
      /lehnen .{0,80} ab/,/lehne .{0,80} ab/,/absagen/,/abgelehnt/,
      /möchten wir nicht/,/moechten wir nicht/,/kommt für uns nicht infrage/,/kommt fuer uns nicht infrage/
    ];

    // Starke Zusageformulierungen. Begrenzte Abstände verhindern zu breite Zufallstreffer.
    const acceptedStrong=[
      /hiermit.{0,30}(?:bestätige|bestaetige|bestätigen|bestaetigen).{0,60}(?:angebot|auftrag)/,
      /(?:ich|wir).{0,20}(?:bestätige|bestaetige|bestätigen|bestaetigen).{0,60}(?:angebot|auftrag)/,
      /(?:ich|wir).{0,25}(?:nehme|nehmen).{0,45}(?:angebot|auftrag).{0,30}an/,
      /(?:angebot|auftrag).{0,90}(?:nehme|nehmen).{0,35}(?:es|dies|das|ihn|diesen)?\s*an/,
      /(?:ich|wir).{0,25}(?:beauftrage|beauftragen).{0,70}(?:sie|ihnen|den auftrag|die arbeiten)/,
      /(?:ich|wir).{0,30}(?:möchte|möchten|moechte|moechten).{0,45}(?:sie|ihnen).{0,45}beauftragen/,
      /(?:ich|wir).{0,30}beauftragen.{0,45}(?:sie|ihnen)/,
      /(?:ich|wir).{0,25}(?:bestätige|bestaetige|bestätigen|bestaetigen).{0,60}(?:offerte|kostenvoranschlag)/,
      /hiermit.{0,40}(?:beauftrage|beauftragen|erteile|erteilen).{0,70}(?:auftrag|arbeiten|sie)/,
      /(?:auftrag|beauftragung).{0,35}(?:erteilt|bestätigt|bestaetigt)/,
      /(?:angebot|auftrag).{0,35}(?:akzeptiert|angenommen)/,
      /(?:offerte|kostenvoranschlag).{0,55}(?:annehmen|akzeptiert|angenommen|bestätigt|bestaetigt)/,
      /(?:ich|wir).{0,25}(?:nehme|nehmen).{0,45}(?:offerte|kostenvoranschlag).{0,30}an/
    ];

    const accepted=[
      /angebot.{0,70}annehmen/,
      /nehmen.{0,50}angebot.{0,30}an/,
      /akzeptier/,/einverstanden/,/passt für uns/,/passt fuer uns/,
      /machen sie das/,/können sie loslegen/,/koennen sie loslegen/,/zugesagt/,/angenommen/
    ];
    const appointment=[/termin/,/wann können/,/wann koennen/,/wann wäre/,/wann waere/,/start/,/beginn/,/ab wann/,/vorbeikommen/,/besichtigung/,/welcher tag/,/zeitlich/];
    const question=[/\?/,/frage/,/können sie/,/koennen sie/,/wie /,/was /,/warum /,/bitte um rückmeldung/,/bitte um rueckmeldung/];

    if(declined.some(r=>r.test(t)))return{intent:'declined',base:.96};
    if(acceptedStrong.some(r=>r.test(t)))return{intent:'accepted',base:.96};
    if(accepted.some(r=>r.test(t)))return{intent:'accepted',base:.91};
    if(appointment.some(r=>r.test(t)))return{intent:'appointment',base:.82};
    if(question.some(r=>r.test(t)))return{intent:'question',base:.76};
    return{intent:'unknown',base:.45};
  }

  function matchCustomer(senderEmail,senderName,combined){
    const customers=globalThis.data?.customers||[];
    const mail=normalize(senderEmail);
    if(mail){const exact=customers.find(c=>normalize(c.email)===mail);if(exact)return exact}
    const name=normalize(senderName);
    if(name){const exactName=customers.find(c=>normalize(c.name)===name||normalize(c.contact)===name);if(exactName)return exactName}
    const text=normalize(combined);
    const hits=customers.filter(c=>normalize(c.name).length>3&&text.includes(normalize(c.name)));
    return hits.length===1?hits[0]:null;
  }

  function matchOffer(overrideId,customer,text){
    const offers=globalThis.data?.offers||[];
    if(overrideId)return offerById(overrideId)||null;
    const hay=normalize(text);
    const byNumber=offers.filter(o=>o.number&&hay.includes(normalize(o.number)));
    if(byNumber.length===1)return byNumber[0];
    if(customer){
      const candidates=offers.filter(o=>o.customerId===customer.id&&['draft','sent','accepted'].includes(o.status));
      if(candidates.length===1)return candidates[0];
      const subjectHits=candidates.filter(o=>normalize(o.subject).length>4&&hay.includes(normalize(o.subject)));
      if(subjectHits.length===1)return subjectHits[0];
    }
    return null;
  }

  function parseRequestedDate(text){
    const t=String(text||'');
    let m=t.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    m=t.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/);
    if(m)return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    m=t.match(/\b(\d{1,2})\.(\d{1,2})\.(?!\d)/);
    if(m){const now=new Date(),y=now.getFullYear();let d=`${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;if(new Date(d+'T12:00:00')<new Date(now.toDateString()))d=`${y+1}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;return d}
    return '';
  }

  function addDays(iso,n){const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
  function nextWorkday(iso){let d=iso;for(let i=0;i<10;i++){const day=new Date(d+'T12:00:00').getDay();if(day!==0&&day!==6)return d;d=addDays(d,1)}return d}
  function minutes(s){const [h,m]=String(s||'00:00').split(':').map(Number);return h*60+m}
  function timeText(min){return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`}
  function eventBlocks(ev,date,start,end){
    if(!ev||ev.type==='Angebot')return false;
    let occurs=false;
    if(ev.jobId&&typeof globalThis.eventOccursOnDate==='function')occurs=globalThis.eventOccursOnDate(ev,date); else occurs=ev.date===date;
    if(!occurs)return false;
    const es=minutes(ev.time||'08:00'),ee=es+Math.max(15,Number(ev.duration)||60);
    return start<ee&&end>es;
  }
  function slotFree(date,start,end){return !(globalThis.data?.events||[]).some(ev=>eventBlocks(ev,date,start,end))}

  function workdayEnd(startDate,days){
    let d=startDate,last=startDate,count=0,guard=0;
    while(count<Math.max(1,Math.round(Number(days)||1))&&guard<60){
      guard++;const dow=new Date(d+'T12:00:00').getDay();
      if(dow!==0&&dow!==6){last=d;count++}
      if(count<Math.max(1,Math.round(Number(days)||1)))d=addDays(d,1);
    }
    return last;
  }
  function slotFromJob(job){
    if(!job?.start)return null;
    const unit=job.durationUnit==='hours'?'hours':'days';
    const value=Math.max(unit==='hours'?.25:1,Number(job.durationValue)||1);
    return {
      startDate:job.start,
      startTime:String(job.startTime||'08:00').slice(0,5),
      endDate:unit==='hours'?job.start:workdayEnd(job.start,value),
      source:'existing_job',
      jobId:job.id||''
    };
  }

  function findFreeSlot(durationValue,durationUnit,preferredDate){
    const unit=durationUnit==='hours'?'hours':'days';
    let start=preferredDate||addDays(new Date().toISOString().slice(0,10),1);
    start=nextWorkday(start);
    if(unit==='hours'){
      const need=Math.max(15,Math.round((Number(durationValue)||1)*60));
      for(let dayOffset=0;dayOffset<90;dayOffset++){
        let date=nextWorkday(addDays(start,dayOffset));
        if(new Date(date+'T12:00:00').getDay()===0||new Date(date+'T12:00:00').getDay()===6)continue;
        for(let s=8*60;s+need<=17*60;s+=15){if(slotFree(date,s,s+need))return{startDate:date,startTime:timeText(s),endDate:date}}
      }
      return null;
    }
    const days=Math.max(1,Math.round(Number(durationValue)||1));
    for(let offset=0;offset<120;offset++){
      const candidate=nextWorkday(addDays(start,offset));
      let dates=[],d=candidate,guard=0;
      while(dates.length<days&&guard<30){guard++;const dow=new Date(d+'T12:00:00').getDay();if(dow!==0&&dow!==6)dates.push(d);d=addDays(d,1)}
      if(dates.length===days&&dates.every(x=>slotFree(x,8*60,16*60)))return{startDate:dates[0],startTime:'08:00',endDate:dates[dates.length-1]};
    }
    return null;
  }

  function replyFor(a){
    const customer=a.customer,p=correspondenceProfile();
    const greeting=customer?.name?p.greetingName(customer.name):p.greetingGeneric;
    const sign=`${p.signoff}\n${companyName()}`;
    let reply='';
    if(a.intent==='accepted'){
      if(a.offer&&a.slot)reply=`${greeting}\n\n${p.thanks} für Ihre Zusage zu ${p.offerDative} ${a.offer.number}. Wir haben den Auftrag vorgemerkt. Nach aktueller Planung könnten wir voraussichtlich am ${deDate(a.slot.startDate)} um ${a.slot.startTime} Uhr mit den Arbeiten beginnen. Die voraussichtliche Dauer beträgt ${durationLabel(a.durationValue,a.durationUnit)}.\n\nBitte geben Sie uns kurz Bescheid, falls der vorgeschlagene Termin für Sie nicht passt.\n\n${sign}`;
      else reply=`${greeting}\n\n${p.thanks} für Ihre Zusage. Wir haben Ihre Nachricht als ${p.acceptanceLabel} erkannt. Bevor wir einen Starttermin bestätigen, prüfen wir die Zuordnung ${p.offerMatchDative} und unseren Kalender.\n\n${sign}`;
    }else if(a.intent==='declined')reply=`${greeting}\n\n${p.thanks} für Ihre Rückmeldung. Wir haben vermerkt, dass Sie ${p.offerObject} derzeit nicht annehmen. Sollten Sie später noch Fragen haben, sind wir gerne für Sie da.\n\n${sign}`;
    else if(a.intent==='appointment'){
      if(a.offer&&a.slot){
        if(a.slot.source==='existing_job')reply=`${greeting}\n\n${p.thanks} für Ihre Terminanfrage zu ${p.offerDative} ${a.offer.number}. Für den Auftrag ist aktuell bereits ein Start am ${deDate(a.slot.startDate)} um ${a.slot.startTime} Uhr vorgesehen. Die eingeplante Dauer beträgt ${durationLabel(a.durationValue,a.durationUnit)}.\n\nBitte geben Sie uns kurz Bescheid, falls dieser Termin für Sie nicht passt.\n\n${sign}`;
        else reply=`${greeting}\n\n${p.thanks} für Ihre Terminanfrage zu ${p.offerDative} ${a.offer.number}. Nach aktueller Planung könnten wir voraussichtlich am ${deDate(a.slot.startDate)} um ${a.slot.startTime} Uhr mit den Arbeiten beginnen. Die voraussichtliche Dauer beträgt ${durationLabel(a.durationValue,a.durationUnit)}.\n\nBitte geben Sie uns kurz Bescheid, ob dieser Zeitraum für Sie passt.\n\n${sign}`;
      }else reply=`${greeting}\n\n${p.thanks} für Ihre Terminanfrage. Für einen konkreten Terminvorschlag müssen wir die Nachricht noch eindeutig ${p.offerIndefiniteDative} zuordnen.\n\n${sign}`;
    }else if(a.intent==='question')reply=`${greeting}\n\n${p.thanks} für Ihre Nachricht. Ihre Frage ist bei uns angekommen und wird geprüft. Sie erhalten dazu eine persönliche Rückmeldung.\n\n${sign}`;
    else reply=`${greeting}\n\n${p.thanks} für Ihre Nachricht. Wir prüfen Ihr Anliegen und melden uns persönlich bei Ihnen zurück.\n\n${sign}`;
    return localizeOutbound(reply);
  }

  function populateOfferHint(){
    const el=q('emailAssistOfferHint');if(!el)return;
    const previous=el.value;
    const offers=(globalThis.data?.offers||[]).filter(o=>['draft','sent','accepted'].includes(o.status)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    el.innerHTML='<option value="">Automatisch zuordnen</option>'+offers.map(o=>`<option value="${esc(o.id)}">${esc(o.number)} · ${esc(o.subject)}</option>`).join('');
    if(offers.some(o=>o.id===previous))el.value=previous;
    globalThis.APCustomSelect?.scan?.(el.parentElement||document);
  }

  function currentAnalysis(){
    const senderEmail=q('emailAssistSender').value.trim(),senderName=q('emailAssistSenderName').value.trim(),subject=q('emailAssistSubject').value.trim(),body=q('emailAssistBody').value.trim();
    if(!subject&&!body)throw new Error('Bitte Betreff oder Nachricht einfügen.');
    const combined=`${subject}\n${body}`;
    const cls=classify(subject,body);
    let customer=matchCustomer(senderEmail,senderName,combined);
    let offer=matchOffer(q('emailAssistOfferHint').value,customer,combined);
    if(offer&&!customer)customer=customerById(offer.customerId)||null;
    const durationUnit=offer?.durationUnit==='hours'?'hours':'days',durationValue=Math.max(durationUnit==='hours'?.25:1,Number(offer?.durationValue)||1);
    const requested=parseRequestedDate(combined);
    const existingJob=offer?activeJobByOffer(offer.id):null;
    let slot=null;
    if((cls.intent==='accepted'||cls.intent==='appointment')&&offer){
      slot=existingJob?slotFromJob(existingJob):findFreeSlot(durationValue,durationUnit,requested);
    }
    let confidence=cls.base+(customer?.id?.length?0.03:0)+(offer?.id?.length?0.04:0);confidence=Math.min(.99,confidence);
    const a={senderEmail,senderName,subject,body,intent:cls.intent,confidence,customer,offer,durationValue,durationUnit,requestedDate:requested,slot,existingJob,sourceMailMessageId};
    a.reply=replyFor(a);return a;
  }

  function renderAnalysis(a){
    active=a;updateLocaleHint();
    const box=q('emailAssistResult');box.classList.remove('hidden');
    const meta=intentMeta[a.intent]||intentMeta.unknown;
    q('emailAssistIntent').innerHTML=`<span>${meta.icon}</span><div><small>ERKANNT</small><b>${esc(meta.label)}</b></div><strong>${Math.round(a.confidence*100)}%</strong>`;
    q('emailAssistMatches').innerHTML=`<div><span>Kunde</span><b>${esc(a.customer?.name||'Nicht eindeutig gefunden')}</b></div><div><span>Angebot</span><b>${esc(a.offer?`${a.offer.number} · ${a.offer.subject}`:'Nicht eindeutig gefunden')}</b></div>`;
    const schedule=q('emailAssistSchedule');
    if((a.intent==='accepted'||a.intent==='appointment')&&a.offer&&a.slot){
      const isExisting=a.slot.source==='existing_job';
      const title=isExisting?'Bereits geplanter Termin':(a.intent==='appointment'?'Nächster freier Zeitraum':'Freier Zeitraum gefunden');
      schedule.classList.remove('hidden');
      schedule.innerHTML=`<span>${isExisting?'✅':'📅'}</span><div><b>${title}</b><small>${deDate(a.slot.startDate)} · ${a.slot.startTime} Uhr · ${esc(durationLabel(a.durationValue,a.durationUnit))}${a.slot.endDate!==a.slot.startDate?` · bis ${deDate(a.slot.endDate)}`:''}</small></div>`;
    }else{schedule.classList.add('hidden');schedule.innerHTML=''}
    q('emailAssistReply').value=a.reply;
    const action=q('emailAssistPrimaryAction');
    if(a.intent==='accepted'&&a.offer&&a.customer&&a.slot&&!a.existingJob){action.hidden=false;action.textContent='🏗️ Auftrag vorbereiten';action.dataset.action='accepted'}
    else if(a.intent==='accepted'&&a.existingJob){action.hidden=true;action.dataset.action=''}
    else if(a.intent==='declined'&&a.offer){action.hidden=false;action.textContent='↩️ Angebot als abgelehnt markieren';action.dataset.action='declined'}
    else{action.hidden=true;action.dataset.action=''}
    q('emailAssistSafety').textContent=(a.intent==='question'||a.intent==='unknown')?'Keine automatische Sachantwort: Bitte Inhalt persönlich prüfen.':'Nichts wird automatisch versendet oder gebucht. Erst deine Freigabe löst eine Aktion aus.';
  }

  async function persistAnalysis(a){
    const {client,company,session,membership}=cloud();
    if(!client||!company||!session||!['owner','office'].includes(membership?.role||''))return null;
    const row={company_id:company.id,created_by:session.user.id,sender_email:a.senderEmail,sender_name:a.senderName,subject:a.subject,body:a.body,detected_intent:a.intent,confidence:a.confidence,customer_local_id:a.customer?.id||'',customer_name:a.customer?.name||'',offer_local_id:a.offer?.id||'',offer_number:a.offer?.number||'',offer_subject:a.offer?.subject||'',reply_draft:a.reply,suggested_start_date:a.slot?.startDate||null,suggested_start_time:a.slot?.startTime?`${a.slot.startTime}:00`:null,suggested_end_date:a.slot?.endDate||null,duration_value:a.offer?a.durationValue:null,duration_unit:a.offer?a.durationUnit:null,workflow_status:'review',action_note:'',source_mail_message_id:a.sourceMailMessageId||null};
    const {data,error}=await client.from('email_assistant_items').insert(row).select('*').single();if(error)throw error;return data;
  }

  async function analyze(){
    try{
      const {membership}=cloud();if(!['owner','office'].includes(membership?.role||''))throw new Error('E-Mail-Sekretärin ist nur für Chef und Büro verfügbar.');
      const a=currentAnalysis();renderAnalysis(a);q('emailAssistAnalyze').disabled=true;q('emailAssistAnalyze').textContent='Analyse gespeichert ✓';
      try{a.cloudRow=await persistAnalysis(a);if(a.sourceMailMessageId){const {client}=cloud();await client?.from('mail_messages').update({workflow_status:'reviewed',updated_at:new Date().toISOString()}).eq('id',a.sourceMailMessageId);globalThis.MailHub?.refresh?.().catch?.(()=>{})}await loadHistory()}catch(e){console.warn('Analyse konnte nicht in Cloud gespeichert werden',e);globalThis.toast?.('Analyse erstellt · Cloud-Verlauf konnte nicht gespeichert werden')}
      setTimeout(()=>{q('emailAssistAnalyze').disabled=false;q('emailAssistAnalyze').textContent='Nachricht prüfen'},900);
    }catch(e){globalThis.toast?.(e.message||'Nachricht konnte nicht geprüft werden')}
  }

  async function copyReply(){const text=q('emailAssistReply').value;if(!text)return;try{await navigator.clipboard.writeText(text);globalThis.toast?.('Antwort kopiert')}catch(e){q('emailAssistReply').select();document.execCommand('copy');globalThis.toast?.('Antwort kopiert')}}

  async function updateItem(id,patch){const {client}=cloud();if(!client||!id)return;const {error}=await client.from('email_assistant_items').update({...patch,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error}

  async function prepare(){
    if(!active)return;
    const action=q('emailAssistPrimaryAction').dataset.action;
    if(action==='accepted'){
      const offer=offerById(active.offer?.id),customer=customerById(active.customer?.id);if(!offer||!customer||!active.slot)return globalThis.toast?.('Zuordnung ist nicht vollständig');
      const existing=(globalThis.data?.jobs||[]).find(j=>j.offerId===offer.id&&j.status!=='done');
      if(existing){globalThis.toast?.('Für dieses Angebot gibt es bereits eine offene Baustelle');globalThis.editJob?.(existing.id);return}
      const ok=await globalThis.appConfirm?.({title:'Auftrag vorbereiten?',text:`Angebot ${offer.number} wird als angenommen markiert und eine Baustelle ab ${deDate(active.slot.startDate)} vorbereitet. Die Antwort wird NICHT automatisch versendet.`,confirmLabel:'Auftrag vorbereiten',icon:'🏗️'});if(!ok)return;
      offer.status='accepted';offer.updatedAt=new Date().toISOString();
      const job={id:globalThis.uid(),title:offer.subject||`Auftrag ${offer.number}`,customerId:customer.id,address:customer.address||'',start:active.slot.startDate,startTime:active.slot.startTime||'08:00',durationValue:active.durationValue,durationUnit:active.durationUnit,status:'open',notes:`Aus E-Mail-Sekretärin vorbereitet · Angebot ${offer.number}`,docNote:'',offerId:offer.id,invoiceId:'',eventId:'',photos:[],assignedUserIds:[],assignedNames:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      globalThis.data.jobs.push(job);globalThis.upsertCalendarEventForJob?.(job);globalThis.persistAppState?.();globalThis.addAudit?.('E-Mail-Sekretärin','Auftrag vorbereitet · '+offer.number);globalThis.renderAll?.();
      if(active.cloudRow?.id)await updateItem(active.cloudRow.id,{workflow_status:'prepared',action_note:`Baustelle ${job.title} ab ${job.start} vorbereitet`});
      try{await globalThis.CloudSync?.pushSnapshot?.()}catch(e){console.warn(e);globalThis.toast?.('Auftrag lokal vorbereitet · Cloud-Sync folgt')}
      await loadHistory();globalThis.toast?.('✓ Auftrag vorbereitet · Antwort noch nicht versendet');globalThis.editJob?.(job.id);return;
    }
    if(action==='declined'){
      const offer=offerById(active.offer?.id);if(!offer)return;
      const ok=await globalThis.appConfirm?.({title:'Angebot als abgelehnt markieren?',text:`${offer.number} wird auf „Abgelehnt“ gesetzt. Es wird keine E-Mail automatisch versendet.`,confirmLabel:'Als abgelehnt markieren',icon:'↩️'});if(!ok)return;
      offer.status='declined';offer.updatedAt=new Date().toISOString();globalThis.persistAppState?.();globalThis.renderAll?.();if(active.cloudRow?.id)await updateItem(active.cloudRow.id,{workflow_status:'done',action_note:'Angebot als abgelehnt markiert'});try{await globalThis.CloudSync?.pushSnapshot?.()}catch(e){}await loadHistory();globalThis.toast?.('✓ Angebot aktualisiert');
    }
  }

  async function loadHistory(){
    const {client,company,membership}=cloud(),box=q('emailAssistHistory');if(!box)return;
    if(!client||!company||!['owner','office'].includes(membership?.role||'')){box.innerHTML='<div class="empty">E-Mail-Sekretärin ist nur für Chef und Büro verfügbar.</div>';return}
    box.innerHTML='<div class="empty">Verlauf wird geladen …</div>';
    const {data,error}=await client.from('email_assistant_items').select('*').eq('company_id',company.id).order('created_at',{ascending:false}).limit(40);if(error){box.innerHTML='<div class="empty">Verlauf konnte nicht geladen werden.</div>';return}
    items=data||[];
    box.innerHTML=items.length?items.map(i=>{const m=intentMeta[i.detected_intent]||intentMeta.unknown;return `<div class="card emailHistoryCard"><div class="itemTop"><div><span class="emailIntentBadge ${m.tone}">${m.icon} ${esc(m.label)}</span><h3>${esc(i.subject||'Ohne Betreff')}</h3><p>${esc(i.customer_name||i.sender_email||'Unbekannter Absender')}${i.offer_number?` · ${esc(i.offer_number)}`:''}</p></div><span class="mini">${new Date(i.created_at).toLocaleString(correspondenceProfile().locale)}</span></div><div class="emailHistoryActions"><button class="btn small" onclick="EmailAssistant.reopen('${i.id}')">Öffnen</button><button class="btn small danger" onclick="EmailAssistant.remove('${i.id}')">Löschen</button></div></div>`}).join(''):'<div class="empty">Noch keine E-Mail geprüft.</div>';
  }

  function reopen(id){const i=items.find(x=>x.id===id);if(!i)return;q('emailAssistSender').value=i.sender_email||'';q('emailAssistSenderName').value=i.sender_name||'';q('emailAssistSubject').value=i.subject||'';q('emailAssistBody').value=i.body||'';populateOfferHint();if(i.offer_local_id&&offerById(i.offer_local_id))q('emailAssistOfferHint').value=i.offer_local_id;globalThis.APCustomSelect?.sync?.();const customer=customerById(i.customer_local_id),offer=offerById(i.offer_local_id),existingJob=offer?activeJobByOffer(offer.id):null;let slot=i.suggested_start_date?{startDate:i.suggested_start_date,startTime:String(i.suggested_start_time||'08:00').slice(0,5),endDate:i.suggested_end_date||i.suggested_start_date}:null;if(existingJob&&(i.detected_intent==='appointment'||i.detected_intent==='accepted'))slot=slotFromJob(existingJob);const a={senderEmail:i.sender_email||'',senderName:i.sender_name||'',subject:i.subject||'',body:i.body||'',intent:i.detected_intent||'unknown',confidence:Number(i.confidence)||0,customer,offer,durationValue:Number(i.duration_value)||Number(offer?.durationValue)||1,durationUnit:i.duration_unit||offer?.durationUnit||'days',slot,existingJob,reply:i.reply_draft||'',cloudRow:i};if(a.intent==='appointment')a.reply=replyFor(a);renderAnalysis(a);window.scrollTo({top:0,behavior:'smooth'})}

  async function remove(id){const ok=await globalThis.appConfirm?.({title:'Eintrag löschen?',text:'Nur dieser E-Mail-Sekretärin-Verlauf wird gelöscht. Kunden, Angebote und Baustellen bleiben unverändert.',confirmLabel:'Löschen',icon:'🗑️',danger:true});if(!ok)return;const {client}=cloud();const {error}=await client.from('email_assistant_items').delete().eq('id',id);if(error)return globalThis.toast?.('Eintrag konnte nicht gelöscht werden');await loadHistory();globalThis.toast?.('Eintrag gelöscht')}

  function clearForm(){['emailAssistSender','emailAssistSenderName','emailAssistSubject','emailAssistBody'].forEach(id=>{if(q(id))q(id).value=''});q('emailAssistOfferHint').value='';q('emailAssistResult').classList.add('hidden');const src=q('emailAssistSource');if(src){src.classList.add('hidden');src.innerHTML=''}sourceMailMessageId='';active=null;globalThis.APCustomSelect?.sync?.()}

  function loadMailMessage(message){
    clearForm();
    sourceMailMessageId=message?.id||'';
    q('emailAssistSender').value=message?.from_email||'';
    q('emailAssistSenderName').value=message?.from_name||'';
    q('emailAssistSubject').value=message?.subject||'';
    q('emailAssistBody').value=message?.body_text||message?.body_preview||'';
    const src=q('emailAssistSource');if(src){src.classList.remove('hidden');src.innerHTML=`<span>📥</span><div><b>Aus verbundenem Firmen-Postfach</b><small>${esc(message?.from_email||'')} · ${message?.received_at?new Date(message.received_at).toLocaleString(correspondenceProfile().locale):''}</small></div>`}
    populateOfferHint();globalThis.APCustomSelect?.sync?.();
    q('emailManualTestCard')?.scrollIntoView({behavior:'smooth',block:'start'});
    setTimeout(()=>analyze(),180);
  }

  async function open(){updateLocaleHint();const {membership}=cloud();if(!['owner','office'].includes(membership?.role||'')){globalThis.toast?.('E-Mail-Sekretärin ist nur für Chef und Büro verfügbar');globalThis.showScreen?.('more');return}globalThis.showScreen?.('emailAssistant');populateOfferHint();clearForm();await Promise.all([loadHistory(),globalThis.MailHub?.refresh?.()])}

  globalThis.openEmailAssistant=open;
  globalThis.EmailAssistant={open,analyze,copyReply,prepare,loadHistory,reopen,remove,clearForm,loadMailMessage,populateOfferHint,_debug:{classify,matchCustomer,matchOffer,parseRequestedDate,findFreeSlot,replyFor,correspondenceProfile,durationLabel,deDate}};
})();
