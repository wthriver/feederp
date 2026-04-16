<template>
    <div class="login-page">
        <div class="login-container">
            <div class="login-header">
                <h1>{{ $t('app.name') }}</h1>
                <p>Create your account</p>
            </div>

            <form @submit.prevent="handleSignup" class="login-form">
                <div class="form-group">
                    <label class="form-label">Company Name</label>
                    <input
                        v-model="form.companyName"
                        type="text"
                        class="input-field"
                        :class="{ 'input-error': errors.companyName }"
                        placeholder="Enter company name"
                        required
                    />
                    <span v-if="errors.companyName" class="form-error">{{ errors.companyName }}</span>
                </div>

                <div class="form-group">
                    <label class="form-label">{{ $t('auth.username') }}</label>
                    <input
                        v-model="form.userName"
                        type="text"
                        class="input-field"
                        :class="{ 'input-error': errors.userName }"
                        placeholder="Choose a username"
                        required
                    />
                    <span v-if="errors.userName" class="form-error">{{ errors.userName }}</span>
                </div>

                <div class="form-group">
                    <label class="form-label">{{ $t('common.email') }}</label>
                    <input
                        v-model="form.email"
                        type="email"
                        class="input-field"
                        :class="{ 'input-error': errors.email }"
                        placeholder="Enter email address"
                        required
                    />
                    <span v-if="errors.email" class="form-error">{{ errors.email }}</span>
                </div>

                <div class="form-group">
                    <label class="form-label">{{ $t('common.mobile') }}</label>
                    <input
                        v-model="form.phone"
                        type="tel"
                        class="input-field"
                        placeholder="Enter phone number (optional)"
                    />
                </div>

                <div class="form-group">
                    <label class="form-label">{{ $t('auth.password') }}</label>
                    <div class="password-input-wrapper">
                        <input
                            v-model="form.password"
                            :type="showPassword ? 'text' : 'password'"
                            class="input-field"
                            :class="{ 'input-error': errors.password }"
                            placeholder="Create a password"
                            required
                        />
                        <button type="button" class="password-toggle" @click="showPassword = !showPassword">
                            {{ showPassword ? '🙈' : '👁️' }}
                        </button>
                    </div>
                    <span v-if="errors.password" class="form-error">{{ errors.password }}</span>
                    <small class="password-hint">Min 8 chars with uppercase, lowercase, number & special char</small>
                </div>

                <div class="form-group">
                    <label class="form-label">Plan</label>
                    <select v-model="form.plan" class="input-field">
                        <option value="starter">Starter (5 users, 2 factories)</option>
                        <option value="professional">Professional (20 users, 5 factories)</option>
                        <option value="enterprise">Enterprise (Unlimited)</option>
                    </select>
                </div>

                <div v-if="errorMessage" class="error-message">
                    {{ errorMessage }}
                </div>

                <button type="submit" class="btn btn-primary btn-lg" :disabled="loading">
                    <span v-if="loading" class="spinner-small"></span>
                    <span v-else>Create Account</span>
                </button>
            </form>

            <div class="login-footer">
                <p>Already have an account? <router-link to="/login">Sign in</router-link></p>
            </div>
        </div>

        <div class="login-lang">
            <select v-model="locale" @change="changeLocale" class="select-field">
                <option value="en">English</option>
                <option value="bn">বাংলা</option>
            </select>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import api from '@/api'

const router = useRouter()
const { locale } = useI18n()

const form = reactive({
    companyName: '',
    userName: '',
    email: '',
    phone: '',
    password: '',
    plan: 'starter'
})

const errors = reactive({})
const errorMessage = ref('')
const loading = ref(false)
const showPassword = ref(false)

function changeLocale() {
    localStorage.setItem('locale', locale.value)
}

function validatePassword(password) {
    if (password.length < 8) {
        return 'Password must be at least 8 characters'
    }
    if (!/[A-Z]/.test(password)) {
        return 'Password must contain at least one uppercase letter'
    }
    if (!/[a-z]/.test(password)) {
        return 'Password must contain at least one lowercase letter'
    }
    if (!/[0-9]/.test(password)) {
        return 'Password must contain at least one number'
    }
    if (!/[!@#$%^&*]/.test(password)) {
        return 'Password must contain at least one special character (!@#$%^&*)'
    }
    return null
}

async function handleSignup() {
    errors.companyName = ''
    errors.userName = ''
    errors.email = ''
    errors.password = ''
    errorMessage.value = ''

    if (!form.companyName) {
        errors.companyName = 'Company name is required'
        return
    }
    if (!form.userName) {
        errors.userName = 'Username is required'
        return
    }
    if (!form.email) {
        errors.email = 'Email is required'
        return
    }
    if (!form.password) {
        errors.password = 'Password is required'
        return
    }

    const passwordError = validatePassword(form.password)
    if (passwordError) {
        errors.password = passwordError
        return
    }

    loading.value = true

    try {
        const response = await api.post('/auth/signup', {
            companyName: form.companyName,
            userName: form.userName,
            email: form.email,
            phone: form.phone,
            password: form.password,
            plan: form.plan
        })

        if (response.data.success) {
            const { accessToken, refreshToken, user, tenant } = response.data.data
            
            localStorage.setItem('token', accessToken)
            localStorage.setItem('refreshToken', refreshToken)
            localStorage.setItem('user', JSON.stringify(user))
            localStorage.setItem('tenant', JSON.stringify(tenant))
            
            api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
            
            router.push('/dashboard')
        }
    } catch (error) {
        const errorData = error.response?.data?.error
        if (errorData?.message) {
            errorMessage.value = errorData.message
        } else if (errorData?.code === 'VALIDATION_ERROR') {
            if (errorData.fields) {
                Object.keys(errorData.fields).forEach(field => {
                    errors[field] = errorData.fields[field]
                })
            }
        } else {
            errorMessage.value = 'Signup failed. Please try again.'
        }
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    padding: 20px;
}

.login-container {
    width: 100%;
    max-width: 450px;
    background: var(--bg-primary);
    padding: 40px;
    border: 1px solid var(--border-medium);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.login-header {
    text-align: center;
    margin-bottom: 32px;
}

.login-header h1 {
    font-size: 24px;
    color: var(--primary);
    margin-bottom: 8px;
}

.login-header p {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
}

.login-form .form-group {
    margin-bottom: 20px;
}

.login-form .input-field {
    width: 100%;
}

.password-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.password-input-wrapper .input-field {
    padding-right: 40px;
}

.password-toggle {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
}

.password-hint {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
}

.form-error {
    color: var(--danger);
    font-size: var(--font-size-xs);
    display: block;
    margin-top: 4px;
}

.error-message {
    padding: 12px;
    background: var(--danger-bg);
    color: var(--danger);
    border: 1px solid var(--danger);
    margin-bottom: 16px;
    font-size: var(--font-size-sm);
}

.login-form .btn {
    width: 100%;
}

.login-footer {
    margin-top: 24px;
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--text-muted);
}

.login-footer a {
    color: var(--primary);
    text-decoration: none;
    font-weight: 500;
}

.login-footer a:hover {
    text-decoration: underline;
}

.login-lang {
    position: fixed;
    top: 20px;
    right: 20px;
}

.login-lang .select-field {
    background: rgba(255, 255, 255, 0.9);
    border: none;
}

.spinner-small {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
    .login-container {
        padding: 24px;
    }
}
</style>
