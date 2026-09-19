import * as fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

// 1. Replace Register Member Form
const oldFormStart = `<form onSubmit={handleCreateMembership} className="max-w-xl grid grid-cols-2 gap-4">`;
const oldFormEnd = `{isCreatingMember ? 'Registering...' : 'Register Member'}\n            </button>\n          </div>\n        </form>`;

const newForm = `
        {registrationStep === 1 && (
          <form onSubmit={handleSendOtp} className="max-w-xl grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Mobile Number <span className="text-danger">*</span></label>
              <input required type="tel" value={newMember.mobile} onChange={e => setNewMember({...newMember, mobile: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm font-mono" placeholder="9876543210" />
            </div>
            <button type="submit" disabled={isSendingOtp} className="w-full bg-accent text-white font-bold py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 mt-2">
              {isSendingOtp ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}

        {registrationStep === 2 && (
          <form onSubmit={handleVerifyOtp} className="max-w-xl grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Enter OTP <span className="text-danger">*</span></label>
              <input required type="text" value={otp} onChange={e => setOtp(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm font-mono text-center tracking-widest" placeholder="123456" maxLength={6} />
              <p className="text-xs text-text-secondary mt-2">OTP sent to {newMember.mobile}. <button type="button" onClick={() => setRegistrationStep(1)} className="text-accent hover:underline">Change number</button></p>
            </div>
            <button type="submit" disabled={isVerifyingOtp} className="w-full bg-accent text-white font-bold py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 mt-2">
              {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
        )}

        {registrationStep === 3 && (
          <form onSubmit={handleCreateMembership} className="max-w-xl grid grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Full Name <span className="text-danger">*</span></label>
              <input required type="text" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm" placeholder="John Doe" />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Mobile Number (Verified)</label>
              <input disabled type="tel" value={newMember.mobile} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg opacity-50 cursor-not-allowed outline-none text-sm font-mono" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Email (Optional)</label>
              <input type="email" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm" placeholder="john@example.com" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Select Membership Plan <span className="text-danger">*</span></label>
              <select required value={newMember.plan_id} onChange={e => setNewMember({...newMember, plan_id: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm font-bold text-accent">
                <option value="" disabled>Select a plan...</option>
                {membershipPlans.filter((p:any) => p.status === 'Active').map((p:any) => (
                  <option key={p.id} value={p.id}>{p.name} - ₹{p.price} ({p.duration_months} Months)</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 mt-2">
              <button type="submit" disabled={isCreatingMember} className="w-full bg-accent text-white font-bold py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 mt-2">
                {isCreatingMember ? 'Registering...' : 'Complete Registration'}
              </button>
            </div>
          </form>
        )}
`;

const startIndex = content.indexOf(oldFormStart);
const endIndex = content.indexOf(oldFormEnd) + oldFormEnd.length;

if (startIndex > -1 && endIndex > -1) {
  content = content.substring(0, startIndex) + newForm + content.substring(endIndex);
}

// 2. Add Membership Plans UI to Settings Tab
const plansUi = `
      {/* Membership Plans Management */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">
        <h2 className="text-2xl font-bold mb-6">Membership Plans</h2>
        
        <form onSubmit={handleCreatePlan} className="max-w-2xl grid grid-cols-2 gap-4 mb-8 bg-bg-surface p-6 rounded-xl border border-border-theme/50">
          <h3 className="col-span-2 text-sm font-black uppercase tracking-widest text-text-primary mb-2">Create New Plan</h3>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Plan Name</label>
            <input required type="text" value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} className="w-full px-4 py-2.5 bg-bg-primary border border-border-theme rounded-lg text-sm" placeholder="VIP Annual" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Price (₹)</label>
            <input required type="number" value={newPlan.price || ''} onChange={e => setNewPlan({...newPlan, price: Number(e.target.value)})} className="w-full px-4 py-2.5 bg-bg-primary border border-border-theme rounded-lg text-sm" placeholder="1000" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Duration (Months)</label>
            <input required type="number" min="1" value={newPlan.duration_months} onChange={e => setNewPlan({...newPlan, duration_months: Number(e.target.value)})} className="w-full px-4 py-2.5 bg-bg-primary border border-border-theme rounded-lg text-sm" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Discount (%)</label>
            <input type="number" min="0" max="100" value={newPlan.discount_percent} onChange={e => setNewPlan({...newPlan, discount_percent: Number(e.target.value)})} className="w-full px-4 py-2.5 bg-bg-primary border border-border-theme rounded-lg text-sm" placeholder="10" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Benefits (Comma separated)</label>
            <input type="text" value={newPlan.benefits} onChange={e => setNewPlan({...newPlan, benefits: e.target.value})} className="w-full px-4 py-2.5 bg-bg-primary border border-border-theme rounded-lg text-sm" placeholder="Free Locker, 10% off F&B" />
          </div>
          <div className="col-span-2 mt-2">
             <button type="submit" disabled={isCreatingPlan} className="bg-accent text-white px-6 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50">
               {isCreatingPlan ? 'Creating...' : '+ Create Plan'}
             </button>
          </div>
        </form>

        {isPlansLoading ? (
          <p className="text-sm text-text-secondary">Loading plans...</p>
        ) : membershipPlans.length === 0 ? (
          <p className="text-sm text-text-secondary italic bg-bg-surface p-4 rounded-lg border border-border-theme">No membership plans created yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-theme">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-surface border-b border-border-theme">
                <tr>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-widest text-text-secondary">Plan Name</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-widest text-text-secondary">Price</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-widest text-text-secondary">Duration</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-widest text-text-secondary">Benefits</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-widest text-text-secondary">Status</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-widest text-text-secondary text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-theme/50">
                {membershipPlans.map((plan: any) => (
                  <tr key={plan.id} className="hover:bg-bg-surface/50 transition-colors">
                    <td className="px-5 py-4 font-bold text-text-primary">{plan.name}</td>
                    <td className="px-5 py-4 font-mono font-bold text-accent">₹{plan.price}</td>
                    <td className="px-5 py-4">{plan.duration_months} M</td>
                    <td className="px-5 py-4 text-xs text-text-secondary">{(plan.benefits || []).join(', ')}</td>
                    <td className="px-5 py-4">
                      <span className={\`px-2 py-1 rounded text-xs font-bold \${plan.status === 'Active' ? 'bg-success/10 text-success' : 'bg-text-secondary/10 text-text-secondary'}\`}>
                        {plan.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => handleTogglePlanStatus(plan)} className="text-xs font-bold text-accent hover:underline">
                        {plan.status === 'Active' ? 'Archive' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
`;

content = content.replace(
  "{/* Change PIN UI */}",
  plansUi + "\n\n      {/* Change PIN UI */}"
);

fs.writeFileSync('src/app/dashboard/page.tsx', content);
console.log('UI Replaced successfully');
