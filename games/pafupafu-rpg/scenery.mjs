// Source windows and floor occupancy are authored together. x/y always locate
// the top-left of the visible sprite; a footprint describes its contact with
// the floor, not its height. Tall furniture can therefore occlude actors.
export const PROP_DEFS=Object.freeze({
 bed:{source:[115,53,180,325],size:[95,148],footprint:[7,22,81,121],sortY:143},
 desk:{source:[436,93,244,252],size:[125,100],footprint:[4,36,117,61],sortY:97},
 shelf:{source:[783,49,228,314],size:[115,130],footprint:[5,104,105,24],sortY:128},
 plant:{source:[110,776,195,231],size:[40,48],footprint:[9,31,23,15],sortY:46},
 bench:{source:[1102,820,292,165],size:[140,70],footprint:[7,35,126,32],sortY:67},
 barrel:{source:[775,443,253,234],size:[88,81],footprint:[3,23,82,56],sortY:79},
 // The reference is a wall sconce. It has no floor collision and belongs on a wall.
 lamp:{source:[485,756,148,260],size:[23,40],footprint:null,sortY:40},
 column:{source:[491,421,132,251],size:[45,86],footprint:[3,64,39,20],sortY:84},
 crates:{source:[779,762,235,251],size:[75,80],footprint:[3,33,69,45],sortY:78}
});

export function placedScenery([kind,x,y,owner]){
 const def=PROP_DEFS[kind];
 if(!def)throw new Error(`Unknown scenery: ${kind}`);
 const [width,height]=def.size;
 const wall=def.footprint?{x:x+def.footprint[0],y:y+def.footprint[1],w:def.footprint[2],h:def.footprint[3],kind,owner:owner??null}:null;
 return {kind,x,y,source:def.source,width,height,sortY:y+def.sortY,wall};
}

export function sceneryWalls(props){
 return props.flatMap((prop,index)=>{
  const {wall}=placedScenery(prop);
  return wall?[{...wall,owner:wall.owner??`scenery:${index}`}]:[];
 });
}

// Interactive fixtures are drawn around the object's x/y rather than from a
// sprite corner. Keep their solid base next to the matching drawing bounds.
export const OBJECT_FOOTPRINTS=Object.freeze({
 chest:[-21,-19,42,13],
 puzzle:[-45,-18,90,27],
 device:[-21,-5,42,19]
});
export function objectWalls(objects){
 return objects.flatMap(o=>{
  const f=OBJECT_FOOTPRINTS[o.type];
  return f?[{x:o.x+f[0],y:o.y+f[1],w:f[2],h:f[3],kind:o.type,owner:o.id}]:[];
 });
}
