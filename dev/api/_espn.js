// ESPN's public-facing feed is unofficial and has no reliability/usage SLA.
import {httpError} from './_common.js';
const ORIGIN='https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const TEAM=['CIN','PIT'];
export const validWeek=w=>typeof w==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(w)&&!Number.isNaN(Date.parse(w+'T12:00:00Z'))&&new Date(w+'T12:00:00Z').toISOString().startsWith(w);
const dateNum=d=>d.toISOString().slice(0,10).replace(/-/g,'');
export async function getEvents(week){
 if(!validWeek(week))throw httpError(400,'Enter a valid week start date');
 const start=new Date(week+'T12:00:00Z'),end=new Date(start);end.setUTCDate(end.getUTCDate()+7);
 const url=ORIGIN+'?dates='+dateNum(start)+'-'+dateNum(end)+'&limit=100';
 let res;try{res=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'GridironGoldDev/1.0'},signal:AbortSignal.timeout(9000)});}catch{throw httpError(502,'ESPN score service is temporarily unreachable');}
 if(!res.ok)throw httpError(502,'ESPN score service returned '+res.status);
 let data;try{data=await res.json();}catch{throw httpError(502,'ESPN returned unreadable data');}
 if(!Array.isArray(data?.events))throw httpError(502,'ESPN returned an unexpected response');
 return data.events.filter(e=>e&&/^\d{5,15}$/.test(String(e.id||''))&&e.competitions?.[0]?.competitors?.some(c=>TEAM.includes(c.team?.abbreviation))).map(e=>{
  const competition=e.competitions[0],status=e.status||competition.status||{},ss=status.type||{};
  return {id:String(e.id),name:String(e.name||e.shortName||'NFL game').slice(0,100),date:e.date,
   period:Number(status.period||0),clock:status.displayClock||'',state:ss.state||'pre',completed:ss.completed===true||ss.name==='STATUS_FINAL',status:ss.shortDetail||ss.description||ss.name||'Scheduled',
   competitors:competition.competitors.map(c=>({team:c.team?.abbreviation||'',name:c.team?.displayName||'',score:parseScore(c.score),linescores:Array.isArray(c.linescores)?c.linescores.map(l=>parseScore(l.value??l.displayValue)):[]}))};
 });
}
function parseScore(v){const n=Number(v);return Number.isInteger(n)&&n>=0&&n<=250?n:null;}
export function teamGame(events,id,team){const e=events.find(x=>x.id===id);if(!e)return null;const player=e.competitors.find(c=>c.team===team);if(!player)return null;return {...e,team,teamScore:player.score,linescores:player.linescores,opponent:e.competitors.find(c=>c.team!==team)?.name||'Opponent'};}
export function buildLive(events,config){if(!config?.enabled)return {enabled:false,configured:false};const bengals=teamGame(events,config.bengalsId,'CIN'),steelers=teamGame(events,config.steelersId,'PIT');if(!bengals||!steelers)throw httpError(502,'Selected NFL games were not found in the ESPN feed; check the configured week');
 const scores=[bengals.teamScore,steelers.teamScore];const fresh=scores.every(n=>Number.isInteger(n));
 // Historical quarter totals: never infer a quarter-end score from the current live score.
 const snapshots=[1,2,3,4].map(q=>{
  const finalFor=g=>g.completed||(g.period>q)||(g.state==='post');
  const ready=[bengals,steelers].every(finalFor);
  const total=g=>q===4&&g.completed?g.teamScore:g.linescores.length>=q&&g.linescores.slice(0,q).every(Number.isInteger)?g.linescores.slice(0,q).reduce((a,b)=>a+b,0):null;
  const values=[total(bengals),total(steelers)];
  return {quarter:q,ready:ready&&values.every(Number.isInteger),scores:values};
 });
 return {enabled:true,configured:true,source:'ESPN unofficial NFL feed',week:config.week,updatedAt:new Date().toISOString(),fresh,scores,bengals,steelers,snapshots};
}
export function validateSelection(events,body){if(!validWeek(body.week))throw httpError(400,'Choose a valid week start date');const a=String(body.bengalsId||''),b=String(body.steelersId||'');if(!/^\d{5,15}$/.test(a)||!/^\d{5,15}$/.test(b))throw httpError(400,'Choose both NFL games');if(!teamGame(events,a,'CIN')||!teamGame(events,b,'PIT'))throw httpError(400,'Selected games must include the Bengals and Steelers');return {enabled:true,week:body.week,bengalsId:a,steelersId:b};}
