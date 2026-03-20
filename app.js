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

// 关键点检测 - 精确映射版（修复移动端偏移）
function startLandmarkDetection() {
    console.log('startLandmarkDetection 开始执行');
    
    if (!modelsLoaded || !checkFaceApi() || !isCameraActive) {
        console.log('条件不满足，退出');
        return;
    }
    
    const video = document.getElementById('video');
    const canvas = document.getElementById('overlay');
    
    if (!video || !canvas) {
        console.log('video或canvas不存在');
        return;
    }
    
    if (video.videoWidth === 0) {
        setTimeout(startLandmarkDetection, 100);
        return;
    }
    
    // 获取容器实际显示尺寸
    const containerRect = video.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // 设置画布尺寸与容器一致（用于绘制）
    canvas.width = containerWidth;
    canvas.height = containerHeight;
    
    const ctx = canvas.getContext('2d');
    
    // 计算视频在容器中的实际显示区域（考虑 object-fit: cover）
    const videoAspect = video.videoWidth / video.videoHeight;
    const containerAspect = containerWidth / containerHeight;
    
    let displayWidth, displayHeight, offsetX, offsetY;
    
    if (videoAspect > containerAspect) {
        // 视频更宽，宽度填满容器，高度被裁剪
        displayWidth = containerWidth;
        displayHeight = containerWidth / videoAspect;
        offsetX = 0;
        offsetY = (containerHeight - displayHeight) / 2;
    } else {
        // 视频更高，高度填满容器，宽度被裁剪
        displayWidth = containerHeight * videoAspect;
        displayHeight = containerHeight;
        offsetX = (containerWidth - displayWidth) / 2;
        offsetY = 0;
    }
    
    console.log(`视频原始: ${video.videoWidth}x${video.videoHeight}, 容器: ${containerWidth}x${containerHeight}, 显示区域: ${displayWidth}x${displayHeight}, 偏移: (${offsetX},${offsetY})`);
    
    // 映射函数
    function mapToCanvas(x, y) {
        const mappedX = offsetX + (x / video.videoWidth) * displayWidth;
        const mappedY = offsetY + (y / video.videoHeight) * displayHeight;
        return { x: mappedX, y: mappedY };
    }
    
    async function detect() {
        if (!isCameraActive || !video || video.paused || video.ended) {
            requestAnimationFrame(detect);
            return;
        }
        
        try {
            const detections = await faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks();
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (detections.length > 0) {
                detections.forEach((detection) => {
                    const box = detection.detection.box;
                    const points = detection.landmarks.positions;
                    
                    // 映射人脸框
                    const topLeft = mapToCanvas(box.x, box.y);
                    const bottomRight = mapToCanvas(box.x + box.width, box.y + box.height);
                    const mappedWidth = bottomRight.x - topLeft.x;
                    const mappedHeight = bottomRight.y - topLeft.y;
                    
                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 5;
                    ctx.strokeRect(topLeft.x, topLeft.y, mappedWidth, mappedHeight);
                    
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.strokeRect(topLeft.x, topLeft.y, mappedWidth, mappedHeight);
                    ctx.setLineDash([]);
                    
                    // 动态点大小
                    const pointSize = Math.max(3, containerWidth / 120);
                    
                    points.forEach(point => {
                        const mapped = mapToCanvas(point.x, point.y);
                        
                        ctx.fillStyle = '#00ff00';
                        ctx.shadowColor = '#00ff00';
                        ctx.shadowBlur = 10;
                        ctx.beginPath();
                        ctx.arc(mapped.x, mapped.y, pointSize, 0, 2 * Math.PI);
                        ctx.fill();
                        
                        ctx.shadowBlur = 0;
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    });
                    
                    ctx.shadowBlur = 0;
                });
            }
            
            requestAnimationFrame(detect);
            
        } catch (error) {
            console.error('检测错误:', error);
            requestAnimationFrame(detect);
        }
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
        
        // 等待视频真正就绪（有有效尺寸并稳定一帧）
        const video = document.getElementById('video');
        await new Promise((resolve) => {
            const checkReady = () => {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    // 再等待两帧确保图像稳定
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            setTimeout(resolve, 100); // 额外延迟
                        });
                    });
                } else {
                    requestAnimationFrame(checkReady);
                }
            };
            checkReady();
        });
    }
    
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

        const features = Array.from(detection.descriptor);
        const registeredUsers = allUsers.filter(u => u.face_registered && u.face_features);
        
        let bestMatch = null;
        let highestSimilarity = 0;
        const threshold = 0.6;
        
        for (const user of registeredUsers) {
            const similarity = cosineSimilarity(features, user.face_features);
            if (similarity > highestSimilarity) {
                highestSimilarity = similarity;
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
            
            showStatus(`识别成功！欢迎 ${bestMatch.username}`, 'success');
            
            // 启用打卡按钮
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
            .select('id, username, user_type, conges_payes, face_features, face_registered')
            .order('username');
        
        if (error) throw error;
        
        allUsers = data || [];
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
        const userTypeLabel = window.USER_TYPE_LABELS?.[user.user_type] || user.user_type;
        
        div.innerHTML = `
            <div class="user-avatar-small">${user.username.charAt(0).toUpperCase()}</div>
            <div class="user-info">
                <div class="user-name">${user.username}</div>
                <div class="user-meta">${userTypeLabel} · 假期 ${user.conges_payes}天</div>
            </div>
            <div class="user-status ${user.face_registered ? 'status-registered' : 'status-unregistered'}">${status}</div>
        `;
        
        userList.appendChild(div);
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

// 录入人脸
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

        const features = Array.from(detection.descriptor);

        const { error } = await supabase
            .from('users')
            .update({
                face_features: features,
                face_registered: true
            })
            .eq('id', selectedUserId);

        if (error) throw error;

        showStatus('录入成功', 'success');
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