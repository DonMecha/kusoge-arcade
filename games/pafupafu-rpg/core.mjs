export const VERSION = 1;
export const MAP_IDS = ['inn','hall','guest','office','cellar','storage','machine','sanctum'];
export const FLAGS = ['reserved','morris','io','night','note','key','pipeNote','valves','bossSeen','bossDead','rescued','complete','shortcut','potion1','potion2','potion3'];
export const SYMBOL_SOLUTION = ['moon','star','sun'];
export const VALVE_SOLUTION = ['blue','red','gold'];
export const START = {map:'inn',x:480,y:465};
export function createState(){return {version:VERSION,...START,hp:6,maxHp:6,potions:2,flags:{},defeated:[],journal:[],elapsed:0,difficulty:'normal',savedAt:null};}
export function clone(value){return JSON.parse(JSON.stringify(value));}
export function addJournal(s,id){if(!s.journal.includes(id))s.journal.push(id);}
export function applyEvent(s,event){
  switch(event){
    case 'reserve':s.flags.reserved=true;addJournal(s,'reservation');break;
    case 'night':s.flags.night=true;addJournal(s,'missingGuests');break;
    case 'note':s.flags.note=true;addJournal(s,'symbolClue');break;
    case 'key':s.flags.key=true;addJournal(s,'brassKey');break;
    case 'pipeNote':s.flags.pipeNote=true;addJournal(s,'valveClue');break;
    case 'valves':s.flags.valves=true;break;
    case 'bossSeen':s.flags.bossSeen=true;addJournal(s,'guard');break;
    case 'bossDead':s.flags.bossDead=true;break;
    case 'rescue':if(!s.flags.bossDead)return false;s.flags.rescued=true;s.flags.shortcut=true;addJournal(s,'rescued');break;
    case 'complete':if(!s.flags.rescued)return false;s.flags.complete=true;addJournal(s,'nextDestination');break;
    default:return false;
  }return true;
}
export function matchesSolution(input,solution){return Array.isArray(input)&&input.length===solution.length&&input.every((v,i)=>v===solution[i]);}
export function claimPotion(s,id){if(!['potion1','potion2','potion3'].includes(id)||s.flags[id])return false;s.flags[id]=true;s.potions++;return true;}
export function usePotion(s){if(s.potions<1||s.hp>=s.maxHp)return false;s.potions--;s.hp=Math.min(s.maxHp,s.hp+3);return true;}
export function objective(s){const f=s.flags;if(f.complete)return '温泉街への手がかりを手に入れた';if(f.rescued)return '受付に戻り、ミラに報告する';if(f.bossDead)return '奥の夢見の装置を止める';if(f.valves)return '奥の休眠室で、お客さんを探す';if(f.key)return '地下の配管を調べ、蒸気を止める';if(f.note)return '手帳の覚え書きを頼りに、帳場の箱を調べる';if(f.night)return '二階の客室で、消えた客の手がかりを探す';if(f.reserved)return '宿のお客さんに話を聞き、夜の鐘を待つ';return 'カウンターのミラに話しかける';}
export function validateSave(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('セーブファイルの形式を確認してください。');
  if(raw.version!==VERSION)throw Error('この版では読み込めないセーブデータです。');
  if(!MAP_IDS.includes(raw.map))throw Error('セーブの場所情報が壊れています。');
  if(!Number.isFinite(raw.x)||!Number.isFinite(raw.y)||!Number.isFinite(raw.hp)||!Number.isFinite(raw.potions))throw Error('セーブの数値情報が壊れています。');
  const s=createState();s.map=raw.map;s.x=Math.max(60,Math.min(900,raw.x));s.y=Math.max(135,Math.min(535,raw.y));s.hp=Math.max(.5,Math.min(6,raw.hp));s.potions=Math.max(0,Math.min(99,Math.floor(raw.potions)));s.elapsed=Number.isFinite(raw.elapsed)?Math.max(0,Math.min(3600000,raw.elapsed)):0;s.difficulty=raw.difficulty==='story'?'story':'normal';
  for(const key of FLAGS)if(raw.flags?.[key]===true)s.flags[key]=true;
  const knownJournal=['reservation','missingGuests','symbolClue','brassKey','valveClue','guard','rescued','nextDestination'];
  s.journal=[...new Set(Array.isArray(raw.journal)?raw.journal.filter(x=>knownJournal.includes(x)):[])];
  s.defeated=[...new Set(Array.isArray(raw.defeated)?raw.defeated.filter(x=>typeof x==='string'&&/^(cellar|machine|storage|sanctum)-[0-9]+$/.test(x)):[])].slice(0,30);
  s.savedAt=Number.isFinite(raw.savedAt)?raw.savedAt:null;
  if(s.defeated.includes('sanctum-0')&&!s.flags.bossDead)throw Error('番人の戦闘記録と進行記録が一致していません。');
  if(s.flags.complete&&!s.flags.rescued)throw Error('章の進行記録が一致していません。');
  if(s.flags.rescued&&!s.flags.bossDead)throw Error('救出の進行記録が一致していません。');
  if(s.flags.bossDead&&!s.flags.valves)throw Error('装置の進行記録が一致していません。');
  if(s.flags.valves&&!s.flags.key)throw Error('鍵の進行記録が一致していません。');
  if(s.flags.key&&!s.flags.night)throw Error('夜の進行記録が一致していません。');
  if(['cellar','storage','machine','sanctum'].includes(s.map)&&!s.flags.key)throw Error('この場所へ進むための鍵がありません。');
  if(s.map==='sanctum'&&!s.flags.valves)throw Error('休眠室への通路が開いていません。');
  return s;
}
export function makeSnapshot(s){const snapshot=clone(s);snapshot.savedAt=Date.now();return snapshot;}
export function restoreCheckpoint(checkpoint){return validateSave(clone(checkpoint));}
export function circleHitsRect(x,y,r,rect){const nearX=Math.max(rect.x,Math.min(rect.x+rect.w,x)),nearY=Math.max(rect.y,Math.min(rect.y+rect.h,y));return r===0?x>=rect.x&&x<=rect.x+rect.w&&y>=rect.y&&y<=rect.y+rect.h:(x-nearX)**2+(y-nearY)**2<r*r;}
export function walkable(map,x,y,r=10){const [a,b,c,d]=map.bounds;return x>=a+r&&x<=c-r&&y>=b+r&&y<=d-r&&!map.walls.some(rect=>circleHitsRect(x,y,r,rect));}
function pointSegmentDistanceSquared(point,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length)):0;
 return (point.x-a.x-t*dx)**2+(point.y-a.y-t*dy)**2;
}

function segmentIntersectsRect(a,b,rect){
 let near=0,far=1;
 for(const [position,delta,min,max] of [[a.x,b.x-a.x,rect.x,rect.x+rect.w],[a.y,b.y-a.y,rect.y,rect.y+rect.h]]){
  if(Math.abs(delta)<1e-12){if(position<min||position>max)return false;continue;}
  let low=(min-position)/delta,high=(max-position)/delta;
  if(low>high)[low,high]=[high,low];
  near=Math.max(near,low);far=Math.min(far,high);if(near>far)return false;
 }
 return true;
}

/** True when a whole movement segment (or attack ray at radius 0) clears walls. */
export function lineClear(map,a,b,radius=0){
 if(![a.x,a.y,b.x,b.y,radius].every(Number.isFinite)||radius<0)return false;
 const [left,top,right,bottom]=map.bounds;
 for(const p of [a,b])if(p.x<left+radius||p.x>right-radius||p.y<top+radius||p.y>bottom-radius)return false;
 for(const rect of map.walls){
  if(segmentIntersectsRect(a,b,rect))return false;
  if(!radius)continue;
  const distanceToRect=p=>(p.x-Math.max(rect.x,Math.min(rect.x+rect.w,p.x)))**2+(p.y-Math.max(rect.y,Math.min(rect.y+rect.h,p.y)))**2;
  let distance=Math.min(distanceToRect(a),distanceToRect(b));
  for(const corner of [{x:rect.x,y:rect.y},{x:rect.x+rect.w,y:rect.y},{x:rect.x,y:rect.y+rect.h},{x:rect.x+rect.w,y:rect.y+rect.h}])distance=Math.min(distance,pointSegmentDistanceSquared(corner,a,b));
  if(distance<radius*radius)return false;
 }
 return true;
}

/** Sweep the body's complete motion, preserving wall sliding at every step. */
export function moveCircle(map,body,dx,dy,radius=10){
 const origin={x:body.x,y:body.y};
 if(![dx,dy,radius].every(Number.isFinite)||radius<=0||!walkable(map,body.x,body.y,radius))return {x:0,y:0};
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/Math.max(1,radius/2))),sx=dx/steps,sy=dy/steps;
 const advance=(x,y)=>{
  const from={x:body.x,y:body.y},to={x:body.x+x,y:body.y+y};
  if(lineClear(map,from,to,radius)){body.x=to.x;body.y=to.y;return;}
  let near=0,far=1;
  for(let i=0;i<18;i++){
   const fraction=(near+far)/2;
   if(lineClear(map,from,{x:from.x+x*fraction,y:from.y+y*fraction},radius))near=fraction;else far=fraction;
  }
  body.x=from.x+x*near;body.y=from.y+y*near;
 };
 for(let i=0;i<steps;i++){
  if(lineClear(map,body,{x:body.x+sx,y:body.y+sy},radius)){body.x+=sx;body.y+=sy;}
  else{if(sx)advance(sx,0);if(sy)advance(0,sy);}
 }
 return {x:body.x-origin.x,y:body.y-origin.y};
}

export function findPath(map,start,target,radius=10){
 if(![start.x,start.y,target.x,target.y,radius].every(Number.isFinite)||radius<0||!walkable(map,start.x,start.y,radius))return [];
 if(lineClear(map,start,target,radius))return [{x:target.x,y:target.y}];
 const step=20,cols=48,rows=30,key=(x,y)=>y*cols+x,point=(x,y)=>({x:x*step+10,y:y*step+10});
 const valid=(x,y)=>x>=0&&x<cols&&y>=0&&y<rows&&walkable(map,x*step+10,y*step+10,radius);
 // A nearby grid point may sit across the rounded corner of a wall. Connect
 // valid endpoints by a clear segment so enemies do not wait forever there.
 // Movement and routing must use the same body radius; an embedded start is
 // repaired when entering a room rather than connected across an obstacle.
 const closest=p=>{let best=null,d=Infinity;const connect=walkable(map,p.x,p.y,radius);for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){if(!valid(x,y))continue;const q=point(x,y),dist=(q.x-p.x)**2+(q.y-p.y)**2;if(dist<d&&(!connect||lineClear(map,p,q,radius))){d=dist;best={x,y};}}return best;};
 const a=closest(start),b=closest(target);if(!a||!b)return [];const frontier=[a],parents=new Map([[key(a.x,a.y),null]]);let cursor=0,found=false;
 while(cursor<frontier.length){const cur=frontier[cursor++];if(cur.x===b.x&&cur.y===b.y){found=true;break;}for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=cur.x+dx,y=cur.y+dy,k=key(x,y);if(parents.has(k)||!valid(x,y)||(dx&&dy&&(!valid(cur.x+dx,cur.y)||!valid(cur.x,cur.y+dy)))||!lineClear(map,point(cur.x,cur.y),point(x,y),radius))continue;parents.set(k,cur);frontier.push({x,y});}}
 if(!found)return [];const path=[];let current=b;while(current){path.push(point(current.x,current.y));current=parents.get(key(current.x,current.y));}path.reverse();if(walkable(map,target.x,target.y,radius))path.push({x:target.x,y:target.y});return path;
}

const autoToken=value=>{try{return JSON.stringify(value??null);}catch{return 'unreadable-save';}};
const validBackup=value=>{try{return value?validateSave(value):null;}catch{return null;}};
function saveConflict(){const error=Error('別のタブで記録が更新されています。再読み込みするか、この冒険をファイルへ書き出してください。');error.code='SAVE_CONFLICT';return error;}

export class SaveStore{
 constructor(options={}){this.options=options;this.db=null;this.fallback=false;this.unavailable=false;this.backupUnavailable=false;this.sessionReady=false;this.autoBase=null;this.autoQueue=Promise.resolve();}
 storage(){return this.options.storage===undefined?globalThis.localStorage:this.options.storage;}
 async open(){
  if(this.openPromise)return this.openPromise;
  this.openPromise=this.openStorage();return this.openPromise;
 }
 async openStorage(){
  try{
   const factory=this.options.indexedDB===undefined?globalThis.indexedDB:this.options.indexedDB;
   this.db=await new Promise((resolve,reject)=>{
    const req=factory.open('pafupafu-rpg',1);let settled=false;
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('saves'))req.result.createObjectStore('saves');};
    req.onsuccess=()=>{if(settled){req.result.close();return;}settled=true;resolve(req.result);};
    req.onerror=()=>{settled=true;reject(req.error);};
    req.onblocked=()=>{settled=true;reject(Error('保存領域が使用中です。'));};
   });
  }catch{
   this.fallback=true;
   try{const storage=this.storage();storage.setItem('pafupafu:check','1');storage.removeItem('pafupafu:check');}catch{this.unavailable=true;}
  }
 }
 async get(key){
  if(this.unavailable)return null;
  if(this.fallback){const raw=this.storage().getItem('pafupafu:'+key);return raw?JSON.parse(raw):null;}
  return new Promise((resolve,reject)=>{
   const tx=this.db.transaction('saves','readonly'),req=tx.objectStore('saves').get(key);let result=null;
   req.onsuccess=()=>{result=req.result??null;};
   tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('記録を読み込めませんでした。'));
  });
 }
 async put(key,value){
  if(this.unavailable)throw Error('ブラウザに保存できません。セーブを書き出してください。');
  if(this.fallback){this.storage().setItem('pafupafu:'+key,JSON.stringify(value));return;}
  return new Promise((resolve,reject)=>{const tx=this.db.transaction('saves','readwrite');tx.objectStore('saves').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('保存を完了できませんでした。'));});
 }
 async save(key,state){const data=validateSave(makeSnapshot(state));await this.put(key,data);return data;}
 // Call only when the player explicitly starts or loads an adventure. Reads in
 // a menu must not silently acknowledge another tab's newer adventure.
 async beginSession(){
  await this.autoQueue.catch(()=>{});
  if(this.unavailable){this.sessionReady=true;return;}
  try{this.autoBase=this.fallback?this.storage().getItem('pafupafu:auto'):autoToken(await this.get('auto'));}catch{this.unavailable=true;}
  this.sessionReady=true;
 }
 async auto(state){
  const data=validateSave(makeSnapshot(state));
  const run=this.autoQueue.then(()=>this.saveAuto(data));this.autoQueue=run.catch(()=>{});return run;
 }
 async saveAuto(data){
  if(this.unavailable)throw Error('ブラウザに保存できません。セーブを書き出してください。');
  if(!this.sessionReady){this.autoBase=this.fallback?this.storage().getItem('pafupafu:auto'):autoToken(await this.get('auto'));this.sessionReady=true;}
  if(this.fallback){
   const write=()=>{
    const storage=this.storage(),previous=storage.getItem('pafupafu:auto');
    if(previous!==this.autoBase)throw saveConflict();
    let backup=null;try{backup=validBackup(previous?JSON.parse(previous):null);}catch{}
    // Commit the newest progress first. A full backup quota must not disable
    // every future autosave; the older backup remains intact if this fails.
    const serialized=JSON.stringify(data);storage.setItem('pafupafu:auto',serialized);this.autoBase=serialized;this.backupUnavailable=false;
    if(backup){try{storage.setItem('pafupafu:backup',JSON.stringify(backup));}catch{this.backupUnavailable=true;}}
    return data;
   };
   const locks=this.options.locks===undefined?globalThis.navigator?.locks:this.options.locks;
   return locks?.request?locks.request('pafupafu:autosave',{mode:'exclusive'},write):write();
  }
  return new Promise((resolve,reject)=>{
   const tx=this.db.transaction('saves','readwrite'),store=tx.objectStore('saves'),req=store.get('auto');let failure=null;
   req.onsuccess=()=>{
    if(autoToken(req.result)!==this.autoBase){failure=saveConflict();tx.abort();return;}
    const backup=validBackup(req.result);if(backup)store.put(backup,'backup');store.put(data,'auto');
   };
   tx.oncomplete=()=>{this.autoBase=autoToken(data);this.backupUnavailable=false;resolve(data);};
   tx.onerror=()=>reject(failure||tx.error||Error('保存を完了できませんでした。'));
   tx.onabort=()=>reject(failure||tx.error||Error('保存を完了できませんでした。'));
  });
 }
}
