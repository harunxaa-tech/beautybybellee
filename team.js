/* AngebotsPilot v11.5.1 – Team, sichere Einladungen & Arbeitszeiten */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  let inviteRole='worker';
  let currentInviteLink='';
  let currentMembers=[];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const roleLabel=r=>r==='owner'?'Chef / Inhaber':r==='office'?'Büro':'Mitarbeiter';
  const statusLabel=s=>s==='disabled'?'Deaktiviert':'Aktiv';
  const cloud=()=>globalThis.getCloudState?.()||{};

  function seconds(entry,now=Date.now()){
    if(!entry?.started_at)return 0;
    const start=new Date(entry.started_at).getTime();
    const end=entry.ended_at?new Date(entry.ended_at).getTime():now;
    let pause=Number(entry.break_seconds||0)*1000;
    if(entry.pause_started_at&&!entry.ended_at){
      pause+=Math.max(0,now-new Date(entry.pause_started_at).getTime());
    }
    return Math.max(0,Math.floor((end-start-pause)/1000));
  }

  function hoursLabel(sec){
    sec=Math.max(0,Math.floor(sec||0));
    const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);
    return `${h}:${String(m).padStart(2,'0')} Std.`;
  }

  function startOfTodayISO(){
    const d=new Date();d.setHours(0,0,0,0);return d.toISOString();
  }

  function startOfWeekISO(){
    const d=new Date();d.setHours(0,0,0,0);
    const day=(d.getDay()+6)%7;
    d.setDate(d.getDate()-day);
    return d.toISOString();
  }

  globalThis.selectInviteRole=function(role){
    inviteRole=role==='office'?'office':'worker';
    document.querySelectorAll('[data-teamrole]').forEach(b=>b.classList.toggle('active',b.dataset.teamrole===inviteRole));
  };

  globalThis.openTeam=async function(){
    globalThis.showScreen?.('team');
    await loadTeam();
  };

  async function loadTeam(){
    const {client,company,membership}=cloud();
    if(!client||!company||!membership){
      q('teamMemberList').innerHTML='<div class="empty">Bitte zuerst mit deinem Betriebskonto anmelden.</div>';
      return;
    }

    if(q('teamCompanyName'))q('teamCompanyName').textContent=company.name||'Betrieb';
    if(q('teamRoleHint'))q('teamRoleHint').textContent=membership.role==='owner'
      ?'Du verwaltest Einladungen, Rollen, Zugänge und siehst die Teamzeiten.'
      :membership.role==='office'
        ?'Du siehst Betriebsteam und Arbeitszeiten. Zugänge verwaltet nur der Chef.'
        :'Du siehst dein Betriebsteam.';

    try{
      const {data:members,error}=await client.from('company_members')
        .select('user_id,role,status,created_at,display_name,email')
        .eq('company_id',company.id)
        .order('created_at',{ascending:true});
      if(error)throw error;
      currentMembers=(members||[]).map(m=>({...m,name:m.display_name||''}));
      renderMembers(membership.role);

      if(['owner','office'].includes(membership.role)){
        await loadTeamTimes();
      }

      if(membership.role==='owner'){
        const {data:invites,error:ie}=await client.from('team_invitations')
          .select('id,email,invitee_name,role,expires_at,used_at,revoked_at,created_at')
          .eq('company_id',company.id)
          .order('created_at',{ascending:false});
        if(ie)throw ie;
        renderInvitations(invites||[]);
      }else if(q('teamInviteCount')){
        q('teamInviteCount').textContent='–';
      }
    }catch(e){
      console.error(e);
      q('teamMemberList').innerHTML=`<div class="empty">Team konnte nicht geladen werden: ${esc(e.message||e)}</div>`;
      const time=q('teamTimeList');if(time)time.innerHTML='<div class="empty">Arbeitszeiten konnten nicht geladen werden.</div>';
    }
  }

  function renderMembers(callerRole){
    const active=currentMembers.filter(x=>x.status==='active').length;
    q('teamActiveCount').textContent=String(active);
    q('teamMembersMeta').textContent=`${currentMembers.length} ${currentMembers.length===1?'Person':'Personen'}`;

    q('teamMemberList').innerHTML=currentMembers.length?currentMembers.map(m=>{
      const isOwner=m.role==='owner';
      const disabled=m.status==='disabled';
      const initials=(m.name||m.email||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
      const controls=callerRole==='owner'&&!isOwner?`
        <div class="teamMemberControls">
          <select onchange="changeTeamRole('${m.user_id}',this.value)" ${disabled?'disabled':''}>
            <option value="worker" ${m.role==='worker'?'selected':''}>Mitarbeiter</option>
            <option value="office" ${m.role==='office'?'selected':''}>Büro</option>
          </select>
          <button class="btn small ${disabled?'':'danger'}" onclick="toggleTeamMember('${m.user_id}','${disabled?'active':'disabled'}')">${disabled?'Aktivieren':'Deaktivieren'}</button>
        </div>`:'';
      return `<div class="card teamMemberCard ${disabled?'disabledMember':''}">
        <div class="teamAvatar">${esc(initials)}</div>
        <div class="teamMemberBody">
          <div class="itemTop"><div><b>${esc(m.name||m.email||'Teammitglied')}</b><div class="mini">${esc(m.email||'')}</div></div><span class="teamRoleBadge ${esc(m.role)}">${esc(roleLabel(m.role))}</span></div>
          <div class="mini">${esc(statusLabel(m.status))}</div>
          ${controls}
        </div>
      </div>`;
    }).join(''):'<div class="empty">Noch keine Teammitglieder.</div>';
  }

  async function loadTeamTimes(){
    const {client,company}=cloud();
    const list=q('teamTimeList'),totals=q('teamTimeTotals');
    if(!client||!company||!list)return;
    list.innerHTML='<div class="empty">Arbeitszeiten werden geladen …</div>';
    const weekStart=startOfWeekISO(),todayStart=new Date(startOfTodayISO()).getTime(),now=Date.now();
    const {data,error}=await client.from('time_entries')
      .select('id,user_id,started_at,pause_started_at,break_seconds,ended_at,job_id')
      .eq('company_id',company.id)
      .gte('started_at',weekStart)
      .order('started_at',{ascending:false});
    if(error)throw error;
    const entries=data||[];
    const workers=currentMembers.filter(m=>m.role==='worker'&&m.status==='active');
    const stats=new Map(workers.map(w=>[w.user_id,{today:0,week:0,running:false,lastJobId:''}]));
    entries.forEach(e=>{
      if(!stats.has(e.user_id))return;
      const st=stats.get(e.user_id),sec=seconds(e,now),start=new Date(e.started_at).getTime();
      st.week+=sec;
      if(start>=todayStart)st.today+=sec;
      if(!e.ended_at){st.running=true;st.lastJobId=e.job_id||''}
    });
    const totalToday=[...stats.values()].reduce((s,x)=>s+x.today,0);
    const totalWeek=[...stats.values()].reduce((s,x)=>s+x.week,0);
    if(totals)totals.innerHTML=`<div><span>Heute gesamt</span><strong>${esc(hoursLabel(totalToday))}</strong></div><div><span>Diese Woche</span><strong>${esc(hoursLabel(totalWeek))}</strong></div>`;
    if(!workers.length){list.innerHTML='<div class="empty">Noch keine aktiven Mitarbeiter.</div>';return}
    list.innerHTML=workers.map(w=>{
      const st=stats.get(w.user_id)||{today:0,week:0,running:false};
      return `<div class="teamTimeRow">
        <div class="teamTimePerson"><b>${esc(w.name||w.email||'Mitarbeiter')}</b><small>${st.running?'<span class="teamTimeRunning">● arbeitet gerade</span>':'Heute erfasst'}</small></div>
        <div class="teamTimeMetric"><span>Heute</span><strong>${esc(hoursLabel(st.today))}</strong></div>
        <div class="teamTimeMetric weekMetric"><span>Woche</span><strong>${esc(hoursLabel(st.week))}</strong></div>
      </div>`;
    }).join('');
  }

  function invitationStatus(i,now=Date.now()){
    const expired=!i.used_at&&!i.revoked_at&&new Date(i.expires_at).getTime()<=now;
    return i.used_at?'Angenommen':i.revoked_at?'Zurückgezogen':expired?'Abgelaufen':'Offen';
  }

  function invitationCard(i,{history=false}={}){
    const status=invitationStatus(i),canRevoke=status==='Offen';
    return `<div class="card teamInviteRow ${history?'historyInvite':''}">
      <div class="itemTop"><div><b>${esc(i.invitee_name||i.email||'Einladung')}</b><div class="mini">${esc(roleLabel(i.role))}${i.email?` · ${esc(i.email)}`:' · E-Mail legt Mitarbeiter fest'}</div></div><span class="inviteStatus ${status.toLowerCase()}">${esc(status)}</span></div>
      <div class="mini">${status==='Offen'?'Gültig bis':'Erstellt'} ${new Date(status==='Offen'?i.expires_at:i.created_at).toLocaleString('de-DE')}</div>
      <div class="inviteRowActions">
        ${canRevoke?`<button class="btn small danger" onclick="revokeTeamInvitation('${i.id}')">Einladung zurückziehen</button>`:''}
        ${history?`<button class="btn small danger inviteDeleteBtn" onclick="deleteTeamInvitation('${i.id}')">🗑 Löschen</button>`:''}
      </div>
    </div>`;
  }

  function renderInvitations(invites){
    const now=Date.now();
    const active=invites.filter(i=>invitationStatus(i,now)==='Offen');
    const history=invites.filter(i=>invitationStatus(i,now)!=='Offen');
    q('teamInviteCount').textContent=String(active.length);
    q('teamInviteList').innerHTML=active.length?active.map(i=>invitationCard(i)).join(''):'<div class="empty">Keine offenen Einladungen.</div>';
    const hist=q('teamInviteHistoryList');
    if(hist)hist.innerHTML=history.length?history.map(i=>invitationCard(i,{history:true})).join(''):'<div class="empty">Noch kein Einladungsverlauf.</div>';
  }

  globalThis.createTeamInvitation=async function(){
    const {client,membership}=cloud();
    if(!client||membership?.role!=='owner')return globalThis.toast?.('Nur der Chef kann einladen');
    const name=q('teamInviteName')?.value.trim()||'';
    if(!name)return globalThis.toast?.('Bitte einen Namen eingeben');

    try{
      const {data,error}=await client.rpc('create_team_invitation_simple',{invite_role:inviteRole,invitee_name:name});
      if(error)throw error;
      const base=(globalThis.AP_CLOUD_CONFIG?.appUrl||location.origin+location.pathname).replace(/\/?$/,'/');
      currentInviteLink=`${base}?invite=${encodeURIComponent(data.token)}`;
      q('teamInviteLinkText').textContent=currentInviteLink;
      q('teamInviteResultText').textContent=`${name} · ${roleLabel(inviteRole)} · 72 Stunden gültig`;
      q('teamInviteResult').classList.remove('hidden');
      q('teamInviteResult').hidden=false;
      q('teamInviteName').value='';
      globalThis.toast?.('✓ Einladung erstellt');
      await loadTeam();
    }catch(e){console.error(e);globalThis.toast?.(e.message||'Einladung fehlgeschlagen')}
  };

  globalThis.copyTeamInvitation=async function(){
    if(!currentInviteLink)return;
    try{await navigator.clipboard.writeText(currentInviteLink);globalThis.toast?.('Link kopiert')}
    catch(e){prompt('Einladungslink kopieren:',currentInviteLink)}
  };

  globalThis.shareTeamInvitation=async function(){
    if(!currentInviteLink)return;
    const text='Du wurdest zu AngebotsPilot eingeladen. Öffne den Link, trage deine eigene E-Mail ein und lege dein persönliches Passwort fest:';
    if(navigator.share){try{await navigator.share({title:'AngebotsPilot Einladung',text,url:currentInviteLink});return}catch(e){if(e?.name==='AbortError')return}}
    await globalThis.copyTeamInvitation();
  };

  globalThis.revokeTeamInvitation=async function(id){
    const {client}=cloud();if(!client)return;
    const ok=await globalThis.appConfirm?.({title:'Einladung zurückziehen?',text:'Der Link kann danach nicht mehr verwendet werden.',confirmLabel:'Zurückziehen',icon:'✉️'});
    if(!ok)return;
    const {error}=await client.rpc('revoke_team_invitation',{invitation_id:id});
    if(error)return globalThis.toast?.('Konnte nicht zurückgezogen werden');
    globalThis.toast?.('Einladung zurückgezogen');
    await loadTeam();
  };

  globalThis.deleteTeamInvitation=async function(id){
    const {client,membership}=cloud();if(!client||membership?.role!=='owner')return;
    const ok=await globalThis.appConfirm?.({title:'Einladung endgültig löschen?',text:'Der alte Eintrag wird aus dem Einladungsverlauf entfernt. Das bestehende Mitarbeiterkonto bleibt unverändert.',confirmLabel:'Löschen',icon:'🗑️'});
    if(!ok)return;
    const {error}=await client.rpc('delete_team_invitation',{invitation_id:id});
    if(error){console.error(error);return globalThis.toast?.(String(error.message||'').includes('active invitation')?'Offene Einladung zuerst zurückziehen':'Einladung konnte nicht gelöscht werden')}
    globalThis.toast?.('Einladung gelöscht');
    await loadTeam();
  };

  globalThis.changeTeamRole=async function(userId,role){
    const {client}=cloud();if(!client)return;
    const {error}=await client.rpc('set_team_member_role',{member_user_id:userId,new_role:role});
    if(error){globalThis.toast?.('Rolle konnte nicht geändert werden');await loadTeam();return}
    globalThis.toast?.('Rolle geändert');await loadTeam();
  };

  globalThis.toggleTeamMember=async function(userId,status){
    const {client}=cloud();if(!client)return;
    const action=status==='disabled'?'deaktivieren':'aktivieren';
    const ok=await globalThis.appConfirm?.({title:`Zugang ${action}?`,text:status==='disabled'?'Die Person kann danach nicht mehr auf den Betrieb zugreifen.':'Der Zugang wird wieder freigeschaltet.',confirmLabel:status==='disabled'?'Deaktivieren':'Aktivieren',icon:'👥'});
    if(!ok)return;
    const {error}=await client.rpc('set_team_member_status',{member_user_id:userId,new_status:status});
    if(error)return globalThis.toast?.('Zugang konnte nicht geändert werden');
    globalThis.toast?.(status==='disabled'?'Zugang deaktiviert':'Zugang aktiviert');await loadTeam();
  };
})();
