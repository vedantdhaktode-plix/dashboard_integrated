(function(root){
  'use strict';
  const clean=x=>String(x??'').replace(/\u00a0/g,' ').trim();
  const key=x=>clean(x).toLowerCase().replace(/[\s_-]+/g,' ');
  const stages={script_pending:'Script approval pending',video_pending:'Video approval pending',brand_handoff:'Queued for Video',on_hold:'On hold',in_progress:'Work in progress',script_approved:'Script approved',script_closed:'Script closed',no_script:'No script required',script_not_started:'Script not started',video_done:'Video done · approval unknown',video_approved:'Video approved',live:'Published',rejected:'Cancelled',unspecified:'Status not recorded'};
  const stageColors={script_pending:'amber',video_pending:'purple',brand_handoff:'purple',on_hold:'red',in_progress:'blue',script_approved:'green',script_closed:'gray',no_script:'blue',script_not_started:'gray',video_done:'amber',video_approved:'green',live:'green',rejected:'red',unspecified:'gray'};
  function dateOnly(value){
    const text=clean(value);let y,m,d,match;
    if(match=/^(\d{4})-(\d{2})-(\d{2})(?:[ T]|$)/.exec(text)){[,y,m,d]=match;}
    else if(match=/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/.exec(text)){d=match[1];m=match[2];y=match[3].length===2?2000+Number(match[3]):match[3];}
    else return null;
    const n=new Date(Date.UTC(Number(y),Number(m)-1,Number(d)));
    if(n.getUTCFullYear()!==Number(y)||n.getUTCMonth()+1!==Number(m)||n.getUTCDate()!==Number(d))return null;
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  function stageOf(r){
    const s=key(r.scriptStatus),v=key(r.videoStatus),live=key(r.live),dependency=key(r.dependency);
    if(/^(rejected|cancelled|canceled)$/.test(v)||/^(rejected|cancelled|canceled)$/.test(s))return 'rejected';
    if(live==='live')return 'live';
    if(/^(video approved|final approved|approved)$/.test(v))return 'video_approved';
    if(/on hold/.test(s)||/on hold/.test(v))return 'on_hold';
    if(s==='video approval pending'||/^(video approval pending|approval pending)$/.test(v))return 'video_pending';
    if(live==='brand')return 'brand_handoff';
    if(s==='script approval pending'||s==='approval pending')return 'script_pending';
    if(/^(wip|work in progress|in progress|working)$/.test(s)||/^(wip|work in progress|in progress|working)$/.test(v))return 'in_progress';
    if(v==='done'||v==='closed'||v==='completed')return 'video_done';
    if(s==='script approved'||s==='approved')return 'script_approved';
    if(s==='closed'||s==='completed'||s==='done')return 'script_closed';
    if(dependency==='no script needed')return 'no_script';
    if(!s&&/script.*needed/.test(dependency))return 'script_not_started';
    return 'unspecified';
  }
  function schema(payload){
    const sheet=payload?.sheets?.find(s=>s.properties?.title==='AI Tracker Main');
    if(!sheet)throw Error('The response does not contain AI Tracker Main.');
    const blocks=sheet.data||[];const first=blocks.find(b=>(b.startRow||0)===0);
    const header=first?.rowData?.[0]?.values?.map(c=>clean(c.formattedValue??c.userEnteredValue?.stringValue));
    if(!header)throw Error('AI Tracker Main header row could not be read.');
    const warnings=[];
    const expected=['Date','Category','Type of Edit','Content Dependency','Product Name','Reference','Hooks','Comments','Script Link','Brand Team Comment','Priority','Script Status','Editor','Status','Product Name','Hook Name','Drive Link','Live'];
    if(!header.some(h=>key(h)==='date')&&expected.slice(1).every((h,i)=>key(header[i+1])===key(h))){
      warnings.push(`Column A is used as the entry date. Its header is ${header[0]?JSON.stringify(header[0]):'blank'} instead of Date; columns B–R match the tracker layout.`);
      header[0]='Date';
    }
    const index=name=>header.findIndex(h=>key(h)===key(name));
    const required=['Date','Category','Type of Edit','Content Dependency','Product Name','Reference','Hooks','Comments','Script Link','Brand Team Comment','Priority','Script Status','Editor','Status','Hook Name','Drive Link','Live'];
    for(const h of required)if(index(h)<0)throw Error(`Required column is missing: ${h}.`);
    const products=header.map((h,i)=>key(h)==='product name'?i:-1).filter(i=>i>=0);
    return {blocks,index,products,warnings};
  }
  function schemaWarnings(payload){return schema(payload).warnings;}
  function parseCells(payload){
    const {blocks,index,products}=schema(payload);
    const out=[];
    for(const block of blocks){for(let i=0;i<(block.rowData||[]).length;i++){
      const row=(block.startRow||0)+i+1;if(row===1)continue;
      const cells=block.rowData[i]?.values||[];
      const at=name=>clean(cells[index(name)]?.formattedValue??cells[index(name)]?.userEnteredValue?.stringValue??cells[index(name)]?.userEnteredValue?.numberValue);
      const link=name=>{const c=cells[index(name)];const value=clean(c?.hyperlink||c?.formattedValue);return /^https?:\/\//i.test(value)?value:'';};
      const p=products.map(i=>clean(cells[i]?.formattedValue||cells[i]?.userEnteredValue?.stringValue));
      if(!['Type of Edit','Reference','Hooks','Comments','Script Link','Brand Team Comment','Hook Name','Drive Link'].some(n=>at(n))&&!p.some(Boolean))continue;
      const r={id:`AI-${row}`,row,date:dateOnly(at('Date')),dateRaw:at('Date'),category:at('Category')||'Unspecified',type:at('Type of Edit')||'Unspecified',dependency:at('Content Dependency'),product:p[0]||p[1]||'Product not recorded',outputProduct:p[1]||'',reference:at('Reference'),referenceUrl:link('Reference'),hooks:at('Hooks'),comments:at('Comments'),scriptLink:at('Script Link'),scriptUrl:link('Script Link'),brandComment:at('Brand Team Comment'),priorityRaw:at('Priority'),priority:/^P[012]$/i.test(at('Priority'))?at('Priority').toUpperCase():'Unspecified',scriptStatus:at('Script Status'),editor:at('Editor')||'Unassigned',videoStatus:at('Status'),hookName:at('Hook Name'),driveLink:at('Drive Link'),driveUrl:link('Drive Link'),live:at('Live'),notes:cells.map(c=>clean(c.note)).filter(Boolean),issues:[]};
      r.stage=stageOf(r);
      r.scriptPending=['script approval pending','approval pending'].includes(key(r.scriptStatus));
      r.scriptApproved=['script approved','approved'].includes(key(r.scriptStatus));
      r.scriptClosed=['closed','done','completed'].includes(key(r.scriptStatus));
      r.videoPending=key(r.scriptStatus)==='video approval pending'||['video approval pending','approval pending'].includes(key(r.videoStatus));
      r.videoApproved=['video approved','final approved','approved'].includes(key(r.videoStatus));
      r.hold=/on hold/.test(key(r.scriptStatus))||/on hold/.test(key(r.videoStatus));
      r.wip=['wip','work in progress','in progress','working'].includes(key(r.scriptStatus))||['wip','work in progress','in progress','working'].includes(key(r.videoStatus));
      r.reportedLive=key(r.live)==='live';r.brandHandoff=key(r.live)==='brand';
      r.scriptRequired=key(r.dependency)!=='no script needed';
      r.finishedSignal=r.reportedLive||r.videoApproved;
      r.pending=!r.finishedSignal&&r.stage!=='rejected';
      if(r.priority==='Unspecified'&&r.priorityRaw)r.issues.push(`Priority contains a status: ${r.priorityRaw}`);
      if(!r.date)r.issues.push(r.dateRaw?'Date could not be parsed':'Date missing');
      if(!r.scriptStatus&&!r.videoStatus&&!r.live)r.issues.push('No script, video or live status recorded');
      if(r.reportedLive&&!r.videoApproved)r.issues.push('Reported live; explicit final video approval not recorded');
      if(r.reportedLive&&(r.scriptPending||r.videoPending||r.hold))r.issues.push('Live signal conflicts with pending / on-hold status');
      if(p[0]&&p[1]&&key(p[0])!==key(p[1]))r.issues.push('Product Name columns differ');
      out.push(r);
    }}
    return out;
  }
  function filter(records,f={}){return records.filter(r=>(!f.query||[r.id,r.row,r.product,r.outputProduct,r.type,r.hooks,r.hookName,r.comments,r.brandComment,r.team,r.editor,r.scriptStatus,r.videoStatus].join(' ').toLowerCase().includes(f.query.toLowerCase()))&&(!f.team||r.team===f.team)&&(!f.category||r.category===f.category)&&(!f.editor||r.editor===f.editor)&&(!f.priority||r.priority===f.priority)&&(!f.type||r.type===f.type)&&(!f.from||!!r.date&&r.date>=f.from)&&(!f.to||!!r.date&&r.date<=f.to)&&(!f.stage||r.stage===f.stage)&&(!f.focus||focusMatch(r,f.focus)));}
  function focusMatch(r,k){return k==='issues'?r.issues.length>0:k==='pending'?r.pending:k==='scriptPending'?r.scriptPending:k==='scriptApproved'?r.scriptApproved:k==='scriptClosed'?r.scriptClosed:k==='videoPending'?r.videoPending:k==='videoApproved'?r.videoApproved:k==='hold'?r.hold:k==='wip'?r.wip:k==='live'?r.reportedLive:k==='brand'?r.brandHandoff:k==='unassigned'?r.editor==='Unassigned':k==='p0'?r.priority==='P0'&&r.pending:true;}
  function summary(records){const count=f=>records.filter(f).length;
    const m={total:records.length,pending:count(r=>r.pending),scriptPending:count(r=>r.scriptPending),scriptApproved:count(r=>r.scriptApproved),scriptClosed:count(r=>r.scriptClosed),videoPending:count(r=>r.videoPending),videoApproved:count(r=>r.videoApproved),hold:count(r=>r.hold),wip:count(r=>r.wip),live:count(r=>r.reportedLive),brand:count(r=>r.brandHandoff),unassigned:count(r=>r.editor==='Unassigned'),p0:count(r=>r.priority==='P0'&&r.pending),issues:count(r=>r.issues.length),missingDates:count(r=>!r.date),finished:count(r=>r.finishedSignal)};
    m.completionRate=m.total?Math.round(m.finished/m.total*100):0;
    m.stages=Object.fromEntries(Object.keys(stages).map(s=>[s,count(r=>r.stage===s)]));
    m.categories=group(records,r=>r.category);m.teams=group(records,r=>r.team||'Operations');m.editors=group(records,r=>r.editor);m.dates=group(records,r=>r.date||'Undated');
    m.scriptBreakdown=group(records,r=>r.scriptStatus||'Not recorded');m.videoBreakdown=group(records,r=>r.videoStatus||'Not recorded');m.priorityBreakdown=group(records,r=>r.priority);
    return m;
  }
  function group(records,get){const out={};for(const r of records){const k=get(r);if(!out[k])out[k]={name:k,total:0,pending:0,active:0,review:0,completed:0,live:0,scriptPending:0,videoPending:0,hold:0};out[k].total++;for(const x of ['pending','scriptPending','videoPending','hold'])if(r[x])out[k][x]++;if(r.pending&&!r.hold&&!r.scriptPending&&!r.videoPending)out[k].active++;if(r.scriptPending||r.videoPending)out[k].review++;if(r.finishedSignal)out[k].completed++;if(r.reportedLive)out[k].live++;}return Object.values(out).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));}
  function changes(before,after,at){const old=new Map(before.map(r=>[r.id,r]));const next=new Map(after.map(r=>[r.id,r]));const fields=['state','product','category','type','dateRaw','priorityRaw','scriptStatus','videoStatus','live','editor','dependency','comments','brandComment','scriptLink','driveLink','scriptUrl','driveUrl','referenceUrl','hooks','hookName'];const events=[];
    for(const r of after){const a=old.get(r.id);if(!a){events.push({row:r.row,product:r.product,at,action:'Task created',detail:`${r.id} entered the pipeline.`,actor:r.updatedBy||'Plix Ops'});continue;}for(const f of fields)if(a[f]!==r[f])events.push({row:r.row,product:r.product,at,action:`${f} changed`,detail:`${a[f]||'(blank)'} → ${r[f]||'(blank)'}`,actor:r.updatedBy||'Plix Ops'});}
    for(const r of before)if(!next.has(r.id))events.push({row:r.row,product:r.product,at,action:'Task no longer present',detail:`${r.id} was removed from the current dataset.`,actor:'Plix Ops'});
    return events;
  }
  const api={clean,key,stages,stageColors,dateOnly,parseCells,schemaWarnings,filter,summary,changes,focusMatch};root.TrackerModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
