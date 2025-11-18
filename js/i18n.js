// Simple client-side i18n (th, en, zh)
(function(){
  const STORAGE_KEY = 'elixopay-lang';
  const dictionaries = {
    th: {
      'nav.about': 'เกี่ยวกับเรา',
      'nav.pricing': 'ราคา',
      'nav.usecases': 'กรณีการใช้งาน',
      'nav.docs': 'เอกสาร',
      'nav.contact': 'ติดต่อ',
      'nav.login': 'เข้าสู่ระบบ',
      'nav.signup': 'ลงทะเบียน',

      'index.hero.title': 'ระบบชำระเงินออนไลน์ที่ปลอดภัยและเชื่อถือได้',
      'index.hero.desc': 'Elixopay คือ Payment Gateway ที่ออกแบบมาเพื่อธุรกิจยุคใหม่ รองรับการชำระเงินที่รวดเร็ว ปลอดภัย และง่ายต่อการผลิตภัณฑ์',
      'index.hero.ctaPrimary': 'เริ่มต้นใช้งานฟรี',
      'index.hero.ctaSecondary': 'ดูเอกสาร API',
      'index.features.title': 'ทำไมต้อง Elixopay?',
      'index.features.subtitle': 'ระบบชำระเงินที่ครบครันและปลอดภัยที่สุด',
      'index.cta.title': 'พร้อมเริ่มต้นแล้วหรือยัง?',
      'index.cta.desc': 'เปิดบัญชีฟรีวันนี้และเริ่มรับชำระเงินออนไลน์ได้ทันที ไม่มีค่าธรรมเนียมแรกเข้า',

      'about.title': 'เกี่ยวกับ Elixopay',
      'pricing.title': 'แผนราคาที่เหมาะกับทุกธุรกิจ',
  'pricing.hero.desc': 'เลือกแพ็กเกจที่เหมาะกับความต้องการของคุณ ไม่มีค่าธรรมเนียมแรกเข้า ยกเลิกได้ทุกเมื่อ',
  'pricing.billing.monthly': 'รายเดือน',
  'pricing.billing.yearly': 'รายปี',
  'pricing.billing.save20': 'ประหยัด 20%',
      'contact.title': 'ติดต่อเรา',
      'usecases.title': 'กรณีการใช้งาน',

      'footer.products': 'ผลิตภัณฑ์',
      'footer.company': 'บริษัท',
      'footer.help': 'ช่วยเหลือ'
    },
    en: {
      'nav.about': 'About',
      'nav.pricing': 'Pricing',
      'nav.usecases': 'Use Cases',
      'nav.docs': 'Docs',
      'nav.contact': 'Contact',
      'nav.login': 'Log in',
      'nav.signup': 'Sign up',

      'index.hero.title': 'Secure and Reliable Online Payments',
      'index.hero.desc': 'Elixopay is a payment gateway built for modern businesses—fast, secure, and simple to integrate.',
      'index.hero.ctaPrimary': 'Get started free',
      'index.hero.ctaSecondary': 'View API Docs',
      'index.features.title': 'Why Elixopay?',
      'index.features.subtitle': 'A complete and secure payment platform',
      'index.cta.title': 'Ready to get started?',
      'index.cta.desc': 'Open a free account today and start accepting online payments. No setup fees.',

      'about.title': 'About Elixopay',
      'pricing.title': 'Plans for every business',
  'pricing.hero.desc': 'Pick the plan that fits your needs. No setup fees, cancel anytime.',
  'pricing.billing.monthly': 'Monthly',
  'pricing.billing.yearly': 'Yearly',
  'pricing.billing.save20': 'Save 20%',
      'contact.title': 'Contact Us',
      'usecases.title': 'Use Cases',

      'footer.products': 'Products',
      'footer.company': 'Company',
      'footer.help': 'Help'
    },
    zh: {
      'nav.about': '关于我们',
      'nav.pricing': '价格',
      'nav.usecases': '使用场景',
      'nav.docs': '文档',
      'nav.contact': '联系我们',
      'nav.login': '登录',
      'nav.signup': '注册',

      'index.hero.title': '安全且可靠的在线支付',
      'index.hero.desc': 'Elixopay 是为现代企业打造的支付网关——快速、安全、易集成。',
      'index.hero.ctaPrimary': '免费开始使用',
      'index.hero.ctaSecondary': '查看 API 文档',
      'index.features.title': '为什么选择 Elixopay？',
      'index.features.subtitle': '完整且安全的支付平台',
      'index.cta.title': '准备好开始了吗？',
      'index.cta.desc': '立即开通免费账户并开始接收在线支付，无需安装费用。',

      'about.title': '关于 Elixopay',
      'pricing.title': '适合各种规模的定价方案',
  'pricing.hero.desc': '选择适合您需求的套餐。无初始费用，随时可取消。',
  'pricing.billing.monthly': '按月',
  'pricing.billing.yearly': '按年',
  'pricing.billing.save20': '省 20%',
      'contact.title': '联系我们',
      'usecases.title': '使用场景',

      'footer.products': '产品',
      'footer.company': '公司',
      'footer.help': '帮助'
    }
  };

  // Optional: plan names for Pricing (used by pricing.html when tagged)
  const planKeys = {
    th: {
      'pricing.plan.starter': 'เริ่มต้น',
      'pricing.plan.professional': 'มืออาชีพ',
      'pricing.plan.enterprise': 'องค์กร'
    },
    en: {
      'pricing.plan.starter': 'Starter',
      'pricing.plan.professional': 'Professional',
      'pricing.plan.enterprise': 'Enterprise'
    },
    zh: {
      'pricing.plan.starter': '入门版',
      'pricing.plan.professional': '专业版',
      'pricing.plan.enterprise': '企业版'
    }
  };
  // Merge plan keys into dictionaries
  Object.keys(dictionaries).forEach(lang => {
    Object.assign(dictionaries[lang], planKeys[lang] || {});
  });

  function applyTranslations(lang){
    const dict = dictionaries[lang] || dictionaries.th;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = dict[key];
      if (val) el.textContent = val;
    });
    // Update html lang attribute
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : lang);
  }

  function setLang(lang){
    localStorage.setItem(STORAGE_KEY, lang);
    applyTranslations(lang);
    // Update selector if present
    const sel = document.getElementById('langSelect');
    if (sel) sel.value = lang;
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    // Create or wire language selector
    const existing = document.getElementById('langSelect');
    if (existing) {
      existing.addEventListener('change', (e)=> setLang(e.target.value));
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    let lang = saved || 'th';
    // Optional: auto-detect
    if (!saved) {
      const browser = navigator.language.toLowerCase();
      if (browser.startsWith('en')) lang = 'en';
      else if (browser.startsWith('zh')) lang = 'zh';
      else lang = 'th';
      localStorage.setItem(STORAGE_KEY, lang);
    }
    setLang(lang);
  });

  // Expose for manual changes if needed
  window.ElixopayI18n = { setLang };
})();
