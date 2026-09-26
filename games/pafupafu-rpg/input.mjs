const MOVEMENT_KEYS=new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright']);

// Native controls keep their keyboard behavior; shortcuts belong to the playfield.
export function gameKeyAction(event,{mode,nativeControl=false,dialogueControl=false}={}){
 if(event.metaKey||event.ctrlKey||event.altKey||event.isComposing)return null;
 const key=event.key.toLowerCase();
 if(nativeControl&&!dialogueControl)return null;
 if(mode==='title')return key==='enter'&&!event.repeat?'start':null;
 if(mode==='dialogue')return ['e','enter',' ','escape','j'].includes(key)?'advance':null;
 if(mode!=='explore')return null;
 if(MOVEMENT_KEYS.has(key))return 'move';
 if(key==='tab')return event.shiftKey?null:'journal';
 return {e:'interact',enter:'interact',j:'attack',' ':'attack',k:'dodge',shift:'dodge',q:'potion',escape:'menu'}[key]||null;
}
