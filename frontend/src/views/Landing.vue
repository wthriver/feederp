<template>
    <div class="public-page">
        <header class="public-header">
            <div class="header-container">
                <router-link to="/" class="logo">
                    <span class="logo-icon">FM</span>
                    <span class="logo-text">FeedMill<span class="text-accent">ERP</span></span>
                </router-link>
                <nav class="public-nav" :class="{ 'nav-open': mobileMenuOpen }">
                    <router-link to="/" :class="{ active: $route.path === '/' }" @click="mobileMenuOpen = false">Home</router-link>
                    <router-link to="/features" :class="{ active: $route.path === '/features' }" @click="mobileMenuOpen = false">Features</router-link>
                    <router-link to="/pricing" :class="{ active: $route.path === '/pricing' }" @click="mobileMenuOpen = false">Pricing</router-link>
                    <router-link to="/about" :class="{ active: $route.path === '/about' }" @click="mobileMenuOpen = false">About</router-link>
                    <router-link to="/contact" :class="{ active: $route.path === '/contact' }" @click="mobileMenuOpen = false">Contact</router-link>
                    <div class="mobile-actions">
                        <template v-if="isLoggedIn">
                            <button class="btn btn-primary" @click="goToDashboard(); mobileMenuOpen = false">Dashboard</button>
                            <button class="btn btn-ghost" @click="logout">Logout</button>
                        </template>
                        <template v-else>
                            <router-link to="/login" class="btn btn-ghost" @click="mobileMenuOpen = false">Login</router-link>
                            <router-link to="/signup" class="btn btn-primary" @click="mobileMenuOpen = false">Start Free Trial</router-link>
                        </template>
                    </div>
                </nav>
                <div class="header-actions desktop-only">
                    <template v-if="isLoggedIn">
                        <button class="btn btn-primary" @click="goToDashboard">Dashboard</button>
                        <button class="btn btn-ghost" @click="logout">Logout</button>
                    </template>
                    <template v-else>
                        <router-link to="/login" class="btn btn-ghost">Login</router-link>
                        <router-link to="/signup" class="btn btn-primary">Start Free Trial</router-link>
                    </template>
                </div>
                <button class="mobile-menu-btn" @click="mobileMenuOpen = !mobileMenuOpen" :class="{ active: mobileMenuOpen }">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
        </header>

        <main class="public-main">
            <router-view />
            <footer class="public-footer">
                <div class="footer-container">
                    <div class="footer-section">
                        <div class="footer-logo">
                            <span class="logo-icon-sm">FM</span>
                            <span class="logo-text-sm">FeedMill<span class="text-accent">ERP</span></span>
                        </div>
                        <p>Enterprise-grade ERP for cattle, poultry, and fish feed production.</p>
                    </div>
                    <div class="footer-section">
                        <h4>Product</h4>
                        <router-link to="/features">Features</router-link>
                        <router-link to="/pricing">Pricing</router-link>
                        <router-link to="/about">About</router-link>
                        <router-link to="/contact">Contact</router-link>
                    </div>
                    <div class="footer-section">
                        <h4>Company</h4>
                        <a href="#">Careers</a>
                        <a href="#">Blog</a>
                        <a href="#">Press</a>
                        <a href="#">Partners</a>
                    </div>
                    <div class="footer-section">
                        <h4>Support</h4>
                        <p>info@feedmill-erp.com</p>
                        <p>+88 02 12345678</p>
                        <div class="social-links">
                            <a href="#"><i class="fab fa-facebook"></i></a>
                            <a href="#"><i class="fab fa-twitter"></i></a>
                            <a href="#"><i class="fab fa-linkedin"></i></a>
                        </div>
                    </div>
                </div>
                <div class="footer-bottom">
                    <p>&copy; 2024 FeedMill ERP. All rights reserved.</p>
                    <div class="footer-legal">
                        <a href="#">Privacy Policy</a>
                        <a href="#">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </main>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isLoggedIn = computed(() => !!localStorage.getItem('token'))
const mobileMenuOpen = ref(false)

function goToDashboard() {
    router.push('/dashboard')
}

function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    localStorage.removeItem('permissions')
    localStorage.removeItem('factory')
    mobileMenuOpen.value = false
    router.push('/')
}
</script>

<style scoped>
:root {
    --public-primary: #2563eb;
    --public-primary-light: #3b82f6;
    --public-primary-dark: #1d4ed8;
    --public-secondary: #64748b;
    --public-accent: #7c3aed;
    --public-success: #10b981;
    --public-warning: #f59e0b;
    --public-danger: #ef4444;
    --public-text-primary: #0f172a;
    --public-text-secondary: #64748b;
    --public-text-muted: #94a3b8;
    --public-bg-primary: #ffffff;
    --public-bg-secondary: #f8fafc;
    --public-bg-dark: #0f172a;
    --public-border: #e5e7eb;
    --public-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
}

.public-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.public-header {
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    z-index: 1;
}

.header-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 40px;
    height: 70px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.logo {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
}

.logo-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
    color: white;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
}

.logo-text {
    font-size: 22px;
    font-weight: 700;
    color: #0f172a;
}

.text-accent {
    color: #2563eb;
}

.public-nav {
    display: flex;
    gap: 32px;
}

.public-nav a {
    text-decoration: none;
    color: #64748b;
    font-weight: 500;
    font-size: 15px;
    padding: 8px 0;
    position: relative;
    transition: color 0.2s;
}

.public-nav a:hover,
.public-nav a.active {
    color: #2563eb;
}

.public-nav a.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: #2563eb;
}

.header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
}

.public-main {
    flex: 1;
    margin-top: 70px;
    overflow-y: auto;
    overflow-x: hidden;
    height: calc(100vh - 70px);
}

.public-footer {
    flex-shrink: 0;
    background: #0f172a;
    color: white;
    padding: 40px;
    margin-top: auto;
}

.footer-container {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 1fr;
    gap: 60px;
}

.footer-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
}

.logo-icon-sm {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
    color: white;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
}

.logo-text-sm {
    font-size: 20px;
    font-weight: 700;
    color: white;
}

.footer-section h4 {
    font-size: 16px;
    margin-bottom: 20px;
    color: white;
}

.footer-section p {
    color: #94a3b8;
    font-size: 14px;
    margin-bottom: 8px;
    line-height: 1.6;
}

.footer-section a {
    display: block;
    color: #94a3b8;
    text-decoration: none;
    margin-bottom: 12px;
    font-size: 14px;
    transition: color 0.2s;
}

.footer-section a:hover {
    color: white;
}

.social-links {
    display: flex;
    gap: 16px;
    margin-top: 16px;
}

.social-links a {
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}

.social-links a:hover {
    background: #2563eb;
}

.social-links i {
    font-size: 18px;
    color: white;
}

.footer-bottom {
    max-width: 1200px;
    margin: 30px auto 0;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #64748b;
    font-size: 14px;
}

.footer-legal {
    display: flex;
    gap: 24px;
}

.footer-legal a {
    color: #64748b;
    text-decoration: none;
    transition: color 0.2s;
}

.footer-legal a:hover {
    color: white;
}

.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 24px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    text-decoration: none;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
}

.btn-primary {
    background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
    color: white;
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
}

.btn-ghost {
    background: transparent;
    color: #64748b;
}

.btn-ghost:hover {
    color: #2563eb;
    background: rgba(37, 99, 235, 0.1);
}

@media (max-width: 1024px) {
    .footer-container {
        grid-template-columns: repeat(2, 1fr);
        gap: 40px;
    }
}

@media (max-width: 768px) {
    .header-container {
        padding: 0 20px;
    }
    
    .desktop-only {
        display: none;
    }
    
    .public-nav {
        position: fixed;
        top: 70px;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.98);
        backdrop-filter: blur(20px);
        flex-direction: column;
        padding: 24px;
        gap: 0;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        z-index: 999;
        overflow-y: auto;
    }
    
    .public-nav.nav-open {
        transform: translateX(0);
    }
    
    .public-nav a {
        padding: 16px 0;
        border-bottom: 1px solid var(--border-light);
        font-size: 18px;
    }
    
    .mobile-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid var(--border-light);
    }
    
    .mobile-actions .btn {
        width: 100%;
        justify-content: center;
    }
    
    .mobile-menu-btn {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        width: 28px;
        height: 20px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        z-index: 1000;
    }
    
    .mobile-menu-btn span {
        display: block;
        width: 100%;
        height: 2px;
        background: #0f172a;
        border-radius: 2px;
        transition: all 0.3s ease;
    }
    
    .mobile-menu-btn.active span:nth-child(1) {
        transform: translateY(9px) rotate(45deg);
    }
    
    .mobile-menu-btn.active span:nth-child(2) {
        opacity: 0;
    }
    
    .mobile-menu-btn.active span:nth-child(3) {
        transform: translateY(-9px) rotate(-45deg);
    }
    
    .footer-container {
        grid-template-columns: 1fr;
        gap: 32px;
    }
    
    .footer-bottom {
        flex-direction: column;
        gap: 16px;
        text-align: center;
    }
}
</style>
