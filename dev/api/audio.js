import {get,put} from '@vercel/blob';
import {load,assertOwner,requirePost,respond,failure,httpError} from './_common.js';

// Audio assets are generated only by the authenticated owner and then served
// as cached private Blob objects to spectators. The API key never leaves Vercel.
const CLIPS = Object.freeze({
  score: {kind:'sfx',seconds:4,prompt:'Authentic American professional football stadium crowd reacting to a score: a huge lively roar of 60,000 fans cheering and clapping, excited whoops, broad stereo stadium ambience, close and distant spectators, natural decay. No music, no words, no announcer.'},
  touchdown: {kind:'sfx',seconds:5,prompt:'Huge professional American football stadium touchdown celebration. Fans erupt in a powerful sustained joyful roar, thousands cheering and stomping with distant air horns and applause, immersive outdoor stadium acoustics. No music, no intelligible speech.'},
  jackpot: {kind:'sfx',seconds:5,prompt:'Grand sports game-show winner celebration: bright triumphant brass stinger, lively stadium crowd cheering, sparkling celebratory accents, satisfying big jackpot reveal sound, polished professional sports-broadcast mix. No lyrics or spoken words.'},
  voice_score: {kind:'voice',text:'And the score changes! Keep your eyes on that winning square!'},
  voice_touchdown: {kind:'voice',text:'TOUCHDOWN! The stadium is going wild!'},
  voice_winner: {kind:'voice',text:'Ladies and gentlemen, we have a winner! Congratulations to our football squares champion!'}
});
const path = id => `football-squares/elevenlabs-audio-v1/${id}.mp3`;
const key=()=>process.env.ELEVENLABS_API_KEY;
async function asset(id){return get(path(id),{access:'private',useCache:false});}

export default async function handler(req,res){
 try{
  if(req.method==='GET'){
   const clip=String(req.query.clip||'');
   if(clip){
    if(!Object.hasOwn(CLIPS,clip))throw httpError(404,'Unknown audio clip');
    const found=await asset(clip);
    if(!found)throw httpError(404,'Clip has not been generated yet');
    const binary=Buffer.from(await new Response(found.stream).arrayBuffer());
    res.status(200).setHeader('Content-Type','audio/mpeg').setHeader('Content-Length',binary.length)
     .setHeader('Cache-Control','public, max-age=300').setHeader('X-Content-Type-Options','nosniff').send(binary);
    return;
   }
   const available={};
   await Promise.all(Object.keys(CLIPS).map(async id=>{try{available[id]=!!(await asset(id));}catch{available[id]=false;}}));
   return respond(res,200,{configured:!!key(),available,clips:Object.keys(CLIPS)});
  }
  requirePost(req);
  const {state}=await load();assertOwner(req,state);
  const clip=String(req.body?.clip||'');
  const definition=CLIPS[clip];if(!definition)throw httpError(400,'Choose a supported audio clip');
  if(!key())throw httpError(503,'Set ELEVENLABS_API_KEY in Vercel environment variables first');
  // To avoid accidental credit consumption, do not regenerate existing clips.
  if(await asset(clip))throw httpError(409,'Audio already generated. Choose a different clip.');
  const voiceId=process.env.ELEVENLABS_VOICE_ID||'JBFqnCBsd6RMkjVDRZzb';
  if(!/^[A-Za-z0-9]{12,40}$/.test(voiceId))throw httpError(503,'Invalid ELEVENLABS_VOICE_ID');
  const url=definition.kind==='voice'
    ?`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`
    :'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128';
  const body=definition.kind==='voice'
    ?{text:definition.text,model_id:'eleven_v3',voice_settings:{stability:0.5,similarity_boost:0.75}}
    :{text:definition.prompt,model_id:'eleven_text_to_sound_v3',duration_seconds:definition.seconds,prompt_influence:0.6};
  const response=await fetch(url,{method:'POST',headers:{'xi-api-key':key(),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
  if(!response.ok){console.error('ElevenLabs generation failed',response.status);throw httpError(502,`ElevenLabs declined the request (HTTP ${response.status}). Check credits, API permissions, or voice ID.`)}
  const buffer=Buffer.from(await response.arrayBuffer());
  if(!buffer.length||buffer.length>8*1024*1024)throw httpError(502,'Generated audio file was empty or too large');
  await put(path(clip),buffer,{access:'private',contentType:'audio/mpeg',addRandomSuffix:false});
  return respond(res,200,{ok:true,clip,bytes:buffer.length});
 }catch(e){failure(res,e)}
}