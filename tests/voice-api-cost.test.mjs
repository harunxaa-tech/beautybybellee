import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {patchVoiceAI} from '../scripts/patch-voice-api.mjs';
const base=[
'async function authContext(req) {',
'    body:form,\n  });',
'async function openaiStructured(cfg,apiKey,{name,instructions,input,schema}) {',
'      reasoning:{effort:"low"},\n      instructions,',
'      text:{format:{type:"json_schema",name,strict:true,schema}},\n    }),\n  });',
'  return {key,fresh:!data.reused};',
'    const body=await req.json().catch(()=>({}));',
'    if(action==="process_chat_voice") return await processChatVoice'
].join('\n');
const patched=patchVoiceAI(base);
const helpers=patched.slice(patched.indexOf('async function readBoundedBody'),patched.indexOf('async function authContext'));
const context=vm.createContext({Request,TextDecoder,Uint8Array,Number,Error,JSON,Object,Array});
vm.runInContext(helpers,context);
const req=(body,headers={})=>new Request('https://example.invalid',{method:'POST',headers,body});
test('patch fails if expected upstream anchors changed',()=>{assert.throws(()=>patchVoiceAI(base.replace('body:form','body:other')),/Unexpected source/)});
test('bounded valid JSON request accepted',async()=>{assert.equal((await context.readBoundedBody(req('{"action":"status"}'))).action,'status')});
test('oversized content length rejected before read',async()=>{await assert.rejects(context.readBoundedBody(req('{}',{'content-length':'50000'})),e=>e.status===413)});
test('actual bytes checked without content-length',async()=>{await assert.rejects(context.readBoundedBody(req(JSON.stringify({a:'x'.repeat(40000)}))),e=>e.status===413)});
test('invalid or non-object JSON rejected',async()=>{for(const value of ['bad','[]','null'])await assert.rejects(context.readBoundedBody(req(value)),e=>e.status===400)});
test('budget only accepts positive database confirmation',async()=>{await context.reserveApiRequest({rpc:async()=>({data:true})},'c','u');await assert.rejects(context.reserveApiRequest({rpc:async()=>({data:null})},'c','u'),e=>e.status===503)});
test('exhausted budget returns 429; DB failure returns 503',async()=>{await assert.rejects(context.reserveApiRequest({rpc:async()=>({error:{message:'VOICE_API_RATE_LIMIT'}})},'c','u'),e=>e.status===429);await assert.rejects(context.reserveApiRequest({rpc:async()=>({error:{message:'offline'}})},'c','u'),e=>e.status===503)});
test('reservation happens before provider dispatch and duplicate audio is rejected',()=>{assert.ok(patched.indexOf('await reserveApiRequest(service,companyId,user.id)')<patched.indexOf('return await processChatVoice'));assert.match(patched,/if\(data\.reused\)throw/);assert.match(patched,/max_output_tokens:2048/);assert.equal((patched.match(/AbortSignal\.timeout\(60000\)/g)||[]).length,2)});
