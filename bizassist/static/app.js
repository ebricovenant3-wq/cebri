const conversations = [
  {name:'Maya Chen', initials:'MC', message:'Hi! I’m interested in getting a quote for the 3 bedroom windows.', time:'2 min ago', tag:'New lead', unread:true, tone:1},
  {name:'Noah Williams', initials:'NW', message:'Thanks for the update! Could we schedule delivery for Friday?', time:'18 min ago', tag:'Order #1048', unread:true, tone:2},
  {name:'Sofia Martinez', initials:'SM', message:'The team was so helpful. Everything looks great 😊', time:'42 min ago', tag:'Customer', unread:false, tone:3},
  {name:'Ethan Parker', initials:'EP', message:'Got it, I’ll send over the details this afternoon.', time:'1 hr ago', tag:'Follow-up', unread:true, tone:4}
];
let tasks = [
  {title:'Follow up with Maya about her quote', detail:'Assigned to you · New lead', due:'10:30 AM', urgent:true, done:false},
  {title:'Confirm delivery window with Noah', detail:'Assigned to Morgan · Order #1048', due:'11:00 AM', urgent:false, done:false},
  {title:'Send invoice to Olivia Bennett', detail:'Assigned to you · Order #1042', due:'1:00 PM', urgent:false, done:false},
  {title:'Check in with Liam after delivery', detail:'Assigned to Taylor · Follow-up', due:'3:30 PM', urgent:false, done:false},
  {title:'Review new product enquiry', detail:'Assigned to you · Website lead', due:'Yesterday', urgent:true, done:true},
  {title:'Share care instructions with Sofia', detail:'Assigned to Morgan · Customer care', due:'Yesterday', urgent:false, done:true}
];
const root = document.querySelector('#viewRoot');
const overviewMarkup = root.innerHTML;
const toast = (message) => { const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2300); };
function renderConversations(container, full=false){
  container.innerHTML=conversations.map(c=>`<button class="conversation" data-person="${c.name}"><span class="contact-avatar tone-${c.tone}">${c.initials}</span><span class="conversation-copy"><span class="conversation-name"><strong>${c.name}</strong>${c.unread?'<i class="unread-dot"></i>':''}</span><p>${c.message}</p></span><span class="conversation-meta"><time>${c.time}</time><small class="${c.tag==='New lead'?'lead-tag':''}">${c.tag}</small></span></button>`).join('');
  if(full) container.querySelectorAll('.conversation').forEach(btn=>btn.addEventListener('click',()=>toast(`Conversation with ${btn.dataset.person} selected`)));
}
function renderTasks(container, all=false){
  const visible=all?tasks:tasks.slice(0,4);
  container.innerHTML=visible.map((t,i)=>`<div class="task-row ${t.done?'task-done':''}"><input class="task-check" type="checkbox" aria-label="Mark ${t.title} complete" data-task="${tasks.indexOf(t)}" ${t.done?'checked':''}><span><strong>${t.title}</strong><small>${t.detail}</small></span><time class="task-due ${t.urgent&&!t.done?'urgent':''}">${t.due}</time></div>`).join('');
  container.querySelectorAll('.task-check').forEach(input=>input.addEventListener('change',()=>{tasks[Number(input.dataset.task)].done=input.checked;refreshTasks();toast(input.checked?'Task marked complete':'Task reopened');}));
}
function refreshTasks(){renderTasks(document.querySelector('#dashboardTasks'));document.querySelector('#navTasks').textContent=tasks.filter(t=>!t.done).length;const due=document.querySelector('#dueCount');if(due)due.innerHTML=`${tasks.filter(t=>!t.done).length} <span class="trend neutral">${tasks.filter(t=>t.done).length} completed</span>`;}
renderConversations(document.querySelector('#recentConversations'));
renderTasks(document.querySelector('#dashboardTasks'));
function showView(view){
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const labels={overview:'Overview',inbox:'Inbox',tasks:'Tasks',automations:'Automations',contacts:'Contacts',settings:'Settings'};
  document.querySelector('#crumb').textContent=labels[view];
  if(view==='overview'){root.innerHTML=overviewMarkup;renderConversations(document.querySelector('#recentConversations'));renderTasks(document.querySelector('#dashboardTasks'));document.querySelector('#newTask').addEventListener('click',openTaskDialog);document.querySelector('#newTaskSmall').addEventListener('click',openTaskDialog);bindViewButtons();return;}
  const intro={inbox:['Your inbox','All your customer conversations, in one place.'],tasks:['Your tasks','Follow-ups and reminders for the team.'],automations:['Automations','Set up helpful replies for everyday conversations.'],contacts:['Contacts','Keep customer details and conversation history together.'],settings:['Workspace settings','Manage your business workspace and WhatsApp connection.']}[view];
  root.innerHTML=`<div class="welcome-row"><div><p class="eyebrow">BIZASSIST WORKSPACE</p><h1>${intro[0]}</h1><p class="subheading">${intro[1]}</p></div>${view==='tasks'?'<button class="button primary-button" id="newTask"><span>＋</span> Create a task</button>':''}</div><section class="panel alternate-panel" id="alternateContent"></section>`;
  const box=document.querySelector('#alternateContent');
  if(view==='inbox'){box.innerHTML='<div class="panel-heading"><div><h2>All conversations</h2><p>Recent WhatsApp messages from your customers.</p></div></div><div class="conversation-list" id="allConversations"></div>';renderConversations(document.querySelector('#allConversations'),true);}
  if(view==='tasks'){box.innerHTML='<div class="panel-heading"><div><h2>Team task list</h2><p>Check off tasks as your team completes them.</p></div></div><div class="task-list" id="allTasks"></div>';renderTasks(document.querySelector('#allTasks'),true);document.querySelector('#newTask').addEventListener('click',openTaskDialog);}
  if(view==='automations'){box.innerHTML='<div class="panel-heading"><div><h2>Your message automations</h2><p>Toggle an automation on or off for your business.</p></div></div><div class="automation-cards" id="allAutomations"></div>';const cards=[['☼','Welcome new customers','Greet customers when they message for the first time.',true],['↻','Follow up on quotes','Check in if a quote hasn’t received a reply.',true],['◷','After-hours reply','Set expectations when your team is offline.',false]];document.querySelector('#allAutomations').innerHTML=cards.map(a=>`<article class="automation-card"><span class="automation-icon">${a[0]}</span><div><strong>${a[1]}</strong><small>${a[2]}</small><span class="automation-meta"><i class="online-dot"></i> ${a[3]?'Active':'Paused'} <b>·</b> Sample automation</span></div><label class="switch"><input type="checkbox" ${a[3]?'checked':''} aria-label="Toggle ${a[1]}"><span></span></label></article>`).join('');document.querySelectorAll('.switch input').forEach(i=>i.addEventListener('change',()=>{const state=i.checked?'on':'paused';i.closest('.automation-card').querySelector('.automation-meta').innerHTML=`<i class="online-dot"></i> ${state==='on'?'Active':'Paused'} <b>·</b> Sample automation`;toast(`Automation ${state}`)}));}
  if(view==='contacts'){box.innerHTML='<div class="panel-heading"><div><h2>Recent customers</h2><p>Customers who recently messaged your business.</p></div></div><div class="conversation-list" id="allContacts"></div>';renderConversations(document.querySelector('#allContacts'),true);}
  if(view==='settings'){box.innerHTML='<div class="panel-heading"><div><h2>WhatsApp Business</h2><p>Connection details for this workspace.</p></div></div><div class="settings-row"><span class="online-dot"></span><div><strong>WhatsApp connection</strong><small>+1 (415) 555-0198 · Sample workspace</small></div><span class="settings-badge">Connected</span></div><div class="settings-row"><span class="settings-symbol">◷</span><div><strong>Business hours</strong><small>Monday–Friday, 9:00 AM–5:00 PM</small></div><button class="link-button" data-action="hours">Edit</button></div><div class="settings-row"><span class="settings-symbol">♙</span><div><strong>Team members</strong><small>3 people have access to this workspace</small></div><button class="link-button" data-action="team">Manage</button></div>';box.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>toast(`${b.dataset.action==='hours'?'Business hours':'Team settings'} are ready to configure`)));}
  document.querySelector('#sidebar').classList.remove('open');bindViewButtons();
}
function bindViewButtons(){document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.go)));}
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
bindViewButtons();
const dialog=document.querySelector('#taskDialog');
function openTaskDialog(){const date=new Date();document.querySelector('[name="date"]').value=date.toISOString().slice(0,10);dialog.showModal();}
document.querySelector('#newTask').addEventListener('click',openTaskDialog);
document.querySelector('#newTaskSmall').addEventListener('click',openTaskDialog);
document.querySelector('#taskForm').addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const data=new FormData(e.currentTarget);const dueDate=new Date(`${data.get('date')}T12:00:00`);tasks.unshift({title:data.get('title').trim(),detail:`Assigned to ${data.get('assignee')} · Created just now`,due:dueDate.toLocaleDateString(undefined,{month:'short',day:'numeric'}),urgent:false,done:false});dialog.close();e.currentTarget.reset();refreshTasks();if(document.querySelector('#allTasks'))renderTasks(document.querySelector('#allTasks'),true);toast('Task created');});
document.querySelector('#menuButton').addEventListener('click',()=>document.querySelector('#sidebar').classList.toggle('open'));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('#sidebar').classList.remove('open')});
const now=new Date();document.querySelector('#today').textContent=now.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
