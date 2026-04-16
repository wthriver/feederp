import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

app.mount('#app')

document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
        document.body.classList.add('touch-device')
    }
})

document.addEventListener('pointerup', () => {
    document.body.classList.remove('touch-device')
})
