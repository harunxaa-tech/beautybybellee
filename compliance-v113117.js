/* AngebotsPilot v11.31.17 – serverseitige XRechnungs-Validierung
   Ergänzt den lokalen EN16931/XRechnung-Vorabcheck um einen authentifizierten
   Supabase-Servercheck. Ein echter KoSIT-Daemon wird nur als „offiziell bestanden“
   ausgewiesen, wenn der Server tatsächlich dessen Ergebnis bestätigt. */
(function installServerXRechnungValidation(){
  'use strict';

  const RUNTIME_VERSION='11.31.17';
  const BASE_VERSION='11.31.08';
  const FUNCTION_NAME='xrechnung-validate';

  const uniq=arr=>[...new Set((arr||[]).filter(Boolean).map(x=>String(x)))];
  const messageText=item=>String(item?.message||item?.text||item||'').trim();

  function cloudContext(){
    try{return globalThis.APCloudContext?.()||null}catch(e){return null}
  }

  function serverMessages(result){
    return [
      ...(result?.server_preflight?.messages||[]),
      ...(result?.official_kosit?.messages||[])
    ].map(messageText).filter(Boolean);
  }

  async function invokeServerValidation(inv,job){
    const ctx=cloudContext();
    if(!ctx?.client||!ctx?.session?.user||!ctx?.company?.id){
      return{
        ok:true,
        transport:'unavailable',
        server_preflight:{status:'unavailable',valid:null,messages:[{severity:'warning',message:'Serverprüfung ist erst nach der Cloud-Anmeldung verfügbar.'}]},
        official_kosit:{status:'not-run',valid:null,required:false}
      };
    }
    if(!job?.xml||!job?.xmlSha256){
      return{
        ok:false,
        transport:'invalid-job',
        server_preflight:{status:'failed',valid:false,messages:[{severity:'error',message:'Die strukturierte XML-Datei konnte nicht für die Serverprüfung vorbereitet werden.'}]},
        official_kosit:{status:'not-run',valid:null,required:false}
      };
    }

    const invoiceRef=String(inv?.id||inv?.localId||'').trim();
    if(!invoiceRef){
      return{
        ok:false,
        transport:'missing-invoice-id',
        server_preflight:{status:'failed',valid:false,messages:[{severity:'error',message:'Die Rechnung besitzt noch keine stabile Beleg-ID für die Serverprüfung.'}]},
        official_kosit:{status:'not-run',valid:null,required:false}
      };
    }

    try{
      const {data,error}=await ctx.client.functions.invoke(FUNCTION_NAME,{
        body:{
          invoice_id:invoiceRef,
          xml:job.xml,
          xml_sha256:job.xmlSha256,
          profile:'xrechnung'
        }
      });
      if(error){
        console.warn('XRechnung-Serverprüfung nicht erreichbar',error);
        return{
          ok:false,
          transport:'error',
          technicalError:true,
          server_preflight:{status:'error',valid:null,messages:[{severity:'error',message:'Der E-Rechnungs-Prüfservice ist technisch nicht erreichbar. Es fehlt kein Eingabefeld.'}]},
          official_kosit:{status:'error',valid:null,required:true}
        };
      }
      return data&&typeof data==='object'?{transport:'ok',...data}:{
        ok:true,
        transport:'empty',
        server_preflight:{status:'unavailable',valid:null,messages:[{severity:'warning',message:'Serverprüfung lieferte noch kein verwertbares Ergebnis.'}]},
        official_kosit:{status:'not-run',valid:null,required:false}
      };
    }catch(error){
      console.warn('XRechnung-Serverprüfung fehlgeschlagen',error);
      return{
        ok:true,
        transport:'error',
        server_preflight:{status:'unavailable',valid:null,messages:[{severity:'warning',message:'Serverprüfung konnte gerade nicht ausgeführt werden. Der lokale Vorabcheck bleibt aktiv.'}]},
        official_kosit:{status:'not-run',valid:null,required:false}
      };
    }
  }

  function install(base){
    if(!base)return false;
    if(base.runtimeVersion===RUNTIME_VERSION)return true;
    if(base.runtimeVersion!==BASE_VERSION)return false;
    if(typeof base.prepareForFinalization!=='function'||typeof base.route!=='function')return false;

    const original={...base};

    async function serverValidate(inv,job=null){
      const r=original.route(inv);
      if(r?.format!=='xrechnung')return null;
      let preparedJob=job;
      if(!preparedJob&&typeof original.validatorJob==='function')preparedJob=await original.validatorJob(inv);
      return invokeServerValidation(inv,preparedJob);
    }

    function applyServerValidation(inv,local,server){
      const previous=inv.complianceReport||{};
      const messages=serverMessages(server);
      const official=server?.official_kosit||{};
      const preflight=server?.server_preflight||{};
      const officialPassed=official.status==='passed'&&official.valid===true;
      const officialRejected=official.status==='failed';
      const technicalError=server?.technicalError===true||server?.transport==='error'||official.status==='error'||preflight.status==='error';
      const serverFailed=preflight.status==='failed'||preflight.valid===false;

      inv.complianceReport={
        ...previous,
        serverValidation:{
          checkedAt:new Date().toISOString(),
          xmlSha256:server?.xml_sha256||local.validatorJob?.xmlSha256||'',
          transport:server?.transport||'ok',
          serverPreflight:preflight,
          officialKosit:official,
          validator:server?.validator||{
            xrechnung:'3.0.2',
            configuration:'2026-08-31',
            target_engine:'KoSIT Validator 1.6.3'
          }
        },
        validationLevel:officialPassed?'official-kosit-server-validated':'server-preflight-kosit-gateway',
        validationPipeline:{
          ...(previous.validationPipeline||{}),
          serverPreflight:{status:preflight.status||'unavailable'},
          officialKosit:{
            ...(previous.validationPipeline?.officialKosit||{}),
            status:official.status||'not-run',
            validatorVersion:server?.validator?.version||'1.6.3',
            configurationVersion:server?.validator?.configuration||'2026-08-31'
          }
        }
      };

      if(technicalError){
        const errors=uniq([...(local.errors||[]),...messages.length?messages:['Technische KoSIT-Prüfung derzeit nicht erreichbar.']]);
        inv.complianceStatus='blocked';
        inv.complianceReport={...(inv.complianceReport||{}),errors};
        return{...local,ok:false,status:'technical-error',failureKind:'technical',technicalError:true,errors,serverValidation:server};
      }

      if(serverFailed||officialRejected||server?.ok===false){
        const errors=uniq([...(local.errors||[]),...messages]);
        inv.complianceStatus='blocked';
        inv.complianceReport={...(inv.complianceReport||{}),errors};
        return{...local,ok:false,status:'blocked',failureKind:officialRejected?'validator-rejected':'validation',errors,serverValidation:server};
      }

      const warnings=[...(local.warnings||[])];
      if(officialPassed){
        warnings.push('Serverprüfung abgeschlossen: offizieller KoSIT-Validator hat diese XML-Fassung akzeptiert.');
      }else if(official.status==='unavailable'){
        warnings.push('Server-Vorabprüfung bestanden. Der offizielle KoSIT-Daemon ist noch nicht mit AngebotsPilot verbunden; es wird kein KoSIT-Erfolg vorgetäuscht.');
      }else if(preflight.status==='passed'){
        warnings.push('Server-Vorabprüfung bestanden. Eine offizielle KoSIT-Bestätigung liegt für diese XML-Fassung noch nicht vor.');
      }else if(preflight.status==='unavailable'){
        warnings.push('Serverprüfung war vorübergehend nicht erreichbar. Der lokale XRechnungs-Vorabcheck wurde ausgeführt.');
      }
      inv.complianceReport={...(inv.complianceReport||{}),warnings:uniq(warnings)};
      return{...local,warnings:uniq(warnings),serverValidation:server};
    }

    async function preflightForFinalization(inv){
      original.prepareInvoice?.(inv);
      const local=original.check(inv)||{ok:true,status:'ready',errors:[],warnings:[],route:original.route(inv)};
      if(!local?.ok||local?.route?.format!=='xrechnung')return local;

      let job=null;
      try{
        if(typeof original.validatorJob==='function')job=await original.validatorJob(inv);
      }catch(error){
        const message='XRechnung konnte nicht für die Serverprüfung vorbereitet werden: '+String(error?.message||error);
        const errors=uniq([...(local.errors||[]),message]);
        inv.complianceStatus='blocked';
        inv.complianceReport={...(inv.complianceReport||{}),errors};
        return{...local,ok:false,status:'blocked',errors};
      }

      const server=await serverValidate(inv,job);
      return applyServerValidation(inv,{...local,validatorJob:job},server);
    }

    async function prepareForFinalization(inv){
      const local=await original.prepareForFinalization(inv);
      if(!local?.ok||local?.route?.format!=='xrechnung')return local;
      const server=await serverValidate(inv,local.validatorJob);
      return applyServerValidation(inv,local,server);
    }

    function labelFor(inv){
      const r=original.route(inv);
      if(r?.format!=='xrechnung')return original.labelFor?.(inv)||'Rechnungsprüfung';
      const sv=inv?.complianceReport?.serverValidation;
      if(sv?.officialKosit?.status==='passed')return'XRechnung 3.0.2 · Serverprüfung ✓ · KoSIT ✓';
      if(sv?.serverPreflight?.status==='passed')return'XRechnung 3.0.2 · Serverprüfung ✓ · KoSIT noch ausstehend';
      return'XRechnung 3.0.2 · lokale + serverseitige Prüfung vorbereitet';
    }

    globalThis.APCompliance={
      ...base,
      RUNTIME_VERSION,
      runtimeVersion:RUNTIME_VERSION,
      serverValidationFunction:FUNCTION_NAME,
      serverValidate,
      preflightForFinalization,
      prepareForFinalization,
      labelFor
    };

    window.dispatchEvent(new CustomEvent('angebotspilot:compliance-ready',{detail:{
      version:RUNTIME_VERSION,
      serverValidation:true,
      function:FUNCTION_NAME,
      officialKosit:'gateway-ready'
    }}));
    try{globalThis.refreshInvoiceComplianceUI?.()}catch(e){}
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install(globalThis.APCompliance)){clearInterval(timer);return}
    if(tries>200){clearInterval(timer);console.error('AngebotsPilot v11.31.17 Server-Validierung konnte nicht installiert werden.')}
  },50);
  if(install(globalThis.APCompliance))clearInterval(timer);
})();
