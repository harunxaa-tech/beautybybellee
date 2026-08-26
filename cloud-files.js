/* AngebotsPilot v11.5 – private Cloud-Dateien (Fotos & Dokumente) */
(function(){
  'use strict';
  const BUCKET='company-files';
  let client=null,session=null,company=null,membership=null;
  let refreshing=false;
  const cache=new Map();
  const localData=()=>globalThis.data||{};
  const ready=()=>!!(client&&session&&company);
  const uuid=()=>globalThis.crypto?.randomUUID?.()||('f_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
  const safeName=(name='file')=>String(name).replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-100)||'file';
  function persist(){try{globalThis.safePersistCloudIdentity?.(localData())}catch(e){console.warn('Cloud-Datei-Cache konnte lokal nicht gespeichert werden',e)}}
  async function cloudJob(localJobId){
    const {data,error}=await client.from('jobs').select('id,customer_id,local_id').eq('company_id',company.id).eq('local_id',String(localJobId)).is('deleted_at',null).maybeSingle();
    if(error)throw error;return data||null;
  }
  async function cloudCustomer(localCustomerId){
    const {data,error}=await client.from('customers').select('id,local_id').eq('company_id',company.id).eq('local_id',String(localCustomerId)).is('deleted_at',null).maybeSingle();
    if(error)throw error;return data||null;
  }
  async function signedUrl(path,seconds=3600){
    const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,seconds);
    if(error)throw error;return data?.signedUrl||'';
  }
  function dataUrlToBlob(dataUrl){
    const [head,raw]=String(dataUrl).split(',');
    const mime=(head.match(/data:([^;]+)/)||[])[1]||'image/jpeg';
    const bytes=atob(raw||''),arr=new Uint8Array(bytes.length);
    for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);
    return new Blob([arr],{type:mime});
  }
  async function insertMeta({customerId,jobId=null,kind,fileName,path,mime,size}){
    const row={company_id:company.id,customer_id:customerId,job_id:jobId,kind,file_name:fileName,storage_path:path,mime_type:mime||'application/octet-stream',size_bytes:Number(size)||0,created_by:session.user.id};
    const {data,error}=await client.from('customer_files').insert(row).select('*').single();
    if(error)throw error;return data;
  }
  async function uploadBlob({blob,fileName,kind='photo',cloudCustomerId,cloudJobId=null}){
    const branch=cloudJobId?(kind==='acceptance'?`jobs/${cloudJobId}/acceptance`:`jobs/${cloudJobId}`):`customers/${cloudCustomerId}/${kind}`;
    const path=`${company.id}/${branch}/${uuid()}-${safeName(fileName)}`;
    const {error:upErr}=await client.storage.from(BUCKET).upload(path,blob,{contentType:blob.type||'application/octet-stream',upsert:false,cacheControl:'3600'});
    if(upErr)throw upErr;
    try{
      const meta=await insertMeta({customerId:cloudCustomerId,jobId:cloudJobId,kind,fileName,path,mime:blob.type,size:blob.size});
      const url=await signedUrl(path);
      return{id:meta.id,cloud:true,kind,name:meta.file_name,type:meta.mime_type,size:Number(meta.size_bytes)||0,createdAt:meta.created_at,at:meta.created_at,storagePath:path,url,data:url};
    }catch(e){
      try{await client.storage.from(BUCKET).remove([path])}catch(ignore){}
      throw e;
    }
  }
  async function waitForCloudJob(localJobId){
    for(let i=0;i<8;i++){
      const j=await cloudJob(localJobId);if(j)return j;
      if(i===0){try{await globalThis.CloudSync?.pushSnapshot?.()}catch(e){}}
      await new Promise(r=>setTimeout(r,350+i*80));
    }
    return null;
  }
  async function uploadPendingForJob(localJobId){
    if(!ready())return false;
    const d=localData(),job=(d.jobs||[]).find(j=>j.id===localJobId);if(!job)return false;
    const pending=(job.photos||[]).filter(p=>!p.cloud&&p.data&&String(p.data).startsWith('data:'));
    if(!pending.length)return true;
    const cj=await waitForCloudJob(localJobId);if(!cj)throw new Error('Baustelle ist noch nicht in der Cloud angekommen.');
    globalThis.toast?.(`☁️ ${pending.length} Foto${pending.length===1?'':'s'} werden hochgeladen …`);
    for(const p of pending){
      try{
        const blob=dataUrlToBlob(p.data);
        const uploaded=await uploadBlob({blob,fileName:p.name||`Baustelle-${new Date().toISOString().slice(0,10)}.jpg`,kind:'photo',cloudCustomerId:cj.customer_id,cloudJobId:cj.id});
        const i=job.photos.findIndex(x=>x.id===p.id);if(i>=0)job.photos[i]=uploaded;
      }catch(e){console.error('Foto-Upload fehlgeschlagen',e);p.cloudError=String(e?.message||e)}
    }
    persist();
    await refreshJob(localJobId,{render:false});
    globalThis.renderAll?.();
    globalThis.toast?.('✓ Baustellenfotos in der Cloud gespeichert');
    return true;
  }
  async function fetchVisibleFiles(){
    const {data,error}=await client.from('customer_files').select('*').eq('company_id',company.id).order('created_at',{ascending:true});
    if(error)throw error;return data||[];
  }
  async function signRows(rows){
    const out=[];
    for(const r of rows){
      let url='';try{url=await signedUrl(r.storage_path)}catch(e){}
      const item={id:r.id,cloud:true,kind:r.kind,name:r.file_name,type:r.mime_type,size:Number(r.size_bytes)||0,createdAt:r.created_at,at:r.created_at,createdBy:r.created_by||'',storagePath:r.storage_path,url,data:url,jobCloudId:r.job_id,customerCloudId:r.customer_id};
      cache.set(String(r.id),item);out.push(item);
    }
    return out;
  }
  async function refresh({silent=false}={}){
    if(!ready()||refreshing)return false;
    refreshing=true;
    try{
      const [rows,{data:jobs,error:jobErr}]=await Promise.all([
        fetchVisibleFiles(),
        client.from('jobs').select('id,local_id').eq('company_id',company.id).is('deleted_at',null)
      ]);
      if(jobErr)throw jobErr;
      const items=await signRows(rows),localByCloud=new Map((jobs||[]).map(j=>[j.id,j.local_id||j.id]));
      const byJob=new Map();
      items.filter(f=>f.kind==='photo'&&f.jobCloudId).forEach(f=>{const lid=localByCloud.get(f.jobCloudId);if(!lid)return;if(!byJob.has(lid))byJob.set(lid,[]);byJob.get(lid).push(f)});
      const d=localData();
      (d.jobs||[]).forEach(j=>{
        const pending=(j.photos||[]).filter(p=>!p.cloud);
        j.photos=[...(byJob.get(j.id)||[]),...pending];
      });
      persist();
      if(!silent)globalThis.renderAll?.();
      return true;
    }finally{refreshing=false}
  }
  async function refreshJob(localJobId,{render=true}={}){
    if(!ready())return false;
    const cj=await cloudJob(localJobId);if(!cj)return false;
    const {data,error}=await client.from('customer_files').select('*').eq('company_id',company.id).eq('job_id',cj.id).eq('kind','photo').order('created_at',{ascending:true});
    if(error)throw error;
    const items=await signRows(data||[]),d=localData(),job=(d.jobs||[]).find(j=>j.id===localJobId);if(!job)return false;
    const pending=(job.photos||[]).filter(p=>!p.cloud);job.photos=[...items,...pending];persist();
    if(render)globalThis.refreshOpenJobPhotosFromCloud?.(localJobId);
    return true;
  }
  async function listCustomerFiles(localCustomerId){
    if(!ready())return [];
    const cc=await cloudCustomer(localCustomerId);if(!cc)return [];
    const {data,error}=await client.from('customer_files').select('*').eq('company_id',company.id).eq('customer_id',cc.id).or('job_id.is.null,kind.eq.acceptance').order('created_at',{ascending:false});
    if(error)throw error;return signRows(data||[]);
  }
  async function uploadCustomerFiles(localCustomerId,files,kind='document'){
    if(!ready())throw new Error('Cloud ist nicht verbunden');
    let cc=await cloudCustomer(localCustomerId);if(!cc){try{await globalThis.CloudSync?.pushSnapshot?.()}catch(e){}for(let i=0;i<5&&!cc;i++){await new Promise(r=>setTimeout(r,350));cc=await cloudCustomer(localCustomerId)}}if(!cc)throw new Error('Kunde ist noch nicht in der Cloud. Bitte kurz synchronisieren.');
    const out=[];
    for(const f of files){
      let blob=f.blob||f;
      if(!(blob instanceof Blob))continue;
      out.push(await uploadBlob({blob,fileName:f.name||blob.name||'Datei',kind,cloudCustomerId:cc.id}));
    }
    return out;
  }
  async function uploadJobFile(localJobId,blob,fileName='Datei.pdf',kind='document'){
    if(!ready())throw new Error('Cloud ist nicht verbunden');
    if(!(blob instanceof Blob))throw new Error('Ungültige Datei');
    const cj=await waitForCloudJob(localJobId);if(!cj)throw new Error('Baustelle ist noch nicht in der Cloud. Bitte kurz synchronisieren.');
    return uploadBlob({blob,fileName,kind,cloudCustomerId:cj.customer_id,cloudJobId:cj.id});
  }
  async function getCustomerFile(id){
    const cached=cache.get(String(id));
    let meta=cached;
    if(!meta){
      const {data,error}=await client.from('customer_files').select('*').eq('id',id).single();if(error)throw error;
      meta=(await signRows([data]))[0];
    }
    const {data:blob,error}=await client.storage.from(BUCKET).download(meta.storagePath);if(error)throw error;
    return{...meta,blob};
  }
  async function deleteCloudFile(id){
    if(!ready())return false;
    let meta=cache.get(String(id));
    if(!meta){const {data,error}=await client.from('customer_files').select('*').eq('id',id).single();if(error)throw error;meta={id:data.id,storagePath:data.storage_path}}
    const {error:dbErr}=await client.from('customer_files').delete().eq('id',id);if(dbErr)throw dbErr;
    const {error:stErr}=await client.storage.from(BUCKET).remove([meta.storagePath]);if(stErr)console.warn('Datei-Metadaten gelöscht, Storage-Löschung fehlgeschlagen',stErr);
    cache.delete(String(id));return true;
  }
  async function deleteJobPhoto(photo,localJobId){
    if(!photo?.cloud)return false;
    await deleteCloudFile(photo.id);await refreshJob(localJobId,{render:true});return true;
  }
  function attach(c,s,co,m){client=c;session=s;company=co;membership=m;cache.clear();return true}
  function detach(){client=session=company=membership=null;cache.clear()}
  function state(){return{ready:ready(),companyId:company?.id||'',role:membership?.role||'',userId:session?.user?.id||''}}
  function canDelete(photo){if(!photo?.cloud)return true;return ['owner','office'].includes(membership?.role||'')||photo.createdBy===session?.user?.id}
  globalThis.CloudFiles={attach,detach,state,ready,canDelete,refresh,refreshJob,uploadPendingForJob,uploadJobFile,listCustomerFiles,uploadCustomerFiles,getCustomerFile,deleteCloudFile,deleteJobPhoto};
})();
