/* AngebotsPilot v11.3 – zentrale Datenspeicher-Schicht
   Heute: lokaler Browser-Speicher.
   Später: derselbe App-Code kann zusätzlich mit einem Cloud-Adapter synchronisieren. */
(function(){
  'use strict';
  const DEFAULT_KEY='digitaler_handwerker_v3';
  const SCHEMA_VERSION=9;
  const ENTITY_COLLECTIONS=['customers','offers','events','tasks','jobs','invoices','catalog'];
  let cloudAdapter=null;
  let lastSyncError='';

  function makeId(){
    if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
    return 'id_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
  }
  function now(){return new Date().toISOString()}
  function safeParse(raw,fallback={}){try{return JSON.parse(raw)}catch(e){return fallback}}
  function getDeviceId(){
    const key='angebotspilot_device_id';
    try{
      let id=localStorage.getItem(key);
      if(!id){id=makeId();try{localStorage.setItem(key,id)}catch(e){}}
      return id||makeId();
    }catch(e){return makeId()}
  }
  function comparable(entity){
    if(!entity||typeof entity!=='object')return entity;
    const copy=structuredClone(entity);
    delete copy.updatedAt;delete copy.syncState;delete copy.lastSyncedAt;
    return JSON.stringify(copy);
  }
  function ensureUser(data,ctx){
    data.users=Array.isArray(data.users)?data.users:[];
    let user=data.users.find(u=>u.id===ctx.userId);
    if(!user){
      user={id:ctx.userId,companyId:ctx.companyId,role:'owner',displayName:data.settings?.ownerName||'',email:data.settings?.email||'',createdAt:ctx.now,updatedAt:ctx.now};
      data.users.push(user);
    }else{
      user.companyId=ctx.companyId;
      user.role=user.role||'owner';
      user.displayName=data.settings?.ownerName||user.displayName||'';
      user.email=data.settings?.email||user.email||'';
      user.updatedAt=ctx.now;
    }
  }
  function prepare(data,previousRaw=null){
    if(!data||typeof data!=='object')data={};
    const t=now();
    data.meta=data.meta&&typeof data.meta==='object'?data.meta:{};
    data.meta.schemaVersion=SCHEMA_VERSION;
    data.meta.companyId=data.meta.companyId||makeId();
    data.meta.currentUserId=data.meta.currentUserId||makeId();
    data.meta.deviceId=data.meta.deviceId||getDeviceId();
    data.meta.createdAt=data.meta.createdAt||t;
    data.meta.updatedAt=t;
    data.meta.localRevision=(Number(data.meta.localRevision)||0)+1;
    data.meta.storageMode=data.meta.storageMode||'local';
    data.meta.cloudReady=true;
    data.meta.lastSyncError=lastSyncError||'';

    const previous=previousRaw&&typeof previousRaw==='object'?previousRaw:{};
    const ctx={companyId:data.meta.companyId,userId:data.meta.currentUserId,now:t};
    ensureUser(data,ctx);

    ENTITY_COLLECTIONS.forEach(name=>{
      data[name]=Array.isArray(data[name])?data[name]:[];
      const oldMap=new Map((Array.isArray(previous[name])?previous[name]:[]).map(x=>[x.id,x]));
      data[name].forEach(entity=>{
        if(!entity.id)entity.id=makeId();
        const old=oldMap.get(entity.id);
        entity.companyId=entity.companyId||ctx.companyId;
        entity.createdBy=entity.createdBy||old?.createdBy||ctx.userId;
        entity.createdAt=entity.createdAt||old?.createdAt||t;
        const changed=!old||comparable(entity)!==comparable(old);
        entity.updatedAt=changed?t:(old.updatedAt||t);
        entity.syncState=cloudAdapter?(changed?'pending':(old.syncState||'synced')):'local';
      });
    });

    data.meta.deletedEntities=Array.isArray(data.meta.deletedEntities)?data.meta.deletedEntities:[];
    ENTITY_COLLECTIONS.forEach(name=>{
      const before=Array.isArray(previous[name])?previous[name]:[];
      const nowIds=new Set((data[name]||[]).map(x=>x.id));
      before.forEach(old=>{
        if(old?.id&&!nowIds.has(old.id)){
          const key=name+':'+old.id;
          if(!data.meta.deletedEntities.some(x=>x.key===key)){
            data.meta.deletedEntities.push({key,collection:name,id:old.id,deletedAt:t});
          }
        }
      });
    });
    if(data.meta.deletedEntities.length>500)data.meta.deletedEntities=data.meta.deletedEntities.slice(-500);
    return data;
  }
  function loadRaw(key=DEFAULT_KEY){try{return safeParse(localStorage.getItem(key)||'{}',{})}catch(e){return {}}}
  function load(key=DEFAULT_KEY){return loadRaw(key)}
  function writeLocal(key,data){
    try{localStorage.setItem(key,JSON.stringify(data));return true}
    catch(e){
      console.warn('Lokaler Safari-Speicher nicht verfügbar oder voll',e);
      data.meta=data.meta||{};data.meta.localStorageError='Lokaler Gerätespeicher konnte nicht aktualisiert werden.';
      return false;
    }
  }
  function save(data,key=DEFAULT_KEY){
    const previous=loadRaw(key);
    prepare(data,previous);
    writeLocal(key,data);
    if(cloudAdapter?.pushSnapshot){
      Promise.resolve(cloudAdapter.pushSnapshot(toCloudPayload(data)))
        .then(()=>{lastSyncError='';data.meta.lastCloudPushAt=now();data.meta.lastSyncError='';writeLocal(key,data)})
        .catch(err=>{lastSyncError=String(err?.message||err||'Cloud-Sync fehlgeschlagen');data.meta.lastSyncError=lastSyncError;writeLocal(key,data)});
    }
    return data;
  }
  function clear(key=DEFAULT_KEY){try{localStorage.removeItem(key)}catch(e){}}
  function setCloudAdapter(adapter){cloudAdapter=adapter||null}
  function getContext(data){return{companyId:data?.meta?.companyId||'',userId:data?.meta?.currentUserId||'',deviceId:data?.meta?.deviceId||'',schemaVersion:SCHEMA_VERSION}}
  function fileMeta(data){const c=getContext(data),t=now();return{companyId:c.companyId,createdBy:c.userId,createdAt:t,updatedAt:t,syncState:cloudAdapter?'pending':'local'}}
  function toCloudPayload(data){
    return{
      schemaVersion:SCHEMA_VERSION,
      company:{id:data.meta.companyId,name:data.settings?.companyName||'',settings:structuredClone(data.settings||{}),updatedAt:data.meta.updatedAt},
      users:structuredClone(data.users||[]),
      customers:structuredClone(data.customers||[]),offers:structuredClone(data.offers||[]),events:structuredClone(data.events||[]),tasks:structuredClone(data.tasks||[]),jobs:structuredClone(data.jobs||[]),invoices:structuredClone(data.invoices||[]),catalog:structuredClone(data.catalog||[]),
      meta:{localRevision:data.meta.localRevision,deviceId:data.meta.deviceId,exportedAt:now()}
    };
  }
  function diagnostics(data){
    const issues=[];
    if(!data?.meta?.companyId)issues.push('companyId fehlt');
    if(!data?.meta?.currentUserId)issues.push('currentUserId fehlt');
    ENTITY_COLLECTIONS.forEach(name=>(data?.[name]||[]).forEach((x,i)=>{if(!x.id)issues.push(`${name}[${i}] ohne id`);if(!x.companyId)issues.push(`${name}[${i}] ohne companyId`)}));
    return{ok:issues.length===0,schemaVersion:SCHEMA_VERSION,storageMode:data?.meta?.storageMode||'local',cloudReady:true,companyId:data?.meta?.companyId||'',userId:data?.meta?.currentUserId||'',revision:data?.meta?.localRevision||0,issues};
  }

  globalThis.AppRepository={SCHEMA_VERSION,ENTITY_COLLECTIONS,makeId,load,loadRaw,save,clear,prepare,setCloudAdapter,getContext,fileMeta,toCloudPayload,diagnostics};
})();
