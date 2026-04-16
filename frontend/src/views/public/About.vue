<template>
  <div>
    <section class="hero-section">
      <div class="hero-bg"><div class="hero-pattern"></div></div>
      <div class="container hero-container">
        <div class="hero-content">
          <div class="hero-badge"><span class="badge-dot"></span>About Us</div>
          <h1 class="hero-title">Empowering Feed Manufacturers<br /><span class="hero-highlight">With Modern Technology</span></h1>
          <p class="hero-description">Since 2015, we've been dedicated to transforming the feed manufacturing industry.</p>
        </div>
      </div>
    </section>

    <section class="stats-banner">
      <div class="container">
        <div class="stats-grid">
          <div v-for="(stat, index) in stats" :key="index" class="stat-item">
            <span class="stat-number">{{ stat.number }}</span>
            <span class="stat-label">{{ stat.label }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="mission-section">
      <div class="container">
        <div class="section-header">
          <span class="section-tag">Our Mission</span>
          <h2 class="section-title">Transforming Feed Manufacturing</h2>
          <p class="section-subtitle">We are dedicated to transforming the feed manufacturing industry by providing intuitive, powerful software solutions that help businesses streamline operations, reduce costs, and maximize profitability.</p>
        </div>
      </div>
    </section>

    <section class="values-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Our Values</h2>
        </div>
        <div class="values-grid">
          <div v-for="(value, index) in values" :key="index" class="value-card">
            <div class="value-icon"><i :class="`fas ${value.icon}`"></i></div>
            <h3>{{ value.title }}</h3>
            <p>{{ value.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="timeline-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Our Journey</h2>
        </div>
        <div class="timeline">
          <div v-for="(item, index) in timeline" :key="index" class="timeline-item">
            <div class="timeline-year">{{ item.year }}</div>
            <div class="timeline-content">
              <h3>{{ item.title }}</h3>
              <p>{{ item.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="cta-section">
      <div class="container">
        <div class="cta-content">
          <h2>Join Us on Our Journey</h2>
          <p>Start your digital transformation today</p>
          <router-link to="/contact" class="btn btn-primary btn-lg">Get in Touch</router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
const stats = [
  { number: '500+', label: 'Happy Customers' },
  { number: '50+', label: 'Team Members' },
  { number: '12', label: 'Countries' },
  { number: '99.9%', label: 'Uptime' }
]

const values = [
  { icon: 'fa-lightbulb', title: 'Innovation', desc: 'We constantly innovate to provide the best solutions for your business.' },
  { icon: 'fa-handshake', title: 'Trust', desc: 'Building long-term relationships based on trust and transparency.' },
  { icon: 'fa-users', title: 'Customer Focus', desc: 'Your success is our success.' },
  { icon: 'fa-award', title: 'Excellence', desc: 'Striving for excellence in everything we do.' }
]

const timeline = [
  { year: '2015', title: 'Founded', desc: 'FeedMill ERP was founded to solve feed manufacturing challenges.' },
  { year: '2017', title: 'First 100 Customers', desc: 'Reached our first milestone of 100 satisfied customers.' },
  { year: '2019', title: 'International Expansion', desc: 'Expanded operations to 5 countries across Asia.' },
  { year: '2021', title: 'Series A Funding', desc: 'Secured funding to accelerate product development.' },
  { year: '2023', title: '500+ Customers', desc: 'Reached 500+ customers globally.' },
  { year: '2024', title: 'IoT Integration', desc: 'Launched IoT and smart factory features.' }
]
</script>

<style scoped>
.hero-section {
  position: relative;
  min-height: 60vh;
  padding: 120px 0 60px;
  overflow: hidden;
  background: linear-gradient(135deg, #f8fafc 0%, #fef3c7 100%);
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

.stats-banner {
  padding: 60px 0;
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

.stat-number {
  display: block;
  font-family: 'Sora', sans-serif;
  font-size: 48px;
  font-weight: 800;
  color: white;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
}

.mission-section {
  padding: 80px 0;
  background: #f8fafc;
}

.section-header {
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
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
  line-height: 1.7;
}

.values-section {
  padding: 80px 0;
  background: white;
}

.values-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
  max-width: 1100px;
  margin: 0 auto;
}

.value-card {
  background: #f8fafc;
  padding: 32px;
  border-radius: 16px;
  text-align: center;
  transition: all 0.3s;
}

.value-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.value-icon {
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

.value-card h3 {
  font-size: 22px;
  color: #0f172a;
  margin-bottom: 12px;
}

.value-card p {
  color: #64748b;
  line-height: 1.6;
}

.timeline-section {
  padding: 80px 0;
  background: #f8fafc;
}

.timeline {
  max-width: 800px;
  margin: 0 auto;
}

.timeline-item {
  display: flex;
  gap: 24px;
  margin-bottom: 28px;
  align-items: center;
}

.timeline-year {
  min-width: 80px;
  padding: 14px 18px;
  background: #2563eb;
  color: white;
  border-radius: 10px;
  font-weight: 700;
  text-align: center;
  font-family: 'Sora', sans-serif;
}

.timeline-content h3 {
  font-size: 20px;
  color: #0f172a;
  margin-bottom: 6px;
}

.timeline-content p {
  color: #64748b;
  font-size: 15px;
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
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }
  
  .stat-number {
    font-size: 36px;
  }
  
  .timeline-item {
    flex-direction: column;
    text-align: center;
  }
  
  .timeline-year {
    width: 100%;
  }
}
</style>
