// config.js - 修改版（只使用sessionStorage）
if (typeof window.SUPABASE_URL === 'undefined') {
    window.SUPABASE_URL = 'https://maxjuexqflwsnucqvkdf.supabase.co';
    window.SUPABASE_KEY = 'sb_publishable_Skv1pqDmPG40gYFIDuQoGA_EUhMzXwV';
    window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    window.USER_TYPES = {
        ADMIN: 'admin',
        PREPARATEUR: 'preparateur',
        CHAUFFEUR: 'chauffeur',
        RESPONSABLE: 'responsable',
        MANAGER: 'manager',
        SECRETAIRE: 'secretaire'
    };

    window.USER_TYPE_LABELS = {
        'admin': 'Administrateur',
        'preparateur': 'Préparateur',
        'chauffeur': 'Chauffeur',
        'responsable': 'Responsable',
        'manager': 'Manager',
        'secretaire': 'Secrétaire générale'
    };

    // 只使用sessionStorage
    window.saveSession = function(user) {
        const session = {
            id: user.id,
            username: user.username,
            userType: user.user_type
        };
        sessionStorage.setItem('session', JSON.stringify(session));
        return session;
    };

    window.loadSession = function() {
        const data = sessionStorage.getItem('session');
        return data ? JSON.parse(data) : null;
    };

    window.clearSession = function() {
        sessionStorage.removeItem('session');
    };

    window.logout = function() {
        clearSession();
        window.location.href = 'index.html';
    };
}