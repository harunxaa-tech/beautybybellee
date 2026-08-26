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
