import axios from 'axios'
import { useAuthStore } from '@/store/auth'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
})

let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error)
        } else {
            prom.resolve(token)
        }
    })
    failedQueue = []
}

api.interceptors.request.use(
    config => {
        const token = localStorage.getItem('token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    error => {
        return Promise.reject(error)
    }
)

api.interceptors.response.use(
    response => {
        return response
    },
    async error => {
        const originalRequest = error.config
        const errorCode = error.response?.data?.error?.code

        if (error.response?.status === 401) {
            if (errorCode === 'TOKEN_EXPIRED' || errorCode === 'TOKEN_REVOKED' || errorCode === 'TOKEN_VERSION_INVALID') {
                if (!originalRequest._retry) {
                    originalRequest._retry = true

                    if (!isRefreshing) {
                        isRefreshing = true
                        const authStore = useAuthStore()

                        try {
                            const refreshed = await authStore.refreshAccessToken()
                            if (refreshed) {
                                const newToken = localStorage.getItem('token')
                                originalRequest.headers.Authorization = `Bearer ${newToken}`
                                processQueue(null, newToken)
                                return api(originalRequest)
                            }
                        } catch (refreshError) {
                            processQueue(refreshError, null)
                        } finally {
                            isRefreshing = false
                        }
                    }

                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject })
                    })
                    .then(token => {
                        originalRequest.headers.Authorization = `Bearer ${token}`
                        return api(originalRequest)
                    })
                    .catch(err => {
                        const authStore = useAuthStore()
                        authStore.logout()
                        window.location.href = '/login'
                        return Promise.reject(err)
                    })
                }
            }

            if (errorCode === 'UNAUTHORIZED' || errorCode === 'INVALID_TOKEN') {
                const authStore = useAuthStore()
                authStore.logout()
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export default api
