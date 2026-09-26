'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  table_id: string;
  booking_date: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  source: string;
}

export default function BookingsTab({ businessId, bookings = [] }: { businessId?: string | null, bookings?: Booking[] }) {
  const [isLoading, setIsLoading] = useState(false);
  const [tables, setTables] = useState<any[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    table_id: '',
    booking_date: new Date().toISOString().split('T')[0],
    start_time: '',
    duration_minutes: 60,
  });

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/dashboard-data');
      if (res.ok) {
        const json = await res.json();
        if (json.tables) {
          setTables(json.tables);
          if (json.tables.length > 0) {
            setFormData(prev => ({ ...prev, table_id: json.tables[0].id }));
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch tables", err);
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading('Creating booking...');
    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           business_id: 'auto-filled-by-server', // The API gets this from session
           ...formData
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Booking confirmed!', { id: loadingToast });
        setIsModalOpen(false);
      } else {
        toast.error(data.error || 'Failed to create booking', { id: loadingToast });
      }
    } catch (error: any) {
      toast.error('An error occurred', { id: loadingToast });
    }
  };

  return (
    <div className="mt-4 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Centralized Bookings</h2>
          <p className="text-sm text-text-secondary mt-1">Manage reservations and walk-ins.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-accent hover:bg-accent-hover text-bg-surface font-bold py-2 px-6 rounded-lg btn-premium flex items-center gap-2 shadow-lg shadow-accent/20"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          New Booking
        </button>
      </div>

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col shadow-sm">
        <div className="p-6 border-b border-border-theme bg-bg-primary/50">
          <h3 className="text-xl font-bold text-text-primary">Upcoming Bookings</h3>
        </div>
        
        {isLoading ? (
          <div className="p-8 space-y-4">
             {[1,2,3,4].map(i => (
               <div key={i} className="w-full h-16 bg-border-light/50 rounded-lg animate-pulse" />
             ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-bg-primary/30 text-[10px] font-bold text-text-secondary uppercase tracking-widest border-b border-border-theme">
                  <th className="p-5">Date & Time</th>
                  <th className="p-5">Customer</th>
                  <th className="p-5">Table</th>
                  <th className="p-5 text-center">Duration</th>
                  <th className="p-5 text-center">Source</th>
                  <th className="p-5 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-text-secondary">
                      No upcoming bookings found.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id} className="border-b border-border-theme/50 hover:bg-bg-surface/50 transition-colors">
                      <td className="p-5 text-sm text-text-secondary font-mono">
                        {b.booking_date} <span className="font-bold text-text-primary">{b.start_time.substring(0, 5)}</span>
                      </td>
                      <td className="p-5 text-sm font-bold text-text-primary">
                        {b.customer_name}
                        <div className="text-xs text-text-secondary font-normal">{b.customer_phone}</div>
                      </td>
                      <td className="p-5 text-sm font-bold text-accent font-mono uppercase">{b.table_id}</td>
                      <td className="p-5 text-sm text-center text-text-secondary">{b.duration_minutes} mins</td>
                      <td className="p-5 text-center">
                        <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded ${b.source === 'whatsapp' ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-accent/10 text-accent'}`}>
                          {b.source}
                        </span>
                      </td>
                      <td className="p-5 text-center">
                        <span className={`px-3 py-1.5 rounded-md text-[10px] font-bold tracking-widest border uppercase shadow-sm ${b.status === 'confirmed' ? 'border-success/50 text-success bg-success/10' : 'border-warning/50 text-warning bg-warning/10'}`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-card border border-border-theme rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border-theme flex justify-between items-center bg-bg-surface">
              <h3 className="text-lg font-bold text-text-primary">Create Booking</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleCreateBooking} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Customer Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.customer_name} 
                  onChange={e => setFormData({...formData, customer_name: e.target.value})}
                  className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-2 text-text-primary outline-none input-premium" 
                  placeholder="e.g. John Doe" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Phone Number (Optional)</label>
                <input 
                  type="tel" 
                  value={formData.customer_phone} 
                  onChange={e => setFormData({...formData, customer_phone: e.target.value})}
                  className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-2 text-text-primary outline-none input-premium" 
                  placeholder="10 digit number" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Table</label>
                  <select 
                    value={formData.table_id} 
                    onChange={e => setFormData({...formData, table_id: e.target.value})}
                    className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-2 text-text-primary outline-none font-mono input-premium"
                  >
                    {tables.map(t => (
                      <option key={t.id} value={t.id}>{t.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Duration (Mins)</label>
                  <select 
                    value={formData.duration_minutes} 
                    onChange={e => setFormData({...formData, duration_minutes: Number(e.target.value)})}
                    className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-2 text-text-primary outline-none input-premium"
                  >
                    <option value={30}>30 mins</option>
                    <option value={60}>1 Hour</option>
                    <option value={90}>1.5 Hours</option>
                    <option value={120}>2 Hours</option>
                    <option value={180}>3 Hours</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Date</label>
                  <input 
                    type="date" 
                    required
                    value={formData.booking_date} 
                    onChange={e => setFormData({...formData, booking_date: e.target.value})}
                    className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-2 text-text-primary focus:border-accent outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Start Time</label>
                  <input 
                    type="time" 
                    required
                    value={formData.start_time} 
                    onChange={e => setFormData({...formData, start_time: e.target.value})}
                    className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-2 text-text-primary focus:border-accent outline-none" 
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border-theme mt-6">
                <button 
                  type="submit" 
                  className="w-full bg-accent hover:bg-accent-hover text-bg-surface font-bold py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
