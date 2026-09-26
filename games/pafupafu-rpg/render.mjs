import {MAPS} from './world.mjs?v=0.3.0';
import {placedScenery,OBJECT_FOOTPRINTS} from './scenery.mjs?v=0.3.0';
import {INN_FIXTURES} from './inn-layout.mjs?v=0.3.0';
import {LUNGE} from './combat.mjs?v=0.3.0';
import {heroAnimationFrame} from './hero-animation.mjs?v=0.3.0';
// Hand-checked source windows. Generated rows are not exact grid cells.
// Each row shares its scale and baseline; helmet anchors avoid gait jitter.
const HERO_ROWS=[
 {xs:[100,432,764],y:26,w:232,h:314,anchor:112},
 {xs:[104,440,772],y:365,w:232,h:340,anchor:101},
 {xs:[88,424,756],y:730,w:232,h:340,anchor:124},
 {xs:[84,416,748],y:1082,w:240,h:318,anchor:128}
];
const GUESTS={morris:[260,180,464,700],io:[920,146,286,734]};
const ATLAS={front:[83,43,225,315],back:[446,44,217,314],left:[808,42,193,316],right:[1183,44,196,314],walk0:[88,397,220,310],walk1:[456,400,200,304],side0:[801,389,205,314],side1:[1175,391,214,315],spirit:[81,731,233,317],chest:[433,800,226,206],boss:[735,708,341,358],mira:[1180,722,178,335]};
export class Renderer{
 constructor(canvas,images){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.ctx.imageSmoothingEnabled=false;this.images=images;this.mapCache=new Map();this.clock=0;}
 mapImage(id){
  if(this.mapCache.has(id))return this.mapCache.get(id);
  const map=MAPS[id],c=document.createElement('canvas');c.width=960;c.height=600;
  const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
  if(id==='inn')ctx.drawImage(this.images.inn,0,0,960,600);
  else{
   this.roomShell(ctx,map);
   this.roomDetails(ctx,id);
   for(const o of map.objects)if(o.type==='door')this.doorway(ctx,map,o);
  }
  this.mapCache.set(id,c);return c;
 }
 roomShell(ctx,map){
  const [left,top,right,bottom]=map.bounds,stone=map.theme!=='wood';
  ctx.fillStyle='#0c111a';ctx.fillRect(0,0,960,600);
  ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
  if(stone){
   const colors=['#303c40','#344044','#303a3e','#354044'];
   for(let row=0,y=top;y<bottom;y+=36,row++)for(let col=0,x=left-(row%2)*48;x<right;x+=96,col++){
    ctx.fillStyle='#1b252b';ctx.fillRect(x,y,96,36);
    ctx.fillStyle=colors[(row*7+col*3)%colors.length];ctx.fillRect(x+2,y+2,92,32);
    ctx.fillStyle='#5b655d22';ctx.fillRect(x+3,y+2,90,2);
    // Sparse, deterministic chips keep the stone readable at pixel scale.
    for(let chip=0;chip<7;chip++){const u=(col*19+row*13+chip*31)%83,v=(col*11+row*7+chip*17)%23;ctx.fillStyle=chip%2?'#75807710':'#101c201e';ctx.fillRect(x+5+u,y+6+v,2+chip%4,1);}
    if((row*3+col)%7===0){ctx.fillStyle='#18262a88';ctx.fillRect(x+49,y+3,1,7);ctx.fillRect(x+50,y+9,4,1);}
   }
  }else{
   for(let y=top;y<bottom;y+=36)for(let x=left;x<right;x+=96)
    ctx.drawImage(this.images.inn,350+(Math.floor(y/36)%2)*70,650,153,58,x,y,96,36);
  }
  ctx.fillStyle='#080e1920';ctx.fillRect(left,top,right-left,bottom-top);ctx.restore();
  // The floor boundary is also the collision boundary. Door openings are drawn
  // into these walls, so exits never stand alone in the middle of a room.
  ctx.fillStyle=stone?'#202930':'#30251f';ctx.fillRect(left-22,top-114,right-left+44,114);
  ctx.save();ctx.beginPath();ctx.rect(left-22,top-114,right-left+44,114);ctx.clip();
  if(stone){
   for(let row=0,y=top-110;y<top-6;y+=26,row++)for(let x=left-20-(row%2)*39;x<right+20;x+=78){
    ctx.fillStyle=(row+Math.floor(x/78))%3?'#46504e':'#404947';ctx.fillRect(x+2,y+2,74,22);
    ctx.fillStyle='#7d827026';ctx.fillRect(x+3,y+2,72,2);
   }
  }else{
   for(let x=left-20;x<right+20;x+=56){
    ctx.fillStyle='#57412d';ctx.fillRect(x+2,top-109,50,99);
    ctx.fillStyle='#745535';ctx.fillRect(x+5,top-107,3,93);
    ctx.fillStyle='#3f2d24';ctx.fillRect(x+14,top-100,32,78);
    ctx.save();ctx.translate(x+15,top-99);ctx.rotate(Math.PI/2);ctx.drawImage(this.images.inn,350,650,153,58,0,-30,76,30);ctx.restore();
    ctx.fillStyle='#281e245e';ctx.fillRect(x+15,top-99,30,76);
   }
   ctx.fillStyle='#886540';ctx.fillRect(left-22,top-111,right-left+44,5);
   ctx.fillStyle='#261d1c';ctx.fillRect(left-22,top-39,right-left+44,7);
   ctx.fillStyle='#795934';ctx.fillRect(left-22,top-39,right-left+44,2);
  }
  ctx.restore();
  ctx.fillStyle=stone?'#65706a':'#9b7445';ctx.fillRect(left-22,top-8,right-left+44,4);
  ctx.fillStyle='#0e171c';ctx.fillRect(left-22,top-4,right-left+44,8);
  ctx.fillStyle='#0004';ctx.fillRect(left,top,right-left,13);
  for(const x of [left-22,right]){
   ctx.fillStyle=stone?'#434e4d':'#503b2b';ctx.fillRect(x,top-114,22,bottom-top+156);
   ctx.fillStyle=stone?'#788077':'#947044';ctx.fillRect(x+2,top-112,3,bottom-top+150);
   ctx.fillStyle='#172025';ctx.fillRect(x+19,top-114,3,bottom-top+156);
  }
  ctx.fillStyle=stone?'#354146':'#403029';ctx.fillRect(left-22,bottom,right-left+44,40);
  ctx.fillStyle=stone?'#728075':'#967044';ctx.fillRect(left-22,bottom,right-left+44,5);
  ctx.fillStyle='#0a101b';ctx.fillRect(left-22,bottom+36,right-left+44,6);
 }
 doorway(ctx,map,o){
  const [left,top,right,bottom]=map.bounds,side=o.side||'north';
  ctx.save();
  if(side==='north'){
   ctx.fillStyle='#090f18';ctx.fillRect(o.x-31,top-78,62,84);
   ctx.drawImage(this.images.props,1143,66,205,287,o.x-31,top-81,62,87);
   ctx.fillStyle='#af8b52';ctx.fillRect(o.x-28,top+5,56,4);
  }else if(side==='south'){
   ctx.fillStyle='#10151c';ctx.fillRect(o.x-35,bottom-7,70,48);
   ctx.fillStyle='#76664d';ctx.fillRect(o.x-32,bottom-4,64,7);
   ctx.fillStyle='#b2996b';ctx.fillRect(o.x-32,bottom-4,64,2);
   if(o.stairs){for(let y=bottom+9;y<bottom+36;y+=10){ctx.fillStyle='#554939';ctx.fillRect(o.x-31,y,62,4);}}
   else{ctx.fillStyle=map.theme==='wood'?'#3e3025':'#2c363b';ctx.fillRect(o.x-31,bottom+5,62,29);ctx.fillStyle='#151c2244';ctx.fillRect(o.x-31,bottom+22,62,12);}
   ctx.fillStyle='#9f8355';ctx.fillRect(o.x-38,bottom-6,6,44);ctx.fillRect(o.x+32,bottom-6,6,44);
  }else{
   const x=side==='west'?left:right;
   ctx.fillStyle='#0b121b';ctx.fillRect(x-22,o.y-47,44,70);
   ctx.fillStyle='#9b8054';ctx.fillRect(x-23,o.y-50,46,5);ctx.fillRect(x-23,o.y+20,46,5);
   ctx.fillStyle=map.theme==='wood'?'#493b2b':'#3c4848';ctx.fillRect(x-20,o.y+4,40,12);
   ctx.fillStyle='#171f29';ctx.fillRect(x-20,o.y-45,5,49);ctx.fillRect(x+15,o.y-45,5,49);
   ctx.fillStyle='#927957';ctx.fillRect(x-23,o.y+16,46,4);
  }
  // A small floor arrow gives every exit a visible approach, including the
  // near wall, which is cut away to keep the player in view.
  const angle={north:-Math.PI/2,south:Math.PI/2,west:Math.PI,east:0}[side];
  const ax=side==='west'?left+34:side==='east'?right-34:o.x;
  const ay=side==='north'?top+24:side==='south'?bottom-25:o.y;
  ctx.translate(ax,ay);ctx.rotate(angle);ctx.strokeStyle='#d4b27699';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(-3,-5);ctx.lineTo(2,0);ctx.lineTo(-3,5);ctx.stroke();ctx.restore();
 }
 partition(ctx,r,stone){
  ctx.fillStyle='#080c1644';ctx.fillRect(r.x+5,r.y+r.h,r.w+4,7);
  ctx.fillStyle=stone?'#323c3c':'#513c2e';ctx.fillRect(r.x,r.y-44,r.w,r.h+44);
  ctx.fillStyle=stone?'#788076':'#997648';ctx.fillRect(r.x,r.y-44,r.w,5);
  ctx.fillStyle='#0c151950';ctx.fillRect(r.x+r.w-5,r.y-39,5,r.h+39);
  ctx.strokeStyle=stone?'#182427':'#2f241e';ctx.lineWidth=2;
  for(let y=r.y-18;y<r.y+r.h;y+=24){ctx.beginPath();ctx.moveTo(r.x,y);ctx.lineTo(r.x+r.w,y);ctx.stroke();}
 }
 prop(ctx,kind,x,y){const p=placedScenery([kind,x,y]);if(p.wall){ctx.fillStyle='#090d1838';ctx.fillRect(p.wall.x+3,p.wall.y+p.wall.h-3,p.wall.w,7);}ctx.drawImage(this.images.props,...p.source,p.x,p.y,p.width,p.height);}

 sprite(kind,x,y,h=63,{flip=false,alpha=1,tint='',bob=0}={}){const ctx=this.ctx,rect=GUESTS[kind]||ATLAS[kind]||ATLAS.front,w=h*rect[2]/rect[3];ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#06091266';ctx.beginPath();ctx.ellipse(x,y+2,w*.32,6,0,0,Math.PI*2);ctx.fill();ctx.translate(Math.round(x),Math.round(y+bob));if(flip)ctx.scale(-1,1);if(tint)ctx.filter=tint;ctx.drawImage(GUESTS[kind]?this.images.guests:this.images.actors,...rect,Math.round(-w/2),-h,w,h);ctx.restore();}
 draw(game,dt){const {state,player,enemies,fx}=game,map=MAPS[state.map],ctx=this.ctx;this.clock+=dt;const t=this.clock;ctx.save();ctx.clearRect(0,0,960,600);let shake=game.shake>0&&!game.settings.reducedMotion?game.shake:0;if(shake)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);ctx.drawImage(this.mapImage(state.map),0,0);if(map.theme==='sanctum'){const glow=ctx.createRadialGradient(480,205,0,480,205,220);glow.addColorStop(0,state.flags.rescued?'#d3b97233':'#7359b743');glow.addColorStop(1,'#2b234800');ctx.fillStyle=glow;ctx.fillRect(260,140,440,370);}
  const actors=[];
  for(const r of map.structuralWalls||[])actors.push({y:r.y+r.h,draw:()=>this.partition(ctx,r,map.theme!=='wood')});
  if(state.map==='inn')for(const f of INN_FIXTURES)actors.push({y:f.sortY,draw:()=>{
   ctx.save();if(f.clips){ctx.beginPath();for(const [x,y,w,h]of f.clips)ctx.rect(x*960/1536,y*600/1024,w*960/1536,h*600/1024);ctx.clip();}
   ctx.drawImage(this.images.inn,...f.source,f.x,f.y,f.width,f.height);ctx.restore();
  }});
  for(const o of map.objects){
   if(o.type==='npc'){
    if(['morris','io'].includes(o.id)&&state.flags.night&&!state.flags.rescued)continue;
    actors.push({y:o.y,draw:()=>this.sprite(o.id,o.x,o.y,{mira:60,morris:58,io:61}[o.id]||60)});
   }
   const parent=map.props.find(p=>p[3]===o.id);
   const foot=OBJECT_FOOTPRINTS[o.type];
   const depth=o.sortY??(parent?placedScenery(parent).sortY+.1:o.y+(foot?foot[1]+foot[3]:2));
   if(o.type!=='npc'&&o.type!=='door')actors.push({y:depth,draw:()=>this.drawObject(o,state,t)});
   if(o.type==='door'&&o.require&&!state.flags[o.require]){
    const side=o.side||'north',x=side==='east'?o.x-13:side==='west'?o.x+13:o.x;
    const y=side==='north'?o.y-34:side==='south'?o.y+6:o.y-10;
    ctx.fillStyle='#261e24';ctx.fillRect(x-7,y-6,14,13);ctx.strokeStyle='#d5b576';ctx.lineWidth=2;
    ctx.strokeRect(x-4,y-10,8,9);ctx.fillStyle='#c09a59';ctx.fillRect(x-6,y-4,12,9);ctx.fillStyle='#403226';ctx.fillRect(x-1,y-1,2,4);
   }
  }
  if(state.map==='machine'&&!state.flags.valves){for(let i=0;i<8;i++){const xx=433+i*13,yy=158-Math.sin(t*2+i)*9;ctx.fillStyle=`rgba(157,180,191,${.09+Math.sin(t+i)*.025})`;ctx.beginPath();ctx.ellipse(xx,yy,15,30,0,0,Math.PI*2);ctx.fill();}}
  for(const e of enemies){if(e.hp<=0)continue;const boss=e.type==='boss';if(e.phase==='windup')this.telegraph(e);actors.push({y:e.y,draw:()=>{this.sprite(e.type==='spirit'?'spirit':'boss',e.x,e.y,boss?101:e.type==='guard'?65:53,{alpha:e.hitFlash>0?.55:1,bob:e.type==='spirit'?Math.sin(t*3+e.x)*4:0,tint:e.phase==='windup'?'brightness(1.5)':''});if(!boss&&e.hp<e.maxHp){ctx.fillStyle='#0b101c';ctx.fillRect(e.x-18,e.y-70,36,4);ctx.fillStyle='#b991a9';ctx.fillRect(e.x-18,e.y-70,36*e.hp/e.maxHp,3);}}});}
  actors.push({y:player.y,draw:()=>{this.hero(player,t,game.mode==='explore');if(player.attack>0)this.slash(player,t);}});
  for(const tuple of map.props){const p=placedScenery(tuple);actors.push({y:p.sortY,draw:()=>{
   this.prop(ctx,p.kind,p.x,p.y);
   if(state.map==='sanctum'&&p.kind==='bed'&&!state.flags.rescued)this.sleeper(p.x,p.y,p.x<480?'morris':'io');
  }});}
  actors.sort((a,b)=>a.y-b.y).forEach(a=>a.draw());
  if(state.flags.night&&state.map==='inn'){ctx.fillStyle='#0c19342b';ctx.fillRect(0,0,960,600);}

  for(const [x,y,r]of map.lights){const gradient=ctx.createRadialGradient(x,y,2,x,y,r*(1+Math.sin(t*5+x)*.035));gradient.addColorStop(0,'#ffcc752a');gradient.addColorStop(.45,'#d68d3110');gradient.addColorStop(1,'#df7b2000');ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);}
  for(const f of fx){ctx.save();ctx.globalAlpha=Math.max(0,f.life/f.maxLife);if(f.text){ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.fillStyle=f.color||'#eed4a1';ctx.fillText(f.text,f.x,f.y-(1-f.life/f.maxLife)*24);}else{ctx.fillStyle=f.color;ctx.fillRect(f.x,f.y,3,3);}ctx.restore();}
  if(player.hitFlash>0){ctx.fillStyle=`rgba(154,48,64,${player.hitFlash*.35})`;ctx.fillRect(0,0,960,600);}ctx.restore();
 }
 drawObject(o,state,t){
  const ctx=this.ctx;
  if(o.type==='chest')this.sprite('chest',o.x,o.y-6,45,{tint:state.flags.key?'saturate(.6) brightness(.85)':''});
  if(o.type==='pickup'&&!state.flags[o.id]){
   if(o.id==='potion2'){
    ctx.fillStyle='#281f1d';ctx.fillRect(o.x-15,o.y-21,30,23);ctx.fillStyle='#765e3f';ctx.fillRect(o.x-13,o.y-19,26,18);
    ctx.fillStyle='#d5bd81';ctx.fillRect(o.x-3,o.y-17,6,14);ctx.fillRect(o.x-7,o.y-13,14,5);this.spark(o.x,o.y-8,t);
   }else this.spark(o.x,o.y,t,true);
  }
  if(['note','pipeNote','ledger','supplyNote','book'].includes(o.id)){
   ctx.fillStyle='#322b27';ctx.fillRect(o.x-10,o.y-14,22,17);ctx.fillStyle='#cab58a';ctx.fillRect(o.x-10,o.y-16,20,17);
   ctx.fillStyle='#e4d1a5';ctx.fillRect(o.x-9,o.y-15,9,15);ctx.fillStyle='#856c4a';ctx.fillRect(o.x,o.y-15,1,15);
   for(let k=0;k<3;k++){ctx.fillRect(o.x-7,o.y-12+k*4,5,1);ctx.fillRect(o.x+3,o.y-12+k*4,5,1);}
   if(['note','pipeNote'].includes(o.id)&&!state.flags[o.id])this.spark(o.x,o.y-15,t);
  }
  if(o.id==='sign'){
   ctx.fillStyle='#302c29';ctx.fillRect(o.x-36,o.y-49,72,31);ctx.fillStyle='#a48a5c';ctx.fillRect(o.x-34,o.y-47,68,27);
   ctx.fillStyle='#382a27';ctx.font='10px "DotGothic16", monospace';ctx.textAlign='center';ctx.fillText('← 客室  帳場 →',o.x,o.y-29);
  }
  if(o.id==='valves')this.valvePanel(o.x,o.y,state.flags.valves,t);
  if(o.id==='device')this.device(o.x,o.y,state.flags.rescued,t);
 }
 sleeper(x,y,kind){
  const ctx=this.ctx,rect=GUESTS[kind];
  // The head rests on the pillow, with a blanket over the lower body.
  ctx.drawImage(this.images.guests,...rect,x+30,y+28,35,60);
  ctx.fillStyle='#79383c';ctx.fillRect(x+17,y+77,61,28);
  ctx.fillStyle='#b78653';ctx.fillRect(x+17,y+77,61,3);
 }
 spark(x,y,t,bottle=false){const ctx=this.ctx;ctx.save();ctx.translate(x,y+Math.sin(t*3)*3);if(bottle){ctx.fillStyle='#283f46';ctx.fillRect(-7,-17,14,19);ctx.fillStyle='#719c91';ctx.fillRect(-5,-14,10,13);ctx.fillStyle='#d6b779';ctx.fillRect(-4,-21,8,6);ctx.fillStyle='#cfead277';ctx.fillRect(-3,-12,2,8);}ctx.fillStyle='#f0d397';ctx.globalAlpha=.5+Math.sin(t*3)*.3;ctx.fillRect(-1,-29,2,10);ctx.fillRect(-5,-25,10,2);ctx.restore();}
 valvePanel(x,y,on,t){const ctx=this.ctx;ctx.save();if(on)ctx.filter='saturate(.4)';ctx.drawImage(this.images.props,75,418,261,275,x-53,y-100,106,110);ctx.restore();}
 device(x,y,on,t){const ctx=this.ctx;ctx.save();if(on)ctx.filter='saturate(.1) brightness(.65)';ctx.drawImage(this.images.props,1169,402,159,304,x-28,y-93,56,107);ctx.restore();}

 hero(player,t,active){
  const ctx=this.ctx,{row,column}=heroAnimationFrame(player,{active}),source=HERO_ROWS[row];
  const x=Math.round(player.x),y=Math.round(player.y),scale=60/source.h;
  ctx.save();ctx.globalAlpha=player.invul>0&&Math.floor(t*14)%2?.42:1;
  ctx.fillStyle='#06091266';ctx.beginPath();ctx.ellipse(x,y+2,12,4,0,0,Math.PI*2);ctx.fill();
  ctx.drawImage(this.images.hero,source.xs[column],source.y,source.w,source.h,
   x-Math.round(source.anchor*scale),y-60,Math.round(source.w*scale),60);
  ctx.restore();
 }

 roomDetails(ctx,id){
  const rug=(x,y,w,h,color)=>{ctx.fillStyle='#080b163f';ctx.fillRect(x+4,y+5,w,h);ctx.fillStyle=color;ctx.fillRect(x,y,w,h);ctx.strokeStyle='#c5a16b66';ctx.lineWidth=2;ctx.strokeRect(x+5,y+5,w-10,h-10);ctx.strokeRect(x+9,y+9,w-18,h-18);for(let yy=y+16;yy<y+h-12;yy+=30){ctx.fillStyle='#c5a16b40';ctx.fillRect(x+w/2-2,yy,4,4);}};
  if(id==='hall'){rug(112,297,733,65,'#5b3439');}
  if(id==='guest'){
   ctx.fillStyle='#302b30';ctx.fillRect(724,36,80,91);ctx.fillStyle='#25435c';ctx.fillRect(732,44,64,72);ctx.fillStyle='#131e36';ctx.fillRect(736,48,56,63);ctx.fillStyle='#c6bf96';ctx.fillRect(776,55,7,9);ctx.fillStyle='#7490ab';ctx.fillRect(746,59,2,2);ctx.fillRect(766,90,2,2);ctx.fillStyle='#7d674a';ctx.fillRect(760,44,5,72);ctx.fillRect(732,79,64,5);ctx.fillRect(724,116,80,5);
   rug(593,248,211,134,'#34414e');
   ctx.fillStyle='#638ca121';ctx.beginPath();ctx.moveTo(730,130);ctx.lineTo(792,130);ctx.lineTo(804,290);ctx.lineTo(730,290);ctx.fill();
  }
  if(id==='office'){
   rug(508,265,201,113,'#3a4944');
  }
  if(['cellar','machine','storage'].includes(id)){
   const [left,top,right,bottom]=MAPS[id].bounds;
   ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
   ctx.strokeStyle='#3b44434d';ctx.lineWidth=2;
   for(const [x,y]of [[343,421],[814,316],[188,493]]){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+12,y+4);ctx.lineTo(x+7,y+13);ctx.lineTo(x+20,y+18);ctx.stroke();}
   ctx.restore();
  }
  if(id==='cellar'){
   ctx.strokeStyle='#a19a785c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(396,160);ctx.lineTo(448,183);ctx.lineTo(584,239);ctx.lineTo(871,250);ctx.moveTo(394,168);ctx.lineTo(447,192);ctx.lineTo(583,246);ctx.lineTo(870,258);ctx.stroke();
  }
  if(id==='machine'){
   for(const [color,offset]of [['#566d78',0],['#80554a',12],['#8c7750',24]]){
    ctx.strokeStyle='#10191f';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(80,80+offset);ctx.lineTo(185,80+offset);ctx.lineTo(185,135+offset);ctx.lineTo(737,135+offset);ctx.lineTo(737,190+offset);ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=5;ctx.stroke();
   }
   ctx.fillStyle='#17252baa';for(let x=440;x<525;x+=12)ctx.fillRect(x,272,6,51);
  }
  if(id==='sanctum'){
   ctx.strokeStyle='#786f8966';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(480,321,154,116,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#bca57733';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(480,321,140,105,0,0,Math.PI*2);ctx.stroke();
  }
  const labels={guest:'星見の間',office:'帳場',cellar:'地下',sanctum:'休眠室'};
  for(const o of MAPS[id].objects){if(o.type!=='door'||o.side!=='north'||!labels[o.id])continue;ctx.fillStyle='#171b22';ctx.fillRect(o.x+32,o.y-48,58,22);ctx.strokeStyle='#b199685c';ctx.strokeRect(o.x+32,o.y-48,58,22);ctx.font='11px "DotGothic16", monospace';ctx.textAlign='center';ctx.fillStyle='#cab797';ctx.fillText(labels[o.id],o.x+61,o.y-33);}
 }

 telegraph(enemy){
  const ctx=this.ctx;ctx.save();ctx.translate(enemy.x,enemy.y);
  const ring=enemy.attackType==='ring';ctx.strokeStyle=ring?'#cc9de0':'#eab081';ctx.fillStyle=ring?'#ae73cc2b':'#e1895033';ctx.lineWidth=2;
  ctx.beginPath();
  if(ring)ctx.arc(0,0,128,0,Math.PI*2);
  else{
   const {speed,duration,radius}=LUNGE[enemy.type],length=speed*duration;
   ctx.rotate(Math.atan2(enemy.ay,enemy.ax));ctx.moveTo(0,-radius);ctx.lineTo(length,-radius);ctx.arc(length,0,radius,-Math.PI/2,Math.PI/2);ctx.lineTo(0,radius);ctx.arc(0,0,radius,Math.PI/2,Math.PI*1.5);ctx.closePath();
  }
  ctx.fill();ctx.stroke();ctx.restore();
 }

 slash(p,t){const ctx=this.ctx;const angle={down:Math.PI/2,up:-Math.PI/2,left:Math.PI,right:0}[p.facing];ctx.save();ctx.translate(p.x,p.y-18);ctx.rotate(angle);ctx.strokeStyle='#f8e4b9';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,48,-.8,1);ctx.stroke();ctx.strokeStyle='#d4ac7088';ctx.lineWidth=10;ctx.beginPath();ctx.arc(0,0,44,-.6,.7);ctx.stroke();ctx.restore();}
}
