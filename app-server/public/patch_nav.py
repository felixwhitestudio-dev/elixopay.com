import os

dashboard_path = '/Users/felixonthecloud/Elixopay/app-server/public/dashboard.html'
billing_path = '/Users/felixonthecloud/Elixopay/app-server/public/billing.html'

with open(dashboard_path, 'r') as f:
    dashboard_html = f.read()

start_idx = dashboard_html.find('<!-- Dark Glassmorphism Navigation -->')
end_idx = dashboard_html.find('<!-- Main Content -->')

nav_html = dashboard_html[start_idx:end_idx]

# In nav_html, Dashboard is currently active (a span, bg-purple), and Billing is inactive (a tag, bg-slate)
# Let's make Dashboard inactive and Billing active.

dashboard_active = '''                        <span
                            class="px-3 py-1 bg-purple-900/50 text-purple-300 text-xs font-semibold rounded-full border border-purple-800 flex items-center">
                            <i class="fas fa-layer-group mr-1.5"></i> <span data-i18n="nav.dashboard">Dashboard</span>
                        </span>'''

dashboard_inactive = '''                        <a href="/dashboard.html"
                            class="px-3 py-1 bg-slate-800 text-slate-400 hover:text-purple-300 text-xs font-semibold rounded-full border border-transparent hover:border-purple-800 flex items-center transition">
                            <i class="fas fa-layer-group mr-1.5"></i> <span data-i18n="nav.dashboard">Dashboard</span>
                        </a>'''

billing_inactive = '''                        <a href="/billing.html"
                            class="ml-1 px-3 py-1 bg-slate-800 text-slate-400 hover:text-purple-300 text-xs font-semibold rounded-full border border-transparent hover:border-purple-800 flex items-center transition">
                            <i class="fas fa-sync-alt mr-1.5"></i> <span data-i18n="nav.billing">Billing</span>
                        </a>'''

billing_active = '''                        <span
                            class="ml-1 px-3 py-1 bg-purple-900/50 text-purple-300 text-xs font-semibold rounded-full border border-purple-800 flex items-center">
                            <i class="fas fa-sync-alt mr-1.5"></i> <span data-i18n="nav.billing">Billing</span>
                        </span>'''

nav_html = nav_html.replace(dashboard_active, dashboard_inactive)
nav_html = nav_html.replace(billing_inactive, billing_active)

with open(billing_path, 'r') as f:
    billing_html = f.read()

b_start_idx = billing_html.find('<!-- Sidebar (Injected via JS) -->')
b_end_idx = billing_html.find('<!-- Header Section -->') # wait, the main content div is before this.

# Let's just find the exact block to replace in billing.html
to_replace_start = billing_html.find('    <!-- Sidebar (Injected via JS) -->')
to_replace_end = billing_html.find('        <!-- Main Dashboard Content -->')

if to_replace_start != -1 and to_replace_end != -1:
    new_top = nav_html + '    <!-- Main Content -->\n    <div class="pt-24 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">\n\n'
    billing_html = billing_html[:to_replace_start] + new_top + billing_html[to_replace_end:]

# Now replace the bottom scripts
script_start = billing_html.find('        // Sidebar Injection')
script_end = billing_html.find('        // Billing Specific JS')

if script_start != -1 and script_end != -1:
    billing_html = billing_html[:script_start] + billing_html[script_end:]

with open(billing_path, 'w') as f:
    f.write(billing_html)

print("Done porting nav to billing.html")
