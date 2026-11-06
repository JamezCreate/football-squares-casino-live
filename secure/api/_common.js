import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { createHmac, timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';

const STORE_KEY = 'football-squares/season-state-v1.json';
const COOKIE = 'fs_owner';
const TOKEN_TTL = 12 * 60 * 60;

export function defaults() {
  return {
    schema: 1, revision: 0,
    names: Array(100).fill(''),
    games: [{ id:'week-1', label:'Week 1', cols:[0,1,2,3,4,5,6,7,8,9], rows:[0,1,2,3,4,5,6,7,8,9], scores:[0,0], quarter:0, winners:[], createdAt:new Date().toISOString() }],
    activeId: 'week-1', owner:null, audit:[], updatedAt: new Date().toISOString()
  };
}
export async function load() {
  const b = await get(STORE_KEY,{access:'private',useCache:false});
  if (!b) return {state:defaults(),etag:null};
  const state = JSON.parse(await new Response(b.stream).text());
  return {state,etag:b.etag};
}
export async function change(fn) {
  for (let i=0;i<5;i++) {
    const {state,etag}=await load();
    const result=await fn(state);
    const next={...state,revision:(state.revision||0)+1,updatedAt:new Date().toISOString()};
    try {
      await put(STORE_KEY,JSON.stringify(next),{access:'private',contentType:'application/json',allowOverwrite:!!etag,ifMatch:etag||undefined});
      return {state:next,result};
    }catch(e) {
      if (e instanceof BlobPreconditionFailedError || e?.name==='BlobPreconditionFailedError' || e?.status===412 || e?.status===409)continue;
      throw e;
    }
  }
  throw httpError(409,'The board changed during this update. Please retry.');
}
export function httpError(status,message){return Object.assign(new Error(message),{status});}
export function respond(res,status,data){res.status(status).setHeader('Cache-Control','no-store').setHeader('Content-Type','application/json; charset=utf-8').json(data);}
export function failure(res,e){console.error('API error:',e?.message);return respond(res,e?.status||500,{error:e?.status?e.message:'Server error. Please try again.'});}
export function requirePost(req){if(req.method!=='POST')throw httpError(405,'Method not allowed'); const origin=req.headers.origin;const host=req.headers.host;if(!origin||new URL(origin).host!==host||!/^https?:$/.test(new URL(origin).protocol))throw httpError(403,'Origin check failed');if(Number(req.headers['content-length']||0)>30000)throw httpError(413,'Request too large');}
function mac(input){if(!process.env.SESSION_SECRET)throw httpError(503,'Session configuration unavailable');return createHmac('sha256',process.env.SESSION_SECRET).update(input).digest('base64url');}
export function safeMatch(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);}
function cookieVal(req){const m=String(req.headers.cookie||'').match(/(?:^|;\s*)fs_owner=([^;]+)/);return m?.[1];}
export function authenticated(req,state){const token=cookieVal(req);if(!token||!state.owner)return false;const chunks=token.split('.');if(chunks.length!==2||!safeMatch(mac(chunks[0]),chunks[1]))return false;try{const payload=JSON.parse(Buffer.from(chunks[0],'base64url').toString());return payload.scope==='owner'&&payload.exp>Date.now()&&payload.v===state.owner.authVersion;}catch{return false;}}
export function setCookie(res,state){const payload=Buffer.from(JSON.stringify({scope:'owner',exp:Date.now()+TOKEN_TTL*1000,v:state.owner.authVersion})).toString('base64url');res.setHeader('Set-Cookie',`${COOKIE}=${payload}.${mac(payload)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TOKEN_TTL}`);}
export function clearCookie(res){res.setHeader('Set-Cookie',`${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);}
export function hashPassword(password,salt){return scryptSync(password,salt,64).toString('hex');}
export function ownerRecord(password){const salt=randomBytes(24).toString('hex');return {salt,hash:hashPassword(password,salt),authVersion:randomBytes(12).toString('hex')};}
export function assertOwner(req,state){if(!authenticated(req,state))throw httpError(401,'Owner login required');}
export function requireString(v,max=80){if(typeof v!=='string'||v.length>max)throw httpError(400,'Invalid text');return v.trim();}
export function validDigits(a){return Array.isArray(a)&&a.length===10&&a.every(v=>Number.isInteger(v)&&v>=0&&v<=9)&&new Set(a).size===10;}
export function publicState(s){return {schema:s.schema,revision:s.revision,names:s.names,games:s.games,activeId:s.activeId,updatedAt:s.updatedAt,ownerConfigured:!!s.owner};}
export function audit(s,action,details){s.audit.push({id:randomBytes(12).toString('hex'),time:new Date().toISOString(),action,details});s.audit=s.audit.slice(-200);}