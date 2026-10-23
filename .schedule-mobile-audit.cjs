const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
 const target=await(await fetch('http://127.0.0.1:9224/json/new?about:blank',{method:'PUT'})).json();
 const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 let next=0;const pending=new Map(),errors=[];
 function send(method,params={}){return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
 const sessions=[
  {id:1,patientId:1,patientName:'Sara Ahmed Hassan',doctorId:10,doctorName:'Dr. Adel Hassan',roomId:20,roomName:'Treatment Room 1',startTime:'2026-10-23T08:00:00',status:'Confirmed',appointmentType:'Session'},
  {id:2,patientId:2,patientName:'Mona Ibrahim Ali',doctorId:11,doctorName:'Dr. Noha Ahmed',roomId:21,roomName:'Treatment Room 2',startTime:'2026-10-23T09:00:00',status:'In Progress',appointmentType:'Assessment'},
  {id:3,patientId:3,patientName:'Omar Mostafa Ahmed',doctorId:10,doctorName:'Dr. Adel Hassan',roomId:20,roomName:'Treatment Room 1',startTime:'2026-10-23T10:00:00',status:'Completed',appointmentType:'Session'}
 ];
 socket.addEventListener('message',async e=>{
  const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);
  if(m.method==='Fetch.requestPaused'){
   const {requestId,request}=m.params;let body=[];
   if(request.url.includes('/dashboard-stats'))body={todaysSessions:3,completedSessions:1,pendingPayments:1,collectedTodayRevenue:200,expectedTodayRevenue:600,collectionRateToday:33};
   if(request.url.includes('/today-sessions'))body=sessions;
   if(request.url.includes('/Users/'))body={value:[{id:'10',fullName:'Dr. Adel Hassan',userName:'adel',roles:['Doctor']},{id:'11',fullName:'Dr. Noha Ahmed',userName:'noha',roles:['Doctor']}]};
   if(request.url.includes('/Patients/'))body={items:[]};
   await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
  }
 });
 async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 try{
  await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*://clinitech-solutions65.runasp.net/*'}]});
  const token='audit.'+Buffer.from(JSON.stringify({sub:'audit',userName:'Receptionist',roles:['Receptionist']})).toString('base64url')+'.local';
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.protocol==='http:'){localStorage.setItem('mediqova-token',${JSON.stringify(token)});localStorage.setItem('mediqova-theme','light');localStorage.setItem('mediqova-lang','en');}`});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://localhost:4200/?scheduleMobileAudit=1#/receptionist/schedule'});
  let ready=false;for(let i=0;i<150;i++){if(await evaluate(`Boolean(document.querySelector('.schedule-filter-fields')&&window.ng&&ng.getComponent(document.querySelector('app-receptionist-schedule')).todaySessions.length===3)`)){ready=true;break;}await pause(100);}
  if(!ready)throw Error('Schedule not loaded: '+await evaluate('document.body.innerText.slice(-2000)'));
  const checks=[];
  for(const lang of ['en','ar']){
   await evaluate(`{const l=ng.getComponent(document.querySelector('app-language-selector'));if(l.langService.currentLang()!==${JSON.stringify(lang)})l.langService.toggleLanguage();}`);await pause(200);
   for(const theme of ['light','dark']){
    await evaluate(`if(document.documentElement.classList.contains('light')!==${theme==='light'})document.querySelector('.theme-switch').click()`);await pause(150);
    for(const width of [320,360,390,430,575,767,768,1024,1440]){
     await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await pause(300);
     const r=await evaluate(`(()=>{
      const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}};
      const cards=[...document.querySelectorAll('.schedule-kpi-card')];
      return{cards:cards.map(rect),fields:[...document.querySelector('.schedule-filter-fields').children].map(rect),pills:[...document.querySelectorAll('.status-pill-btn')].map(rect),overflow:document.documentElement.scrollWidth>innerWidth,cardOverflow:[...cards,...document.querySelectorAll('.session-card')].some(e=>e.scrollWidth>e.clientWidth+1),missing:/RECEPTIONIST\\.[A-Z_]+/.test(document.querySelector('.schedule-page').innerText),timelineY:document.querySelector('.timeline-scroll-area').getBoundingClientRect().y,hero:rect(document.querySelector('.schedule-hero-header'))};
     })()`);
     const fail=r.overflow||r.cardOverflow||r.missing||(width<=767&&(!(Math.abs(r.cards[0].y-r.cards[1].y)<1&&Math.abs(r.cards[2].y-r.cards[3].y)<1&&r.cards[2].y>r.cards[0].y)||!r.fields.every(e=>e.h===36&&Math.abs(e.y-r.fields[0].y)<1)||!r.pills.every(e=>Math.abs(e.y-r.pills[0].y)<1)));
     checks.push({lang,theme,width,fail,...r});
    }
   }
  }
  const interactions=await evaluate(`(async()=>{
   const c=ng.getComponent(document.querySelector('app-receptionist-schedule'));
   document.querySelectorAll('.status-pill-btn')[2].click();await new Promise(r=>setTimeout(r,50));
   const status=c.selectedFilter==='In Progress'&&document.querySelectorAll('.session-card').length===1;
   document.querySelectorAll('.status-pill-btn')[0].click();
   const [doctor,room]=document.querySelectorAll('.schedule-filter-fields select');doctor.value='10';doctor.dispatchEvent(new Event('change',{bubbles:true}));room.value='20';room.dispatchEvent(new Event('change',{bubbles:true}));
   const input=document.querySelector('.schedule-search input');input.value='Sara';input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,80));
   const filters=c.searchQuery==='Sara'&&c.selectedDoctorFilter==='10'&&c.selectedRoomFilter==='20'&&document.querySelectorAll('.session-card').length===1;
   document.querySelector('.btn-clear-search').click();await new Promise(r=>setTimeout(r,50));const clear=c.searchQuery==='';
   document.querySelector('.schedule-view-controls > button').click();await new Promise(r=>setTimeout(r,50));const reset=c.selectedDoctorFilter===''&&c.selectedRoomFilter===''&&document.querySelectorAll('.session-card').length===3;
   document.querySelectorAll('.view-btn')[1].click();const view=c.viewMode()==='Week';document.querySelectorAll('.view-btn')[0].click();
   return{status,filters,clear,reset,view};
  })()`);
  const captures=[];
  for(const lang of ['en','ar']){
   await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:false});await evaluate(`{const l=ng.getComponent(document.querySelector('app-language-selector'));if(l.langService.currentLang()!==${JSON.stringify(lang)})l.langService.toggleLanguage();if(!document.documentElement.classList.contains('light'))document.querySelector('.theme-switch').click();}`);await pause(350);
   const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const file=path.join(os.tmpdir(),'schedule-mobile-'+lang+'.png');fs.writeFileSync(file,Buffer.from(shot.data,'base64'));captures.push(file);
  }
  console.log(JSON.stringify({checks:checks.length,failures:checks.filter(c=>c.fail),interactions,errors,sample:checks.find(c=>c.lang==='en'&&c.theme==='light'&&c.width===390),captures},null,2));
  if(checks.some(c=>c.fail)||Object.values(interactions).some(v=>!v)||errors.length)process.exitCode=1;
 }finally{await send('Page.close');socket.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
