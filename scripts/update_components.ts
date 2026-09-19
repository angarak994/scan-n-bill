import * as fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/components.tsx', 'utf8');

// 1. Add preferences to LiveSessionRow signature
const oldSignature = `export function LiveSessionRow({ session, currentDiscounts, isPrivacyMode, isPromoValid, activePromo, pricingRules, handleIntervention, toReadableIST, formatINR, onRequestEndSession, getDisplayName }: { session: any, currentDiscounts: any, isPrivacyMode: boolean, isPromoValid: boolean, activePromo: any, pricingRules: any, handleIntervention: any, toReadableIST: any, formatINR: any, onRequestEndSession?: (session: any, liveCost: number, liveDuration: string) => void, getDisplayName?: (name: string, memberId?: string) => string }) {`;
const newSignature = `export function LiveSessionRow({ session, currentDiscounts, isPrivacyMode, isPromoValid, activePromo, pricingRules, preferences, handleIntervention, toReadableIST, formatINR, onRequestEndSession, getDisplayName }: { session: any, currentDiscounts: any, isPrivacyMode: boolean, isPromoValid: boolean, activePromo: any, pricingRules: any, preferences?: any, handleIntervention: any, toReadableIST: any, formatINR: any, onRequestEndSession?: (session: any, liveCost: number, liveDuration: string) => void, getDisplayName?: (name: string, memberId?: string) => string }) {`;

content = content.replace(oldSignature, newSignature);

// 2. Hide pricing if disabled
const oldPricing = `<PrivacyText value={liveCost} isPrivacyMode={isPrivacyMode} formatINR={formatINR} />`;
const newPricing = `{preferences?.show_pricing_on_dashboard === false ? '---' : <PrivacyText value={liveCost} isPrivacyMode={isPrivacyMode} formatINR={formatINR} />}`;
content = content.replace(oldPricing, newPricing);

// 3. Make buttons large and remove confirmation for pause/resume if simple_mode
const oldButtons = `<div className="flex justify-end gap-3 opacity-90 group-hover:opacity-100 transition-opacity">
          {session.paused_at ? (
            <button onClick={() => handleIntervention('resume', session.id)} className="px-4 py-2 text-sm font-bold text-warning border border-warning/30 rounded-lg hover:bg-warning hover:text-black transition-colors shadow-sm">Resume</button>
          ) : (
            <button onClick={() => handleIntervention('pause', session.id)} className="px-4 py-2 text-sm font-bold text-text-primary border border-border-theme rounded-lg hover:bg-bg-surface transition-colors shadow-sm">Pause</button>
          )}`;
const newButtons = `<div className="flex justify-end gap-3 opacity-90 group-hover:opacity-100 transition-opacity">
          {session.paused_at ? (
            <button onClick={() => { if (preferences?.simple_mode || confirm('Resume session?')) handleIntervention('resume', session.id); }} className={\`px-4 py-2 \${preferences?.simple_mode ? 'px-8 py-3 text-lg w-full bg-warning text-black shadow-lg' : 'text-sm font-bold text-warning border border-warning/30'} rounded-lg hover:bg-warning hover:text-black transition-colors shadow-sm\`}>Resume</button>
          ) : (
            <button onClick={() => { if (preferences?.simple_mode || confirm('Pause session?')) handleIntervention('pause', session.id); }} className={\`px-4 py-2 \${preferences?.simple_mode ? 'px-8 py-3 text-lg w-full bg-bg-surface text-text-primary shadow-lg' : 'text-sm font-bold text-text-primary border border-border-theme'} rounded-lg hover:bg-bg-surface transition-colors shadow-sm\`}>Pause</button>
          )}`;

content = content.replace(oldButtons, newButtons);

// 4. Increase end button size in simple mode
const oldEndButton = `className="px-4 py-2 text-sm font-bold text-white bg-danger rounded-lg hover:bg-red-600 transition-colors shadow-md shadow-danger/20 border border-transparent">End</button>`;
const newEndButton = `className={\`\${preferences?.simple_mode ? 'px-8 py-3 text-lg w-full shadow-lg' : 'px-4 py-2 text-sm'} font-bold text-white bg-danger rounded-lg hover:bg-red-600 transition-colors shadow-md shadow-danger/20 border border-transparent\`}>End</button>`;

content = content.replace(oldEndButton, newEndButton);

fs.writeFileSync('src/app/dashboard/components.tsx', content);
console.log('Updated LiveSessionRow in components.tsx');
