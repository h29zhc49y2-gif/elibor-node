function appData() {
    return {
        isLoggedIn: false,
        currentTab: 'login',
        currentView: 'souls',
        message: '',
        messageType: '',
        token: localStorage.getItem('elibor_token'),
        userData: {},
        souls: [],
        selectedSoul: null,
        selectedSoulForResources: null,
        currentResources: {},
        facilityTypes: [],
        monuments: [],
        planetStats: {
            industry: 25,
            agriculture: 20,
            housing: 15,
            technology: 10,
            energy: 30,
            overall: 20
        },
        events: [],
        interventions: [],
        availableInterventions: [],
        showSoulDetail: false,
        showCreateSoulModal: false,
        showPlansModal: false,
        newSoulName: '',
        loginData: { email: '', password: '' },
        registerData: { username: '', email: '', password: '' },
        subscriptionPlans: [
            {
                id: 'pro_monthly',
                name: 'Pro 月度',
                price: '30',
                interval: '月',
                popular: false,
                features: ['3个栖人', '5次干预/天', '50信用点/天', '优先队列', '高级洞察']
            },
            {
                id: 'pro_yearly',
                name: 'Pro 年度',
                price: '300',
                interval: '年',
                popular: true,
                features: ['3个栖人', '5次干预/天', '50信用点/天', '优先队列', '高级洞察', '节省200元']
            },
            {
                id: 'max_monthly',
                name: 'MAX 月度',
                price: '68',
                interval: '月',
                popular: false,
                features: ['5个栖人', '无限干预', '200信用点/天', '全部高级功能', '数据分析']
            },
            {
                id: 'max_yearly',
                name: 'MAX 年度',
                price: '680',
                interval: '年',
                popular: false,
                features: ['5个栖人', '无限干预', '200信用点/天', '全部高级功能', '数据分析', '节省136元']
            }
        ],

        init() {
            if (this.token) {
                this.fetchUserData();
            }
        },

        async fetchUserData() {
            try {
                const response = await fetch('/api/users/me', {
                    headers: { 'Authorization': 'Bearer ' + this.token }
                });
                const data = await response.json();
                if (data.code === 200) {
                    this.userData = data.data;
                    this.souls = data.data.souls || [];
                    this.isLoggedIn = true;
                    this.fetchPlanetStats();
                    this.fetchEvents();
                    this.fetchFacilityTypes();
                    this.fetchInterventions();
                    if (this.souls.length > 0) {
                        this.selectedSoulForResources = this.souls[0].id;
                        this.fetchResources(this.souls[0].id);
                    }
                } else {
                    this.logout();
                }
            } catch (error) {
                this.logout();
            }
        },

        async fetchPlanetStats() {
            try {
                const response = await fetch('/api/planet/stats', {
                    headers: { 'Authorization': 'Bearer ' + this.token }
                });
                const data = await response.json();
                if (data.code === 200) {
                    this.planetStats = data.data;
                }
            } catch (error) {
                console.error('Failed to fetch planet stats');
            }
        },

        async fetchEvents() {
            try {
                const response = await fetch('/api/events', {
                    headers: { 'Authorization': 'Bearer ' + this.token }
                });
                const data = await response.json();
                if (data.code === 200) {
                    this.events = data.data;
                }
            } catch (error) {
                console.error('Failed to fetch events');
            }
        },

        async fetchFacilityTypes() {
            try {
                const response = await fetch('/api/facilities/types', {
                    headers: { 'Authorization': 'Bearer ' + this.token }
                });
                const data = await response.json();
                if (data.code === 200) {
                    this.facilityTypes = data.data;
                    setTimeout(() => lucide.createIcons(), 100);
                }
            } catch (error) {
                console.error('Failed to fetch facility types');
            }
        },

        async fetchResources(soulId) {
            try {
                const response = await fetch(`/api/resources/${soulId}`, {
                    headers: { 'Authorization': 'Bearer ' + this.token }
                });
                const data = await response.json();
                if (data.code === 200) {
                    this.currentResources = data.data.resources || {};
                }
            } catch (error) {
                console.error('Failed to fetch resources');
            }
        },

        async fetchInterventions() {
            try {
                const response = await fetch(`/api/interventions/${this.souls[0]?.id}/available`, {
                    headers: { 'Authorization': 'Bearer ' + this.token }
                });
                const data = await response.json();
                if (data.code === 200) {
                    this.availableInterventions = data.data;
                }
            } catch (error) {
                console.error('Failed to fetch interventions');
            }
        },

        async fetchMonuments() {
            try {
                const response = await fetch('/api/monuments', {
                    headers: { 'Authorization': 'Bearer ' + this.token }
                });
                const data = await response.json();
                if (data.code === 200) {
                    this.monuments = data.data;
                }
            } catch (error) {
                console.error('Failed to fetch monuments');
            }
        },

        async login() {
            try {
                const response = await fetch('/api/users/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.loginData)
                });
                const data = await response.json();
                if (data.code === 200) {
                    this.token = data.data.token;
                    localStorage.setItem('elibor_token', this.token);
                    await this.fetchUserData();
                    this.showToast('登录成功', 'success');
                } else {
                    this.showToast(data.message, 'error');
                }
            } catch (error) {
                this.showToast('登录失败', 'error');
            }
        },

        async register() {
            try {
                const response = await fetch('/api/users/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.registerData)
                });
                const data = await response.json();
                if (data.code === 200) {
                    this.token = data.data.token;
                    localStorage.setItem('elibor_token', this.token);
                    await this.fetchUserData();
                    this.showToast('注册成功', 'success');
                } else {
                    this.showToast(data.message, 'error');
                }
            } catch (error) {
                this.showToast('注册失败', 'error');
            }
        },

        logout() {
            localStorage.removeItem('elibor_token');
            this.token = null;
            this.isLoggedIn = false;
            this.userData = {};
            this.souls = [];
            this.currentView = 'souls';
        },

        showToast(msg, type) {
            this.message = msg;
            this.messageType = type;
            setTimeout(() => {
                this.message = '';
                this.messageType = '';
            }, 3000);
        },

        async createSoul() {
            if (!this.newSoulName.trim()) return;
            
            try {
                const response = await fetch('/api/souls', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + this.token
                    },
                    body: JSON.stringify({ name: this.newSoulName })
                });
                const data = await response.json();
                if (data.code === 200) {
                    this.souls.push(data.data);
                    this.showCreateSoulModal = false;
                    this.newSoulName = '';
                    this.showToast('栖人创造成功', 'success');
                    setTimeout(() => lucide.createIcons(), 100);
                } else {
                    this.showToast(data.message, 'error');
                }
            } catch (error) {
                this.showToast('创造失败', 'error');
            }
        },

        openSoulDetail(soul) {
            this.selectedSoul = soul;
            this.showSoulDetail = true;
            this.fetchSoulInterventions(soul.id);
            setTimeout(() => lucide.createIcons(), 100);
        },

        async fetchSoulInterventions(soulId) {
            try {
                const response = await fetch(`/api/interventions/${soulId}/available`, {
                    headers: { 'Authorization': 'Bearer ' + this.token }
                });
                const data = await response.json();
                if (data.code === 200) {
                    this.availableInterventions = data.data;
                    setTimeout(() => lucide.createIcons(), 100);
                }
            } catch (error) {
                console.error('Failed to fetch interventions');
            }
        },

        async performIntervention(actionId) {
            if (!this.selectedSoul || this.userData.current_interventions <= 0) return;
            
            try {
                const response = await fetch(`/api/interventions/${this.selectedSoul.id}/perform`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + this.token
                    },
                    body: JSON.stringify({ action: actionId })
                });
                const data = await response.json();
                if (data.code === 200) {
                    this.userData.current_interventions--;
                    this.showToast('干预成功', 'success');
                    await this.fetchUserData();
                } else {
                    this.showToast(data.message, 'error');
                }
            } catch (error) {
                this.showToast('干预失败', 'error');
            }
        },

        async buildFacility(type) {
            try {
                const soulId = this.souls[0]?.id;
                const response = await fetch(`/api/facilities/${soulId}/create`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + this.token
                    },
                    body: JSON.stringify({ type })
                });
                const data = await response.json();
                if (data.code === 200) {
                    this.showToast('建造成功', 'success');
                } else {
                    this.showToast(data.message, 'error');
                }
            } catch (error) {
                this.showToast('建造失败', 'error');
            }
        },

        async subscribePlan(planId) {
            try {
                const response = await fetch('/api/payments/order', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + this.token
                    },
                    body: JSON.stringify({ plan_id: planId })
                });
                const data = await response.json();
                if (data.code === 200 && data.data.url) {
                    window.location.href = data.data.url;
                } else {
                    this.showToast('订阅创建失败', 'error');
                }
            } catch (error) {
                this.showToast('订阅创建失败', 'error');
            }
        },

        getPlanName(plan) {
            const names = {
                'free': '免费版',
                'pro_monthly': 'Pro月度',
                'pro_yearly': 'Pro年度',
                'max_monthly': 'MAX月度',
                'max_yearly': 'MAX年度'
            };
            return names[plan] || '免费版';
        },

        getStageName(stage) {
            const stages = {
                'child': '儿童',
                'youth': '青年',
                'adult': '成年',
                'elder': '老年',
                'senior': '暮年'
            };
            return stages[stage] || stage;
        },

        getSoulStageClass(soul) {
            return soul.stage || 'child';
        },

        getProfessionName(profession) {
            const names = {
                'miner': '矿工',
                'farmer': '农民',
                'engineer': '工程师',
                'scientist': '科学家',
                'builder': '建筑工',
                'energy_engineer': '能源工程师',
                'teacher': '教师',
                'doctor': '医生'
            };
            return names[profession] || profession;
        },

        getActionIcon(action) {
            const icons = {
                'idle': 'circle-dot',
                'working': 'hammer',
                'resting': 'moon',
                'socializing': 'users',
                'learning': 'book-open',
                'eating': 'utensils',
                'walking': 'footprints',
                'dead': 'skull'
            };
            return icons[action] || 'circle-dot';
        },

        getActionName(action) {
            const names = {
                'idle': '空闲中',
                'working': '工作中',
                'resting': '休息中',
                'socializing': '社交中',
                'learning': '学习中',
                'eating': '进食中',
                'walking': '移动中',
                'dead': '已故'
            };
            return names[action] || '未知';
        },

        getResourceIcon(type) {
            const icons = {
                'minerals': 'gem',
                'food': 'wheat',
                'energy': 'zap',
                'materials': 'hammer',
                'research': 'flask'
            };
            return icons[type] || 'box';
        },

        getResourceName(type) {
            const names = {
                'minerals': '矿石',
                'food': '食物',
                'energy': '能源',
                'materials': '材料',
                'research': '研究点'
            };
            return names[type] || type;
        },

        getFacilityIcon(type) {
            const icons = {
                'mine': 'pickaxe',
                'farm': 'leaf',
                'power_plant': 'zap',
                'workshop': 'hammer',
                'lab': 'flask-conical',
                'hospital': 'heart-pulse',
                'school': 'book-open',
                'residence': 'home'
            };
            return icons[type] || 'building';
        }
    };
}

document.addEventListener('alpine:init', () => {
    Alpine.data('appData', appData);
});