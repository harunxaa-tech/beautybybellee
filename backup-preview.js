/* Read-only local recovery preview. This is not a server backup or restore engine. */
(function(){
  'use strict';
  const FORMAT='angebotspilot-local-snapshot';
  const COLLECTIONS=['customers','offers','events','tasks','jobs','invoices','catalog'];
  const MAX_BYTES=20*1024*1024;
  function object(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)}
  function identity(data,context){
    const companyId=context?.company?.id,userId=context?.session?.user?.id;
    if(!companyId||!userId||context?.membership?.role!=='owner'||data?.meta?.cloudCompanyId!==companyId||data?.meta?.authUserId!==userId)
      throw new Error('Nur der angemeldete Betriebsinhaber darf diesen Arbeitsbereich sichern oder prüfen.');
    return {companyId,userId};
  }
  function counts(data){
    if(!object(data))throw new Error('Ungültige Arbeitsdaten.');
    const result={};
    for(const key of COLLECTIONS){
      const list=data[key];
      if(!Array.isArray(list))throw new Error('Fehlende oder ungültige Sammlung: '+key);
      const ids=new Set();
      for(const item of list){
        if(!object(item)||typeof item.id!=='string'||!item.id.trim()||ids.has(item.id))
          throw new Error('Ungültige oder doppelte Datensatz-ID in '+key);
        ids.add(item.id);
      }
      result[key]=list.length;
    }
    return result;
  }
  function makeSnapshot(data,context){
    const scope=identity(data,context);
    counts(data);
    const records=Object.fromEntries(COLLECTIONS.map(k=>[k,structuredClone(data[k])]));
    // Deliberately exclude settings, auth, audit, users and privacy state.
    // Business records still contain confidential personal and business information.
    return {format:FORMAT,version:1,scope,createdAt:new Date().toISOString(),complete:false,records};
  }
  function inspect(raw,data,context){
    const scope=identity(data,context);
    if(!object(raw))throw new Error('Ungültige Sicherungsdatei.');
    let records,source;
    if(raw.format===FORMAT){
      if(raw.version!==1||raw.complete!==false)throw new Error('Nicht unterstützte Sicherungsversion.');
      source=raw.scope;records=raw.records;
    }else{
      if(raw.format||!object(raw.meta))throw new Error('Nicht unterstütztes Sicherungsformat.');
      source={companyId:raw.meta.cloudCompanyId,userId:raw.meta.authUserId};records=raw;
    }
    if(source?.companyId!==scope.companyId||source?.userId!==scope.userId)
      throw new Error('Diese Sicherung gehört nicht zum aktiven Betrieb und Benutzer.');
    const found=counts(records),current=counts(data);
    return {found,current,restoreAllowed:false};
  }
  globalThis.APBackupPreview={FORMAT,MAX_BYTES,identity,makeSnapshot,inspect};
})();