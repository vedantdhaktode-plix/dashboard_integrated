(function (root) {
  'use strict';
  const roles = ['Admin', 'Social', 'Brand', 'Video', 'Performance'];
  const actors = { Admin: 'Vedant', Social: 'Krina', Brand: 'Brand reviewer', Video: 'Viraj', Performance: 'Performance team' };
  const labels = { draft: 'Script draft', script_review: 'Script review', script_changes: 'Script changes', production: 'In production', video_review: 'Video review', video_changes: 'Video changes', approved: 'Final approved', in_use: 'In use', archived: 'Archived' };
  const active = t => !['archived','in_use','approved'].includes(t.status);
  const currentAsset = t => t.assets.find(a => a.version === t.currentVersion);
  const unresolved = t => t.comments.filter(c => c.blocking && !c.resolved);
  const eligible = t => ['approved','in_use'].includes(t.status) && !!currentAsset(t) && ['Brand','Social'].every(role => t.approvals[role]?.version === t.currentVersion) && !unresolved(t).length;
  const clone = x => JSON.parse(JSON.stringify(x));
  const istDate = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
  function seed(now = Date.now()) {
    const at = mins => new Date(now - mins * 60000).toISOString();
    const due = mins => new Date(now + mins * 60000).toISOString();
    const script = product => `HOOK · 0–3 seconds\nOpen with a relatable customer concern and a close-up of ${product}.\n\nSTORY · 3–15 seconds\nShow the product texture and application in natural light. Keep the product label clear. Use the approved product talking points.\n\nPAYOFF · 15–25 seconds\nShow the finished routine. Avoid unsupported outcome claims.\n\nCTA · 25–30 seconds\nProduct close-up with “Find your everyday routine.”`;
    const raw = [
      ['PLX-021','Before / after: a stronger hair story','Rosemary Serum','Hair','AI Hook','P0','video_review',120,'Viraj'],
      ['PLX-022','A little cloud in your skincare routine','Rose PDRN Whipped Cleanser','Joyun','Music','P0','script_review',210,'Aman'],
      ['PLX-023','Your everyday hydration companion','Hydration Boost','Nutra','UGC','P1','production',300,'Hannan'],
      ['PLX-024','The 30-second rosemary routine','Rosemary Serum','Hair','Shorter Cut','P0','video_changes',-35,'Dhiraj'],
      ['PLX-025','Meet the bouncy boba texture','Rose PDRN Boba Cream','Joyun','AI Female','P1','video_review',240,'Pranav'],
      ['PLX-026','A fresh take on your morning cleanse','Pineapple Facewash','Skin','UGC','P2','draft',1440,'Aman'],
      ['PLX-027','Plant protein, a simpler story','Plant Protein','Nutra','UGC','P1','script_review',180,'Yogesh'],
      ['PLX-028','The flaxseed wash-day ritual','Flaxseed Shampoo & Conditioner','Hair','Music','P1','approved',180,'Viraj'],
      ['PLX-029','Bright mornings, everyday skincare','Pineapple Bodywash','Skin','Music','P2','in_use',450,'Aman'],
      ['PLX-030','Rose essence in your daily routine','Rose Essence Serum','Joyun','AI Female','P2','production',1440,'Pranav'],
      ['PLX-031','Glowy skin, thoughtful storytelling','Glowy Tablets','Nutra','AI Avatar','P1','script_changes',360,'Hannan'],
      ['PLX-032','An older hook that did not make the cut','Rosemary Serum','Hair','Hook Change','P2','archived',-1440,'Dhiraj']
    ];
    const tasks = raw.map((r,i) => ({ id:r[0],title:r[1],product:r[2],category:r[3],type:r[4],priority:r[5],status:r[6],due:due(r[7]),videoOwner:r[8],socialOwner:i%2?'Tanmay':'Krina',destination:'Paid + Organic',createdAt:at(230+i),updatedAt:at(20+i*4),reference:'',script:script(r[2]),scriptVersion:1,scriptApproval:['draft','script_review','script_changes'].includes(r[6])?null:{by:'Brand reviewer',at:at(155),version:1},assets:[],currentVersion:0,approvals:{},comments:[],startedAt:r[6]==='production'?at(80):null,campaigns:[],blocked:i===9,blocker:i===9?'Awaiting original product application footage from Social.':'' }));
    const references = [
      { id:'REF-1',title:'Rosemary · creator-led reference',product:'Rosemary Serum',category:'Hair',platform:'Instagram',url:'https://www.instagram.com/p/DbmJ2tTsArJ/',notes:'Music cut and captions. Reference from Work Plan.',source:'Work Plan' },
      { id:'REF-2',title:'Rosemary · before / after hook',product:'Rosemary Serum',category:'Hair',platform:'Instagram',url:'https://www.instagram.com/p/DUP2p26jOyo/',notes:'Reference from Work Plan. Review the original before adapting.',source:'Work Plan' },
      { id:'REF-3',title:'Pineapple · skincare storytelling',product:'Pineapple Facewash',category:'Skin',platform:'Instagram',url:'https://www.instagram.com/reel/DdBsAqwu3gB/',notes:'Reference from your Content Bank.',source:'Content Bank' },
      { id:'REF-4',title:'Joyun · bouncy boba texture',product:'Rose PDRN Boba Cream',category:'Joyun',platform:'Instagram',url:'https://www.instagram.com/p/Dbvji01goyB/',notes:'Texture-led concept from Joyun Work Plan.',source:'Joyun Work Plan' }
    ];
    tasks[0].reference=references[1].url;tasks[1].reference=references[3].url;tasks[5].reference=references[2].url;
    tasks.filter(t => ['video_review','video_changes','approved','in_use','archived'].includes(t.status)).forEach(t => {
      t.currentVersion=t.id==='PLX-021'?3:t.id==='PLX-024'?2:1;
      for(let v=1;v<=t.currentVersion;v++) t.assets.push({version:v,name:`${t.product.replace(/[^a-z0-9]+/gi,'_')}_v${v}.mp4`,kind:'demo',url:'',at:at(75-v*5),by:t.videoOwner,superseded:v!==t.currentVersion});
    });
    tasks[0].approvals.Social={version:3,by:'Krina',at:at(19)};
    const correction={id:'C-1',by:'Brand reviewer',role:'Brand',at:at(40),text:'Please keep the product label visible throughout the opening shot. The current crop cuts it off.',blocking:true,version:2,addressed:false,resolved:false};
    tasks[3].comments.push(correction);
    tasks[4].comments.push({id:'C-2',by:'Krina',role:'Social',at:at(27),text:'Love the texture-led opening. Keep captions inside the safe area.',blocking:false,version:1,addressed:false,resolved:false});
    tasks[10].comments.push({id:'C-3',by:'Brand reviewer',role:'Brand',at:at(35),text:'Rewrite the hook using only approved product claims.',blocking:true,version:'script-1',addressed:false,resolved:false});
    [tasks[7],tasks[8]].forEach(t => { t.approvals={Brand:{version:1,by:'Brand reviewer',at:at(70)},Social:{version:1,by:'Krina',at:at(50)}};t.approvedAt=at(50); });
    tasks[8].campaigns=[{name:'Pineapple · October creative test',platform:'Meta Ads',url:'',at:at(30),spend:0,roas:null}];
    const ev = (id,mins,task,role,action,detail,kind='update') => ({id,at:at(mins),taskId:task?.id||'',taskTitle:task?.title||'Studio',version:task?.currentVersion||'script-1',actor:actors[role],role,action,detail,kind,demo:true});
    const events=[
      ev('EV-1',20,tasks[0],'Video','Uploaded video v3','New version sent to Brand and Social for review.','upload'),
      ev('EV-2',19,tasks[0],'Social','Approved video v3','Brand approval still pending.','approval'),
      ev('EV-3',30,tasks[8],'Performance','Recorded campaign usage','Pineapple · October creative test','handoff'),
      ev('EV-4',35,tasks[10],'Brand','Requested script changes','Rewrite the hook using approved claims.','comment'),
      ev('EV-5',40,tasks[3],'Brand','Requested video changes','Keep the product label visible.','comment'),
      ev('EV-6',50,tasks[7],'Social','Final approval completed','Both required teams approved asset v1.','final'),
      ev('EV-7',50,tasks[8],'Social','Final approval completed','Both required teams approved asset v1.','final'),
      ev('EV-8',64,tasks[1],'Social','Submitted script v1','Waiting for Brand review.','script'),
      ev('EV-9',80,tasks[2],'Video','Started video production','Approved script assigned to Hannan.','upload'),
      ev('EV-10',95,tasks[6],'Social','Submitted script v1','Plant protein concept ready for Brand review.','script'),
      ev('EV-11',140,tasks[11],'Brand','Archived rejected creation','Rejected concept excluded from delivery.','archive'),
      ev('EV-12',165,null,'Social','Saved content reference','Rosemary reference saved from Instagram.','reference')
    ].sort((a,b)=>new Date(b.at)-new Date(a.at));
    return {schema:3,tasks,references,events,notifications:[],settings:{p0Minutes:30,workStart:'09:00',workEnd:'18:00',digestTime:'18:00'},seededAt:new Date(now).toISOString()};
  }
  function perform(state, action, id, role, data={}, now=Date.now()) {
    if(!roles.includes(role))throw Error('Choose a valid workspace.');
    const t=state.tasks.find(t=>t.id===id),at=new Date(now).toISOString();
    const requireRole=(...allowed)=>{if(!allowed.includes(role))throw Error(`This action belongs to ${allowed.join(' or ')}.`)};
    const requireState=(...allowed)=>{if(!t||!allowed.includes(t.status))throw Error('This task is not ready for that action.');};
    const nonempty=(value,label)=>{if(!String(value||'').trim())throw Error(`${label} is required.`);return String(value).trim()};
    const emit=(action,detail,kind='update',task=t)=>{
      const event={id:`EV-${now}-${state.events.length}`,at,taskId:task?.id||'',taskTitle:task?.title||'Studio',version:task?.currentVersion||`script-${task?.scriptVersion||1}`,actor:actors[role],role,action,detail,kind,demo:false};
      state.events.unshift(event);if(task)task.updatedAt=at;return event;
    };
    const note=(text,blocking=false,version=t?.currentVersion||`script-${t?.scriptVersion}`)=>({id:`C-${now}-${t.comments.length}`,by:actors[role],role,at,text:nonempty(text,'Feedback'),blocking,version,addressed:false,resolved:false});
    switch(action){
      case 'create':{
        requireRole('Social','Admin');const title=nonempty(data.title,'Task title'),product=nonempty(data.product,'Product');
        if(!['P0','P1','P2'].includes(data.priority))throw Error('Choose P0, P1 or P2.');
        if(!data.due||!Number.isFinite(new Date(data.due).getTime()))throw Error('Set a valid due date and time.');
        if(data.reference&&!/^https?:\/\//i.test(data.reference))throw Error('Reference links must start with https:// or http://.');
        const next=Math.max(32,...state.tasks.map(t=>Number(t.id.split('-')[1])||0))+1;
        const task={id:`PLX-${String(next).padStart(3,'0')}`,title,product,category:data.category||'Hair',type:data.type||'UGC',priority:data.priority,status:'draft',due:data.due,videoOwner:data.videoOwner||'Viraj',socialOwner:actors.Social,destination:data.destination||'Paid + Organic',createdAt:at,updatedAt:at,reference:data.reference||'',script:data.script||'',scriptVersion:1,scriptApproval:null,assets:[],currentVersion:0,approvals:{},comments:[],campaigns:[],blocked:false,blocker:''};
        state.tasks.unshift(task);emit('Created content task',`${task.product} · ${task.priority} · Social owns the script.`,'script',task);return task;
      }
      case 'saveScript':requireRole('Social');requireState('draft','script_changes');t.script=nonempty(data.script,'Script');emit('Saved script draft',`Script v${t.scriptVersion}`,'script');break;
      case 'submitScript':requireRole('Social');requireState('draft','script_changes');t.script=nonempty(data.script||t.script,'Script');if(t.blocked)throw Error('Resolve the blocker before submitting.');t.status='script_review';emit('Submitted script for approval','Brand reviewer notified in the prototype.','script');break;
      case 'approveScript':requireRole('Brand');requireState('script_review');if(t.comments.some(c=>c.blocking&&!c.resolved&&String(c.version).startsWith('script')))throw Error('Resolve the blocking script feedback first.');t.scriptApproval={by:actors[role],at,version:t.scriptVersion};t.videoOwner=data.videoOwner||t.videoOwner;t.status='production';emit('Approved script',`Assigned to ${t.videoOwner} for video creation.`,'approval');break;
      case 'scriptChanges':requireRole('Brand');requireState('script_review');t.comments.push(note(data.comment,true,`script-${t.scriptVersion}`));t.status='script_changes';t.scriptVersion++;emit('Requested script changes',data.comment,'comment');break;
      case 'startProduction':requireRole('Video');requireState('production');if(t.blocked)throw Error('Resolve the blocker before starting.');if(t.startedAt)throw Error('Production has already started.');t.startedAt=at;emit('Started video production',`Using approved script v${t.scriptVersion}.`,'upload');break;
      case 'submitVideo':{
        requireRole('Video');requireState('production','video_changes','video_review','approved','in_use');
        if(t.blocked)throw Error('Resolve the blocker before submitting.');if(!t.scriptApproval)throw Error('The script must be approved first.');
        if(!['demo','link','local'].includes(data.kind))throw Error('Choose a submission type.');
        if(data.kind==='link'&&!/^https?:\/\//i.test(data.url||''))throw Error('Add a valid video link.');
        if(data.kind==='local'&&!data.url?.startsWith('blob:'))throw Error('Choose a local video file.');
        t.assets.forEach(a=>a.superseded=true);t.currentVersion++;t.approvals={};delete t.approvedAt;t.status='video_review';
        t.assets.push({version:t.currentVersion,name:data.name||`${t.product}_v${t.currentVersion}.mp4`,kind:data.kind,url:data.url||'',at,by:actors[role],superseded:false});
        emit(`Uploaded video v${t.currentVersion}`,'Brand and Social approvals reset for the new version.','upload');break;
      }
      case 'approveVideo':{
        requireRole('Brand','Social');requireState('video_review');if(unresolved(t).length)throw Error('Resolve the blocking feedback before approving.');
        if(!currentAsset(t))throw Error('The current video version is missing.');if(t.approvals[role]?.version===t.currentVersion)throw Error(`${role} has already approved this version.`);
        t.approvals[role]={version:t.currentVersion,by:actors[role],at};emit(`Approved video v${t.currentVersion}`,`${role} approval recorded.`, 'approval');
        if(['Brand','Social'].every(r=>t.approvals[r]?.version===t.currentVersion)){t.status='approved';t.approvedAt=at;emit('Final approval completed',`Asset v${t.currentVersion} released to Performance.`,'final');}
        break;
      }
      case 'videoChanges':requireRole('Brand','Social');requireState('video_review');t.comments.push(note(data.comment,true));t.approvals={};t.status='video_changes';emit('Requested video changes',data.comment,'comment');break;
      case 'comment':if(!t||t.status==='archived')throw Error('Comments are closed for archived tasks.');if(role==='Performance'&&!eligible(t))throw Error('Performance can comment on approved content.');if(data.blocking&&!['Brand','Social'].includes(role))throw Error('Only reviewers can add blocking feedback.');t.comments.push(note(data.comment,!!data.blocking));emit('Added comment',data.comment,'comment');break;
      case 'resolveComment':{
        requireRole('Brand','Social');const comment=t.comments.find(c=>c.id===data.commentId);if(!comment)throw Error('Comment not found.');if(comment.role!==role)throw Error('The team that raised this feedback must resolve it.');if(comment.resolved)throw Error('This comment is already resolved.');comment.resolved=true;comment.resolvedAt=at;emit('Resolved review feedback',comment.text,'comment');break;
      }
      case 'addressComment':{
        requireRole('Video','Social');const comment=t.comments.find(c=>c.id===data.commentId);if(!comment)throw Error('Comment not found.');if(comment.resolved||comment.addressed)throw Error('Feedback is already addressed or resolved.');comment.addressed=true;emit('Marked feedback addressed',comment.text,'comment');break;
      }
      case 'archive':requireRole('Brand','Social');requireState('script_review','video_review','video_changes','script_changes');nonempty(data.comment,'Rejection reason');t.status='archived';t.archiveReason=data.comment;t.approvals={};emit('Archived rejected creation',data.comment,'archive');break;
      case 'use':{
        requireRole('Performance');if(!t||!eligible(t))throw Error('Only the fully approved current version can be used.');const name=nonempty(data.name,'Campaign name');if(data.url&&!/^https?:\/\//i.test(data.url))throw Error('Add a valid campaign or live link.');
        t.campaigns.push({name,platform:data.platform||'Meta Ads',url:data.url||'',at,version:t.currentVersion});t.status='in_use';emit('Recorded campaign usage',`${name} · v${t.currentVersion} · ${data.platform||'Meta Ads'}`,'handoff');break;
      }
      case 'priority':requireRole('Admin','Social','Brand');if(!t)throw Error('Task not found.');if(!['P0','P1','P2'].includes(data.priority))throw Error('Invalid priority.');t.priority=data.priority;emit('Changed priority',`Priority set to ${data.priority}.`);break;
      case 'assign':requireRole('Admin','Brand');if(!t)throw Error('Task not found.');t.videoOwner=nonempty(data.owner,'Editor');emit('Changed video owner',`Assigned to ${t.videoOwner}.`);break;
      case 'block':requireRole('Admin','Social','Brand','Video');if(!t||!active(t))throw Error('Only active tasks can be blocked.');t.blocked=true;t.blocker=nonempty(data.reason,'Blocker reason');emit('Flagged task blocker',t.blocker,'blocker');break;
      case 'unblock':requireRole('Admin','Social','Brand','Video');if(!t?.blocked)throw Error('This task has no blocker.');t.blocked=false;t.blocker='';emit('Resolved task blocker','Task can continue through its current stage.','blocker');break;
      case 'remind':{
        requireRole('Admin','Social','Brand');if(!t||!active(t))throw Error('This task does not need an active reminder.');
        const recipient=t.blocked?'Dependency owner':t.status==='script_review'?'Brand reviewer':t.status==='video_review'?['Brand','Social'].filter(r=>t.approvals[r]?.version!==t.currentVersion).join(' + '):t.status.includes('script')||t.status==='draft'?'Social team':t.videoOwner;
        if(state.notifications.some(n=>n.taskId===id&&!n.ack&&new Date(at)-new Date(n.at)<15*60000))throw Error('A recent reminder is already waiting for acknowledgement.');
        state.notifications.unshift({id:`N-${now}-${state.notifications.length}`,taskId:id,recipient,at,ack:false,priority:t.priority,text:`${t.title} needs your next action.`,external:false});emit('Created in-app reminder',`Recipient: ${recipient}. Prototype only; no external message sent.`,'reminder');break;
      }
      case 'ack':{
        const n=state.notifications.find(n=>n.id===data.notificationId);if(!n)throw Error('Reminder not found.');if(n.ack)throw Error('Already acknowledged.');n.ack=true;n.ackAt=at;emit('Acknowledged reminder',n.text,'reminder',state.tasks.find(t=>t.id===n.taskId));break;
      }
      case 'reference':{
        requireRole('Social');const url=nonempty(data.url,'Reference URL');if(!/^https?:\/\//i.test(url))throw Error('Use an http:// or https:// reference URL.');
        const ref={id:`REF-${now}`,title:nonempty(data.title,'Reference title'),url,product:data.product||'Rosemary Serum',category:data.category||'Hair',platform:data.platform||'Instagram',notes:data.notes||'',source:'Social workspace'};state.references.unshift(ref);emit('Saved content reference',ref.title,'reference',null);return ref;
      }
      case 'settings':requireRole('Admin');if(!Number.isInteger(Number(data.p0Minutes))||Number(data.p0Minutes)<5||Number(data.p0Minutes)>240)throw Error('Use a P0 escalation between 5 and 240 minutes.');state.settings={...state.settings,...data,p0Minutes:Number(data.p0Minutes)};emit('Updated alert policy','Prototype policy settings saved; no background messages scheduled.');break;
      default:throw Error('Unknown workflow action.');
    }
    return t;
  }
  function metrics(state,now=Date.now()){
    const today=istDate(now),todayEvents=state.events.filter(e=>istDate(e.at)===today);
    return {open:state.tasks.filter(active).length,pending:state.tasks.filter(t=>['script_review','video_review'].includes(t.status)).length,p0:state.tasks.filter(t=>active(t)&&t.priority==='P0').length,approvedToday:new Set(todayEvents.filter(e=>e.kind==='final').map(e=>e.taskId)).size,submittedToday:new Set(todayEvents.filter(e=>e.kind==='upload'&&e.action.startsWith('Uploaded')).map(e=>e.taskId)).size,overdue:state.tasks.filter(t=>active(t)&&new Date(t.due)<now).length,blocked:state.tasks.filter(t=>t.blocked&&active(t)).length,ready:state.tasks.filter(eligible).length,todayEvents};
  }
  const api={roles,actors,labels,active,currentAsset,unresolved,eligible,seed,perform,metrics,clone,istDate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.StudioEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
