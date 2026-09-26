const SETTINGS_KEY='pafupafu:settings';
function normalizeSettings(raw,fallback){
 const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 return {
  difficulty:source.difficulty==='normal'||source.difficulty==='story'?source.difficulty:fallback.difficulty,
  volume:Number.isFinite(source.volume)?Math.max(0,Math.min(1,source.volume)):fallback.volume,
  reducedMotion:typeof source.reducedMotion==='boolean'?source.reducedMotion:fallback.reducedMotion
 };
}

/** Preferences are separate from adventure saves and never enable audio. */
export class SettingsStore{
 constructor({storage,reducedMotionDefault=false}={}){
  this.suppliedStorage=storage;this.defaults={difficulty:'normal',volume:.4,reducedMotion:!!reducedMotionDefault};
  this.current={...this.defaults};this.loaded=false;this.canPersist=null;
 }
 storage(){return this.suppliedStorage===undefined?globalThis.localStorage:this.suppliedStorage;}
 load(){
  this.current={...this.defaults};
  try{
   const serialized=this.storage().getItem(SETTINGS_KEY);this.canPersist=true;
   if(serialized){const raw=JSON.parse(serialized);if(raw?.version===1)this.current=normalizeSettings(raw,this.defaults);}
  }catch{this.canPersist=false;}
  this.loaded=true;return {...this.current};
 }
 save(patch){
  if(!this.loaded)this.load();
  this.current=normalizeSettings(patch,this.current);
  try{this.storage().setItem(SETTINGS_KEY,JSON.stringify({version:1,...this.current}));this.canPersist=true;}catch{this.canPersist=false;}
  return {...this.current};
 }
}
