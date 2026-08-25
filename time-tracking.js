/* AngebotsPilot v11.4 – serverseitige Baustellen-Zeiterfassung */
(function(){
  'use strict';

  const q=id=>document.getElementById(id);
  const cloud=()=>globalThis.getCloudState?.()||{};
  let localJobId='';
  let cloudJobId='';
  let entries=[];
  let members=new Map();
  let ownOpenEntry=null;
  let ticker=null;
  let loading=false;

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

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

  function hms(sec){
    sec=Math.max(0,Math.floor(sec||0));
    const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function hoursLabel(sec){
    const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);
    return `${h}:${String(m).padStart(2,'0')} Std.`;
  }

  function currentJob(){
    return (globalThis.data?.jobs||[]).find(j=>j.id===localJobId)||null;
  }

  function setVisible(show){
    const card=q('jobTimeCard');if(!card)return;
    card.hidden=!show;
    card.classList.toggle('hidden',!show);
  }

  async function resolveJob(){
    if(!localJobId)return '';
    return globalThis.JobAssignments?.resolveCloudJobId?.(localJobId)||'';
  }

  async function loadMembers(){
    const {client,company,membership}=cloud();
    members=new Map();
    if(!client||!company||!membership)return;
    if(['owner','office'].includes(membership.role)){
      const {data,error}=await client.from('company_members')
        .select('user_id,display_name,email,role,status')
        .eq('company_id',company.id)
        .eq('status','active');
      if(error)throw error;
      (data||[]).forEach(x=>members.set(x.user_id,x.display_name||x.email||'Teammitglied'));
    }else if(membership.role==='worker'){
      members.set(cloud().session?.user?.id,cloud().session?.user?.user_metadata?.full_name||cloud().session?.user?.email||'Ich');
    }
  }

  async function load(){
    if(loading||!localJobId)return;
    const {client,session,membership}=cloud();
    if(!client||!session||!membership){setVisible(false);return}
    loading=true;
    try{
      cloudJobId=await resolveJob();
      if(!cloudJobId){setVisible(false);return}
      setVisible(true);
      await loadMembers();

      const {data,error}=await client.from('time_entries')
        .select('id,company_id,job_id,user_id,started_at,pause_started_at,break_seconds,ended_at,note,created_at,updated_at')
        .eq('job_id',cloudJobId)
        .order('started_at',{ascending:false});
      if(error)throw error;
      entries=data||[];

      ownOpenEntry=null;
      if(membership.role==='worker'){
        const {data:open,error:openErr}=await client.from('time_entries')
          .select('id,company_id,job_id,user_id,started_at,pause_started_at,break_seconds,ended_at,note,created_at,updated_at')
          .eq('user_id',session.user.id)
          .is('ended_at',null)
          .maybeSingle();
        if(openErr)throw openErr;
        ownOpenEntry=open||null;
      }
      render();
    }catch(e){
      console.error('TimeTracking load',e);
      const box=q('jobTimeSummary');
      if(box)box.innerHTML='<div class="empty">Zeiterfassung konnte nicht geladen werden.</div>';
    }finally{
      loading=false;
    }
  }

  function renderWorkerClock(){
    const {membership}=cloud();
    if(membership?.role!=='worker')return;
    const display=q('jobClockDisplay'),state=q('jobClockState'),other=q('jobClockOtherJob');
    const start=q('jobClockStart'),pause=q('jobClockPause'),resume=q('jobClockResume'),stop=q('jobClockStop');

    const same=ownOpenEntry&&ownOpenEntry.job_id===cloudJobId;
    const otherRunning=ownOpenEntry&&ownOpenEntry.job_id!==cloudJobId;
    const paused=same&&!!ownOpenEntry.pause_started_at;

    [start,pause,resume,stop].forEach(b=>{if(b){b.hidden=true;b.classList.add('hidden')}});
    if(other){other.hidden=true;other.classList.add('hidden')}

    if(otherRunning){
      if(display)display.textContent='--:--:--';
      if(state)state.textContent='Timer läuft auf einer anderen Baustelle';
      if(other){
        other.textContent='Beende zuerst die laufende Zeit auf der anderen Baustelle.';
        other.hidden=false;other.classList.remove('hidden');
      }
      return;
    }

    if(!same){
      if(display)display.textContent='00:00:00';
      if(state)state.textContent='Bereit zum Start';
      if(start){start.hidden=false;start.classList.remove('hidden')}
      return;
    }

    if(display)display.textContent=hms(seconds(ownOpenEntry));
    if(state)state.textContent=paused?'Pause läuft':'Arbeitszeit läuft';
    if(paused){
      if(resume){resume.hidden=false;resume.classList.remove('hidden')}
    }else{
      if(pause){pause.hidden=false;pause.classList.remove('hidden')}
    }
    if(stop){stop.hidden=false;stop.classList.remove('hidden')}
  }

  function renderSummary(){
    const box=q('jobTimeSummary');if(!box)return;
    const {membership,session}=cloud();
    const now=Date.now();
    const total=entries.reduce((sum,e)=>sum+seconds(e,now),0);
    if(q('jobTimeTotal'))q('jobTimeTotal').textContent=hoursLabel(total);

    if(!entries.length){
      box.innerHTML='<div class="empty compactEmpty">Noch keine Arbeitszeit erfasst.</div>';
      return;
    }

    if(membership?.role==='worker'){
      box.innerHTML=entries.slice(0,8).map(e=>{
        const running=!e.ended_at;
        const paused=running&&e.pause_started_at;
        const date=new Date(e.started_at).toLocaleDateString('de-DE');
        const start=new Date(e.started_at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
        const end=e.ended_at?new Date(e.ended_at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):(paused?'Pause':'läuft');
        return `<div class="timeRow"><div><b>${esc(date)}</b><small>${esc(start)} – ${esc(end)}</small></div><strong>${esc(hoursLabel(seconds(e,now)))}</strong></div>`;
      }).join('');
      return;
    }

    const grouped=new Map();
    entries.forEach(e=>{
      const g=grouped.get(e.user_id)||{seconds:0,running:false};
      g.seconds+=seconds(e,now);g.running=g.running||!e.ended_at;
      grouped.set(e.user_id,g);
    });
    box.innerHTML=[...grouped.entries()].map(([userId,g])=>
      `<div class="timeRow"><div><b>${esc(members.get(userId)||'Teammitglied')}</b><small>${g.running?'● Timer läuft':'Gesamt auf dieser Baustelle'}</small></div><strong>${esc(hoursLabel(g.seconds))}</strong></div>`
    ).join('');
  }

  function render(){
    renderWorkerClock();
    renderSummary();
    if(ticker)clearInterval(ticker);
    ticker=setInterval(()=>{
      if(!document.getElementById('jobEditor')?.classList.contains('active'))return;
      renderWorkerClock();
      renderSummary();
    },1000);
  }

  async function action(action){
    if(!cloudJobId)return globalThis.toast?.('Baustelle noch nicht synchronisiert');
    const {client}=cloud();if(!client)return;
    const buttons=document.querySelectorAll('#jobTimeCard button');
    buttons.forEach(b=>b.disabled=true);
    try{
      const {data,error}=await client.rpc('time_clock_action',{target_job:cloudJobId,clock_action:action});
      if(error)throw error;
      globalThis.toast?.(
        action==='start'?'▶ Arbeitszeit gestartet':
        action==='pause'?'⏸ Pause gestartet':
        action==='resume'?'▶ Weiter geht’s':
        '✓ Arbeitszeit gespeichert'
      );
      await load();
    }catch(e){
      console.error(e);
      const msg=String(e.message||e);
      globalThis.toast?.(msg.includes('another timer')?'Auf einer anderen Baustelle läuft bereits ein Timer.':'Zeiterfassung konnte nicht gespeichert werden');
    }finally{
      buttons.forEach(b=>b.disabled=false);
    }
  }

  async function open(jobId){
    localJobId=jobId||'';
    cloudJobId='';
    entries=[];ownOpenEntry=null;
    if(ticker){clearInterval(ticker);ticker=null}
    if(!localJobId){setVisible(false);return}
    setVisible(true);
    if(q('jobTimeSummary'))q('jobTimeSummary').innerHTML='<div class="empty">Zeiten werden geladen …</div>';
    await load();
  }

  async function refresh(){
    if(!localJobId)return;
    await load();
    globalThis.toast?.('Zeiten aktualisiert');
  }

  globalThis.TimeTracking={open,refresh,action};
})();