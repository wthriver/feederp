import { useToast } from './useToast'

export function useErrorHandler() {
    const toast = useToast()

    function handleApiError(error, fallbackMessage = 'An error occurred') {
        console.error('API Error:', error)

        if (!error.response) {
            toast.error('Network error. Please check your connection.')
            return
        }

        const { status, data } = error.response
        const errorInfo = data?.error || {}

        switch (status) {
            case 400:
                if (errorInfo.fields) {
                    const fieldErrors = Object.values(errorInfo.fields).join(', ')
                    toast.error(fieldErrors || 'Invalid input')
                } else if (errorInfo.details) {
                    toast.error(errorInfo.details[0]?.message || 'Invalid request')
                } else {
                    toast.error(errorInfo.message || 'Invalid request')
                }
                break

            case 401:
                toast.error('Session expired. Please login again.')
                localStorage.clear()
                window.location.href = '/login'
                break

            case 403:
                toast.error(errorInfo.message || 'You do not have permission to perform this action')
                break

            case 404:
                toast.error(errorInfo.message || 'Resource not found')
                break

            case 422:
                if (errorInfo.details) {
                    const messages = errorInfo.details.map(d => d.message).join(', ')
                    toast.error(messages)
                } else {
                    toast.error(errorInfo.message || 'Validation failed')
                }
                break

            case 429:
                toast.warning(errorInfo.message || 'Too many requests. Please wait and try again.')
                break

            case 500:
                toast.error('Server error. Please try again later.')
                break

            default:
                toast.error(errorInfo.message || fallbackMessage)
        }

        return errorInfo
    }

    function formatErrorMessage(error) {
        if (!error.response) {
            return 'Network error. Please check your connection.'
        }

        const errorInfo = error.response?.data?.error || {}
        return errorInfo.message || errorInfo.code || 'An error occurred'
    }

    return {
        handleApiError,
        formatErrorMessage
    }
}
