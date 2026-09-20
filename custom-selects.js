(()=>{
  'use strict';

  const EXCLUDE='hiddenNativeSelect';
  let activeSelect=null;
  let observer=null;

  const esc=(value)=>String(value??'').replace(/[&<>'"]/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[ch]);

  function modal(){return document.getElementById('appSelectModal')}
  function list(){return document.getElementById('appSelectList')}
  function search(){return document.getElementById('appSelectSearch')}
  function title(){return document.getElementById('appSelectTitle')}

  function fieldLabel(select){
    const field=select.closest('.field');
    const label=field?.querySelector('label');
    if(label?.textContent)return label.textContent.trim();
    if(select.closest('.teamMemberControls'))return 'Rolle auswählen';
    return (select.getAttribute('aria-label')||select.name||'Auswahl').trim();
  }

  function selectedOption(select){
    return select.options?.[select.selectedIndex]||null;
  }

  function syncButton(select){
    if(!select || select.classList.contains(EXCLUDE))return;
    const btn=select.nextElementSibling?.classList?.contains('appSelectButton')
      ?select.nextElementSibling
      :document.querySelector(`.appSelectButton[data-select-for="${CSS.escape(select.id||'')}"]`);
    if(!btn)return;
    const opt=selectedOption(select);
    const valueText=(opt?.textContent||'Auswählen').trim();
    const empty=!select.value;
    const text=btn.querySelector('.appSelectValue');
    if(text){text.textContent=valueText;text.classList.toggle('placeholder',empty)}
    btn.disabled=!!select.disabled;
    btn.setAttribute('aria-disabled',select.disabled?'true':'false');
    btn.classList.toggle('disabled',!!select.disabled);
    btn.classList.toggle('hasValue',!empty);
  }

  function enhance(select){
    if(!(select instanceof HTMLSelectElement))return;
    if(select.classList.contains(EXCLUDE)||select.dataset.appSelectEnhanced==='1')return;
    if(!select.id)select.id='appSelect_'+Math.random().toString(36).slice(2,10);
    select.dataset.appSelectEnhanced='1';
    select.classList.add('appCustomNativeSelect');

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='appSelectButton';
    btn.dataset.selectFor=select.id;
    btn.setAttribute('aria-haspopup','listbox');
    btn.innerHTML='<span class="appSelectValue"></span><span class="appSelectChevron">⌄</span>';
    btn.addEventListener('click',()=>open(select));
    select.insertAdjacentElement('afterend',btn);

    select.addEventListener('change',()=>syncButton(select));
    select.addEventListener('input',()=>syncButton(select));
    syncButton(select);
  }

  function scan(root=document){
    if(root instanceof HTMLSelectElement)enhance(root);
    root.querySelectorAll?.(`select:not(.${EXCLUDE})`).forEach(enhance);
  }

  function render(){
    if(!activeSelect)return;
    const q=(search()?.value||'').trim().toLocaleLowerCase('de');
    const options=[...activeSelect.options].filter(o=>!o.hidden);
    const filtered=options.filter(o=>!q||(o.textContent||'').toLocaleLowerCase('de').includes(q));
    const target=list();
    if(!target)return;
    if(!filtered.length){
      target.innerHTML='<div class="empty">Keine passende Auswahl gefunden.</div>';
      return;
    }
    target.innerHTML=filtered.map((opt,index)=>{
      const originalIndex=options.indexOf(opt);
      const selected=opt.value===activeSelect.value;
      return `<button type="button" class="appSelectChoice ${selected?'active':''}" data-option-index="${originalIndex}" ${opt.disabled?'disabled':''} role="option" aria-selected="${selected?'true':'false'}"><span>${esc(opt.textContent.trim())}</span><strong>${selected?'✓':''}</strong></button>`;
    }).join('');
    target.querySelectorAll('.appSelectChoice:not(:disabled)').forEach(btn=>btn.addEventListener('click',()=>choose(Number(btn.dataset.optionIndex))));
  }

  function open(select){
    if(!select || select.disabled)return;
    activeSelect=select;
    const m=modal();
    if(!m)return;
    title().textContent=fieldLabel(select);
    const s=search();
    s.value='';
    const optionCount=[...select.options].filter(o=>!o.hidden).length;
    const searchWrap=document.getElementById('appSelectSearchWrap');
    if(searchWrap)searchWrap.classList.toggle('hidden',optionCount<7);
    m.classList.remove('hidden');
    document.body.classList.add('sheetOpen');
    render();
    if(optionCount>=7)setTimeout(()=>s.focus(),80);
  }

  function close(event){
    if(event && event.target!==modal())return;
    modal()?.classList.add('hidden');
    document.body.classList.remove('sheetOpen');
    activeSelect=null;
  }

  function choose(index){
    if(!activeSelect)return;
    const options=[...activeSelect.options].filter(o=>!o.hidden);
    const opt=options[index];
    if(!opt||opt.disabled)return;
    const changed=activeSelect.value!==opt.value;
    activeSelect.value=opt.value;
    syncButton(activeSelect);
    if(changed){
      activeSelect.dispatchEvent(new Event('input',{bubbles:true}));
      activeSelect.dispatchEvent(new Event('change',{bubbles:true}));
    }
    close();
  }

  function watch(){
    if(observer)observer.disconnect();
    observer=new MutationObserver(records=>{
      const dirty=new Set();
      records.forEach(record=>{
        if(record.type==='childList'){
          record.addedNodes.forEach(node=>{
            if(node.nodeType===1)scan(node);
          });
          const parent=record.target instanceof HTMLOptionElement?record.target.parentElement:record.target;
          if(parent instanceof HTMLSelectElement)dirty.add(parent);
        }
        if(record.type==='attributes'&&record.target instanceof HTMLSelectElement)dirty.add(record.target);
      });
      dirty.forEach(syncButton);
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
  }

  function init(){
    scan(document);
    watch();
    search()?.addEventListener('input',render);
    document.getElementById('appSelectClose')?.addEventListener('click',()=>close());
    modal()?.addEventListener('click',close);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeSelect)close()});
    // Some app renders update select values without dispatching change.
    setInterval(()=>document.querySelectorAll('select[data-app-select-enhanced="1"]').forEach(syncButton),1200);
  }

  globalThis.APCustomSelect={init,scan,sync:()=>document.querySelectorAll('select[data-app-select-enhanced="1"]').forEach(syncButton),openById:id=>open(document.getElementById(id))};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();


/* AngebotsPilot v11.31.29 – durable invoice finalization recovery.
   Deliberately isolated from the proven KoSIT/compliance runtime. */
(function installAPInvoiceRecovery113129(){
  'use strict';

  const RECOVERY_VERSION='11.31.29';
  const BUILD_VERSION=globalThis.AP_BUILD_VERSION||'11.31.31';
  const FLAG='__AP_INVOICE_RECOVERY_11_31_29__';
  if(globalThis[FLAG])return;
  globalThis[FLAG]=true;

  const companyRoleCanFinalize=membership=>['owner','office'].includes(String(membership?.role||''));
  let attachedCloud=null;

  function stampRelease(){
    document.querySelectorAll('[data-app-build]').forEach(el=>{
      if(el.textContent!==BUILD_VERSION)el.textContent=BUILD_VERSION;
    });
  }

  function cloudContext(){
    try{return globalThis.APCloudContext?.()||null}catch(e){return null}
  }

  function finalizationPayload(inv,ctx){
    if(!ctx?.company?.id||!inv?.id||!inv?.number||!inv?.finalizedAt||!inv?.finalizedSnapshot)return null;
    return{
      p_company_id:ctx.company.id,
      p_local_id:String(inv.id),
      p_number:String(inv.number||'').trim(),
      p_finalized_at:inv.finalizedAt,
      p_status:inv.status==='paid'?'paid':'open',
      p_finalized_snapshot:inv.finalizedSnapshot,
      p_structured_storage_path:inv.structuredStoragePath||'',
      p_structured_sha256:inv.structuredSha256||'',
      p_compliance_status:inv.complianceStatus||null,
      p_compliance_report:inv.complianceReport||null,
      p_compliance_checked_at:inv.complianceCheckedAt||null
    };
  }

  async function prepareFinalization(inv,clientOverride=null,companyOverride=null){
    const ctx=cloudContext();
    const client=clientOverride||ctx?.client;
    const company=companyOverride||ctx?.company;
    if(!client||!company?.id)return null;

    const payload=finalizationPayload(inv,{company});
    if(!payload)return null;

    const {data,error}=await client.rpc('prepare_invoice_finalization',payload);
    if(error)throw error;
    if(!data?.ok)throw new Error('Die Cloud konnte die Ausstellung nicht sicher vorbereiten.');
    return data;
  }

  function newlyFinalized(before){
    return (globalThis.data?.invoices||[]).filter(inv=>{
      if(!inv?.id||!inv?.finalizedAt)return false;
      return !before.has(String(inv.id));
    });
  }

  function wrapLocalFinalizer(name){
    const original=globalThis[name];
    if(typeof original!=='function'||original.__apRecovery113129)return;

    const wrapped=async function(){
      const before=new Set(
        (globalThis.data?.invoices||[])
          .filter(inv=>inv?.finalizedAt)
          .map(inv=>String(inv.id))
      );

      const result=await original.apply(this,arguments);

      for(const inv of newlyFinalized(before)){
        try{
          await prepareFinalization(inv);
        }catch(error){
          // Do not suppress the existing v11.31.28 commit fallback. Mark the
          // invoice pending and let the outer atomic guard retry immediately.
          inv.finalizationCloudPending=true;
          try{globalThis.persistAppState?.()}catch(e){}
          console.warn('Serverseitige Finalisierungs-Vorbereitung wird beim Commit erneut versucht',error);
        }
      }
      return result;
    };

    wrapped.__apRecovery113129=true;
    wrapped.__apOriginal=original;
    globalThis[name]=wrapped;
  }

  function installRpcPrepareGuard(client){
    if(!client||client.__apInvoicePrepare113129)return;
    const originalRpc=client.rpc?.bind(client);
    if(typeof originalRpc!=='function')return;

    client.rpc=async function(fn,args,options){
      if(fn==='commit_invoice_finalization'){
        const {data:prepared,error:prepareError}=await originalRpc('prepare_invoice_finalization',args,options);
        if(prepareError)return{data:null,error:prepareError};
        if(!prepared?.ok)return{
          data:null,
          error:new Error('Die Cloud konnte die Ausstellung nicht sicher vorbereiten.')
        };
      }
      return originalRpc(fn,args,options);
    };

    try{
      Object.defineProperty(client,'__apInvoicePrepare113129',{
        value:true,configurable:false,enumerable:false,writable:false
      });
    }catch(e){client.__apInvoicePrepare113129=true}
  }

  async function recoverPrepared(client,company,membership){
    if(!client||!company?.id||!companyRoleCanFinalize(membership))return{ok:true,recovered:0,results:[]};

    const {data,error}=await client.rpc('recover_prepared_invoice_finalizations',{
      p_company_id:company.id
    });
    if(error)throw error;

    const failed=(data?.results||[]).filter(row=>row?.ok===false);
    if(failed.length){
      const numbers=failed.map(row=>row?.number).filter(Boolean).join(', ');
      throw new Error(
        'Eine vorbereitete Rechnung konnte nicht sicher wiederhergestellt werden'+
        (numbers?`: ${numbers}`:'.')
      );
    }

    if(Number(data?.recovered||0)>0){
      console.info('AngebotsPilot: vorbereitete Rechnungsfinalisierungen wiederhergestellt',data.recovered);
    }
    return data||{ok:true,recovered:0,results:[]};
  }

  function wrapCloudAttach(){
    const sync=globalThis.CloudSync;
    if(!sync||typeof sync.attach!=='function'||sync.attach.__apRecovery113129)return false;

    const originalAttach=sync.attach.bind(sync);
    const wrapped=async function(client,session,company,membership){
      attachedCloud={client,session,company,membership};
      installRpcPrepareGuard(client);

      // Critical ordering: durable server recovery MUST complete before the
      // existing initialSync can perform its normal Cloud pull.
      await recoverPrepared(client,company,membership);

      return originalAttach(client,session,company,membership);
    };

    wrapped.__apRecovery113129=true;
    wrapped.__apOriginal=originalAttach;
    sync.attach=wrapped;
    sync.version=BUILD_VERSION;
    return true;
  }

  function wrapManualSync(){
    const sync=globalThis.CloudSync;

    if(sync&&typeof sync.manual==='function'&&!sync.manual.__apRecovery113129){
      const originalManual=sync.manual.bind(sync);
      const wrappedManual=async function(){
        if(attachedCloud){
          await recoverPrepared(attachedCloud.client,attachedCloud.company,attachedCloud.membership);
        }
        return originalManual.apply(this,arguments);
      };
      wrappedManual.__apRecovery113129=true;
      sync.manual=wrappedManual;
    }

    const globalManual=globalThis.manualCloudSync;
    if(typeof globalManual==='function'&&!globalManual.__apRecovery113129){
      const wrappedGlobalManual=async function(){
        try{
          if(attachedCloud){
            await recoverPrepared(attachedCloud.client,attachedCloud.company,attachedCloud.membership);
          }
        }catch(error){
          console.error('Cloud-Sync vor Pull gestoppt: vorbereitete Rechnungsfinalisierung offen',error);
          globalThis.toast?.('Cloud-Sync gestoppt · vorbereitete Rechnung zuerst sicher abschließen');
          return false;
        }
        return globalManual.apply(this,arguments);
      };
      wrappedGlobalManual.__apRecovery113129=true;
      globalThis.manualCloudSync=wrappedGlobalManual;
    }
  }

  function install(){
    // This file is loaded after script.js/cloud-sync.js but before cloud-auth.js.
    // Wrapping now means the existing v11.31.28 numbering guard will later wrap
    // these functions from the outside, preserving its proven behavior.
    wrapLocalFinalizer('saveInvoice');
    wrapLocalFinalizer('finalizeInvoiceById');
    wrapCloudAttach();
    wrapManualSync();
    stampRelease();

    // Visible build version comes from the central cloud-config source.
    [250,900,2200].forEach(ms=>setTimeout(stampRelease,ms));
  }

  install();
  globalThis.APInvoiceRecovery113129=Object.freeze({
    version:RECOVERY_VERSION,
    buildVersion:BUILD_VERSION,
    prepareFinalization,
    recoverPrepared,
    installRpcPrepareGuard
  });
})();
