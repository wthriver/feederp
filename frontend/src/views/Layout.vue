<template>
    <div class="app-layout">
        <aside class="sidebar" :class="{ 'sidebar-expanded': isExpanded }">
            <div class="sidebar-header">
                <div class="logo">
                    <span class="logo-icon">FM</span>
                    <span class="logo-text">FeedMill ERP</span>
                </div>
                <button class="sidebar-toggle" @click="toggleSidebar">
                    {{ isExpanded ? '✕' : '☰' }}
                </button>
            </div>

            <nav class="sidebar-nav">
                <template v-for="item in menuItems" :key="item.path">
                    <router-link
                        v-if="!item.children"
                        :to="item.path"
                        class="nav-item"
                        :class="{ active: isActive(item.path) }"
                        @click="closeSidebarOnMobile"
                    >
                        <span class="nav-icon">{{ item.icon }}</span>
                        <span class="nav-label">{{ $t(item.label) }}</span>
                    </router-link>

                    <div v-else class="nav-group">
                        <div class="nav-group-header" @click="toggleGroup(item)">
                            <span class="nav-icon">{{ item.icon }}</span>
                            <span class="nav-label">{{ $t(item.label) }}</span>
                            <span class="nav-arrow">{{ item.expanded ? '▼' : '▶' }}</span>
                        </div>
                        <div v-show="item.expanded" class="nav-group-items">
                            <router-link
                                v-for="child in item.children"
                                :key="child.path"
                                :to="child.path"
                                class="nav-item nav-child"
                                :class="{ active: isActive(child.path) }"
                                @click="closeSidebarOnMobile"
                            >
                                {{ $t(child.label) }}
                            </router-link>
                        </div>
                    </div>
                </template>
            </nav>
        </aside>

        <div class="main-wrapper">
            <header class="header">
                <div class="header-left">
                    <button class="mobile-menu-btn" @click="toggleSidebar">
                        <span>☰</span>
                    </button>

                    <div class="factory-selector">
                        <select v-model="selectedFactory" @change="changeFactory" class="select-field">
                            <option v-for="f in authStore.factories" :key="f.id" :value="f.id">
                                {{ f.name }}
                            </option>
                        </select>
                    </div>
                </div>

                <div class="header-right">
                    <div class="header-search">
                        <input type="text" :placeholder="$t('common.search')" class="input-field" />
                    </div>

                    <div class="header-actions">
                        <button class="btn btn-icon" :title="$t('common.refresh')" @click="refreshData">
                            ↻
                        </button>
                        <button class="btn btn-icon" @click="toggleTheme" :title="isDark ? 'Light Mode' : 'Dark Mode'">
                            {{ isDark ? '☀️' : '🌙' }}
                        </button>
                    </div>

                    <div class="user-menu">
                        <select v-model="locale" @change="changeLocale" class="select-field lang-select">
                            <option value="en">EN</option>
                            <option value="bn">বাং</option>
                        </select>

                        <div class="user-info">
                            <span class="user-name">{{ authStore.user?.name }}</span>
                            <span class="user-role">{{ authStore.user?.roleName }}</span>
                        </div>

                        <button class="btn btn-icon" @click="logout" :title="$t('auth.logout')">
                            →
                        </button>
                    </div>
                </div>
            </header>

            <main class="main-content">
                <router-view />
            </main>
        </div>

        <div v-if="isExpanded && isMobile" class="sidebar-overlay" @click="toggleSidebar"></div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/store/auth'

const router = useRouter()
const route = useRoute()
const { locale } = useI18n()
const authStore = useAuthStore()

const isExpanded = ref(true)
const isMobile = ref(false)
const selectedFactory = ref(null)
const isDark = ref(localStorage.getItem('theme') === 'dark')

function toggleTheme() {
    isDark.value = !isDark.value
    document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

if (isDark.value) {
    document.documentElement.setAttribute('data-theme', 'dark')
}

const menuItems = ref([
    { path: '/', icon: '📊', label: 'nav.dashboard' },
    {
        icon: '📦', label: 'nav.master', expanded: false,
        children: [
            { path: '/factories', label: 'nav.factories' },
            { path: '/godowns', label: 'nav.godowns' },
            { path: '/raw-materials', label: 'nav.rawMaterials' },
            { path: '/products', label: 'nav.products' },
            { path: '/suppliers', label: 'nav.suppliers' },
            { path: '/customers', label: 'nav.customers' },
            { path: '/units', label: 'nav.units' },
            { path: '/price-lists', label: 'nav.priceLists' },
            { path: '/discount-rules', label: 'nav.discountRules' },
            { path: '/credit-notes', label: 'nav.creditNotes' },
            { path: '/currencies', label: 'nav.currencies' },
            { path: '/regions', label: 'nav.regions' },
            { path: '/routes', label: 'nav.routes' }
        ]
    },
    {
        icon: '🛒', label: 'nav.purchase', expanded: false,
        children: [
            { path: '/purchase-orders', label: 'nav.purchaseOrders' },
            { path: '/goods-inward', label: 'nav.goodsInward' }
        ]
    },
    {
        icon: '📋', label: 'nav.inventory', expanded: false,
        children: [
            { path: '/stock', label: 'nav.stock' },
            { path: '/stock-transfers', label: 'nav.transfers' },
            { path: '/stock-adjustments', label: 'nav.adjustments' }
        ]
    },
    {
        icon: '🏭', label: 'nav.production', expanded: false,
        children: [
            { path: '/formulas', label: 'nav.formulas' },
            { path: '/batches', label: 'nav.batches' },
            { path: '/machines', label: 'nav.machines' },
            { path: '/job-cards', label: 'nav.jobCards' }
        ]
    },
    { path: '/qc-parameters', icon: '✓', label: 'nav.quality' },
    {
        icon: '💰', label: 'nav.sales', expanded: false,
        children: [
            { path: '/sales-orders', label: 'nav.salesOrders' },
            { path: '/invoices', label: 'nav.invoices' },
            { path: '/sales-returns', label: 'nav.returns' },
            { path: '/recurring-orders', label: 'nav.recurringOrders' }
        ]
    },
    {
        icon: '💳', label: 'nav.finance', expanded: false,
        children: [
            { path: '/accounts', label: 'nav.accounts' },
            { path: '/transactions', label: 'nav.transactions' },
            { path: '/payments', label: 'nav.payments' }
        ]
    },
    {
        icon: '🚚', label: 'nav.transport', expanded: false,
        children: [
            { path: '/vehicles', label: 'nav.vehicles' },
            { path: '/drivers', label: 'nav.drivers' },
            { path: '/deliveries', label: 'nav.deliveries' }
        ]
    },
    { path: '/barcode', icon: '⊟', label: 'nav.barcode' },
    { path: '/iot', icon: '📡', label: 'nav.iot' },
    { path: '/reports', icon: '📈', label: 'nav.reports' },
    {
        icon: '⚙️', label: 'nav.settings', expanded: false,
        children: [
            { path: '/users', label: 'nav.users' },
            { path: '/roles', label: 'nav.roles' },
            { path: '/activity-log', label: 'nav.activityLog' },
            { path: '/settings', label: 'nav.settings' }
        ]
    }
])

function toggleSidebar() {
    isExpanded.value = !isExpanded.value
}

function closeSidebar() {
    isExpanded.value = false
}

function closeSidebarOnMobile() {
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            closeSidebar()
        }, 150)
    }
}

function isActive(path) {
    if (path === '/') return route.path === '/'
    return route.path.startsWith(path)
}

function toggleGroup(item) {
    item.expanded = !item.expanded
}

function changeFactory() {
    const factory = authStore.factories.find(f => f.id === selectedFactory.value)
    if (factory) {
        authStore.setFactory(factory)
    }
}

function changeLocale() {
    localStorage.setItem('locale', locale.value)
}

function refreshData() {
    window.location.reload()
}

async function logout() {
    await authStore.logout()
    router.push('/login')
}

function handleResize() {
    const width = window.innerWidth
    isMobile.value = width <= 768
    if (width > 768) {
        isExpanded.value = true
    }
}

onMounted(async () => {
    await authStore.fetchProfile()
    if (authStore.factory) {
        selectedFactory.value = authStore.factory.id
    } else if (authStore.factories.length > 0) {
        selectedFactory.value = authStore.factories[0].id
        authStore.setFactory(authStore.factories[0])
    }
    const width = window.innerWidth
    isMobile.value = width <= 768
    if (width > 768) {
        isExpanded.value = true
    } else {
        isExpanded.value = false
    }
    window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.app-layout {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
}

.main-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100vh;
}

.header {
    height: 48px;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-light);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    flex-shrink: 0;
    z-index: 1001;
}

.header-left, .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
}

.mobile-menu-btn {
    display: none;
}

.header-search input {
    padding: 6px 10px;
    font-size: 12px;
}

.user-menu {
    display: flex;
    align-items: center;
    gap: 8px;
}

.user-info {
    display: flex;
    flex-direction: column;
    text-align: right;
}

.user-name { font-size: 12px; font-weight: 500; }
.user-role { font-size: 10px; color: var(--text-muted); }

.main-content {
    flex: 1;
    overflow: auto;
    overflow-x: hidden;
    background: var(--bg-secondary);
    z-index: 1;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
}

.sidebar {
    width: 56px;
    background: var(--bg-primary);
    border-right: 1px solid var(--border-light);
    display: flex;
    flex-direction: column;
    transition: width 0.2s ease;
    position: relative;
    z-index: 100;
    overflow: visible;
    height: 100vh;
}

.sidebar.sidebar-expanded {
    width: 220px;
}

.sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border-light);
    height: 48px;
}

.logo {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
}

.logo-icon {
    width: 28px;
    height: 28px;
    background: var(--primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
}

.logo-text {
    display: none;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
}

.sidebar-toggle {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
    display: block;
    flex-shrink: 0;
}

.sidebar-toggle:hover {
    color: var(--primary);
}

.sidebar-nav {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    position: relative;
}

.sidebar-nav::-webkit-scrollbar {
    width: 4px;
}

.sidebar-nav::-webkit-scrollbar-track {
    background: transparent;
}

.sidebar-nav::-webkit-scrollbar-thumb {
    background: var(--border-medium);
    border-radius: 2px;
}

.nav-item, .nav-group-header {
    display: flex;
    align-items: center;
    padding: 8px 10px;
    color: var(--text-secondary);
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    transition: background 0.2s;
    touch-action: manipulation;
}

.nav-item:hover, .nav-group-header:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
}

.nav-item.active {
    background: var(--primary);
    color: white;
}

.nav-icon {
    width: 24px;
    text-align: center;
    font-size: 14px;
    flex-shrink: 0;
}

.nav-label {
    font-size: 12px;
    margin-left: 10px;
    flex: 1;
    display: none;
}

.nav-arrow {
    font-size: 8px;
    margin-left: auto;
    display: none;
}

.nav-group-items {
    display: none;
    flex-direction: column;
}

.sidebar.sidebar-expanded .logo-text {
    display: block;
}

.sidebar.sidebar-expanded .nav-label {
    display: block;
}

.sidebar.sidebar-expanded .nav-arrow {
    display: block;
}

.sidebar.sidebar-expanded .nav-group-items {
    display: flex;
    flex-direction: column;
    padding-left: 24px;
    background: transparent;
}

.nav-group-items .nav-item {
    padding: 8px 12px;
}

.sidebar.sidebar-expanded .sidebar-overlay {
    display: none;
}

@media (max-width: 768px) {
    .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        transform: translateX(-100%);
        transition: transform 0.3s ease;
        z-index: 1000;
        width: 280px !important;
    }

    .sidebar.sidebar-expanded {
        transform: translateX(0);
    }

    .sidebar.sidebar-expanded .logo-text {
        display: block;
    }

    .sidebar.sidebar-expanded .nav-label {
        display: block;
    }

    .mobile-menu-btn {
        display: block;
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        padding: 6px;
        touch-action: manipulation;
    }

    .sidebar-overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
        touch-action: manipulation;
    }

    .sidebar.sidebar-expanded .sidebar-overlay {
        display: block;
    }

    .sidebar-nav {
        position: absolute;
        top: 48px;
        left: 0;
        right: 0;
        bottom: 0;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        touch-action: manipulation;
    }

    .header-search, .user-info {
        display: none;
    }

    .nav-item, .nav-group-header {
        min-height: 44px;
        padding: 12px 10px;
        touch-action: manipulation;
    }

    .nav-item {
        touch-action: manipulation;
    }

    .nav-group-header {
        cursor: pointer;
        touch-action: manipulation;
    }
}
</style>