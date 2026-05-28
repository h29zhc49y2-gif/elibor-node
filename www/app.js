console.log('=== app.js 开始执行 ===');

// 创建全局状态对象
window.eliborApp = {
    _initialized: false,
    token: null,
    email: '',
    verificationCode: '',
    showCodeInput: false,
    loading: false,
    countdown: 0, // 倒计时秒数
    currentLang: 'zh-CN', // 当前语言
    resendText: '重新发送', // 倒计时文本
    activeTab: 'souls',
    souls: [],
    buildings: [],
    
    init() {
        if (this._initialized) {
            console.log('eliborApp 已初始化，跳过');
            return;
        }
        this._initialized = true;
        
        console.log('eliborApp 初始化');
        this.checkAuth();
        
        // 监听语言变化，更新 currentLang 和 resendText
        if (typeof i18next !== 'undefined' && typeof t !== 'undefined') {
            i18next.on('languageChanged', (lng) => {
                this.currentLang = lng;
                this.resendText = t('login.resend_in');
            });
            
            // 初始设置
            this.currentLang = i18next.language || 'zh-CN';
            this.resendText = t('login.resend_in');
        } else {
            console.warn('i18next 或 t 函数未定义，使用默认值');
        }
    },
    
    // 语言切换方法
    switchLanguage(lng) {
        if (typeof window.switchLanguage === 'function') {
            window.switchLanguage(lng);
        } else {
            console.error('switchLanguage 函数未定义');
        }
    },
    
    // 一键登录（发送验证码 + 显示输入框）
    async handleLogin() {
        if (!this.email) {
            alert(t('login.please_enter_email') || '请输入邮箱');
            return;
        }
        
        this.loading = true;
        try {
            const response = await fetch('/api/auth/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: this.email })
            });
            
            const data = await response.json();
            
            if (data.code !== 0) {
                throw new Error(data.msg);
            }
            
            console.log('验证码已发送至:', this.email);
            this.showCodeInput = true;
            this.startCountdown(60);
            
            alert(t('login.verification_code_sent') || '验证码已发送');
        } catch (error) {
            console.error('发送验证码失败:', error);
            alert(t('login.send_code_failed') || '发送验证码失败: ' + error.message);
        } finally {
            this.loading = false;
        }
    },
    
    // 再次获取验证码
    async resendCode() {
        if (this.countdown > 0) return;
        
        this.loading = true;
        try {
            // TODO: 调用后端 API 重新发送验证码
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('验证码已重新发送至:', this.email);
            this.startCountdown(60);
            alert(t('login.verification_code_resent') || '验证码已重新发送');
        } catch (error) {
            console.error('重新发送验证码失败:', error);
            alert(t('login.resend_failed') || '重新发送失败');
        } finally {
            this.loading = false;
        }
    },
    
    // 开始倒计时
    startCountdown(seconds) {
        this.countdown = seconds;
        const timer = setInterval(() => {
            this.countdown--;
            if (this.countdown <= 0) {
                clearInterval(timer);
            }
        }, 1000);
    },
    
    // 确认登录（验证验证码）
    async confirmLogin() {
        if (!this.verificationCode) {
            alert(t('login.please_enter_code') || '请输入验证码');
            return;
        }
        
        this.loading = true;
        try {
            const response = await fetch('/api/auth/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: this.email,
                    code: this.verificationCode
                })
            });
            
            const data = await response.json();
            
            if (data.code !== 0) {
                throw new Error(data.msg);
            }
            
            this.token = data.data.token;
            localStorage.setItem('elibor_token', this.token);
            
            console.log('登录成功:', data.data);
        } catch (error) {
            console.error('登录失败:', error);
            alert(t('login.login_failed') || '登录失败: ' + error.message);
        } finally {
            this.loading = false;
        }
    },
    
    checkAuth() {
        try {
            this.token = localStorage.getItem('elibor_token');
            console.log('认证状态:', this.token ? '已登录' : '未登录');
        } catch (e) {
            console.warn('localStorage 访问失败:', e);
            this.token = null;
        }
    },
    
    getAvatarUrl(soul) {
        return '/assets/avatars/default.svg';
    }
};

console.log('app.js 加载完成');
