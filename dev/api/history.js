import {load,respond,failure,authenticated,httpError} from './_common.js';
export default async function handler(req,res){try{
 if(req.method!=='GET')throw httpError(405,'Method not allowed');
 const {state}=await load();if(!authenticated(req,state))throw httpError(401,'Owner login required');
 const entries=Array.isArray(state.audit)?state.audit.slice(-100).reverse():[];
 return respond(res,200,{revision:state.revision,entries});
}catch(e){failure(res,e)}}
