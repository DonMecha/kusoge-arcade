// The inn is a painted room. Source rectangles and floor footprints use the
// same 1536×1024 coordinate system, then scale with the background drawing.
const sx=960/1536,sy=600/1024;
const fixture=(id,source,footprint,interactionOwners=[])=>({
 id,source,x:source[0]*sx,y:source[1]*sy,width:source[2]*sx,height:source[3]*sy,
 sortY:(footprint[1]+footprint[3])*sy,
 wall:{x:footprint[0]*sx,y:footprint[1]*sy,w:footprint[2]*sx,h:footprint[3]*sy,owner:id,interactionOwners}
});
export const INN_FIXTURES=[
 fixture('counter',[574,172,385,111],[574,205,385,75],['mira','book']),
 fixture('lounge',[130,219,219,85],[130,248,219,56],['rest']),
 fixture('left-table',[91,404,151,210],[91,454,151,156]),
 fixture('right-table',[1294,404,151,210],[1294,454,151,156]),
 fixture('west-plant',[29,316,66,91],[41,368,43,39]),
 fixture('east-plant',[1434,307,67,98],[1444,367,43,38]),
 fixture('stair-barrel',[1433,244,55,62],[1434,270,53,36]),
 fixture('stair-left-post',[1209,13,38,242],[1210,222,36,33]),
 fixture('stair-right-post',[1336,13,40,242],[1337,222,38,33]),
 fixture('entry-left-plant',[566,869,80,107],[580,932,58,37]),
 fixture('entry-right-plant',[896,869,68,107],[908,932,51,37]),
 fixture('southwest-plant',[37,779,59,127],[40,851,49,55]),
 fixture('southeast-plant',[1433,779,63,128],[1439,852,50,55])
];
// Painted tables contain gaps between chairs; do not repaint the floor in
// those gaps over an actor walking behind them. Masks are in source pixels.
for(const f of INN_FIXTURES){
 if(f.id==='left-table'||f.id==='right-table'){
  const dx=f.id==='left-table'?0:1203;
  f.clips=[[99+dx,409,45,55],[185+dx,409,45,55],[94+dx,450,147,100],[100+dx,545,45,64],[183+dx,545,46,64]];
 }
}
const item=(id,x,y,label,type='inspect',extra={})=>({id,type,x,y,label,radius:65,...extra});
export const INN_LAYOUT={
 name:'月灯り亭',sub:'THE MOONLIT INN',theme:'inn',safe:true,
 bounds:[38,124,922,534],props:[],structuralWalls:[],
 walls:INN_FIXTURES.map(f=>f.wall),
 lights:[[153,89,125],[372,112,90],[603,39,75],[35,264,90],[920,264,90],[412,510,100],[546,510,100]],
 objects:[
  item('mira',480,191,'ミラと話す','npc'),
  item('morris',190,331,'モーリスと話す','npc'),
  item('io',771,337,'イオと話す','npc'),
  {id:'stairs',type:'door',x:806,y:155,label:'二階へ上がる',target:'hall',spawn:[165,400],radius:58,side:'north',hitbox:{x:767,y:46,w:82,h:127}},
  item('rest',150,190,'暖炉のそばで休む','rest',{hitbox:{x:81,y:129,w:138,h:65}}),
  item('exit',480,529,'宿の外へ','inspect',{hitbox:{x:446,y:521,w:68,h:62}}),
  item('book',565,145,'宿帳を読む','inspect',{sortY:165})
 ],enemies:[]
};
