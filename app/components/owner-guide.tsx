'use client';
export default function OwnerGuide({onBack}:{onBack:()=>void}){
 const pdf='/api/owner-guide';
 return <section className="panel padded sf-owner-guide" aria-labelledby="owner-guide-title">
  <div className="button-row"><button type="button" className="outline" onClick={onBack}>← Back to dashboard</button><a className="primary" href={pdf} target="_blank" rel="noopener noreferrer">Open owner guide (PDF)</a><a className="outline" href={pdf} download>Download PDF</a></div>
  <h2 id="owner-guide-title">Business owner guide</h2><p>Simple steps in setup order: business details, services, team, booking rules, payments, sessions, memberships, appointments and your public page. Also covers clients, notifications, reports and common questions.</p>
  <p className="muted">The PDF includes a clickable contents page and a Back to owner dashboard button on every page. If your browser cannot display it below, use Open or Download.</p>
  <iframe src={pdf+'#view=FitH'} title="SelahFlow business owner guide PDF" style={{width:'100%',height:'75vh',minHeight:400,border:'1px solid #d6dfda',borderRadius:12}}/>
 </section>;
}
