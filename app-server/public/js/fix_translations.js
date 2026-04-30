const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..');

// Helper to replace text with data-i18n span inside specific tags, or just add data-i18n attribute
function replaceInFile(filename, replacements) {
    const filePath = path.join(publicDir, filename);
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    for (const {search, replace} of replacements) {
        content = content.split(search).join(replace);
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filename}`);
}

const transactionReplacements = [
    { search: '<p class="text-sm text-gray-500">ทั้งหมด</p>', replace: '<p class="text-sm text-gray-500" data-i18n="filter.all">ทั้งหมด</p>' },
    { search: '<p class="text-sm text-gray-500">สำเร็จ</p>', replace: '<p class="text-sm text-gray-500" data-i18n="filter.succeeded">สำเร็จ</p>' },
    { search: '<p class="text-sm text-gray-500">รอดำเนินการ</p>', replace: '<p class="text-sm text-gray-500" data-i18n="filter.pending">รอดำเนินการ</p>' },
    { search: '<p class="text-sm text-gray-500">ยอดรวม</p>', replace: '<p class="text-sm text-gray-500" data-i18n="filter.total">ยอดรวม</p>' },
    { search: '<label class="block text-sm font-medium text-gray-700 mb-2">สถานะ</label>', replace: '<label class="block text-sm font-medium text-gray-700 mb-2" data-i18n="filter.status">สถานะ</label>' },
    { search: '<option value="">ทั้งหมด</option>', replace: '<option value="" data-i18n="filter.all">ทั้งหมด</option>' },
    { search: '<option value="succeeded">สำเร็จ</option>', replace: '<option value="succeeded" data-i18n="filter.succeeded">สำเร็จ</option>' },
    { search: '<option value="pending">รอดำเนินการ</option>', replace: '<option value="pending" data-i18n="filter.pending">รอดำเนินการ</option>' },
    { search: '<option value="failed">ล้มเหลว</option>', replace: '<option value="failed" data-i18n="filter.failed">ล้มเหลว</option>' },
    { search: '<option value="cancelled">ยกเลิก</option>', replace: '<option value="cancelled" data-i18n="filter.cancelled">ยกเลิก</option>' },
    { search: '<option value="refunded">คืนเงิน</option>', replace: '<option value="refunded" data-i18n="filter.refunded">คืนเงิน</option>' },
    { search: '<label class="block text-sm font-medium text-gray-700 mb-2">เรียงตาม</label>', replace: '<label class="block text-sm font-medium text-gray-700 mb-2" data-i18n="filter.sortBy">เรียงตาม</label>' },
    { search: '<option value="created_at">วันที่สร้าง</option>', replace: '<option value="created_at" data-i18n="filter.createdAt">วันที่สร้าง</option>' },
    { search: '<option value="amount">จำนวนเงิน</option>', replace: '<option value="amount" data-i18n="filter.amount">จำนวนเงิน</option>' },
    { search: '<option value="status">สถานะ</option>', replace: '<option value="status" data-i18n="filter.status">สถานะ</option>' },
    { search: '<label class="block text-sm font-medium text-gray-700 mb-2">ลำดับ</label>', replace: '<label class="block text-sm font-medium text-gray-700 mb-2" data-i18n="filter.order">ลำดับ</label>' },
    { search: '<option value="DESC">ล่าสุดก่อน</option>', replace: '<option value="DESC" data-i18n="filter.desc">ล่าสุดก่อน</option>' },
    { search: '<option value="ASC">เก่าสุดก่อน</option>', replace: '<option value="ASC" data-i18n="filter.asc">เก่าสุดก่อน</option>' },
    { search: '<p class="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>', replace: '<p class="mt-4 text-gray-600" data-i18n="common.loading">กำลังโหลดข้อมูล...</p>' },
    { search: 'แสดง <span id="showingFrom"', replace: '<span data-i18n="pagination.showing">แสดง</span> <span id="showingFrom"' },
    { search: '</span> ถึง <span id="showingTo"', replace: '</span> <span data-i18n="pagination.to">ถึง</span> <span id="showingTo"' },
    { search: '</span> จาก <span id="totalRecords"', replace: '</span> <span data-i18n="pagination.from">จาก</span> <span id="totalRecords"' },
    { search: '<td>ไม่พบรายการธุรกรรม</td>', replace: '<td data-i18n="table.noTransactions">ไม่พบรายการธุรกรรม</td>' },
    { search: '<td colspan="7" class="px-6 py-12 text-center text-gray-500">ไม่พบรายการธุรกรรม</td>', replace: '<td colspan="7" class="px-6 py-12 text-center text-gray-500" data-i18n="table.noTransactions">ไม่พบรายการธุรกรรม</td>' }
];

replaceInFile('transactions.html', transactionReplacements);

// Also need to inject translations into i18n.js
const i18nPath = path.join(__dirname, 'i18n.js');
let i18nContent = fs.readFileSync(i18nPath, 'utf8');

const thKeys = `
      // Transaction Filters
      'filter.all': 'ทั้งหมด',
      'filter.succeeded': 'สำเร็จ',
      'filter.pending': 'รอดำเนินการ',
      'filter.failed': 'ล้มเหลว',
      'filter.cancelled': 'ยกเลิก',
      'filter.refunded': 'คืนเงิน',
      'filter.total': 'ยอดรวม',
      'filter.status': 'สถานะ',
      'filter.sortBy': 'เรียงตาม',
      'filter.createdAt': 'วันที่สร้าง',
      'filter.amount': 'จำนวนเงิน',
      'filter.order': 'ลำดับ',
      'filter.desc': 'ล่าสุดก่อน',
      'filter.asc': 'เก่าสุดก่อน',
      'common.loading': 'กำลังโหลดข้อมูล...',
      'pagination.showing': 'แสดง',
      'pagination.to': 'ถึง',
      'pagination.from': 'จาก',
      'table.noTransactions': 'ไม่พบรายการธุรกรรม',
`;

const enKeys = `
      // Transaction Filters
      'filter.all': 'All',
      'filter.succeeded': 'Succeeded',
      'filter.pending': 'Pending',
      'filter.failed': 'Failed',
      'filter.cancelled': 'Cancelled',
      'filter.refunded': 'Refunded',
      'filter.total': 'Total',
      'filter.status': 'Status',
      'filter.sortBy': 'Sort By',
      'filter.createdAt': 'Date Created',
      'filter.amount': 'Amount',
      'filter.order': 'Order',
      'filter.desc': 'Newest First',
      'filter.asc': 'Oldest First',
      'common.loading': 'Loading data...',
      'pagination.showing': 'Showing',
      'pagination.to': 'to',
      'pagination.from': 'of',
      'table.noTransactions': 'No transactions found.',
`;

const zhKeys = `
      // Transaction Filters
      'filter.all': '全部',
      'filter.succeeded': '已成功',
      'filter.pending': '待处理',
      'filter.failed': '已失败',
      'filter.cancelled': '已取消',
      'filter.refunded': '已退款',
      'filter.total': '总计',
      'filter.status': '状态',
      'filter.sortBy': '排序',
      'filter.createdAt': '创建日期',
      'filter.amount': '金额',
      'filter.order': '顺序',
      'filter.desc': '最新',
      'filter.asc': '最旧',
      'common.loading': '正在加载数据...',
      'pagination.showing': '显示',
      'pagination.to': '到',
      'pagination.from': '共',
      'table.noTransactions': '未找到交易记录。',
`;

i18nContent = i18nContent.replace(/(th:\s*\{)/, "$1\n" + thKeys);
i18nContent = i18nContent.replace(/(en:\s*\{)/, "$1\n" + enKeys);
i18nContent = i18nContent.replace(/(zh:\s*\{)/, "$1\n" + zhKeys);

fs.writeFileSync(i18nPath, i18nContent);
console.log('i18n updated with translation fixes.');
