export class AudioEngine{
 constructor(){this.ctx=null;this.enabled=false;this._volume=.4;this.master=null;this.voices=new Set();this.timer=null;this.step=0;this.dark=false;this.enableRevision=0;this.enablePending=null;}
 get volume(){return this._volume;}
 set volume(value){if(!Number.isFinite(value))return;this._volume=Math.max(0,Math.min(1,value));this.updateVolume();}
 updateVolume(){if(!this.master)return;const now=this.ctx.currentTime;this.master.gain.cancelScheduledValues(now);this.master.gain.setValueAtTime(this.enabled?this._volume:0,now);}
 enable(){
  if(this.enabled)return Promise.resolve(true);
  if(this.enablePending)return this.enablePending;
  const revision=this.enableRevision;
  try{
   if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=0;this.master.connect(this.ctx.destination);}
   const pending=Promise.resolve(this.ctx.resume()).then(()=>{
    // A mute pressed while resume() is pending must remain in effect.
    if(revision!==this.enableRevision)return false;
    this.enabled=true;this.updateVolume();this.startMusic();return true;
   }).catch(()=>false).finally(()=>{if(this.enablePending===pending)this.enablePending=null;});
   this.enablePending=pending;return pending;
  }catch{return Promise.resolve(false);}
 }
 disable(){
  this.enabled=false;this.enableRevision++;this.enablePending=null;this.updateVolume();
  if(this.timer!==null)clearInterval(this.timer);this.timer=null;
  // Stop both sounding and delayed notes so unmuting cannot revive old effects.
  for(const voice of this.voices){voice.oscillator.stop(this.ctx.currentTime);voice.oscillator.disconnect();voice.gain.disconnect();}
  this.voices.clear();
 }
 tone(freq,duration=.2,type='sine',gain=.12,delay=0){
  if(!this.enabled||!this.ctx)return;
  const now=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain(),voice={oscillator:o,gain:g};
  o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(gain,now+.014);g.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(g).connect(this.master);
  this.voices.add(voice);o.onended=()=>{o.disconnect();g.disconnect();this.voices.delete(voice);};o.start(now);o.stop(now+duration+.02);
 }
 play(name){const seq={confirm:[[440,.12],[660,.2,.08]],item:[[392,.12],[494,.15,.1],[587,.3,.2]],door:[[130,.18],[165,.18,.08]],attack:[[190,.09],[110,.12,.04]],hurt:[[110,.18],[80,.22,.05]],dodge:[[300,.08],[500,.1,.03]],lock:[[180,.1]],bell:[[523,1.8],[659,1.3,.2],[784,1.6,.4]],win:[[294,.3],[370,.3,.15],[440,.3,.3],[587,1,.5]]}[name]||[[330,.1]];for(const [f,d,delay]of seq)this.tone(f,d,name==='attack'||name==='hurt'?'triangle':'sine',.16,delay||0);}
 startMusic(){if(this.timer!==null)clearInterval(this.timer);const melody=[293.66,349.23,440,392,349.23,329.63,261.63,293.66,220,261.63,329.63,293.66,261.63,220,196,220];this.timer=setInterval(()=>{if(document.hidden||!this.enabled)return;const i=this.step++%melody.length;this.tone(melody[i]*(this.dark?.5:1),1.9,'triangle',.055);if(i%4===0){this.tone(i<8?146.83:130.81,3.8,'sine',.075);this.tone(i<8?220:196,3.8,'sine',.025);}},720);}
}
