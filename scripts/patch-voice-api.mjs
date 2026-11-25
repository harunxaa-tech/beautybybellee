export function patchVoiceAI(source){
  let s=source;
  function replace(old,next){if(s.split(old).length!==2)throw Error("Unexpected source: "+old.slice(0,70));s=s.replace(old,next)}
  replace('async function authContext(req) {',`// Read at most 32 KiB before parsing; Content-Length alone is not trusted.
async function readBoundedBody(req) {
  const MAX=32768;
  const length=Number(req.headers.get("content-length")||0);
  if(!Number.isFinite(length)||length<0||length>MAX)throw Object.assign(new Error("request_too_large"),{publicCode:"request_too_large",status:413});
  const reader=req.body?.getReader();
  if(!reader)throw Object.assign(new Error("invalid_json"),{publicCode:"invalid_json",status:400});
  const chunks=[];let bytes=0;
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      bytes+=value.byteLength;
      if(bytes>MAX){await reader.cancel();throw Object.assign(new Error("request_too_large"),{publicCode:"request_too_large",status:413})}
      chunks.push(value);
    }
  }finally{reader.releaseLock()}
  const all=new Uint8Array(bytes);let offset=0;
  for(const part of chunks){all.set(part,offset);offset+=part.length}
  let body;
  try{body=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(all))}catch{throw Object.assign(new Error("invalid_json"),{publicCode:"invalid_json",status:400})}
  if(!body||typeof body!=="object"||Array.isArray(body))throw Object.assign(new Error("invalid_json"),{publicCode:"invalid_json",status:400});
  return body;
}
async function reserveApiRequest(service,companyId,userId) {
  const {data,error}=await service.rpc("reserve_voice_api_request",{p_company_id:companyId,p_user_id:userId});
  if(error||data!==true){
    const limited=String(error?.message||"").includes("VOICE_API_RATE_LIMIT");
    throw Object.assign(new Error(limited?"rate_limited":"voice_budget_unavailable"),{publicCode:limited?"rate_limited":"voice_budget_unavailable",status:limited?429:503});
  }
}
async function authContext(req) {`);
  replace('    body:form,\n  });','    body:form,\n    signal:AbortSignal.timeout(60000),\n  });');
  replace('async function openaiStructured(cfg,apiKey,{name,instructions,input,schema}) {','async function openaiStructured(cfg,apiKey,{name,instructions,input,schema}) {\n  if(typeof input!=="string"||input.length>16000)throw Object.assign(new Error("model_input_too_large"),{publicCode:"model_input_too_large",status:413});');
  replace('      reasoning:{effort:"low"},\n      instructions,','      reasoning:{effort:"low"},\n      max_output_tokens:2048,\n      instructions,');
  replace('      text:{format:{type:"json_schema",name,strict:true,schema}},\n    }),\n  });','      text:{format:{type:"json_schema",name,strict:true,schema}},\n    }),\n    signal:AbortSignal.timeout(60000),\n  });');
  replace('  return {key,fresh:!data.reused};','  if(data.reused)throw Object.assign(new Error("voice_request_already_reserved"),{publicCode:"voice_request_already_reserved",status:409});\n  return {key,fresh:true};');
  replace('    const body=await req.json().catch(()=>({}));','    const body=await readBoundedBody(req);');
  replace('    if(action==="process_chat_voice") return await processChatVoice','    if(!["process_chat_voice","translate_chat_message","process_offer_voice_note","offer_dictation"].includes(action))return json({error:"invalid_action"},400);\n    await reserveApiRequest(service,companyId,user.id);\n    if(action==="process_chat_voice") return await processChatVoice');
  return s;
}
