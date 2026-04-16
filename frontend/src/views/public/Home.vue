<template>
  <div>
    <section class="hero-section">
      <div class="hero-bg">
        <div class="hero-pattern"></div>
        <div class="hero-grid-overlay"></div>
      </div>
      <div class="container hero-container">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="badge-dot"></span>
            Trusted by 500+ Feed Mills Worldwide
          </div>
          <h1 class="hero-title">
            Smart Feed Manufacturing<br />
            <span class="hero-highlight">Management System</span>
          </h1>
          <p class="hero-description">
            Enterprise-grade ERP for cattle, poultry, and fish feed production. 
            Streamline operations, optimize inventory, and boost profitability with powerful automation.
          </p>
          <div class="hero-buttons">
            <router-link to="/signup" class="btn btn-primary btn-lg">
              Start Free Trial <i class="fas fa-arrow-right"></i>
            </router-link>
            <a href="#features" class="btn btn-outline btn-lg">
              Explore Features
            </a>
          </div>
          <div class="hero-stats">
            <div v-for="(stat, index) in stats" :key="index" class="hero-stat">
              <span class="stat-number">{{ stat.number }}{{ stat.suffix }}</span>
              <span class="stat-label">{{ stat.label }}</span>
            </div>
          </div>
        </div>
        <div class="hero-visual">
          <div class="hero-image-wrapper">
            <img 
              src="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&q=80" 
              alt="Feed Mill Factory" 
              class="hero-main-image"
            />
            <div class="hero-card hero-card-1">
              <div class="card-icon green"><i class="fas fa-chart-line"></i></div>
              <div class="card-info">
                <span class="card-value">98.5%</span>
                <span class="card-label">Efficiency</span>
              </div>
            </div>
            <div class="hero-card hero-card-2">
              <div class="card-icon blue"><i class="fas fa-box"></i></div>
              <div class="card-info">
                <span class="card-value">2.4M</span>
                <span class="card-label">MT Production</span>
              </div>
            </div>
            <div class="hero-card hero-card-3">
              <div class="card-icon purple"><i class="fas fa-indian-rupee-sign"></i></div>
              <div class="card-info">
                <span class="card-value">₹12L</span>
                <span class="card-label">Monthly Savings</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="clients-section">
      <div class="container">
        <p class="clients-label">Trusted by leading feed mills across Asia & Africa</p>
        <div class="clients-grid">
          <div v-for="(client, i) in clients" :key="i" class="client-logo">{{ client }}</div>
        </div>
      </div>
    </section>

    <section class="problem-section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">The Challenge</span>
          <h2 class="section-title">Running a Feed Mill is Complex</h2>
          <p class="section-subtitle">Manual processes and disconnected systems create operational chaos</p>
        </div>
        <div class="problem-grid">
          <div class="problem-card">
            <div class="problem-icon">📊</div>
            <h3>Scattered Data</h3>
            <p>Excel sheets, paper records, and multiple software create information silos and data inconsistencies.</p>
          </div>
          <div class="problem-card">
            <div class="problem-icon">⏰</div>
            <h3>Manual Tracking</h3>
            <p>Hours spent tracking batches, inventory, and deliveries manually with no real-time visibility.</p>
          </div>
          <div class="problem-card">
            <div class="problem-icon">💸</div>
            <h3>Revenue Leaks</h3>
            <p>Poor quality control, wastage, and pricing errors eat into your profits daily.</p>
          </div>
          <div class="problem-card">
            <div class="problem-icon">📱</div>
            <h3>No Mobile Access</h3>
            <p>Can't monitor operations on the go, leading to delayed decisions and missed opportunities.</p>
          </div>
        </div>
      </div>
    </section>

    <section id="how-it-works" class="how-section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">How It Works</span>
          <h2 class="section-title">Get Started in Days, Not Months</h2>
          <p class="section-subtitle">Simple onboarding process designed for fast results</p>
        </div>
        <div class="how-grid">
          <div v-for="(item, index) in howItWorks" :key="index" class="how-card">
            <div class="how-step">{{ item.step }}</div>
            <div class="how-icon"><i :class="`fas ${item.icon}`"></i></div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
            <div v-if="index < howItWorks.length - 1" class="how-connector"></div>
          </div>
        </div>
      </div>
    </section>

    <section id="features" class="features-section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">Features</span>
          <h2 class="section-title">Everything You Need to Run Your Feed Mill</h2>
          <p class="section-subtitle">Powerful features designed specifically for feed manufacturing operations</p>
        </div>
        <div class="features-grid">
          <div v-for="(feature, index) in features" :key="index" class="feature-card">
            <div class="feature-icon"><i :class="`fas ${feature.icon}`"></i></div>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.description }}</p>
            <router-link to="/features" class="feature-link">Learn more <i class="fas fa-arrow-right"></i></router-link>
          </div>
        </div>
      </div>
    </section>

    <section class="workflow-section">
      <div class="container">
        <div class="workflow-grid">
          <div class="workflow-content">
            <span class="section-tag">Streamlined Workflows</span>
            <h2 class="section-title">Automate Your Operations End-to-End</h2>
            <p class="section-subtitle">From raw material purchase to final delivery, automate every step of your production cycle.</p>
            <div class="workflow-list">
              <div v-for="(wf, i) in workflows" :key="i" class="workflow-item">
                <h4>{{ wf.title }}</h4>
                <p>{{ wf.items }}</p>
              </div>
            </div>
            <router-link to="/features" class="btn btn-primary">
              Explore All Features <i class="fas fa-arrow-right"></i>
            </router-link>
          </div>
          <div class="workflow-visual">
            <div class="workflow-card">
              <div class="workflow-header">
                <span class="workflow-dot active"></span>
                <span class="workflow-dot"></span>
                <span class="workflow-dot"></span>
                <span class="workflow-title">Live Dashboard Preview</span>
              </div>
              <div class="workflow-body">
                <div class="metric-row">
                  <div class="metric">
                    <span class="metric-value">24</span>
                    <span class="metric-label">Active Batches</span>
                  </div>
                  <div class="metric">
                    <span class="metric-value">156</span>
                    <span class="metric-label">Orders Today</span>
                  </div>
                  <div class="metric">
                    <span class="metric-value">98%</span>
                    <span class="metric-label">Quality Pass</span>
                  </div>
                </div>
                <div class="chart-placeholder">
                  <div class="chart-bars">
                    <div class="bar" style="height: 60%"></div>
                    <div class="bar" style="height: 80%"></div>
                    <div class="bar" style="height: 45%"></div>
                    <div class="bar" style="height: 90%"></div>
                    <div class="bar" style="height: 70%"></div>
                    <div class="bar" style="height: 95%"></div>
                    <div class="bar" style="height: 85%"></div>
                  </div>
                  <div class="chart-label">Weekly Production (MT)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="integrations-section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">Integrations</span>
          <h2 class="section-title">Works With Your Existing Tools</h2>
          <p class="section-subtitle">Seamlessly connect with scales, printers, GPS systems and more</p>
        </div>
        <div class="integrations-grid">
          <div v-for="(item, index) in integrations" :key="index" class="integration-card">
            <div class="integration-icon"><i :class="`fas ${item.icon}`"></i></div>
            <h4>{{ item.name }}</h4>
            <p>{{ item.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="stats-banner">
      <div class="container">
        <div class="stats-grid">
          <div v-for="(stat, index) in stats" :key="index" class="stat-item">
            <span class="stat-number">{{ stat.number }}{{ stat.suffix }}</span>
            <span class="stat-label">{{ stat.label }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="testimonials-section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">Testimonials</span>
          <h2 class="section-title">What Our Customers Say</h2>
          <p class="section-subtitle">Join hundreds of feed mills already transforming their operations</p>
        </div>
        <div class="testimonials-grid">
          <div v-for="(testimonial, index) in testimonials" :key="index" class="testimonial-card">
            <div class="testimonial-stars">
              <i v-for="i in 5" :key="i" class="fas fa-star"></i>
            </div>
            <p class="testimonial-content">"{{ testimonial.content }}"</p>
            <div class="testimonial-author">
              <div class="author-avatar">{{ testimonial.avatar }}</div>
              <div class="author-info">
                <h4>{{ testimonial.name }}</h4>
                <p>{{ testimonial.role }}, {{ testimonial.company }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="faq" class="faq-section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">FAQ</span>
          <h2 class="section-title">Frequently Asked Questions</h2>
          <p class="section-subtitle">Everything you need to know about FeedMill ERP</p>
        </div>
        <div class="faq-grid">
          <div v-for="(faq, index) in faqs" :key="index" class="faq-item">
            <h4>{{ faq.q }}</h4>
            <p>{{ faq.a }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="cta-section">
      <div class="container">
        <div class="cta-content">
          <h2>Ready to Transform Your Feed Mill?</h2>
          <p>Join hundreds of feed mills already using FeedMill ERP to streamline operations</p>
          <div class="cta-buttons">
            <router-link to="/signup" class="btn btn-primary btn-lg">Start Free Trial</router-link>
            <router-link to="/contact" class="btn btn-white btn-lg">Contact Sales</router-link>
          </div>
          <p class="cta-note">No credit card required • Free 14-day trial • Cancel anytime</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const features = [
  { icon: 'fa-industry', title: 'Production Management', description: 'Manage formulas, batches, job cards, and machine scheduling all in one powerful dashboard.' },
  { icon: 'fa-boxes-stacked', title: 'Inventory Control', description: 'Track raw materials, finished products, stock transfers, and adjustments in real-time.' },
  { icon: 'fa-shopping-cart', title: 'Purchase & Sales', description: 'Streamline purchase orders, goods inward, sales orders, and invoices seamlessly.' },
  { icon: 'fa-truck-fast', title: 'Transport Logistics', description: 'Manage vehicles, drivers, and deliveries with GPS tracking integration.' },
  { icon: 'fa-chart-line', title: 'Financial Accounting', description: 'Track accounts, transactions, payments, and generate comprehensive financial reports.' },
  { icon: 'fa-flask', title: 'Quality Control', description: 'Define QC parameters, record test results, and ensure consistent product quality.' }
]

const stats = [
  { number: '500+', label: 'Active Customers', suffix: '' },
  { number: '40%', label: 'Cost', suffix: 'Reduction' },
  { number: '12', label: 'Countries', suffix: '' },
  { number: '99.9%', label: 'Uptime', suffix: '' }
]

const howItWorks = [
  { step: '01', icon: 'fa-user-plus', title: 'Quick Setup', description: 'Get started in minutes with our guided onboarding. Import your data or start fresh with pre-built templates.' },
  { step: '02', icon: 'fa-sliders', title: 'Customize', description: 'Tailor the system to your specific feed mill operations with flexible configurations and workflows.' },
  { step: '03', icon: 'fa-rocket', title: 'Go Live', description: 'Launch your digital transformation with real-time monitoring and instant insights across all operations.' }
]

const testimonials = [
  { name: 'Rajesh Kumar', role: 'Operations Director', company: 'GreenField Feed Mills', content: 'FeedMill ERP transformed our production efficiency by 35%. The batch tracking and quality control features are exceptional.', avatar: 'RK' },
  { name: 'Priya Sharma', role: 'Plant Manager', company: 'Sunrise Nutrition', content: 'Finally, a system designed specifically for feed mills. The inventory management alone saved us lakhs in losses.', avatar: 'PS' },
  { name: 'Michael Ochieng', role: 'CEO', company: 'Kenya Feeds Ltd', content: 'Implementation was smooth, support is excellent. This platform scales perfectly with our growing business.', avatar: 'MO' }
]

const clients = [
  'GreenField Feeds', 'Sunrise Nutrition', 'Kenya Feeds', 'Agro Mills', 'Farm Fresh', 'Nutri Feed'
]

const integrations = [
  { icon: 'fa-scale', name: 'Weighing Scales', desc: 'Direct integration with industrial scales' },
  { icon: 'fa-truck', name: 'Fleet Tracking', desc: 'GPS and vehicle monitoring' },
  { icon: 'fa-barcode', name: 'Barcode System', desc: 'Print and scan batch labels' },
  { icon: 'fa-file-excel', name: 'Excel Import', desc: 'Bulk data import/export' },
  { icon: 'fa-bell', name: 'SMS Alerts', desc: 'WhatsApp & SMS notifications' },
  { icon: 'fa-cloud', name: 'Cloud Sync', desc: 'Real-time data backup' }
]

const faqs = [
  { q: 'How long does implementation take?', a: 'Most customers are up and running within 1-2 weeks. Our team provides hands-on onboarding and data migration support.' },
  { q: 'Can I access it on mobile?', a: 'Yes! FeedMill ERP is fully responsive and works on tablets and smartphones for field operations.' },
  { q: 'Is my data secure?', a: 'Absolutely. We use bank-grade encryption, regular backups, and are compliant with industry security standards.' },
  { q: 'Do you offer training?', a: 'Yes, we provide comprehensive training sessions, video tutorials, and 24/7 support for all customers.' }
]

const workflows = [
  { title: 'Purchase to Production', items: ['Purchase Order → Goods Inward → QC Check → Raw Material Stock → Production Batch'] },
  { title: 'Order to Delivery', items: ['Sales Order → Production Planning → Batch Completion → Quality Test → Dispatch → Delivery'] },
  { title: 'Financial Tracking', items: ['Invoice → Payment Receipt → Expense Entry → Ledger Update → Financial Report'] }
]
</script>

<style scoped>
.hero-section {
  position: relative;
  min-height: 90vh;
  padding: 120px 0 80px;
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

.hero-grid-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at top right, rgba(37, 99, 235, 0.1) 0%, transparent 50%);
}

.hero-container {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
}

.hero-content {
  max-width: 600px;
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
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
}

.hero-title {
  font-size: clamp(36px, 5vw, 56px);
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
  margin-bottom: 32px;
  max-width: 540px;
}

.hero-buttons {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 48px;
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

.btn-outline {
  background: transparent;
  color: #2563eb;
  border: 2px solid #2563eb;
}

.btn-outline:hover {
  background: #2563eb;
  color: white;
}

.btn-lg {
  padding: 16px 32px;
  font-size: 16px;
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

.hero-stats {
  display: flex;
  gap: 40px;
}

.hero-stat {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 36px;
  font-weight: 800;
  color: #2563eb;
  font-family: 'Sora', sans-serif;
}

.stat-label {
  font-size: 14px;
  color: #64748b;
}

.hero-visual {
  position: relative;
}

.hero-image-wrapper {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.hero-main-image {
  width: 100%;
  height: 400px;
  object-fit: cover;
}

.hero-card {
  position: absolute;
  background: white;
  padding: 16px 20px;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 12px;
}

.hero-card-1 { top: 20px; right: -20px; }
.hero-card-2 { bottom: 60px; left: -30px; }
.hero-card-3 { bottom: 20px; right: 20px; }

.card-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: white;
}

.card-icon.green { background: #10b981; }
.card-icon.blue { background: #2563eb; }
.card-icon.purple { background: #8b5cf6; }

.card-info {
  display: flex;
  flex-direction: column;
}

.card-value {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.card-label {
  font-size: 12px;
  color: #64748b;
}

.clients-section {
  padding: 60px 0;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.clients-label {
  text-align: center;
  font-size: 14px;
  color: #64748b;
  margin-bottom: 32px;
}

.clients-grid {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 40px;
}

.client-logo {
  font-size: 18px;
  font-weight: 600;
  color: #94a3b8;
  padding: 8px 20px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.3s;
}

.client-logo:hover {
  color: #2563eb;
  border-color: #2563eb;
}

.problem-section {
  padding: 100px 0;
  background: #f8fafc;
}

.section-header {
  text-align: center;
  max-width: 700px;
  margin: 0 auto 60px;
}

.section-tag {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
}

.section-title {
  font-size: clamp(28px, 4vw, 42px);
  margin-bottom: 16px;
  color: #0f172a;
  font-family: 'Sora', sans-serif;
}

.section-subtitle {
  font-size: 18px;
  color: #64748b;
}

.problem-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
}

.problem-card {
  background: white;
  padding: 32px;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s;
}

.problem-card:hover {
  transform: translateY(-5px);
}

.problem-icon {
  font-size: 40px;
  margin-bottom: 20px;
}

.problem-card h3 {
  font-size: 20px;
  margin-bottom: 12px;
  color: #0f172a;
}

.problem-card p {
  color: #64748b;
  line-height: 1.6;
}

.how-section {
  padding: 100px 0;
  background: white;
}

.how-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 40px;
  position: relative;
}

.how-card {
  text-align: center;
  position: relative;
  padding: 40px 24px;
}

.how-step {
  font-size: 64px;
  font-weight: 800;
  color: rgba(37, 99, 235, 0.1);
  font-family: 'Sora', sans-serif;
  margin-bottom: 20px;
}

.how-icon {
  width: 70px;
  height: 70px;
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: white;
  margin: 0 auto 24px;
}

.how-card h3 {
  font-size: 22px;
  margin-bottom: 12px;
  color: #0f172a;
}

.how-card p {
  color: #64748b;
  line-height: 1.6;
}

.how-connector {
  position: absolute;
  top: 80px;
  right: -20px;
  width: 40px;
  height: 2px;
  background: linear-gradient(90deg, #2563eb, #7c3aed);
}

.features-section {
  padding: 100px 0;
  background: #f8fafc;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
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
  margin-bottom: 16px;
}

.feature-link {
  color: #2563eb;
  font-weight: 600;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.feature-link:hover {
  gap: 10px;
}

.workflow-section {
  padding: 100px 0;
  background: white;
}

.workflow-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
}

.workflow-content .section-tag {
  margin-bottom: 16px;
}

.workflow-content .section-title {
  text-align: left;
  margin-bottom: 12px;
}

.workflow-content .section-subtitle {
  text-align: left;
  margin-bottom: 32px;
}

.workflow-list {
  margin-bottom: 32px;
}

.workflow-item {
  padding: 16px 20px;
  background: #f8fafc;
  border-radius: 10px;
  margin-bottom: 12px;
  border-left: 4px solid #2563eb;
}

.workflow-item h4 {
  font-size: 16px;
  color: #0f172a;
  margin-bottom: 6px;
}

.workflow-item p {
  font-size: 14px;
  color: #64748b;
}

.workflow-visual {
  position: relative;
}

.workflow-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.workflow-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.workflow-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #e5e7eb;
}

.workflow-dot.active {
  background: #10b981;
}

.workflow-title {
  font-size: 13px;
  color: #64748b;
  margin-left: auto;
}

.workflow-body {
  padding: 24px;
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.metric {
  text-align: center;
  padding: 16px;
  background: #f8fafc;
  border-radius: 10px;
}

.metric-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 12px;
  color: #64748b;
}

.chart-placeholder {
  background: #f8fafc;
  padding: 20px;
  border-radius: 10px;
}

.chart-bars {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 100px;
  margin-bottom: 12px;
}

.bar {
  width: 30px;
  background: linear-gradient(180deg, #2563eb 0%, #7c3aed 100%);
  border-radius: 4px 4px 0 0;
}

.chart-label {
  text-align: center;
  font-size: 12px;
  color: #64748b;
}

.integrations-section {
  padding: 100px 0;
  background: #0f172a;
}

.integrations-section .section-tag {
  background: rgba(37, 99, 235, 0.2);
  color: #60a5fa;
}

.integrations-section .section-title {
  color: white;
}

.integrations-section .section-subtitle {
  color: #94a3b8;
}

.integrations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 24px;
}

.integration-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 24px;
  border-radius: 12px;
  text-align: center;
  transition: all 0.3s;
}

.integration-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(37, 99, 235, 0.3);
}

.integration-icon {
  width: 50px;
  height: 50px;
  background: rgba(37, 99, 235, 0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #60a5fa;
  margin: 0 auto 16px;
}

.integration-card h4 {
  font-size: 16px;
  color: white;
  margin-bottom: 8px;
}

.integration-card p {
  font-size: 13px;
  color: #94a3b8;
}

.stats-banner {
  padding: 80px 0;
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 40px;
}

.stat-item {
  text-align: center;
}

.stats-banner .stat-number {
  font-size: 48px;
  color: white;
}

.stats-banner .stat-label {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
}

.testimonials-section {
  padding: 100px 0;
  background: #f8fafc;
}

.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}

.testimonial-card {
  background: white;
  padding: 32px;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.testimonial-stars {
  color: #f59e0b;
  margin-bottom: 16px;
}

.testimonial-stars i {
  margin-right: 4px;
}

.testimonial-content {
  font-size: 16px;
  color: #64748b;
  line-height: 1.7;
  margin-bottom: 24px;
  font-style: italic;
}

.testimonial-author {
  display: flex;
  align-items: center;
  gap: 16px;
}

.author-avatar {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: white;
}

.author-info h4 {
  font-size: 16px;
  color: #0f172a;
  margin-bottom: 4px;
}

.author-info p {
  font-size: 14px;
  color: #64748b;
}

.faq-section {
  padding: 100px 0;
  background: white;
}

.faq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 24px;
}

.faq-item {
  background: #f8fafc;
  padding: 24px;
  border-radius: 12px;
}

.faq-item h4 {
  font-size: 18px;
  color: #0f172a;
  margin-bottom: 12px;
}

.faq-item p {
  color: #64748b;
  line-height: 1.6;
}

.cta-section {
  padding: 100px 0;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.cta-content {
  text-align: center;
  max-width: 700px;
  margin: 0 auto;
}

.cta-content h2 {
  font-size: clamp(28px, 4vw, 42px);
  color: white;
  margin-bottom: 16px;
}

.cta-content p {
  font-size: 18px;
  color: #94a3b8;
  margin-bottom: 32px;
}

.cta-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 24px;
}

.cta-note {
  font-size: 14px;
  color: #64748b;
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
}

@media (max-width: 1024px) {
  .hero-container {
    grid-template-columns: 1fr;
    text-align: center;
  }
  
  .hero-content {
    max-width: 100%;
  }
  
  .hero-buttons {
    justify-content: center;
  }
  
  .hero-stats {
    justify-content: center;
  }
  
  .how-grid {
    grid-template-columns: 1fr;
  }
  
  .how-connector {
    display: none;
  }
  
  .workflow-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .hero-section {
    padding: 100px 0 60px;
  }
  
  .hero-title {
    font-size: 32px;
  }
  
  .hero-stats {
    flex-direction: column;
    gap: 20px;
  }
  
  .stat-number {
    font-size: 28px;
  }
  
  .problem-grid,
  .features-grid,
  .testimonials-grid,
  .faq-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  
  .cta-buttons {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}
</style>
