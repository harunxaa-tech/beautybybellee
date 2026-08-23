/* AngebotsPilot v11.3 – Baustellenzuweisung */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  let workers=[];
  let selected=new Set();
  let fallbackNames=[];

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const cloud=()=>globalThis.getCloudState?.()||{};

  function initials(name,email){
    const source=(name||email||'?').trim();
    return source.split(/\s+/).map(x=>x[0]||'').join('').slice(0,2).toUpperCase()||'?';
  }

  async function loadWorkers(){
    const {client,company,membership}=cloud();
    if(!client||!company||!membership||!['owner','office'].includes(membership.role)){
      workers=[];render();return;
    }
    const {data,error}=await client.from('company_members')
      .select('user_id,display_name,email,role,status')
      .eq('company_id',company.id)
      .eq('role','worker')
      .eq('status','active')
      .order('display_name',{ascending:true});
    if(error)throw error;
    workers=data||[];
    render();
  }

  function render(){
    const box=q('jobAssignmentPicker'),count=q('jobAssignmentCount');
    if(count)count.textContent=`${selected.size} zugewiesen`;
    if(!box)return;

    if(!workers.length){
      box.innerHTML='<div class="assignmentEmpty"><span>👷</span><div><b>Noch keine aktiven Mitarbeiter</b><small>Lade unter Mehr → Team zuerst einen Mitarbeiter ein.</small></div><button class="btn small" type="button" onclick="openTeam()">Team öffnen</button></div>';
      return;
    }

    box.innerHTML=workers.map(w=>{
      const checked=selected.has(w.user_id);
      return `<button type="button" class="assigneeOption ${checked?'selected':''}" onclick="JobAssignments.toggle('${w.user_id}')">
        <span class="assigneeAvatar">${esc(initials(w.display_name,w.email))}</span>
        <span class="assigneeText"><b>${esc(w.display_name||w.email||'Mitarbeiter')}</b><small>${esc(w.email||'')}</small></span>
        <span class="assigneeCheck">${checked?'✓':'＋'}</span>
      </button>`;
    }).join('');
  }

  function namesFor(ids){
    const map=new Map(workers.map(w=>[w.user_id,w.display_name||w.email||'Mitarbeiter']));
    return ids.map(id=>map.get(id)).filter(Boolean);
  }

  async function open(ids=[],names=[]){
    selected=new Set(Array.isArray(ids)?ids:[]);
    fallbackNames=Array.isArray(names)?names:[];
    render();
    try{await loadWorkers()}catch(e){
      console.error(e);
      const box=q('jobAssignmentPicker');
      if(box)box.innerHTML='<div class="empty">Mitarbeiter konnten nicht geladen werden.</div>';
    }
  }

  function toggle(id){
    if(selected.has(id))selected.delete(id);else selected.add(id);
    render();
  }

  function selection(){
    const ids=[...selected];
    const names=namesFor(ids);
    return{ids,names:names.length?names:fallbackNames.slice(0,ids.length)};
  }

  function chips(ids=[],names=[]){
    if(!ids.length)return '<div class="jobAssigneeChips"><span class="jobUnassigned">Noch niemand zugewiesen</span></div>';
    const workerMap=new Map(workers.map(w=>[w.user_id,w.display_name||w.email||'Mitarbeiter']));
    const labels=ids.map((id,i)=>workerMap.get(id)||names[i]||'Mitarbeiter');
    return `<div class="jobAssigneeChips">${labels.map(n=>`<span>👷 ${esc(n)}</span>`).join('')}</div>`;
  }

  async function refresh(){
    try{await loadWorkers();globalThis.toast?.('Team aktualisiert')}catch(e){globalThis.toast?.('Team konnte nicht geladen werden')}
  }

  async function refreshMyJobs(){
    const {membership}=cloud();
    if(membership?.role!=='worker')return;
    try{
      globalThis.toast?.('Baustellen werden aktualisiert …');
      await globalThis.CloudSync?.pullCloud?.();
      globalThis.renderJobs?.();
      globalThis.toast?.('✓ Meine Baustellen sind aktuell');
    }catch(e){
      console.error(e);
      globalThis.toast?.('Aktualisierung fehlgeschlagen');
    }
  }

  globalThis.refreshMyJobs=refreshMyJobs;
  globalThis.JobAssignments={open,toggle,selection,chips,refresh};
})();