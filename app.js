// app.js - 完整优化版
// 功能：SSD模型 + 特征缓存 + 批量计算 + 点头检测 + 超精致画点 + 多姿势录入 + 三语支持

// ==================== 全局状态管理 ====================
const AppState = {
    _data: {
        modelsLoaded: false,
        currentUser: null,
        allUsers: [],
        selectedUserId: null,
        stream: null,
        autoCloseTimer: null,
        isCameraActive: false,
        faceapiLoaded: false,
        animationFrameId: null,
        detectionIntervalId: null,
        floatingHint: null,
        cachedUsers: null,
        cacheTime: null,
        isRegistering: false,
        registerSamples: []
    },
    
    get(key) { return this._data[key]; },
    set(key, value) { 
        this._data[key] = value;
        window[key] = value;
        return value;
    },
    
    update(updates) {
        Object.assign(this._data, updates);
        Object.assign(window, updates);
    },
    
    cleanup() {
        if (this._data.animationFrameId) {
            cancelAnimationFrame(this._data.animationFrameId);
            this._data.animationFrameId = null;
        }
        if (this._data.autoCloseTimer) {
            clearTimeout(this._data.autoCloseTimer);
            this._data.autoCloseTimer = null;
        }
        if (this._data.detectionIntervalId) {
            clearInterval(this._data.detectionIntervalId);
            this._data.detectionIntervalId = null;
        }
        if (this._data.floatingHint && this._data.floatingHint.parentNode) {
            this._data.floatingHint.parentNode.removeChild(this._data.floatingHint);
            this._data.floatingHint = null;
        }
    }
};

// 缓存配置
const CACHE_DURATION = 60000; // 1分钟缓存

// 识别配置
const RECOGNITION_CONFIG = {
    ABSOLUTE_THRESHOLD: 0.48,
    ABSOLUTE_REJECT_THRESHOLD: 0.55,
    MIN_MARGIN: 0.08,
    MAX_RATIO: 0.85,
    MIN_FEATURES_COUNT: 2,
    MAX_RETRIES: 2,
    BEARD_THRESHOLD: 0.55  // 胡子员工宽松阈值
};

// 录入配置
const REGISTER_SAMPLE_COUNT = 6;  // 6个不同姿势
const REGISTER_SAMPLE_INTERVAL = 500;
const DETECTION_THROTTLE_MS = 100;
const MODEL_LOAD_RETRIES = 2;

// 多姿势引导配置
const REGISTER_POSES = [
    { text: 'pose_face_front', emoji: '😀', delay: 500 },
    { text: 'pose_look_up', emoji: '🙂', delay: 500 },
    { text: 'pose_look_down', emoji: '🙃', delay: 500 },
    { text: 'pose_look_left', emoji: '😐', delay: 500 },
    { text: 'pose_look_right', emoji: '😊', delay: 500 },
    { text: 'pose_smile', emoji: '😁', delay: 500 }
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function checkFaceApi() {
    return typeof faceapi !== 'undefined' && faceapi !== null;
}

// ==================== 向量计算函数 ====================
function normalize(vec) {
    if (!vec || vec.length === 0) return vec;
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vec;
    return vec.map(v => v / norm);
}

function averageFeatures(featuresArray) {
    if (!featuresArray || featuresArray.length === 0) return null;
    const dim = featuresArray[0].length;
    const avg = new Array(dim).fill(0);
    for (const f of featuresArray) {
        for (let i = 0; i < dim; i++) avg[i] += f[i];
    }
    return normalize(avg.map(v => v / featuresArray.length));
}

function euclideanDistance(f1, f2) {
    if (!f1 || !f2) return Infinity;
    let sum = 0;
    for (let i = 0; i < f1.length; i++) {
        const diff = f1[i] - f2[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

// ==================== 带缓存的用户获取 ====================
async function getUsersWithCache() {
    const now = Date.now();
    const cached = AppState.get('cachedUsers');
    const cacheTime = AppState.get('cacheTime');
    
    if (cached && cacheTime && (now - cacheTime) < CACHE_DURATION) {
        console.log('📦 使用缓存用户数据');
        return cached;
    }
    
    console.log('🔄 从数据库加载用户数据');
    const { data, error } = await supabase
        .from('users')
        .select('id, username, user_type, conges_payes, face_features_array')
        .eq('face_registered', true);
    
    if (error) throw error;
    
    const processed = (data || []).map(user => {
        const features = (user.face_features_array || []).filter(f => f && f.length > 0);
        return { 
            ...user, 
            face_features_array: features, 
            avg_feature: averageFeatures(features) 
        };
    }).filter(u => u.face_features_array.length >= RECOGNITION_CONFIG.MIN_FEATURES_COUNT);
    
    AppState.set('cachedUsers', processed);
    AppState.set('cacheTime', now);
    return processed;
}

function clearUserCache() {
    AppState.set('cachedUsers', null);
    AppState.set('cacheTime', null);
    console.log('🗑️ 用户缓存已清除');
}

// ==================== 初始化 ====================
window.addEventListener('load', async function() {
    console.log('页面加载完成');
    
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLanguage);
    });
    
    if (!checkFaceApi()) {
        showStatus('error_faceapi', 'error');
        return;
    }
    
    await loadModels();
    await loadAllUsers();
    
    if (document.getElementById('userCard')) {
        document.getElementById('userCard').style.display = 'none';
    }
    
    if (window.location.pathname.includes('register.html')) {
        console.log('录入页面，自动开启摄像头');
        await startCamera();
    }
    
    window.addEventListener('beforeunload', () => {
        AppState.cleanup();
        if (AppState.get('stream')) {
            AppState.get('stream').getTracks().forEach(track => track.stop());
        }
    });
});

// ==================== 模型加载 ====================
async function loadModels(retryCount = 0) {
    try {
        showStatus('loading', 'info');
        console.log('开始加载模型...');
        
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model/'),
            faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model/'),
            faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model/')
        ]);
        
        AppState.set('modelsLoaded', true);
        console.log('✅ 模型加载成功');
        showStatus('success', 'success');
        return true;
    } catch (error) {
        console.error('模型加载失败:', error);
        if (retryCount < MODEL_LOAD_RETRIES) {
            console.log(`重试加载模型 (${retryCount + 1}/${MODEL_LOAD_RETRIES})...`);
            showStatus('retrying', 'warning');
            await delay(1000);
            return loadModels(retryCount + 1);
        }
        showStatus('error_model', 'error');
        return false;
    }
}

// ==================== 摄像头控制 ====================
async function startCamera() {
    console.log('startCamera 被调用');
    const video = document.getElementById('video');
    if (!video) return false;
    
    try {
        if (AppState.get('stream')) {
            AppState.get('stream').getTracks().forEach(track => track.stop());
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, facingMode: 'user' }
        });
        
        video.srcObject = stream;
        AppState.set('stream', stream);
        AppState.set('isCameraActive', true);
        
        const container = document.querySelector('.video-container');
        if (container) container.style.display = 'block';
        
        await new Promise((resolve) => {
            video.onloadedmetadata = () => video.play();
            video.onplay = () => resolve();
        });
        
        startFrameDetection();
        return true;
    } catch (error) {
        console.error('摄像头启动失败:', error);
        showStatus('error_camera', 'error');
        return false;
    }
}

function stopCamera() {
    console.log('停止摄像头');
    
    if (AppState.get('animationFrameId')) {
        cancelAnimationFrame(AppState.get('animationFrameId'));
        AppState.set('animationFrameId', null);
    }
    
    if (AppState.get('stream')) {
        AppState.get('stream').getTracks().forEach(track => track.stop());
        AppState.set('stream', null);
    }
    
    const video = document.getElementById('video');
    if (video) video.srcObject = null;
    
    AppState.set('isCameraActive', false);
    
    const container = document.querySelector('.video-container');
    if (container) container.style.display = 'none';
    
    const canvas = document.getElementById('overlay');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// ==================== 超精致版人脸关键点绘制 ====================
function startFrameDetection() {
    if (AppState.get('animationFrameId')) cancelAnimationFrame(AppState.get('animationFrameId'));
    if (!AppState.get('modelsLoaded')) return;
    
    const video = document.getElementById('video');
    const canvas = document.getElementById('overlay');
    if (!video || !canvas) return;
    
    const detect = async () => {
        if (!AppState.get('isCameraActive') || video.paused || video.ended) {
            AppState.set('animationFrameId', requestAnimationFrame(detect));
            return;
        }
        
        try {
            const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
            
            const ctx = canvas.getContext('2d');
            canvas.width = video.clientWidth;
            canvas.height = video.clientHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const scaleX = canvas.width / video.videoWidth;
            const scaleY = canvas.height / video.videoHeight;
            
            detections.forEach(d => {
                const box = d.detection.box;
                const x = box.x * scaleX;
                const y = box.y * scaleY;
                const w = box.width * scaleX;
                const h = box.height * scaleY;
                const faceWidth = w;
                
                // 人脸框 - 双层精致边框
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 2.5;
                ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.2;
                ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
                
                // 四个角装饰
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 2;
                const cornerLen = Math.min(15, w * 0.1);
                ctx.beginPath();
                ctx.moveTo(x, y + cornerLen);
                ctx.lineTo(x, y);
                ctx.lineTo(x + cornerLen, y);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x + w - cornerLen, y);
                ctx.lineTo(x + w, y);
                ctx.lineTo(x + w, y + cornerLen);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x, y + h - cornerLen);
                ctx.lineTo(x, y + h);
                ctx.lineTo(x + cornerLen, y + h);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x + w - cornerLen, y + h);
                ctx.lineTo(x + w, y + h);
                ctx.lineTo(x + w, y + h - cornerLen);
                ctx.stroke();
                
                // 自适应点大小
                let basePointSize = Math.max(1.3, Math.min(2.8, faceWidth / 75));
                
                // 绘制超精致关键点
                d.landmarks.positions.forEach((p, idx) => {
                    const px = p.x * scaleX;
                    const py = p.y * scaleY;
                    
                    let pointColor = '#44ff44';
                    let pointSize = basePointSize;
                    
                    if (idx >= 36 && idx <= 47) {
                        pointColor = '#44ccff';
                        pointSize = basePointSize * 1.15;
                    } else if (idx >= 27 && idx <= 35) {
                        pointColor = '#ffaa44';
                        pointSize = basePointSize * 1.0;
                    } else if (idx >= 48 && idx <= 67) {
                        pointColor = '#ff66cc';
                        pointSize = basePointSize * 0.95;
                    } else if (idx >= 17 && idx <= 26) {
                        pointColor = '#44ffaa';
                        pointSize = basePointSize * 0.9;
                    } else {
                        pointColor = '#44ff44';
                        pointSize = basePointSize * 0.92;
                    }
                    
                    let glowSize = pointSize * 2.2;
                    
                    // 光晕
                    const gradient = ctx.createRadialGradient(px, py, 0, px, py, glowSize);
                    gradient.addColorStop(0, pointColor);
                    gradient.addColorStop(0.4, pointColor + '99');
                    gradient.addColorStop(0.7, pointColor + '44');
                    gradient.addColorStop(1, pointColor + '00');
                    ctx.beginPath();
                    ctx.fillStyle = gradient;
                    ctx.arc(px, py, glowSize, 0, 2 * Math.PI);
                    ctx.fill();
                    
                    // 主点
                    ctx.beginPath();
                    ctx.fillStyle = pointColor;
                    ctx.shadowBlur = 4;
                    ctx.shadowColor = pointColor;
                    ctx.arc(px, py, pointSize, 0, 2 * Math.PI);
                    ctx.fill();
                    
                    // 高光
                    ctx.beginPath();
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowBlur = 0;
                    ctx.arc(px - pointSize * 0.3, py - pointSize * 0.3, pointSize * 0.35, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.fillStyle = '#ffffffdd';
                    ctx.arc(px - pointSize * 0.1, py - pointSize * 0.15, pointSize * 0.12, 0, 2 * Math.PI);
                    ctx.fill();
                });
            });
            ctx.shadowBlur = 0;
        } catch(e) {}
        
        AppState.set('animationFrameId', requestAnimationFrame(detect));
    };
    
    AppState.set('animationFrameId', requestAnimationFrame(detect));
}

// ==================== 点头活体检测 ====================
async function performLivenessCheck() {
    const video = document.getElementById('video');
    
    let floatingHint = AppState.get('floatingHint');
    if (!floatingHint) {
        floatingHint = document.createElement('div');
        floatingHint.id = 'floatingHint';
        floatingHint.style.cssText = `
            position: fixed;
            bottom: 30%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.85);
            color: #ffaa00;
            padding: 16px 24px;
            border-radius: 50px;
            font-size: 20px;
            font-weight: bold;
            z-index: 10000;
            white-space: nowrap;
            backdrop-filter: blur(10px);
            border: 2px solid #ffaa00;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(floatingHint);
        AppState.set('floatingHint', floatingHint);
    }
    
    return new Promise((resolve) => {
        let nodDetected = false;
        let headYHistory = [];
        let requiredNods = 1;
        let nodCount = 0;
        
        floatingHint.textContent = t('nod_instruction') || '🙂 请轻轻点头一下';
        floatingHint.style.display = 'block';
        floatingHint.style.borderColor = '#ffaa00';
        floatingHint.style.color = '#ffaa00';
        
        const checkInterval = setInterval(async () => {
            if (!video || video.paused || video.ended) return;
            
            try {
                const detection = await faceapi
                    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks();
                
                if (!detection) return;
                
                const noseTip = detection.landmarks.getNose();
                if (!noseTip || noseTip.length < 1) return;
                
                const currentY = noseTip[0].y;
                headYHistory.push(currentY);
                if (headYHistory.length > 15) headYHistory.shift();
                
                if (headYHistory.length >= 10) {
                    const maxY = Math.max(...headYHistory);
                    const minY = Math.min(...headYHistory);
                    const deltaY = maxY - minY;
                    
                    if (deltaY > 8 && !nodDetected) {
                        nodDetected = true;
                        nodCount++;
                        floatingHint.textContent = `✅ ${t('nod_success') || '点头'} ${nodCount}/${requiredNods}`;
                        floatingHint.style.borderColor = '#00ff00';
                        floatingHint.style.color = '#00ff00';
                        
                        if (nodCount >= requiredNods) {
                            clearInterval(checkInterval);
                            clearTimeout(timeout);
                            // 活体检测成功提示
                            floatingHint.textContent = '✅ ' + (t('liveness_success') || '活体检测通过！');
                            showStatus('liveness_success', 'success');
                            // 1秒后关闭悬浮提示
                            setTimeout(() => {
                                if (floatingHint) floatingHint.style.display = 'none';
                            }, 1000);
                            resolve(true);
                        } else {
                            setTimeout(() => {
                                nodDetected = false;
                                floatingHint.textContent = t('nod_again') || '🙂 请再次轻轻点头';
                                floatingHint.style.borderColor = '#ffaa00';
                                floatingHint.style.color = '#ffaa00';
                            }, 500);
                        }
                    }
                }
            } catch (e) {
                console.error('点头检测错误:', e);
            }
        }, 100);
        
        const timeout = setTimeout(() => {
            clearInterval(checkInterval);
            if (floatingHint) floatingHint.style.display = 'none';
            showStatus('liveness_timeout', 'error');
            resolve(false);
        }, 10000);
    });
}
// ==================== 人脸识别函数 ====================
async function identify(retryCount = 0) {
    console.log('========== 🔍 开始人脸识别 ==========');
    
    if (!AppState.get('modelsLoaded')) {
        showStatus(t('error_model'), 'error');
        return;
    }
    
    if (!AppState.get('isCameraActive')) {
        await startCamera();
        await delay(500);
    }
    
    // 点头活体检测
    const livenessPassed = await performLivenessCheck();
    if (!livenessPassed) {
        stopCamera();
        return;
    }
    
    const video = document.getElementById('video');
    showStatus(t('detecting'), 'info');
    
    try {
        const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            if (retryCount < RECOGNITION_CONFIG.MAX_RETRIES) {
                showStatus(t('detect_failed_retry'), 'warning');
                await delay(500);
                return identify(retryCount + 1);
            }
            showStatus(t('no_face_detected'), 'error');
            return;
        }

        const currentFeatures = normalize(Array.from(detection.descriptor));
        const users = await getUsersWithCache();
        
        if (!users || users.length === 0) {
            showStatus(t('no_registered_users'), 'error');
            return;
        }
        
        // 批量计算距离
        const distances = [];
        for (const user of users) {
            let minDist = Infinity;
            
            // 优先使用平均特征
            if (user.avg_feature) {
                minDist = euclideanDistance(currentFeatures, user.avg_feature);
            } else {
                for (const f of user.face_features_array) {
                    const dist = euclideanDistance(currentFeatures, f);
                    if (dist < minDist) minDist = dist;
                }
            }
            
            distances.push({ 
                user: user, 
                distance: minDist, 
                featureCount: user.face_features_array.length 
            });
        }
        
        distances.sort((a, b) => a.distance - b.distance);
        const best = distances[0];
        const second = distances[1] || null;
        
        console.log(`🥇 最佳匹配: ${best.user.username}, 距离=${best.distance.toFixed(4)}`);
        
        // 胡子员工特殊处理（可根据用户类型或名字判断）
        const isBeardUser = best.user.user_type === 'chauffeur' || 
                            best.user.username.includes('胡') ||
                            best.user.username.includes('Beard');
        const threshold = isBeardUser ? RECOGNITION_CONFIG.BEARD_THRESHOLD : RECOGNITION_CONFIG.ABSOLUTE_THRESHOLD;
        
        // 绝对拒绝检查
        if (best.distance > RECOGNITION_CONFIG.ABSOLUTE_REJECT_THRESHOLD) {
            showStatus(t('unknown_user'), 'error');
            return;
        }
        
        // 距离阈值检查
        if (best.distance >= threshold) {
            showStatus(t('unknown_user'), 'error');
            return;
        }
        
        // 区分度检查
        if (second && (second.distance - best.distance) <= RECOGNITION_CONFIG.MIN_MARGIN) {
            showStatus(t('identify_uncertain'), 'warning');
            return;
        }
        
        // ========== 识别成功 ==========
        AppState.set('currentUser', best.user);
        
        // 显示用户卡片
        const userCard = document.getElementById('userCard');
        if (userCard) userCard.style.display = 'flex';
        document.getElementById('userName').textContent = best.user.username;
        document.getElementById('userType').textContent = t(best.user.user_type) || best.user.user_type;
        document.getElementById('userConges').textContent = best.user.conges_payes;
        document.getElementById('userInitial').textContent = best.user.username.charAt(0).toUpperCase();
        
        showStatus(t('identify_success'), 'success');
        
        // 识别成功后关闭摄像头
        stopCamera();
        
        // 启用打卡按钮
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.remove('disabled');
        });
        
        // 加载今日打卡记录
        await loadTodayRecords(best.user.id);
        
        // ========== 启动30秒倒计时自动退出 ==========
        startAutoCloseTimer();
        
    } catch (error) {
        console.error('识别失败:', error);
        if (retryCount < RECOGNITION_CONFIG.MAX_RETRIES) {
            await delay(500);
            return identify(retryCount + 1);
        }
        showStatus(t('identify_error'), 'error');
    }
}

// ==================== 员工管理 ====================
async function loadAllUsers() {
    try {
        if (!supabase) return [];
        
        const { data, error } = await supabase
            .from('users')
            .select('id, username, user_type, conges_payes, face_features_array, face_registered')
            .order('username');
        
        if (error) throw error;
        
        const processedUsers = data.map(user => {
            let featuresArray = user.face_features_array || [];
            const validFeatures = featuresArray.filter(f => f && f.length > 0);
            return { ...user, face_features_array: validFeatures };
        });
        
        AppState.set('allUsers', processedUsers);
        updateStats();
        
        if (document.getElementById('userList')) {
            displayUserList(processedUsers);
        }
        
        return processedUsers;
    } catch (error) {
        console.error('加载员工失败:', error);
        return [];
    }
}

function updateStats() {
    const totalEl = document.getElementById('totalCount');
    const registeredEl = document.getElementById('registeredCount');
    const unregisteredEl = document.getElementById('unregisteredCount');
    
    if (totalEl && registeredEl && unregisteredEl) {
        const users = AppState.get('allUsers');
        const total = users.length;
        const registered = users.filter(u => u.face_registered).length;
        const unregistered = total - registered;
        
        totalEl.textContent = total;
        registeredEl.textContent = registered;
        unregisteredEl.textContent = unregistered;
    }
}

function filterUsers() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const users = AppState.get('allUsers');
    const filtered = users.filter(user => user.username.toLowerCase().includes(searchTerm));
    displayUserList(filtered);
}

function displayUserList(users) {
    const userList = document.getElementById('userList');
    if (!userList) return;

    if (users.length === 0) {
        userList.innerHTML = `<div class="empty">${t('no_employee')}</div>`;
        return;
    }

    userList.innerHTML = '';
    
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = `user-item ${user.face_registered ? 'registered' : 'unregistered'}`;
        div.onclick = () => selectUser(user);
        
        const status = user.face_registered ? t('registered') : t('unregistered');
        const faceCount = user.face_features_array?.length || 0;
        const userTypeLabel = t(user.user_type) || user.user_type;
        
        div.innerHTML = `
            <div class="user-avatar-small">${user.username.charAt(0).toUpperCase()}</div>
            <div class="user-info">
                <div class="user-name">${user.username}</div>
                <div class="user-meta">${userTypeLabel} · ${t('remaining_leave')} ${user.conges_payes}${t('days')}</div>
                ${faceCount > 0 ? `<div class="face-count">📸 ${faceCount}${t('face_count_unit')}</div>` : ''}
            </div>
            <div class="user-status ${user.face_registered ? 'status-registered' : 'status-unregistered'}">${status}</div>
        `;
        
        userList.appendChild(div);
    });
}

function selectUser(user) {
    AppState.set('selectedUserId', user.id);
    document.querySelectorAll('.user-item').forEach(item => item.classList.remove('selected'));
    if (event && event.currentTarget) event.currentTarget.classList.add('selected');
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) registerBtn.disabled = false;
}

function resetRegistration() {
    AppState.set('selectedUserId', null);
    document.querySelectorAll('.user-item').forEach(item => item.classList.remove('selected'));
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) registerBtn.disabled = true;
}

// ==================== 多姿势录入 ====================
async function collectMultiPoseSamples() {
    const samples = [];
    const video = document.getElementById('video');
    
    for (let i = 0; i < REGISTER_POSES.length; i++) {
        const pose = REGISTER_POSES[i];
        const poseText = t(pose.text) || pose.text;
        
        // 显示姿势引导
        showStatus(`${pose.emoji} ${poseText}`, 'info');
        
        // 更新姿势引导界面（如果存在）
        if (window.updatePoseProgress) {
            window.updatePoseProgress(i + 1, REGISTER_POSES.length);
        }
        if (window.showPoseMessage) {
            window.showPoseMessage(poseText, pose.emoji);
        }
        
        // 等待用户调整姿势
        await delay(pose.delay);
        
        // 检测人脸并提取特征
        const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
        
        if (detection) {
            const normalizedFeatures = normalize(Array.from(detection.descriptor));
            normalizedFeatures._normalized = true;
            samples.push(normalizedFeatures);
            console.log(`✅ 姿势 ${i + 1}/${REGISTER_POSES.length} 采集成功`);
            showStatus(`✅ ${t('register_collected')} ${samples.length}/${REGISTER_POSES.length}`, 'success');
        } else {
            console.log(`❌ 姿势 ${i + 1} 采集失败，未检测到人脸`);
            showStatus(`⚠️ ${t('register_no_face')} ${t('retry')} ${i + 1}`, 'warning');
            i--; // 重试当前姿势
        }
        
        await delay(300);
    }
    
    return samples;
}

async function registerFace() {
    const selectedId = AppState.get('selectedUserId');
    if (!selectedId) {
        showStatus('hint_select_employee', 'error');
        return;
    }
    
    if (!AppState.get('isCameraActive')) {
        await startCamera();
        await delay(500);
    }
    
    try {
        showStatus('register_sampling', 'info');
        
        // 使用多姿势采集
        const samples = await collectMultiPoseSamples();
        
        if (samples.length === 0) {
            showStatus('register_no_face', 'error');
            return;
        }
        
        if (samples.length < 4) {
            showStatus(`${t('register_few_faces')} ${samples.length} ${t('register_few_faces_unit')}`, 'warning');
        }
        
        // 获取现有特征
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('face_features_array')
            .eq('id', selectedId)
            .single();
        
        if (fetchError) throw fetchError;
        
        let existingFeatures = user?.face_features_array || [];
        existingFeatures = existingFeatures.filter(f => f && f.length > 0);
        
        const MAX_FEATURES = 20;
        const newFeatures = [...existingFeatures, ...samples];
        
        if (newFeatures.length > MAX_FEATURES) {
            const overflow = newFeatures.length - MAX_FEATURES;
            newFeatures.splice(0, overflow);
        }
        
        const { error } = await supabase
            .from('users')
            .update({
                face_features_array: newFeatures,
                face_registered: true
            })
            .eq('id', selectedId);

        if (error) throw error;
        
        clearUserCache();
        showStatus(`${t('register_success')} (${samples.length} ${t('register_faces')})`, 'success');
        await loadAllUsers();
        
        const registerBtn = document.getElementById('registerBtn');
        if (registerBtn) registerBtn.disabled = true;
        AppState.set('selectedUserId', null);
        stopCamera();
        
        // 隐藏姿势引导界面
        if (window.hidePoseGuide) {
            window.hidePoseGuide();
        }

    } catch (error) {
        console.error('录入失败:', error);
        showStatus('register_error', 'error');
    }
}

// ==================== 考勤记录 ====================
function checkLoginThenRecord(actionType) {
    if (!AppState.get('currentUser')) {
        showStatus('hint_select_employee_first', 'error');
        return;
    }
    record(actionType);
}

async function record(actionType) {
    const currentUserData = AppState.get('currentUser');
    if (!currentUserData) {
        showStatus(t('hint_select_employee_first'), 'error');
        return;
    }

    try {
        // 使用本地时间（法国时间）
        const now = new Date();
        const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        
        const { error } = await supabase
            .from('attendance_records')
            .insert([{
                user_id: currentUserData.id,
                username: currentUserData.username,
                user_type: currentUserData.user_type,
                action_type: actionType,
                record_date: today,
                action_time: new Date().toISOString(),
                is_valid: true,
                status: 'normal'
            }]);
        
        if (error) throw error;
        
        if (actionType === 'check_out') {
            await calculateWorkHours(currentUserData.id, today);
        }
        
        const actionName = t(actionType) || actionType;
        showStatus(`${actionName}${t('record_success_suffix')}`, 'success');
        
        const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        
        const timeMap = {
            'check_in': 'checkInTime',
            'check_out': 'checkOutTime',
            'break_start': 'breakStartTime',
            'break_end': 'breakEndTime'
        };
        
        const timeElement = document.getElementById(timeMap[actionType]);
        if (timeElement) timeElement.textContent = timeStr;
        
        await loadTodayRecords(currentUserData.id);
        resetAutoCloseTimer();

    } catch (error) {
        console.error('记录失败:', error);
        showStatus(t('record_failed'), 'error');
    }
}

// ==================== 计算工作时长 ====================
async function calculateWorkHours(userId, date) {
    // 获取当天所有打卡记录
    const { data: records, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', userId)
        .eq('record_date', date)
        .order('action_time', { ascending: true });
    
    if (error || !records || records.length === 0) return;
    
    const checkIn = records.find(r => r.action_type === 'check_in');
    const checkOut = records.find(r => r.action_type === 'check_out');
    const breakStart = records.find(r => r.action_type === 'break_start');
    const breakEnd = records.find(r => r.action_type === 'break_end');
    
    // 情况1：有上班但没有下班记录
    if (checkIn && !checkOut) {
        await supabase
            .from('attendance_records')
            .update({ 
                status: 'abnormal', 
                need_review: true,
                work_hours: 0
            })
            .eq('id', checkIn.id);
        showStatus(`⚠️ 今日有上班打卡但无下班打卡，需管理员审核`, 'warning');
        return;
    }
    
    // 情况2：没有上班记录，不处理
    if (!checkIn || !checkOut) return;
    
    // 计算总工作时间（分钟）
    let totalMinutes = (new Date(checkOut.action_time) - new Date(checkIn.action_time)) / (1000 * 60);
    
    // 减去休息时间
    if (breakStart && breakEnd) {
        const breakMinutes = (new Date(breakEnd.action_time) - new Date(breakStart.action_time)) / (1000 * 60);
        totalMinutes -= breakMinutes;
    }
    
    const workHours = totalMinutes / 60;
    const isAbnormal = workHours < 8;
    
    // 更新下班打卡记录
    await supabase
        .from('attendance_records')
        .update({ 
            work_hours: parseFloat(workHours.toFixed(2)), 
            need_review: isAbnormal,
            status: isAbnormal ? 'abnormal' : 'normal'
        })
        .eq('id', checkOut.id);
    
    // 如果有异常，显示提示
    if (isAbnormal) {
        showStatus(`⚠️ 今日工作时长 ${workHours.toFixed(2)} 小时，不足8小时，需管理员审核`, 'warning');
    } else {
        showStatus(`✅ 今日工作时长 ${workHours.toFixed(2)} 小时，正常出勤`, 'success');
    }
}

// ==================== 启动30秒倒计时自动退出 ====================
function startAutoCloseTimer() {
    // 清除旧的定时器
    if (AppState.get('autoCloseTimer')) {
        clearTimeout(AppState.get('autoCloseTimer'));
        AppState.set('autoCloseTimer', null);
    }
    
    // 清除旧的倒计时
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }
    
    // 显示提示框
    const hintBox = document.getElementById('autoCloseHint');
    if (hintBox) hintBox.style.display = 'block';
    
    // 重置倒计时数字
    let remainingSeconds = 30;
    const countdownEl = document.getElementById('countdownSeconds');
    if (countdownEl) countdownEl.textContent = remainingSeconds;
    
    // 启动倒计时更新
    window.countdownInterval = setInterval(() => {
        remainingSeconds--;
        if (countdownEl && remainingSeconds >= 0) {
            countdownEl.textContent = remainingSeconds;
        }
        if (remainingSeconds <= 0) {
            clearInterval(window.countdownInterval);
            window.countdownInterval = null;
        }
    }, 1000);
    
    // 启动30秒后执行清除
    AppState.set('autoCloseTimer', setTimeout(() => {
        // 清除倒计时
        if (window.countdownInterval) {
            clearInterval(window.countdownInterval);
            window.countdownInterval = null;
        }
        
        // 隐藏用户卡片
        const userCard = document.getElementById('userCard');
        if (userCard) userCard.style.display = 'none';
        
        // 清空记录列表
        const recordsList = document.getElementById('recordsList');
        if (recordsList) {
            recordsList.innerHTML = `<div class="empty">${t('no_records')}</div>`;
        }
        
        // 禁用所有打卡按钮
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.add('disabled');
        });
        
        // 清除当前用户
        AppState.set('currentUser', null);
        
        // 隐藏倒计时提示框
        if (hintBox) hintBox.style.display = 'none';
        
        // 清空时间显示
        const timeElements = ['checkInTime', 'checkOutTime', 'breakStartTime', 'breakEndTime'];
        timeElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '';
        });
        
        // 显示自动关闭提示
        showStatus(t('auto_close_info'), 'info');
        AppState.set('autoCloseTimer', null);
    }, 30000));
}
// ==================== 重置30秒倒计时 ====================
function resetAutoCloseTimer() {
    // 清除旧的定时器
    if (AppState.get('autoCloseTimer')) {
        clearTimeout(AppState.get('autoCloseTimer'));
    }
    
    // 清除旧的倒计时
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
    }
    
    // 显示提示框（如果已隐藏则重新显示）
    const hintBox = document.getElementById('autoCloseHint');
    if (hintBox) hintBox.style.display = 'block';
    
    // 重置倒计时数字
    let remainingSeconds = 30;
    const countdownEl = document.getElementById('countdownSeconds');
    if (countdownEl) countdownEl.textContent = remainingSeconds;
    
    // 启动新的倒计时更新
    window.countdownInterval = setInterval(() => {
        remainingSeconds--;
        if (countdownEl && remainingSeconds >= 0) {
            countdownEl.textContent = remainingSeconds;
        }
        if (remainingSeconds <= 0) {
            clearInterval(window.countdownInterval);
            window.countdownInterval = null;
        }
    }, 1000);
    
    // 启动30秒后执行清除
    AppState.set('autoCloseTimer', setTimeout(() => {
        // 清除倒计时
        if (window.countdownInterval) {
            clearInterval(window.countdownInterval);
            window.countdownInterval = null;
        }
        
        // 隐藏用户卡片
        const userCard = document.getElementById('userCard');
        if (userCard) userCard.style.display = 'none';
        
        // 清空记录列表
        const recordsList = document.getElementById('recordsList');
        if (recordsList) {
            recordsList.innerHTML = `<div class="empty">${t('no_records')}</div>`;
        }
        
        // 禁用所有打卡按钮
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.add('disabled');
        });
        
        // 清除当前用户
        AppState.set('currentUser', null);
        
        // 隐藏倒计时提示框
        if (hintBox) hintBox.style.display = 'none';
        
        // 清空时间显示
        const timeElements = ['checkInTime', 'checkOutTime', 'breakStartTime', 'breakEndTime'];
        timeElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '';
        });
        
        // 显示自动关闭提示
        showStatus(t('auto_close_info'), 'info');
        AppState.set('autoCloseTimer', null);
    }, 30000));
}
async function loadTodayRecords(userId) {
    try {
        // 使用法国本地时间
        const now = new Date();
        const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('user_id', userId)
            .eq('record_date', today)
            .order('action_time', { ascending: true });

        if (error) throw error;

        const recordsDiv = document.getElementById('recordsList');
        if (!recordsDiv) return;

        if (!data || data.length === 0) {
            recordsDiv.innerHTML = `<div class="empty">${t('no_records')}</div>`;
            const todayCount = document.getElementById('todayCount');
            if (todayCount) todayCount.textContent = '0';
            return;
        }

        const todayCount = document.getElementById('todayCount');
        if (todayCount) todayCount.textContent = data.length;
        
        recordsDiv.innerHTML = data.map(record => {
            const time = new Date(record.action_time).toLocaleTimeString('fr-FR', {
                hour: '2-digit', minute: '2-digit'
            });
            const actionName = t(record.action_type) || record.action_type;
            return `
                <div class="record-item">
                    <span class="record-time">${time}</span>
                    <span class="record-type">${actionName}</span>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('加载记录失败:', error);
    }
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';
}

// ==================== 状态提示（三语支持）====================
function showStatus(messageKey, type, duration = null) {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    
    if (window.statusTimeout) clearTimeout(window.statusTimeout);
    
    let message = messageKey;
    if (typeof messageKey === 'string' && !messageKey.includes(' ') && !messageKey.includes('✅') && !messageKey.includes('⚠️')) {
        const translated = t(messageKey);
        if (translated !== messageKey) message = translated;
    }
    
    statusDiv.style.display = 'block';
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
    
    let displayDuration = duration;
    if (displayDuration === null) {
        if (type === 'error') displayDuration = 5000;
        else if (type === 'warning') displayDuration = 4000;
        else displayDuration = 4000;
    }
    
    window.statusTimeout = setTimeout(() => {
        if (statusDiv && statusDiv.style) statusDiv.style.display = 'none';
        window.statusTimeout = null;
    }, displayDuration);
}

// 导出全局函数
// 导出全局函数
window.identify = identify;
window.registerFace = registerFace;
window.selectUser = selectUser;
window.resetRegistration = resetRegistration;
window.filterUsers = filterUsers;
window.record = record;
window.checkLoginThenRecord = checkLoginThenRecord;
window.closeLoginModal = closeLoginModal;
window.startCamera = startCamera;
window.stopCamera = stopCamera;
window.loadAllUsers = loadAllUsers;
window.startAutoCloseTimer = startAutoCloseTimer;
window.resetAutoCloseTimer = resetAutoCloseTimer;