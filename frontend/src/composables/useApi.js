import api from '@/api'
import { useToast } from './useToast'

export function useApi() {
    const { error: showError, success: showSuccess, warning: showWarning } = useToast()
    
    async function request(method, url, options = {}) {
        const { showToast = true, ...config } = options
        
        try {
            const response = await api[method](url, config)
            return response.data
        } catch (err) {
            const data = err.response?.data
            
            if (data?.success === false) {
                const errorCode = data.error?.code
                const errorMessage = data.error?.message
                
                if (showToast) {
                    switch (errorCode) {
                        case 'VALIDATION_ERROR':
                            showWarning(errorMessage)
                            break
                        case 'UNAUTHORIZED':
                        case 'TOKEN_EXPIRED':
                            showWarning('Session expired. Please login again.')
                            setTimeout(() => {
                                window.location.href = '/login'
                            }, 1500)
                            break
                        case 'FORBIDDEN':
                            showError(errorMessage || 'You do not have permission')
                            break
                        case 'NOT_FOUND':
                            showWarning(errorMessage || 'Resource not found')
                            break
                        default:
                            showError(errorMessage || 'An error occurred')
                    }
                }
                
                return { success: false, error: data.error, _handled: true }
            }
            
            console.error('API Error:', err)
            if (showToast) {
                showError('Network error. Please check your connection.')
            }
            return { success: false, error: { message: 'Network error' }, _handled: true }
        }
    }
    
    function get(url, options) {
        return request('get', url, options)
    }
    
    function post(url, data, options) {
        return request('post', url, { ...options, data })
    }
    
    function put(url, data, options) {
        return request('put', url, { ...options, data })
    }
    
    function del(url, options) {
        return request('delete', url, options)
    }
    
    async function paginated(url, params = {}) {
        const { page = 1, limit = 50, ...filters } = params
        
        const response = await get(url, { 
            params: { page, limit, ...filters },
            showToast: false 
        })
        
        if (response.success) {
            return response.data
        }
        
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 } }
    }
    
    async function list(url, params = {}) {
        const response = await get(url, { params, showToast: false })
        
        if (response.success) {
            return response.data
        }
        
        return []
    }
    
    async function byId(url, showNotFound = true) {
        const response = await get(url, { showToast: showNotFound })
        
        if (response.success) {
            return response.data
        }
        
        return null
    }
    
    async function create(url, data, successMsg = 'Created successfully') {
        const response = await post(url, data)
        
        if (response.success && successMsg) {
            showSuccess(successMsg)
        }
        
        return response
    }
    
    async function update(url, data, successMsg = 'Updated successfully') {
        const response = await put(url, data)
        
        if (response.success && successMsg) {
            showSuccess(successMsg)
        }
        
        return response
    }
    
    async function remove(url, successMsg = 'Deleted successfully') {
        const response = await del(url)
        
        if (response.success && successMsg) {
            showSuccess(successMsg)
        }
        
        return response
    }
    
    return {
        request,
        get,
        post,
        put,
        del,
        paginated,
        list,
        byId,
        create,
        update,
        remove
    }
}

export function useFormSubmit(apiFunc) {
    const isSubmitting = ref(false)
    const isValid = ref(true)
    
    async function submit(data, ...args) {
        isSubmitting.value = true
        
        try {
            const result = await apiFunc(data, ...args)
            return result
        } finally {
            isSubmitting.value = false
        }
    }
    
    return {
        isSubmitting,
        isValid,
        submit
    }
}