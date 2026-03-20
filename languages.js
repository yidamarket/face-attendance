// languages.js - 完整三语翻译版（法语、中文、英语）

if (typeof window.LANGUAGES === 'undefined') {
    window.LANGUAGES = {
        ZH: 'zh',
        FR: 'fr',
        EN: 'en'
    };
}

if (typeof window.currentLanguage === 'undefined') {
    window.currentLanguage = localStorage.getItem('language') || window.LANGUAGES.FR;
}

const LANGUAGES = window.LANGUAGES;
let currentLanguage = window.currentLanguage;

const translations = {
    // ==================== 法语 (FR) ====================
    fr: {
        // 通用
        app_name: 'Système de Pointage Facial',
        loading: 'Chargement...',
        success: 'Succès',
        error: 'Erreur',
        warning: 'Attention',
        info: 'Info',
        welcome: 'Bienvenue',
        detecting: 'Reconnaissance en cours...',
        reset: 'Réinitialiser',
        cancel: 'Annuler',
        confirm: 'Confirmer',
        save: 'Enregistrer',
        delete: 'Supprimer',
        edit: 'Modifier',
        search: 'Rechercher',
        back: 'Retour',
        next: 'Suivant',
        previous: 'Précédent',
        retrying: 'Nouvelle tentative...',
        confidence: 'Confiance',
        
        // 导航
        nav_attendance: 'Pointage',
        nav_register: 'Enregistrement',
        nav_logout: 'Déconnexion',
        nav_home: 'Accueil',
        nav_settings: 'Paramètres',
        
        // 登录相关
        login_title: 'Connexion Administrateur',
        login_subtitle: 'Veuillez saisir vos identifiants',
        username: "Nom d'utilisateur",
        password: 'Mot de passe',
        login_button: 'Se connecter',
        logging_in: 'Connexion...',
        login_success: 'Connecté avec succès',
        login_error: 'Nom d\'utilisateur ou mot de passe incorrect',
        no_account: 'Pas de compte ? Contactez l\'administrateur',
        remember_me: 'Se souvenir de moi',
        forgot_password: 'Mot de passe oublié ?',
        logout_confirm: 'Êtes-vous sûr de vouloir vous déconnecter ?',
        
        // 考勤打卡页面
        attendance_title: 'Pointage des Employés',
        attendance_subtitle: 'Cliquez pour la reconnaissance faciale',
        camera_preview: 'Aperçu Caméra',
        identify_button: 'Reconnaissance Faciale',
        identify_success: 'Reconnu',
        identify_failed: 'Échec de la reconnaissance',
        identify_retry: 'Nouvelle tentative de reconnaissance',
        identify_uncertain: 'Reconnaissance incertaine : trop de similitudes, assurez un bon éclairage',
        identify_low_confidence: 'Confiance insuffisante, ajustez l\'angle ou l\'éclairage',
        identify_error: 'Échec de reconnaissance, veuillez réessayer',
        current_employee: 'Employé actuel',
        remaining_leave: 'Congés restants',
        today_count: "Aujourd'hui",
        check_in: 'Arrivée',
        check_out: 'Départ',
        break_start: 'Début Pause',
        break_end: 'Fin Pause',
        today_records: 'Pointages du jour',
        no_records: 'Aucun pointage aujourd\'hui',
        record_success: 'Pointage enregistré',
        record_success_suffix: ' réussi',
        record_failed: 'Échec de l\'enregistrement',
        auto_close: 'Fermeture automatique dans 5s',
        auto_close_info: 'Informations automatiquement fermées',
        
        // 活体检测
        open_mouth: '👄 Ouvrez la bouche',
        close_mouth: '👄 Fermez la bouche',
        liveness_success: '✅ Détection de vivacité réussie',
        liveness_failed: '❌ Échec de la détection, veuillez réessayer',
        liveness_timeout: '⏰ Délai dépassé, veuillez réessayer',
        liveness_instruction: 'Suivez les instructions à l\'écran',
        
        // 员工录入页面
        register_title: 'Enregistrement Facial',
        register_subtitle: 'Administrateur · Enregistrer les visages',
        search_placeholder: 'Rechercher un employé...',
        total_employees: 'Total',
        registered: 'Enregistrés',
        unregistered: 'Non enregistrés',
        select_employee: 'Sélectionner',
        no_employee: 'Aucun employé',
        register_button: 'Enregistrer le visage',
        register_success: 'Visage enregistré avec succès',
        register_error: 'Échec de l\'enregistrement',
        register_sampling: 'Échantillonnage du visage, veuillez rester immobile...',
        register_sampling_progress: 'Échantillonnage',
        register_hold_still: 'Veuillez rester immobile',
        register_collected: 'échantillons collectés',
        register_no_face: 'Aucun visage détecté, veuillez réessayer',
        register_few_faces: 'Seulement',
        register_few_faces_unit: 'visages collectés, veuillez réessayer',
        register_faces: 'visages',
        face_hint: 'Assurez un bon éclairage, face à la caméra',
        face_count_unit: 'visages',
        days: 'jours',
        
        // 提示信息
        hint_select_employee: 'Veuillez sélectionner un employé',
        hint_select_employee_first: 'Veuillez d\'abord effectuer la reconnaissance faciale',
        hint_face_registered: 'Visage déjà enregistré',
        hint_face_updated: 'Visage mis à jour',
        hint_camera_starting: 'Démarrage de la caméra...',
        hint_processing: 'Traitement en cours...',
        
        // 用户类型
        admin: 'Administrateur',
        preparateur: 'Préparateur',
        chauffeur: 'Chauffeur',
        responsable: 'Responsable',
        manager: 'Manager',
        secretaire: 'Secrétaire Générale',
        employee: 'Employé',
        
        // 考勤状态
        status_normal: 'Normal',
        status_late: 'Retard',
        status_early_leave: 'Départ anticipé',
        status_absent: 'Absent',
        status_on_break: 'En pause',
        
        // 时间相关
        today: 'Aujourd\'hui',
        yesterday: 'Hier',
        this_week: 'Cette semaine',
        this_month: 'Ce mois-ci',
        custom_range: 'Période personnalisée',
        unknown_user: '❌ Inconnu ! Aucun employé correspondant trouvé, veuillez contacter l\'administrateur',
        no_face_detected: 'Aucun visage détecté, assurez-vous de faire face à la caméra',

        // 错误信息
        error_camera: 'Impossible d\'accéder à la caméra',
        error_model: 'Échec du chargement du modèle',
        error_face_detection: 'Aucun visage détecté',
        detect_failed_retry: 'Visage non détecté, nouvelle tentative...',
        error_face_match: 'Aucune correspondance trouvée',
        error_network: 'Erreur réseau, veuillez réessayer',
        error_database: 'Erreur de base de données',
        error_permission: 'Permission refusée',
        error_timeout: 'Délai d\'attente dépassé',
        no_registered_users: 'Aucun employé enregistré',
        no_valid_user_data: 'Impossible de correspondre : aucune donnée valide',
        
        // 单位
        times: 'fois'
    },
    
    // ==================== 中文 (ZH) ====================
    zh: {
        // 通用
        unknown_user: '❌ 陌生人！未识别到匹配的员工，请联系管理员录入人脸',
no_face_detected: '未检测到人脸，请确保面部正对摄像头',
        app_name: '人脸识别考勤系统',
        loading: '加载中...',
        success: '成功',
        error: '错误',
        warning: '警告',
        info: '提示',
        welcome: '欢迎回来',
        detecting: '识别中...',
        reset: '重新选择',
        cancel: '取消',
        confirm: '确认',
        save: '保存',
        delete: '删除',
        edit: '编辑',
        search: '搜索',
        back: '返回',
        next: '下一步',
        previous: '上一步',
        retrying: '重试中...',
        confidence: '置信度',
        
        // 导航
        nav_attendance: '考勤打卡',
        nav_register: '员工录入',
        nav_logout: '退出登录',
        nav_home: '首页',
        nav_settings: '设置',
        
        // 登录相关
        login_title: '管理员登录',
        login_subtitle: '请输入您的账号和密码',
        username: '用户名',
        password: '密码',
        login_button: '登 录',
        logging_in: '登录中...',
        login_success: '登录成功',
        login_error: '用户名或密码错误',
        no_account: '没有账号？请联系管理员',
        remember_me: '记住我',
        forgot_password: '忘记密码？',
        logout_confirm: '确定要退出登录吗？',
        
        // 考勤打卡页面
        attendance_title: '员工打卡',
        attendance_subtitle: '点击按钮进行人脸识别',
        camera_preview: '摄像头预览',
        identify_button: '开始人脸识别',
        identify_success: '识别成功',
        identify_failed: '识别失败',
        identify_retry: '正在重试识别',
        identify_uncertain: '识别不确定：与多人相似度过高，请确保光线充足并面对摄像头',
        identify_low_confidence: '识别置信度不足，请调整角度或光线重试',
        identify_error: '识别失败，请重试',
        current_employee: '当前员工',
        remaining_leave: '剩余假期',
        today_count: '今日打卡',
        check_in: '上班打卡',
        check_out: '下班打卡',
        break_start: '休息开始',
        break_end: '休息结束',
        today_records: '今日打卡记录',
        no_records: '今日暂无打卡记录',
        record_success: '打卡成功',
        record_success_suffix: '成功',
        record_failed: '打卡失败',
        auto_close: '信息将在5秒后自动关闭',
        auto_close_info: '信息已自动关闭',
        
        // 活体检测
        open_mouth: '👄 请张开嘴巴',
        close_mouth: '👄 请闭上嘴巴',
        liveness_success: '✅ 活体检测通过',
        liveness_failed: '❌ 活体检测失败，请重试',
        liveness_timeout: '⏰ 超时，请重试',
        liveness_instruction: '请按照屏幕提示操作',
        
        // 员工录入页面
        register_title: '人脸特征录入',
        register_subtitle: '管理员 · 为员工录入人脸特征',
        search_placeholder: '搜索员工姓名...',
        total_employees: '总员工',
        registered: '已录入',
        unregistered: '待录入',
        select_employee: '选择员工',
        no_employee: '暂无员工数据',
        register_button: '录入人脸',
        register_success: '录入成功',
        register_error: '录入失败',
        register_sampling: '正在采样人脸，请保持不动...',
        register_sampling_progress: '采样中',
        register_hold_still: '请保持不动',
        register_collected: '张采集完成',
        register_no_face: '未检测到人脸，请重试',
        register_few_faces: '仅采集到',
        register_few_faces_unit: '张人脸，建议重新录入',
        register_faces: '张',
        face_hint: '请确保光线充足，面部正对摄像头',
        face_count_unit: '张人脸',
        days: '天',
        
        // 提示信息
        hint_select_employee: '请先选择员工',
        hint_select_employee_first: '请先进行人脸识别',
        hint_face_registered: '人脸已录入',
        hint_face_updated: '人脸信息已更新',
        hint_camera_starting: '正在启动摄像头...',
        hint_processing: '处理中...',
        
        // 用户类型
        admin: '管理员',
        preparateur: '准备员',
        chauffeur: '司机',
        responsable: '负责人',
        manager: '经理',
        secretaire: '秘书长',
        employee: '员工',
        
        // 考勤状态
        status_normal: '正常',
        status_late: '迟到',
        status_early_leave: '早退',
        status_absent: '缺勤',
        status_on_break: '休息中',
        
        // 时间相关
        today: '今天',
        yesterday: '昨天',
        this_week: '本周',
        this_month: '本月',
        custom_range: '自定义时间',
        
        // 错误信息
        error_camera: '无法访问摄像头',
        error_model: '模型加载失败',
        error_face_detection: '未检测到人脸',
        detect_failed_retry: '未检测到人脸，重试中...',
        error_face_match: '未找到匹配的员工',
        error_network: '网络错误，请重试',
        error_database: '数据库错误',
        error_permission: '权限被拒绝',
        error_timeout: '操作超时',
        no_registered_users: '暂无已注册员工',
        no_valid_user_data: '无法匹配：无有效用户数据',
        
        // 单位
        times: '次'
    },
    
    // ==================== 英语 (EN) ====================
    en: {
        // 通用
        // 英语 en 中添加
unknown_user: '❌ Unknown! No matching employee found, please contact administrator',
no_face_detected: 'No face detected, please make sure you are facing the camera',
        app_name: 'Face Recognition Attendance System',
        loading: 'Loading...',
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        info: 'Info',
        welcome: 'Welcome Back',
        detecting: 'Recognizing...',
        reset: 'Reset',
        cancel: 'Cancel',
        confirm: 'Confirm',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        search: 'Search',
        back: 'Back',
        next: 'Next',
        previous: 'Previous',
        retrying: 'Retrying...',
        confidence: 'Confidence',
        
        // 导航
        nav_attendance: 'Attendance',
        nav_register: 'Register',
        nav_logout: 'Logout',
        nav_home: 'Home',
        nav_settings: 'Settings',
        
        // 登录相关
        login_title: 'Admin Login',
        login_subtitle: 'Please enter your credentials',
        username: 'Username',
        password: 'Password',
        login_button: 'Login',
        logging_in: 'Logging in...',
        login_success: 'Login successful',
        login_error: 'Invalid username or password',
        no_account: 'No account? Contact admin',
        remember_me: 'Remember me',
        forgot_password: 'Forgot password?',
        logout_confirm: 'Are you sure you want to logout?',
        
        // 考勤打卡页面
        attendance_title: 'Employee Attendance',
        attendance_subtitle: 'Click for face recognition',
        camera_preview: 'Camera Preview',
        identify_button: 'Start Recognition',
        identify_success: 'Welcome',
        identify_failed: 'Recognition failed',
        identify_retry: 'Retrying recognition',
        identify_uncertain: 'Recognition uncertain: too many similarities, ensure good lighting',
        identify_low_confidence: 'Low confidence, please adjust angle or lighting',
        identify_error: 'Recognition failed, please retry',
        current_employee: 'Current Employee',
        remaining_leave: 'Leave Days',
        today_count: 'Today',
        check_in: 'Check In',
        check_out: 'Check Out',
        break_start: 'Break Start',
        break_end: 'Break End',
        today_records: "Today's Records",
        no_records: 'No records today',
        record_success: 'Record saved',
        record_success_suffix: ' successful',
        record_failed: 'Failed to save record',
        auto_close: 'Auto close in 5s',
        auto_close_info: 'Information auto-closed',
        
        // 活体检测
        open_mouth: '👄 Please open your mouth',
        close_mouth: '👄 Please close your mouth',
        liveness_success: '✅ Liveness detection passed',
        liveness_failed: '❌ Liveness detection failed, please try again',
        liveness_timeout: '⏰ Timeout, please try again',
        liveness_instruction: 'Follow the on-screen instructions',
        
        // 员工录入页面
        register_title: 'Face Registration',
        register_subtitle: 'Admin · Register employee faces',
        search_placeholder: 'Search employee...',
        total_employees: 'Total',
        registered: 'Registered',
        unregistered: 'Unregistered',
        select_employee: 'Select',
        no_employee: 'No employees',
        register_button: 'Register Face',
        register_success: 'Face registered',
        register_error: 'Registration failed',
        register_sampling: 'Sampling face, please hold still...',
        register_sampling_progress: 'Sampling',
        register_hold_still: 'Please hold still',
        register_collected: 'samples collected',
        register_no_face: 'No face detected, please retry',
        register_few_faces: 'Only',
        register_few_faces_unit: 'faces collected, please retry',
        register_faces: 'faces',
        face_hint: 'Ensure good lighting, face the camera',
        face_count_unit: 'faces',
        days: 'days',
        
        // 提示信息
        hint_select_employee: 'Please select an employee',
        hint_select_employee_first: 'Please perform face recognition first',
        hint_face_registered: 'Face already registered',
        hint_face_updated: 'Face information updated',
        hint_camera_starting: 'Starting camera...',
        hint_processing: 'Processing...',
        
        // 用户类型
        admin: 'Administrator',
        preparateur: 'Preparer',
        chauffeur: 'Driver',
        responsable: 'Responsible',
        manager: 'Manager',
        secretaire: 'Secretary General',
        employee: 'Employee',
        
        // 考勤状态
        status_normal: 'Normal',
        status_late: 'Late',
        status_early_leave: 'Early Leave',
        status_absent: 'Absent',
        status_on_break: 'On Break',
        
        // 时间相关
        today: 'Today',
        yesterday: 'Yesterday',
        this_week: 'This Week',
        this_month: 'This Month',
        custom_range: 'Custom Range',
        
        // 错误信息
        error_camera: 'Cannot access camera',
        error_model: 'Model loading failed',
        error_face_detection: 'No face detected',
        detect_failed_retry: 'No face detected, retrying...',
        error_face_match: 'No matching employee found',
        error_network: 'Network error, please retry',
        error_database: 'Database error',
        error_permission: 'Permission denied',
        error_timeout: 'Operation timeout',
        no_registered_users: 'No registered employees',
        no_valid_user_data: 'Cannot match: no valid user data',
        
        // 单位
        times: 'times'
    }
};

// 翻译函数
function t(key) {
    // 优先使用当前语言
    if (translations[currentLanguage] && translations[currentLanguage][key] !== undefined) {
        return translations[currentLanguage][key];
    }
    // 回退到法语
    if (translations[LANGUAGES.FR] && translations[LANGUAGES.FR][key] !== undefined) {
        return translations[LANGUAGES.FR][key];
    }
    // 如果都没有，返回 key 本身并输出警告
    console.warn(`Missing translation for key: ${key}`);
    return key;
}

// 设置语言
function setLanguage(lang) {
    if (Object.values(LANGUAGES).includes(lang)) {
        currentLanguage = lang;
        window.currentLanguage = lang;
        localStorage.setItem('language', lang);
        updatePageLanguage();
        
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
        
        const event = new CustomEvent('languageChanged', { detail: { language: lang } });
        document.dispatchEvent(event);
    }
}

// 获取当前语言
function getCurrentLanguage() {
    return currentLanguage;
}

// 更新页面所有带 data-i18n 属性的元素
function updatePageLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = t(key);
        
        if (translation && translation !== key) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                if (element.getAttribute('type') !== 'button' && element.getAttribute('type') !== 'submit') {
                    element.placeholder = translation;
                } else {
                    element.value = translation;
                }
            } else if (element.tagName === 'BUTTON') {
                const icon = element.querySelector('span:first-child');
                if (icon && icon.textContent && icon.textContent.match(/[🔍📸↺✅🏠☕⚡🔒🚪💡👄]/)) {
                    const textSpan = element.querySelector('span:not(:first-child)');
                    if (textSpan) {
                        textSpan.textContent = translation;
                    } else {
                        element.innerHTML = `${icon.outerHTML} <span>${translation}</span>`;
                    }
                } else {
                    element.textContent = translation;
                }
            } else {
                element.textContent = translation;
            }
        }
    });
    
    document.title = t('app_name');
    console.log(`Language updated to: ${currentLanguage}`);
}

// 检查缺失翻译（仅在开发环境，不使用 process）
if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
    window.checkMissingTranslations = function() {
        const elements = document.querySelectorAll('[data-i18n]');
        const missing = [];
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (!translations[currentLanguage] || translations[currentLanguage][key] === undefined) {
                missing.push(key);
            }
        });
        if (missing.length) {
            console.warn('Missing translations:', [...new Set(missing)]);
        }
    };
}

// 页面加载时自动更新语言
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        updatePageLanguage();
        if (typeof window.checkMissingTranslations === 'function') {
            setTimeout(() => window.checkMissingTranslations(), 1000);
        }
    });
}

// 导出（兼容不同模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { translations, t, setLanguage, getCurrentLanguage, updatePageLanguage };
}