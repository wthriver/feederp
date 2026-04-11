import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api'
import { initSocket, disconnectSocket } from '@/services/socket'

export const useAuthStore = defineStore('auth', () => {
    const token = ref(localStorage.getItem('token') || null)
    const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
    const permissions = ref(JSON.parse(localStorage.getItem('permissions') || '{}'))
    const factories = ref([])
    const currentFactory = ref(JSON.parse(localStorage.getItem('factory') || 'null'))

    const isAuthenticated = computed(() => !!token.value)

    async function login(credentials) {
        try {
            const response = await api.post('/auth/login', credentials)
            if (response.data.success) {
                token.value = response.data.data.accessToken
                user.value = response.data.data.user
                permissions.value = response.data.data.permissions
                factories.value = response.data.data.factories || []
                currentFactory.value = factories.value[0] || null

                localStorage.setItem('token', token.value)
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
        user.value = null
        permissions.value = {}
        factories.value = []
        currentFactory.value = null

        localStorage.removeItem('token')
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
        user,
        permissions,
        factories,
        currentFactory,
        isAuthenticated,
        login,
        logout,
        fetchProfile,
        setFactory,
        hasPermission,
        hasModuleAccess
    }
})
