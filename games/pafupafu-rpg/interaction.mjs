import {findPath,walkable,lineClear} from './core.mjs?v=0.3.0';

// Hit areas follow the visible drawing, whose origin is usually at its feet.
export function objectBounds(object){
 if(object.hitbox)return object.hitbox;
 const {x,y,type,id}=object;
 if(type==='npc')return {x:x-28,y:y-66,w:56,h:76};
 if(type==='door'){
  if(object.side==='north')return {x:x-31,y:y-81,w:62,h:112};
  if(object.side==='south')return {x:x-38,y:y-33,w:76,h:74};
  if(object.side==='west')return {x:x-23,y:y-50,w:65,h:75};
  if(object.side==='east')return {x:x-42,y:y-50,w:65,h:75};
  return {x:x-31,y:y-73,w:62,h:88};
 }
 if(id==='valves')return {x:x-59,y:y-106,w:118,h:122};
 if(id==='device')return {x:x-34,y:y-99,w:68,h:119};
 if(type==='chest')return {x:x-32,y:y-57,w:64,h:66};
 return {x:x-25,y:y-32,w:50,h:52};
}

export function objectAt(objects,x,y){
 return [...objects].sort((a,b)=>b.y-a.y).find(object=>{
  const box=objectBounds(object);
  return x>=box.x&&x<=box.x+box.w&&y>=box.y&&y<=box.y+box.h;
 })||null;
}

export function canInteract(map,position,object){
 if(Math.hypot(object.x-position.x,object.y-position.y)>=(object.radius||65))return false;
 // Reading a book on its own desk is intentional; reaching through a different
 // shelf or through the room's architecture is not. Door centres may sit just
 // outside the walkable floor, so room bounds do not obstruct interaction rays.
 const walls=map.walls.filter(wall=>wall.owner!==object.id&&!wall.interactionOwners?.includes(object.id));
 return lineClear({bounds:[-Infinity,-Infinity,Infinity,Infinity],walls},position,object,0);
}

export function pathToObject(map,start,object){
 if(canInteract(map,start,object))return [{x:start.x,y:start.y}];
 const near=Math.min(38,(object.radius||65)-20),far=(object.radius||65)-1;
 const directions=[[0,1],[-1,0],[1,0],[0,-1],[-Math.SQRT1_2,Math.SQRT1_2],[Math.SQRT1_2,Math.SQRT1_2],[-Math.SQRT1_2,-Math.SQRT1_2],[Math.SQRT1_2,-Math.SQRT1_2]];
 const candidates=[near,far].flatMap(distance=>directions.map(([dx,dy])=>({x:object.x+dx*distance,y:object.y+dy*distance})))
  .filter(point=>walkable(map,point.x,point.y,10)&&canInteract(map,point,object));
 const length=path=>{let previous=start,total=0;for(const point of path){total+=Math.hypot(point.x-previous.x,point.y-previous.y);previous=point;}return total;};
 const paths=candidates.map(point=>findPath(map,start,point,10)).filter(path=>path.length);
 return paths.sort((a,b)=>length(a)-length(b))[0]||[];
}

export function followPath(position,path){
 // Reach each corner before turning; an early turn clips furniture hitboxes.
 while(path.length&&Math.hypot(path[0].x-position.x,path[0].y-position.y)<.001)path.shift();
 if(!path.length)return {x:0,y:0,distance:0};
 const dx=path[0].x-position.x,dy=path[0].y-position.y,distance=Math.hypot(dx,dy);
 return {x:dx/distance,y:dy/distance,distance};
}
