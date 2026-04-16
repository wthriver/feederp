import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api'
import { initSocket, disconnectSocket } from '@/services/socket'

const REFRESH_TOKEN_KEY = 'refreshToken'
const TOKEN_EXPIRY_KEY = 'tokenExpiry'

export const useAuthStore = defineStore('auth', () => {
    const token = ref(localStorage.getItem('token') || null)
    const refreshToken = ref(localStorage.getItem(REFRESH_TOKEN_KEY) || null)
    const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
    const permissions = ref(JSON.parse(localStorage.getItem('permissions') || '{}'))
    const factories = ref([])
    const currentFactory = ref(JSON.parse(localStorage.getItem('factory') || 'null'))
    const modalOpen = ref(false)

    function setModalOpen(open) {
        modalOpen.value = open
        document.body.classList.toggle('modal-open', open)
    }

    const isAuthenticated = computed(() => !!token.value)

    function isTokenExpiringSoon() {
        const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
        if (!expiry) return false
        const expiryTime = parseInt(expiry)
        const now = Date.now()
        return expiryTime - now < 5 * 60 * 1000
    }

    async function refreshAccessToken() {
        if (!refreshToken.value) {
            return false
        }
        try {
            const response = await api.post('/auth/refresh', { refreshToken: refreshToken.value })
            if (response.data.success) {
                const { accessToken, refreshToken: newRefreshToken } = response.data.data
                token.value = accessToken
                refreshToken.value = newRefreshToken
                localStorage.setItem('token', accessToken)
                localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken)
                api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
                return true
            }
        } catch (error) {
            console.error('Token refresh failed:', error)
        }
        return false
    }

    async function login(credentials) {
        try {
            const response = await api.post('/auth/login', credentials)
            if (response.data.success) {
                token.value = response.data.data.accessToken
                refreshToken.value = response.data.data.refreshToken
                user.value = response.data.data.user
                permissions.value = response.data.data.permissions
                factories.value = response.data.data.factories || []
                currentFactory.value = factories.value[0] || null

                const expiresIn = response.data.data.expiresIn || 1800
                const expiryTime = Date.now() + (expiresIn * 1000)

                localStorage.setItem('token', token.value)
                localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken.value)
                localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())
                localStorage.setItem('user', JSON.stringify(user.value))
                localStorage.setItem('permissions', JSON.stringify(permissions.value))
                localStorage.setItem('factory', JSON.stringify(currentFactory.value))

                api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`

                initSocket()

                return response.data
            }
        } catch (error) {
            throw error
        }
    }

    async function logout() {
        try {
            await api.post('/auth/logout')
        } catch (e) {
            // Ignore logout errors
        }

        disconnectSocket()

        token.value = null
        refreshToken.value = null
        user.value = null
        permissions.value = {}
        factories.value = []
        currentFactory.value = null

        localStorage.removeItem('token')
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        localStorage.removeItem(TOKEN_EXPIRY_KEY)
        localStorage.removeItem('user')
        localStorage.removeItem('permissions')
        localStorage.removeItem('factory')
        localStorage.removeItem('factoryId')

        delete api.defaults.headers.common['Authorization']
    }

    async function fetchProfile() {
        try {
            const response = await api.get('/auth/me')
            if (response.data.success) {
                user.value = response.data.data.user
                permissions.value = response.data.data.permissions
                factories.value = response.data.data.factories || []
                currentFactory.value = factories.value.find(f => f.id === user.value.factoryId) || factories.value[0]

                localStorage.setItem('user', JSON.stringify(user.value))
                localStorage.setItem('permissions', JSON.stringify(permissions.value))
                localStorage.setItem('factory', JSON.stringify(currentFactory.value))
                if (currentFactory.value) {
                    localStorage.setItem('factoryId', currentFactory.value.id)
                }

                initSocket()

                return response.data
            }
        } catch (error) {
            throw error
        }
    }

    function setFactory(factory) {
        currentFactory.value = factory
        localStorage.setItem('factory', JSON.stringify(factory))
        localStorage.setItem('factoryId', factory?.id)
    }

    function hasPermission(module, permission) {
        if (!permissions.value[module]) return false
        return permissions.value[module].includes(permission)
    }

    function hasModuleAccess(module) {
        return !!permissions.value[module]?.length
    }

    if (token.value) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
        initSocket()
    }

    return {
        token,
        refreshToken,
        user,
        permissions,
        factories,
        currentFactory,
        isAuthenticated,
        isTokenExpiringSoon,
        refreshAccessToken,
        login,
        logout,
        fetchProfile,
        setFactory,
        hasPermission,
        hasModuleAccess
    }
})
