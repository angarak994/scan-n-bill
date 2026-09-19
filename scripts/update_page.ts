import * as fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

// 1. Add state variables
const stateInject = `
  const [membershipPlans, setMembershipPlans] = useState<any[]>([]);
  const [isPlansLoading, setIsPlansLoading] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: '', price: 0, duration_months: 1, benefits: '', discount_percent: 0 });
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  // Registration OTP State
  const [registrationStep, setRegistrationStep] = useState<1 | 2 | 3>(1);
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
`;

content = content.replace("const [memberships, setMemberships] = useState<any[]>([]);", "const [memberships, setMemberships] = useState<any[]>([]);\n" + stateInject);

// 2. Add fetchMembershipPlans
const fetchInject = `
  const fetchMembershipPlans = async () => {
    setIsPlansLoading(true);
    try {
      const res = await fetch('/api/membership-plans');
      if (res.ok) {
        const data = await res.json();
        setMembershipPlans(data.plans || []);
      }
    } finally {
      setIsPlansLoading(false);
    }
  };
`;

content = content.replace("const fetchMemberships = async () => {", fetchInject + "\n  const fetchMemberships = async () => {");

// 3. Add to initial useEffect
content = content.replace("fetchMemberships();\n", "fetchMemberships();\n      fetchMembershipPlans();\n");

// 4. Update newMember state
content = content.replace(
  "const [newMember, setNewMember] = useState({ name: '', mobile: '', email: '', tier: 'VIP', duration: '12' });",
  "const [newMember, setNewMember] = useState({ name: '', mobile: '', email: '', plan_id: '' });"
);

// 5. Add OTP logic handlers
const handlersInject = `
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.mobile || newMember.mobile.length < 10) return toast.error('Enter a valid mobile number');
    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: newMember.mobile })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('OTP Sent! Check console.');
        setRegistrationStep(2);
      } else {
        toast.error(data.error || 'Failed to send OTP');
      }
    } catch(e) { toast.error('Network error'); }
    setIsSendingOtp(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return toast.error('Enter OTP');
    setIsVerifyingOtp(true);
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: newMember.mobile, otp })
      });
      const data = await res.json();
      if (res.ok) {
        setVerificationId(data.verificationId);
        setVerificationToken(data.verificationToken);
        setRegistrationStep(3);
        toast.success('Mobile verified!');
      } else {
        toast.error(data.error || 'Invalid OTP');
      }
    } catch(e) { toast.error('Network error'); }
    setIsVerifyingOtp(false);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingPlan(true);
    try {
      const res = await fetch('/api/membership-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           ...newPlan,
           benefits: newPlan.benefits.split(',').map(b => b.trim()).filter(b => b)
        })
      });
      if (res.ok) {
        fetchMembershipPlans();
        setNewPlan({ name: '', price: 0, duration_months: 1, benefits: '', discount_percent: 0 });
        toast.success('Plan created');
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch(e) { toast.error('Error'); }
    setIsCreatingPlan(false);
  };

  const handleTogglePlanStatus = async (plan: any) => {
    try {
      const res = await fetch('/api/membership-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...plan, status: plan.status === 'Active' ? 'Archived' : 'Active' })
      });
      if (res.ok) {
        fetchMembershipPlans();
        toast.success('Plan updated');
      }
    } catch(e) { toast.error('Error'); }
  };
`;

content = content.replace("const handleCreateMembership = async (e: React.FormEvent) => {", handlersInject + "\n  const handleCreateMembership = async (e: React.FormEvent) => {");

// 6. Fix handleCreateMembership body
content = content.replace(
  "body: JSON.stringify({ ...newMember, duration_months: newMember.duration })",
  "body: JSON.stringify({ ...newMember, verificationToken, verificationId, tier: newMember.plan_id, duration_months: (membershipPlans.find((p:any) => p.id === newMember.plan_id)?.duration_months || 12) })"
);

content = content.replace(
  "setNewMember({ name: '', mobile: '', email: '', tier: 'VIP', duration: '12' });",
  "setNewMember({ name: '', mobile: '', email: '', plan_id: '' });\n        setRegistrationStep(1);\n        setOtp('');\n        setVerificationToken('');"
);

fs.writeFileSync('src/app/dashboard/page.tsx', content);
console.log('Script ran successfully');
