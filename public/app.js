(() => {
/* Each person has their own board: index.html is Aleah's, jap.html is Jap's.
   Clients are shared; tasks belong to one board. */
const BOARDS=[{id:"aleah",name:"Aleah",role:"Web Specialist",href:"/"},{id:"jap",name:"Jap",role:"SEO Analyst",href:"/jap"}];
const BOARD=document.body.dataset.board==="jap"?"jap":"aleah";
const ME=BOARDS.find(b=>b.id===BOARD);
const PRI=[{id:"critical",name:"Critical Priority"},{id:"high",name:"High Priority"},{id:"medium",name:"Medium Priority"},{id:"low",name:"Low Priority"}];
const S={tasks:[],clients:[],ai:false,client:null,q:"",open:{critical:true,high:true,medium:false,low:false},editing:null,loaded:false,review:null,busy:0,selecting:false,sel:new Set()};
const $=id=>document.getElementById(id);
function h(tag,attrs,...kids){const e=document.createElement(tag);if(attrs)for(const[k,v]of Object.entries(attrs)){if(v==null||v===false)continue;if(k==="class")e.className=v;else if(k.startsWith("on"))e.addEventListener(k.slice(2),v);else e.setAttribute(k,v===true?"":v)}for(const c of kids.flat()){if(c==null||c===false)continue;e.append(c.nodeType?c:document.createTextNode(String(c)))}return e}
const toastEl=$("toast");let tt;function toast(m){toastEl.textContent=m;toastEl.classList.add("show");clearTimeout(tt);tt=setTimeout(()=>toastEl.classList.remove("show"),3200)}
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const fmtDate=s=>{if(!s)return"";const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString(undefined,{month:"short",day:"numeric"})};
const initials=n=>n.split(/\s+/).filter(w=>/[A-Za-z0-9]/.test(w[0]||"")).slice(0,2).map(w=>w[0].toUpperCase()).join("")||"?";
const clientById=id=>S.clients.find(c=>c.id===id);
const validPri=p=>PRI.some(x=>x.id===p)?p:"medium";
const isDate=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s);
const boardOf=t=>t.board==="jap"?"jap":"aleah";
const mine=()=>S.tasks.filter(t=>boardOf(t)===BOARD);

/* header text for this board */
$("board-sub").textContent=ME.name+"'s tasks · "+ME.role;
document.title=ME.name+"'s Task Tracker";

/* ---------- API ---------- */
async function api(path,body){
  const r=await fetch(path,body===undefined?{cache:"no-store"}:{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(data.error||"Request failed ("+r.status+")"),{status:r.status});
  return data;
}
async function uploadFile(file,type){
  const r=await fetch("/api/upload?name="+encodeURIComponent(file.name),{method:"POST",headers:{"content-type":type||file.type},body:file});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||"Upload failed");
  return data.url;
}
let loadErrShown=false;
async function refresh(){
  if(S.busy||document.hidden||S.editing||S.selecting)return;
  try{
    const d=await api("/api/data");
    S.clients=(d.clients||[]).sort((a,b)=>(a.order||0)-(b.order||0)||a.name.localeCompare(b.name));
    S.tasks=(d.tasks||[]).filter(t=>typeof t.title==="string");
    S.ai=!!d.ai;S.loaded=true;loadErrShown=false;$("status").replaceChildren();
    updateDropText();syncUploadClient();renderAll();
  }catch(e){
    S.loaded=true;
    if(!loadErrShown){loadErrShown=true;$("status").replaceChildren(h("div",{class:"notice"},e.message||"Can't reach the tracker's data right now."))}
    renderAll();
  }
}
async function mutate(fn){S.busy++;try{return await fn()}finally{S.busy--;}}

/* ---------- clocks ---------- */
function tick(){const o={hour:"numeric",minute:"2-digit",weekday:"short"};try{$("clk-fm").textContent=new Date().toLocaleString("en-US",{...o,timeZone:"America/New_York"});$("clk-local").textContent=new Date().toLocaleString("en-US",o)}catch{}}
tick();setInterval(tick,30000);

/* ---------- filtering ---------- */
function matchesQ(t){if(!S.q)return true;const q=S.q.toLowerCase();const c=clientById(t.clientId);return (t.title||"").toLowerCase().includes(q)||(t.note||"").toLowerCase().includes(q)||(c&&c.name.toLowerCase().includes(q))}
function visibleTasks(){return mine().filter(t=>(!S.client||t.clientId===S.client)&&matchesQ(t))}

/* ---------- boards (team rail) ---------- */
function renderTeam(){
  const el=$("team");el.replaceChildren();
  for(const b of BOARDS){
    const open=S.tasks.filter(t=>boardOf(t)===b.id&&!t.done).length;
    el.append(h("a",{class:"member",href:b.href,"aria-current":b.id===BOARD?"page":null,"aria-pressed":String(b.id===BOARD)},
      h("span",{class:"avatar av-"+b.id,"aria-hidden":"true"},b.name[0]),
      h("span",null,h("div",{class:"nm"},b.name+"'s board"),h("div",{class:"rl"},b.role)),
      h("span",{class:"open",title:"Open tasks"},open)));
  }
  const tasks=mine();
  const all=tasks.length,done=tasks.filter(t=>t.done).length,pct=all?Math.round(done/all*100):0;
  const late=tasks.filter(t=>!t.done&&isDate(t.end)&&t.end<today()).length;
  const week=tasks.filter(t=>{if(t.done||!isDate(t.end))return false;const d=(new Date(t.end)-new Date(today()))/864e5;return d>=0&&d<=7}).length;
  $("summary").replaceChildren(h("div",{class:"eyebrow"},ME.name+"'s progress"),h("div",{class:"big"},pct+"%"),h("div",{class:"bar"},h("i",{style:"width:"+pct+"%"})),
    h("div",{class:"sum-rows"},h("div",null,"Done",h("b",null,done+" / "+all)),h("div",null,"Due in 7 days",h("b",null,week)),h("div",null,"Overdue",h("b",null,late))));
}

/* ---------- clients ---------- */
function logoEl(c){if(c.logo){const img=h("img",{src:c.logo,alt:c.name+" logo",loading:"lazy"});img.onerror=()=>{img.parentElement.classList.add("initials");img.replaceWith(document.createTextNode(initials(c.name)))};return h("span",{class:"logo"},img)}return h("span",{class:"logo initials","aria-hidden":"true"},initials(c.name))}
function renderClients(){
  const el=$("clients");el.replaceChildren();
  $("client-count").textContent=S.clients.length?S.clients.length:"";
  const q=S.q.toLowerCase();
  let list=S.clients;
  if(q)list=list.filter(c=>c.name.toLowerCase().includes(q)||(c.platform||"").toLowerCase().includes(q)||mine().some(t=>t.clientId===c.id&&matchesQ(t)));
  if(!S.loaded){el.append(h("div",{class:"empty"},h("b",null,"Loading clients…"),"Your client list appears here."));return}
  if(!S.clients.length){el.append(h("div",{class:"empty"},h("b",null,"No clients yet"),"Use “Add client” to create the first card."));return}
  if(!list.length){el.append(h("div",{class:"empty"},"No clients match “"+S.q+"”."));return}
  for(const c of list){
    const open=mine().filter(t=>t.clientId===c.id&&!t.done).length;
    el.append(h("button",{class:"client",type:"button","aria-pressed":String(S.client===c.id),onclick:()=>{S.client=S.client===c.id?null:c.id;syncUploadClient();renderAll()}},
      logoEl(c),h("span",{class:"body"},h("div",{class:"cn"},c.name),h("div",{class:"meta"},h("span",{class:"plat"},c.platform||"Other"),h("span",{class:"tcount"},open?open+" open":"No open tasks")))));
  }
}

/* ---------- filters ---------- */
function renderFilters(){
  const el=$("filters");el.replaceChildren();
  const chip=(label,clear)=>h("span",{class:"chip"},label,h("button",{type:"button","aria-label":"Remove filter "+label,onclick:clear},"✕"));
  if(S.client){const c=clientById(S.client);if(c)el.append(chip(c.name,()=>{S.client=null;syncUploadClient();renderAll()}))}
  if(S.q)el.append(chip("“"+S.q+"”",()=>{$("q").value="";S.q="";$("q-clear").hidden=true;renderAll()}));
  if(!el.childNodes.length)el.append(h("span",{class:"chip plain"},"All of "+ME.name+"'s tasks · pick a client to filter"));
}

/* ---------- multi-select ---------- */
function renderSelectBar(){
  const bar=$("selbar");$("select-btn").textContent=S.selecting?"Done selecting":"Select";
  $("select-btn").setAttribute("aria-pressed",String(S.selecting));
  if(!S.selecting){bar.hidden=true;bar.replaceChildren();return}
  const vis=visibleTasks();
  for(const id of [...S.sel])if(!vis.some(t=>t.id===id))S.sel.delete(id);
  const n=S.sel.size,allOn=vis.length>0&&vis.every(t=>S.sel.has(t.id));
  const del=h("button",{class:"btn sm danger",type:"button",disabled:!n,onclick:e=>{const b=e.currentTarget;if(b.dataset.armed){bulkDelete();return}b.dataset.armed="1";b.textContent="Click again to delete "+n;setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent="Delete"}},3500)}},"Delete");
  bar.replaceChildren(
    h("label",{class:"selall"},h("input",{type:"checkbox",id:"sel-all",checked:allOn,onchange:e=>{vis.forEach(t=>e.target.checked?S.sel.add(t.id):S.sel.delete(t.id));renderGroups();renderSelectBar()}}),"Select all ("+vis.length+")"),
    h("span",{class:"selcount"},n+" selected"),
    h("span",{class:"selact"},
      h("button",{class:"btn sm",type:"button",disabled:!n,onclick:()=>bulkDone(true)},"Mark done"),
      h("button",{class:"btn sm",type:"button",disabled:!n,onclick:()=>bulkDone(false)},"Mark not done"),
      del));
  bar.hidden=false;
}
function toggleSel(id,on){on?S.sel.add(id):S.sel.delete(id);renderSelectBar();const row=document.querySelector('[data-id="'+id+'"]');if(row)row.classList.toggle("picked",on)}
$("select-btn").onclick=()=>{S.selecting=!S.selecting;S.sel.clear();S.editing=null;renderGroups();renderSelectBar();if(!S.selecting)refresh()};
async function bulkDelete(){
  const ids=[...S.sel];if(!ids.length)return;
  try{await mutate(()=>api("/api/tasks",{action:"deleteMany",ids}));S.tasks=S.tasks.filter(t=>!S.sel.has(t.id));S.sel.clear();renderAll();toast(ids.length+" task"+(ids.length===1?"":"s")+" deleted")}
  catch(e){toast(e.message)}
}
async function bulkDone(done){
  const ids=[...S.sel];if(!ids.length)return;
  try{const r=await mutate(()=>api("/api/tasks",{action:"updateMany",ids,patch:{done}}));const by=new Map(r.tasks.map(t=>[t.id,t]));S.tasks=S.tasks.map(t=>by.get(t.id)||t);S.sel.clear();renderAll();toast(ids.length+" marked "+(done?"done":"not done"))}
  catch(e){toast(e.message)}
}

/* ---------- task groups ---------- */
function taskMeta(t){
  const bits=[];const c=clientById(t.clientId);
  if(c&&!S.client)bits.push(h("span",null,c.name));
  if(isDate(t.start)||isDate(t.end)){
    const late=!t.done&&isDate(t.end)&&t.end<today();
    bits.push(h("span",{class:late?"late":null},(isDate(t.start)?fmtDate(t.start):"")+(isDate(t.start)&&isDate(t.end)?" → ":"")+(isDate(t.end)?(isDate(t.start)?"":"Due ")+fmtDate(t.end):"")+(late?" · overdue":"")));
  }
  if(t.note)bits.push(h("span",null,t.note));
  if(t.source&&/^https:\/\//.test(t.source))bits.push(h("a",{href:t.source,target:"_blank",rel:"noopener"},"From "+(t.sourceName||"PDF")));
  return bits.length?h("div",{class:"tm"},bits):null;
}
function renderGroups(){
  const el=$("groups");el.replaceChildren();
  if(!S.loaded){el.append(h("div",{class:"empty"},h("b",null,"Loading tasks…"),"Tasks appear here grouped by priority."));return}
  const vis=visibleTasks();
  if(!mine().length&&!S.q&&!S.client)el.append(h("div",{class:"empty"},h("b",null,"No tasks on "+ME.name+"'s board yet"),"Use “+ Add task” or drop an SOP PDF above."));
  for(const p of PRI){
    const items=vis.filter(t=>validPri(t.priority)===p.id).sort((a,b)=>(a.done-b.done)||((a.end||"9999").localeCompare(b.end||"9999"))||((a.createdAt||0)-(b.createdAt||0)));
    const done=items.filter(t=>t.done).length,pct=items.length?done/items.length*100:0;
    const isOpen=S.open[p.id]||!!S.q;
    const body=h("div",{class:"g-body",id:"g-"+p.id,hidden:!isOpen});
    if(!items.length)body.append(h("div",{class:"g-empty"},"Nothing here"+(S.client||S.q?" for this filter.":" yet.")));
    else if(S.selecting){
      const all=items.every(t=>S.sel.has(t.id));
      body.append(h("button",{class:"btn sm ghost selgroup",type:"button",onclick:()=>{items.forEach(t=>all?S.sel.delete(t.id):S.sel.add(t.id));renderGroups();renderSelectBar()}},all?"Unselect all "+items.length+" in "+p.name.replace(" Priority",""):"Select all "+items.length+" in "+p.name.replace(" Priority","")));
    }
    for(const t of items){
      let row;
      if(S.selecting){
        const picked=S.sel.has(t.id);
        row=h("div",{class:"task selectable"+(t.done?" done":"")+(picked?" picked":""),"data-id":t.id},
          h("input",{type:"checkbox",class:"pick",id:"sel-"+t.id,checked:picked,"aria-label":"Select: "+t.title,onchange:e=>toggleSel(t.id,e.target.checked)}),
          h("label",{for:"sel-"+t.id},h("div",{class:"tt"},t.title),taskMeta(t)),h("span"));
      }else{
        row=h("div",{class:"task"+(t.done?" done":""),"data-id":t.id},
          h("input",{type:"checkbox",id:"cb-"+t.id,checked:t.done,"aria-label":"Mark done: "+t.title,onchange:e=>saveTask(t.id,{done:e.target.checked})}),
          h("label",{for:"cb-"+t.id},h("div",{class:"tt"},t.title),taskMeta(t)),
          h("button",{class:"edit",type:"button","aria-label":"Edit "+t.title,onclick:()=>{S.editing=S.editing===t.id?null:t.id;renderGroups()}},"Edit"));
        if(S.editing===t.id)row.append(editForm(t));
      }
      body.append(row);
    }
    el.append(h("section",{class:"group "+p.id},
      h("button",{class:"g-head",type:"button","aria-expanded":String(isOpen),"aria-controls":"g-"+p.id,onclick:()=>{S.open[p.id]=!S.open[p.id];renderGroups()}},
        h("span",{class:"dot","aria-hidden":"true"}),h("span",{class:"gt"},p.name),
        h("span",{class:"gp"},items.length?done+"/"+items.length+" done":"0 tasks"),
        h("span",{class:"mini","aria-hidden":"true"},h("i",{style:"width:"+pct+"%"})),
        h("span",{class:"tog","aria-hidden":"true"},isOpen?"−":"+")),body));
  }
}
function selectOpts(sel,opts,val){for(const[v,l]of opts)sel.append(h("option",{value:v,selected:v===val},l));return sel}
const clientOpts=()=>[["","No client"],...S.clients.map(c=>[c.id,c.name])];
const priOpts=PRI.map(p=>[p.id,p.name.replace(" Priority","")]);
function editForm(t){
  const f=h("form",{class:"task-form",onsubmit:async e=>{e.preventDefault();const g=n=>f.querySelector("[name="+n+"]").value;
    await saveTask(t.id,{title:g("title").trim()||t.title,priority:g("priority"),clientId:g("clientId"),start:g("start")||null,end:g("end")||null,note:g("note").trim()});S.editing=null;renderGroups()}},
    h("label",{class:"sr",for:"e-title-"+t.id},"Task"),h("input",{class:"field",name:"title",id:"e-title-"+t.id,value:t.title,maxlength:"200"}),
    h("div",{class:"row"},selectOpts(h("select",{class:"field",name:"priority","aria-label":"Priority"}),priOpts,validPri(t.priority)),selectOpts(h("select",{class:"field",name:"clientId","aria-label":"Client"}),clientOpts(),t.clientId||"")),
    h("div",{class:"row"},h("input",{class:"field",type:"date",name:"start","aria-label":"Start date",value:t.start||""}),h("input",{class:"field",type:"date",name:"end","aria-label":"End date",value:t.end||""})),
    h("input",{class:"field",name:"note","aria-label":"Note",placeholder:"Note (optional)",value:t.note||"",maxlength:"300"}),
    h("div",{class:"row",style:"justify-content:space-between"},
      h("button",{class:"btn sm danger",type:"button",style:"flex:0 0 auto",onclick:e=>confirmDelete(e.currentTarget,t)},"Delete task"),
      h("span",{style:"flex:0 0 auto;display:flex;gap:8px"},h("button",{class:"btn sm ghost",type:"button",onclick:()=>{S.editing=null;renderGroups()}},"Cancel"),h("button",{class:"btn sm primary",type:"submit"},"Save"))));
  return f;
}
function confirmDelete(btn,t){if(btn.dataset.armed){removeTask(t.id);return}btn.dataset.armed="1";btn.textContent="Click again to delete";setTimeout(()=>{if(btn.isConnected){delete btn.dataset.armed;btn.textContent="Delete task"}},3000)}

function renderAll(){renderTeam();renderClients();renderFilters();renderGroups();renderSelectBar()}

/* ---------- writes ---------- */
async function saveTask(id,patch){
  const i=S.tasks.findIndex(t=>t.id===id);const before=S.tasks[i];
  if(i>=0){S.tasks[i]={...before,...patch};renderAll()}
  try{const {task}=await mutate(()=>api("/api/tasks",{action:"update",id,patch}));const j=S.tasks.findIndex(t=>t.id===id);if(j>=0)S.tasks[j]=task;renderAll()}
  catch(e){if(i>=0&&before){const j=S.tasks.findIndex(t=>t.id===id);if(j>=0)S.tasks[j]=before}toast(e.message);renderAll()}
}
async function removeTask(id){
  try{await mutate(()=>api("/api/tasks",{action:"delete",id}));S.tasks=S.tasks.filter(t=>t.id!==id);S.editing=null;renderAll();toast("Task deleted")}catch(e){toast(e.message)}
}

/* ---------- manual add task ---------- */
$("add-task-btn").onclick=()=>{const f=$("task-form");if(!f.hidden){f.hidden=true;return}
  f.replaceChildren(h("label",{for:"nt-title"},"New task for "+ME.name,h("input",{class:"field",id:"nt-title",name:"title",required:true,maxlength:"200",placeholder:BOARD==="jap"?"e.g. Run keyword research for service pages":"e.g. Update hero section on homepage"})),
    h("div",{class:"row"},h("label",null,"Priority",selectOpts(h("select",{class:"field",name:"priority"}),priOpts,"medium")),h("label",null,"Client",selectOpts(h("select",{class:"field",name:"clientId"}),clientOpts(),S.client||""))),
    h("div",{class:"row"},h("label",null,"Start date",h("input",{class:"field",type:"date",name:"start"})),h("label",null,"End date",h("input",{class:"field",type:"date",name:"end"}))),
    h("label",null,"Note (optional)",h("input",{class:"field",name:"note",maxlength:"300"})),
    h("div",{class:"actions"},h("button",{class:"btn ghost",type:"button",onclick:()=>{f.hidden=true}},"Cancel"),h("button",{class:"btn primary",type:"submit"},"Add task")));
  f.hidden=false;$("nt-title").focus()};
$("task-form").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;const g=n=>f.querySelector("[name="+n+"]").value;
  const t={title:g("title").trim(),priority:g("priority"),clientId:g("clientId"),start:g("start")||null,end:g("end")||null,note:g("note").trim(),board:BOARD,assignee:BOARD};
  if(!t.title)return;
  try{const {tasks}=await mutate(()=>api("/api/tasks",{action:"create",task:t}));S.tasks.push(...tasks);f.hidden=true;S.open[t.priority]=true;renderAll();toast("Task added")}catch(err){toast(err.message)}};

/* ---------- search ---------- */
$("q").addEventListener("input",e=>{S.q=e.target.value.trim();$("q-clear").hidden=!S.q;renderAll()});
$("q-clear").onclick=()=>{$("q").value="";S.q="";$("q-clear").hidden=true;renderAll();$("q").focus()};

/* ---------- add client ---------- */
$("add-client-btn").onclick=()=>{const f=$("client-form");f.hidden=!f.hidden;if(!f.hidden)$("cf-name").focus()};
$("cf-cancel").onclick=()=>{$("client-form").hidden=true;$("client-form").reset()};
$("client-form").onsubmit=async e=>{e.preventDefault();
  const name=$("cf-name").value.trim();if(!name)return;const btn=$("cf-save");btn.disabled=true;btn.textContent="Saving…";
  let logo=null;const file=$("cf-logo").files[0];
  try{
    if(file){try{logo=await uploadFile(file)}catch(err){toast(err.message+" Saved without a logo.")}}
    const {client}=await mutate(()=>api("/api/clients",{action:"create",client:{name,platform:$("cf-plat").value,logo}}));
    S.clients.push(client);$("client-form").reset();$("client-form").hidden=true;syncUploadClient();renderAll();toast(name+" added");
  }catch(err){toast(err.message)}finally{btn.disabled=false;btn.textContent="Save client"}};

/* ---------- upload client select ---------- */
function syncUploadClient(){const sel=$("up-client");const cur=S.client||sel.value||"";sel.replaceChildren();selectOpts(sel,clientOpts(),S.client||cur)}
function updateDropText(){const s=$("drop-sub");if(s)s.textContent=S.ai?"Claude reads it and sorts each task into Critical, High, Medium or Low on "+ME.name+"'s board. You review before anything is saved.":"Tasks are sorted into Critical, High, Medium or Low automatically from the PDF's headings, labels, due dates and keywords, and added to "+ME.name+"'s board. Check them, then save."}

/* ---------- PDF intake ---------- */
const drop=$("drop"),pdfInput=$("pdf-input");
$("pick-pdf").onclick=()=>pdfInput.click();
pdfInput.onchange=()=>{const f=pdfInput.files[0];pdfInput.value="";if(f)handlePdf(f)};
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("over")}));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("over")}));
drop.addEventListener("drop",e=>{const f=[...(e.dataTransfer?.files||[])].find(f=>f.type==="application/pdf"||/\.pdf$/i.test(f.name));if(f)handlePdf(f);else toast("Drop a PDF file.")});

async function pdfText(file){const lib=window.pdfjsLib;if(!lib)throw new Error("PDF reader didn't load");
  lib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;let out="";
  for(let i=1;i<=doc.numPages&&out.length<90000;i++){const p=await doc.getPage(i);const c=await p.getTextContent();let line="",lastY=null;
    for(const it of c.items){const y=it.transform?it.transform[5]:null;if(lastY!==null&&y!==null&&Math.abs(y-lastY)>2){out+=line.trim()+"\n";line=""}line+=it.str+(it.hasEOL?"\n":" ");lastY=y}
    out+=line.trim()+"\n\n"}
  return out.replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim()}

function setReview(node){const r=$("review");r.replaceChildren();if(node){r.append(node);r.hidden=false}else r.hidden=true}
let runId=0;
async function handlePdf(file){
  const my=++runId;const live=()=>my===runId;
  const clientId=$("up-client").value,cName=(clientById(clientId)||{}).name||"";
  const status=h("div",{class:"thinking"},h("span",{class:"spin","aria-hidden":"true"}),h("span",{id:"rv-step"},"Reading "+file.name+"…"),h("button",{class:"btn sm ghost",type:"button",onclick:()=>{runId++;setReview(null)}},"Stop"));
  setReview(h("div",null,h("h3",null,"Sorting "+file.name),status));
  const step=t=>{const s=document.getElementById("rv-step");if(s)s.textContent=t};
  let text="";
  try{text=await pdfText(file)}catch(e){if(live())setReview(h("div",null,h("h3",null,"Couldn't read that PDF"),h("p",{class:"sub"},"The PDF reader didn't load or the file is damaged. Check your connection and try again."),h("button",{class:"btn sm",type:"button",onclick:()=>setReview(null)},"Close")));return}
  if(!live())return;
  if(text.replace(/\s/g,"").length<20){setReview(h("div",null,h("h3",null,"No text found in "+file.name),h("p",{class:"sub"},"This looks like a scanned or image-only PDF. Export the SOP from Google Docs or Word as a PDF and try again."),h("button",{class:"btn sm",type:"button",onclick:()=>setReview(null)},"Close")));return}
  step("Saving the PDF…");
  let source=null;try{source=await uploadFile(file,"application/pdf")}catch(e){toast("PDF not stored ("+e.message+") — tasks will still be added.")}
  if(!live())return;
  let items=null,ai=false;
  if(S.ai){
    step("Claude is sorting tasks by priority… this can take up to a minute.");
    try{const r=await api("/api/sort",{text:text.slice(0,80000),fileName:file.name,clientName:cName,today:today()});items=r.tasks;ai=true}
    catch(e){toast(e.message+" Used the built-in sorting instead.")}
  }
  if(!live())return;
  if(!items||!items.length){ai=false;items=window.sortSop?window.sortSop(text,today()):[]}
  S.review={file:file.name,source,clientId,items,ai};
  showReview();
}
function showReview(){
  const R=S.review;if(!R){setReview(null);return}
  const list=h("div",{class:"rv-list"});
  R.items.forEach((it,i)=>{
    const sel=selectOpts(h("select",{"data-p":it.priority,"aria-label":"Priority for "+it.title,onchange:e=>{it.priority=e.target.value;e.target.dataset.p=it.priority}}),priOpts,it.priority);
    list.append(h("div",{class:"rv"},sel,
      h("input",{class:"field",value:it.title,"aria-label":"Task title",maxlength:"200",oninput:e=>{it.title=e.target.value}}),
      h("button",{class:"btn sm ghost",type:"button","aria-label":"Remove "+it.title,onclick:()=>{R.items.splice(i,1);showReview()}},"✕"),
      it.why?h("div",{class:"why"},"Why: "+it.why):null,
      h("div",{class:"dates"},h("input",{class:"field",type:"date",value:it.start||"","aria-label":"Start date",onchange:e=>{it.start=e.target.value||null}}),h("input",{class:"field",type:"date",value:it.end||"","aria-label":"End date",onchange:e=>{it.end=e.target.value||null}}))));
  });
  const counts=PRI.map(p=>R.items.filter(x=>x.priority===p.id).length);
  const cName=(clientById(R.clientId)||{}).name;
  const save=h("button",{class:"btn primary",type:"button",disabled:!R.items.length,onclick:async e=>{
    const b=e.currentTarget;b.disabled=true;b.textContent="Saving…";
    const tasks=R.items.filter(it=>it.title.trim()).map(it=>({title:it.title.trim(),priority:it.priority,board:BOARD,assignee:BOARD,clientId:R.clientId,start:it.start,end:it.end,note:it.note||"",source:R.source,sourceName:R.file}));
    try{const r=await mutate(()=>api("/api/tasks",{action:"createMany",tasks}));S.tasks.push(...r.tasks);
      toast(r.tasks.length+" tasks added from "+R.file);PRI.forEach(p=>{if(tasks.some(x=>x.priority===p.id))S.open[p.id]=true});S.review=null;setReview(null);renderAll();
    }catch(err){toast(err.message);b.disabled=false;b.textContent="Add tasks"}}},"Add "+R.items.length+" tasks");
  setReview(h("div",null,
    h("h3",null,"Review tasks from "+R.file),
    h("p",{class:"sub"},(R.ai?"Claude sorted these into priorities. ":"Sorted automatically from the PDF's priority headings, labels, due dates and keywords. ")+"Change a priority, edit a title or remove a row, then add them to "+ME.name+"'s board."+(cName?" Client: "+cName+".":"")),
    h("div",{class:"filters",style:"margin:0 0 12px"},PRI.map((p,i)=>h("span",{class:"chip plain"},p.name.replace(" Priority","")+": "+counts[i]))),
    list,
    h("div",{class:"row",style:"justify-content:flex-end;margin-top:12px"},h("button",{class:"btn ghost",type:"button",style:"flex:0 0 auto",onclick:()=>{S.review=null;setReview(null)}},"Discard"),h("span",{style:"flex:0 0 auto"},save))));
}

/* ---------- boot: load now, then check for changes every 15 s ---------- */
renderAll();syncUploadClient();updateDropText();refresh();
setInterval(refresh,15000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
})();
