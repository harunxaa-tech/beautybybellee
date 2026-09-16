/* AngebotsPilot v11.30.6 – öffentliche Supabase-Konfiguration + zentraler Runtime-Loader
   Der Publishable Key ist ausdrücklich für Browser-Apps gedacht.
   Keine geheimen Service-Role-Keys gehören jemals in diese Datei. */
globalThis.AP_CLOUD_CONFIG = Object.freeze({
  url: "https://haqztfpixbjqfiollazv.supabase.co",
  publishableKey: "sb_publishable_gpyLnT-j8lcLiIirHAqGUA_zvM7CuNa",
  projectRef: "haqztfpixbjqfiollazv",
  region: "eu-central-1",
  appUrl: "https://harunxaa-tech.github.io/beautybybellee/"
});

(function installAngebotsPilotRuntime(){
  'use strict';

  const VERSION='11.30.6';
  const DATA_SAFETY_SRC=`./data-safety.js?v=${VERSION}`;
  const BOOT_KEY='__ANGEBOTSPILOT_RUNTIME_11_30_6__';

  function stampBuild(){
    document.querySelectorAll('[data-app-build]').forEach(el=>{
      if(el.textContent!==VERSION)el.textContent=VERSION;
    });
  }

  if(globalThis[BOOT_KEY]){
    stampBuild();
    globalThis.DataSafety?.refreshCard?.();
    return;
  }
  globalThis[BOOT_KEY]=true;

  globalThis.AP_BUILD_VERSION=VERSION;
  globalThis.APBuild=Object.freeze({
    version:VERSION,
    cacheTag:'angebotspilot-v11-30-6-r3',
    stamp:stampBuild
  });

  let wrappersInstalled=false;
  let settingsObserver=null;
  let refreshTimer=null;

  function dataSafetyCardIsCurrent(){
    const card=document.getElementById('dataSafetyCard');
    if(!card)return false;
    return card.querySelector('h3')?.textContent?.trim()==='Datensicherung & Archiv' && !!card.querySelector('.dsGrid');
  }

  function scheduleDataSafetyRefresh(force=false){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{
      const refresh=globalThis.DataSafety?.refreshCard;
      if(typeof refresh!=='function')return;
      if(force||!dataSafetyCardIsCurrent()){
        Promise.resolve(refresh()).catch(err=>console.warn('Datensicherung konnte nicht aktualisiert werden',err));
      }
    },50);
  }

  function claimCentralBuildVersion(){
    // script.js v11.30.1 enthält noch eine alte interne Stamp-Funktion.
    // Für die laufende App wird die zentrale Runtime-Quelle verbindlich verwendet.
    if(typeof globalThis.syncVisibleBuildVersion==='function'){
      globalThis.syncVisibleBuildVersion=stampBuild;
    }
  }

  function installWrappers(){
    claimCentralBuildVersion();
    if(wrappersInstalled)return;
    const render=globalThis.renderAll;
    const show=globalThis.showScreen;
    if(typeof render!=='function'||typeof show!=='function')return;

    if(!render.__apCentralRuntime){
      const wrappedRender=function(){
        const result=render.apply(this,arguments);
        stampBuild();
        scheduleDataSafetyRefresh();
        return result;
      };
      wrappedRender.__apCentralRuntime=true;
      globalThis.renderAll=wrappedRender;
    }

    if(!show.__apCentralRuntime){
      const wrappedShow=function(){
        const result=show.apply(this,arguments);
        stampBuild();
        if(arguments[0]==='settings')scheduleDataSafetyRefresh(true);
        return result;
      };
      wrappedShow.__apCentralRuntime=true;
      globalThis.showScreen=wrappedShow;
    }
    wrappersInstalled=true;
  }

  function installSettingsObserver(){
    if(settingsObserver)return;
    const settings=document.getElementById('settings');
    if(!settings)return;
    settingsObserver=new MutationObserver(()=>{
      const legacy=[...settings.querySelectorAll('h3')].some(h=>h.textContent.trim()==='Datensicherung');
      if(legacy||!dataSafetyCardIsCurrent())scheduleDataSafetyRefresh();
    });
    settingsObserver.observe(settings,{childList:true,subtree:true});
  }

  function installRestoreSafetyGuard(){
    const ds=globalThis.DataSafety;
    if(!ds||ds.__apRestoreSafetyGuard)return;
    ds.__apRestoreSafetyGuard=true;

    // v11.30.6-Sicherheitsgurt: Die bestehende Merge-Funktion lässt bei gleicher ID
    // derzeit den Backup-Datensatz gewinnen. Vorschau bleibt erlaubt, echtes Anwenden
    // wird bis zum konfliktbewussten Merge-Fix bewusst blockiert.
    const originalChoose=ds.chooseBackup?.bind(ds);
    if(originalChoose){
      ds.chooseBackup=async function(event){
        const result=await originalChoose(event);
        setTimeout(()=>{
          const body=document.getElementById('dataSafetyRestoreBody');
          if(!body)return;
          if(!body.querySelector('.apRestoreConflictGuard')){
            const warning=document.createElement('div');
            warning.className='dsWarn apRestoreConflictGuard';
            warning.innerHTML='<b>🛡️ Sicherheitsprüfung aktiv</b><br>Die Vorschau ist freigegeben. Das tatsächliche Zusammenführen bleibt in v11.30.6 gesperrt, bis Konflikte zwischen neueren aktuellen Daten und älteren Backup-Daten eindeutig gelöst werden.';
            body.querySelector('.dsSheetActions')?.before(warning);
          }
          const apply=[...body.querySelectorAll('button')].find(b=>/Backup zusammenführen/.test(b.textContent||''));
          if(apply){apply.disabled=true;apply.textContent='Merge-Schutz aktiv';}
        },0);
        return result;
      };
    }

    ds.applyRestore=async function(){
      const message='Restore-Vorschau ist sicher verfügbar. Das tatsächliche Zusammenführen ist in v11.30.6 vorsorglich gesperrt, bis Konflikte mit neueren aktuellen Datensätzen sauber aufgelöst werden.';
      if(globalThis.toast)return globalThis.toast(message,'warning');
      if(globalThis.showToast)return globalThis.showToast(message,'warning');
      console.warn(message);
    };
  }

  function ensureDataSafetyLoaded(){
    if(globalThis.DataSafety?.refreshCard){
      installRestoreSafetyGuard();
      installSettingsObserver();
      scheduleDataSafetyRefresh(true);
      return;
    }

    const existing=[...document.scripts].find(s=>/data-safety\.js(?:\?|$)/.test(s.src||''));
    if(existing){
      existing.addEventListener('load',()=>{
        installSettingsObserver();
        scheduleDataSafetyRefresh(true);
      },{once:true});
      return;
    }

    // Direkt aus dem Hauptdokument-Bootstrap laden; nicht mehr vom Service Worker abhängig.
    const script=document.createElement('script');
    script.src=DATA_SAFETY_SRC;
    script.defer=true;
    script.dataset.apRuntimeLoader='cloud-config';
    script.onload=()=>{
      installRestoreSafetyGuard();
      installSettingsObserver();
      scheduleDataSafetyRefresh(true);
    };
    script.onerror=()=>console.error('AngebotsPilot Datensicherung konnte nicht geladen werden.');
    document.head.appendChild(script);
  }

  function installRefreshHooks(){
    const refresh=()=>scheduleDataSafetyRefresh(true);
    window.addEventListener('angebotspilot:syncstate',refresh);
    window.addEventListener('focus',refresh);
    window.addEventListener('pageshow',refresh);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
  }

  function forceServiceWorkerCheck(){
    if(!('serviceWorker' in navigator))return;
    navigator.serviceWorker.getRegistration().then(reg=>reg?.update?.()).catch(()=>{});
  }

  function boot(){
    stampBuild();
    installWrappers();
    installSettingsObserver();
    ensureDataSafetyLoaded();
    installRefreshHooks();
    forceServiceWorkerCheck();

    // Späte App-/Cloud-Initialisierung abfangen, ohne dauerhaft renderAll zu pollen.
    [0,250,800,1800].forEach(ms=>setTimeout(()=>{
      installWrappers();
      stampBuild();
      ensureDataSafetyLoaded();
      scheduleDataSafetyRefresh(true);
    },ms));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
