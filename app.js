// app.js - 完整修复版
// 全局变量
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

var modelsLoaded = window.modelsLoaded;
var currentUser = window.currentUser;
var allUsers = window.allUsers;
var selectedUserId = window.selectedUserId;
var stream = window.stream;
var autoCloseTimer = window.autoCloseTimer;
var isCameraActive = window.isCameraActive;
var faceapiLoaded = window.faceapiLoaded;

function updateGlobalVars() {
    window.modelsLoaded = modelsLoaded;
    window.currentUser = currentUser;
    window.allUsers = allUsers;
    window.selectedUserId = selectedUserId;
    window.stream = stream;
    window.autoCloseTimer = autoCloseTimer;
    window.isCameraActive = isCameraActive;
    window.faceapiLoaded = faceapiLoaded;
}

// 检查 face-api
function checkFaceApi() {
    return typeof faceapi !== 'undefined' && faceapi !== null;
}

// 初始化
window.addEventListener('load', async function() {
    console.log('页面加载完成');
    
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLanguage);
    });

    if (!checkFaceApi()) {
        showStatus('FaceAPI加载失败', 'error');
        return;
    }

    await loadModels();
    await loadAllUsers();
    
    if (document.getElementById('userCard')) {
        document.getElementById('userCard').style.display = 'none';
    }
    
    // 录入页面自动开启摄像头
    if (window.location.pathname.includes('register.html')) {
        console.log('录入页面，自动开启摄像头');
        await startCamera();
    }
});

// 加载模型
async function loadModels() {
    try {
        showStatus('加载模型中...', 'info');
        console.log('开始加载模型');
        
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model/'),
            faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model/'),
            faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model/')
        ]);
        
        modelsLoaded = true;
        updateGlobalVars();
        console.log('模型加载成功');
        showStatus('模型加载成功', 'success');
        return true;
    } catch (error) {
        console.error('模型加载失败:', error);
        showStatus('模型加载失败', 'error');
        return false;
    }
}

// 启动摄像头
async function startCamera() {
    console.log('startCamera 被调用');
    const video = document.getElementById('video');
    if (!video) {
        console.log('video元素不存在');
        return false;
    }
    
    try {
        if (stream) {
            console.log('关闭现有摄像头');
            stopCamera();
        }
        
        console.log('请求摄像头权限');
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            } 
        });
        
        video.srcObject = stream;
        isCameraActive = true;
        console.log('摄像头已启动');
        
        // 显示摄像头容器
        const container = document.querySelector('.video-container');
        if (container) {
            container.style.display = 'block';
            console.log('显示摄像头容器');
        }
        
        // 等待视频准备就绪
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                console.log('视频元数据已加载');
                video.play();
            };
            video.onplay = () => {
                console.log('视频开始播放');
                resolve();
            };
        });
        
        // 开始实时检测
        console.log('调用 startLandmarkDetection');
        startLandmarkDetection();
        
        updateGlobalVars();
        return true;
    } catch (error) {
        console.error('摄像头启动失败:', error);
        showStatus('无法访问摄像头', 'error');
        return false;
    }
}

// 停止摄像头
function stopCamera() {
    console.log('停止摄像头');
    const video = document.getElementById('video');
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (video) {
        video.srcObject = null;
    }
    isCameraActive = false;
    
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
// 最终版：精确映射坐标（移动端适配）
function startLandmarkDetection() {
    if (!modelsLoaded || !checkFaceApi() || !isCameraActive) return;
    const video = document.getElementById('video');
    const canvas = document.getElementById('overlay');
    if (!video || !canvas) return;
    if (video.videoWidth === 0) { setTimeout(startLandmarkDetection, 100); return; }

    let lastWidth = 0, lastHeight = 0;

    async function detect() {
        if (!isCameraActive || video.paused || video.ended) {
            requestAnimationFrame(detect);
            return;
        }

        // 获取容器实际显示尺寸（CSS像素）
        const containerWidth = video.clientWidth;
        const containerHeight = video.clientHeight;

        // 若容器尺寸变化，重新设置画布
        if (lastWidth !== containerWidth || lastHeight !== containerHeight) {
            canvas.width = containerWidth;
            canvas.height = containerHeight;
            lastWidth = containerWidth;
            lastHeight = containerHeight;
        }

        const ctx = canvas.getContext('2d');
        const vw = video.videoWidth, vh = video.videoHeight;

        // 计算缩放比例（cover 效果：取较大的缩放系数）
        const scaleX = containerWidth / vw;
        const scaleY = containerHeight / vh;
        const scale = Math.max(scaleX, scaleY);

        // 缩放后的视频尺寸
        const scaledW = vw * scale;
        const scaledH = vh * scale;

        // 偏移量（居中裁剪）
        const offsetX = (containerWidth - scaledW) / 2;
        const offsetY = (containerHeight - scaledH) / 2;

        // 映射函数
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

                    // 绘制红色实线框
                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(tl.x, tl.y, w, h);

                    // 绘制白色虚线框
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.strokeRect(tl.x, tl.y, w, h);
                    ctx.setLineDash([]);

                    // 点的大小基于人脸框宽度
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
        requestAnimationFrame(detect);
    }
    detect();
}
// 检查是否已识别员工，然后记录打卡
function checkLoginThenRecord(actionType) {
    if (!currentUser) {
        showStatus('请先进行人脸识别', 'error');
        return;
    }
    record(actionType);
}

// 关闭登录模态框
function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

// 识别 - 修复版（等待视频稳定）
async function identify() {
    console.log('identify 被调用');
    
    if (!modelsLoaded) {
        showStatus('模型未加载完成', 'error');
        return;
    }
    
    if (!isCameraActive) {
        console.log('摄像头未启动，现在启动');
        await startCamera();
        
        // 等待视频稳定
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
    }
    
    // ========== 多动作活体检测 ==========
    const livenessPassed = await performLivenessCheck();
    if (!livenessPassed) {
        // 活体检测失败，停止摄像头并返回
        stopCamera();
        return;
    }
    // ==================================
    
    const video = document.getElementById('video');
    
    showStatus('识别中...', 'info');
    
    try {
        const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            showStatus('未检测到人脸', 'error');
            return;
        }

        const currentFeatures = Array.from(detection.descriptor);
        
        // 获取所有已注册的员工（多特征版本）
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, user_type, conges_payes, face_features_array')
            .eq('face_registered', true);
        
        if (error) throw error;
        
        let bestMatch = null;
        let highestSimilarity = 0;
        const threshold = 0.7;
        
        for (const user of users) {
            const featuresArray = user.face_features_array || [];
            if (featuresArray.length === 0) continue;
            
            let maxSimilarityForUser = 0;
            for (const storedFeatures of featuresArray) {
                const sim = cosineSimilarity(currentFeatures, storedFeatures);
                if (sim > maxSimilarityForUser) {
                    maxSimilarityForUser = sim;
                }
            }
            
            if (maxSimilarityForUser > highestSimilarity) {
                highestSimilarity = maxSimilarityForUser;
                bestMatch = user;
            }
        }
        
        if (bestMatch && highestSimilarity >= threshold) {
            currentUser = bestMatch;
            const userTypeLabel = window.USER_TYPE_LABELS?.[bestMatch.user_type] || bestMatch.user_type;
            
            document.getElementById('userCard').style.display = 'flex';
            document.getElementById('userName').textContent = bestMatch.username;
            document.getElementById('userType').textContent = userTypeLabel;
            document.getElementById('userConges').textContent = bestMatch.conges_payes;
            document.getElementById('userInitial').textContent = bestMatch.username.charAt(0).toUpperCase();
            
            showStatus(`识别成功！欢迎 ${bestMatch.username} (相似度: ${(highestSimilarity*100).toFixed(1)}%)`, 'success');
            
            document.querySelectorAll('.action-btn').forEach(btn => {
                btn.classList.remove('disabled');
            });
            
            await loadTodayRecords(bestMatch.id);
            
            stopCamera();
            startAutoCloseTimer();
            
        } else {
            showStatus('未识别到匹配的员工', 'error');
        }
        
    } catch (error) {
        console.error('识别失败:', error);
        showStatus('识别失败', 'error');
    }
    
    updateGlobalVars();
}
// 启动自动关闭定时器（5秒）
function startAutoCloseTimer() {
    if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
    }
    
    document.getElementById('autoCloseHint').style.display = 'block';
    
    autoCloseTimer = setTimeout(() => {
        document.getElementById('userCard').style.display = 'none';
        document.getElementById('recordsList').innerHTML = '<div class="empty">暂无打卡记录</div>';
        
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.add('disabled');
        });
        
        currentUser = null;
        
        document.getElementById('checkInTime').textContent = '';
        document.getElementById('checkOutTime').textContent = '';
        document.getElementById('breakStartTime').textContent = '';
        document.getElementById('breakEndTime').textContent = '';
        
        document.getElementById('autoCloseHint').style.display = 'none';
        
        showStatus('信息已自动关闭', 'info');
        
        autoCloseTimer = null;
        updateGlobalVars();
    }, 5000);
    
    updateGlobalVars();
}

// 加载所有员工
async function loadAllUsers() {
    try {
        if (!supabase) return [];
        
        const { data, error } = await supabase
            .from('users')
            .select('id, username, user_type, conges_payes, face_features_array, face_registered')
            .order('username');
        
        if (error) throw error;
        
        // 保持原有结构，但注意 face_features 字段可能已被替换
        allUsers = data.map(user => ({
            ...user,
            face_features: user.face_features_array?.[0] || null, // 兼容旧代码，取第一张
            face_features_array: user.face_features_array || []
        }));
        
        updateGlobalVars();
        updateStats();
        
        if (document.getElementById('userList')) {
            displayUserList(allUsers);
        }
        
        return allUsers;
    } catch (error) {
        console.error('加载员工失败:', error);
        return [];
    }
}
// 更新统计
function updateStats() {
    const totalEl = document.getElementById('totalCount');
    const registeredEl = document.getElementById('registeredCount');
    const unregisteredEl = document.getElementById('unregisteredCount');
    
    if (totalEl && registeredEl && unregisteredEl) {
        const total = allUsers.length;
        const registered = allUsers.filter(u => u.face_registered).length;
        const unregistered = total - registered;
        
        totalEl.textContent = total;
        registeredEl.textContent = registered;
        unregisteredEl.textContent = unregistered;
    }
}

// 过滤员工
function filterUsers() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const filtered = allUsers.filter(user => 
        user.username.toLowerCase().includes(searchTerm)
    );
    displayUserList(filtered);
}

// 显示员工列表
function displayUserList(users) {
    const userList = document.getElementById('userList');
    if (!userList) return;

    if (users.length === 0) {
        userList.innerHTML = '<div class="empty">暂无员工数据</div>';
        return;
    }

    userList.innerHTML = '';
    
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = `user-item ${user.face_registered ? 'registered' : 'unregistered'}`;
        div.onclick = () => selectUser(user);
        
        const status = user.face_registered ? '已录入' : '待录入';
        const faceCount = user.face_features_array?.length || 0;
        const userTypeLabel = window.USER_TYPE_LABELS?.[user.user_type] || user.user_type;
        
        div.innerHTML = `
            <div class="user-avatar-small">${user.username.charAt(0).toUpperCase()}</div>
            <div class="user-info">
                <div class="user-name">${user.username}</div>
                <div class="user-meta">${userTypeLabel} · 假期 ${user.conges_payes}天</div>
                ${faceCount > 0 ? `<div class="face-count">📸 ${faceCount}张人脸</div>` : ''}
            </div>
            <div class="user-status ${user.face_registered ? 'status-registered' : 'status-unregistered'}">${status}</div>
        `;
        
        userList.appendChild(div);
    });
}
// ==================== 多动作活体检测 ====================
// 随机选择一个动作（眨眼、摇头、张嘴）
function getRandomAction() {
    const actions = ['blink', 'shake', 'mouth'];
    const randomIndex = Math.floor(Math.random() * actions.length);
    return actions[randomIndex];
}

// 获取动作对应的提示文本键
function getActionTextKey(action) {
    const map = {
        'blink': 'liveness_blink',
        'shake': 'liveness_shake',
        'mouth': 'liveness_mouth'
    };
    return map[action];
}

// 眨眼检测
async function detectBlink(video, timeoutMs = 8000) {
    return new Promise((resolve) => {
        let blinkCount = 0;
        let eyesClosed = false;
        let interval = null;
        let timeout = null;
        
        interval = setInterval(async () => {
            if (!video || video.paused || video.ended) return;
            
            try {
                const detection = await faceapi
                    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks();
                
                if (!detection) return;
                
                const leftEye = detection.leftEyeOpenProbability;
                const rightEye = detection.rightEyeOpenProbability;
                const eyesOpen = (leftEye > 0.4 && rightEye > 0.4);
                
                if (!eyesOpen && !eyesClosed) {
                    eyesClosed = true;
                } else if (eyesOpen && eyesClosed) {
                    blinkCount++;
                    eyesClosed = false;
                    
                    if (blinkCount >= 2) {
                        clearInterval(interval);
                        clearTimeout(timeout);
                        resolve(true);
                    }
                }
            } catch (e) {
                console.error('眨眼检测错误:', e);
            }
        }, 100);
        
        timeout = setTimeout(() => {
            clearInterval(interval);
            resolve(false);
        }, timeoutMs);
    });
}

// 摇头检测（检测头部偏航角变化）
async function detectShake(video, timeoutMs = 8000) {
    return new Promise((resolve) => {
        let yawHistory = [];
        let shakesDetected = 0;
        let lastDirection = null;
        let interval = null;
        let timeout = null;
        
        interval = setInterval(async () => {
            if (!video || video.paused || video.ended) return;
            
            try {
                const detection = await faceapi
                    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks();
                
                if (!detection) return;
                
                // 获取头部偏航角（需要启用 faceLandmark68Net）
                const yaw = detection.headYaw || 0;
                yawHistory.push(yaw);
                if (yawHistory.length > 10) yawHistory.shift();
                
                if (yawHistory.length >= 5) {
                    const currentDirection = yaw > 15 ? 'right' : (yaw < -15 ? 'left' : 'center');
                    
                    if (currentDirection !== 'center' && currentDirection !== lastDirection) {
                        if (lastDirection !== null) {
                            shakesDetected++;
                            if (shakesDetected >= 2) {
                                clearInterval(interval);
                                clearTimeout(timeout);
                                resolve(true);
                            }
                        }
                        lastDirection = currentDirection;
                    } else if (currentDirection === 'center') {
                        // 允许重新检测方向变化
                        lastDirection = null;
                    }
                }
            } catch (e) {
                console.error('摇头检测错误:', e);
            }
        }, 150);
        
        timeout = setTimeout(() => {
            clearInterval(interval);
            resolve(false);
        }, timeoutMs);
    });
}

// 张嘴检测
async function detectMouth(video, timeoutMs = 8000) {
    return new Promise((resolve) => {
        let mouthOpened = false;
        let interval = null;
        let timeout = null;
        
        interval = setInterval(async () => {
            if (!video || video.paused || video.ended) return;
            
            try {
                const detection = await faceapi
                    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks();
                
                if (!detection) return;
                
                // 张嘴概率
                const mouthOpen = detection.mouthOpenProbability || 0;
                
                if (mouthOpen > 0.5 && !mouthOpened) {
                    mouthOpened = true;
                } else if (mouthOpen < 0.2 && mouthOpened) {
                    // 完成一次张嘴动作
                    clearInterval(interval);
                    clearTimeout(timeout);
                    resolve(true);
                }
            } catch (e) {
                console.error('张嘴检测错误:', e);
            }
        }, 100);
        
        timeout = setTimeout(() => {
            clearInterval(interval);
            resolve(false);
        }, timeoutMs);
    });
}
// 多语言张嘴检测
async function performLivenessCheck() {
    const video = document.getElementById('video');
    
    // 显示提示（使用多语言）
    const openText = t('open_mouth');
    showStatus(openText, 'info');
    
    // 创建悬浮提示
    let floatingHint = document.getElementById('floatingHint');
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
    }
    floatingHint.textContent = openText;
    floatingHint.style.display = 'block';
    
    return new Promise((resolve) => {
        let mouthOpened = false;
        let checkCount = 0;
        
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
                    
                    // 根据日志，闭嘴时约0.4，张嘴时约1.1
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
                        showStatus(t('liveness_success'), 'success');
                        resolve(true);
                    }
                }
                
                checkCount++;
                if (checkCount > 50) {
                    floatingHint.style.background = 'rgba(255,0,0,0.85)';
                    floatingHint.style.borderColor = '#ff0000';
                }
                
            } catch (e) {
                console.error('张嘴检测错误:', e);
            }
        }, 100);
        
        const timeout = setTimeout(() => {
            clearInterval(checkInterval);
            if (floatingHint) floatingHint.style.display = 'none';
            showStatus(t('liveness_timeout'), 'error');
            resolve(false);
        }, 10000);
    });
}
// 选择员工
function selectUser(user) {
    selectedUserId = user.id;
    
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    document.getElementById('registerBtn').disabled = false;
    updateGlobalVars();
}

// 重新录入
function resetRegistration() {
    selectedUserId = null;
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.getElementById('registerBtn').disabled = true;
}

async function registerFace() {
    if (!selectedUserId) {
        showStatus('请先选择员工', 'error');
        return;
    }
    
    if (!isCameraActive) {
        await startCamera();
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    const video = document.getElementById('video');
    
    try {
        const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            showStatus('未检测到人脸', 'error');
            return;
        }

        const newFeatures = Array.from(detection.descriptor);
        
        // 获取当前员工已有的特征数组
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('face_features_array')
            .eq('id', selectedUserId)
            .single();
        
        if (fetchError) throw fetchError;
        
        let existingFeatures = user?.face_features_array || [];
        
        // 限制最多存储 5 张（可根据需要调整）
        if (existingFeatures.length >= 5) {
            const confirm = await showConfirm('限制', '该员工已录入 5 张人脸，是否覆盖最早的一张？');
            if (confirm) {
                existingFeatures.shift(); // 移除最早的一张
            } else {
                return;
            }
        }
        
        existingFeatures.push(newFeatures);
        
        // 更新数据库
        const { error } = await supabase
            .from('users')
            .update({
                face_features_array: existingFeatures,
                face_registered: true
            })
            .eq('id', selectedUserId);

        if (error) throw error;

        showStatus('人脸录入成功', 'success');
        await loadAllUsers();
        document.getElementById('registerBtn').disabled = true;
        selectedUserId = null;
        stopCamera();

    } catch (error) {
        console.error('录入失败:', error);
        showStatus('录入失败', 'error');
    }
}

// 记录考勤
async function record(actionType) {
    if (!currentUser) {
        showStatus('请先进行人脸识别', 'error');
        return;
    }

    const actionNames = {
        'check_in': '上班打卡',
        'check_out': '下班打卡',
        'break_start': '休息开始',
        'break_end': '休息结束'
    };

    try {
        const { error } = await supabase
            .from('attendance_records')
            .insert([{
                user_id: currentUser.id,
                username: currentUser.username,
                user_type: currentUser.user_type,
                action_type: actionType
            }]);

        if (error) throw error;

        showStatus(actionNames[actionType] + '成功', 'success');
        
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
        
        await loadTodayRecords(currentUser.id);
        
        startAutoCloseTimer();

    } catch (error) {
        console.error('记录失败:', error);
        showStatus('记录失败', 'error');
    }
}

// 加载今日记录
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
            recordsDiv.innerHTML = '<div class="empty">今日暂无打卡记录</div>';
            document.getElementById('todayCount').textContent = '0';
            return;
        }

        let html = '';
        const typeNames = {
            'check_in': '上班打卡',
            'check_out': '下班打卡',
            'break_start': '休息开始',
            'break_end': '休息结束'
        };
        
        document.getElementById('todayCount').textContent = data.length;
        
        data.forEach(record => {
            const time = new Date(record.action_time).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            html += `
                <div class="record-item">
                    <span class="record-time">${time}</span>
                    <span class="record-type">${typeNames[record.action_type]}</span>
                </div>
            `;
        });
        
        recordsDiv.innerHTML = html;

    } catch (error) {
        console.error('加载记录失败:', error);
    }
}

// 计算余弦相似度
function cosineSimilarity(features1, features2) {
    try {
        let f1 = features1;
        let f2 = features2;
        
        if (typeof f1 === 'string') f1 = JSON.parse(f1);
        if (typeof f2 === 'string') f2 = JSON.parse(f2);
        
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < f1.length; i++) {
            dotProduct += f1[i] * f2[i];
            norm1 += f1[i] * f1[i];
            norm2 += f2[i] * f2[i];
        }
        
        if (norm1 === 0 || norm2 === 0) return 0;
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    } catch (error) {
        console.error('相似度计算错误:', error);
        return 0;
    }
}

// 工具函数
function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    
    statusDiv.style.display = 'block';
    statusDiv.className = `status ${type}`;
    statusDiv.textContent = message;
    
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 2000);
}