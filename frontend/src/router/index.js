import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const routes = [
    {
        path: '/',
        component: () => import('@/views/Landing.vue'),
        children: [
            {
                path: '',
                name: 'Landing',
                component: () => import('@/views/public/Home.vue')
            },
            {
                path: 'features',
                name: 'Features',
                component: () => import('@/views/public/Features.vue')
            },
            {
                path: 'pricing',
                name: 'Pricing',
                component: () => import('@/views/public/Pricing.vue')
            },
            {
                path: 'about',
                name: 'About',
                component: () => import('@/views/public/About.vue')
            },
            {
                path: 'contact',
                name: 'Contact',
                component: () => import('@/views/public/Contact.vue')
            }
        ]
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import('@/views/Login.vue')
    },
    {
        path: '/signup',
        name: 'Signup',
        component: () => import('@/views/Signup.vue')
    },
    {
        path: '/dashboard',
        component: () => import('@/views/Layout.vue'),
        meta: { requiresAuth: true },
        children: [
            {
                path: '',
                name: 'Dashboard',
                component: () => import('@/views/Dashboard.vue')
            },
            {
                path: 'factories',
                name: 'Factories',
                component: () => import('@/views/master/Factories.vue')
            },
            {
                path: 'godowns',
                name: 'Godowns',
                component: () => import('@/views/master/Godowns.vue')
            },
            {
                path: 'raw-materials',
                name: 'RawMaterials',
                component: () => import('@/views/master/RawMaterials.vue')
            },
            {
                path: 'products',
                name: 'Products',
                component: () => import('@/views/master/Products.vue')
            },
            {
                path: 'suppliers',
                name: 'Suppliers',
                component: () => import('@/views/master/Suppliers.vue')
            },
            {
                path: 'customers',
                name: 'Customers',
                component: () => import('@/views/master/Customers.vue')
            },
            {
                path: 'units',
                name: 'Units',
                component: () => import('@/views/master/Units.vue')
            },
            {
                path: 'price-lists',
                name: 'PriceLists',
                component: () => import('@/views/master/PriceLists.vue')
            },
            {
                path: 'discount-rules',
                name: 'DiscountRules',
                component: () => import('@/views/master/DiscountRules.vue')
            },
            {
                path: 'credit-notes',
                name: 'CreditNotes',
                component: () => import('@/views/master/CreditNotes.vue')
            },
            {
                path: 'currencies',
                name: 'Currencies',
                component: () => import('@/views/master/Currencies.vue')
            },
            {
                path: 'regions',
                name: 'Regions',
                component: () => import('@/views/master/Regions.vue')
            },
            {
                path: 'routes',
                name: 'Routes',
                component: () => import('@/views/master/Routes.vue')
            },
            {
                path: 'purchase-orders',
                name: 'PurchaseOrders',
                component: () => import('@/views/purchase/PurchaseOrders.vue')
            },
            {
                path: 'goods-inward',
                name: 'GoodsInward',
                component: () => import('@/views/purchase/GoodsInward.vue')
            },
            {
                path: 'stock',
                name: 'Stock',
                component: () => import('@/views/inventory/Stock.vue')
            },
            {
                path: 'stock-transfers',
                name: 'StockTransfers',
                component: () => import('@/views/inventory/Transfers.vue')
            },
            {
                path: 'stock-adjustments',
                name: 'StockAdjustments',
                component: () => import('@/views/inventory/Adjustments.vue')
            },
            {
                path: 'formulas',
                name: 'Formulas',
                component: () => import('@/views/production/Formulas.vue')
            },
            {
                path: 'batches',
                name: 'Batches',
                component: () => import('@/views/production/Batches.vue')
            },
            {
                path: 'machines',
                name: 'Machines',
                component: () => import('@/views/production/Machines.vue')
            },
            {
                path: 'job-cards',
                name: 'JobCards',
                component: () => import('@/views/production/JobCards.vue')
            },
            {
                path: 'qc-parameters',
                name: 'QCParameters',
                component: () => import('@/views/quality/Parameters.vue')
            },
            {
                path: 'qc-results',
                name: 'QCResults',
                component: () => import('@/views/quality/Results.vue')
            },
            {
                path: 'sales-orders',
                name: 'SalesOrders',
                component: () => import('@/views/sales/Orders.vue')
            },
            {
                path: 'invoices',
                name: 'Invoices',
                component: () => import('@/views/sales/Invoices.vue')
            },
            {
                path: 'sales-returns',
                name: 'SalesReturns',
                component: () => import('@/views/sales/Returns.vue')
            },
            {
                path: 'recurring-orders',
                name: 'RecurringOrders',
                component: () => import('@/views/sales/RecurringOrders.vue')
            },
            {
                path: 'accounts',
                name: 'Accounts',
                component: () => import('@/views/finance/Accounts.vue')
            },
            {
                path: 'transactions',
                name: 'Transactions',
                component: () => import('@/views/finance/Transactions.vue')
            },
            {
                path: 'payments',
                name: 'Payments',
                component: () => import('@/views/finance/Payments.vue')
            },
            {
                path: 'vehicles',
                name: 'Vehicles',
                component: () => import('@/views/transport/Vehicles.vue')
            },
            {
                path: 'drivers',
                name: 'Drivers',
                component: () => import('@/views/transport/Drivers.vue')
            },
            {
                path: 'deliveries',
                name: 'Deliveries',
                component: () => import('@/views/transport/Deliveries.vue')
            },
            {
                path: 'barcode',
                name: 'Barcode',
                component: () => import('@/views/barcode/Barcode.vue')
            },
            {
                path: 'iot',
                name: 'IoT',
                component: () => import('@/views/iot/IoT.vue')
            },
            {
                path: 'reports',
                name: 'Reports',
                component: () => import('@/views/reports/Reports.vue')
            },
            {
                path: 'users',
                name: 'Users',
                component: () => import('@/views/admin/Users.vue')
            },
            {
                path: 'roles',
                name: 'Roles',
                component: () => import('@/views/admin/Roles.vue')
            },
            {
                path: 'activity-log',
                name: 'ActivityLog',
                component: () => import('@/views/admin/ActivityLog.vue')
            },
            {
                path: 'settings',
                name: 'Settings',
                component: () => import('@/views/Settings.vue')
            },
            {
                path: 'approvals',
                name: 'Approvals',
                component: () => import('@/views/Approvals.vue')
            },
            {
                path: 'notifications',
                name: 'Notifications',
                component: () => import('@/views/Notifications.vue')
            },
            {
                path: 'documents',
                name: 'Documents',
                component: () => import('@/views/Documents.vue')
            }
        ]
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

router.beforeEach((to, from) => {
    const token = localStorage.getItem('token')
    const isAuthenticated = !!token

    if (to.meta.requiresAuth && !isAuthenticated) {
        return '/login'
    }
    
    if ((to.path === '/login' || to.path === '/signup') && isAuthenticated) {
        return '/dashboard'
    }
    
    if (to.path === '/' && isAuthenticated) {
        return '/dashboard'
    }
    
    return true
})

export default router
