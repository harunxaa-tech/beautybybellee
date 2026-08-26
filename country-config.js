(()=>{
  const COUNTRY_PROFILES={
    DE:{code:'DE',name:'Deutschland',flag:'🇩🇪',currency:'EUR',locale:'de-DE',taxLabel:'Umsatzsteuer',standardRate:19,rates:[19,7],rateLabels:{19:'19 % Standard',7:'7 % ermäßigt'},treatments:['standard','small_business','reverse_charge','exempt']},
    AT:{code:'AT',name:'Österreich',flag:'🇦🇹',currency:'EUR',locale:'de-AT',taxLabel:'Umsatzsteuer',standardRate:20,rates:[20,10,13,4.9],rateLabels:{20:'20 % Standard',10:'10 % ermäßigt',13:'13 % ermäßigt',4.9:'4,9 % Sonderfall'},treatments:['standard','small_business','reverse_charge','exempt']},
    CH:{code:'CH',name:'Schweiz',flag:'🇨🇭',currency:'CHF',locale:'de-CH',taxLabel:'MWST',standardRate:8.1,rates:[8.1,2.6,3.8],rateLabels:{8.1:'8,1 % Normalsatz',2.6:'2,6 % reduziert',3.8:'3,8 % Beherbergung'},treatments:['standard','non_registered','exempt']}
  };
  const TREATMENTS={
    standard:{label:'Normal besteuert',rateEnabled:true},
    small_business:{label:'Kleinunternehmer / steuerbefreit',rateEnabled:false},
    reverse_charge:{label:'Reverse Charge / Steuerschuldnerschaft Empfänger',rateEnabled:false},
    exempt:{label:'Steuerfrei / Sonderfall',rateEnabled:false},
    non_registered:{label:'Nicht MWST-pflichtig / nicht registriert',rateEnabled:false}
  };
  const ACTIVE_LANGUAGES=[{code:'de',label:'Deutsch'}];
  const FUTURE_LANGUAGES=[
    {code:'en',label:'English'},{code:'pl',label:'Polski'},{code:'ro',label:'Română'},
    {code:'hr',label:'Hrvatski'},{code:'bs',label:'Bosanski'},{code:'sr',label:'Srpski'},
    {code:'fr',label:'Français'},{code:'it',label:'Italiano'}
  ];
  const DICTIONARIES={de:{}};
  function country(code){return COUNTRY_PROFILES[code]||COUNTRY_PROFILES.DE}
  function treatment(code){return TREATMENTS[code]||TREATMENTS.standard}
  function currencySymbol(code){return code==='CHF'?'CHF':'€'}
  function money(value,currency='EUR',locale){
    const loc=locale||Object.values(COUNTRY_PROFILES).find(x=>x.currency===currency)?.locale||'de-DE';
    return new Intl.NumberFormat(loc,{style:'currency',currency,maximumFractionDigits:2}).format(Number(value)||0);
  }
  function legalTaxNote(countryCode,treatmentCode){
    const c=country(countryCode);
    if(treatmentCode==='standard')return '';
    if(countryCode==='DE'&&treatmentCode==='small_business')return 'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.';
    if(countryCode==='DE'&&treatmentCode==='reverse_charge')return 'Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG.';
    if(countryCode==='AT'&&treatmentCode==='small_business')return 'Umsatzsteuerbefreit aufgrund der Kleinunternehmerregelung. Voraussetzungen bitte prüfen.';
    if(countryCode==='AT'&&treatmentCode==='reverse_charge')return 'Übergang der Steuerschuld auf den Leistungsempfänger (Reverse Charge).';
    if(countryCode==='CH'&&treatmentCode==='non_registered')return 'Keine MWST ausgewiesen (nicht als MWST-pflichtig erfasst).';
    if(treatmentCode==='exempt')return c.code==='CH'?'Keine MWST ausgewiesen. Steuerbefreiung/Sonderfall bitte prüfen.':'Keine Umsatzsteuer ausgewiesen. Steuerbefreiung/Sonderfall bitte prüfen.';
    return '';
  }
  function t(key,fallback='',lang='de'){
    const dict=DICTIONARIES[lang]||DICTIONARIES.de;
    return dict[key]??fallback??key;
  }
  window.APCountry={COUNTRY_PROFILES,TREATMENTS,ACTIVE_LANGUAGES,FUTURE_LANGUAGES,country,treatment,currencySymbol,money,legalTaxNote,t};
})();
