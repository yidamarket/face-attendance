// languages.js - 专业翻译版（默认法语）
if (typeof window.LANGUAGES === 'undefined') {
    window.LANGUAGES = {
        ZH: 'zh',
        FR: 'fr',
        EN: 'en'
    };
}

if (typeof window.currentLanguage === 'undefined') {
    // 默认法语
    window.currentLanguage = localStorage.getItem('language') || window.LANGUAGES.FR;
}

const LANGUAGES = window.LANGUAGES;
let currentLanguage = window.currentLanguage;

const translations = {
    // 法语 - 默认语言
    fr: {
        app_name: 'Système de Pointage Facial',
        loading: 'Chargement...',
        success: 'Succès',
        error: 'Erreur',
        info: 'Info',
        welcome: 'Bienvenue',
        detecting: 'Détection faciale...',
        reset: 'Réinitialiser',
        
        nav_attendance: 'Pointage',
        nav_register: 'Enregistrement',
        nav_logout: 'Déconnexion',
        
        login_title: 'Connexion Administrateur',
        login_subtitle: 'Veuillez saisir vos identifiants',
        username: "Nom d'utilisateur",
        password: 'Mot de passe',
        login_button: 'Se connecter',
        logging_in: 'Connexion...',
        login_success: 'Connecté avec succès',
        login_error: 'Nom d\'utilisateur ou mot de passe incorrect',
        no_account: 'Pas de compte ? Contactez l\'administrateur',
        
        attendance_title: 'Pointage des Employés',
        attendance_subtitle: 'Cliquez pour la reconnaissance faciale',
        camera_preview: 'Aperçu Caméra',
        identify_button: 'Reconnaissance Faciale',
        identify_success: 'Reconnu, bienvenue',
        identify_failed: 'Échec de la reconnaissance',
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
        auto_close: 'Fermeture automatique dans 5s',
        cancel: 'Annuler',
        
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
        face_hint: 'Assurez un bon éclairage, face à la caméra',
        
        status_normal: 'Normal',
        status_late: 'Retard',
        status_early_leave: 'Départ anticipé',
        
        admin: 'Administrateur',
        preparateur: 'Préparateur',
        chauffeur: 'Chauffeur',
        responsable: 'Responsable',
        manager: 'Manager',
        secretaire: 'Secrétaire',
        // 在 fr 中添加
        remember_me: 'Se souvenir de moi'
    },
    
    // 中文
    zh: {
        app_name: '人脸识别考勤系统',
        loading: '加载中...',
        success: '成功',
        error: '错误',
        info: '提示',
        welcome: '欢迎回来',
        detecting: '人脸检测中...',
        reset: '重新选择',
        
        nav_attendance: '考勤打卡',
        nav_register: '员工录入',
        nav_logout: '退出登录',
        
        login_title: '管理员登录',
        login_subtitle: '请输入您的账号和密码',
        username: '用户名',
        password: '密码',
        login_button: '登 录',
        logging_in: '登录中...',
        login_success: '登录成功',
        login_error: '用户名或密码错误',
        no_account: '没有账号？请联系管理员',
        
        attendance_title: '员工打卡',
        attendance_subtitle: '点击按钮进行人脸识别',
        camera_preview: '摄像头预览',
        identify_button: '开始人脸识别',
        identify_success: '识别成功，欢迎您',
        identify_failed: '识别失败，请重试',
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
        auto_close: '信息将在5秒后自动关闭',
        cancel: '取 消',
        
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
        face_hint: '请确保光线充足，面部正对摄像头',
        remember_me: '记住我',
        status_normal: '正常',
        status_late: '迟到',
        status_early_leave: '早退',
        
        admin: '管理员',
        preparateur: '准备员',
        chauffeur: '司机',
        responsable: '负责人',
        manager: '经理',
        secretaire: '秘书'
    },
    
    // 英语
    en: {
        app_name: 'Face Recognition System',
        loading: 'Loading...',
        success: 'Success',
        error: 'Error',
        info: 'Info',
        welcome: 'Welcome',
        detecting: 'Face detection...',
        reset: 'Reset',
        remember_me: 'Remember me',
        nav_attendance: 'Attendance',
        nav_register: 'Registration',
        nav_logout: 'Logout',
        
        login_title: 'Admin Login',
        login_subtitle: 'Please enter your credentials',
        username: 'Username',
        password: 'Password',
        login_button: 'Login',
        logging_in: 'Logging in...',
        login_success: 'Login successful',
        login_error: 'Invalid username or password',
        no_account: 'No account? Contact admin',
        
        attendance_title: 'Employee Attendance',
        attendance_subtitle: 'Click for face recognition',
        camera_preview: 'Camera Preview',
        identify_button: 'Start Recognition',
        identify_success: 'Welcome',
        identify_failed: 'Recognition failed',
        current_employee: 'Current Employee',
        remaining_leave: 'Leave Days',
        today_count: 'Today',
        check_in: 'Check In',
        check_out: 'Check Out',
        break_start: 'Break Start',
        break_end: 'Break End',
        today_records: 'Today\'s Records',
        no_records: 'No records today',
        record_success: 'Record saved',
        auto_close: 'Auto close in 5s',
        cancel: 'Cancel',
        
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
        face_hint: 'Ensure good lighting, face the camera',
        
        status_normal: 'Normal',
        status_late: 'Late',
        status_early_leave: 'Early Leave',
        
        admin: 'Admin',
        preparateur: 'Preparer',
        chauffeur: 'Driver',
        responsable: 'Responsible',
        manager: 'Manager',
        secretaire: 'Secretary'
    }
};

function t(key) {
    return translations[currentLanguage]?.[key] || translations[LANGUAGES.FR]?.[key] || key;
}

function setLanguage(lang) {
    if (Object.values(LANGUAGES).includes(lang)) {
        currentLanguage = lang;
        window.currentLanguage = lang;
        localStorage.setItem('language', lang);
        updatePageLanguage();
        
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
    }
}

function updatePageLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.placeholder = t(key);
        } else {
            element.textContent = t(key);
        }
    });
    document.title = t('app_name');
}

document.addEventListener('DOMContentLoaded', updatePageLanguage);