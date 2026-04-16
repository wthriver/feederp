<template>
  <div>
    <section class="hero-section">
      <div class="hero-bg"><div class="hero-pattern"></div></div>
      <div class="container hero-container">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="badge-dot"></span>
            Powerful Features
          </div>
          <h1 class="hero-title">
            Everything You Need to<br />
            <span class="hero-highlight">Run Your Feed Mill</span>
          </h1>
          <p class="hero-description">
            Comprehensive modules designed specifically for feed manufacturing operations. 
            From production to delivery, manage everything from one powerful platform.
          </p>
        </div>
      </div>
    </section>

    <section v-for="(cat, idx) in featureCategories" :key="idx" class="features-section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag"><i :class="`fas ${cat.icon}`"></i> {{ cat.category }}</span>
          <h2 class="section-title">{{ cat.category }}</h2>
        </div>
        <div class="features-grid">
          <div v-for="(item, i) in cat.items" :key="i" class="feature-card">
            <div class="feature-icon"><i :class="`fas ${item.icon}`"></i></div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="cta-section">
      <div class="container">
        <div class="cta-content">
          <h2>Ready to Get Started?</h2>
          <p>Start your free trial today and experience the power of FeedMill ERP</p>
          <router-link to="/pricing" class="btn btn-primary btn-lg">View Pricing</router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const featureCategories = [
  {
    category: 'Production',
    icon: 'fa-industry',
    items: [
      { icon: 'fa-calculator', title: 'Formula Management', desc: 'Create and manage feed formulas with precise ingredient ratios and cost calculations.' },
      { icon: 'fa-layer-group', title: 'Batch Production', desc: 'Plan and track batch production with real-time monitoring.' },
      { icon: 'fa-gears', title: 'Machine Scheduling', desc: 'Optimize machine usage with smart scheduling and maintenance tracking.' },
      { icon: 'fa-clipboard-list', title: 'Job Cards', desc: 'Streamline production workflow with digital job cards.' }
    ]
  },
  {
    category: 'Inventory',
    icon: 'fa-boxes',
    items: [
      { icon: 'fa-sack-dollar', title: 'Raw Materials', desc: 'Track raw materials with batch tracking and quality checks.' },
      { icon: 'fa-warehouse', title: 'Godown Management', desc: 'Manage multiple godowns with location tracking.' },
      { icon: 'fa-arrows-left-right', title: 'Stock Transfers', desc: 'Transfer stock between godowns with documentation.' },
      { icon: 'fa-box-open', title: 'Finished Products', desc: 'Manage finished goods with packaging and dispatch.' }
    ]
  },
  {
    category: 'Sales & Purchase',
    icon: 'fa-cart-shopping',
    items: [
      { icon: 'fa-file-signature', title: 'Purchase Orders', desc: 'Create and manage purchase orders with suppliers.' },
      { icon: 'fa-truck-loading', title: 'Goods Inward', desc: 'Record goods inward with quality verification.' },
      { icon: 'fa-file-invoice-dollar', title: 'Sales Orders', desc: 'Manage sales orders with pricing and discounts.' },
      { icon: 'fa-receipt', title: 'Invoices', desc: 'Generate professional invoices with tax calculations.' }
    ]
  },
  {
    category: 'Finance',
    icon: 'fa-chart-line',
    items: [
      { icon: 'fa-building-columns', title: 'Chart of Accounts', desc: 'Maintain comprehensive chart of accounts.' },
      { icon: 'fa-money-bill-transfer', title: 'Transactions', desc: 'Record all financial transactions.' },
      { icon: 'fa-hand-holding-dollar', title: 'Payments', desc: 'Manage payments with approval workflows.' },
      { icon: 'fa-chart-pie', title: 'Financial Reports', desc: 'Generate balance sheets and P&L statements.' }
    ]
  },
  {
    category: 'Quality',
    icon: 'fa-flask',
    items: [
      { icon: 'fa-vial', title: 'QC Parameters', desc: 'Define custom QC parameters.' },
      { icon: 'fa-file-contract', title: 'QC Results', desc: 'Record and track quality test results.' },
      { icon: 'fa-triangle-exclamation', title: 'Non-Conformance', desc: 'Track non-conformance issues.' },
      { icon: 'fa-medal', title: 'Certifications', desc: 'Manage quality certifications.' }
    ]
  },
  {
    category: 'Transport',
    icon: 'fa-truck',
    items: [
      { icon: 'fa-truck-pickup', title: 'Vehicle Management', desc: 'Manage fleet with maintenance tracking.' },
      { icon: 'fa-id-card', title: 'Driver Management', desc: 'Manage driver licenses and assignments.' },
      { icon: 'fa-route', title: 'Delivery Planning', desc: 'Plan deliveries with route optimization.' },
      { icon: 'fa-location-dot', title: 'GPS Tracking', desc: 'Real-time vehicle tracking.' }
    ]
  }
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
  max-width: 600px;
  margin: 0 auto;
}

.features-section {
  padding: 80px 0;
  background: white;
}

.features-section:nth-child(even) {
  background: #f8fafc;
}

.section-header {
  text-align: center;
  max-width: 700px;
  margin: 0 auto 48px;
}

.section-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
}

.section-title {
  font-size: clamp(28px, 4vw, 36px);
  margin-bottom: 16px;
  color: #0f172a;
  font-family: 'Sora', sans-serif;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}

.feature-card {
  background: white;
  padding: 32px;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #2563eb, #7c3aed);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s;
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
}

.feature-card:hover::before {
  transform: scaleX(1);
}

.feature-icon {
  width: 60px;
  height: 60px;
  background: rgba(37, 99, 235, 0.1);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #2563eb;
  margin-bottom: 20px;
}

.feature-card h3 {
  font-size: 20px;
  margin-bottom: 12px;
  color: #0f172a;
}

.feature-card p {
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

.btn-lg {
  padding: 16px 32px;
  font-size: 16px;
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
}

@media (max-width: 768px) {
  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>
