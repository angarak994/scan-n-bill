import * as fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

// 1. Add preferences state
const stateInject = `
  const defaultPreferences = {
    simple_mode: false,
    require_customer_name: true,
    require_phone: false,
    enable_memberships: true,
    enable_qkhata: true,
    show_pricing_on_dashboard: true,
    show_member_details: true,
    default_view: 'overview'
  };
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [isUpdatingPreferences, setIsUpdatingPreferences] = useState(false);

  const handleUpdatePreference = async (key: string, value: any) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    
    // Auto-save logic
    setIsUpdatingPreferences(true);
    try {
      const updatedPricingRules = {
        ...data?.pricingRules,
        globalSettings: {
          ...data?.pricingRules?.globalSettings,
          preferences: newPreferences
        }
      };

      const res = await fetch('/api/update-business-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          pricing_rules: updatedPricingRules
        })
      });

      if (!res.ok) {
        toast.error('Failed to save preference');
      }
    } catch (e) {
      toast.error('Network error saving preference');
    } finally {
      setIsUpdatingPreferences(false);
    }
  };
`;

content = content.replace("const [showQkhataPopover, setShowQkhataPopover] = useState(false);", stateInject + "\n  const [showQkhataPopover, setShowQkhataPopover] = useState(false);");

// 2. Load preferences on data fetch
const loadInject = `
      if (data.pricingRules?.globalSettings?.preferences) {
        setTimeout(() => setPreferences({ ...defaultPreferences, ...data.pricingRules.globalSettings.preferences }), 0);
      }
`;

content = content.replace("setTimeout(() => setTelegramOwners(data.pricingRules.globalSettings.authorized_telegram_owners || []), 0);", loadInject + "\n        setTimeout(() => setTelegramOwners(data.pricingRules.globalSettings.authorized_telegram_owners || []), 0);");

fs.writeFileSync('src/app/dashboard/page.tsx', content);
console.log("Injected preferences logic");
