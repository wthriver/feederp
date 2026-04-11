import { ref, computed } from 'vue'

export function useFormValidation(rules) {
    const errors = ref({})
    const touched = ref({})

    function validate(field, value) {
        const rule = rules[field]
        if (!rule) return true

        if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
            errors.value[field] = rule.message || `${field} is required`
            return false
        }

        if (rule.minLength && value && value.length < rule.minLength) {
            errors.value[field] = rule.message || `${field} must be at least ${rule.minLength} characters`
            return false
        }

        if (rule.maxLength && value && value.length > rule.maxLength) {
            errors.value[field] = rule.message || `${field} must be at most ${rule.maxLength} characters`
            return false
        }

        if (rule.pattern && value && !rule.pattern.test(value)) {
            errors.value[field] = rule.message || `${field} format is invalid`
            return false
        }

        if (rule.email && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.value[field] = rule.message || 'Invalid email format'
            return false
        }

        if (rule.number && value && isNaN(Number(value))) {
            errors.value[field] = rule.message || 'Must be a number'
            return false
        }

        if (rule.min && Number(value) < rule.min) {
            errors.value[field] = rule.message || `Minimum value is ${rule.min}`
            return false
        }

        if (rule.max && Number(value) > rule.max) {
            errors.value[field] = rule.message || `Maximum value is ${rule.max}`
            return false
        }

        delete errors.value[field]
        return true
    }

    function validateAll(formData) {
        let isValid = true
        for (const field in rules) {
            if (!validate(field, formData[field])) {
                isValid = false
            }
        }
        return isValid
    }

    function touch(field) {
        touched.value[field] = true
    }

    function reset() {
        errors.value = {}
        touched.value = {}
    }

    function getError(field) {
        return touched.value[field] && errors.value[field] ? errors.value[field] : ''
    }

    function hasError(field) {
        return !!(touched.value[field] && errors.value[field])
    }

    const isValid = computed(() => Object.keys(errors.value).length === 0)

    return {
        errors,
        touched,
        validate,
        validateAll,
        touch,
        reset,
        getError,
        hasError,
        isValid
    }
}