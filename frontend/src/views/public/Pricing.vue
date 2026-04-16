<template>
  <div>
    <section class="hero-section">
      <div class="hero-bg"><div class="hero-pattern"></div></div>
      <div class="container hero-container">
        <div class="hero-content">
          <div class="hero-badge"><span class="badge-dot"></span>Simple Pricing</div>
          <h1 class="hero-title">Simple, Transparent<br /><span class="hero-highlight">Pricing</span></h1>
          <p class="hero-description">Choose the plan that fits your business. No hidden fees, no surprises.</p>
        </div>
      </div>
    </section>

    <section class="pricing-section">
      <div class="container">
        <div class="pricing-grid">
          <div v-for="(plan, index) in plans" :key="index" :class="['pricing-card', { featured: plan.featured }]">
            <span v-if="plan.featured" class="pricing-badge">Most Popular</span>
            <h3 class="pricing-plan">{{ plan.name }}</h3>
            <div class="pricing-price">{{ plan.price }}<span>{{ plan.period }}</span></div>
            <p class="pricing-description">{{ plan.description }}</p>
            <ul class="pricing-features">
              <li v-for="(f, i) in plan.features" :key="i"><i class="fas fa-check"></i> {{ f }}</li>
            </ul>
            <router-link :to="plan.featured ? '/signup' : (plan.name === 'Enterprise' ? '/contact' : '/signup')" :class="['btn', plan.featured ? 'btn-primary' : 'btn-secondary', 'btn-lg']">
              {{ plan.cta }}
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <section class="faq-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Frequently Asked Questions</h2>
        </div>
        <div class="faq-grid">
          <div v-for="(faq, index) in faqs" :key="index" class="faq-item">
            <h3>{{ faq.q }}</h3>
            <p>{{ faq.a }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="cta-section">
      <div class="container">
        <div class="cta-content">
          <h2>Still Have Questions?</h2>
          <p>Our team is here to help you choose the right plan</p>
          <router-link to="/contact" class="btn btn-white btn-lg">Contact Us</router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const plans = [
  {
    name: 'Starter',
    price: '$99',
    period: '/month',
    description: 'Perfect for small feed mills getting started',
    features: ['Up to 5 Users', 'Basic Inventory', 'Purchase Orders', 'Sales Orders', 'Basic Reports', 'Email Support', 'Cloud Storage'],
    cta: 'Start Free Trial',
    featured: false
  },
  {
    name: 'Professional',
    price: '$249',
    period: '/month',
    description: 'For growing businesses that need more power',
    features: ['Up to 20 Users', 'Advanced Inventory', 'Production Management', 'Quality Control', 'Financial Accounting', 'Transport Logistics', 'Priority Support', 'API Access'],
    cta: 'Start Free Trial',
    featured: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations with custom needs',
    features: ['Unlimited Users', 'Multi-Factory Support', 'Custom Integrations', 'IoT Connectivity', 'Dedicated Account Manager', '24/7 Phone Support', 'On-premise Deployment', 'Custom Development'],
    cta: 'Contact Sales',
    featured: false
  }
]

const faqs = [
  { q: 'Can I change plans later?', a: 'Yes, you can upgrade or downgrade your plan at any time.' },
  { q: 'Is there a free trial?', a: 'Yes! We offer a 14-day free trial on all plans. No credit card required.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit cards, bank transfers, and PayPal.' },
  { q: 'Do you offer refunds?', a: 'Yes, we offer a 30-day money-back guarantee.' },
  { q: 'Is my data secure?', a: 'Absolutely. We use bank-level encryption and regular security audits.' }
]
</script>

<style scoped>
.hero-section {
  position: relative;
  min-height: 60vh;
  padding: 120px 0 60px;
  overflow: hidden;
  background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
}

.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hero-pattern {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(37, 99, 235, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 99, 235, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
}

.hero-container {
  position: relative;
  z-index: 1;
}

.hero-content {
  max-width: 700px;
  margin: 0 auto;
  text-align: center;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(37, 99, 235, 0.1);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 30px;
  font-size: 14px;
  color: #2563eb;
  font-weight: 500;
  margin-bottom: 24px;
}

.badge-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
}

.hero-title {
  font-size: clamp(32px, 5vw, 48px);
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 24px;
  color: #0f172a;
}

.hero-highlight {
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-description {
  font-size: 18px;
  color: #64748b;
  line-height: 1.7;
  max-width: 550px;
  margin: 0 auto;
}

.pricing-section {
  padding: 80px 0;
  background: white;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  max-width: 1000px;
  margin: 0 auto;
}

.pricing-card {
  position: relative;
  padding: 32px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 16px;
  text-align: center;
  transition: all 0.3s;
}

.pricing-card:hover {
  border-color: #2563eb;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.pricing-card.featured {
  border-color: #2563eb;
  transform: scale(1.05);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.pricing-badge {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 16px;
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  color: white;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.pricing-plan {
  font-size: 24px;
  color: #0f172a;
  margin-bottom: 16px;
}

.pricing-price {
  font-family: 'Sora', sans-serif;
  font-size: 56px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 8px;
}

.pricing-price span {
  font-size: 18px;
  font-weight: 400;
  color: #64748b;
}

.pricing-description {
  color: #64748b;
  margin-bottom: 24px;
}

.pricing-features {
  text-align: left;
  margin-bottom: 32px;
  list-style: none;
  padding: 0;
}

.pricing-features li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 15px;
  color: #4a4a4a;
}

.pricing-features li i {
  color: #10b981;
  font-size: 14px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 28px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.3s ease;
  cursor: pointer;
  border: none;
  width: 100%;
}

.btn-primary {
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  color: white;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
}

.btn-secondary {
  background: #f8fafc;
  color: #2563eb;
  border: 2px solid #2563eb;
}

.btn-secondary:hover {
  background: #2563eb;
  color: white;
}

.btn-lg {
  padding: 16px 32px;
  font-size: 16px;
}

.faq-section {
  padding: 80px 0;
  background: #f8fafc;
}

.section-header {
  text-align: center;
  max-width: 700px;
  margin: 0 auto 48px;
}

.section-title {
  font-size: clamp(28px, 4vw, 36px);
  color: #0f172a;
  font-family: 'Sora', sans-serif;
}

.faq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  max-width: 1000px;
  margin: 0 auto;
}

.faq-item {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.faq-item h3 {
  font-size: 18px;
  color: #0f172a;
  margin-bottom: 12px;
}

.faq-item p {
  color: #64748b;
  line-height: 1.6;
}

.cta-section {
  padding: 80px 0;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.cta-content {
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

.cta-content h2 {
  font-size: clamp(28px, 4vw, 36px);
  color: white;
  margin-bottom: 16px;
}

.cta-content p {
  font-size: 18px;
  color: #94a3b8;
  margin-bottom: 32px;
}

.btn-white {
  background: white;
  color: #2563eb;
  border: 2px solid white;
}

.btn-white:hover {
  background: #f8fafc;
  transform: translateY(-2px);
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
}

@media (max-width: 768px) {
  .pricing-card.featured {
    transform: none;
  }
  
  .pricing-grid {
    grid-template-columns: 1fr;
  }
}
</style>
