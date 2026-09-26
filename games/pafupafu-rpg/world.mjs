import {sceneryWalls,objectWalls,placedScenery} from './scenery.mjs?v=0.3.0';
import {INN_LAYOUT} from './inn-layout.mjs?v=0.3.0';
const door=(id,x,y,label,target,spawn,side,require)=>({id,type:'door',x,y,label,target,spawn,side,require,radius:62,stairs:(id==='inn'&&target==='inn')||(id==='hall'&&target==='hall'&&side==='south'&&y===540)});
const item=(id,x,y,label,type='inspect')=>({id,type,x,y,label,radius:65});
const room=data=>{
 const objects=data.objects.map(object=>{
  // A bed or a seat is itself the thing being inspected. Its whole visible
  // shape is clickable; small papers retain their own focused hit area.
  const tuple=data.props.find(prop=>prop[3]===object.id&&['bed','bench'].includes(prop[0]));
  if(object.hitbox||!tuple)return object;
  const {x,y,width,height}=placedScenery(tuple);
  return {...object,hitbox:{x,y,w:width,h:height}};
 });
 return {...data,objects,structuralWalls:data.structuralWalls??[],walls:[...(data.structuralWalls??[]),...sceneryWalls(data.props),...objectWalls(objects)]};
};

export const MAPS={
 inn:INN_LAYOUT,
 hall:room({
  name:'客室廊下',sub:'THE QUIET CORRIDOR',theme:'wood',safe:true,bounds:[55,205,905,440],
  props:[['shelf',82,101],['plant',850,174],['bench',550,170],['column',445,141],['lamp',345,130],['lamp',806,130]],
  lights:[[356,160,100],[817,160,110]],
  objects:[door('inn',160,440,'受付へ戻る','inn',[799,238],'south'),door('guest',260,205,'客室に入る','guest',[482,430],'north'),door('office',720,205,'帳場に入る','office',[480,400],'north'),door('cellar',905,365,'地下機関室へ','cellar',[481,493],'east','key'),{...item('sign',407,207,'案内板を読む'),hitbox:{x:371,y:158,w:72,h:49},sortY:205}],enemies:[]
 }),
 guest:room({
  name:'星見の客室',sub:'A ROOM LEFT EMPTY',theme:'wood',safe:true,bounds:[160,143,810,475],
  props:[['desk',205,107,'note'],['shelf',410,39],['bed',650,121,'bed'],['plant',757,125],['lamp',318,70]],
  lights:[[329,100,125],[792,120,90]],
  objects:[door('hall',480,475,'廊下へ戻る','hall',[261,273],'south'),item('note',280,151,'従業員の手帳を読む'),item('potion1',558,390,'回復薬を拾う','pickup'),item('bed',692,270,'空の寝台を調べる')],enemies:[]
 }),
 office:room({
  name:'宿の帳場',sub:'THE KEEPER’S OFFICE',theme:'wood',safe:true,bounds:[220,143,795,440],
  props:[['shelf',250,39],['desk',545,188,'ledger'],['lamp',515,70],['plant',740,125]],
  lights:[[526,100,135],[647,218,90]],
  objects:[door('hall',480,440,'廊下へ戻る','hall',[720,273],'south'),item('chest',400,250,'絵柄の箱を開ける','chest'),item('ledger',619,232,'古い伝票を読む')],enemies:[]
 }),
 cellar:room({
  name:'地下貯蔵庫',sub:'BENEATH THE FLOORBOARDS',theme:'stone',safe:false,bounds:[55,140,905,540],
  props:[['shelf',123,36],['barrel',265,190],['barrel',265,300],['crates',530,107],['crates',580,300],['crates',655,300],['lamp',821,70]],
  lights:[[170,138,100],[832,100,120]],
  objects:[door('hall',480,540,'二階へ戻る','hall',[855,365],'south'),door('storage',55,330,'備品室へ','storage',[775,330],'west'),door('machine',905,250,'蒸気の機関室へ','machine',[110,435],'east'),item('scratch',405,161,'床の跡を調べる')],
  enemies:[{id:'cellar-0',type:'spirit',x:390,y:321,hp:3},{id:'cellar-1',type:'spirit',x:708,y:225,hp:3}]
 }),
 storage:room({
  name:'小さな備品室',sub:'A MOMENT OF RESPITE',theme:'stone',safe:true,bounds:[145,145,825,470],
  props:[['shelf',170,41],['desk',425,109,'supplyNote'],['lamp',675,70],['barrel',255,315],['bench',640,110,'rest']],
  lights:[[686,105,145]],
  objects:[door('cellar',825,330,'貯蔵庫へ戻る','cellar',[110,330],'east'),item('potion2',405,282,'救急箱を開ける','pickup'),item('supplyNote',498,153,'守衛の整備記録を読む'),item('rest',710,194,'灯りのそばで休む','rest')],enemies:[]
 }),
 machine:room({
  name:'蒸気の機関室',sub:'THREE VALVES',theme:'machine',safe:false,bounds:[55,143,905,540],
  props:[['desk',225,230,'pipeNote'],['column',549,137],['barrel',665,344],['crates',760,344],['lamp',817,70]],
  lights:[[260,182,90],[828,105,115]],
  objects:[door('cellar',55,435,'貯蔵庫へ戻る','cellar',[850,250],'west'),door('sanctum',477,143,'奥の休眠室へ','sanctum',[480,488],'north','valves'),item('pipeNote',299,274,'配管メモを読む'),item('valves',747,230,'三つのバルブを回す','puzzle'),item('potion3',838,487,'回復薬を拾う','pickup')],
  enemies:[{id:'machine-0',type:'guard',x:484,y:377,hp:5},{id:'machine-1',type:'spirit',x:800,y:326,hp:3}]
 }),
 sanctum:room({
  name:'夢見の休眠室',sub:'THE SLEEPLESS GUARDIAN',theme:'sanctum',safe:false,bounds:[65,142,895,540],
  props:[['bed',110,120,'sleepers'],['bed',710,120,'sleepersRight'],['lamp',279,70],['lamp',655,70]],
  lights:[[290,100,100],[666,100,100],[480,170,140]],
  objects:[door('machine',480,540,'機関室へ戻る','machine',[478,210],'south'),item('device',480,165,'夢見の装置を止める','device'),item('sleepers',208,238,'眠っている客を調べる'),item('sleepersRight',807,238,'眠っている客を調べる'),door('shortcut',895,476,'受付への扉を開ける','inn',[810,445],'east','rescued')],
  enemies:[{id:'sanctum-0',type:'boss',x:480,y:318,hp:20}]
 })
};
