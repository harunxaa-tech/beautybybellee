/* AngebotsPilot v11.32.7 – Angebots-Sprachmemos & KI-Diktat
   Voice notes are private evidence/working notes. AI suggestions never modify or save
   an offer automatically: every suggested field/position requires an explicit user action. */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const state={localOfferId:'',cloudOfferId:'',notes:[],prefs:null,ai:null,recording:null,busy:false,lastDraft:null};
  const cloud=()=>globalThis.getCloudState?.()||{};

  function inject(){
    if(q('offerVoiceCard'))return;
    const notes=q('offerNotes');if(!notes)return;
    const host=notes.closest('.card');if(!host)return;
    host.insertAdjacentHTML('afterend',`<div class="card offerVoiceCard" id="offerVoiceCard">
      <div class="offerVoiceHead"><div><span class="securityBadge">🎙️ VOICE</span><h3>Sprachnotizen zum Angebot</h3><p>Gedanken einsprechen, später anhören und optional als KI-Vorschlag in Text umwandeln.</p></div><span id="offerVoiceAiBadge" class="offerVoiceAiBadge">KI AUS</span></div>
      <div class="offerVoiceSettings">
        <label><span>Zielsprache für KI-Vorschläge</span><select id="offerVoiceLanguage"></select></label>
        <small id="offerVoiceAiStatus">KI-Status wird geprüft …</small>
      </div>
      <div class="offerVoiceUnsaved" id="offerVoiceUnsaved"><b>Entwurf zuerst speichern</b><small>Sprachmemos werden sicher einem gespeicherten Angebot zugeordnet. Danach kannst du hier direkt aufnehmen.</small></div>
      <div class="offerVoiceRecorder hidden" id="offerVoiceRecorder" hidden><span class="jobChatRecDot"></span><b>Aufnahme läuft</b><strong id="offerVoiceRecordTime">0:00</strong><button class="btn small danger" type="button" id="offerVoiceStopBtn">Speichern</button></div>
      <div class="offerVoiceActions" id="offerVoiceActions">
        <button class="btn" type="button" id="offerVoiceRecordBtn">🎙️ Sprachmemo aufnehmen</button>
        <button class="btn" type="button" id="offerVoiceRefreshBtn">↻ Aktualisieren</button>
      </div>
      <div class="offerVoiceNotes" id="offerVoiceNotes"><div class="empty">Noch keine Sprachnotizen.</div></div>
      <div class="offerVoiceDraft hidden" id="offerVoiceDraft" hidden></div>
      <p class="offerVoiceFoot">🔒 Intern: Sprachmemos und KI-Entwürfe erscheinen niemals automatisch im Kunden-PDF. Übernommen wird nur, was du ausdrücklich auswählst.</p>
    </div>`);
    bind();renderLanguages();
  }

  function bind(){
    q('offerVoiceRecordBtn')?.addEventListener('click',toggleRecording);
    q('offerVoiceStopBtn')?.addEventListener('click',stopAndSave);
    q('offerVoiceRefreshBtn')?.addEventListener('click',()=>load().catch(()=>{}));
    q('offerVoiceLanguage')?.addEventListener('change',async e=>{
      try{await APVoice.savePreferences({preferred_language:e.target.value});state.prefs=await APVoice.preferences(true);syncVoicePreferenceUI()}
      catch(err){console.error(err);globalThis.toast?.('Sprache konnte nicht gespeichert werden.')}
    });
    q('offerVoiceNotes')?.addEventListener('click',async e=>{
      const btn=e.target.closest('[data-offer-voice-action]');if(!btn)return;
      const id=btn.dataset.noteId,action=btn.dataset.offerVoiceAction;
      if(action==='ai')await processNote(id);
      if(action==='delete')await deleteNote(id);
    });
    q('offerVoiceDraft')?.addEventListener('click',e=>{
      const btn=e.target.closest('[data-offer-draft-action]');if(!btn)return;
      applyDraft(btn.dataset.offerDraftAction);
    });
  }

  function renderLanguages(){
    const el=q('offerVoiceLanguage');if(!el||!globalThis.APVoice)return;
    el.innerHTML=Object.entries(APVoice.LANGUAGES).map(([code,name])=>`<option value="${code}">${esc(name)}</option>`).join('');
  }

  async function resolveCloudOffer(localId){
    const {client,company}=cloud();if(!client||!company||!localId)return'';
    const find=async()=>{
      const {data,error}=await client.from('offers').select('id').eq('company_id',company.id).eq('local_id',String(localId)).is('deleted_at',null).maybeSingle();
      if(error)throw error;return data?.id||'';
    };
    let id=await find();if(id)return id;
    try{await globalThis.CloudSync?.pushSnapshot?.();id=await find()}catch(e){}
    return id;
  }

  async function open(localOfferId=''){
    inject();state.localOfferId=String(localOfferId||q('offerId')?.value||'');state.cloudOfferId='';state.notes=[];state.lastDraft=null;
    hideDraft();
    const {client,company,session,membership}=cloud();
    const allowed=!!(client&&company&&session?.user&&['owner','office'].includes(membership?.role||''));
    if(!allowed){renderUnavailable('Sprachmemos benötigen ein verbundenes Betriebskonto mit Inhaber-/Büro-Zugriff.');return}
    [state.prefs,state.ai]=await Promise.all([APVoice.preferences(true),APVoice.status(true)]);
    syncVoicePreferenceUI();
    if(!state.localOfferId){renderUnsaved(true);return}
    try{
      state.cloudOfferId=await resolveCloudOffer(state.localOfferId);
      if(!state.cloudOfferId){renderUnavailable('Angebot wird noch mit der Cloud synchronisiert. Bitte kurz erneut öffnen.');return}
      renderUnsaved(false);await load();
    }catch(e){console.error('OfferVoice open',e);renderUnavailable('Sprachnotizen konnten nicht geladen werden. Bitte Verbindung prüfen.')}
  }

  function renderUnsaved(show){
    const unsaved=q('offerVoiceUnsaved'),actions=q('offerVoiceActions'),list=q('offerVoiceNotes');
    if(unsaved){unsaved.hidden=!show;unsaved.classList.toggle('hidden',!show)}
    if(actions)actions.hidden=show;
    if(show&&list)list.innerHTML='<div class="empty">Nach dem ersten Speichern kannst du Sprachmemos dauerhaft zu diesem Angebot ablegen.</div>';
  }
  function renderUnavailable(text){renderUnsaved(false);const list=q('offerVoiceNotes');if(list)list.innerHTML=`<div class="empty">${esc(text)}</div>`;['offerVoiceRecordBtn','offerVoiceRefreshBtn'].forEach(id=>{const el=q(id);if(el)el.disabled=true})}

  async function load(){
    if(!state.cloudOfferId)return;
    const {client,company}=cloud();
    const {data,error}=await client.from('offer_voice_notes')
      .select('id,company_id,offer_id,sender_user_id,storage_path,file_name,mime_type,size_bytes,duration_seconds,original_language,transcript_text,transcript_status,translations,ai_error_code,created_at')
      .eq('company_id',company.id).eq('offer_id',state.cloudOfferId).order('created_at',{ascending:false}).limit(50);
    if(error)throw error;state.notes=data||[];await render();
  }

  function fmtDate(v){try{return new Date(v).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return''}}
  async function render(){
    const box=q('offerVoiceNotes');if(!box)return;
    if(!state.notes.length){box.innerHTML='<div class="offerVoiceEmpty"><span>🎙️</span><b>Noch keine Sprachnotiz</b><small>Notiere Gedanken zum Angebot per Sprache. Das Audio bleibt intern.</small></div>';return}
    const rows=await Promise.all(state.notes.map(async n=>{
      let url='';try{url=await APVoice.signedUrl(n.storage_path,3600)}catch(e){}
      const transcript=n.transcript_text?`<div class="offerVoiceTranscript"><span>TRANSKRIPT</span><p>${esc(n.transcript_text)}</p></div>`:'';
      const aiButton=state.ai?.enabled?`<button class="btn small" type="button" data-offer-voice-action="ai" data-note-id="${n.id}">✨ KI-Vorschlag</button>`:`<button class="btn small" type="button" disabled>✨ KI noch deaktiviert</button>`;
      const failed=n.transcript_status==='failed'?'<small class="jobChatAiError">KI-Verarbeitung fehlgeschlagen · Audio bleibt erhalten.</small>':'';
      return `<div class="offerVoiceNote"><div class="offerVoiceNoteHead"><div><b>${esc(fmtDate(n.created_at))}</b><small>${APVoice.fmtDuration(n.duration_seconds)} · intern</small></div><button class="offerVoiceDelete" type="button" data-offer-voice-action="delete" data-note-id="${n.id}" aria-label="Sprachnotiz löschen">×</button></div>${url?`<audio controls preload="metadata" src="${esc(url)}"></audio>`:'<small>Audio-Link konnte nicht geladen werden.</small>'}${transcript}${failed}<div class="offerVoiceNoteActions">${aiButton}</div></div>`;
    }));
    box.innerHTML=rows.join('');
  }

  function syncVoicePreferenceUI(){
    const lang=q('offerVoiceLanguage'),status=q('offerVoiceAiStatus'),badge=q('offerVoiceAiBadge');
    if(lang)lang.value=APVoice.cleanLang(state.prefs?.preferred_language||'de');
    if(status)status.textContent=state.ai?.enabled?`✨ KI bereit · ${state.ai.transcription_model||'Transkription'} + ${state.ai.translation_model||'Übersetzung'} · nur nach Einwilligung`:'✨ KI vorbereitet und kostenfrei deaktiviert · Sprachmemos funktionieren trotzdem';
    if(badge){badge.textContent=state.ai?.enabled?'KI BEREIT':'KI AUS';badge.classList.toggle('ready',!!state.ai?.enabled)}
  }

  async function toggleRecording(){if(state.recording)return stopAndSave();return startRecording()}
  async function startRecording(){
    if(!state.cloudOfferId||state.busy)return globalThis.toast?.('Angebot zuerst speichern.');
    try{
      const cfg=state.ai||await APVoice.status();
      state.recording=await APVoice.startRecorder({maxSeconds:Number(cfg.max_audio_seconds)||180,onTick:s=>{const el=q('offerVoiceRecordTime');if(el)el.textContent=APVoice.fmtDuration(s)},onAutoStop:()=>globalThis.toast?.('Maximale Länge erreicht · Aufnahme wird gespeichert.')});
      const rec=q('offerVoiceRecorder');if(rec){rec.hidden=false;rec.classList.remove('hidden')}q('offerVoiceRecordBtn')?.classList.add('recording');
    }catch(e){console.error(e);globalThis.toast?.(e.message||'Mikrofon konnte nicht gestartet werden.')}
  }

  async function stopAndSave(){
    if(!state.recording||state.busy)return;const rec=state.recording;state.recording=null;state.busy=true;
    const panel=q('offerVoiceRecorder');if(panel){panel.hidden=true;panel.classList.add('hidden')}q('offerVoiceRecordBtn')?.classList.remove('recording');
    let path='';
    try{
      const result=await rec.stop();if(!result?.blob?.size)throw new Error('Leere Aufnahme.');
      const {company,session,client}=cloud();
      path=`${company.id}/offers/${state.cloudOfferId}/voice/${APVoice.uuid()}-${APVoice.safeName(result.fileName)}`;
      await APVoice.upload(path,result.blob);
      const {data,error}=await client.from('offer_voice_notes').insert({company_id:company.id,offer_id:state.cloudOfferId,sender_user_id:session.user.id,storage_path:path,file_name:result.fileName,mime_type:result.mimeType,size_bytes:result.blob.size,duration_seconds:Math.min(180,result.durationSeconds)}).select().single();
      if(error)throw error;
      await load();globalThis.toast?.(state.ai?.enabled?'✓ Sprachnotiz gespeichert · KI-Vorschlag optional':'✓ Sprachnotiz gespeichert');
      state.ai=await APVoice.status(true);syncVoicePreferenceUI();
    }catch(e){console.error(e);if(path){try{await APVoice.remove(path)}catch{}}globalThis.toast?.(e.message||'Sprachnotiz konnte nicht gespeichert werden.')}
    finally{state.busy=false}
  }

  async function processNote(id,{silent=false}={}){
    if(!id)return;if(!state.ai?.enabled){if(!silent)globalThis.toast?.('KI-Sprachfunktionen sind noch nicht aktiviert.');return}
    if(!await APVoice.ensureConsent())return;
    const target=APVoice.cleanLang(state.prefs?.preferred_language||'de');
    try{
      const result=await APVoice.invoke('process_offer_voice_note',{note_id:id,target_language:target,offer_context:{existing_subject:q('offerSubject')?.value||'',existing_notes:q('offerNotes')?.value||''}});
      state.lastDraft=result;renderDraft(result);await load();if(!silent)globalThis.toast?.('✓ KI-Vorschlag erstellt · bitte prüfen');
    }catch(e){console.error(e);if(!silent)globalThis.toast?.('KI-Vorschlag konnte nicht erstellt werden. Audio bleibt gespeichert.')}
  }

  function renderDraft(d){
    const box=q('offerVoiceDraft');if(!box||!d)return;
    const positions=Array.isArray(d.position_suggestions)?d.position_suggestions:[];
    box.hidden=false;box.classList.remove('hidden');
    box.innerHTML=`<div class="offerVoiceDraftHead"><div><span class="securityBadge">✨ VORSCHLAG</span><h4>KI-Entwurf prüfen</h4></div><button type="button" class="offerVoiceDraftClose" data-offer-draft-action="close">×</button></div>
      <div class="offerVoiceDraftBlock"><span>Transkript</span><p>${esc(d.transcript||d.transcript_clean||'')}</p></div>
      ${d.subject_suggestion?`<div class="offerVoiceDraftBlock"><span>Betreff</span><p>${esc(d.subject_suggestion)}</p><button class="btn small" type="button" data-offer-draft-action="subject">Betreff übernehmen</button></div>`:''}
      ${d.notes_suggestion?`<div class="offerVoiceDraftBlock"><span>Beschreibung</span><p>${esc(d.notes_suggestion)}</p><div class="offerVoiceInlineActions"><button class="btn small" type="button" data-offer-draft-action="notes-replace">Übernehmen</button><button class="btn small" type="button" data-offer-draft-action="notes-append">Anhängen</button></div></div>`:''}
      ${positions.length?`<div class="offerVoiceDraftBlock"><span>Positionsvorschläge</span><div class="offerVoicePositionList">${positions.map((p,i)=>`<div><b>${esc(p.name||'Position')}</b><small>${esc([p.quantity_text,p.unit].filter(Boolean).join(' · '))}</small><p>${esc(p.description||'')}</p></div>`).join('')}</div><button class="btn small" type="button" data-offer-draft-action="positions">Positionen als Entwurf übernehmen</button><small>Preise bleiben absichtlich 0,00 € und müssen von dir geprüft werden.</small></div>`:''}
      <div class="notice">KI kann Fehler machen. AngebotsPilot speichert diese Vorschläge nicht automatisch.</div>`;
    box.scrollIntoView?.({behavior:'smooth',block:'nearest'});
  }
  function hideDraft(){const box=q('offerVoiceDraft');if(box){box.hidden=true;box.classList.add('hidden');box.innerHTML=''}state.lastDraft=null}
  function qtyFromText(value){const m=String(value||'').replace(',','.').match(/\d+(?:\.\d+)?/);const n=m?Number(m[0]):1;return Number.isFinite(n)&&n>0?Math.min(n,99999):1}
  function applyDraft(action){
    const d=state.lastDraft;if(action==='close'){hideDraft();return}if(!d)return;
    if(action==='subject'&&d.subject_suggestion){q('offerSubject').value=String(d.subject_suggestion).slice(0,300);globalThis.renderOfferEditorSummary?.();globalThis.toast?.('Betreff übernommen · noch nicht gespeichert');return}
    if((action==='notes-replace'||action==='notes-append')&&d.notes_suggestion){const el=q('offerNotes'),text=String(d.notes_suggestion).trim();el.value=action==='notes-append'?[el.value.trim(),text].filter(Boolean).join('\n\n'):text;globalThis.toast?.('Beschreibung übernommen · noch nicht gespeichert');return}
    if(action==='positions'){
      const rows=Array.isArray(d.position_suggestions)?d.position_suggestions:[];let added=0;
      for(const p of rows.slice(0,8)){
        const name=[String(p.name||'').trim(),String(p.description||'').trim()].filter(Boolean).join(' – ').slice(0,500);if(!name)continue;
        globalThis.addOfferLine?.({name,qty:qtyFromText(p.quantity_text),unit:String(p.unit||'Stk.').slice(0,30)||'Stk.',price:0});added++;
      }
      globalThis.toast?.(`${added} Positionsvorschlag${added===1?'':'e'} übernommen · Preise bitte prüfen`);
    }
  }

  async function deleteNote(id){
    const note=state.notes.find(n=>n.id===id);if(!note)return;
    const ok=await globalThis.appConfirm?.({title:'Sprachnotiz löschen?',text:'Die interne Sprachnotiz wird dauerhaft aus diesem Angebot entfernt.',confirmLabel:'Löschen',icon:'🗑️',danger:true});if(!ok)return;
    try{
      const {client}=cloud();const {error}=await client.from('offer_voice_notes').delete().eq('id',id);if(error)throw error;
      try{await APVoice.remove(note.storage_path)}catch(e){console.warn('Offer voice storage cleanup',e)}
      await load();hideDraft();globalThis.toast?.('Sprachnotiz gelöscht');
    }catch(e){console.error(e);globalThis.toast?.('Sprachnotiz konnte nicht gelöscht werden.')}
  }

  function patchHooks(){
    const edit=globalThis.editOffer;if(typeof edit==='function'&&!edit.__offerVoicePatched){const wrapped=function(id){const r=edit.apply(this,arguments);setTimeout(()=>open(id),0);return r};wrapped.__offerVoicePatched=true;globalThis.editOffer=wrapped}
    const fresh=globalThis.newOffer;if(typeof fresh==='function'&&!fresh.__offerVoicePatched){const wrapped=function(){const r=fresh.apply(this,arguments);setTimeout(()=>open(''),0);return r};wrapped.__offerVoicePatched=true;globalThis.newOffer=wrapped}
  }

  globalThis.OfferVoice={open,load,syncVoicePreferenceUI};
  const start=()=>{inject();patchHooks();setTimeout(()=>{const id=q('offerId')?.value;if(q('offerEditor')?.classList.contains('active'))open(id||'')},500)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
