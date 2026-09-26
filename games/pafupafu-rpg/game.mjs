import {createState,clone,applyEvent,claimPotion,usePotion,objective,validateSave,makeSnapshot,restoreCheckpoint,matchesSolution,SYMBOL_SOLUTION,VALVE_SOLUTION,SaveStore,findPath,walkable,moveCircle} from './core.mjs?v=0.3.0';
import {MAPS} from './world.mjs?v=0.3.0';
import {Renderer} from './render.mjs?v=0.3.0';
import {advanceHeroAnimation} from './hero-animation.mjs?v=0.3.0';
import {AudioEngine} from './audio.mjs?v=0.3.0';
import {gameKeyAction} from './input.mjs?v=0.3.0';
import {objectAt,pathToObject,followPath,canInteract} from './interaction.mjs?v=0.3.0';
import {lineClear,navigateEnemy} from './navigation.mjs?v=0.3.0';
import {LUNGE} from './combat.mjs?v=0.3.0';
import {SettingsStore} from './settings.mjs?v=0.3.0';

const $=id=>document.getElementById(id),show=(id,yes=true)=>$(id).classList.toggle('hidden',!yes),esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store=new SaveStore(),audio=new AudioEngine();
const preferences=new SettingsStore({reducedMotionDefault:matchMedia('(prefers-reduced-motion: reduce)').matches}),savedSettings=preferences.load();
audio.volume=savedSettings.volume;
const game={state:{...createState(),difficulty:savedSettings.difficulty},player:{x:480,y:465,facing:'up',moving:false,attack:0,attackCooldown:0,dodge:0,dodgeCooldown:0,invul:0,hitFlash:0},enemies:[],fx:[],shake:0,mode:'title',settings:{reducedMotion:savedSettings.reducedMotion},ready:false};
let renderer,content,checkpoint,nearest=null,lastFrame=0,saveQueue=Promise.resolve(),toastTimeout,previousFocus,dialogue=null,typingInterval,modalRestore='explore',serial=0,pendingNight=false,fatalModal=false,walkPath=[],walkTarget=null,walkDestination=null,attackBuffer=0,hudStamp='',uiRevision=0,pausePending=false,movementMap=null,movementMapSource=null,movementMapKey='';
const keys=new Set(),stick={x:0,y:0},coarse=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
$('app').classList.toggle('has-touch',coarse);
const imageLoad=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('画像を読み込めませんでした。'));img.src=src;});

async function init(){
 try{
  const [inn,event,actors,script,props,guests,hero]=await Promise.all([imageLoad('assets/inn-map.png'),imageLoad('assets/tavern-event.png'),imageLoad('assets/actors.png'),fetch('content.json?v=0.3.0').then(r=>{if(!r.ok)throw Error('物語を読み込めませんでした。');return r.json();}),imageLoad('assets/props.png'),imageLoad('assets/guests.png'),imageLoad('assets/hero-walk.png?v=0.3.0'),store.open()]);
  if(document.fonts?.ready)await document.fonts.ready;
  content=script;renderer=new Renderer($('game'),{inn,event,actors,props,guests,hero});game.ready=true;
  $('new-game').disabled=false;$('load-status').textContent='音は右上のスピーカーから';
  await refreshContinue();requestAnimationFrame(frame);wireWebMCP();
 }catch(e){$('load-status').textContent=e.message+' ページを再読み込みしてください。';$('load-status').classList.add('error-message');}
}
async function latestSave(){const keys=['auto','manual1','manual2','manual3','backup'];const values=await Promise.all(keys.map(async key=>{try{const raw=await store.get(key);return raw?validateSave(raw):null;}catch{return null;}}));return values.filter(Boolean).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0))[0]||null;}
async function refreshContinue(){const saved=await latestSave();show('continue-game',!!saved);if(saved)$('continue-label').textContent=MAPS[saved.map].name;}
function newPlayer(){return {x:game.state.x,y:game.state.y,facing:'up',moving:false,attack:0,attackCooldown:0,dodge:0,dodgeCooldown:0,invul:0,hitFlash:0,dx:0,dy:0};}
async function startGame(saved=null){
 if(!game.ready)return;
 const request=++uiRevision;await saveQueue;await store.beginSession();if(request!==uiRevision)return;
 clearInterval(typingInterval);dialogue=null;attackBuffer=0;
 const selectedDifficulty=game.state.difficulty;game.state=saved?validateSave(saved):{...createState(),difficulty:selectedDifficulty};game.player=newPlayer();game.fx=[];game.mode='explore';fatalModal=false;cancelWalk();keys.clear();releaseStick();show('title',false);show('hud');show('objective');show('touch-controls',coarse);show('modal',false);show('event-scene',false);show('dialogue',false);$('game').focus();
 await enterMap(game.state.map,game.state.x,game.state.y,{loading:true});
 if(!saved){await chapterCard('第一章','月灯りの宿','東街道、二日目の夕暮れ。',1700);speak('intro');}
 else{toast('旅の続きを読み込みました');if(game.state.flags.complete)toast('第一章クリア済み。宿を自由に探索できます。');else await maybeNight();}
}
async function enterMap(id,x,y,{loading=false}={}){
 releaseStick();
 if(!loading){game.mode='transition';keys.clear();cancelWalk();show('interact-hint',false);updateHUD();if(!game.settings.reducedMotion)await $('game').animate([{opacity:1},{opacity:0}],{duration:90,fill:'forwards'}).finished;}
 game.mode='explore';$('game').getAnimations().forEach(animation=>animation.cancel());if(!loading&&!game.settings.reducedMotion)$('game').animate([{opacity:0},{opacity:1}],{duration:160});
 serial++;cancelWalk();const map=MAPS[id];game.state.map=id;game.state.x=x;game.state.y=y;Object.assign(game.player,{x,y,attack:0,dodge:0,invul:.6,moving:false});advanceHeroAnimation(game.player,0);game.fx=[];nearest=null;
 const position=safePosition(navigationMap(),x,y);Object.assign(game.player,position);syncState();
 game.enemies=map.enemies.filter(e=>!game.state.defeated.includes(e.id)&&!(e.type==='boss'&&game.state.flags.bossDead)).map(e=>({...e,maxHp:e.hp,phase:'idle',timer:.5,cooldown:1,hitFlash:0,attackType:'strike',ax:0,ay:0,homeX:e.x,homeY:e.y}));
 checkpoint=makeSnapshot(game.state);updateHUD();$('area-name').textContent=map.name;$('area-subtitle').textContent=map.sub;show('area');$('footer-location').textContent=map.name;audio.dark=!map.safe;
 queueAuto();
 if(id==='sanctum'&&!game.state.flags.bossSeen){applyEvent(game.state,'bossSeen');checkpoint=makeSnapshot(game.state);updateHUD();speak('bossIntro');}
 if(!loading)audio.play('door');
}
function currentForSave(){if(game.enemies.some(e=>e.hp>0)){const snap=clone(checkpoint);snap.elapsed=game.state.elapsed;snap.difficulty=game.state.difficulty;return snap;}game.state.x=game.player.x;game.state.y=game.player.y;return clone(game.state);}
function queueAuto(){const snap=currentForSave();saveQueue=saveQueue.then(()=>store.auto(snap)).catch(error=>{toast(error?.code==='SAVE_CONFLICT'?'別のタブで記録が更新されました。この冒険はファイルへ書き出せます。':'自動保存できません。メニューからセーブを書き出せます。');});return saveQueue;}
async function manualSave(slot=1){const snapshot=currentForSave(),fromEntry=game.enemies.some(e=>e.hp>0);try{await saveQueue;await store.save('manual'+slot,snapshot);toast(fromEntry?'入室時の状態を保存しました':'旅を保存しました');audio.play('confirm');}catch(e){toast(e.message||'保存できませんでした。セーブを書き出してください。');}}
function syncState(){game.state.x=game.player.x;game.state.y=game.player.y;}
function updateHUD(){const exploring=game.mode==='explore',started=String($('title').classList.contains('hidden')),app=$('app');if(app.dataset.mode!==game.mode)app.dataset.mode=game.mode;if(app.dataset.started!==started)app.dataset.started=started;for(const id of ['hud','touch-controls'])if($(id).inert!==!exploring)$(id).inert=!exploring;const s=game.state;const boss=game.enemies.find(e=>e.type==='boss'&&e.hp>0);const stamp=[s.hp,s.potions,s.map,game.mode,objective(s),boss?.hp].join('|');if(stamp===hudStamp)return;hudStamp=stamp;$('potion-count').textContent=s.potions;$('quick-potion').disabled=s.potions===0||s.hp>=s.maxHp||game.mode!=='explore';$('quick-potion').setAttribute('aria-label',`回復薬を使う 残り${s.potions}個 (Q)`);$('touch-potion').disabled=s.potions===0||s.hp>=s.maxHp;$('quick-potion').classList.toggle('urgent',s.hp<=2); $('hearts').innerHTML=Array.from({length:6},(_,i)=>`<span class="${s.hp>=i+1?'':s.hp>i?'half':'empty'}" aria-hidden="true">♥</span>`).join('');$('hearts').setAttribute('aria-label',`体力 ${s.hp} / 6`);$('objective-text').textContent=objective(s);$('stage').dataset.location=s.map;$('stage').dataset.mode=game.mode;show('boss-hud',!!boss);if(boss)$('boss-hud').querySelector('i').style.width=(boss.hp/boss.maxHp*100)+'%';}
function event(name){const before=game.state.journal.length;if(applyEvent(game.state,name)){if(game.state.journal.length>before)show('journal-dot');updateHUD();queueAuto();}}
function toast(message){$('toast').textContent=message;show('toast');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>show('toast',false),3200);}
function note(lines,done){speak(null,{lines:lines.map(text=>({speaker:'ren',text})),done});}
function speak(id,{scene=false,done=null,lines=null}={}){
 uiRevision++;keys.clear();cancelWalk();attackBuffer=0;releaseStick();game.mode='dialogue';game.player.moving=false;show('interact-hint',false);show('touch-controls',false);show('event-scene',scene);$('event-scene').style.filter='';show('dialogue');show('choices',false);show('advance');dialogue={lines:lines||content.dialogues[id],index:0,done,scene,full:false,id};renderLine();$('advance').focus({preventScroll:true});updateHUD();
}
function renderLine(){clearInterval(typingInterval);const line=dialogue.lines[dialogue.index];$('speaker').textContent=content.characters[line.speaker]?.name||line.speaker||'旅の記録';$('dialogue-text').textContent='';dialogue.full=false;const chars=Array.from(line.text);let position=0;if(dialogue.id==='reward'&&dialogue.index===2){$('event-scene').style.filter='brightness(.12)';audio.play('win');}typingInterval=setInterval(()=>{if(!dialogue)return;position=Math.min(chars.length,position+2);$('dialogue-text').textContent=chars.slice(0,position).join('');if(position>=chars.length){clearInterval(typingInterval);dialogue.full=true;}},18);}
function advanceDialogue(){if(game.mode!=='dialogue'||!dialogue)return;audio.play('confirm');if(!dialogue.full){clearInterval(typingInterval);$('dialogue-text').textContent=dialogue.lines[dialogue.index].text;dialogue.full=true;return;}dialogue.index++;if(dialogue.index<dialogue.lines.length){renderLine();return;}const done=dialogue.done;dialogue=null;show('dialogue',false);show('event-scene',false);game.mode='explore';show('touch-controls',coarse);keys.clear();$('game').focus();updateHUD();if(done)done();}
async function chapterCard(kicker,title,sub,ms=1500){game.mode='transition';keys.clear();cancelWalk();releaseStick();show('touch-controls',false);updateHUD();$('chapter-card').querySelector('p').textContent=kicker;$('chapter-card').querySelector('h2').textContent=title;$('chapter-card').querySelector('span').textContent=sub;show('chapter-card');await new Promise(r=>setTimeout(r,game.settings.reducedMotion?650:ms));show('chapter-card',false);game.mode='explore';show('touch-controls',coarse);updateHUD();}
function usable(o){if(['morris','io'].includes(o.id)&&game.state.flags.night&&!game.state.flags.rescued)return false;if(o.type==='pickup'&&game.state.flags[o.id])return false;return true;}
function interactionLabel(o){
 const f=game.state.flags;
 if(o.id==='chest'&&f.key)return '開いた箱を調べる';
 if(o.id==='valves'&&f.valves)return 'バルブを調べる';
 if(o.id==='device'&&f.rescued)return '停止した装置を調べる';
 if(['sleepers','sleepersRight'].includes(o.id)&&f.rescued)return '空の寝台を調べる';
 if(o.id==='shortcut'&&f.rescued)return '受付へ戻る';
 return o.label;
}
function findNearest(){const p=game.player,map=navigationMap();nearest=map.objects.filter(o=>usable(o)&&canInteract(map,p,o)).map(o=>({...o,label:interactionLabel(o),distance:Math.hypot(o.x-p.x,o.y-p.y)})).sort((a,b)=>a.distance-b.distance)[0]||null;game.focus=nearest;show('interact-hint',!!nearest&&game.mode==='explore');if(nearest){$('interact-hint').querySelector('span').textContent=nearest.label;$('touch-interact').textContent=nearest.type==='door'?'進む':'調べる';}else $('touch-interact').textContent='調べる';}
function faceTarget(target){const p=game.player,dx=target.x-p.x,dy=target.y-p.y;if(Math.hypot(dx,dy)>.001)p.facing=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';}
async function interact(target=null){if(game.mode!=='explore')return;findNearest();const o=target||nearest;if(!o||!usable(o)||!canInteract(navigationMap(),game.player,o)){toast('気になるものに近づいて調べよう');return;}cancelWalk();faceTarget(o);const f=game.state.flags;
 if(o.type==='door'){
  if(o.require&&!f[o.require]){if(o.require==='key')speak('cellarLocked');else if(o.require==='valves')note(['蒸気が通路をふさいでいる。\n機関室のバルブで止められそうだ。']);else note(['向こう側から施錠されている。\nまずは、お客さんたちを助けよう。']);return;}
  await enterMap(o.target,...o.spawn);return;
 }
 switch(o.id){
  case 'mira':if(f.complete){speak(null,{scene:true,lines:[{speaker:'mira',text:'また、いつでもいらしてくださいね。\nあなたのいつものお席、空けておきます。'}]});}else if(f.rescued){speak('reward',{scene:true,done:()=>finishChapter()});}else if(f.night){speak('miraNight',{scene:true});}else if(!f.reserved){speak('miraFirst',{scene:true,done:()=>{event('reserve');maybeNight();}});}else speak('miraRepeat',{scene:true,done:maybeNight});break;
  case 'morris':speak(f.rescued?'morrisRescued':'morris',{done:()=>{f.morris=true;queueAuto();maybeNight();}});break;
  case 'io':speak(f.rescued?'ioRescued':'io',{done:()=>{f.io=true;queueAuto();maybeNight();}});break;
  case 'rest':game.state.hp=6;updateHUD();queueAuto();audio.play('item');toast('体力が回復した。ひと息ついていこう。');break;
  case 'exit':if(f.complete)ending();else if(f.night)note(['今、宿を出るわけにはいかない。\nお客さんたちを探そう。']);else note(['ここまで来たんだ。\nまずはカウンターで噂を確かめよう。']);break;
  case 'book':note(['宿帳には、何人もの予約が書かれている。\n「今度こそ、ぐっすり眠れますように」']);break;
  case 'sign':note(['左は星見の客室。右は帳場。\n廊下の奥に、地下機関室への重い扉がある。']);break;
  case 'note':if(!f.night){note(['宿泊客の荷物が置いてある。\n本人がいないのに開くわけにはいかない。']);break;}speak('roomNote',{done:()=>event('note')});break;
  case 'bed':note([f.rescued?'お客さんも、無事に戻ってきた。\n今度は安心して眠れそうだ。':f.night?'寝台はまだ温かい。\n荷物を置いたまま、どこへ行ったんだろう。':'きちんと整えられた寝台だ。\nあの枕、よく眠れそうだな。']);break;
  case 'chest':if(f.key){note(['箱は空だ。\n真鍮の鍵は、ちゃんと持っている。']);break;}if(!f.night){note(['宿の大事なものが入っていそうだ。\n今は触らずにおこう。']);break;}openLock();break;
  case 'ledger':note(['「夢見の補助装置　一式」\n納入元の名前が、インクでかすれている。']);break;
  case 'pipeNote':speak('pipeNote',{done:()=>event('pipeNote')});break;
  case 'valves':if(f.valves)note(['機械の唸りが静かになった。\n奥へ続く通路から、蒸気も消えている。']);else openValves();break;
  case 'scratch':note(['床に、何か重いものを引きずった跡。\n傷は、奥の機関室へ続いている。']);break;
  case 'supplyNote':note(['「守衛の整備記録」\n腕を振り上げてから作動するまで、一拍の遅れ。','『大振りの後は、歯車が噛み合うまで停止する。\nこの間に背面のねじを点検すること』']);break;
  case 'sleepers':case 'sleepersRight':note([f.rescued?'寝台はもう空だ。\n上から、ほっとした笑い声が聞こえる。':'寝息が聞こえる。みんな、眠っているだけだ。\n中央の装置を止めれば、起こせるかもしれない。']);break;
  case 'device':if(!f.bossDead){note(['番人が立ちはだかっている。\nまずはあいつを、どうにかしないと。']);break;}if(f.rescued){note(['装置の動力は切れている。\nもう、ここに閉じ込められる人はいない。']);break;}audio.play('bell');event('rescue');game.state.hp=6;checkpoint=makeSnapshot(game.state);queueAuto();speak('rescue',{done:()=>toast('右下の扉から、受付への近道が使えます')});break;
  case 'potion1':case 'potion2':case 'potion3':if(claimPotion(game.state,o.id)){audio.play('item');queueAuto();toast('回復薬 +1　［Q］で使う');}break;
 }
}
async function maybeNight(){const f=game.state.flags;if(pendingNight||f.night||!f.reserved||!f.morris||!f.io)return;pendingNight=true;audio.play('bell');await chapterCard('日が暮れて','夜の鐘','いつの間にか、食堂が静かになっていた。',1600);event('night');speak('miraNight',{scene:true});pendingNight=false;}
async function finishChapter(){event('complete');await chapterCard('約束の朝','最高のひととき','月灯り亭に、いつもの朝が戻った。',2200);speak('epilogue',{scene:true,done:ending});}
function ending(){openModal('第一章 完','月灯りの宿',`<div class="ending-mark">☾</div><p>${esc(content.ending.body).replace(/\n/g,'<br>')}</p><p class="next-chapter">第二章「湯けむり温泉街」<br><span>後日公開予定</span></p><p>遊んでくれて、ありがとうございます。<br>この先行公開版で遊べるのは、第一章までです。</p><div class="menu-buttons"><button id="ending-back">宿に戻る</button><button id="ending-save">冒険の記録をダウンロード</button></div><p class="small-note">続きの公開に備えて、記録をファイルにも残せます。第二章の公開日は未定です。</p><p class="small-note"><a href="credits.html" target="_blank" rel="noopener">クレジット・この公開版について</a></p>`);$('ending-back').onclick=closeModal;$('ending-save').onclick=exportSave;}

function releaseInfo(){if(['dialogue','transition'].includes(game.mode)||fatalModal)return;openModal('第一章 先行公開版','月灯りの宿へようこそ',`<p>噂の宿で、宿泊客が姿を消した。<br>手がかりをたどり、地下に隠された秘密を解き明かそう。</p><p>第一章の事件は、この版で最後まで遊べます。第二章以降は後日追加予定です。</p><p>記録はこのブラウザに保存されます。別の端末や公開URLへ移るときは、メニューの「セーブを書き出す」と「セーブを読み込む」を使ってください。</p><div class="menu-buttons"><button id="release-close">戻る</button></div><p class="small-note"><a href="credits.html" target="_blank" rel="noopener">クレジット・対応環境</a></p>`);$('release-close').onclick=closeModal;}

function openModal(eyebrow,title,html){uiRevision++;previousFocus=document.activeElement;if(game.mode!=='modal')modalRestore=game.mode==='title'?'title':'explore';game.mode='modal';keys.clear();cancelWalk();attackBuffer=0;releaseStick();game.player.moving=false;$('modal-eyebrow').textContent=eyebrow;$('modal-title').textContent=title;$('modal-body').innerHTML=html;show('modal');show('interact-hint',false);show('touch-controls',false);$('modal-close').focus();updateHUD();}
function closeModal(){if(fatalModal)return;uiRevision++;show('modal',false);game.mode=modalRestore;show('touch-controls',coarse&&game.mode==='explore');keys.clear();if(previousFocus?.isConnected)previousFocus.focus();if(game.mode==='explore')$('game').focus();updateHUD();}
function openLock(){let input=['sun','sun','sun'];const symbols={moon:'☾',star:'✦',sun:'☀'};const order=['sun','moon','star'];openModal('帳場の仕掛け箱','夜が明ける順に',`<p>三つの絵柄を並べる、小さな仕掛け箱。</p><div class="code-lock">${input.map((v,i)=>`<button data-dial="${i}" aria-label="${i+1}番目の絵柄：太陽">${symbols[v]}</button>`).join('')}</div><p class="lock-caption">絵柄を押すと切り替わります。</p><div class="menu-buttons"><button id="unlock">箱を開ける</button><button id="lock-hint">手帳のヒント</button></div><p id="puzzle-feedback" role="status"></p>`);document.querySelectorAll('[data-dial]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.dial);input[i]=order[(order.indexOf(input[i])+1)%3];b.textContent=symbols[input[i]];b.setAttribute('aria-label',`${i+1}番目の絵柄：${{moon:'月',star:'星',sun:'太陽'}[input[i]]}`);audio.play('confirm');});$('unlock').onclick=()=>{if(matchesSolution(input,SYMBOL_SOLUTION)){event('key');audio.play('item');closeModal();speak('chestOpen');}else{$('puzzle-feedback').textContent='小さく音がした。まだ、開かない。';audio.play('lock');}};$('lock-hint').onclick=()=>{$('puzzle-feedback').textContent=game.state.flags.note?'夜番の記録：「月を見上げ、星を数え、太陽を迎える」':'客室に、古い従業員の手帳がありそうだ。';};}
function openValves(){let sequence=[];openModal('地下機関室','三つのバルブ',`<p>配管が熱を持っている。正しい順番で、蒸気を逃がそう。</p><div class="valves"><button data-valve="blue"><b>◉</b>青・冷却</button><button data-valve="red"><b>◉</b>赤・排気</button><button data-valve="gold"><b>◉</b>金・元栓</button></div><div id="valve-progress" class="progress-dots">○○○</div><p id="puzzle-feedback" role="status">${game.state.flags.pipeNote?esc(content.journal.valveClue.body):'配管についた注意書きが、油で汚れている。'}</p>`);document.querySelectorAll('[data-valve]').forEach(b=>b.onclick=()=>{const value=b.dataset.valve;if(value!==VALVE_SOLUTION[sequence.length]){sequence=[];$('puzzle-feedback').textContent='圧力が戻った。順番を変えて、もう一度。';audio.play('lock');}else{sequence.push(value);audio.play('confirm');}$('valve-progress').textContent='●'.repeat(sequence.length)+'○'.repeat(3-sequence.length);if(matchesSolution(sequence,VALVE_SOLUTION)){event('valves');audio.play('item');closeModal();speak('valveSolved');}});}
function journal(){if(game.mode!=='explore')return;show('journal-dot',false);const s=game.state;const entries=[...s.journal].reverse().map(id=>content.journal[id]).filter(Boolean);openModal('道具と覚え書き','旅の手帳',`<p class="current-objective">◆ ${esc(objective(s))}</p><div class="inventory"><span>回復薬 × ${s.potions}</span>${s.flags.key?'<span>真鍮の鍵</span>':''}<span>護身用の短剣</span></div><button id="use-potion" class="wide-button">回復薬を使う <small>体力を3回復</small></button><div class="menu-section">${entries.length?entries.map(e=>`<article class="journal-entry"><h3>${esc(e.title)}</h3><p>${esc(e.body)}</p></article>`).join(''):'<p>旅は、まだ始まったばかり。<br>カウンターのミラに話しかけよう。</p>'}</div>`);$('use-potion').onclick=()=>{if(usePotion(s)){audio.play('item');updateHUD();closeModal();queueAuto();toast('体力が回復した');}else toast(s.potions===0?'回復薬を持っていません':'体力は満タンです');};}
function menu(){if(['dialogue','transition'].includes(game.mode))return;if(game.mode==='modal'){closeModal();return;}const title=game.mode==='title';openModal('PafuPafu RPG',title?'旅の準備':'ひと休み',`<div class="menu-buttons"><button id="resume">${title?'タイトルに戻る':'冒険に戻る'}</button><button id="menu-help">操作方法</button>${!title?'<button id="save-menu">冒険の記録</button><button id="menu-journal">旅の手帳</button><button id="export">セーブを書き出す</button>':''}<button id="import">セーブを読み込む</button>${!title?'<button id="to-title">タイトルに戻る</button>':''}</div><div class="menu-section"><label class="setting-row">難易度<select id="difficulty"><option value="normal">冒険を楽しむ</option><option value="story">物語を楽しむ</option></select></label><label class="setting-row">画面揺れを抑える<input type="checkbox" id="reduce-motion"></label><label class="setting-row">音量<input id="volume" type="range" min="0" max="100" value="${audio.volume*100}" aria-label="音量"></label></div><p class="small-note">セーブはこの端末・ブラウザに保存されます。大切な記録はファイルにも書き出せます。</p>`);$('resume').onclick=closeModal;$('menu-help').onclick=()=>{closeModal();help();};$('import').onclick=()=>{$('import-save').click();};if(!title){$('save-menu').onclick=saveMenu;$('menu-journal').onclick=()=>{closeModal();journal();};$('export').onclick=exportSave;$('to-title').onclick=async()=>{const request=++uiRevision;await queueAuto();if(request!==uiRevision||game.mode!=='modal')return;closeModal();game.mode='title';show('title');show('hud',false);show('objective',false);show('touch-controls',false);show('area',false);show('boss-hud',false);releaseStick();updateHUD();$('new-game').focus();await refreshContinue();};}$('difficulty').value=game.state.difficulty;$('difficulty').onchange=e=>{game.state.difficulty=e.target.value==='story'?'story':'normal';preferences.save({difficulty:game.state.difficulty});toast('難易度を変更しました');};$('reduce-motion').checked=game.settings.reducedMotion;$('reduce-motion').onchange=e=>{game.settings.reducedMotion=e.target.checked;preferences.save({reducedMotion:e.target.checked});};$('volume').oninput=e=>{audio.volume=Number(e.target.value)/100;preferences.save({volume:audio.volume});};}
async function saveMenu(){if(game.mode!=='modal')return;const request=++uiRevision;const values=await Promise.all([1,2,3].map(i=>store.get('manual'+i).catch(()=>null)));if(request!==uiRevision||game.mode!=='modal')return;openModal('記す・読み出す','冒険の記録',`<p>${game.enemies.some(e=>e.hp>0)?'敵がいる部屋では、入室時点の状態を保存します。':'現在の進行を、選んだ枠へ保存します。'}</p><div class="menu-buttons">${values.map((s,i)=>`<button data-save="${i+1}">記録 ${i+1} に保存<small>${s?esc(MAPS[s.map]?.name||'旅の記録')+' · '+Math.floor((s.elapsed||0)/60)+'分':'未使用'}</small></button><button data-load="${i+1}" ${!s?'disabled':''}>記録 ${i+1} を読む</button>`).join('')}<button id="load-backup">前回の自動保存を読む</button><button id="back-menu">メニューに戻る</button></div>`);document.querySelectorAll('[data-save]').forEach(b=>b.onclick=async()=>{const request=++uiRevision;await manualSave(Number(b.dataset.save));if(request===uiRevision&&game.mode==='modal')await saveMenu();});document.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>loadSlot('manual'+b.dataset.load));$('load-backup').onclick=()=>loadSlot('backup');$('back-menu').onclick=()=>{closeModal();menu();};}
async function loadSlot(slot){const request=++uiRevision;try{const raw=await store.get(slot);if(request!==uiRevision||game.mode!=='modal')return;if(!raw){toast('まだ記録がありません');return;}const state=validateSave(raw);closeModal();await startGame(state);}catch(e){if(request===uiRevision)toast(e.message||'セーブを読み込めませんでした。');}}
function exportSave(){const state=makeSnapshot(currentForSave());const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='pafupafu-save-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('セーブファイルを書き出しました');}
function help(){if(fatalModal||game.mode==='dialogue'||game.mode==='transition')return;openModal('冒険の手引き','旅のしかた',`<div class="help-grid"><kbd>WASD / ↑↓←→</kbd><span>移動する。行き先のクリックでも移動できます。</span><kbd>E / Enter</kbd><span>近くの人やものを調べる</span><kbd>J / Space</kbd><span>短剣で攻撃する</span><kbd>K / Shift</kbd><span>向いている方向へ回避する</span><kbd>Q</kbd><span>回復薬をすぐに使う（体力を3回復）</span><kbd>Tab</kbd><span>手帳・道具を開く</span><kbd>Esc</kbd><span>メニュー / 会話を早送り</span></div><p>敵が構えたら距離をとり、攻撃後の隙を狙おう。危ないときは、戦わずに通り抜けても大丈夫。</p><p>スマートフォンは、探索画面の外にあるスティックで移動し、行動ボタンで調べる・攻撃・回避ができます。横向きでは左右の操作欄を使います。</p><p class="small-note">右上の Ⅱ で一時停止します。メニューや会話の間、冒険は一時停止します。回復薬は Q キー、上部の薬ボタン、手帳から使えます。目的や近くで調べられるものは、探索画面の下に表示されます。</p>`);}

// NPCs occupy their feet, using the same map for walking and route finding.
// Keep the derived map stable so enemy navigation can retain its cached route.
function navigationMap(){
 const map=MAPS[game.state.map],npcs=map.objects.filter(o=>o.type==='npc'&&usable(o));
 const key=npcs.map(o=>o.id+':'+o.x+','+o.y).join('|');
 if(movementMapSource!==map||movementMapKey!==key){
  movementMapSource=map;movementMapKey=key;
  movementMap=npcs.length?{...map,walls:[...map.walls,...npcs.map(o=>({x:o.x-10,y:o.y-8,w:20,h:12,owner:o.id}))]}:map;
 }
 return movementMap;
}
function safePosition(map,x,y){
 if(walkable(map,x,y,10))return {x,y};
 const [left,top,right,bottom]=map.bounds;let closest=null,distance=Infinity;
 for(let sy=top+10;sy<=bottom-10;sy+=10)for(let sx=left+10;sx<=right-10;sx+=10){
  const d=(sx-x)**2+(sy-y)**2;if(d<distance&&walkable(map,sx,sy,10)){closest={x:sx,y:sy};distance=d;}
 }
 return closest||{x:480,y:490};
}
function moveBody(body,dx,dy,r=10){return moveCircle(navigationMap(),body,dx,dy,r);}
function attack(){if(game.mode!=='explore')return;if(game.player.attackCooldown>0||game.player.dodge>0){attackBuffer=.16;return;}attackBuffer=0;const p=game.player;p.attack=.18;p.attackCooldown=.36;audio.play('attack');const dir={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[p.facing];for(const e of game.enemies){if(e.hp<=0)continue;const dx=e.x-p.x,dy=e.y-p.y,dist=Math.hypot(dx,dy),dot=dist?((dx*dir[0]+dy*dir[1])/dist):1;if(dist<(e.type==='boss'?91:70)&&dot>-.15&&lineClear(MAPS[game.state.map],p,e,0)){e.hp--;e.hitFlash=.16;game.fx.push({x:e.x,y:e.y-62,text:'1',color:'#f6dfaa',life:.55,maxLife:.55});if(e.type!=='boss')moveBody(e,dir[0]*12,dir[1]*12,14);if(e.hp<=0)defeat(e);}}updateHUD();}
function quickPotion(){if(game.mode!=='explore')return;const before=game.state.hp;if(usePotion(game.state)){audio.play('item');updateHUD();queueAuto();game.fx.push({x:game.player.x,y:game.player.y-65,text:'+'+(game.state.hp-before),color:'#a9d5b0',life:.85,maxLife:.85});}else toast(game.state.potions?'体力は満タンです':'回復薬を持っていません');}
function dodge(){const p=game.player;if(game.mode!=='explore'||p.dodgeCooldown>0)return;const facing={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[p.facing];const movement=getMovement();const length=Math.hypot(movement.x,movement.y);p.dx=length?movement.x/length:facing[0];p.dy=length?movement.y/length:facing[1];cancelWalk();p.dodge=.22;p.dodgeCooldown=.85;p.invul=Math.max(p.invul,.3);audio.play('dodge');}
function defeat(e){if(!game.state.defeated.includes(e.id))game.state.defeated.push(e.id);for(let i=0;i<12;i++)game.fx.push({x:e.x,y:e.y-25,vx:(Math.random()-.5)*70,vy:(Math.random()-.7)*70,color:e.type==='spirit'?'#b793d6':'#d0b175',life:.8,maxLife:.8});if(e.type==='boss'){event('bossDead');audio.play('win');toast('番人が止まった。奥の装置を調べよう。');checkpoint=makeSnapshot(game.state);}else{audio.play('item');if(!game.enemies.some(enemy=>enemy.hp>0)){syncState();checkpoint=makeSnapshot(game.state);queueAuto();}}}
function damage(amount,source){const p=game.player;if(p.invul>0)return;game.state.hp=Math.max(0,game.state.hp-(game.state.difficulty==='story'?amount*.5:amount));p.invul=1.05;p.hitFlash=.45;game.shake=7;audio.play('hurt');const dx=p.x-source.x,dy=p.y-source.y,n=Math.hypot(dx,dy)||1;moveBody(p,dx/n*25,dy/n*25);updateHUD();if(game.state.hp<=0)death();}
function death(){game.mode='modal';fatalModal=true;openModal('ひと息つこう','まだ、旅の途中',`<p>少し、無理をしすぎたみたいだ。<br>部屋に入ったところから、やり直せます。</p><p class="small-note">この部屋で使った道具も、入室時の状態へ戻ります。</p><div class="menu-buttons"><button id="retry">もう一度挑む</button><button id="retry-story">易しい設定で再開</button></div>`);const retry=async easy=>{const restored=restoreCheckpoint(checkpoint);restored.hp=6;if(easy)restored.difficulty='story';fatalModal=false;closeModal();await startGame(restored);};$('retry').onclick=()=>retry(false);$('retry-story').onclick=()=>retry(true);}
function cancelWalk(){walkPath=[];walkTarget=null;walkDestination=null;show('travel-cue',false);}
function positionCue(){if(!walkDestination)return;const rect=$('game').getBoundingClientRect(),scale=Math.min(rect.width/960,rect.height/600);$('travel-cue').style.left=((rect.width-960*scale)/2+walkDestination.x*scale)+'px';$('travel-cue').style.top=((rect.height-600*scale)/2+walkDestination.y*scale)+'px';}
function getMovement(){
 let x=stick.x,y=stick.y;
 if(keys.has('a')||keys.has('arrowleft'))x-=1;if(keys.has('d')||keys.has('arrowright'))x+=1;
 if(keys.has('w')||keys.has('arrowup'))y-=1;if(keys.has('s')||keys.has('arrowdown'))y+=1;
 const n=Math.hypot(x,y);
 if(n>.05){cancelWalk();return n>1?{x:x/n,y:y/n}:{x,y};}
 const direction=followPath(game.player,walkPath);if(direction.distance)return direction;
 if(!walkTarget)cancelWalk();return {x:0,y:0};
}
function tick(dt){const p=game.player,beforeX=p.x,beforeY=p.y;for(const field of ['attack','attackCooldown','dodge','dodgeCooldown','invul','hitFlash'])p[field]=Math.max(0,p[field]-dt);game.shake=Math.max(0,game.shake-dt*26);if(attackBuffer>0){attackBuffer=Math.max(0,attackBuffer-dt);if(p.attackCooldown===0&&p.dodge===0)attack();}const move=getMovement();p.moving=Math.hypot(move.x,move.y)>.08;if(p.dodge>0)moveBody(p,p.dx*380*dt,p.dy*380*dt);else if(p.moving){if(Math.abs(move.x)>Math.abs(move.y))p.facing=move.x>0?'right':'left';else p.facing=move.y>0?'down':'up';const speed=p.attack>0?70:155;const step=Math.min(speed*dt,move.distance??Infinity);moveBody(p,move.x*step,move.y*step);}advanceHeroAnimation(p,Math.hypot(p.x-beforeX,p.y-beforeY));game.state.elapsed+=dt;syncState();for(const e of game.enemies){if(e.hp<=0)continue;e.hitFlash=Math.max(0,e.hitFlash-dt);e.cooldown=Math.max(0,e.cooldown-dt);const dx=p.x-e.x,dy=p.y-e.y,dist=Math.hypot(dx,dy)||1,boss=e.type==='boss';
  if(e.phase==='windup'){e.timer-=dt;if(e.timer<=0){if(e.attackType==='ring'){if(dist<128&&lineClear(MAPS[game.state.map],e,p,0))damage(1,e);e.phase='recover';e.timer=1.5;for(let i=0;i<18;i++){const a=i*Math.PI/9;game.fx.push({x:e.x+Math.cos(a)*110,y:e.y+Math.sin(a)*110,vx:Math.cos(a)*35,vy:Math.sin(a)*35,color:'#ad8bcf',life:.5,maxLife:.5});}}else{e.phase='lunge';e.timer=LUNGE[e.type].duration;}}}
  else if(e.phase==='lunge'){moveBody(e,e.ax*LUNGE[e.type].speed*dt,e.ay*LUNGE[e.type].speed*dt,14);if(Math.hypot(p.x-e.x,p.y-e.y)<LUNGE[e.type].radius&&lineClear(MAPS[game.state.map],e,p,0))damage(1,e);e.timer-=dt;if(e.timer<=0){e.phase='recover';e.timer=boss?1.25:.85;}}
  else if(e.phase==='recover'){e.timer-=dt;if(e.timer<=0){e.phase='idle';e.cooldown=.3;}}
  else{const aggro=boss?500:230;if(dist<aggro){if(dist<(boss?118:e.type==='guard'?113:65)&&e.cooldown<=0&&lineClear(MAPS[game.state.map],e,p,0)){e.phase='windup';e.timer=boss?.85:e.type==='guard'?.8:.7;e.ax=dx/dist;e.ay=dy/dist;e.attackType=boss&&e.hp<=10&&Math.random()<.45?'ring':'strike';}else if(dist>(boss?85:43)){const speed=boss?61:e.type==='guard'?60:49;const direction=navigateEnemy(navigationMap(),e,p,dt);moveBody(e,direction.x*speed*dt,direction.y*speed*dt,14);}}}
  if(game.mode!=='explore')break;
 }findNearest();const target=walkTarget&&MAPS[game.state.map].objects.find(o=>o.id===walkTarget);if(target&&usable(target)&&canInteract(navigationMap(),p,target)&&(Math.hypot(target.x-p.x,target.y-p.y)<44||!walkPath.length)){cancelWalk();interact(target);}else if(walkTarget&&!walkPath.length){cancelWalk();}updateHUD();}
function frame(time){const dt=Math.min((time-lastFrame)/1000||.016,.04);lastFrame=time;if(renderer){if(game.mode==='explore'&&(pausePending||document.hidden)){pausePending=false;menu();}if(game.mode==='explore')tick(dt);game.fx.forEach(f=>{f.life-=dt;if(f.vx){f.x+=f.vx*dt;f.y+=f.vy*dt;}});game.fx=game.fx.filter(f=>f.life>0);renderer.draw(game,dt);}requestAnimationFrame(frame);}

$('new-game').onclick=async()=>{if(game.mode!=='title'||!game.ready)return;const request=++uiRevision,saved=await latestSave();if(request!==uiRevision||game.mode!=='title')return;if(!saved){startGame();return;}openModal('新しい冒険','はじめから遊びますか？','<p>自動保存は、新しい冒険の記録に切り替わります。手動で保存した記録は残ります。</p><div class="menu-buttons"><button id="new-cancel">戻る</button><button id="new-confirm">はじめから遊ぶ</button></div>');$('new-cancel').onclick=closeModal;$('new-confirm').onclick=()=>{closeModal();startGame();};};
$('title-info').onclick=releaseInfo;
$('continue-game').onclick=async()=>{if(game.mode!=='title')return;const request=++uiRevision,saved=await latestSave();if(request!==uiRevision||game.mode!=='title')return;if(saved)startGame(saved);else toast('読み込めるセーブがありません');};
$('advance').onclick=e=>{e.stopPropagation();advanceDialogue();};$('dialogue').onclick=advanceDialogue;
$('quick-potion').onclick=e=>{quickPotion();if(e.detail>0&&game.mode==='explore')$('game').focus();};$('journal').onclick=journal;$('pause').onclick=menu;$('brand').onclick=e=>{e.preventDefault();menu();};$('help').onclick=help;$('save').onclick=e=>{manualSave(1);if(e.detail>0&&game.mode==='explore')$('game').focus();};$('modal-close').onclick=closeModal;
function updateSoundButton(){const button=$('sound'),label=audio.enabled?'音を無効にする':'音を有効にする';button.querySelector('.sound-off').classList.toggle('hidden',audio.enabled);button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(audio.enabled));button.title=label;}
$('sound').onclick=async e=>{const button=$('sound');button.disabled=true;try{if(audio.enabled)audio.disable();else if(!await audio.enable())toast('音を有効にできませんでした。もう一度お試しください。');}finally{updateSoundButton();button.disabled=false;if(e.detail>0&&game.mode==='explore')$('game').focus();}};
$('import-save').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;const request=++uiRevision;try{if(file.size>100000)throw Error('セーブファイルが大きすぎます。');const state=validateSave(JSON.parse(await file.text()));if(request!==uiRevision||game.mode!=='modal')return;closeModal();await startGame(state);}catch(err){if(request===uiRevision)toast(err.message||'このファイルは読み込めません。');}};
window.addEventListener('keydown',e=>{
 if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.altKey||e.isComposing)return;
 const key=e.key.toLowerCase();
 if(game.mode==='modal'){
  if(key==='escape'){e.preventDefault();if(!e.repeat)closeModal();return;}
  if(key==='tab'){
   const focusable=[...$('modal').querySelectorAll('button:not(:disabled),select,input,a')].filter(el=>!el.closest('.hidden'));
   if(focusable.length){const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  }
  return;
 }
 const nativeControl=!!e.target.closest?.('button,a,input,select,textarea,[contenteditable="true"]');
 const action=gameKeyAction(e,{mode:game.mode,nativeControl,dialogueControl:!!e.target.closest?.('#dialogue')});
 if(!action)return;e.preventDefault();
 if(action==='move'){keys.add(key);return;}
 if(e.repeat)return;
 if(action==='start'&&game.ready)$('new-game').click();
 else if(action==='advance')advanceDialogue();
 else if(action==='interact')interact();
 else if(action==='attack')attack();
 else if(action==='dodge')dodge();
 else if(action==='potion')quickPotion();
 else if(action==='journal')journal();
 else if(action==='menu')menu();
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function pauseOnLeave(){keys.clear();releaseStick();cancelWalk();if(game.mode==='explore'){pausePending=false;menu();}else if(game.mode==='transition'||game.mode==='dialogue')pausePending=true;}
window.addEventListener('blur',pauseOnLeave);document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseOnLeave();});
let stickPointer=null;const joystick=$('joystick'),knob=joystick.querySelector('span');
function updateStick(e){const rect=joystick.getBoundingClientRect();if(!rect.width)return;const dx=e.clientX-(rect.left+rect.width/2),dy=e.clientY-(rect.top+rect.height/2),max=rect.width*.32,n=Math.hypot(dx,dy),scale=n>max?max/n:1;stick.x=dx*scale/max;stick.y=dy*scale/max;knob.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}
function releaseStick(){const pointer=stickPointer;stickPointer=null;stick.x=stick.y=0;knob.style.transform='';if(pointer!==null&&joystick.hasPointerCapture(pointer))joystick.releasePointerCapture(pointer);}
joystick.addEventListener('pointerdown',e=>{if(game.mode!=='explore'||stickPointer!==null)return;e.preventDefault();stickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);updateStick(e);});
joystick.addEventListener('pointermove',e=>{if(e.pointerId!==stickPointer)return;if(game.mode!=='explore'){releaseStick();return;}updateStick(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(event,e=>{if(e.pointerId===stickPointer)releaseStick();});
for(const [id,fn]of [['touch-interact',interact],['touch-attack',attack],['touch-dodge',dodge],['touch-potion',quickPotion]])$(id).addEventListener('pointerdown',e=>{e.preventDefault();fn();});
window.addEventListener('resize',()=>{if(game.mode==='explore'){findNearest();positionCue();}});
$('game').addEventListener('pointerdown',e=>{
 if(game.mode!=='explore'||(e.button!==undefined&&e.button!==0))return;
 const rect=$('game').getBoundingClientRect(),scale=Math.min(rect.width/960,rect.height/600);
 const x=(e.clientX-rect.left-(rect.width-960*scale)/2)/scale,y=(e.clientY-rect.top-(rect.height-600*scale)/2)/scale;
 if(x<0||y<0||x>960||y>600)return;
 const map=navigationMap(),obj=objectAt(map.objects.filter(usable),x,y);
 if(obj&&canInteract(map,game.player,obj)){cancelWalk();$('game').focus();interact(obj);return;}
 walkTarget=obj?.id||null;walkPath=obj?pathToObject(map,game.player,obj):findPath(map,game.player,{x,y},10);
 walkDestination=walkPath.at(-1)||null;show('travel-cue',!!walkDestination);positionCue();$('game').focus();
});
function wireWebMCP(){const context=document.modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();const tools=[{name:'read_adventure_status',title:'冒険の進行を読む',description:'現在の場所、目的、体力、手帳に記録された手がかりを返します。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(!input||Object.keys(input).length)throw Error('引数は空のオブジェクトです。');return {mode:game.mode,location:MAPS[game.state.map].name,objective:objective(game.state),health:game.state.hp,notes:game.state.journal.map(id=>content.journal[id])};}},{name:'open_travel_journal',title:'旅の手帳を開く',description:'探索中に、画面の手帳ボタンと同じ旅の手帳を開きます。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||Object.keys(input).length)throw Error('引数は空のオブジェクトです。');if(game.mode!=='explore')throw Error('探索中にだけ開けます。');journal();return {opened:game.mode==='modal'};}}];for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
updateHUD();
updateSoundButton();
init();
