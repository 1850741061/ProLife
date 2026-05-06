// 应用常量和配置

const colors = [
    '#ef4444', '#f59e0b', '#eab308', '#84cc16', '#10b981',
    '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#fb7185',
    '#fbbf24', '#f97316', '#dc2626', '#6b7280', '#475569'
];

const pMap = { low: '低', medium: '中', high: '高' };

const defaultFinanceCats = {
    expense: [
        { name: '餐饮', color: '#ff9f43', icon: 'fa-utensils' },
        { name: '交通', color: '#3b82f6', icon: 'fa-car' },
        { name: '购物', color: '#ec4899', icon: 'fa-shopping-bag' },
        { name: '娱乐', color: '#8b5cf6', icon: 'fa-gamepad' },
        { name: '居住', color: '#10b981', icon: 'fa-home' },
        { name: '医疗', color: '#ef4444', icon: 'fa-heartbeat' },
        { name: '教育', color: '#f59e0b', icon: 'fa-graduation-cap' },
        { name: '美容', color: '#ec4899', icon: 'fa-spa' },
        { name: '宠物', color: '#f97316', icon: 'fa-paw' },
        { name: '数码', color: '#6366f1', icon: 'fa-mobile-alt' },
        { name: '旅游', color: '#14b8a6', icon: 'fa-plane' },
        { name: '人情', color: '#eab308', icon: 'fa-gift' },
        { name: '投资', color: '#22c55e', icon: 'fa-chart-line' },
        { name: '通讯', color: '#06b6d4', icon: 'fa-phone' },
        { name: '奶茶', color: '#ec4899', icon: 'fa-mug-hot' },
        { name: '咖啡', color: '#8b6914', icon: 'fa-coffee' },
        { name: '其他', color: '#6b7280', icon: 'fa-ellipsis-h' }
    ],
    income: [
        { name: '工资', color: '#10b981', icon: 'fa-money-bill-wave' },
        { name: '奖金', color: '#f59e0b', icon: 'fa-trophy' },
        { name: '兼职', color: '#8b5cf6', icon: 'fa-briefcase' },
        { name: '投资收益', color: '#22c55e', icon: 'fa-chart-pie' },
        { name: '红包/礼金', color: '#ec4899', icon: 'fa-red-envelope' },
        { name: '其他收入', color: '#6b7280', icon: 'fa-ellipsis-h' }
    ]
};

const SUPABASE_URL = 'https://gcrdheovyzjywwyijjli.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcmRoZW92eXpqeXd3eWlqamxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NzQxMDIsImV4cCI6MjA4MjE1MDEwMn0.7bhn24n_-HMPbN_IeTb6cZNrzH3-GFkKtxv0imkOSBM';

const THEME_STYLE_META = {
    'pop-art': { label: '波普风', modeLabels: { light: '亮色模式', dark: '暗色模式' }, paletteTitle: '切换风格（当前：波普风）' },
    'pixel-art': { label: '像素风', modeLabels: { light: '像素亮色', dark: '像素暗色' }, paletteTitle: '切换风格（当前：像素风）' },
    'art-nouveau': { label: '新艺术', modeLabels: { light: '新艺术亮色', dark: '新艺术暗色' }, paletteTitle: '切换风格（当前：新艺术）' },
    'ink-wash': { label: '水墨风', modeLabels: { light: '水墨亮色', dark: '水墨暗色' }, paletteTitle: '切换风格（当前：水墨风）' },
    'swiss': { label: '瑞士风', modeLabels: { light: '瑞士亮色', dark: '瑞士暗色' }, paletteTitle: '切换风格（当前：瑞士风）' },
    'vaporwave': { label: '蒸汽波', modeLabels: { light: '蒸汽亮色', dark: '蒸汽暗色' }, paletteTitle: '切换风格（当前：蒸汽波）' },
    'brutalist': { label: '粗野风', modeLabels: { light: '粗野亮色', dark: '粗野暗色' }, paletteTitle: '切换风格（当前：粗野风）' }
};

const WIDGET_WIDTH = 400;
const WIDGET_HEIGHT = 700;
