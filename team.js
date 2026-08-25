/* AngebotsPilot v11.3 – Team & sichere Einladungslinks */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  let inviteRole='worker';
  let currentInviteLink='';
  let currentMembers=[];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const roleLabel=r=>r==='owner'?'Chef / Inhaber':r==='office'?'Büro':'Mitarbeiter';
  const statusLabel=s=>s==='disabled'?'Deaktiviert':'Aktiv';

  function cloud(){
    return globalThis.getCloudState?.()||{};
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
      ?'Du verwaltest Einladungen, Rollen und Zugänge.'
      :'Du kannst das Betriebsteam sehen. Änderungen macht der Chef.';

    try{
      const {data:members,error}=await client.from('company_members')
        .select('user_id,role,status,created_at,display_name,email')
        .eq('company_id',company.id)
        .order('created_at',{ascending:true});
      if(error)throw error;
      currentMembers=(members||[]).map(m=>({...m,name:m.display_name||''}));
      renderMembers(membership.role);

      if(membership.role==='owner'){
        const {data:invites,error:ie}=await client.from('team_invitations')
          .select('id,email,invitee_name,role,expires_at,used_at,revoked_at,created_at')
          .eq('company_id',company.id)
          .order('created_at',{ascending:false});
        if(ie)throw ie;
        renderInvitations(invites||[]);
      }else{
        q('teamInviteCount').textContent='–';
      }
    }catch(e){
      console.error(e);
      q('teamMemberList').innerHTML=`<div class="empty">Team konnte nicht geladen werden: ${esc(e.message||e)}</div>`;
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

  function renderInvitations(invites){
    const now=Date.now();
    const active=invites.filter(i=>!i.used_at&&!i.revoked_at&&new Date(i.expires_at).getTime()>now);
    q('teamInviteCount').textContent=String(active.length);
    q('teamInviteList').innerHTML=invites.length?invites.map(i=>{
      const expired=!i.used_at&&!i.revoked_at&&new Date(i.expires_at).getTime()<=now;
      const status=i.used_at?'Angenommen':i.revoked_at?'Zurückgezogen':expired?'Abgelaufen':'Offen';
      const canRevoke=status==='Offen';
      return `<div class="card teamInviteRow">
        <div class="itemTop"><div><b>${esc(i.invitee_name||i.email||'Einladung')}</b><div class="mini">${esc(roleLabel(i.role))}${i.email?` · ${esc(i.email)}`:' · E-Mail legt Mitarbeiter fest'}</div></div><span class="inviteStatus ${status.toLowerCase()}">${esc(status)}</span></div>
        <div class="mini">Gültig bis ${new Date(i.expires_at).toLocaleString('de-DE')}</div>
        ${canRevoke?`<button class="btn small danger" onclick="revokeTeamInvitation('${i.id}')">Einladung zurückziehen</button>`:''}
      </div>`;
    }).join(''):'<div class="empty">Noch keine Einladungen.</div>';
  }

  globalThis.createTeamInvitation=async function(){
    const {client,membership}=cloud();
    if(!client||membership?.role!=='owner')return globalThis.toast?.('Nur der Chef kann einladen');
    const name=q('teamInviteName')?.value.trim()||'';
    if(!name)return globalThis.toast?.('Bitte einen Namen eingeben');

    try{
      const {data,error}=await client.rpc('create_team_invitation_simple',{
        invite_role:inviteRole,
        invitee_name:name
      });
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
    }catch(e){
      console.error(e);
      globalThis.toast?.(e.message||'Einladung fehlgeschlagen');
    }
  };

  globalThis.copyTeamInvitation=async function(){
    if(!currentInviteLink)return;
    try{
      await navigator.clipboard.writeText(currentInviteLink);
      globalThis.toast?.('Link kopiert');
    }catch(e){
      prompt('Einladungslink kopieren:',currentInviteLink);
    }
  };

  globalThis.shareTeamInvitation=async function(){
    if(!currentInviteLink)return;
    const text=`Du wurdest zu AngebotsPilot eingeladen. Öffne den Link, trage deine eigene E-Mail ein und lege dein persönliches Passwort fest:`;
    if(navigator.share){
      try{await navigator.share({title:'AngebotsPilot Einladung',text,url:currentInviteLink});return}catch(e){if(e?.name==='AbortError')return}
    }
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

  globalThis.changeTeamRole=async function(userId,role){
    const {client}=cloud();if(!client)return;
    const {error}=await client.rpc('set_team_member_role',{member_user_id:userId,new_role:role});
    if(error){globalThis.toast?.('Rolle konnte nicht geändert werden');await loadTeam();return}
    globalThis.toast?.('Rolle geändert');
    await loadTeam();
  };

  globalThis.toggleTeamMember=async function(userId,status){
    const {client}=cloud();if(!client)return;
    const action=status==='disabled'?'deaktivieren':'aktivieren';
    const ok=await globalThis.appConfirm?.({title:`Zugang ${action}?`,text:status==='disabled'?'Die Person kann danach nicht mehr auf den Betrieb zugreifen.':'Der Zugang wird wieder freigeschaltet.',confirmLabel:status==='disabled'?'Deaktivieren':'Aktivieren',icon:'👥'});
    if(!ok)return;
    const {error}=await client.rpc('set_team_member_status',{member_user_id:userId,new_status:status});
    if(error)return globalThis.toast?.('Zugang konnte nicht geändert werden');
    globalThis.toast?.(status==='disabled'?'Zugang deaktiviert':'Zugang aktiviert');
    await loadTeam();
  };
})();