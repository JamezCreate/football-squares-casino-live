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
      const old=s.names[i];s.names[i]=newName;audit(s,'name',{square:i+1,old,newName});return true;
    }
    if(action==='digits'){
      if(game.quarter>0)throw httpError(409,'Digits are locked after the first quarter is awarded');
      if(!validDigits(body.cols)||!validDigits(body.rows))throw httpError(400,'Use each digit 0–9 exactly once per team');
      game.cols=[...body.cols];game.rows=[...body.rows];audit(s,'digits',{gameId:game.id});return true;
    }
    if(action==='newGame'){
      const label=requireString(body.label,70)||`Week ${s.games.length+1}`;
      if(s.games.length>=80)throw httpError(400,'Maximum games reached');
      const id='game-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
      s.games.push({id,label,cols:[0,1,2,3,4,5,6,7,8,9],rows:[0,1,2,3,4,5,6,7,8,9],scores:[0,0],quarter:0,winners:[],createdAt:new Date().toISOString()});
      s.activeId=id;audit(s,'newGame',{id,label});return true;
    }
    if(action==='activate'){
      if(!s.games.some(g=>g.id===body.id))throw httpError(400,'Game not found');s.activeId=body.id;audit(s,'activate',{id:body.id});return true;
    }
    if(action==='score'){
      if(game.quarter>=4)throw httpError(409,'Game is final');
      if(!score(body.bengals)||!score(body.steelers))throw httpError(400,'Enter whole scores from 0–250');
      game.scores=[body.bengals,body.steelers];audit(s,'score',{gameId:game.id,scores:game.scores});return true;
    }
    if(action==='endQuarter'){
      if(game.quarter>=4)throw httpError(409,'Game is already final');
      const c=game.cols.indexOf(game.scores[0]%10),r=game.rows.indexOf(game.scores[1]%10),square=r*10+c+1;
      game.winners.push({quarter:game.quarter+1,square,name:s.names[square-1]||'Unclaimed',scores:[...game.scores],at:new Date().toISOString()});game.quarter++;
      audit(s,'endQuarter',{gameId:game.id,quarter:game.quarter,square});return true;
    }
    throw httpError(400,'Unknown admin action');
  });
  return respond(res,200,{...publicState(state),isOwner:true});
}catch(e){failure(res,e);}}