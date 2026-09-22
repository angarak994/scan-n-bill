'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
    return (
        <div className="relative group/tooltip flex items-center justify-center">
            {children}
            <div className="absolute bottom-full mb-2 hidden group-hover/tooltip:block whitespace-nowrap z-50">
                <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg">
                    {text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                </div>
            </div>
        </div>
    );
}

export default function BookingsTab({ 
    businessId,
    activeSessions,
    handleStartBooking,
    handleUpdateBookingStatus,
    openCreateBookingModal
}: { 
    businessId: string;
    activeSessions: any[];
    handleStartBooking: (id: string) => void;
    handleUpdateBookingStatus: (id: string, status: string) => void;
    openCreateBookingModal: () => void;
}) {
    const [bookings, setBookings] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    
    // Pagination filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    const observerTarget = useRef<HTMLTableRowElement>(null);

    const fetchBookings = async (pageNum: number, start: string = '', end: string = '', isAppend: boolean = false) => {
        try {
            if (pageNum === 1) setIsLoading(true);
            else setIsLoadingMore(true);

            let url = `/api/bookings?page=${pageNum}&limit=50`;
            if (start) url += `&startDate=${start}`;
            if (end) url += `&endDate=${end}`;

            const res = await fetch(url);
            const data = await res.json();
            
            if (data.bookings) {
                // Keep sort consistent
                const sorted = data.bookings.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                
                if (isAppend) {
                    setBookings(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        const newBookings = sorted.filter((s: any) => !existingIds.has(s.id));
                        return [...prev, ...newBookings];
                    });
                } else {
                    setBookings(sorted);
                }
                
                setHasMore(data.bookings.length === 50);
            }
        } catch (err) {
            console.error("Failed to fetch bookings", err);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        setPage(1);
        fetchBookings(1, startDate, endDate, false);
    }, [businessId, startDate, endDate]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
                    setPage(prev => {
                        const nextPage = prev + 1;
                        fetchBookings(nextPage, startDate, endDate, true);
                        return nextPage;
                    });
                }
            },
            { threshold: 1.0 }
        );

        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => { if (observerTarget.current) observer.unobserve(observerTarget.current); };
    }, [hasMore, isLoadingMore, isLoading, startDate, endDate]);

    // Realtime Updates
    useEffect(() => {
        if (!businessId) return;
        
        const sub = supabase.channel(`bookings_${businessId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `business_id=eq.${businessId}` }, (payload) => {
                // If it's an update, patch it locally
                if (payload.eventType === 'UPDATE') {
                    setBookings(prev => prev.map(b => b.id === payload.new.id ? payload.new : b));
                } else if (payload.eventType === 'INSERT') {
                    // Only prepend if we don't have filters active that would exclude it, to be safe just refetch page 1 or prepend
                    setBookings(prev => [payload.new, ...prev]);
                } else if (payload.eventType === 'DELETE') {
                    setBookings(prev => prev.filter(b => b.id !== payload.old.id));
                }
            }).subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [businessId]);

    const formatTime = (timeString: string) => {
        if (!timeString) return '';
        const [hours, minutes] = timeString.split(':');
        let h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12; 
        return `${h}:${minutes} ${ampm}`;
    };

    return (
        <div className="flex flex-col gap-8 mt-4">
            <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col p-8 shadow-sm">
                <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            Master Bookings Log
                        </h2>
                        <p className="text-text-secondary mt-1 text-sm">Full history of all table reservations.</p>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2 bg-bg-surface border border-border-theme rounded-lg px-2">
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-2 py-1.5 bg-transparent text-sm font-medium outline-none text-text-primary" />
                            <span className="text-text-secondary">to</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-2 py-1.5 bg-transparent text-sm font-medium outline-none text-text-primary" />
                            {(startDate || endDate) && (
                                <button onClick={() => {setStartDate(''); setEndDate('');}} className="p-1 hover:bg-bg-primary rounded text-text-secondary"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                            )}
                        </div>
                        <button onClick={openCreateBookingModal} className="flex items-center gap-2 px-4 py-2 bg-accent text-black font-bold rounded-lg hover:bg-accent/90 transition-colors shadow-md shadow-accent/20">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            Create Booking
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto max-h-[500px] custom-scrollbar border border-border-theme rounded-lg">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead className="sticky top-0 bg-bg-surface z-10 shadow-sm border-b border-border-theme">
                            <tr>
                                <th className="p-4 font-semibold text-text-secondary text-sm">Customer</th>
                                <th className="p-4 font-semibold text-text-secondary text-sm">Table & Time</th>
                                <th className="p-4 font-semibold text-text-secondary text-sm">Duration</th>
                                <th className="p-4 font-semibold text-text-secondary text-sm">Status</th>
                                <th className="p-4 font-semibold text-text-secondary text-sm text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-theme/50">
                            {isLoading && bookings.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center">
                                        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
                                    </td>
                                </tr>
                            ) : bookings.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-text-secondary">No bookings found in this period.</td>
                                </tr>
                            ) : (
                                <>
                                {bookings.map((booking: any) => {
                                    const isOccupied = activeSessions.some(s => s.table_id === booking.table_id);
                                    return (
                                        <tr key={booking.id} className="hover:bg-bg-surface/50 transition-colors group">
                                            <td className="p-4 md:p-5">
                                                <div className="font-bold text-text-primary flex items-center gap-2">{booking.customer_name}</div>
                                                <div className="text-xs text-text-secondary mt-1">{booking.customer_phone || 'No phone'}</div>
                                            </td>
                                            <td className="p-4 md:p-5">
                                                <div className="font-bold text-text-primary capitalize">{booking.table_id}</div>
                                                <div className="text-xs text-text-secondary mt-1">{new Date(booking.booking_date).toLocaleDateString()} at {formatTime(booking.start_time)}</div>
                                            </td>
                                            <td className="p-4 md:p-5 font-mono text-sm text-text-primary">
                                                {booking.duration_minutes}m
                                                <span className="block text-xs text-text-secondary mt-1 font-sans">{booking.game_type === 'ps5' ? `${booking.players} Players` : booking.game_type}</span>
                                            </td>
                                            <td className="p-4 md:p-5">
                                                {booking.status === 'confirmed' && <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-blue-500/50 text-blue-500 bg-blue-500/10 uppercase shadow-sm">Confirmed</span>}
                                                {booking.status === 'cancelled' && <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-text-secondary/50 text-text-secondary bg-text-secondary/10 uppercase shadow-sm">Cancelled</span>}
                                                {booking.status === 'active' && <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-green-500/50 text-green-500 bg-green-500/10 uppercase shadow-sm">Active</span>}
                                                {booking.status === 'no_show' && <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-orange-500/50 text-orange-600 bg-orange-500/10 uppercase shadow-sm">No Show</span>}
                                            </td>
                                            <td className="p-4 md:p-5 text-right">
                                                {booking.status === 'confirmed' && (
                                                <div className="flex justify-end gap-3 opacity-90 group-hover:opacity-100 transition-opacity">
                                                    <Tooltip text="Mark as No Show">
                                                    <button onClick={() => handleUpdateBookingStatus(booking.id, 'no_show')} className="px-4 py-2 text-sm font-bold text-orange-600 border border-orange-500/30 rounded-lg hover:bg-orange-500 hover:text-white transition-colors shadow-sm">No Show</button>
                                                    </Tooltip>
                                                    <Tooltip text="Cancel Booking">
                                                    <button onClick={() => handleUpdateBookingStatus(booking.id, 'cancelled')} className="px-4 py-2 text-sm font-bold text-danger border border-danger/30 rounded-lg hover:bg-danger hover:text-white transition-colors shadow-sm">Cancel</button>
                                                    </Tooltip>
                                                    <Tooltip text={isOccupied ? 'End current active session on table before starting' : 'Start Session'}>
                                                    <button 
                                                        onClick={() => !isOccupied && handleStartBooking(booking.id)} 
                                                        disabled={isOccupied}
                                                        className="px-4 py-2 text-sm font-bold text-black bg-accent rounded-lg hover:bg-accent/90 transition-colors shadow-md shadow-accent/20 border border-transparent disabled:opacity-50 disabled:bg-bg-surface disabled:text-text-secondary disabled:border-border-theme disabled:shadow-none"
                                                    >
                                                        Start Session
                                                    </button>
                                                    </Tooltip>
                                                </div>
                                                )}
                                                {booking.status === 'active' && (
                                                <span className="text-xs font-bold text-secondary flex items-center justify-end gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div> Live
                                                </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {/* Infinite Scroll Target */}
                                <tr ref={observerTarget}>
                                    <td colSpan={5} className="p-4 text-center">
                                        {isLoadingMore && <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>}
                                    </td>
                                </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
