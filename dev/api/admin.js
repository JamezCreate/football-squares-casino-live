import {change,respond,failure,requirePost,httpError,assertOwner,requireString,validDigits,audit,publicState} from './_common.js';
const score=n=>Number.isInteger(n)&&n>=0&&n<=250;
export default async function handler(req,res){try{
  requirePost(req);
  const body=req.body||{},action=body.action;
  const {state}=await change(s=>{
    assertOwner(req,s);
    const game=s.games.find(g=>g.id===s.activeId);if(!game)throw httpError(409,'Active game missing');
    if(action==='name'){
      const i=Number(body.square)-1;if(!Number.isInteger(i)||i<0||i>=100)throw httpError(400,'Invalid square');
      const newName=requireString(body.name,55);
      const old=s.names[i];if(typeof body.expected==='string'&&old!==body.expected)throw httpError(409,'That square changed. Refresh and review it before saving.');
      if(old===newName)return true;
      s.names[i]=newName;audit(s,'name',{square:i+1,old,newName});return true;
    }
    if(action==='batchNames'){
      const entries=body.entries;
      if(!Array.isArray(entries)||entries.length<1||entries.length>100)throw httpError(400,'Provide 1–100 square assignments');
      const seen=new Set();let changed=0;
      // Validate the entire batch before writing anything; never silently overwrite recent edits.
      for(const e of entries){
        if(!e||!Number.isInteger(e.square)||e.square<1||e.square>100||seen.has(e.square))throw httpError(400,'Each square must appear once, between 1 and 100');
        seen.add(e.square);
        if(typeof e.name!=='string'||!e.name.trim()||e.name.trim().length>55)throw httpError(400,'Every assignment needs a name of 1–55 characters');
        if(typeof e.expected!=='string'||e.expected!==s.names[e.square-1])throw httpError(409,'The board changed since your preview. Refresh and review the import.');
      }
      for(const e of entries){const i=e.square-1,old=s.names[i],newName=e.name.trim();if(old!==newName){s.names[i]=newName;audit(s,'name',{square:e.square,old,newName,source:'bulk'});changed++;}}
      return changed;
    }
    if(action==='undoName'){
      const id=body.eventId;
      if(typeof id!=='string'||!id||id.length>64)throw httpError(400,'Invalid history entry');
      const event=s.audit.find(e=>e.id===id&&e.action==='name');
      if(!event)throw httpError(404,'This change is no longer available to undo');
      const i=event.details.square-1;
      const newer=s.audit.slice(s.audit.indexOf(event)+1).some(e=>(e.action==='name'||e.action==='undoName')&&e.details.square===i+1);
      if(newer||s.names[i]!==event.details.newName)throw httpError(409,'This square was updated again. Review the latest assignment instead.');
      s.names[i]=event.details.old;
      audit(s,'undoName',{square:i+1,old:event.details.newName,newName:event.details.old,undid:event.id});return true;
    }
    if(action==='digits'){
      if(game.digitsLocked===true||game.quarter>0||game.kickoffAt)throw httpError(409,'Weekly numbers are locked for this game');
      if(!validDigits(body.cols)||!validDigits(body.rows))throw httpError(400,'Use each digit 0–9 exactly once per team');
      game.cols=[...body.cols];game.rows=[...body.rows];game.numbersAssigned=true;audit(s,'digits',{gameId:game.id});return true;
    }
    if(action==='lockDigits'){
      if(game.digitsLocked===true||game.quarter>0||game.kickoffAt)throw httpError(409,'Weekly numbers are already locked');
      if(game.numbersAssigned===false)throw httpError(409,'Save this week’s number assignments before locking');
      if(!validDigits(game.cols)||!validDigits(game.rows))throw httpError(400,'Assign all digits 0–9 once per team before locking');
      game.digitsLocked=true;game.lockedAt=new Date().toISOString();audit(s,'lockDigits',{gameId:game.id});return true;
    }
    if(action==='newGame'){
      const label=requireString(body.label,70)||`Week ${s.games.length+1}`;
      if(s.games.length>=80)throw httpError(400,'Maximum games reached');
      const id='game-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
      s.games.push({id,label,cols:[0,1,2,3,4,5,6,7,8,9],rows:[0,1,2,3,4,5,6,7,8,9],scores:[0,0],digitsLocked:false,numbersAssigned:false,quarter:0,winners:[],createdAt:new Date().toISOString()});
      s.activeId=id;audit(s,'newGame',{id,label});return true;
    }
    if(action==='activate'){
      if(!s.games.some(g=>g.id===body.id))throw httpError(400,'Game not found');s.activeId=body.id;audit(s,'activate',{id:body.id});return true;
    }
    if(action==='score'){
      if(game.quarter>=4)throw httpError(409,'Game is final');
      if(game.digitsLocked===false)throw httpError(409,'Lock weekly numbers before entering scores');
      if(!score(body.bengals)||!score(body.steelers))throw httpError(400,'Enter whole scores from 0–250');
      game.scores=[body.bengals,body.steelers];if(!game.kickoffAt)game.kickoffAt=new Date().toISOString();audit(s,'score',{gameId:game.id,scores:game.scores});return true;
    }
    if(action==='endQuarter'){
      if(game.quarter>=4)throw httpError(409,'Game is already final');
      if(game.digitsLocked===false)throw httpError(409,'Lock weekly numbers before awarding a quarter');
      const c=game.cols.indexOf(game.scores[0]%10),r=game.rows.indexOf(game.scores[1]%10),square=r*10+c+1;
      game.winners.push({quarter:game.quarter+1,square,name:s.names[square-1]||'Unclaimed',scores:[...game.scores],at:new Date().toISOString()});game.quarter++;
      audit(s,'endQuarter',{gameId:game.id,quarter:game.quarter,square});return true;
    }
    throw httpError(400,'Unknown admin action');
  });
  return respond(res,200,{...publicState(state),isOwner:true});
}catch(e){failure(res,e);}}