<template>
    <div class="login-page">
        <div class="login-container">
            <div class="login-header">
                <h1>{{ $t('app.name') }}</h1>
                <p>{{ $t('app.tagline') }}</p>
            </div>

            <form @submit.prevent="handleLogin" class="login-form">
                <div class="form-group">
                    <label class="form-label">{{ $t('auth.username') }}</label>
                    <input
                        v-model="form.username"
                        type="text"
                        class="input-field"
                        :class="{ 'input-error': errors.username }"
                        autocomplete="username"
                        required
                    />
                    <span v-if="errors.username" class="form-error">{{ errors.username }}</span>
                </div>

                <div class="form-group">
                    <label class="form-label">{{ $t('auth.password') }}</label>
                    <input
                        v-model="form.password"
                        type="password"
                        class="input-field"
                        :class="{ 'input-error': errors.password }"
                        autocomplete="current-password"
                        required
                    />
                    <span v-if="errors.password" class="form-error">{{ errors.password }}</span>
                </div>

                <div v-if="errorMessage" class="error-message">
                    {{ errorMessage }}
                </div>

                <button type="submit" class="btn btn-primary btn-lg" :disabled="loading">
                    <span v-if="loading" class="spinner-small"></span>
                    <span v-else>{{ $t('auth.login') }}</span>
                </button>
            </form>

            <div class="login-footer">
                <p>Default credentials: admin / admin123</p>
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
import { useAuthStore } from '@/store/auth'

const router = useRouter()
const { locale } = useI18n()
const authStore = useAuthStore()

const form = reactive({
    username: '',
    password: ''
})

const errors = reactive({})
const errorMessage = ref('')
const loading = ref(false)

function changeLocale() {
    localStorage.setItem('locale', locale.value)
}

async function handleLogin() {
    errors.username = ''
    errors.password = ''
    errorMessage.value = ''
    loading.value = true

    try {
        if (!form.username) {
            errors.username = 'Username is required'
            return
        }
        if (!form.password) {
            errors.password = 'Password is required'
            return
        }

        await authStore.login(form)
        router.push('/')
    } catch (error) {
        if (error.response?.data?.error?.message) {
            errorMessage.value = error.response.data.error.message
        } else {
            errorMessage.value = 'Login failed. Please try again.'
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
    max-width: 400px;
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
    font-size: var(--font-size-xs);
    color: var(--text-muted);
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
