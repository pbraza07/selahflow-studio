import {AgreementDocument,PrintAgreementButton} from '../../components/business-service-agreement';
import {PLAN_CATALOG} from '../../../server/plan-entitlements.mjs';
export default async function BusinessServicesTerms({searchParams}:{searchParams:Promise<{plan?:string}>}){
 const query=await searchParams,plan=query.plan&&Object.hasOwn(PLAN_CATALOG,query.plan)?query.plan:'free';
 return <main className="sf-contract-page"><header className="sf-contract-tools"><a href="/" aria-label="SelahFlow home"><img src="/brand/logo.svg?v=1.3.99" alt="SelahFlow" width={190} height={40}/></a><PrintAgreementButton/></header><AgreementDocument planCode={plan}/><footer className="sf-contract-tools"><a href={'/signup?plan='+plan}>Continue with the {PLAN_CATALOG[plan as keyof typeof PLAN_CATALOG].name} package</a><a href="/privacy">Privacy Policy</a></footer></main>;
}
