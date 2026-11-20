import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

export function AboutPage() {
  usePageTitle('About the internship demo')
  return <div className="market-container about-page"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><span>About the demo</span></nav>
    <p className="eyebrow">BUILT TO LEARN. DESIGNED TO EXPLORE.</p><h1>A marketplace demo with a clear identity.</h1>
    <p className="about-lead">Keymarket is an independent internship project inspired by Eneba’s marketplace layout. It is not the official Eneba service and is not affiliated with or endorsed by Eneba.</p>
    <div className="about-panels"><section><h2>What works today</h2><p>Explore a PostgreSQL-backed catalog, search partial or misspelled titles, filter products, browse current promotions, compare independent seller offers, save your cart, sign in, simulate payment, and retrieve your demo keys from order history.</p></section>
      <section><h2>A transparent demo</h2><p>Products have illustrative prices and fictional seller ratings. All artwork is original demo art, rather than official game covers. No real payments or purchases are available.</p></section></div>
    <section id="activation"><h2>Activation explained</h2><p>In a real key marketplace, a digital key is redeemed through its stated platform and must match the account’s activation region. Always check these details before a real purchase. Keys in this project are fake, nonredeemable test strings.</p>
      <details className="faq"><summary>Why do sellers have different prices?</summary><p>Each seller offer is an independent database record with its own price and key inventory. The product page compares available offers without combining one seller’s price with another seller’s stock.</p></details>
      <details className="faq"><summary>Can I buy or redeem a key here?</summary><p>You can build a cart, create an account and simulate a successful or declined payment. Successful simulations deliver unique demo keys in your order history. No real money is processed and all demo keys are nonredeemable.</p></details>
      <details className="faq"><summary>Are these official product images?</summary><p>No. The covers are original SVG title cards. The featured fantasy landscape is original AI-generated promotional artwork. Neither represents official game artwork or an endorsement.</p></details>
    </section>
    <section id="privacy"><h2>Privacy in this demo</h2><p>The interface does not include advertising trackers, analytics, newsletter collection, or payment forms. Search and filters are sent to the local Laravel API. The application may use Laravel session cookies; no production account or payment information is required.</p></section>
    <Link to="/store" className="button button-primary">Explore the catalog</Link>
  </div>
}
