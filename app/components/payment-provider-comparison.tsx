export default function PaymentProviderComparison(){
 return <section className="sf-payment-comparison" aria-labelledby="sf-payment-comparison-title">
  <h3 id="sf-payment-comparison-title">Stripe vs. Helcim: fees, pros and cons</h3>
  <p>Published U.S. standard pricing checked October 29, 2026. Your agreement, card type and payment method determine actual fees.</p>
  <div className="sf-payment-table-scroll" tabIndex={0} role="region" aria-label="Payment provider comparison; scroll horizontally on smaller screens">
   <table><caption>Business payment provider comparison</caption><thead><tr><th scope="col">Compare</th><th scope="col">Stripe</th><th scope="col">Helcim</th></tr></thead><tbody>
    <tr><th scope="row">Online domestic cards</th><td>2.9% + $0.30 per successful payment.</td><td>Card interchange and network costs + 0.50% + $0.25 at the entry tier (up to $50,000 monthly card volume). The markup is not the total fee.</td></tr>
    <tr><th scope="row">$100 card payment</th><td>$3.20 before optional services.</td><td>Variable. If card/network costs were $2.00, total processing would be $2.75. This is an illustration, not a quoted rate.</td></tr>
    <tr><th scope="row">ACH bank debit</th><td>0.8%, capped at $5 per payment.</td><td>0.5% + $0.25, capped at $6 for payments below $25,000; additional pricing applies above $25,000.</td></tr>
    <tr><th scope="row">Basic processing monthly fee</th><td>$0 on standard pay-as-you-go processing. Other products may add fees.</td><td>$0 basic account monthly fee. Optional products and hardware may add fees.</td></tr>
    <tr><th scope="row">Automatic recurring billing</th><td>Stripe Billing pay-as-you-go: an additional 0.7% of Billing volume.</td><td>An additional 0.4% per applicable recurring transaction.</td></tr>
    <tr><th scope="row">Advantages</th><td>Predictable domestic card pricing; connected business accounts; platform fee collection; subscription tools.</td><td>Transparent pass-through card costs; potential savings on lower-cost cards; automatic volume discounts; partner integrations.</td></tr>
    <tr><th scope="row">Tradeoffs</th><td>Billing, some Connect models, international cards, currency conversion and other services can add fees.</td><td>Card fees vary and are not always lower. SelahFlow checkout, recurring billing and first-purchase commission collection are not enabled with Helcim yet.</td></tr>
    <tr><th scope="row">SelahFlow availability</th><td>Booking and membership payments after this business completes and verifies Stripe setup.</td><td>Setup preference and activation request only. Creating a Helcim account does not connect it to SelahFlow.</td></tr>
    <tr><th scope="row">SelahFlow commission</th><td>Separate from processing: eligible first purchases may incur the administrator-enabled fee under accepted terms.</td><td>Helcim partner profit sharing is separate from SelahFlow’s first-purchase commission. Collection support must be confirmed before activation.</td></tr>
   </tbody></table>
  </div>
  <p className="muted">Processing prices do not include every optional service, dispute, refund-related cost, tax or negotiated rate. A listed payment method is not necessarily enabled in SelahFlow checkout.</p>
  <p className="sf-payment-sources">Official pricing: <a href="https://stripe.com/pricing" target="_blank" rel="noopener noreferrer">Stripe Payments</a> · <a href="https://stripe.com/billing/pricing" target="_blank" rel="noopener noreferrer">Stripe Billing</a> · <a href="https://stripe.com/connect/pricing" target="_blank" rel="noopener noreferrer">Stripe Connect</a> · <a href="https://legal.helcim.com/us/fee-disclosures/" target="_blank" rel="noopener noreferrer">Helcim fees</a></p>
 </section>;
}
