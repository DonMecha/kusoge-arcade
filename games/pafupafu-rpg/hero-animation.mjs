const ROWS=Object.freeze({down:0,left:1,right:2,up:3});
const WALK_COLUMNS=Object.freeze([0,1,2,1]);
export const HERO_WALK_STEP=14;
const WALK_CYCLE=HERO_WALK_STEP*WALK_COLUMNS.length;

// Advance after collision has resolved, using actual travel rather than input
// or wall-clock time. Animation state is optional on newly loaded players.
export function advanceHeroAnimation(player,distanceMoved,{
 moving=player.moving,attacking=player.attack>0,dodging=player.dodge>0,active=true
}={}){
 player.heroWalking=!!(active&&moving&&!attacking&&!dodging&&Number.isFinite(distanceMoved)&&distanceMoved>0);
 if(!player.heroWalking){player.heroWalkDistance=0;return;}
 const previous=Number.isFinite(player.heroWalkDistance)&&player.heroWalkDistance>=0?player.heroWalkDistance:0;
 player.heroWalkDistance=(previous+distanceMoved)%WALK_CYCLE;
}

// Reading a frame never changes state. Call with active:false outside gameplay
// so dialogue and menus display the center (standing) pose immediately.
export function heroAnimationFrame(player,{active=true}={}){
 const row=ROWS[player.facing]??ROWS.down;
 const walking=active&&player.heroWalking&&player.moving!==false&&!(player.attack>0)&&!(player.dodge>0);
 const distance=Number.isFinite(player.heroWalkDistance)&&player.heroWalkDistance>=0?player.heroWalkDistance%WALK_CYCLE:0;
 return {row,column:walking?WALK_COLUMNS[Math.floor(distance/HERO_WALK_STEP)]:1};
}
