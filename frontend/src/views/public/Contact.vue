<template>
  <div>
    <section class="hero-section">
      <div class="hero-bg"><div class="hero-pattern"></div></div>
      <div class="container hero-container">
        <div class="hero-content">
          <div class="hero-badge"><span class="badge-dot"></span>Contact Us</div>
          <h1 class="hero-title">Get In Touch</h1>
          <p class="hero-description">Have questions? We'd love to hear from you. Our team is here to help.</p>
        </div>
      </div>
    </section>

    <section class="contact-section">
      <div class="container">
        <div class="contact-grid">
          <div class="contact-info">
            <h2>Contact Information</h2>
            <p class="contact-intro">Reach out to us through any of these channels, and we'll get back to you within 24 hours.</p>
            <div v-for="(info, index) in contactInfo" :key="index" class="info-item">
              <div class="info-icon"><i :class="`fas ${info.icon}`"></i></div>
              <div class="info-content">
                <h4>{{ info.title }}</h4>
                <p>{{ info.content }}</p>
              </div>
            </div>
          </div>

          <div class="contact-form">
            <h2>Send Us a Message</h2>
            
            <div v-if="successMessage" class="success-message">
              <div class="success-icon">✓</div>
              <h3>Thank You!</h3>
              <p>{{ successMessage }}</p>
              <p v-if="referenceId" class="reference-id">Reference: {{ referenceId }}</p>
              <button type="button" class="btn btn-secondary" @click="resetForm">Send Another Message</button>
            </div>
            
            <form v-else @submit.prevent="submitForm">
              <div class="form-group">
                <label>Full Name *</label>
                <input 
                  type="text" 
                  v-model="form.name" 
                  placeholder="John Doe" 
                  required
                  :class="{ 'input-error': errors.name }"
                />
                <span v-if="errors.name" class="form-error">{{ errors.name }}</span>
              </div>
              <div class="form-group">
                <label>Email Address *</label>
                <input 
                  type="email" 
                  v-model="form.email" 
                  placeholder="john@example.com" 
                  required
                  :class="{ 'input-error': errors.email }"
                />
                <span v-if="errors.email" class="form-error">{{ errors.email }}</span>
              </div>
              <div class="form-group">
                <label>Phone (Optional)</label>
                <input 
                  type="tel" 
                  v-model="form.phone" 
                  placeholder="+88 01XXX XXXXXX"
                />
              </div>
              <div class="form-group">
                <label>Subject *</label>
                <input 
                  type="text" 
                  v-model="form.subject" 
                  placeholder="How can we help?" 
                  required
                  :class="{ 'input-error': errors.subject }"
                />
                <span v-if="errors.subject" class="form-error">{{ errors.subject }}</span>
              </div>
              <div class="form-group">
                <label>Message *</label>
                <textarea 
                  v-model="form.message" 
                  placeholder="Please describe your inquiry in detail..." 
                  rows="5" 
                  required
                  :class="{ 'input-error': errors.message }"
                ></textarea>
                <span v-if="errors.message" class="form-error">{{ errors.message }}</span>
              </div>
              
              <div v-if="submitError" class="error-message">
                {{ submitError }}
              </div>
              
              <button type="submit" class="btn btn-primary btn-lg" :disabled="loading">
                <span v-if="loading" class="spinner"></span>
                <span v-else><i class="fas fa-paper-plane"></i> Send Message</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import api from '@/api'

const contactInfo = [
  { icon: 'fa-map-marker-alt', title: 'Address', content: '123 Business Park, Dhaka, Bangladesh' },
  { icon: 'fa-phone', title: 'Phone', content: '+88 02 12345678' },
  { icon: 'fa-envelope', title: 'Email', content: 'info@feedmill-erp.com' },
  { icon: 'fa-clock', title: 'Business Hours', content: 'Sunday - Thursday: 9AM - 6PM' }
]

const form = reactive({
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: ''
})

const errors = reactive({})
const loading = ref(false)
const submitError = ref('')
const successMessage = ref('')
const referenceId = ref('')

function validateForm() {
  let isValid = true
  errors.name = ''
  errors.email = ''
  errors.subject = ''
  errors.message = ''
  
  if (!form.name || form.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters'
    isValid = false
  }
  
  if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Please enter a valid email address'
    isValid = false
  }
  
  if (!form.subject || form.subject.trim().length < 3) {
    errors.subject = 'Subject must be at least 3 characters'
    isValid = false
  }
  
  if (!form.message || form.message.trim().length < 10) {
    errors.message = 'Message must be at least 10 characters'
    isValid = false
  }
  
  return isValid
}

async function submitForm() {
  if (!validateForm()) return
  
  loading.value = true
  submitError.value = ''
  
  try {
    const response = await api.post('/contact', {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null,
      subject: form.subject.trim(),
      message: form.message.trim()
    })
    
    if (response.data.success) {
      successMessage.value = response.data.message || 'Your message has been sent successfully!'
      referenceId.value = response.data.data?.referenceId || ''
    }
  } catch (error) {
    const errorData = error.response?.data?.error
    if (errorData?.fields) {
      Object.keys(errorData.fields).forEach(field => {
        errors[field] = errorData.fields[field]
      })
    } else if (errorData?.message) {
      submitError.value = errorData.message
    } else {
      submitError.value = 'Failed to send message. Please try again.'
    }
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.name = ''
  form.email = ''
  form.phone = ''
  form.subject = ''
  form.message = ''
  successMessage.value = ''
  referenceId.value = ''
  submitError.value = ''
  errors.name = ''
  errors.email = ''
  errors.subject = ''
  errors.message = ''
}
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

.hero-description {
  font-size: 18px;
  color: #64748b;
  line-height: 1.7;
  max-width: 500px;
  margin: 0 auto;
}

.contact-section {
  padding: 80px 0;
  background: white;
}

.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 60px;
  max-width: 1100px;
  margin: 0 auto;
}

.contact-info h2,
.contact-form h2 {
  font-size: 28px;
  color: #0f172a;
  margin-bottom: 24px;
  font-family: 'Sora', sans-serif;
}

.contact-intro {
  color: #64748b;
  margin-bottom: 32px;
  line-height: 1.7;
}

.info-item {
  display: flex;
  gap: 18px;
  margin-bottom: 24px;
  align-items: flex-start;
}

.info-icon {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  color: white;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.info-content h4 {
  font-size: 16px;
  color: #0f172a;
  margin-bottom: 4px;
}

.info-content p {
  color: #64748b;
  font-size: 14px;
}

.contact-form {
  background: white;
  padding: 40px;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  border: 1px solid #e5e7eb;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 14px;
  color: #0f172a;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 14px 18px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 16px;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-group input.input-error,
.form-group textarea.input-error {
  border-color: #dc2626;
}

.form-group textarea {
  resize: vertical;
  min-height: 120px;
}

.form-error {
  display: block;
  color: #dc2626;
  font-size: 12px;
  margin-top: 4px;
}

.error-message {
  padding: 12px;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #dc2626;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.success-message {
  text-align: center;
  padding: 40px 20px;
}

.success-icon {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin: 0 auto 20px;
}

.success-message h3 {
  font-size: 24px;
  color: #0f172a;
  margin-bottom: 12px;
}

.success-message p {
  color: #64748b;
  font-size: 16px;
  margin-bottom: 8px;
}

.reference-id {
  font-family: monospace;
  background: #f8fafc;
  padding: 8px 16px;
  border-radius: 8px;
  display: inline-block;
  margin: 16px 0;
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

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f8fafc;
  color: #2563eb;
  border: 2px solid #2563eb;
  width: auto;
  padding: 12px 24px;
}

.btn-secondary:hover {
  background: #2563eb;
  color: white;
}

.btn-lg {
  padding: 16px 32px;
  font-size: 16px;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
}

@media (max-width: 768px) {
  .contact-grid {
    grid-template-columns: 1fr;
  }
  
  .contact-form {
    padding: 24px;
  }
}
</style>
