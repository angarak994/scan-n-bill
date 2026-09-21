const fs = require('fs');

let code = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

const importStmts = `
import SubscriptionTab from './SubscriptionTab';
import FeatureLock from '@/components/ui/FeatureLock';
`;
if (!code.includes('SubscriptionTab')) {
    code = code.replace("import QpulseWidget", importStmts + "import QpulseWidget");
}

// Add state type
code = code.replace(`menu_items?: any[] } | null>(null);`, `menu_items?: any[], entitlement?: any } | null>(null);`);

// Update the type of sidebarTab state
code = code.replace(`'customers' | 'settings' | 'support' | 'qkhata' | 'payments' | 'messaging' | 'menu'>`, `'customers' | 'settings' | 'subscription' | 'support' | 'qkhata' | 'payments' | 'messaging' | 'menu'>`);
code = code.replace(`'customers', 'settings', 'support', 'qkhata', 'payments', 'messaging', 'menu']`, `'customers', 'settings', 'subscription', 'support', 'qkhata', 'payments', 'messaging', 'menu']`);

// Add the sidebar button
const sidebarButton = `
          <button onClick={() => setSidebarTab('subscription')} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'subscription' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}\`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
            Subscription & Billing
          </button>
`;
code = code.replace(`          <button onClick={() => setSidebarTab('support')} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'support' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}\`}>`, sidebarButton + `          <button onClick={() => setSidebarTab('support')} className={\`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors \${sidebarTab === 'support' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}\`}>`);

// Feature locks
const qkhataRender = `          {sidebarTab === 'qkhata' && (
            data?.entitlement?.features?.has_qkhata ? 
            <QKhataTab businessId={businessId!} dbCustomers={data?.dbCustomers || []} memberships={memberships || []} membershipPlans={membershipPlans || []} /> :
            <FeatureLock featureName="QKhata Ledger" requiredPlan="Growth" description="Manage customer balances, track payments, and automate ledger entries." />
          )}`;
code = code.replace(`{sidebarTab === 'qkhata' && <QKhataTab businessId={businessId!} dbCustomers={data?.dbCustomers || []} memberships={memberships || []} membershipPlans={membershipPlans || []} />}`, qkhataRender);

const messagingRender = `          {sidebarTab === 'messaging' && (
            data?.entitlement?.features?.has_whatsapp ?
            <MessagingTab businessId={businessId!} isWhatsAppConnected={!!data?.whatsapp_config?.enabled} dbCustomers={data?.dbCustomers || []} memberships={memberships || []} /> :
            <FeatureLock featureName="WhatsApp Automation" requiredPlan="Growth" description="Send automated session receipts, OTPs, and promotional broadcasts directly to customers' WhatsApp." />
          )}`;
code = code.replace(`{sidebarTab === 'messaging' && <MessagingTab businessId={businessId!} isWhatsAppConnected={!!data?.whatsapp_config?.enabled} dbCustomers={data?.dbCustomers || []} memberships={memberships || []} />}`, messagingRender);

// Add the subscription tab component rendering
const subscriptionRender = `{sidebarTab === 'subscription' && <SubscriptionTab businessId={businessId!} />}`;
code = code.replace(`{sidebarTab === 'settings' && renderSettings()}`, `{sidebarTab === 'settings' && renderSettings()}\n          ${subscriptionRender}`);

fs.writeFileSync('src/app/dashboard/page.tsx', code);
console.log("Updated dashboard UI with subscription tab and feature locks.");
