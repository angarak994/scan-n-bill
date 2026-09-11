import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { BusinessData } from '@/lib/businessManager';

interface MenuManagerTabProps {
  businessId: string;
  initialMenuItems: any[];
}

export function MenuManagerTab({ businessId, initialMenuItems }: MenuManagerTabProps) {
  const [menuItems, setMenuItems] = useState<any[]>(initialMenuItems || []);
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    price: '',
    category: 'Snacks',
    description: '',
    image: '',
    available: true
  });

  const [saving, setSaving] = useState(false);

  const categories = Array.from(new Set(menuItems.map(i => i.category || 'Other') || ['Snacks', 'Beverages', 'Meals', 'Other']));

  const handleOpenAdd = () => {
    setFormData({ id: crypto.randomUUID(), name: '', price: '', category: 'Snacks', description: '', image: '', available: true });
    setEditingItem(null);
    setIsAdding(true);
  };

  const handleOpenEdit = (item: any) => {
    setFormData({
      id: item.id || crypto.randomUUID(),
      name: item.name,
      price: item.price.toString(),
      category: item.category || 'Other',
      description: item.description || '',
      image: item.image || '',
      available: item.available !== false
    });
    setEditingItem(item);
    setIsAdding(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const newItem = {
        id: formData.id,
        name: formData.name,
        price: Number(formData.price),
        category: formData.category,
        description: formData.description,
        image: formData.image,
        available: formData.available
      };

      let newItems = [...menuItems];
      if (editingItem) {
        // Find by ID or by Name (legacy items might not have ID)
        const idx = newItems.findIndex(i => (i.id && i.id === editingItem.id) || (!i.id && i.name === editingItem.name));
        if (idx !== -1) newItems[idx] = newItem;
        else newItems.push(newItem);
      } else {
        newItems.push(newItem);
      }

      const { error } = await supabase
        .from('businesses')
        .update({ menu_items: newItems })
        .eq('id', businessId);

      if (error) throw error;

      setMenuItems(newItems);
      setIsAdding(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save menu item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (idOrName: string, isLegacy: boolean) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      let newItems = [...menuItems];
      if (isLegacy) {
        newItems = newItems.filter(i => i.name !== idOrName);
      } else {
        newItems = newItems.filter(i => i.id !== idOrName);
      }

      const { error } = await supabase
        .from('businesses')
        .update({ menu_items: newItems })
        .eq('id', businessId);

      if (error) throw error;
      setMenuItems(newItems);
    } catch (err) {
      console.error(err);
      alert('Failed to delete item');
    }
  };

  const toggleAvailability = async (item: any) => {
    try {
      const newItems = [...menuItems].map(i => {
        if ((i.id && i.id === item.id) || (!i.id && i.name === item.name)) {
          return { ...i, available: i.available === false ? true : false };
        }
        return i;
      });

      setMenuItems(newItems);

      await supabase
        .from('businesses')
        .update({ menu_items: newItems })
        .eq('id', businessId);
    } catch (err) {
      console.error(err);
    }
  };



  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div className="flex justify-between items-center bg-bg-surface p-6 rounded-3xl border border-border-theme shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-text-primary tracking-tight">Food & Beverages</h2>
          <p className="text-text-secondary mt-1 text-sm font-medium">Manage your customized menu for the customer QR portal</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-accent text-bg-primary px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          Add Item
        </button>
      </div>

      {categories.map(category => {
        const catItems = menuItems.filter(i => (i.category || 'Other') === category);
        if (catItems.length === 0) return null;

        return (
          <div key={category} className="bg-bg-surface border border-border-theme rounded-3xl overflow-hidden shadow-sm mt-6">
            <div className="px-6 py-4 border-b border-border-theme bg-bg-surface/50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
                <span className="w-2 h-6 bg-accent rounded-full inline-block"></span>
                {category}
              </h3>
              <span className="text-xs font-bold text-text-secondary bg-bg-primary px-3 py-1 rounded-full border border-border-theme">{catItems.length} Items</span>
            </div>
            
            <div className="divide-y divide-border-theme">
              {catItems.map((item, idx) => (
                <div key={item.id || item.name} className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center hover:bg-bg-primary/30 transition-colors">
                  <div className="flex-shrink-0 relative group">
                    <div className="w-20 h-20 bg-bg-primary rounded-2xl border border-border-theme overflow-hidden flex items-center justify-center shadow-inner">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-8 h-8 text-text-secondary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className={`text-lg font-bold truncate ${item.available === false ? 'text-text-secondary line-through' : 'text-text-primary'}`}>{item.name}</h4>
                      {item.available === false && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-danger/10 text-danger border border-danger/20">Out of Stock</span>
                      )}
                    </div>
                    {item.description && <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed mb-2 max-w-2xl">{item.description}</p>}
                    <p className="text-accent font-black text-lg font-mono">₹{item.price}</p>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-4 md:mt-0 w-full md:w-auto justify-end">
                    <button 
                      onClick={() => toggleAvailability(item)}
                      className={`px-4 py-2 text-sm font-bold rounded-xl transition-all border ${item.available !== false ? 'bg-bg-primary text-text-secondary border-border-theme hover:bg-bg-surface hover:text-danger' : 'bg-success/10 text-success border-success/20 hover:bg-success/20'}`}
                    >
                      {item.available !== false ? 'Mark Out of Stock' : 'Mark Available'}
                    </button>
                    <button 
                      onClick={() => handleOpenEdit(item)}
                      className="p-2 text-text-secondary hover:text-accent bg-bg-primary border border-border-theme rounded-xl transition-colors hover:border-accent/30"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id || item.name, !item.id)}
                      className="p-2 text-text-secondary hover:text-danger bg-bg-primary border border-border-theme rounded-xl transition-colors hover:border-danger/30"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {menuItems.length === 0 && (
        <div className="bg-bg-surface border border-border-theme rounded-3xl p-12 text-center shadow-sm">
          <div className="w-20 h-20 mx-auto bg-bg-primary border border-border-theme rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-text-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-2">No Menu Items Found</h3>
          <p className="text-text-secondary max-w-md mx-auto mb-6">Create a beautiful digital menu for your customers to order directly from the QR portal.</p>
          <button onClick={handleOpenAdd} className="bg-accent text-bg-primary px-6 py-3 rounded-xl font-bold shadow-lg hover:opacity-90 transition-opacity">
            Create First Item
          </button>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setIsAdding(false)}>
          <div className="bg-bg-card border border-border-theme rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border-theme flex justify-between items-center bg-bg-surface">
              <h3 className="text-xl font-bold text-text-primary">{editingItem ? 'Edit Item' : 'Add Menu Item'}</h3>
              <button onClick={() => setIsAdding(false)} className="text-text-secondary hover:text-text-primary bg-bg-primary p-2 rounded-full transition-colors border border-border-theme">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Item Name <span className="text-danger">*</span></label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-xl text-sm focus:border-accent outline-none text-text-primary font-medium" placeholder="e.g. French Fries" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Price (₹) <span className="text-danger">*</span></label>
                  <input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-xl text-sm focus:border-accent outline-none text-text-primary font-bold font-mono" placeholder="150" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Category <span className="text-danger">*</span></label>
                <div className="relative">
                  <input type="text" required list="categories" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-xl text-sm focus:border-accent outline-none text-text-primary font-medium" placeholder="e.g. Beverages" />
                  <datalist id="categories">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Description</label>
                <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-xl text-sm focus:border-accent outline-none resize-none text-text-primary leading-relaxed" placeholder="Short appetizing description..."></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Image URL</label>
                <input type="url" value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-xl text-sm focus:border-accent outline-none text-text-primary font-mono" placeholder="https://example.com/image.jpg" />
                {formData.image && (
                  <div className="mt-3 w-full h-32 bg-bg-primary rounded-xl border border-border-theme overflow-hidden">
                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input type="checkbox" id="available" checked={formData.available} onChange={e => setFormData({...formData, available: e.target.checked})} className="w-5 h-5 rounded border-border-theme text-accent focus:ring-accent accent-accent" />
                <label htmlFor="available" className="text-sm font-bold text-text-primary cursor-pointer">Item is Currently Available</label>
              </div>
            </form>

            <div className="p-6 border-t border-border-theme bg-bg-surface flex gap-3">
              <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-3.5 bg-bg-primary border border-border-theme text-text-primary font-bold rounded-xl hover:bg-bg-primary/80 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3.5 bg-accent text-bg-primary font-bold rounded-xl hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50 flex justify-center items-center gap-2">
                {saving ? 'Saving...' : (editingItem ? 'Update Item' : 'Save Item')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
