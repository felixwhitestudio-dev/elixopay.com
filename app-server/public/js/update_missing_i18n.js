const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'i18n.js');
let content = fs.readFileSync(filePath, 'utf8');

const thKeys = `
      // Missing Sidebars
      'sidebar.main': 'หลัก',
      'sidebar.developer': 'นักพัฒนา',
      'sidebar.partner': 'พาร์ทเนอร์',
      'sidebar.account': 'บัญชี',
      'sidebar.profile': 'โปรไฟล์',
      'sidebar.kyc': 'ยืนยันตัวตน (KYC)',
      'sidebar.dark_mode': 'โหมดมืด',
      'nav.billing': 'การเรียกเก็บเงิน',
      'nav.settlement': 'การชำระเงิน',
      'nav.webhooks': 'Webhooks',
      'nav.partner': 'ศูนย์พาร์ทเนอร์',
      'nav.settings': 'การตั้งค่า',
      'nav.signout': 'ออกจากระบบ',
      
      // Missing Admin
      'admin.sidebar.overview': 'ภาพรวม',
      'admin.sidebar.finance': 'การเงิน',
      'admin.sidebar.quick_links': 'ลิงก์ด่วน',
      'admin.sidebar.dashboard': 'แดชบอร์ด',
      'admin.pending.title': 'คำขอ KYC',
      'admin.sidebar.payouts': 'การถอนเงิน',
      'admin.sidebar.liquidity': 'สภาพคล่อง',
      'admin.sidebar.goHome': 'กลับหน้าหลัก',
      
      // Missing Bank Card
      'dashboard.bank.title': 'บัญชีธนาคาร',
      'dashboard.bank.loading': 'กำลังโหลดข้อมูลบัญชี...',
      'dashboard.bank.not_set': 'ยังไม่ได้เชื่อมโยงบัญชีธนาคาร เพิ่มบัญชีเพื่อรับเงิน',
      'dashboard.bank.add_btn': 'เพิ่มบัญชีธนาคาร',
      'dashboard.bank.bank_name': 'ธนาคาร',
      'dashboard.bank.account_number': 'เลขที่บัญชี',
      'dashboard.bank.account_name': 'ชื่อบัญชี',
      'dashboard.bank.pending_notice': 'คำขอเปลี่ยนบัญชีธนาคารกำลังรอการตรวจสอบ',
      'dashboard.bank.change_btn': 'ขอเปลี่ยนบัญชี',
      
      'dashboard.actions.settlement': 'การชำระเงิน',
`;

const enKeys = `
      // Missing Sidebars
      'sidebar.main': 'MAIN',
      'sidebar.developer': 'DEVELOPER',
      'sidebar.partner': 'PARTNER',
      'sidebar.account': 'ACCOUNT',
      'sidebar.profile': 'Profile',
      'sidebar.kyc': 'KYC Verification',
      'sidebar.dark_mode': 'Dark Mode',
      'nav.billing': 'Billing',
      'nav.settlement': 'Settlement',
      'nav.webhooks': 'Webhooks',
      'nav.partner': 'Partner Hub',
      'nav.settings': 'Settings',
      'nav.signout': 'Sign Out',
      
      // Missing Admin
      'admin.sidebar.overview': 'OVERVIEW',
      'admin.sidebar.finance': 'FINANCE',
      'admin.sidebar.quick_links': 'QUICK LINKS',
      'admin.sidebar.dashboard': 'Dashboard',
      'admin.pending.title': 'KYC Applications',
      'admin.sidebar.payouts': 'Payouts',
      'admin.sidebar.liquidity': 'Liquidity',
      'admin.sidebar.goHome': 'Merchant View',
      
      // Missing Bank Card
      'dashboard.bank.title': 'Bank Account',
      'dashboard.bank.loading': 'Loading account data...',
      'dashboard.bank.not_set': 'No bank account linked. Add an account to receive payouts.',
      'dashboard.bank.add_btn': 'Add Bank Account',
      'dashboard.bank.bank_name': 'Bank',
      'dashboard.bank.account_number': 'Account Number',
      'dashboard.bank.account_name': 'Account Name',
      'dashboard.bank.pending_notice': 'A bank account change request is pending admin review.',
      'dashboard.bank.change_btn': 'Request Bank Change',
      
      'dashboard.actions.settlement': 'Settlement',
`;

const zhKeys = `
      // Missing Sidebars
      'sidebar.main': '主要功能',
      'sidebar.developer': '开发者',
      'sidebar.partner': '合作伙伴',
      'sidebar.account': '账户管理',
      'sidebar.profile': '个人资料',
      'sidebar.kyc': 'KYC 身份验证',
      'sidebar.dark_mode': '深色模式',
      'nav.billing': '账单管理',
      'nav.settlement': '结算',
      'nav.webhooks': 'Webhooks',
      'nav.partner': '合作伙伴中心',
      'nav.settings': '设置',
      'nav.signout': '退出登录',
      
      // Missing Admin
      'admin.sidebar.overview': '系统概览',
      'admin.sidebar.finance': '财务管理',
      'admin.sidebar.quick_links': '快捷链接',
      'admin.sidebar.dashboard': '仪表盘',
      'admin.pending.title': 'KYC 申请审核',
      'admin.sidebar.payouts': '提现管理',
      'admin.sidebar.liquidity': '流动性池',
      'admin.sidebar.goHome': '商户视图',
      
      // Missing Bank Card
      'dashboard.bank.title': '银行账户',
      'dashboard.bank.loading': '正在加载账户数据...',
      'dashboard.bank.not_set': '未绑定银行账户，请添加账户以接收打款。',
      'dashboard.bank.add_btn': '添加银行账户',
      'dashboard.bank.bank_name': '银行名称',
      'dashboard.bank.account_number': '银行账号',
      'dashboard.bank.account_name': '账户名称',
      'dashboard.bank.pending_notice': '银行账户更改请求正在等待管理员审核。',
      'dashboard.bank.change_btn': '请求更改银行账户',
      
      'dashboard.actions.settlement': '结算',
`;

content = content.replace(/(th:\s*\{)/, "$1\n" + thKeys);
content = content.replace(/(en:\s*\{)/, "$1\n" + enKeys);
content = content.replace(/(zh:\s*\{)/, "$1\n" + zhKeys);

fs.writeFileSync(filePath, content);
console.log('Missing keys injected into th, en, zh dictionaries.');
