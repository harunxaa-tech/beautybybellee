/* AngebotsPilot v11.32.8 – Baustellenchat */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const state={localJobId:'',cloudJobId:'',messages:[],participants:[],members:[],archiveLinks:new Map(),isParticipant:false,channel:null,prefs:null,ai:null,recording:null,recordTick:0,busy:false,autoProcessing:new Set()};
  const cloud=()=>globalThis.getCloudState?.()||{};
  const tr=(key,fallback)=>globalThis.API18n?.t?.(key)||fallback;
  const isActive=()=>q('jobEditor')?.classList.contains('active')&&!!state.localJobId;

  function inject(){
    if(q('jobChatCard'))return;
    const editor=q('jobEditor');if(!editor)return;
    const photoCard=q('jobPhotoGrid')?.closest('.card');
    const html=`<div class="card jobChatCard" id="jobChatCard">
      <div class="jobChatHead">
        <div><span class="securityBadge">💬 TEAM</span><h3>Baustellenchat</h3><p>Jede Baustelle hat ihren eigenen Chat. Zugewiesene Mitarbeiter sind automatisch dabei.</p></div>
        <div class="jobChatHeadActions"><button type="button" class="jobChatParticipantsBtn" id="jobChatParticipantsBtn" aria-expanded="false">👥 <span id="jobChatParticipantCount">0</span></button><span class="jobChatUnread hidden" id="jobChatUnread" hidden>0</span></div>
      </div>
      <div class="jobChatParticipantsPanel hidden" id="jobChatParticipantsPanel" hidden>
        <div class="jobChatParticipantsHead"><div><b>${tr('chat_participants','Chat-Teilnehmer')}</b><small>${tr('assigned_staff_auto','Zugewiesene Mitarbeiter werden automatisch aufgenommen.')}</small></div><button type="button" class="btn small" id="jobChatParticipantsClose">Schließen</button></div>
        <div class="jobChatParticipantList" id="jobChatParticipantList"></div>
        <p class="jobChatParticipantHint" id="jobChatParticipantHint"></p>
      </div>
      <div class="jobChatVoicePrefs" id="jobChatVoicePrefs">
        <label><span>Meine Sprache</span><select id="jobChatLanguage"></select></label>
        <label class="jobChatToggle"><input type="checkbox" id="jobChatTranscriptToggle"><span>Sprachmemos in Text umwandeln</span></label>
        <label class="jobChatToggle"><input type="checkbox" id="jobChatAutoTranslateToggle"><span>Automatisch in meine Sprache übersetzen</span></label>
        <small id="jobChatAiStatus">KI-Status wird geprüft …</small>
      </div>
      <div class="jobChatMessages" id="jobChatMessages" aria-live="polite"><div class="empty">Chat wird geladen …</div></div>
      <div class="jobChatRecorder hidden" id="jobChatRecorder" hidden><span class="jobChatRecDot"></span><b>Aufnahme läuft</b><strong id="jobChatRecordTime">0:00</strong><button type="button" class="btn small danger" id="jobChatRecordStop">Senden</button></div>
      <div class="jobChatComposer">
        <button type="button" class="jobChatIconBtn" id="jobChatAttachBtn" aria-label="Datei anhängen">＋</button>
        <textarea id="jobChatInput" rows="1" maxlength="4000" placeholder="Nachricht an die Baustelle …"></textarea>
        <button type="button" class="jobChatIconBtn" id="jobChatMicBtn" aria-label="Sprachmemo aufnehmen">🎙️</button>
        <button type="button" class="jobChatSend" id="jobChatSendBtn">Senden</button>
        <input id="jobChatFileInput" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" multiple hidden>
      </div>
      <p class="jobChatFoot">🔒 Nur Personen, die in diesem Baustellenchat eingetragen sind, können Nachrichten und Chat-Dateien sehen.</p>
    </div>`;
    (photoCard||q('jobSaveBtn'))?.insertAdjacentHTML('beforebegin',html);
    bind();renderLanguageOptions();
  }

  function bind(){
    q('jobChatSendBtn')?.addEventListener('click',sendText);
    q('jobChatInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendText()}});
    q('jobChatAttachBtn')?.addEventListener('click',()=>q('jobChatFileInput')?.click());
    q('jobChatFileInput')?.addEventListener('change',e=>sendFiles([...e.target.files||[]]).finally(()=>{e.target.value=''}) );
    q('jobChatMicBtn')?.addEventListener('click',toggleRecording);
    q('jobChatRecordStop')?.addEventListener('click',stopRecordingAndSend);
    q('jobChatParticipantsBtn')?.addEventListener('click',toggleParticipantsPanel);
    q('jobChatParticipantsClose')?.addEventListener('click',()=>showParticipantsPanel(false));
    q('jobChatParticipantList')?.addEventListener('click',async e=>{
      const btn=e.target.closest('[data-chat-participant-action]');if(!btn)return;
      const userId=btn.dataset.userId||'',action=btn.dataset.chatParticipantAction||'';
      if(action==='add')await setManualParticipant(userId,true);
      if(action==='remove')await setManualParticipant(userId,false);
    });
    q('jobChatLanguage')?.addEventListener('change',async e=>{try{await APVoice.savePreferences({preferred_language:e.target.value});state.prefs=await APVoice.preferences(true);render()}catch(err){console.error(err);globalThis.toast?.('Sprache konnte nicht gespeichert werden')}});
    q('jobChatTranscriptToggle')?.addEventListener('change',async e=>{const checked=e.target.checked;try{if(checked&&state.ai?.enabled&&!await APVoice.ensureConsent()){e.target.checked=false;return}await APVoice.savePreferences({voice_transcript_enabled:checked});state.prefs=await APVoice.preferences(true);syncVoicePreferenceUI()}catch(err){e.target.checked=!checked}});
    q('jobChatAutoTranslateToggle')?.addEventListener('change',async e=>{const checked=e.target.checked;try{if(checked&&state.ai?.enabled&&!await APVoice.ensureConsent()){e.target.checked=false;return}await APVoice.savePreferences({auto_translate_voice:checked});state.prefs=await APVoice.preferences(true);syncVoicePreferenceUI();if(checked)maybeAutoTranslateLatest().catch(()=>{})}catch(err){e.target.checked=!checked}});
    q('jobChatMessages')?.addEventListener('click',async e=>{
      const btn=e.target.closest('[data-chat-action]');if(!btn)return;
      const id=btn.dataset.messageId,action=btn.dataset.chatAction;
      if(action==='translate')await translateMessage(id);
      if(action==='transcribe')await transcribeMessage(id);
      if(action==='archive')await saveAttachmentToArchive(id);
      if(action==='gallery')await saveImageToGallery(id);
      if(action==='share')await shareAttachment(id);
      if(action==='download')await downloadAttachment(id);
    });
  }

  function renderLanguageOptions(){
    const el=q('jobChatLanguage');if(!el||!globalThis.APVoice)return;
    el.innerHTML=Object.entries(APVoice.LANGUAGES).map(([code,name])=>`<option value="${code}">${esc(name)}</option>`).join('');
  }

  async function resolveCloudJob(localId){
    const {client,company}=cloud();if(!client||!company||!localId)return'';
    try{
      const direct=await globalThis.JobAssignments?.resolveCloudJobId?.(localId);if(direct)return direct;
    }catch(e){}
    const {data,error}=await client.from('jobs').select('id').eq('company_id',company.id).eq('local_id',String(localId)).is('deleted_at',null).maybeSingle();
    if(error)throw error;return data?.id||'';
  }


  function myRole(){return cloud().membership?.role||''}
  function canManageParticipants(){return ['owner','office'].includes(myRole())}
  function participantFor(userId){return state.participants.find(p=>p.user_id===userId)||null}
  function memberFor(userId){return state.members.find(m=>m.user_id===userId)||null}
  function showParticipantsPanel(show=true){const panel=q('jobChatParticipantsPanel'),btn=q('jobChatParticipantsBtn');if(panel){panel.hidden=!show;panel.classList.toggle('hidden',!show)}if(btn)btn.setAttribute('aria-expanded',show?'true':'false')}
  function toggleParticipantsPanel(){showParticipantsPanel(q('jobChatParticipantsPanel')?.hidden!==false)}

  async function loadParticipants(){
    const {client,company,session}=cloud();if(!client||!company||!state.cloudJobId)return false;
    const [{data:participants,error:pErr},{data:members,error:mErr}]=await Promise.all([
      client.from('job_chat_participants').select('company_id,job_id,user_id,source,added_by,joined_at').eq('company_id',company.id).eq('job_id',state.cloudJobId).order('joined_at',{ascending:true}),
      client.from('company_members').select('user_id,display_name,email,role,status').eq('company_id',company.id).eq('status','active').order('display_name',{ascending:true})
    ]);
    if(pErr||mErr)throw pErr||mErr;
    state.participants=participants||[];state.members=members||[];
    state.isParticipant=!!participantFor(session?.user?.id||'');
    renderParticipants();applyParticipationState();return state.isParticipant;
  }

  function renderParticipants(){
    const box=q('jobChatParticipantList'),count=q('jobChatParticipantCount'),hint=q('jobChatParticipantHint');if(count)count.textContent=String(state.participants.length);if(!box)return;
    const byUser=new Map(state.participants.map(p=>[p.user_id,p]));
    const workers=state.members.filter(m=>m.role==='worker'&&byUser.get(m.user_id)?.source==='assignment');
    const office=state.members.filter(m=>['owner','office'].includes(m.role));
    const rows=[];
    for(const m of workers){rows.push(`<div class="jobChatParticipantRow"><span class="jobChatParticipantAvatar">${esc((m.display_name||m.email||'?').split(/\s+/).map(x=>x[0]||'').join('').slice(0,2).toUpperCase())}</span><div><b>${esc(m.display_name||m.email||'Mitarbeiter')}</b><small>${tr('worker','Mitarbeiter')} · ${tr('auto_assigned','automatisch zugewiesen')}</small></div><span class="jobChatParticipantAuto">AUTO</span></div>`)}
    for(const m of office){const p=byUser.get(m.user_id),joined=p?.source==='manual';const role=m.role==='owner'?tr('boss','Chef / Inhaber'):tr('office','Büro');rows.push(`<div class="jobChatParticipantRow"><span class="jobChatParticipantAvatar">${esc((m.display_name||m.email||'?').split(/\s+/).map(x=>x[0]||'').join('').slice(0,2).toUpperCase())}</span><div><b>${esc(m.display_name||m.email||role)}</b><small>${esc(role)} · ${joined?tr('in_chat','im Chat'):tr('not_in_chat','nicht im Chat')}</small></div>${canManageParticipants()?`<button type="button" class="btn small ${joined?'danger':''}" data-chat-participant-action="${joined?'remove':'add'}" data-user-id="${m.user_id}">${joined?tr('remove','Entfernen'):tr('add','Hinzufügen')}</button>`:(joined?'<span class="jobChatParticipantAuto">DRIN</span>':'')}</div>`)}
    box.innerHTML=rows.length?rows.join(''):'<div class="empty">Noch keine Chat-Teilnehmer.</div>';
    if(hint){hint.textContent=canManageParticipants()?`${tr('assigned_staff_auto','Zugewiesene Mitarbeiter werden automatisch aufgenommen.')} ${tr('office_chat_optional','Chef und Büro kannst du bei Bedarf hinzufügen.')}`:tr('assigned_staff_auto','Zugewiesene Mitarbeiter werden automatisch aufgenommen.')}
  }

  function applyParticipationState(){
    const {session}=cloud();const role=myRole();
    if(state.isParticipant){setComposerDisabled(false);return}
    setComposerDisabled(true);
    const box=q('jobChatMessages');if(!box)return;
    if(['owner','office'].includes(role)){
      const me=state.members.find(m=>m.user_id===session?.user?.id);
      box.innerHTML=`<div class="jobChatJoinPrompt"><span>🔒</span><b>${tr('not_in_chat_title','Du bist noch nicht in diesem Chat')}</b><small>${tr('assigned_staff_auto','Zugewiesene Mitarbeiter werden automatisch aufgenommen.')} ${tr('office_chat_optional','Chef und Büro kannst du bei Bedarf hinzufügen.')}</small>${me?`<button type="button" class="btn primary" data-chat-join-self="${me.user_id}">${tr('join_chat','Mich zum Chat hinzufügen')}</button>`:''}</div>`;
      box.querySelector('[data-chat-join-self]')?.addEventListener('click',()=>setManualParticipant(session.user.id,true));
    }else box.innerHTML=`<div class="jobChatJoinPrompt"><span>🔒</span><b>${tr('no_chat_access','Kein Zugriff auf diesen Baustellenchat')}</b><small>Du wirst automatisch freigeschaltet, sobald du dieser Baustelle zugewiesen bist.</small></div>`;
  }

  async function setManualParticipant(userId,add){
    const {client,company,session}=cloud();if(!canManageParticipants()||!client||!company||!session?.user||!state.cloudJobId||!userId)return;
    try{
      if(add){const {error}=await client.from('job_chat_participants').insert({company_id:company.id,job_id:state.cloudJobId,user_id:userId,source:'manual',added_by:session.user.id});if(error)throw error}
      else{const {error}=await client.from('job_chat_participants').delete().eq('company_id',company.id).eq('job_id',state.cloudJobId).eq('user_id',userId).eq('source','manual');if(error)throw error}
      const wasMe=userId===session.user.id;await loadParticipants();
      if(wasMe&&state.isParticipant){await loadMessages();await markRead();maybeAutoTranslateLatest().catch(()=>{})}
      if(wasMe&&!state.isParticipant){state.messages=[];state.archiveLinks.clear();applyParticipationState()}
      globalThis.toast?.(add?'✓ Zum Baustellenchat hinzugefügt':'Aus dem Baustellenchat entfernt');
    }catch(e){console.error('Chat participant',e);globalThis.toast?.('Chat-Teilnehmer konnten nicht geändert werden.')}
  }

  async function open(localJobId){
    inject();await closeChannel();state.localJobId=String(localJobId||'');state.cloudJobId='';state.messages=[];state.participants=[];state.members=[];state.archiveLinks.clear();state.isParticipant=false;
    const card=q('jobChatCard');if(card)card.classList.toggle('jobChatUnavailable',!state.localJobId);showParticipantsPanel(false);
    if(!state.localJobId){renderUnavailable('Baustelle zuerst speichern, dann ist der Team-Chat verfügbar.');return}
    const {client,company,session}=cloud();
    if(!client||!company||!session?.user){renderUnavailable('Für den Baustellenchat ist das Betriebskonto erforderlich.');return}
    try{
      state.cloudJobId=await resolveCloudJob(state.localJobId);
      if(!state.cloudJobId){try{await globalThis.CloudSync?.pushSnapshot?.();state.cloudJobId=await resolveCloudJob(state.localJobId)}catch(e){}}
      if(!state.cloudJobId){renderUnavailable('Baustelle wird noch mit der Cloud synchronisiert. Bitte kurz erneut öffnen.');return}
      [state.prefs,state.ai]=await Promise.all([APVoice.preferences(true),APVoice.status()]);syncVoicePreferenceUI();
      await loadParticipants();subscribe();
      if(state.isParticipant){await loadMessages();await markRead();maybeAutoTranslateLatest().catch(()=>{})}
      refreshUnreadCounts().catch(()=>{});
    }catch(e){console.error('JobChat open',e);renderUnavailable('Chat konnte nicht geladen werden. Bitte Verbindung prüfen.')}
  }

  function renderUnavailable(text){const box=q('jobChatMessages');if(box)box.innerHTML=`<div class="empty">${esc(text)}</div>`;setComposerDisabled(true)}
  function setComposerDisabled(disabled){['jobChatInput','jobChatAttachBtn','jobChatMicBtn','jobChatSendBtn'].forEach(id=>{const el=q(id);if(el)el.disabled=!!disabled})}

  async function loadMessages(){
    const {client,company}=cloud();if(!client||!state.cloudJobId||!state.isParticipant)return;
    const [{data,error},{data:links,error:linkErr}]=await Promise.all([
      client.from('job_chat_messages').select('id,company_id,job_id,sender_user_id,sender_display_name,message_type,body,attachment_path,attachment_name,attachment_mime,attachment_size,voice_duration_seconds,original_language,transcript_text,transcript_status,translations,ai_error_code,reply_to,created_at').eq('company_id',company.id).eq('job_id',state.cloudJobId).order('created_at',{ascending:true}).limit(200),
      client.from('job_chat_archive_links').select('message_id,customer_file_id,created_at').eq('company_id',company.id).eq('job_id',state.cloudJobId)
    ]);
    if(error||linkErr)throw error||linkErr;state.messages=data||[];state.archiveLinks=new Map((links||[]).map(x=>[x.message_id,x]));setComposerDisabled(false);await render();
  }

  async function signedFor(path){if(!path)return'';try{return await APVoice.signedUrl(path,3600)}catch{return''}}
  function time(v){try{return new Date(v).toLocaleTimeString(globalThis.API18n?.locale?.()||'de-DE',{hour:'2-digit',minute:'2-digit'})}catch{return''}}
  function day(v){try{return new Date(v).toLocaleDateString(globalThis.API18n?.locale?.()||'de-DE',{day:'2-digit',month:'2-digit'})}catch{return''}}

  async function render(){
    const box=q('jobChatMessages');if(!box)return;if(!state.isParticipant){applyParticipationState();return}
    const {session}=cloud();const myId=session?.user?.id||'';const prefs=state.prefs||await APVoice.preferences();const target=APVoice.cleanLang(prefs.preferred_language||'de');
    if(!state.messages.length){box.innerHTML='<div class="jobChatEmpty"><span>💬</span><b>Noch keine Nachrichten</b><small>Schreibe die erste Nachricht zu dieser Baustelle.</small></div>';return}
    const rows=await Promise.all(state.messages.map(async m=>{
      const own=m.sender_user_id===myId,translation=m.translations?.[target]?.text||'';let media='';const url=m.attachment_path?await signedFor(m.attachment_path):'';const archived=state.archiveLinks.has(m.id);
      if(m.message_type==='image'&&url)media=`<a class="jobChatImageLink" href="${esc(url)}" target="_blank" rel="noopener"><img class="jobChatImage" src="${esc(url)}" alt="${esc(m.attachment_name||'Chatbild')}"></a>`;
      else if(m.message_type==='voice'&&url)media=`<audio class="jobChatAudio" controls preload="metadata" src="${esc(url)}"></audio><small class="jobChatDuration">🎙️ ${APVoice.fmtDuration(m.voice_duration_seconds)}</small>`;
      else if(m.attachment_path&&url)media=`<a class="jobChatFile" href="${esc(url)}" target="_blank" rel="noopener"><span>📎</span><div><b>${esc(m.attachment_name||'Datei')}</b><small>${Math.max(1,Math.round((Number(m.attachment_size)||0)/1024))} KB</small></div></a>`;
      const mediaActions=m.attachment_path&&m.message_type!=='voice'?`<div class="jobChatMediaActions">${m.message_type==='image'?`<button type="button" data-chat-action="gallery" data-message-id="${m.id}">🖼️ ${tr('gallery','Galerie')}</button>`:''}<button type="button" data-chat-action="share" data-message-id="${m.id}">↗ ${tr('share','Teilen')}</button><button type="button" data-chat-action="${archived?'none':'archive'}" data-message-id="${m.id}" ${archived?'disabled':''}>${archived?'✓ '+tr('saved_to_file','In Akte gespeichert'):'📁 '+tr('save_to_file','In Akte')}</button>${m.message_type!=='image'?`<button type="button" data-chat-action="download" data-message-id="${m.id}">⬇ Laden</button>`:''}</div>`:'';
      const transcript=m.transcript_text?`<div class="jobChatTranscript"><span>TRANSKRIPT</span><p>${esc(m.transcript_text)}</p></div>`:'';
      const translated=translation?`<div class="jobChatTranslation"><span>${esc(APVoice.langLabel(target).toUpperCase())}</span><p>${esc(translation)}</p></div>`:'';
      const aiEnabled=!!state.ai?.enabled;const canTranscribe=m.message_type==='voice'&&!m.transcript_text&&aiEnabled;const source=String(m.transcript_text||m.body||'').trim();const canTranslate=!!source&&aiEnabled&&!translation;
      const actions=(canTranscribe||canTranslate)?`<div class="jobChatAiActions">${canTranscribe?`<button type="button" data-chat-action="transcribe" data-message-id="${m.id}">✨ Text erstellen</button>`:''}${canTranslate?`<button type="button" data-chat-action="translate" data-message-id="${m.id}">🌍 Übersetzen</button>`:''}</div>`:'';
      const status=m.message_type==='voice'&&!m.transcript_text&&m.transcript_status==='failed'?'<small class="jobChatAiError">KI-Verarbeitung fehlgeschlagen · Audio bleibt erhalten.</small>':'';
      return `<div class="jobChatBubbleRow ${own?'own':'other'}"><div class="jobChatBubble"><div class="jobChatMeta"><b>${esc(own?'Du':(m.sender_display_name||'Teammitglied'))}</b><span>${esc(day(m.created_at))} · ${esc(time(m.created_at))}</span></div>${m.body?`<p class="jobChatText">${esc(m.body)}</p>`:''}${media}${mediaActions}${transcript}${translated}${status}${actions}</div></div>`;
    }));
    box.innerHTML=rows.join('');requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight});
  }

  function messageById(id){return state.messages.find(m=>m.id===id)||null}
  async function downloadBlob(message){const {client}=cloud();if(!client||!message?.attachment_path)throw new Error('Datei nicht verfügbar.');const {data,error}=await client.storage.from('company-files').download(message.attachment_path);if(error||!data)throw error||new Error('Datei nicht verfügbar.');return data}
  function attachmentFile(message,blob){const name=message?.attachment_name||`AngebotsPilot-${Date.now()}`;try{return new File([blob],name,{type:message?.attachment_mime||blob.type||'application/octet-stream',lastModified:Date.now()})}catch{return blob}}
  async function shareBlob(message,blob,{gallery=false}={}){
    const file=attachmentFile(message,blob),name=message?.attachment_name||'Datei';
    if(globalThis.__ANGEBOTSPILOT_NATIVE__&&globalThis.NativeFeatures?.shareBlobFile){await NativeFeatures.shareBlobFile(blob,name,gallery?'In Galerie sichern':'Datei teilen');return}
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){if(gallery)globalThis.toast?.('Im Teilen-Menü „Bild sichern“ wählen.');await navigator.share({title:name,files:[file]});return}
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);if(gallery)globalThis.toast?.('Bild wurde als Datei bereitgestellt.')
  }
  async function shareAttachment(id){const m=messageById(id);if(!m)return;try{await shareBlob(m,await downloadBlob(m))}catch(e){if(String(e?.name||'')!=='AbortError'){console.error(e);globalThis.toast?.('Datei konnte nicht geteilt werden.')}}}
  async function saveImageToGallery(id){const m=messageById(id);if(!m||m.message_type!=='image')return;try{await shareBlob(m,await downloadBlob(m),{gallery:true})}catch(e){if(String(e?.name||'')!=='AbortError'){console.error(e);globalThis.toast?.('Bild konnte nicht für die Galerie bereitgestellt werden.')}}}
  async function downloadAttachment(id){const m=messageById(id);if(!m)return;try{const blob=await downloadBlob(m),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=m.attachment_name||'Datei';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}catch(e){console.error(e);globalThis.toast?.('Download fehlgeschlagen.')}}
  async function saveAttachmentToArchive(id){
    const m=messageById(id);if(!m||!['image','file'].includes(m.message_type)||state.archiveLinks.has(id)||state.busy)return;
    if(!globalThis.CloudFiles?.uploadJobFile)return globalThis.toast?.('Baustellenakte ist noch nicht bereit.');
    const {client,company,session}=cloud();if(!client||!company||!session?.user)return;
    state.busy=true;let uploaded=null;
    try{
      const blob=await downloadBlob(m);uploaded=await CloudFiles.uploadJobFile(state.localJobId,blob,m.attachment_name||`Chat-${m.message_type==='image'?'Foto':'Datei'}`,m.message_type==='image'?'photo':'document');
      const {data,error}=await client.from('job_chat_archive_links').insert({company_id:company.id,job_id:state.cloudJobId,message_id:m.id,customer_file_id:uploaded.id,saved_by:session.user.id}).select('message_id,customer_file_id,created_at').single();
      if(error)throw error;state.archiveLinks.set(m.id,data);await CloudFiles.refreshJob?.(state.localJobId,{render:false});globalThis.refreshOpenJobPhotosFromCloud?.(state.localJobId);await render();globalThis.toast?.('✓ In der Baustellenakte gespeichert');
    }catch(e){console.error('Chat archive',e);if(uploaded?.id){try{await CloudFiles.deleteCloudFile?.(uploaded.id)}catch{}}globalThis.toast?.(String(e?.code||'')==='23505'?'Bereits in der Baustellenakte gespeichert.':'Konnte nicht in der Baustellenakte gespeichert werden.')}
    finally{state.busy=false}
  }

  async function markRead(){
    const {client,company,session}=cloud();if(!client||!company||!session?.user||!state.cloudJobId||!isActive())return;
    const last=state.messages[state.messages.length-1];
    const {error}=await client.from('job_chat_reads').upsert({company_id:company.id,job_id:state.cloudJobId,user_id:session.user.id,last_read_at:new Date().toISOString(),last_read_message_id:last?.id||null,updated_at:new Date().toISOString()},{onConflict:'job_id,user_id'});
    if(error)console.warn('Chat read marker',error);
  }

  async function sendText(){
    const input=q('jobChatInput'),text=String(input?.value||'').trim();if(!text||state.busy)return;
    if(!state.cloudJobId)return globalThis.toast?.('Baustelle ist noch nicht in der Cloud.');
    const {client,company,session}=cloud();if(!client||!company||!session?.user)return;
    state.busy=true;try{
      const {data,error}=await client.from('job_chat_messages').insert({company_id:company.id,job_id:state.cloudJobId,sender_user_id:session.user.id,client_id:APVoice.uuid(),message_type:'text',body:text}).select().single();
      if(error)throw error;if(input)input.value='';await notifyParticipants(data,text);await loadMessages();await markRead();
    }catch(e){console.error(e);globalThis.toast?.('Nachricht konnte nicht gesendet werden.')}finally{state.busy=false}
  }

  async function sendFiles(files=[]){
    if(!files.length||state.busy||!state.cloudJobId)return;
    const max=10*1024*1024;
    state.busy=true;try{
      for(const file of files.slice(0,8)){
        if(file.size>max){globalThis.toast?.(`${file.name}: Datei ist zu groß.`);continue}
        const kind=String(file.type||'').startsWith('image/')?'image':'file';
        const path=`${cloud().company.id}/jobs/${state.cloudJobId}/chat/${APVoice.uuid()}-${APVoice.safeName(file.name||'datei')}`;
        await APVoice.upload(path,file);
        try{
          const {data,error}=await cloud().client.from('job_chat_messages').insert({company_id:cloud().company.id,job_id:state.cloudJobId,sender_user_id:cloud().session.user.id,client_id:APVoice.uuid(),message_type:kind,body:'',attachment_path:path,attachment_name:file.name||'Datei',attachment_mime:file.type||'application/octet-stream',attachment_size:file.size||0}).select().single();
          if(error)throw error;await notifyParticipants(data,kind==='image'?'📷 Foto':'📎 Datei');
        }catch(e){try{await APVoice.remove(path)}catch{}throw e}
      }
      await loadMessages();await markRead();
    }catch(e){console.error(e);globalThis.toast?.('Datei konnte nicht gesendet werden.')}finally{state.busy=false}
  }

  async function toggleRecording(){if(state.recording)return stopRecordingAndSend();return startRecording()}
  async function startRecording(){
    if(!state.cloudJobId||state.busy)return;
    try{
      const cfg=state.ai||await APVoice.status();
      state.recording=await APVoice.startRecorder({maxSeconds:Number(cfg.max_audio_seconds)||180,onTick:s=>{const el=q('jobChatRecordTime');if(el)el.textContent=APVoice.fmtDuration(s)},onAutoStop:()=>globalThis.toast?.('Maximale Länge erreicht · Sprachmemo wird gesendet.')});
      q('jobChatRecorder')?.classList.remove('hidden');if(q('jobChatRecorder'))q('jobChatRecorder').hidden=false;q('jobChatMicBtn')?.classList.add('recording');
    }catch(e){console.error(e);globalThis.toast?.(e.message||'Mikrofon konnte nicht gestartet werden.')}
  }
  async function stopRecordingAndSend(){
    if(!state.recording||state.busy)return;const rec=state.recording;state.recording=null;state.busy=true;
    q('jobChatRecorder')?.classList.add('hidden');if(q('jobChatRecorder'))q('jobChatRecorder').hidden=true;q('jobChatMicBtn')?.classList.remove('recording');
    try{
      const result=await rec.stop();if(!result?.blob?.size)throw new Error('Leere Aufnahme.');
      const path=`${cloud().company.id}/jobs/${state.cloudJobId}/chat/${APVoice.uuid()}-${APVoice.safeName(result.fileName)}`;
      await APVoice.upload(path,result.blob);
      let message;
      try{
        const {data,error}=await cloud().client.from('job_chat_messages').insert({company_id:cloud().company.id,job_id:state.cloudJobId,sender_user_id:cloud().session.user.id,client_id:APVoice.uuid(),message_type:'voice',body:'',attachment_path:path,attachment_name:result.fileName,attachment_mime:result.mimeType,attachment_size:result.blob.size,voice_duration_seconds:Math.min(180,result.durationSeconds)}).select().single();
        if(error)throw error;message=data;
      }catch(e){try{await APVoice.remove(path)}catch{}throw e}
      await notifyParticipants(message,'🎙️ Sprachmemo');
      await loadMessages();await markRead();
      state.prefs=await APVoice.preferences(true);state.ai=await APVoice.status();
      if(state.ai.enabled&&state.prefs.voice_transcript_enabled){
        const consent=await APVoice.ensureConsent();
        if(consent){
          APVoice.invoke('process_chat_voice',{job_id:state.cloudJobId,message_id:message.id,target_language:state.prefs.auto_translate_voice?state.prefs.preferred_language:''})
            .then(()=>loadMessages()).catch(e=>{console.error(e);globalThis.toast?.('Sprachmemo gesendet · KI-Text konnte nicht erstellt werden.')});
        }
      }
    }catch(e){console.error(e);globalThis.toast?.(e.message||'Sprachmemo konnte nicht gesendet werden.')}finally{state.busy=false}
  }

  async function transcribeMessage(id){
    if(!id||!state.ai?.enabled)return globalThis.toast?.('KI-Sprachfunktionen sind noch nicht aktiviert.');
    if(!await APVoice.ensureConsent())return;
    try{await APVoice.invoke('process_chat_voice',{job_id:state.cloudJobId,message_id:id,target_language:state.prefs?.auto_translate_voice?state.prefs.preferred_language:''});await loadMessages()}catch(e){console.error(e);globalThis.toast?.('Transkription konnte nicht erstellt werden.')}
  }
  async function translateMessage(id){
    if(!id||!state.ai?.enabled)return globalThis.toast?.('KI-Übersetzung ist noch nicht aktiviert.');
    if(!await APVoice.ensureConsent())return;
    const target=APVoice.cleanLang(state.prefs?.preferred_language||'de');
    try{await APVoice.invoke('translate_chat_message',{job_id:state.cloudJobId,message_id:id,target_language:target});await loadMessages()}catch(e){console.error(e);globalThis.toast?.('Übersetzung konnte nicht erstellt werden.')}
  }

  async function maybeAutoTranslateMessage(id){
    if(!id||!state.ai?.enabled||!state.prefs?.auto_translate_voice||!state.prefs?.voice_ai_consent_at||state.autoProcessing.has(id))return;
    const {session}=cloud();const m=state.messages.find(x=>x.id===id);if(!m||m.sender_user_id===session?.user?.id||m.message_type!=='voice'||m.transcript_status==='failed')return;
    const target=APVoice.cleanLang(state.prefs.preferred_language||'de');
    if(m.translations?.[target]?.text)return;
    if(m.transcript_text&&APVoice.cleanLang(m.original_language||'', '')===target)return;
    state.autoProcessing.add(id);
    try{await APVoice.invoke('process_chat_voice',{job_id:state.cloudJobId,message_id:id,target_language:target});await loadMessages()}
    catch(e){console.warn('Auto-Übersetzung fehlgeschlagen',e)}
    finally{state.autoProcessing.delete(id)}
  }
  async function maybeAutoTranslateLatest(){
    const latest=[...state.messages].reverse().find(m=>m.message_type==='voice');
    if(latest)await maybeAutoTranslateMessage(latest.id);
  }

  async function notifyParticipants(message,preview){
    try{
      const {client,company,session}=cloud();if(!client||!company||!session?.user||!globalThis.Notifications)return;
      const {data:participants,error}=await client.from('job_chat_participants').select('user_id').eq('company_id',company.id).eq('job_id',state.cloudJobId);if(error)throw error;
      const ids=[...new Set((participants||[]).map(x=>x.user_id).filter(id=>id&&id!==session.user.id))];if(!ids.length)return;
      const job=(globalThis.data?.jobs||[]).find(j=>String(j.id)===String(state.localJobId));const title=`Chat · ${job?.title||'Baustelle'}`;const body=String(preview||'Neue Nachricht').slice(0,160);
      await Notifications.notifyUsers(ids,title,body,{type:'chat',tag:`chat-${message?.id||Date.now()}`,url:'./?screen=jobs',metadata:{screen:'jobs',job_local_id:state.localJobId}});
    }catch(e){console.warn('Chat notification',e)}
  }

  function subscribe(){
    const {client}=cloud();if(!client||!state.cloudJobId)return;
    state.channel=client.channel(`job-chat-${state.cloudJobId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'job_chat_messages',filter:`job_id=eq.${state.cloudJobId}`},payload=>{
        if(state.isParticipant&&isActive())loadMessages().then(async()=>{await markRead();await maybeAutoTranslateMessage(payload?.new?.id||'')}).catch(()=>{});else refreshUnreadCounts().catch(()=>{});
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'job_chat_participants',filter:`job_id=eq.${state.cloudJobId}`},async()=>{
        const was=state.isParticipant;try{await loadParticipants();if(!was&&state.isParticipant)await loadMessages();if(was&&!state.isParticipant){state.messages=[];state.archiveLinks.clear();applyParticipationState()}}catch(e){console.warn('Chat participant realtime',e)}
      }).subscribe();
  }
  async function closeChannel(){const {client}=cloud();if(state.channel&&client){try{await client.removeChannel(state.channel)}catch{}}state.channel=null}

  async function refreshUnreadCounts(){
    const {client,company,session}=cloud();if(!client||!company||!session?.user||!globalThis.data?.jobs)return;
    try{
      const {data:jobs,error:jobErr}=await client.from('jobs').select('id,local_id').eq('company_id',company.id).is('deleted_at',null);if(jobErr)throw jobErr;
      const cloudIds=(jobs||[]).map(j=>j.id);if(!cloudIds.length)return;
      const [{data:messages,error:mErr},{data:reads,error:rErr}]=await Promise.all([
        client.from('job_chat_messages').select('job_id,sender_user_id,created_at').eq('company_id',company.id).in('job_id',cloudIds).order('created_at',{ascending:false}).limit(1000),
        client.from('job_chat_reads').select('job_id,last_read_at').eq('company_id',company.id).eq('user_id',session.user.id)
      ]);if(mErr||rErr)throw mErr||rErr;
      const readMap=new Map((reads||[]).map(r=>[r.job_id,new Date(r.last_read_at||0).getTime()]));
      const counts=new Map();for(const m of messages||[]){if(m.sender_user_id===session.user.id)continue;const last=readMap.get(m.job_id)||0;if(new Date(m.created_at).getTime()>last)counts.set(m.job_id,(counts.get(m.job_id)||0)+1)}
      const localMap=new Map((jobs||[]).map(j=>[j.id,String(j.local_id||j.id)]));
      document.querySelectorAll('[data-job-chat-badge]').forEach(el=>{const local=el.dataset.jobChatBadge;const cloudId=[...localMap.entries()].find(([,lid])=>lid===String(local))?.[0];const n=cloudId?(counts.get(cloudId)||0):0;el.textContent=n>99?'99+':String(n);el.hidden=!n;el.classList.toggle('hidden',!n)});
    }catch(e){console.warn('Unread chat count',e)}
  }

  function ensureJobBadges(){
    const list=q('jobList');if(!list||!globalThis.data?.jobs)return;
    for(const j of data.jobs||[]){
      const btn=[...list.querySelectorAll('button[onclick^="editJob("]')].find(b=>String(b.getAttribute('onclick')||'')===`editJob('${j.id}')`);
      if(btn&&!Array.from(btn.parentElement?.querySelectorAll('[data-job-chat-badge]')||[]).some(el=>el.dataset.jobChatBadge===String(j.id))){
        const badge=document.createElement('span');badge.className='jobChatListBadge hidden';badge.hidden=true;badge.dataset.jobChatBadge=String(j.id);badge.textContent='0';btn.before(badge);
      }
    }
  }

  function syncVoicePreferenceUI(){
    const prefs=state.prefs||{};const lang=q('jobChatLanguage'),tr=q('jobChatTranscriptToggle'),at=q('jobChatAutoTranslateToggle'),statusEl=q('jobChatAiStatus');
    if(lang)lang.value=APVoice.cleanLang(prefs.preferred_language||'de');if(tr)tr.checked=!!prefs.voice_transcript_enabled;if(at)at.checked=!!prefs.auto_translate_voice;
    if(statusEl){statusEl.textContent=state.ai?.enabled?'✨ KI bereit · Transkription/Übersetzung nur mit deiner Einwilligung':'✨ KI vorbereitet · derzeit deaktiviert, Sprachmemos funktionieren trotzdem';statusEl.classList.toggle('ready',!!state.ai?.enabled)}
  }

  function patchAppHooks(){
    const edit=globalThis.editJob;if(typeof edit==='function'&&!edit.__jobChatPatched){const wrapped=function(id){const r=edit.apply(this,arguments);setTimeout(()=>open(id),0);return r};wrapped.__jobChatPatched=true;globalThis.editJob=wrapped}
    const fresh=globalThis.newJob;if(typeof fresh==='function'&&!fresh.__jobChatPatched){const wrapped=function(){closeChannel();state.localJobId='';state.cloudJobId='';const r=fresh.apply(this,arguments);setTimeout(()=>{inject();renderUnavailable('Baustelle zuerst speichern, dann ist der Team-Chat verfügbar.')},0);return r};wrapped.__jobChatPatched=true;globalThis.newJob=wrapped}
    const renderJobsFn=globalThis.renderJobs;if(typeof renderJobsFn==='function'&&!renderJobsFn.__jobChatPatched){const wrapped=function(){const r=renderJobsFn.apply(this,arguments);setTimeout(()=>{ensureJobBadges();refreshUnreadCounts().catch(()=>{})},0);return r};wrapped.__jobChatPatched=true;globalThis.renderJobs=wrapped}
  }

  globalThis.JobChat={open,refreshUnreadCounts,syncVoicePreferenceUI,load:loadMessages,loadParticipants};
  const start=()=>{inject();patchAppHooks();document.addEventListener('ap-language-changed',()=>{renderParticipants();if(state.isParticipant)render().catch(()=>{})});setTimeout(()=>{ensureJobBadges();refreshUnreadCounts().catch(()=>{})},1200)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
