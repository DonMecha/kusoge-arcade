import {findPath,lineClear} from './core.mjs?v=0.3.0';
export {lineClear} from './core.mjs?v=0.3.0';

const routes = new WeakMap();
const still = () => ({x:0,y:0});

export function resetEnemyNavigation(enemy){routes.delete(enemy);}

/** Returns a unit movement vector; the caller applies speed and collision handling. */
export function navigateEnemy(map,enemy,target,dt,{radius=14,replanInterval=.5,waypointTolerance=4}={}){
 const toward=point=>{const dx=point.x-enemy.x,dy=point.y-enemy.y,distance=Math.hypot(dx,dy);return distance>.001?{x:dx/distance,y:dy/distance}:still();};
 if(lineClear(map,enemy,target,radius)){routes.delete(enemy);return toward(target);}
 let route=routes.get(enemy);
 if(route)route.remaining-=Math.max(0,Number.isFinite(dt)?dt:0);
 if(!route||route.map!==map||route.radius!==radius||route.remaining<=0){
  route={map,radius,remaining:Math.max(.1,replanInterval),points:findPath(map,enemy,target,radius)};
  routes.set(enemy,route);
 }
 while(route.points.length&&Math.hypot(route.points[0].x-enemy.x,route.points[0].y-enemy.y)<=waypointTolerance)route.points.shift();
 // Skip visible waypoints, but never cut an obstacle's corner with the body radius.
 for(let i=route.points.length-1;i>=0;i--){
  if(lineClear(map,enemy,route.points[i],radius)){
   if(i)route.points.splice(0,i);
   return toward(route.points[0]);
  }
 }
 return still();
}
