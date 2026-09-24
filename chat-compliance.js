/* AngebotsPilot v11.32.11 – Chat Store & Legal Hardening */
(function(){
  'use strict';
  const POLICY_VERSION='2026-09-24.1';
  const q=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const cloud=()=>globalThis.getCloudState?.()||{};
  const state={jobId:'',localJobId:'',accepted:false,blocks:new Set(),settings:null,restriction:null,reportTarget:null,ready:false,busy:false};
  const role=()=>cloud().membership?.role||'';
  const canModerate=()=>['owner','office'].includes(role());
  const me=()=>cloud().session?.user?.id||'';
  const notify=(m,t='info')=>globalThis.toast?.(m,t);

  function inject(){
    if(q('chatComplianceTerms'))return;
    document.body.insertAdjacentHTML('beforeend',`
      <div id="chatComplianceTerms" class="chatComplianceOverlay hidden" hidden>
        <div class="chatComplianceSheet" role="dialog" aria-modal="true" aria-labelledby="chatTermsTitle">
          <div class="chatComplianceHead"><div><span class="securityBadge">🛡️ CHAT-REGELN</span><h3 id="chatTermsTitle">Regeln für den Baustellenchat</h3><p>Vor dem ersten Senden einmal bestätigen.</p></div><button type="button" class="chatComplianceClose" data-chat-compliance-close="terms">×</button></div>
          <div class="chatComplianceRules">
            <p><b>Der Chat ist für die Zusammenarbeit auf der Baustelle.</b></p>
            <ul><li>Keine Drohungen, Belästigungen, diskriminierenden oder sexuell anstößigen Inhalte.</li><li>Keine illegalen Inhalte, Schadsoftware, Spam oder unnötige private/sensible Daten.</li><li>Fotos, Dateien und personenbezogene Daten nur teilen, wenn sie für den Auftrag erforderlich sind.</li><li>Problematische Inhalte können gemeldet und Nutzer blockiert werden. Chef/Büro kann Chat-Zugriff zeitweise sperren.</li><li>Chatdaten werden nach der betrieblichen Aufbewahrungsregel gelöscht; archivierte Geschäftsunterlagen und rechtlich erforderliche Nachweise können getrennt länger gespeichert werden.</li></ul>
          </div>
          <label class="chatComplianceCheck"><input id="chatTermsCheck" type="checkbox"><span>Ich akzeptiere die Chat-Regeln und nutze den Chat nur für zulässige betriebliche Zwecke.</span></label>
          <div class="chatComplianceActions"><button type="button" class="btn" data-chat-compliance-close="terms">Abbrechen</button><button id="chatTermsAccept" type="button" class="btn primary">Regeln akzeptieren</button></div>
        </div>
      </div>
      <div id="chatReportModal" class="chatComplianceOverlay hidden" hidden>
        <div class="chatComplianceSheet" role="dialog" aria-modal="true">
          <div class="chatComplianceHead"><div><span class="securityBadge">⚑ MELDEN</span><h3>Inhalt oder Nutzer melden</h3><p>Die Meldung geht an Inhaber/Büro und wird protokolliert.</p></div><button type="button" class="chatComplianceClose" data-chat-compliance-close="report">×</button></div>
          <label class="field"><span>Grund</span><select id="chatReportCategory" class="input"><option value="harassment">Belästigung / Mobbing</option><option value="threat">Drohung / Gewalt</option><option value="discrimination">Diskriminierung / Hass</option><option value="sexual">Sexuell anstößig</option><option value="spam">Spam / unerwünschter Inhalt</option><option value="privacy">Datenschutz / private Daten</option><option value="illegal">Möglicherweise illegal</option><option value="other">Sonstiges</option></select></label>
          <label class="field"><span>Optionaler Hinweis</span><textarea id="chatReportDetails" maxlength="2000" placeholder="Kurz beschreiben, was geprüft werden soll …"></textarea></label>
          <label class="chatComplianceCheck"><input id="chatReportBlock" type="checkbox"><span>Diese Person zusätzlich für mich blockieren.</span></label>
          <div class="chatComplianceActions"><button type="button" class="btn" data-chat-compliance-close="report">Abbrechen</button><button id="chatReportSubmit" type="button" class="btn danger">Meldung senden</button></div>
        </div>
      </div>
      <div id="chatSafetyModal" class="chatComplianceOverlay hidden" hidden>
        <div class="chatComplianceSheet chatSafetySheet" role="dialog" aria-modal="true">
          <div class="chatComplianceHead"><div><span class="securityBadge">🛡️ SICHERHEIT</span><h3>Chat-Sicherheit & Datenschutz</h3><p>Meldungen, Blockierungen, Aufbewahrung und Support.</p></div><button type="button" class="chatComplianceClose" data-chat-compliance-close="safety">×</button></div>
          <div id="chatSafetyStatus" class="chatSafetyGrid"></div>
          <div id="chatModerationSection" class="chatModerationSection hidden" hidden><div class="chatComplianceSubhead"><b>Moderationscenter</b><span id="chatModerationMeta"></span></div><div id="chatModerationList"></div></div>
          <div id="chatRetentionAdmin" class="chatRetentionAdmin hidden" hidden>
            <div class="chatComplianceSubhead"><b>Aufbewahrung</b><span>Inhaber/Büro</span></div>
            <label class="field"><span>Chatdaten nach abgeschlossenen Baustellen</span><select id="chatRetentionDays" class="input"><option value="90">90 Tage</option><option value="180">180 Tage</option><option value="365">1 Jahr</option><option value="730">2 Jahre</option><option value="1825">5 Jahre</option></select></label>
            <label class="chatComplianceCheck"><input id="chatLegalHold" type="checkbox"><span>Legal Hold – automatische Chat-Löschung vorübergehend aussetzen, wenn Daten für einen konkreten Rechts-/Sicherheitsfall benötigt werden.</span></label>
            <div class="chatComplianceActions compact"><button type="button" class="btn" id="chatRetentionSave">Speichern</button><button type="button" class="btn" id="chatRetentionRun">Löschung jetzt prüfen</button></div>
          </div>
          <div class="chatComplianceActions"><button type="button" class="btn" id="chatSupportOpen">Support kontaktieren</button><button type="button" class="btn" data-chat-compliance-close="safety">Schließen</button></div>
        </div>
      </div>
      <div id="chatSupportModal" class="chatComplianceOverlay hidden" hidden>
        <div class="chatComplianceSheet" role="dialog" aria-modal="true">
          <div class="chatComplianceHead"><div><span class="securityBadge">✉️ SUPPORT</span><h3>Support & Sicherheit</h3><p>Die Anfrage wird serverseitig protokolliert.</p></div><button type="button" class="chatComplianceClose" data-chat-compliance-close="support">×</button></div>
          <label class="field"><span>Thema</span><input id="chatSupportSubject" class="input" maxlength="240" placeholder="z. B. Datenschutz, Missbrauch, technisches Problem"></label>
          <label class="field"><span>Nachricht</span><textarea id="chatSupportMessage" maxlength="4000" placeholder="Wie können wir helfen?"></textarea></label>
          <div class="chatComplianceActions"><button type="button" class="btn" data-chat-compliance-close="support">Abbrechen</button><button id="chatSupportSubmit" type="button" class="btn primary">Anfrage senden</button></div>
        </div>
      </div>`);
    document.addEventListener('click',handleClick);
    q('chatTermsAccept')?.addEventListener('click',acceptTerms);
    q('chatReportSubmit')?.addEventListener('click',submitReport);
    q('chatSupportOpen')?.addEventListener('click',()=>{close('safety');open('support')});
    q('chatSupportSubmit')?.addEventListener('click',submitSupport);
    q('chatRetentionSave')?.addEventListener('click',saveRetentionSettings);
    q('chatRetentionRun')?.addEventListener('click',runRetentionNow);
  }

  function open(which){const el=q({terms:'chatComplianceTerms',report:'chatReportModal',safety:'chatSafetyModal',support:'chatSupportModal'}[which]);if(el){el.hidden=false;el.classList.remove('hidden')}}
  function close(which){const el=q({terms:'chatComplianceTerms',report:'chatReportModal',safety:'chatSafetyModal',support:'chatSupportModal'}[which]);if(el){el.hidden=true;el.classList.add('hidden')}}

  async function attach({jobId,localJobId}={}){
    inject();state.jobId=String(jobId||'');state.localJobId=String(localJobId||'');state.ready=false;
    const {client,company,session}=cloud();if(!client||!company||!session?.user||!state.jobId)return false;
    const [{data:accept,error:aErr},{data:blocks,error:bErr},{data:settings,error:sErr},{data:restrictions,error:rErr}]=await Promise.all([
      client.from('job_chat_policy_acceptances').select('accepted_at').eq('company_id',company.id).eq('user_id',session.user.id).eq('policy_version',POLICY_VERSION).maybeSingle(),
      client.from('job_chat_user_blocks').select('blocked_user_id').eq('company_id',company.id).eq('blocker_user_id',session.user.id),
      client.from('company_chat_settings').select('retention_days,legal_hold,updated_at').eq('company_id',company.id).maybeSingle(),
      client.from('job_chat_moderation_restrictions').select('id,reason,ends_at,starts_at').eq('company_id',company.id).eq('target_user_id',session.user.id).is('revoked_at',null).lte('starts_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(5)
    ]);
    if(aErr||bErr||sErr||rErr)throw aErr||bErr||sErr||rErr;
    state.accepted=!!accept;state.blocks=new Set((blocks||[]).map(x=>x.blocked_user_id));state.settings=settings||{retention_days:180,legal_hold:false};
    state.restriction=(restrictions||[]).find(x=>!x.ends_at||new Date(x.ends_at)>new Date())||null;state.ready=true;
    if(!state.accepted&&!state.restriction)open('terms');
    return true;
  }

  async function ensureCanPost(){
    if(!state.ready&&state.jobId)await attach({jobId:state.jobId,localJobId:state.localJobId}).catch(()=>{});
    if(state.restriction){notify(state.restriction.ends_at?'Dein Chat-Zugriff ist vorübergehend eingeschränkt.':'Dein Chat-Zugriff wurde vorübergehend gesperrt.');return false}
    if(!state.accepted){open('terms');notify('Bitte zuerst die Chat-Regeln akzeptieren.');return false}
    return true;
  }

  async function acceptTerms(){
    if(!q('chatTermsCheck')?.checked)return notify('Bitte die Chat-Regeln bestätigen.');
    const {client,company,session}=cloud();if(!client||!company||!session?.user)return;
    const btn=q('chatTermsAccept');if(btn)btn.disabled=true;
    try{
      const locale=String(globalThis.API18n?.current?.()||globalThis.API18n?.locale?.()||'de').slice(0,8);
      const {error}=await client.from('job_chat_policy_acceptances').insert({company_id:company.id,user_id:session.user.id,policy_version:POLICY_VERSION,accepted_locale:locale,acceptance_source:'app'});
      if(error&&error.code!=='23505')throw error;state.accepted=true;close('terms');notify('✓ Chat-Regeln akzeptiert');
    }catch(e){console.error('Chat terms',e);notify('Chat-Regeln konnten nicht gespeichert werden. Bitte App aktualisieren.')}finally{if(btn)btn.disabled=false}
  }

  function messageButtons(m,own){if(own||!m?.id)return'';return `<div class="jobChatSafetyActions"><button type="button" data-chat-safety-action="report-message" data-message-id="${esc(m.id)}">⚑ Melden</button></div>`}
  function participantButtons(userId){if(!userId||userId===me())return'';const blocked=state.blocks.has(userId);return `<div class="jobChatParticipantSafety"><button type="button" data-chat-safety-action="report-user" data-user-id="${esc(userId)}">⚑</button><button type="button" class="${blocked?'blocked':''}" data-chat-safety-action="${blocked?'unblock-user':'block-user'}" data-user-id="${esc(userId)}">${blocked?'✓ Entblocken':'🚫 Blockieren'}</button></div>`}

  async function setBlock(userId,blocked){
    const {client,company,session}=cloud();if(!client||!company||!session?.user||!userId||userId===session.user.id)return;
    try{
      if(blocked){const {error}=await client.from('job_chat_user_blocks').insert({company_id:company.id,blocker_user_id:session.user.id,blocked_user_id:userId});if(error&&error.code!=='23505')throw error;state.blocks.add(userId)}
      else{const {error}=await client.from('job_chat_user_blocks').delete().eq('company_id',company.id).eq('blocker_user_id',session.user.id).eq('blocked_user_id',userId);if(error)throw error;state.blocks.delete(userId)}
      notify(blocked?'Nutzer blockiert. Nachrichten werden für dich ausgeblendet.':'Nutzer entblockiert.');await globalThis.JobChat?.load?.();await globalThis.JobChat?.loadParticipants?.();
    }catch(e){console.error('Chat block',e);notify('Blockierung konnte nicht gespeichert werden.')}
  }

  function openReport({messageId='',userId=''}={}){
    state.reportTarget={messageId:String(messageId||''),userId:String(userId||'')};q('chatReportCategory').value='harassment';q('chatReportDetails').value='';q('chatReportBlock').checked=false;open('report');
  }
  async function submitReport(){
    const {client,company,session}=cloud();if(!client||!company||!session?.user||!state.jobId||!state.reportTarget)return;
    const message=state.reportTarget.messageId?globalThis.JobChat?.getMessage?.(state.reportTarget.messageId):null;
    const reportedUser=state.reportTarget.userId||message?.sender_user_id||null;
    const row={company_id:company.id,job_id:state.jobId,message_id:state.reportTarget.messageId||null,reporter_user_id:session.user.id,reported_user_id:reportedUser,category:q('chatReportCategory').value,details:String(q('chatReportDetails').value||'').trim()};
    const btn=q('chatReportSubmit');if(btn)btn.disabled=true;
    try{const {error}=await client.from('job_chat_reports').insert(row);if(error)throw error;if(q('chatReportBlock').checked&&reportedUser)await setBlock(reportedUser,true);close('report');notify('✓ Meldung wurde gespeichert.')}catch(e){console.error('Chat report',e);notify('Meldung konnte nicht gesendet werden.')}finally{if(btn)btn.disabled=false}
  }

  async function openSafety(){
    inject();open('safety');const box=q('chatSafetyStatus');if(box)box.innerHTML='<div class="empty">Sicherheitsstatus wird geladen …</div>';
    const {client,company}=cloud();if(!client||!company)return;
    try{
      await attach({jobId:state.jobId,localJobId:state.localJobId});
      const blocked=state.blocks.size,ret=Number(state.settings?.retention_days||180),hold=!!state.settings?.legal_hold;
      if(box)box.innerHTML=`<div class="chatSafetyFact"><b>${state.accepted?'✓':'!'} Chat-Regeln</b><span>${state.accepted?'Akzeptiert':'Noch nicht akzeptiert'}</span></div><div class="chatSafetyFact"><b>🚫 ${blocked} blockiert</b><span>Blockierte Nutzer werden für dich ausgeblendet.</span></div><div class="chatSafetyFact"><b>🗑️ ${ret} Tage</b><span>Aufbewahrung bei abgeschlossenen Baustellen${hold?' · Legal Hold aktiv':''}.</span></div>`;
      const sec=q('chatModerationSection'),retAdmin=q('chatRetentionAdmin');
      if(sec){sec.hidden=!canModerate();sec.classList.toggle('hidden',!canModerate())}
      if(retAdmin){retAdmin.hidden=!canModerate();retAdmin.classList.toggle('hidden',!canModerate())}
      if(canModerate()){
        const days=q('chatRetentionDays'),holdBox=q('chatLegalHold');
        if(days){const desired=String(ret);if([...days.options].some(o=>o.value===desired))days.value=desired;else days.value='180'}
        if(holdBox)holdBox.checked=hold;
        await loadModeration();
      }
    }catch(e){console.error(e);if(box)box.innerHTML='<div class="empty">Sicherheitsstatus konnte nicht geladen werden.</div>'}
  }

  async function loadModeration(){
    const {client,company}=cloud();if(!client||!company||!canModerate())return;
    const [{data:reports,error:rErr},{data:members,error:mErr}]=await Promise.all([
      client.from('job_chat_reports').select('id,job_id,message_id,reporter_user_id,reported_user_id,category,details,content_snapshot,status,resolution_note,created_at').eq('company_id',company.id).in('status',['open','reviewing']).order('created_at',{ascending:false}).limit(50),
      client.from('company_members').select('user_id,display_name,email').eq('company_id',company.id)
    ]);if(rErr||mErr)throw rErr||mErr;
    const names=new Map((members||[]).map(m=>[m.user_id,m.display_name||m.email||'Teammitglied']));const list=q('chatModerationList'),meta=q('chatModerationMeta');if(meta)meta.textContent=`${(reports||[]).length} offen`;
    if(!list)return;if(!(reports||[]).length){list.innerHTML='<div class="empty">Keine offenen Meldungen.</div>';return}
    list.innerHTML=(reports||[]).map(r=>`<div class="chatModerationRow" data-report-id="${r.id}"><div><b>${esc(names.get(r.reported_user_id)||'Inhalt')}</b><small>${esc(r.category)} · ${new Date(r.created_at).toLocaleString('de-DE')}</small><p>${esc(r.details||r.content_snapshot?.body||'Meldung ohne Zusatztext')}</p></div><div class="chatModerationActions"><button type="button" data-chat-safety-action="review-report" data-report-id="${r.id}">Prüfen</button>${r.reported_user_id?`<button type="button" class="danger" data-chat-safety-action="suspend-user" data-report-id="${r.id}" data-user-id="${r.reported_user_id}">24 h sperren</button>`:''}<button type="button" data-chat-safety-action="dismiss-report" data-report-id="${r.id}">Abweisen</button></div></div>`).join('');
  }

  async function moderate(action,reportId,userId=''){
    const {client,company,session}=cloud();if(!client||!company||!session?.user||!canModerate())return;
    try{
      if(action==='suspend-user'){
        const ends=new Date(Date.now()+24*3600000).toISOString();const {error}=await client.from('job_chat_moderation_restrictions').insert({company_id:company.id,target_user_id:userId,restriction_type:'chat_suspended',reason:`Meldung ${reportId}`,ends_at:ends,created_by:session.user.id});if(error)throw error;
        await client.from('job_chat_reports').update({status:'actioned',resolution_note:'Chat-Zugriff für 24 Stunden gesperrt.',resolved_by:session.user.id,resolved_at:new Date().toISOString()}).eq('company_id',company.id).eq('id',reportId);
      }else{
        const status=action==='dismiss-report'?'dismissed':'reviewing';const payload={status};if(status==='dismissed'){payload.resolved_by=session.user.id;payload.resolved_at=new Date().toISOString();payload.resolution_note='Meldung geprüft und abgewiesen.'}
        const {error}=await client.from('job_chat_reports').update(payload).eq('company_id',company.id).eq('id',reportId);if(error)throw error;
      }
      await loadModeration();notify('Moderationsstatus gespeichert.');
    }catch(e){console.error('Moderation',e);notify('Moderation konnte nicht gespeichert werden.')}
  }

  async function saveRetentionSettings(){
    const {client,company,session}=cloud();if(!client||!company||!session?.user||!canModerate())return;
    const days=Math.max(30,Math.min(3650,Number(q('chatRetentionDays')?.value)||180));
    const legalHold=!!q('chatLegalHold')?.checked;
    const ok=legalHold?(globalThis.appConfirm?await globalThis.appConfirm({title:'Legal Hold aktivieren?',text:'Automatische Chat-Löschung wird für diesen Betrieb ausgesetzt. Nutze das nur für einen konkreten Rechts-, Sicherheits- oder Beweisfall und deaktiviere es danach wieder.',confirmLabel:'Aktivieren',icon:'⚖️'}):confirm('Legal Hold aktivieren?')):true;
    if(!ok){q('chatLegalHold').checked=!!state.settings?.legal_hold;return}
    try{
      const {error}=await client.from('company_chat_settings').upsert({company_id:company.id,retention_days:days,legal_hold:legalHold,updated_by:session.user.id,updated_at:new Date().toISOString()},{onConflict:'company_id'});if(error)throw error;
      state.settings={...(state.settings||{}),retention_days:days,legal_hold:legalHold};notify('✓ Aufbewahrungsregel gespeichert');await openSafety();
    }catch(e){console.error('Chat retention settings',e);notify('Aufbewahrungsregel konnte nicht gespeichert werden.')}
  }

  async function runRetentionNow(){
    const {client,company}=cloud();if(!client||!company||!canModerate())return;
    if(state.settings?.legal_hold)return notify('Legal Hold ist aktiv. Automatische Löschung ist ausgesetzt.');
    const ok=globalThis.appConfirm?await globalThis.appConfirm({title:'Aufbewahrung jetzt prüfen?',text:'Fällige Chatnachrichten abgeschlossener Baustellen werden gemäß der gespeicherten Frist logisch gelöscht. Gemeldete Inhalte in offener Prüfung bleiben geschützt.',confirmLabel:'Prüfen',icon:'🗑️'}):confirm('Aufbewahrung jetzt prüfen?');
    if(!ok)return;
    const btn=q('chatRetentionRun');if(btn)btn.disabled=true;
    try{
      const {data,error}=await client.functions.invoke('chat-compliance',{body:{action:'run_retention',company_id:company.id}});if(error)throw error;
      const cleanup=await client.functions.invoke('chat-compliance',{body:{action:'cleanup_storage',company_id:company.id}}).catch(()=>({data:null}));
      notify(`✓ Prüfung abgeschlossen · ${Number(data?.deleted||0)} Chatnachrichten fällig${cleanup?.data?.removed?` · ${cleanup.data.removed} Dateien entfernt`:''}`);
    }catch(e){console.error('Chat retention run',e);notify('Aufbewahrungsprüfung konnte nicht abgeschlossen werden.')}finally{if(btn)btn.disabled=false}
  }

  async function submitSupport(){
    const {client,company,session}=cloud();if(!client||!session?.user)return;
    const subject=String(q('chatSupportSubject')?.value||'').trim(),message=String(q('chatSupportMessage')?.value||'').trim();if(!message)return notify('Bitte eine Nachricht eingeben.');
    const btn=q('chatSupportSubmit');if(btn)btn.disabled=true;
    try{const {data,error}=await client.from('app_support_requests').insert({company_id:company?.id||null,user_id:session.user.id,category:'safety',subject,message}).select('id').single();if(error)throw error;close('support');q('chatSupportSubject').value='';q('chatSupportMessage').value='';notify(`✓ Support-Anfrage gespeichert${data?.id?' · '+String(data.id).slice(0,8):''}`)}catch(e){console.error(e);notify('Support-Anfrage konnte nicht gespeichert werden.')}finally{if(btn)btn.disabled=false}
  }

  async function handleClick(e){
    const closeBtn=e.target.closest('[data-chat-compliance-close]');if(closeBtn){close(closeBtn.dataset.chatComplianceClose);return}
    const btn=e.target.closest('[data-chat-safety-action]');if(!btn)return;
    const action=btn.dataset.chatSafetyAction;
    if(action==='report-message')return openReport({messageId:btn.dataset.messageId});
    if(action==='report-user')return openReport({userId:btn.dataset.userId});
    if(action==='block-user')return setBlock(btn.dataset.userId,true);
    if(action==='unblock-user')return setBlock(btn.dataset.userId,false);
    if(['review-report','dismiss-report','suspend-user'].includes(action))return moderate(action,btn.dataset.reportId,btn.dataset.userId);
  }

  function safetyButton(){return '<button type="button" class="btn small" id="jobChatSafetyBtn">🛡️ Sicherheit</button>'}
  function isAccepted(){return state.accepted}
  function isBlocked(userId){return state.blocks.has(userId)}

  globalThis.APChatCompliance={POLICY_VERSION,attach,ensureCanPost,messageButtons,participantButtons,openSafety,safetyButton,isAccepted,isBlocked};
  const start=()=>inject();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
