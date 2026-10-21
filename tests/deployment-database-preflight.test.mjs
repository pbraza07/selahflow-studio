import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyDeploymentDatabase} from '../server/deployment-database-preflight.mjs';
test('deployment preflight refuses shared Amanda DB, wrong environment role and insufficient migration privileges',async()=>{
 const env={RENDER:'true',RENDER_SERVICE_NAME:'selahflow-staging'};
 const db=(database,role,schema_create,n=0)=>({query:async q=>({rows:[q.includes('current_database')?{database,role,schema_create}:{n}]})});
 for(const args of [['amanda_realtor_db','amanda_realtor_db_user',true],['selahflow_production','selahflow_production_user',true],['selahflow_staging','selahflow_staging_user',false],['selahflow_staging','selahflow_staging_user',true,1]])await assert.rejects(()=>verifyDeploymentDatabase(db(...args),env));
 assert.equal((await verifyDeploymentDatabase(db('selahflow_staging','selahflow_staging_user',true),env)).database,'selahflow_staging');
 assert.equal((await verifyDeploymentDatabase(db('selahflow_production','selahflow_production_user',true),{...env,RENDER_SERVICE_NAME:'selahflow-studio'})).database,'selahflow_production');
});
