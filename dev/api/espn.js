import {load,change,respond,failure,httpError,requirePost,assertOwner,audit,publicState} from './_common.js';
import {getEvents,buildLive,validateSelection,validWeek} from './_espn.js';
export default async function handler(req,res){try{
 if(process.env.ESPN_DEV_ENABLED!=='true')throw httpError(404,'ESPN integration is unavailable in this environment');
 if(req.method==='GET'){
  if(req.query.mode==='games'){
   const week=String(req.query.week||'');if(!validWeek(week))throw httpError(400,'Choose a week start date');
   const events=await getEvents(week);return respond(res,200,{week,events:events.map(e=>({...e,competitors:e.competitors.map(c=>({team:c.team,name:c.name,score:c.score}))}))});
  }
  const {state}=await load(),game=state.games.find(g=>g.id===String(req.query.gameId||state.activeId));
  if(!game)throw httpError(404,'Game not found');if(!game.espn?.enabled)return respond(res,200,{enabled:false,configured:false,gameId:game.id});
  const events=await getEvents(game.espn.week);return respond(res,200,{...buildLive(events,game.espn),gameId:game.id});
 }
 requirePost(req);const body=req.body||{};const {state:old}=await load();assertOwner(req,old);
 const game=old.games.find(g=>g.id===old.activeId);if(!game)throw httpError(404,'Active game missing');
 if(body.action==='configure'){
   if(game.quarter>0)throw httpError(409,'Configure ESPN before recording any quarter winners');
   const events=await getEvents(body.week),config=validateSelection(events,body);
   const {state}=await change(s=>{assertOwner(req,s);const g=s.games.find(x=>x.id===s.activeId);if(g.quarter>0)throw httpError(409,'Cannot change ESPN games after winner confirmation');g.espn=config;audit(s,'espnConfigure',{gameId:g.id,week:config.week,bengalsId:config.bengalsId,steelersId:config.steelersId});});
   return respond(res,200,{...publicState(state),isOwner:true});
 }
 if(body.action==='disable'){
   const {state}=await change(s=>{assertOwner(req,s);const g=s.games.find(x=>x.id===s.activeId);if(g.quarter>0)throw httpError(409,'Cannot disable feed after quarter winners are recorded');g.espn={enabled:false};audit(s,'espnDisable',{gameId:g.id});});return respond(res,200,{...publicState(state),isOwner:true});
 }
 if(body.action==='confirmQuarter'){
   if(!game.espn?.enabled||game.digitsLocked===false||game.quarter>=4)throw httpError(409,'ESPN feed and locked digits are required');
   const events=await getEvents(game.espn.week),live=buildLive(events,game.espn),snapshot=live.snapshots[game.quarter];
   if(!snapshot?.ready)throw httpError(409,'Both NFL teams must finish this quarter before its winner can be recorded');
   const {state}=await change(s=>{assertOwner(req,s);const g=s.games.find(x=>x.id===s.activeId);
     if(g.id!==game.id||g.quarter!==game.quarter||JSON.stringify(g.espn)!==JSON.stringify(game.espn))throw httpError(409,'The game changed since your request');
     const scores=snapshot.scores,c=g.cols.indexOf(scores[0]%10),r=g.rows.indexOf(scores[1]%10),square=r*10+c+1;
     if(c<0||r<0)throw httpError(409,'Weekly digit mapping invalid');
     g.winners.push({quarter:g.quarter+1,square,name:s.names[square-1]||'Unclaimed',scores:[...scores],at:new Date().toISOString(),source:'ESPN'});
     g.quarter++;if(live.fresh)g.scores=[...live.scores];
     if(!g.kickoffAt)g.kickoffAt=new Date().toISOString();
     audit(s,'espnQuarter',{gameId:g.id,quarter:g.quarter,square,scores});
   });return respond(res,200,{...publicState(state),isOwner:true});
 }
 if(body.action==='sync'){
   if(!game.espn?.enabled)throw httpError(409,'Choose the NFL games first');
   if(game.digitsLocked===false)throw httpError(409,'Lock weekly numbers before saving NFL scores');
   if(game.quarter>=4)throw httpError(409,'Game already final');
   const events=await getEvents(game.espn.week),live=buildLive(events,game.espn);
   if(!live.fresh)throw httpError(409,'ESPN scores are not ready yet');
   if(game.scores[0]===live.scores[0]&&game.scores[1]===live.scores[1])return respond(res,200,{...publicState(old),isOwner:true});
   const {state}=await change(s=>{assertOwner(req,s);const g=s.games.find(x=>x.id===s.activeId);
     if(g.id!==game.id||JSON.stringify(g.espn)!==JSON.stringify(game.espn))throw httpError(409,'Game configuration changed. Refresh and try again.');
     if(g.quarter>=4||g.digitsLocked===false)throw httpError(409,'Cannot sync this game');
     if(g.scores[0]===live.scores[0]&&g.scores[1]===live.scores[1])return;
     g.scores=[...live.scores];g.lastEspnSync=new Date().toISOString();
     audit(s,'espnScore',{gameId:g.id,scores:g.scores});
   });return respond(res,200,{...publicState(state),isOwner:true});
 }
 throw httpError(400,'Unknown ESPN command');
 }catch(e){failure(res,e)}}
