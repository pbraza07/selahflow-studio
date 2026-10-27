/** Counts-only attestation; runs before migrations and never changes customer data. */
export async function verifyDeploymentDatabase(db,env=process.env){
 if(env.RENDER!=='true')return null;
 // Render's immutable ID survives service renames and legacy runtime names.
 const knownServices={'srv-db8e9dajnfac73fa0vo0':'staging','srv-db3tokqd0e5s73f31hfg':'production','srv-dbgbiu0n74is73cglveg':'production'};
 const environment=env.RENDER_SERVICE_ID?knownServices[env.RENDER_SERVICE_ID]:({'selahflow-staging':'staging','selahflow-studio':'production'})[env.RENDER_SERVICE_NAME];
 if(!environment)throw Error('Unexpected deployment service; database migration stopped.');
 const staging=environment==='staging';
 const expectedDatabase=staging?'selahflow_staging':'selahflow_production';
 const expectedRole=expectedDatabase+'_user';
 const row=(await db.query("SELECT current_database() AS database,current_user AS role,has_schema_privilege(current_user,'public','CREATE') AS schema_create")).rows[0];
 if(row.database!==expectedDatabase||row.role!==expectedRole||!row.schema_create)throw Error('Database connection or migration privileges do not match the intended environment.');
 const foreign=(await db.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT pg_has_role(current_user,c.relowner,'USAGE')")).rows[0].n;
 if(foreign)throw Error('Migration role does not own all application tables; review privileges before deploying.');
 const evidence={database:row.database,role:row.role,schemaCreate:row.schema_create,unownedTables:foreign};
 console.log('Deployment database preflight:',JSON.stringify(evidence));
 return evidence;
}
