import re

with open("src/app/dashboard/page.tsx", "r") as f:
    text = f.read()

# Add IconIntegrations
icon_eye_off = 'const IconEyeOff = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>;'
icon_integrations = 'const IconIntegrations = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>;'

text = text.replace(icon_eye_off, icon_eye_off + '\n' + icon_integrations)

# Update sidebarTab type
text = text.replace(" | 'messaging'>('overview');", " | 'messaging' | 'integrations'>('overview');")

# Add settings states
settings_state_marker = "  const [promoTitle, setPromoTitle] = useState('');"
new_states = """  const [settingsTab, setSettingsTab] = useState('business');
  const [integrationsTab, setIntegrationsTab] = useState('status');
"""
text = text.replace(settings_state_marker, new_states + settings_state_marker)

# Add Desktop Sidebar Integration Button
desktop_btn_marker = """          <button onClick={() => setSidebarTab('payments')} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'payments' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> 
            Payments
          </button>"""

integrations_btn = """
          <button onClick={() => setSidebarTab('integrations')} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'integrations' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}`}>
            <IconIntegrations />
            Integrations
          </button>"""
text = text.replace(desktop_btn_marker, desktop_btn_marker + integrations_btn)

# Add render logic
render_marker = "{sidebarTab === 'settings' && renderSettings()}"
render_integrations = "\n          {sidebarTab === 'integrations' && renderIntegrations()}"
text = text.replace(render_marker, render_marker + render_integrations)

# Add mobile sidebar button
mobile_btn_marker = """            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              <button onClick={() => { setSidebarTab('support'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'support' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}`}>
                <IconSupport /> Support
              </button>"""

mobile_integrations_btn = """            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              <button onClick={() => { setSidebarTab('integrations'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'integrations' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}`}>
                <IconIntegrations /> Integrations
              </button>
              <button onClick={() => { setSidebarTab('support'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'support' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}`}>
                <IconSupport /> Support
              </button>"""
text = text.replace(mobile_btn_marker, mobile_integrations_btn)

with open("src/app/dashboard/page.tsx", "w") as f:
    f.write(text)

