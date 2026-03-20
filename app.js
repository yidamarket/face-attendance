// app.js - 严格版（完整三语支持 + 陌生人拒识）
// 核心优化：
// 1. normalize 归一化
// 2. 平均向量（中心脸）
// 3. 自动采样注册（5张）
// 4. 帧检测节流
// 5. 去掉不稳定的 cosine fallback
// 6. 动画帧清理机制
// 7. 全局状态统一管理
// 8. 重试机制
// 9. 严格版陌生人拒识

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
        floatingHint: null
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

// 初始化 window 全局变量
if (typeof window.modelsLoaded === 'undefined') {
    window.modelsLoaded = false;
    window.currentUser = null;
    window.allUsers = [];
    window.selectedUserId = null;
    window.stream = null;
    window.autoCloseTimer = null;
    window.isCameraActive = false;
    window.faceapiLoaded = false;
}

AppState.update({
    modelsLoaded: window.modelsLoaded,
    currentUser: window.currentUser,
    allUsers: window.allUsers,
    selectedUserId: window.selectedUserId,
    stream: window.stream,
    autoCloseTimer: window.autoCloseTimer,
    isCameraActive: window.isCameraActive,
    faceapiLoaded: window.faceapiLoaded
});

// 兼容旧代码
var modelsLoaded = () => AppState.get('modelsLoaded');
var currentUser = () => AppState.get('currentUser');
var allUsers = () => AppState.get('allUsers');
var selectedUserId = () => AppState.get('selectedUserId');
var stream = () => AppState.get('stream');
var autoCloseTimer = () => AppState.get('autoCloseTimer');
var isCameraActive = () => AppState.get('isCameraActive');
var faceapiLoaded = () => AppState.get('faceapiLoaded');

function updateGlobalVars() {
    window.modelsLoaded = AppState.get('modelsLoaded');
    window.currentUser = AppState.get('currentUser');
    window.allUsers = AppState.get('allUsers');
    window.selectedUserId = AppState.get('selectedUserId');
    window.stream = AppState.get('stream');
    window.autoCloseTimer = AppState.get('autoCloseTimer');
    window.isCameraActive = AppState.get('isCameraActive');
    window.faceapiLoaded = AppState.get('faceapiLoaded');
}

// ==================== 人脸识别配置（严格版） ====================
const RECOGNITION_CONFIG = {
    // 绝对距离阈值 - 必须小于0.48才考虑匹配
    ABSOLUTE_THRESHOLD: 0.48,
    
    // 绝对拒绝阈值 - 超过0.55直接拒绝
    ABSOLUTE_REJECT_THRESHOLD: 0.55,
    
    // Top-2 最小差距 - 第一名必须比第二名好0.08以上
    MIN_MARGIN: 0.08,
    
    // 比值阈值 - 最佳/第二必须小于0.85
    MAX_RATIO: 0.85,
    
    // 最小特征数量 - 用户至少需要3张注册照
    MIN_FEATURES_COUNT: 3,
    
    // 是否启用平均脸
    USE_AVERAGE_FACE: false,
    
    // 识别重试次数
    MAX_RETRIES: 2
};

const REGISTER_SAMPLE_COUNT = 5;
const REGISTER_SAMPLE_INTERVAL = 300;
const DETECTION_THROTTLE_MS = 100;
const MODEL_LOAD_RETRIES = 2;

// 工具函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function checkFaceApi() {
    return typeof faceapi !== 'undefined' && faceapi !== null;
}

// ==================== 向量归一化 ====================
function normalize(vec) {
    if (!vec || vec.length === 0) return vec;
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vec;
    return vec.map(v => v / norm);
}

// ==================== 平均特征向量 ====================
function averageFeatures(featuresArray) {
    if (!featuresArray || featuresArray.length === 0) return null;
    
    const dim = featuresArray[0].length;
    const avg = new Array(dim).fill(0);
    
    for (const f of featuresArray) {
        for (let i = 0; i < dim; i++) {
            avg[i] += f[i];
        }
    }
    
    return normalize(avg.map(v => v / featuresArray.length));
}

function euclideanDistance(features1, features2) {
    if (!features1 || !features2 || features1.length !== features2.length) {
        return Infinity;
    }
    
    let sum = 0;
    for (let i = 0; i < features1.length; i++) {
        const diff = features1[i] - features2[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
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
        console.log('开始加载模型');
        
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model/'),
            faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model/'),
            faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model/')
        ]);
        
        AppState.set('modelsLoaded', true);
        updateGlobalVars();
        console.log('模型加载成功');
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
    if (!video) {
        console.log('video元素不存在');
        return false;
    }
    
    try {
        const currentStream = AppState.get('stream');
        if (currentStream) {
            console.log('关闭现有摄像头');
            stopCamera();
        }
        
        console.log('请求摄像头权限');
        const newStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            } 
        });
        
        video.srcObject = newStream;
        AppState.set('stream', newStream);
        AppState.set('isCameraActive', true);
        console.log('摄像头已启动');
        
        const container = document.querySelector('.video-container');
        if (container) {
            container.style.display = 'block';
        }
        
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
            };
            video.onplay = () => {
                resolve();
            };
        });
        
        startLandmarkDetection();
        updateGlobalVars();
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
    
    const video = document.getElementById('video');
    const currentStream = AppState.get('stream');
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        AppState.set('stream', null);
    }
    if (video) {
        video.srcObject = null;
    }
    AppState.set('isCameraActive', false);
    
    const container = document.querySelector('.video-container');
    if (container) {
        container.style.display = 'none';
    }
    
    const canvas = document.getElementById('overlay');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    updateGlobalVars();
}

// ==================== 帧检测 ====================
function startLandmarkDetection() {
    if (AppState.get('animationFrameId')) {
        cancelAnimationFrame(AppState.get('animationFrameId'));
        AppState.set('animationFrameId', null);
    }
    
    if (!AppState.get('modelsLoaded') || !checkFaceApi() || !AppState.get('isCameraActive')) return;
    
    const video = document.getElementById('video');
    const canvas = document.getElementById('overlay');
    if (!video || !canvas) return;
    if (video.videoWidth === 0) { 
        setTimeout(startLandmarkDetection, 100); 
        return; 
    }

    let lastWidth = 0, lastHeight = 0;
    let lastFrameTime = 0;

    const detect = async () => {
        if (!AppState.get('isCameraActive') || video.paused || video.ended) {
            AppState.set('animationFrameId', requestAnimationFrame(detect));
            return;
        }

        const now = Date.now();
        if (now - lastFrameTime < DETECTION_THROTTLE_MS) {
            AppState.set('animationFrameId', requestAnimationFrame(detect));
            return;
        }
        lastFrameTime = now;

        const containerWidth = video.clientWidth;
        const containerHeight = video.clientHeight;

        if (lastWidth !== containerWidth || lastHeight !== containerHeight) {
            canvas.width = containerWidth;
            canvas.height = containerHeight;
            lastWidth = containerWidth;
            lastHeight = containerHeight;
        }

        const ctx = canvas.getContext('2d');
        const vw = video.videoWidth, vh = video.videoHeight;
        const scaleX = containerWidth / vw;
        const scaleY = containerHeight / vh;
        const scale = Math.max(scaleX, scaleY);
        const scaledW = vw * scale;
        const scaledH = vh * scale;
        const offsetX = (containerWidth - scaledW) / 2;
        const offsetY = (containerHeight - scaledH) / 2;

        function map(x, y) {
            return { x: offsetX + x * scale, y: offsetY + y * scale };
        }

        try {
            const detections = await faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks();

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (detections.length) {
                detections.forEach(d => {
                    const box = d.detection.box;
                    const tl = map(box.x, box.y);
                    const br = map(box.x + box.width, box.y + box.height);
                    const w = br.x - tl.x;
                    const h = br.y - tl.y;

                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(tl.x, tl.y, w, h);

                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.strokeRect(tl.x, tl.y, w, h);
                    ctx.setLineDash([]);

                    const pointSize = Math.max(4, Math.min(12, w / 25));

                    d.landmarks.positions.forEach(p => {
                        const mp = map(p.x, p.y);
                        ctx.fillStyle = '#00ff00';
                        ctx.shadowColor = '#00ff00';
                        ctx.shadowBlur = 10;
                        ctx.beginPath();
                        ctx.arc(mp.x, mp.y, pointSize, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.shadowBlur = 0;
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    });
                });
            }
        } catch (e) {}
        
        AppState.set('animationFrameId', requestAnimationFrame(detect));
    };
    
    AppState.set('animationFrameId', requestAnimationFrame(detect));
}

function checkLoginThenRecord(actionType) {
    if (!AppState.get('currentUser')) {
        showStatus('hint_select_employee_first', 'error');
        return;
    }
    record(actionType);
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

// ==================== 识别 - 严格版 ====================
async function identify(retryCount = 0) {
    console.log('========== 🔍 开始人脸识别（严格版） ==========');
    console.log(`重试次数: ${retryCount}/${RECOGNITION_CONFIG.MAX_RETRIES}`);
    
    if (!AppState.get('modelsLoaded')) {
        showStatus('error_model', 'error');
        return;
    }
    
    if (!AppState.get('isCameraActive')) {
        console.log('📷 摄像头未启动，正在启动...');
        await startCamera();
        
        const video = document.getElementById('video');
        await new Promise((resolve) => {
            const checkReady = () => {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            setTimeout(resolve, 100);
                        });
                    });
                } else {
                    requestAnimationFrame(checkReady);
                }
            };
            checkReady();
        });
        console.log('✅ 摄像头已启动');
    }
    
    console.log('👄 开始活体检测...');
    const livenessPassed = await performLivenessCheck();
    if (!livenessPassed) {
        console.log('❌ 活体检测失败');
        stopCamera();
        return;
    }
    console.log('✅ 活体检测通过');
    
    const video = document.getElementById('video');
    showStatus('detecting', 'info');
    
    try {
        console.log('📸 检测人脸并提取特征...');
        const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            console.log('❌ 未检测到人脸');
            if (retryCount < RECOGNITION_CONFIG.MAX_RETRIES) {
                console.log(`🔄 重试识别 (${retryCount + 1}/${RECOGNITION_CONFIG.MAX_RETRIES})...`);
                showStatus('detect_failed_retry', 'warning');
                await delay(500);
                return identify(retryCount + 1);
            }
            showStatus('no_face_detected', 'error');
            return;
        }
        console.log('✅ 人脸检测成功');

        const currentFeatures = normalize(Array.from(detection.descriptor));
        const featureNorm = Math.sqrt(currentFeatures.reduce((sum, v) => sum + v * v, 0));
        console.log(`📊 当前特征范数: ${featureNorm.toFixed(4)} (应为 1.0)`);
        
        console.log('👥 获取已注册用户...');
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, user_type, conges_payes, face_features_array')
            .eq('face_registered', true);
        
        if (error) throw error;
        
        if (!users || users.length === 0) {
            console.log('❌ 暂无已注册员工');
            showStatus('no_registered_users', 'error');
            return;
        }
        console.log(`✅ 找到 ${users.length} 个已注册用户`);
        
        console.log('📏 计算特征距离...');
        const distances = [];
        
        for (const user of users) {
            const featuresArray = user.face_features_array || [];
            const validFeatures = featuresArray.filter(f => f && f.length > 0);
            
            if (validFeatures.length < RECOGNITION_CONFIG.MIN_FEATURES_COUNT) {
                console.log(`⚠️ 用户 ${user.username} 特征不足 (${validFeatures.length}/${RECOGNITION_CONFIG.MIN_FEATURES_COUNT})，跳过`);
                continue;
            }
            
            const normalizedArray = validFeatures.map(f => {
                return f._normalized ? f : normalize(f);
            });
            
            const distancesToUser = normalizedArray.map(f => 
                euclideanDistance(currentFeatures, f)
            );
            const userDistance = Math.min(...distancesToUser);
            
            distances.push({
                user,
                distance: userDistance,
                featureCount: validFeatures.length
            });
            
            console.log(`  ${user.username}: 距离=${userDistance.toFixed(4)} (基于${validFeatures.length}个特征)`);
        }
        
        distances.sort((a, b) => a.distance - b.distance);
        
        if (distances.length === 0) {
            console.log('❌ 无有效用户数据');
            showStatus('no_valid_user_data', 'error');
            return;
        }
        
        const best = distances[0];
        const second = distances[1] || null;
        
        console.log('========== 🏆 匹配结果 ==========');
        console.log(`🥇 第一名: ${best.user.username}`);
        console.log(`   距离: ${best.distance.toFixed(4)}`);
        console.log(`   特征数: ${best.featureCount}`);
        
        if (second) {
            console.log(`🥈 第二名: ${second.user.username}`);
            console.log(`   距离: ${second.distance.toFixed(4)}`);
            console.log(`   特征数: ${second.featureCount}`);
            console.log(`   Margin: ${(second.distance - best.distance).toFixed(4)}`);
            console.log(`   Ratio: ${(best.distance / second.distance).toFixed(4)}`);
        }
        
        // ========== 严格版判决逻辑 ==========
        
        // 🚨 第一关：绝对拒绝检查
        if (best.distance > RECOGNITION_CONFIG.ABSOLUTE_REJECT_THRESHOLD) {
            console.log(`❌ 拒绝: 距离=${best.distance.toFixed(3)} > ${RECOGNITION_CONFIG.ABSOLUTE_REJECT_THRESHOLD}`);
            showStatus(`unknown_user`, 'error');
            return;
        }
        
        // 第二关：绝对距离阈值
        if (best.distance >= RECOGNITION_CONFIG.ABSOLUTE_THRESHOLD) {
            console.log(`❌ 拒绝: 距离=${best.distance.toFixed(3)} >= ${RECOGNITION_CONFIG.ABSOLUTE_THRESHOLD}`);
            showStatus(`unknown_user`, 'error');
            return;
        }
        
        // 第三关：Margin 检查（区分度）
        if (second) {
            const margin = second.distance - best.distance;
            if (margin <= RECOGNITION_CONFIG.MIN_MARGIN) {
                console.log(`⚠️ 拒绝: 区分度不足, margin=${margin.toFixed(3)} <= ${RECOGNITION_CONFIG.MIN_MARGIN}`);
                showStatus(`identify_uncertain`, 'warning');
                return;
            }
        }
        
        // 第四关：Ratio 检查
        if (second && second.distance > 0) {
            const ratio = best.distance / second.distance;
            if (ratio >= RECOGNITION_CONFIG.MAX_RATIO) {
                console.log(`⚠️ 拒绝: 比值过高, ratio=${ratio.toFixed(3)} >= ${RECOGNITION_CONFIG.MAX_RATIO}`);
                showStatus(`identify_low_confidence`, 'warning');
                return;
            }
        }
        
        // ========== 所有检查通过，识别成功 ==========
        console.log(`✅ 识别成功! 用户: ${best.user.username}`);
        
        const matchedUser = best.user;
        AppState.set('currentUser', matchedUser);
        
        const userTypeLabel = t(matchedUser.user_type) || matchedUser.user_type;
        
        const userCard = document.getElementById('userCard');
        if (userCard) {
            userCard.style.display = 'flex';
        }
        document.getElementById('userName').textContent = matchedUser.username;
        document.getElementById('userType').textContent = userTypeLabel;
        document.getElementById('userConges').textContent = matchedUser.conges_payes;
        document.getElementById('userInitial').textContent = matchedUser.username.charAt(0).toUpperCase();
        
        // 计算置信度
        let confidence = Math.max(0, (1 - best.distance / RECOGNITION_CONFIG.ABSOLUTE_THRESHOLD) * 100);
        if (second) {
            const marginBonus = Math.min(15, ((second.distance - best.distance) / RECOGNITION_CONFIG.MIN_MARGIN) * 10);
            confidence = Math.min(100, confidence + marginBonus);
        }
        
        const confidenceEl = document.getElementById('confidenceScore');
        if (confidenceEl) {
            confidenceEl.textContent = `${confidence.toFixed(1)}%`;
        }
        
        console.log(`📊 置信度: ${confidence.toFixed(1)}%`);
        console.log('========== ✅ 识别完成 ==========');
        
        showStatus(`identify_success`, 'success');
        
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.remove('disabled');
        });
        
        await loadTodayRecords(matchedUser.id);
        stopCamera();
        startAutoCloseTimer();
        
    } catch (error) {
        console.error('❌ 识别异常:', error);
        if (retryCount < RECOGNITION_CONFIG.MAX_RETRIES) {
            console.log(`🔄 识别出错，重试 (${retryCount + 1}/${RECOGNITION_CONFIG.MAX_RETRIES})...`);
            await delay(500);
            return identify(retryCount + 1);
        }
        showStatus('identify_error', 'error');
    }
    
    updateGlobalVars();
}

// ==================== 自动关闭定时器 ====================
function startAutoCloseTimer() {
    const currentTimer = AppState.get('autoCloseTimer');
    if (currentTimer) {
        clearTimeout(currentTimer);
    }
    
    const hint = document.getElementById('autoCloseHint');
    if (hint) hint.style.display = 'block';
    
    const timer = setTimeout(() => {
        const userCard = document.getElementById('userCard');
        const recordsList = document.getElementById('recordsList');
        
        if (userCard) userCard.style.display = 'none';
        if (recordsList) recordsList.innerHTML = `<div class="empty">${t('no_records')}</div>`;
        
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.add('disabled');
        });
        
        AppState.set('currentUser', null);
        
        const timeElements = ['checkInTime', 'checkOutTime', 'breakStartTime', 'breakEndTime'];
        timeElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '';
        });
        
        if (hint) hint.style.display = 'none';
        
        showStatus('auto_close_info', 'info');
        AppState.set('autoCloseTimer', null);
        updateGlobalVars();
    }, 5000);
    
    AppState.set('autoCloseTimer', timer);
    updateGlobalVars();
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
            
            const normalizedArray = featuresArray.map(f => {
                if (f && f._normalized) return f;
                if (f && f.length) return { ...normalize(f), _normalized: true };
                return null;
            }).filter(f => f !== null);
            
            return {
                ...user,
                face_features: normalizedArray[0] || null,
                face_features_array: normalizedArray
            };
        });
        
        AppState.set('allUsers', processedUsers);
        updateGlobalVars();
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
    const filtered = users.filter(user => 
        user.username.toLowerCase().includes(searchTerm)
    );
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

// ==================== 活体检测 ====================
async function performLivenessCheck() {
    const video = document.getElementById('video');
    
    const openText = t('open_mouth');
    showStatus(openText, 'info');
    
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
    floatingHint.textContent = openText;
    floatingHint.style.display = 'block';
    
    return new Promise((resolve) => {
        let mouthOpened = false;
        
        const checkInterval = setInterval(async () => {
            if (!video || video.paused || video.ended) return;
            
            try {
                const detection = await faceapi
                    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks();
                
                if (!detection) return;
                
                const landmarks = detection.landmarks;
                const positions = landmarks.positions;
                
                if (positions.length >= 68) {
                    const leftCorner = positions[48];
                    const rightCorner = positions[54];
                    const upperLip = positions[51];
                    const lowerLip = positions[57];
                    
                    const mouthWidth = Math.hypot(rightCorner.x - leftCorner.x, rightCorner.y - leftCorner.y);
                    const mouthHeight = Math.hypot(lowerLip.y - upperLip.y, lowerLip.x - upperLip.x);
                    const mouthOpenRatio = mouthHeight / mouthWidth;
                    
                    const isOpen = mouthOpenRatio > 0.8;
                    const isClosed = mouthOpenRatio < 0.5;
                    
                    if (isOpen && !mouthOpened) {
                        mouthOpened = true;
                        const closeText = t('close_mouth');
                        floatingHint.textContent = closeText;
                        floatingHint.style.borderColor = '#00ff00';
                        floatingHint.style.color = '#00ff00';
                        showStatus(closeText, 'info');
                        console.log('✅ 检测到张嘴');
                    } else if (isClosed && mouthOpened) {
                        clearInterval(checkInterval);
                        clearTimeout(timeout);
                        if (floatingHint) floatingHint.style.display = 'none';
                        showStatus('liveness_success', 'success');
                        resolve(true);
                    }
                }
            } catch (e) {
                console.error('张嘴检测错误:', e);
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

// ==================== 注册相关 ====================
function selectUser(user) {
    AppState.set('selectedUserId', user.id);
    
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('selected');
    });
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('selected');
    }
    
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) registerBtn.disabled = false;
    updateGlobalVars();
}

function resetRegistration() {
    AppState.set('selectedUserId', null);
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('selected');
    });
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) registerBtn.disabled = true;
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

    const video = document.getElementById('video');
    
    try {
        showStatus('register_sampling', 'info');
        
        const samples = [];
        let successCount = 0;
        
        for (let i = 0; i < REGISTER_SAMPLE_COUNT; i++) {
            showStatus(`${t('register_sampling_progress')} ${i + 1}/${REGISTER_SAMPLE_COUNT}...`, 'info');
            
            const detection = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (detection) {
                const normalizedFeatures = normalize(Array.from(detection.descriptor));
                normalizedFeatures._normalized = true;
                samples.push(normalizedFeatures);
                successCount++;
                console.log(`采样 ${i + 1} 成功`);
            } else {
                console.log(`采样 ${i + 1} 失败，未检测到人脸`);
            }
            
            if (i < REGISTER_SAMPLE_COUNT - 1) {
                await delay(REGISTER_SAMPLE_INTERVAL);
            }
        }
        
        if (samples.length === 0) {
            showStatus('register_no_face', 'error');
            return;
        }
        
        if (samples.length < 3) {
            showStatus(`${t('register_few_faces')} ${samples.length} ${t('register_few_faces_unit')}`, 'warning');
        }
        
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('face_features_array')
            .eq('id', selectedId)
            .single();
        
        if (fetchError) throw fetchError;
        
        let existingFeatures = user?.face_features_array || [];
        existingFeatures = existingFeatures.filter(f => f && f.length > 0);
        
        const MAX_FEATURES = 15;
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

        showStatus(`${t('register_success')} (${samples.length} ${t('register_faces')})`, 'success');
        await loadAllUsers();
        
        const registerBtn = document.getElementById('registerBtn');
        if (registerBtn) registerBtn.disabled = true;
        AppState.set('selectedUserId', null);
        stopCamera();

    } catch (error) {
        console.error('录入失败:', error);
        showStatus('register_error', 'error');
    }
}

// ==================== 考勤记录 ====================
async function record(actionType) {
    const currentUserData = AppState.get('currentUser');
    if (!currentUserData) {
        showStatus('hint_select_employee_first', 'error');
        return;
    }

    try {
        const { error } = await supabase
            .from('attendance_records')
            .insert([{
                user_id: currentUserData.id,
                username: currentUserData.username,
                user_type: currentUserData.user_type,
                action_type: actionType
            }]);

        if (error) throw error;

        const actionName = t(actionType) || actionType;
        showStatus(`${actionName}${t('record_success_suffix')}`, 'success');
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        
        const timeMap = {
            'check_in': 'checkInTime',
            'check_out': 'checkOutTime',
            'break_start': 'breakStartTime',
            'break_end': 'breakEndTime'
        };
        
        const timeElement = document.getElementById(timeMap[actionType]);
        if (timeElement) timeElement.textContent = timeStr;
        
        await loadTodayRecords(currentUserData.id);
        
        startAutoCloseTimer();

    } catch (error) {
        console.error('记录失败:', error);
        showStatus('record_failed', 'error');
    }
}

async function loadTodayRecords(userId) {
    try {
        const today = new Date().toISOString().split('T')[0];
        
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

        let html = '';
        
        const todayCount = document.getElementById('todayCount');
        if (todayCount) todayCount.textContent = data.length;
        
        data.forEach(record => {
            const time = new Date(record.action_time).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
            const actionName = t(record.action_type) || record.action_type;
            
            html += `
                <div class="record-item">
                    <span class="record-time">${time}</span>
                    <span class="record-type">${actionName}</span>
                </div>
            `;
        });
        
        recordsDiv.innerHTML = html;

    } catch (error) {
        console.error('加载记录失败:', error);
    }
}

// 修改后的 showStatus 函数 - 支持三语
function showStatus(messageKey, type, duration = null) {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    
    // 清除之前的定时器
    if (window.statusTimeout) {
        clearTimeout(window.statusTimeout);
    }
    
    // 获取翻译后的消息
    let message = messageKey;
    if (typeof messageKey === 'string' && messageKey.includes(' ')) {
        // 如果已经是完整消息，直接使用（兼容旧代码）
        message = messageKey;
    } else {
        // 尝试翻译
        const translated = t(messageKey);
        if (translated !== messageKey) {
            message = translated;
        }
    }
    
    statusDiv.style.display = 'block';
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
    
    // 根据消息类型设置不同的显示时间
    let displayDuration = duration;
    if (displayDuration === null) {
        if (type === 'error') {
            displayDuration = 5000;
        } else if (type === 'warning') {
            displayDuration = 4000;
        } else if (type === 'success') {
            displayDuration = 4000;
        } else {
            displayDuration = 4000;
        }
    }
    
    window.statusTimeout = setTimeout(() => {
        if (statusDiv && statusDiv.style) {
            statusDiv.style.display = 'none';
        }
        window.statusTimeout = null;
    }, displayDuration);
}

if (typeof window.showConfirm === 'undefined') {
    window.showConfirm = function(title, message) {
        return new Promise((resolve) => {
            const result = confirm(message);
            resolve(result);
        });
    };
}