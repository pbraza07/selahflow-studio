import test from 'node:test';
import assert from 'node:assert/strict';
import {productAddress} from '../server/product-tax.mjs';
import {PRODUCT_COUNTRIES} from '../server/product-address.mjs';
const address={line1:'123 Test St',city:'Test City',state:'Florida',postal_code:'33101',country:'United States'};
test('autofilled country/state names and abbreviations normalize for Stripe pickup and billing',()=>{
 for(const country of ['United States','US','us','USA','United States of America','U.S.'])for(const state of ['Florida','FL','fl',' florida '])assert.deepEqual(productAddress({...address,country,state}),{...address,line2:'',country:'US',state:'FL'});
 assert.equal(productAddress({...address,country:'Canada',state:'ON'}).country,'CA');
 assert.equal(productAddress({...address,country:'Brasil',state:'SP'}).country,'BR');
 assert.equal(new Set(PRODUCT_COUNTRIES.map(([code])=>code)).size,249);
});
test('invalid and incomplete addresses still fail with specific actionable errors',()=>{
 assert.throws(()=>productAddress({...address,country:'Atlantis'}),/valid country/);
 assert.throws(()=>productAddress({...address,state:'Not a state'}),/valid U.S. state/);
 assert.throws(()=>productAddress({...address,postal_code:''}),/postal code/);
 assert.throws(()=>productAddress({...address,line1:''}),/street/);
});
