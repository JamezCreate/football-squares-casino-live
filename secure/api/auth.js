import {load,change,respond,failure,requirePost,httpError,safeMatch,hashPassword,ownerRecord,authenticated,setCookie,clearCookie} from './_common.js';
export default async function handler(req,res){try{
  requirePost(req);
  const {action,password,code}=req.body||{};
  if(action==='logout'){clearCookie(res);return respond(res,200,{ok:true});}
  if(action==='status'){const {state}=await load();return respond(res,200,{ownerConfigured:!!state.owner,isOwner:authenticated(req,state)});}
  if(action==='setup'){
    if(typeof password!=='string'||password.length<12||password.length>128)throw httpError(400,'Choose a password at least 12 characters long');
    if(!process.env.OWNER_SETUP_CODE||!safeMatch(code||'',process.env.OWNER_SETUP_CODE))throw httpError(403,'Setup code not accepted');
    const {state}=await change(s=>{if(s.owner)throw httpError(409,'Owner already registered');s.owner=ownerRecord(password);return true;});
    setCookie(res,state);return respond(res,200,{ok:true});
  }
  if(action==='login'){
    if(typeof password!=='string'||password.length>128)throw httpError(401,'Invalid login');
    const {state}=await load();if(!state.owner)throw httpError(409,'Owner setup is required');
    const proposed=hashPassword(password,state.owner.salt);
    if(!safeMatch(proposed,state.owner.hash))throw httpError(401,'Incorrect password');
    setCookie(res,state);return respond(res,200,{ok:true});
  }
  throw httpError(400,'Unknown authentication action');
}catch(e){failure(res,e);}}