import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.114.0';
import {list,obj,first,normalize,deduplicate,collectPages,Employee} from './quark-core.ts';
import {createQuarkRequester} from './quark-request.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const base=(Deno.env.get('QUARK_API_URL')||'https://api.quark.tec.br/rh/ext').replace(/\/$/,'');
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return response({error:'Método não permitido.'},405);
 const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return response({error:'Não autenticado.'},401);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await admin.auth.getUser(authorization.slice(7));
 if(authError||!user)return response({error:'Sessão inválida.'},401);
 const {data:profile,error:profileError}=await admin.from('profiles').select('role,approved').eq('id',user.id).single();
 if(profileError||!profile?.approved||!['admin','rh'].includes(profile.role))return response({error:'Acesso restrito a Admin e RH aprovados.'},403);
 let runId:string|undefined;
 try {
  let token=Deno.env.get('QUARK_AUTH_TOKEN')?.trim();
  if(!token){const secret=await admin.rpc('quark_department_token');if(secret.error)throw new Error('Não foi possível carregar a credencial QuarkRH.');token=secret.data;}
  if(!token)return response({error:'Credencial QuarkRH não configurada no servidor.'},503);
  // Release only abandoned locks; live runs are constrained by a unique index.
  await admin.from('quark_department_sync_runs').update({status:'ERROR',completed_at:new Date().toISOString(),error_message:'Execução interrompida; tente sincronizar novamente.'}).eq('status','RUNNING').lt('started_at',new Date(Date.now()-10*60_000).toISOString());
  const {data:run,error:runError}=await admin.from('quark_department_sync_runs').insert({triggered_by:user.id,status:'RUNNING'}).select('id').single();
  if(runError||!run)return response({error:runError?.code==='23505'?'Já existe uma sincronização em andamento.':'Não foi possível iniciar a sincronização.'},409);
  runId=run.id;
  const deadline=Date.now()+120_000;
  const request=createQuarkRequester({base,token:token!,deadline});
  const unitRows=await collectPages(q=>request('/v1/unidades'+(q?'?'+q:'')),'lista de unidades');
  const names=new Map(unitRows.map(r=>[first(r.id,r.unidadeId),first(r.nomeFantasia,r.razaoSocial,r.nome,r.denominacao)]));
  const discovery=await admin.rpc('discover_quark_department_units',{p_units:[...names.entries()].filter(([id])=>id).map(([id,name])=>({id,name:name||id}))});
  if(discovery.error)throw new Error('Não foi possível atualizar a lista de unidades QuarkRH.');
  const enabled=await admin.from('quark_unidade_mapping').select('quark_unidade_id').eq('sync_enabled',true);
  if(enabled.error)throw new Error('Não foi possível carregar as unidades habilitadas.');
  const units=(enabled.data||[]).map(x=>x.quark_unidade_id);
  if(!units.length)throw new Error('Selecione as unidades no painel de mapeamentos.');
  let received=0,skipped=0;const normalized:Employee[]=[];
  for(const unit of units){
   const raw=await collectPages(q=>request('/v1/colaboradores/'+(q?'?'+q:''),unit),unit);
   received+=raw.length;
   for(const r of raw){const row=normalize(obj(r),unit,names.get(unit)||unit);if(row)normalized.push(row);else skipped++;}
  }
  if(!received)throw new Error('O QuarkRH retornou uma lista vazia. Nenhum cadastro foi alterado.');
  const {records,conflicts}=deduplicate(normalized);
  const body=await req.json().catch(()=>({}));
  if(body.preview===true){await admin.from('quark_department_sync_runs').update({status:'ERROR',error_message:'Prévia sem gravação de colaboradores.',completed_at:new Date().toISOString(),received,skipped,conflicts}).eq('id',runId);return response({ok:true,preview:true,received,valid:records.length,skipped,conflicts,units:units.length});}
  const {data,error}=await admin.rpc('sync_quark_department',{p_actor:user.id,p_run:runId,p_records:records,p_received:received,p_skipped:skipped,p_conflicts:conflicts});
  if(error)throw new Error('Não foi possível gravar a sincronização. Nenhum cadastro foi alterado.');
  return response({ok:true,runId,units:units.length,...data});
 }catch(e){const message=e instanceof Error?e.message:'Falha inesperada.';if(runId)await admin.from('quark_department_sync_runs').update({status:'ERROR',error_message:message.slice(0,1000),completed_at:new Date().toISOString()}).eq('id',runId);return response({error:message},502);}
});
