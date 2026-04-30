const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'i18n.js');
let content = fs.readFileSync(filePath, 'utf8');

const thKeys = `
      'admin.bank.currentAccount': 'บัญชีปัจจุบัน',
      'admin.bank.reason': 'เหตุผล',
      'admin.bank.requestedAccount': 'บัญชีที่ขอเปลี่ยน',
      'admin.bank.title': 'คำร้องขอเปลี่ยนบัญชีธนาคาร',
      'admin.chart.newUsers': 'ผู้ใช้ใหม่ (7 วันที่ผ่านมา)',
      'admin.common.action': 'การจัดการ',
      'admin.common.date': 'วันที่',
      'admin.common.email': 'อีเมล',
      'admin.common.exportCsv': 'ส่งออก CSV',
      'admin.common.loading': 'กำลังโหลด...',
      'admin.common.refresh': 'รีเฟรช',
      'admin.common.status': 'สถานะ',
      'admin.common.user': 'ผู้ใช้',
      'admin.dashboard.pending_kyc': 'รอตรวจสอบ KYC',
      'admin.dashboard.total_users': 'ผู้ใช้ทั้งหมด',
      'admin.overview.title': 'ภาพรวมระบบ (Admin)',
      'admin.review.approve': 'อนุมัติ',
      'admin.review.reject': 'ปฏิเสธ',
      'admin.review.title': 'ตรวจสอบข้อมูล',
      'admin.review.rejectReasonPh': 'ระบุเหตุผลที่ปฏิเสธ (จำเป็น)',
      'admin.stat.awaitingVerification': 'รอการยืนยันตัวตน',
      'admin.stat.completedVolume': 'ยอดที่ดำเนินการแล้ว (THB)',
      'admin.stat.liquidityPool': 'สภาพคล่องในระบบ',
      'admin.stat.registeredAccounts': 'บัญชีที่ลงทะเบียนทั้งหมด',
      'admin.stat.systemUsdt': 'USDT ในระบบ',
      'admin.stat.totalWithdrawals': 'ยอดถอนเงินรวม',
      'admin.verification.title': 'รอการตรวจสอบยืนยันตัวตน',
`;

const enKeys = `
      'admin.bank.currentAccount': 'Current Account',
      'admin.bank.reason': 'Reason',
      'admin.bank.requestedAccount': 'Requested Account',
      'admin.bank.title': 'Bank Account Change Requests',
      'admin.chart.newUsers': 'New Users (Last 7 Days)',
      'admin.common.action': 'Action',
      'admin.common.date': 'Date',
      'admin.common.email': 'Email',
      'admin.common.exportCsv': 'Export CSV',
      'admin.common.loading': 'Loading...',
      'admin.common.refresh': 'Refresh',
      'admin.common.status': 'Status',
      'admin.common.user': 'User',
      'admin.dashboard.pending_kyc': 'Pending KYC',
      'admin.dashboard.total_users': 'Total Users',
      'admin.overview.title': 'Admin Overview',
      'admin.review.approve': 'Approve',
      'admin.review.reject': 'Reject',
      'admin.review.title': 'Review Application',
      'admin.review.rejectReasonPh': 'Reason for rejection (required if rejecting)',
      'admin.stat.awaitingVerification': 'Awaiting Verification',
      'admin.stat.completedVolume': 'Completed Volume (THB)',
      'admin.stat.liquidityPool': 'Liquidity Pool',
      'admin.stat.registeredAccounts': 'Registered Accounts',
      'admin.stat.systemUsdt': 'System USDT',
      'admin.stat.totalWithdrawals': 'Total Withdrawals',
      'admin.verification.title': 'Pending Verifications',
`;

const zhKeys = `
      'admin.bank.currentAccount': '当前账户',
      'admin.bank.reason': '原因',
      'admin.bank.requestedAccount': '请求更改的账户',
      'admin.bank.title': '银行账户更改请求',
      'admin.chart.newUsers': '新用户（过去7天）',
      'admin.common.action': '操作',
      'admin.common.date': '日期',
      'admin.common.email': '电子邮箱',
      'admin.common.exportCsv': '导出 CSV',
      'admin.common.loading': '加载中...',
      'admin.common.refresh': '刷新',
      'admin.common.status': '状态',
      'admin.common.user': '用户',
      'admin.dashboard.pending_kyc': '待处理的 KYC',
      'admin.dashboard.total_users': '总用户数',
      'admin.overview.title': '管理员概览',
      'admin.review.approve': '批准',
      'admin.review.reject': '拒绝',
      'admin.review.title': '审核申请',
      'admin.review.rejectReasonPh': '拒绝原因（如果拒绝则是必填项）',
      'admin.stat.awaitingVerification': '等待验证',
      'admin.stat.completedVolume': '已完成金额 (THB)',
      'admin.stat.liquidityPool': '流动性池',
      'admin.stat.registeredAccounts': '已注册账户',
      'admin.stat.systemUsdt': '系统 USDT',
      'admin.stat.totalWithdrawals': '总提现',
      'admin.verification.title': '待审核验证',
`;

content = content.replace(/(th:\s*\{)/, "$1\n" + thKeys);
content = content.replace(/(en:\s*\{)/, "$1\n" + enKeys);
content = content.replace(/(zh:\s*\{)/, "$1\n" + zhKeys);

fs.writeFileSync(filePath, content);
console.log('Admin keys injected into th, en, zh dictionaries.');
