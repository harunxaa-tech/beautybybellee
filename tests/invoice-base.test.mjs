import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../einvoice.js',import.meta.url),'utf8');
function fixture(){
  const data={settings:{countryCode:'DE',companyName:'Musterbetrieb & Söhne',address:'Teststraße 1\n12345 Teststadt',email:'seller@example.invalid',taxNumber:'123/456/78900',vatId:'DE123456789',iban:'DE02120300000000202051',taxTreatment:'standard'},customers:[{id:'c',name:'Testkunde GmbH',address:'Testweg 2\n12345 Teststadt',email:'buyer@example.invalid',customerType:'business',countryCode:'DE'}],invoices:[]};
  const ctx=vm.createContext({data});vm.runInContext(source,ctx);
  const inv={id:'i',customerId:'c',number:'RE-TEST-001',date:'2026-11-25',serviceDate:'2026-11-24',dueDate:'2026-12-09',subject:'Testleistung',tax:19,taxTreatment:'standard',lines:[{name:'Arbeit & Material <Test>',qty:2,price:50,unit:'Std'}],subtotal:100,total:119,discount:0};
  return {api:ctx.APCompliance,inv,data};
}
test('standard domestic B2B is routed to structured invoice',()=>{const {api,inv}=fixture();assert.equal(api.route(inv).format,'xrechnung');assert.equal(api.check(inv).ok,true);});
test('wrong gross amount is rejected',()=>{const {api,inv}=fixture();inv.total=118;assert.equal(api.check(inv).ok,false);});
test('wrong subtotal is rejected',()=>{const {api,inv}=fixture();inv.subtotal=90;assert.equal(api.check(inv).ok,false);});
test('missing invoice identifier is rejected',()=>{const {api,inv}=fixture();inv.number='';assert.equal(api.check(inv).ok,false);});
test('zero quantity is rejected',()=>{const {api,inv}=fixture();inv.lines[0].qty=0;assert.equal(api.check(inv).ok,false);});
test('unknown German recipient type is not silently accepted',()=>{const {api,inv,data}=fixture();data.customers[0].name='Testperson';data.customers[0].customerType='auto';assert.equal(api.check(inv).ok,false);});
test('explicit private customer uses PDF route',()=>{const {api,inv,data}=fixture();data.customers[0].customerType='private';assert.equal(api.route(inv).format,'pdf');});
test('small business without mandatory recipient format uses PDF',()=>{const {api,inv}=fixture();inv.taxTreatment='small_business';inv.tax=0;inv.total=100;assert.equal(api.route(inv).format,'pdf');assert.equal(api.check(inv).ok,true);});
test('public recipient missing buyer reference is rejected',()=>{const {api,inv,data}=fixture();data.customers[0].customerType='public';assert.equal(api.check(inv).ok,false);});
test('XML escapes text and includes monetary totals',()=>{const {api,inv}=fixture();const xml=api.generateUbl(inv);assert.match(xml,/Musterbetrieb &amp; Söhne/);assert.match(xml,/Arbeit &amp; Material &lt;Test&gt;/);assert.match(xml,/<cbc:PayableAmount currencyID="EUR">119\.00<\/cbc:PayableAmount>/);});
test('discount calculation agrees with displayed totals',()=>{const {api,inv}=fixture();inv.discount=10;inv.subtotal=90;inv.total=107.1;assert.equal(api.check(inv).ok,true);});
test('credit note references original document in base generator',()=>{const {api,inv,data}=fixture();data.invoices.push({id:'original',number:'RE-ORIGINAL'});inv.documentType='cancellation';inv.originalInvoiceId='original';const xml=api.generateUbl(inv);assert.match(xml,/<CreditNote\b/);assert.match(xml,/<cbc:CreditNoteTypeCode>381<\/cbc:CreditNoteTypeCode>/);assert.match(xml,/<cbc:ID>RE-ORIGINAL<\/cbc:ID>/);});
