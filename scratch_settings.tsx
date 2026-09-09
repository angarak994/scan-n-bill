  );

  const renderSettings = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
      <div className="lg:col-span-2 flex flex-col gap-8">
      {/* Game Categories & PS5 Management (Additive) */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
              Game Categories &amp; PS5 Support
            </h2>
            <p className="text-text-secondary text-xs sm:text-sm mt-1">
              Configure dynamic pricing, time slots, schedules, and multiplayer rules for all sports including PS5.
            </p>
          </div>
          {!data?.pricingRules?.rules?.['ps5'] ? (
            <button
              onClick={handleEnablePS5}
              disabled={isUpdatingConfig}
              className="px-5 py-3 bg-accent text-black font-extrabold text-xs sm:text-sm uppercase rounded-lg hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 shrink-0 min-h-[44px]"
            >
              + Enable PS5 Support
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-md text-xs font-bold font-mono tracking-widest border border-accent/50 text-accent bg-accent/10 uppercase shadow-sm">
              ✓ PS5 Natively Active
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Rule Configuration */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Configure Pricing Schedules &amp; Rates</h3>
            <div className="flex w-full overflow-x-auto custom-scrollbar p-1 bg-bg-surface border border-border-theme rounded-xl mb-4 gap-1 shadow-inner" role="tablist">
              {Object.keys(data?.pricingRules?.rules || {}).map(game => {
                const isActive = selectedGameRule === game;
                return (
                  <button
                    key={game}
                    onClick={() => setSelectedGameRule(game)}
                    className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold capitalize transition-all duration-200 outline-none whitespace-nowrap focus-visible:ring-2 focus-visible:ring-accent ${
                      isActive 
                        ? 'bg-accent/10 text-accent border border-accent/30 ring-1 ring-accent/50 shadow-sm' 
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary/50 border border-transparent'
                    }`}
                    aria-pressed={isActive}
                    role="tab"
                  >
                    {isActive && <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                    {!isActive && <span className="text-[14px] opacity-70"></span>}
                    <span>{game === 'ps5' ? 'PS5' : game}</span>
                  </button>
                );
              })}
            </div>

            {(() => {
              const currentRule = data?.pricingRules?.rules?.[selectedGameRule] || { type: 'fixed', rate: 200, multiplayer_mode: 'none' };
              return (
                <div className="p-5 rounded-xl border border-border-theme bg-bg-primary flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold capitalize font-mono text-accent">{selectedGameRule} Rule Configuration</span>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-text-secondary bg-bg-surface px-2 py-0.5 rounded border border-border-theme">Dynamic Engine</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Pricing Model</label>
                      <CustomSelect
                        value={currentRule.type || 'fixed'}
                        onChange={v => {
                          const updated = { ...currentRule, type: v };
                          const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                          handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                        }}
                        options={[
                          {value: "fixed", label: "Flat Rate (Fixed ₹/hr)"},
                          {value: "time_based", label: "Schedule / Time Slots (Day & Evening)"}
                        ]}
                        className="py-2.5 min-h-[40px] text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Multiplayer Mode</label>
                      <CustomSelect
                        value={currentRule.multiplayer_mode || 'none'}
                        onChange={v => {
                          const updated = { ...currentRule, multiplayer_mode: v };
                          const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                          handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                        }}
                        options={[
                          {value: "none", label: "Disabled (Single rate)"},
                          {value: "multiply", label: "Multiply Rate by Players"},
                          {value: "base_plus_extra", label: "Base Rate + Extra per Additional Player"}
                        ]}
                        className="py-2.5 min-h-[40px] text-xs font-bold"
                      />
                    </div>
                    {currentRule.type === 'fixed' ? (
                      <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Flat Rate (₹ / hr)</label>
                        <input
                          type="number"
                          defaultValue={currentRule.rate || 0}
                          onBlur={e => {
                            const val = Number(e.target.value) || 0;
                            if (val === currentRule.rate) return;
                            const updated = { ...currentRule, rate: val };
                            const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                            handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                          }}
                          className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Day Rate (₹ / hr)</label>
                          <input
                            type="number"
                            defaultValue={currentRule.day_rate || currentRule.am_rate || 0}
                            onBlur={e => {
                              const val = Number(e.target.value) || 0;
                              const updated = { ...currentRule, day_rate: val, am_rate: val };
                              const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                              handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                            }}
                            className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Evening/Peak Rate (₹ / hr)</label>
                          <input
                            type="number"
                            defaultValue={currentRule.evening_rate || currentRule.pm_rate || 0}
                            onBlur={e => {
                              const val = Number(e.target.value) || 0;
                              const updated = { ...currentRule, evening_rate: val, pm_rate: val };
                              const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                              handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                            }}
                            className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Opening Hour (24h format)</label>
                          <input
                            type="number" min="0" max="23"
                            defaultValue={currentRule.opening_hour ?? 6}
                            onBlur={e => {
                              const val = Number(e.target.value) || 0;
                              const updated = { ...currentRule, opening_hour: val };
                              const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                              handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                            }}
                            className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Cutoff Hour (Evening start, e.g. 16)</label>
                          <input
                            type="number" min="0" max="23"
                            defaultValue={currentRule.cutoff_hour ?? 16}
                            onBlur={e => {
                              const val = Number(e.target.value) || 0;
                              const updated = { ...currentRule, cutoff_hour: val };
                              const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                              handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                            }}
                            className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                          />
                        </div>
                      </>
                    )}
                    {currentRule.multiplayer_mode === 'base_plus_extra' && (
                      <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Extra Charge / Player (₹)</label>
                        <input
                          type="number"
                          defaultValue={currentRule.extra_per_player || 50}
                          onBlur={e => {
                            const val = Number(e.target.value) || 0;
                            const updated = { ...currentRule, extra_per_player: val };
                            const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                            handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                          }}
                          className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary italic mt-1">ℹ️ Changes save automatically when you click outside the input box.</p>
                </div>
              );
            })()}
          </div>

          {/* Station Management */}
          <div className="lg:col-span-5 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-border-theme pt-6 lg:pt-0 lg:pl-8">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Stations &amp; Tables</h3>
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
              {data?.tables?.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-primary border border-border-theme text-xs">
                  <div>
                    <span className="font-mono font-bold text-accent">{t.id}</span>
                    <span className="mx-2 text-text-secondary">•</span>
                    <span className="font-bold text-text-primary">{t.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold font-mono uppercase bg-bg-surface border border-border-theme text-primary">
                      {t.type}
                    </span>
                    <Tooltip text="Delete Station">
                      <button
                        type="button"
                        onClick={() => confirmDeleteStation(t)}
                        className="p-1 text-text-secondary hover:text-red-500 transition-colors bg-bg-surface border border-border-theme hover:border-red-500 rounded"
                        aria-label="Delete Station"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddStation} className="p-4 rounded-xl border border-border-theme bg-bg-primary/60 flex flex-col gap-3 mt-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Add New Station / Table</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="ID (e.g. PS5-1)"
                  required
                  value={newStationId}
                  onChange={e => setNewStationId(e.target.value.toUpperCase())}
                  className="px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                />
                <input
                  type="text"
                  placeholder="Name (PS5 Lounge)"
                  required
                  value={newStationName}
                  onChange={e => setNewStationName(e.target.value)}
                  className="px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                />
              </div>
              <CustomSelect
                value={newStationType}
                onChange={v => setNewStationType(v)}
                options={Object.keys(data?.pricingRules?.rules || { snooker: {}, pool: {}, ps5: {} }).map(type => ({ value: type, label: type.charAt(0).toUpperCase() + type.slice(1) }))}
                className="py-2 min-h-[40px] text-xs font-bold capitalize"
              />
              <button type="submit" disabled={isUpdatingConfig || !newStationId} className="w-full bg-accent text-black font-extrabold py-2.5 rounded-lg hover:bg-accent/90 transition-colors text-xs uppercase shadow-md shadow-accent/10 min-h-[42px]">
                {isUpdatingConfig ? 'Adding...' : '+ Create Station'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">
        <h2 className="text-2xl font-bold mb-6">Launch Promotion</h2>
        <form onSubmit={handleSavePromo} className="max-w-md flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Promotion Title <span className="text-danger">*</span></label>
            <input 
              type="text" 
              required
              value={promoTitle}
              onChange={e => setPromoTitle(e.target.value)}
              className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary"
              placeholder="e.g. Afternoon Elite"
              list="promo-suggestions"
            />
            <datalist id="promo-suggestions">
              <option value="Weekend Special" />
              <option value="Happy Hours" />
              <option value="Game Night" />
              <option value="Weekend Gaming Deal" />
              <option value="Early Bird Offer" />
              <option value="Student Special" />
              <option value="Festive Offer" />
              <option value="Loyalty Reward" />
              <option value="Evening Special" />
              <option value="Monthly Membership Offer" />
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Discount Percent (%) <span className="text-danger">*</span></label>
            <input 
              type="number" 
              required min="1" max="100"
              value={promoDiscount}
              onChange={e => setPromoDiscount(e.target.value)}
              className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Duration (Hours) <span className="text-danger">*</span></label>
            <input 
              type="number" 
              required min="1" max="72"
              value={promoDurationHours}
              onChange={e => setPromoDurationHours(e.target.value)}
              className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary"
            />
          </div>
          <div className="flex gap-4 mt-2">
            <button type="submit" disabled={isUpdatingPromo} className="flex-1 bg-accent text-white font-bold py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50">
              {isUpdatingPromo ? 'Saving...' : 'Launch Promo'}
            </button>
            {isPromoValid && (
              <button type="button" onClick={handleClearPromo} disabled={isUpdatingPromo} className="flex-1 bg-danger/10 text-danger border border-danger/30 font-bold py-3 rounded-lg hover:bg-danger/20 transition-colors disabled:opacity-50">
                End Early
              </button>
            )}
          </div>
        </form>
      </div>
      
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">
        <h2 className="text-2xl font-bold mb-6">Manual Table Discounts</h2>
        <form onSubmit={handleApplyDiscount} className="max-w-md flex flex-col gap-4">
          <CustomSelect 
            value={selectedTable}
            onChange={v => setSelectedTable(v)}
            placeholder="-- Select Table --"
            options={data.tables?.map(t => ({value: t.id, label: t.name})) || []}
            className="font-semibold"
          />
          <input 
            type="number" 
            min="1" max="100"
            value={discountPercent}
            onChange={e => setDiscountPercent(e.target.value)}
            className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary"
            placeholder="Discount %"
            required
          />
          <button type="submit" disabled={!selectedTable || isUpdatingDiscount} className="w-full bg-border-theme text-text-primary font-bold py-3 rounded-lg hover:bg-border-theme/80 transition-colors disabled:opacity-50 border border-border-theme">
            {isUpdatingDiscount ? 'Applying...' : 'Apply Manual Discount'}
          </button>
        </form>
        
        <div className="mt-6 flex flex-wrap gap-2">
          {Object.entries(data.activeDiscounts || {}).map(([tableId, discount]) => (
            <div key={tableId} className="flex items-center gap-2 bg-bg-surface px-3 py-1.5 rounded-lg border border-border-theme text-xs">
              <span className="font-bold text-accent">{tableId}</span> 
              <span className="text-text-secondary">| {discount.percent}% Off</span>
              <button onClick={() => handleRemoveDiscount(tableId)} className="ml-1 text-danger hover:text-danger/80">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
      

      {/* WhatsApp Integration Setting */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <svg className="w-6 h-6 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            WhatsApp Business Integration
          </h2>
          {data?.whatsapp_config?.enabled ? (
            <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-xs font-bold uppercase">Connected</span>
          ) : (
            <span className="px-3 py-1 bg-bg-surface text-text-secondary border border-border-theme rounded-full text-xs font-bold uppercase">Not Connected</span>
          )}
        </div>
        <p className="text-sm text-text-secondary mb-6 max-w-2xl">
          Connect your official WhatsApp Business number to send QKhata reminders, booking confirmations, and bulk promotions directly from your own business number.
        </p>

        {data?.whatsapp_config?.enabled ? (
          <div className="max-w-md p-6 bg-bg-primary border border-border-theme rounded-xl">
            <p className="text-sm font-semibold text-text-primary mb-4">Your WhatsApp Business account is successfully linked.</p>
            <button 
              onClick={async () => {
                if (confirm('Are you sure you want to disconnect WhatsApp? You will not be able to send reminders.')) {
                  try {
                    const res = await fetch('/api/update-whatsapp-config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'disconnect' })
                    });
                    if (res.ok) {
                      toast.success('WhatsApp disconnected.');
                      // fetchData removed for instant UI
                    }
                  } catch(e) { toast.error('Failed to disconnect.'); }
                }
              }}
              className="bg-danger/10 text-danger hover:bg-danger/20 font-bold py-2.5 px-6 rounded-lg transition-colors text-sm"
            >
              Disconnect WhatsApp
            </button>
          </div>
        ) : (
          <form className="max-w-md flex flex-col gap-4" onSubmit={async (e) => {
            e.preventDefault();
            setIsConnectingWa(true);
            try {
              const res = await fetch('/api/update-whatsapp-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'connect', phoneId: waPhoneId, token: waToken })
              });
              if (res.ok) {
                toast.success('WhatsApp connected successfully!');
                setWaPhoneId('');
                setWaToken('');
                // fetchData removed for instant UI
              } else {
                toast.error('Failed to connect. Please check credentials.');
              }
            } catch(e) {
              toast.error('An error occurred.');
            }
            setIsConnectingWa(false);
          }}>
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Phone Number ID <span className="text-danger">*</span></label>
              <input 
                type="text" 
                required
                value={waPhoneId}
                onChange={e => setWaPhoneId(e.target.value)}
                className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-sm text-text-primary font-mono"
                placeholder="e.g. 102345678912345"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Permanent Access Token <span className="text-danger">*</span></label>
              <input 
                type="password" 
                required
                value={waToken}
                onChange={e => setWaToken(e.target.value)}
                className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-sm text-text-primary font-mono"
                placeholder="EAAGm0..."
              />
              <p className="text-[11px] text-text-secondary mt-2">Find these in your Meta App Developer Dashboard under WhatsApp &gt; API Setup. <br/><a href="#" className="text-accent hover:underline">Read the setup guide</a></p>
            </div>
            <button type="submit" disabled={isConnectingWa} className="w-full mt-2 bg-accent text-black font-extrabold py-3 rounded-lg hover-lift hover:bg-accent/90 transition-colors">
              {isConnectingWa ? 'Connecting...' : 'Connect WhatsApp'}
            </button>
          </form>
        )}
      </div>

      {/* SMS Integration Setting */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            SMS Integration (DLT Compliant)
          </h2>
          {data?.sms_config?.enabled ? (
            <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-xs font-bold uppercase">Connected</span>
          ) : (
            <span className="px-3 py-1 bg-bg-surface text-text-secondary border border-border-theme rounded-full text-xs font-bold uppercase">Not Connected</span>
          )}
        </div>
        <p className="text-sm text-text-secondary mb-6 max-w-2xl">
          Connect an Indian DLT-compliant SMS provider (e.g. MSG91) to automatically send booking confirmations, QKhata reminders, and promotional bulk messages.
        </p>

        {data?.sms_config?.enabled ? (
          <div className="max-w-md p-6 bg-bg-primary border border-border-theme rounded-xl">
            <p className="text-sm font-semibold text-text-primary mb-2">Your SMS Provider is successfully linked.</p>
            <p className="text-xs text-text-secondary mb-4">Provider: {data.sms_config.provider.toUpperCase()} | Sender ID: {data.sms_config.senderId}</p>
            <button 
              onClick={async () => {
                if (confirm('Are you sure you want to disconnect your SMS provider?')) {
                  try {
                    const res = await fetch('/api/update-sms-config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'disconnect' })
                    });
                    if (res.ok) {
                      toast.success('SMS provider disconnected.');
                      // fetchData removed for instant UI
                    }
                  } catch(e) { toast.error('Failed to disconnect.'); }
                }
              }}
              className="bg-danger/10 text-danger hover:bg-danger/20 font-bold py-2.5 px-6 rounded-lg transition-colors text-sm"
            >
              Disconnect SMS
            </button>
          </div>
        ) : (
          <form className="max-w-md flex flex-col gap-4" onSubmit={async (e) => {
            e.preventDefault();
            setIsConnectingSms(true);
            try {
              const res = await fetch('/api/update-sms-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'connect', provider: smsProvider, authKey: smsAuthKey, senderId: smsSenderId })
              });
              if (res.ok) {
                toast.success('SMS connected successfully!');
                setSmsAuthKey('');
                setSmsSenderId('');
                // fetchData removed for instant UI
              } else {
                toast.error('Failed to connect. Please check credentials.');
              }
            } catch(e) {
              toast.error('An error occurred.');
            }
            setIsConnectingSms(false);
          }}>
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Provider <span className="text-danger">*</span></label>
              <select value={smsProvider} onChange={e => setSmsProvider(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-sm text-text-primary">
                <option value="msg91">MSG91</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Auth Key <span className="text-danger">*</span></label>
              <input 
                type="password" 
                required
                value={smsAuthKey}
                onChange={e => setSmsAuthKey(e.target.value)}
                className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-sm text-text-primary font-mono"
                placeholder="e.g. 421376xxxxxx"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Sender ID <span className="text-danger">*</span></label>
              <input 
                type="text" 
                required
                maxLength={6}
                value={smsSenderId}
                onChange={e => setSmsSenderId(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-sm text-text-primary font-mono uppercase"
                placeholder="e.g. QCONTL"
              />
              <p className="text-[11px] text-text-secondary mt-2">6-character DLT approved sender ID.</p>
            </div>
            <button type="submit" disabled={isConnectingSms} className="w-full mt-2 bg-accent text-black font-extrabold py-3 rounded-lg hover-lift hover:bg-accent/90 transition-colors">
              {isConnectingSms ? 'Connecting...' : 'Connect SMS'}
            </button>
          </form>
        )}
      </div>
      </div>
      <div className="lg:col-span-1 flex flex-col gap-6">

      <div className="bg-bg-card border border-border-theme rounded-xl p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-text-primary">
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          System Status
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">WhatsApp API</span>
            {data?.whatsapp_config?.enabled ? <span className="text-success font-bold text-xs bg-success/10 border border-success/20 px-2 py-1 rounded">Active</span> : <span className="text-text-disabled font-bold text-xs bg-bg-surface px-2 py-1 rounded border border-border-theme">Inactive</span>}
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">SMS DLT</span>
            {data?.sms_config?.enabled ? <span className="text-success font-bold text-xs bg-success/10 border border-success/20 px-2 py-1 rounded">Active</span> : <span className="text-text-disabled font-bold text-xs bg-bg-surface px-2 py-1 rounded border border-border-theme">Inactive</span>}
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">Telegram Bot</span>
            {telegramOwners.length > 0 ? <span className="text-success font-bold text-xs bg-success/10 border border-success/20 px-2 py-1 rounded">Active</span> : <span className="text-text-disabled font-bold text-xs bg-bg-surface px-2 py-1 rounded border border-border-theme">Inactive</span>}
          </div>
        </div>
      </div>
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">
        <h2 className="text-2xl font-bold mb-6">Business Goals</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!businessId) return;
          const formData = new FormData(e.currentTarget as HTMLFormElement);
          const goals = {
            daily_revenue: Number(formData.get('daily_revenue')),
            daily_sessions: Number(formData.get('daily_sessions'))
          };
          try {
            const res = await fetch('/api/update-goals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ business_id: businessId, goals })
            });
            if (res.ok) {
              // fetchData removed
        toast.success('✓ Settings updated.');
            }
          } catch(err) { toast.error("We couldn't complete your request. Please try again."); }
        }} className="max-w-md flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Daily Revenue Target (₹)</label>
            <input type="number" name="daily_revenue" defaultValue={data.goals?.daily_revenue || 0} className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-sm text-text-primary" />
          </div>
          <button type="submit" className="w-full mt-2 bg-accent text-white font-bold py-3 rounded-lg hover-lift hover:bg-accent/90 transition-colors">
            Save Goals
          </button>
        </form>
      </div>
      {/* Qpulse & QR Sections */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">
        <h2 className="text-2xl font-bold mb-6">Integrations & Insights</h2>
        <div className="border border-border-theme rounded-xl p-6 bg-bg-surface max-w-xl mb-6">
          <h3 className="text-lg font-bold mb-2">Qpulse Insights</h3>
          <p className="text-sm text-text-secondary mb-4">Receive motivational and business insights to stay on top of your game.</p>
          <div className="bg-bg-primary/50 p-4 rounded-xl border border-border-theme">
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const enabled = fd.get('enabled') === 'true';
              const frequency = fd.get('frequency') as string;
              try {
                toast.loading('Saving Qpulse settings...', { id: 'qpulse-save' });
                const res = await fetch('/api/update-business-config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    business_id: businessId,
                    qpulse_config: { enabled, frequency, last_shown_date: ((data as any)?.qpulse_config)?.last_shown_date || null }
                  })
                });
                if (!res.ok) throw new Error();
                toast.success('Qpulse settings updated!', { id: 'qpulse-save' });
                // fetchData removed for instant UI
              } catch {
                toast.error('Failed to update Qpulse settings.', { id: 'qpulse-save' });
              }
            }}>
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block mb-2">Qpulse Status</label>
                  <select name="enabled" defaultValue={((data as any)?.qpulse_config)?.enabled === false ? "false" : "true"} className="w-full bg-bg-surface border border-border-theme p-3 rounded-lg text-sm text-text-primary outline-none focus:border-accent transition-colors appearance-none font-medium">
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block mb-2">Frequency</label>
                  <select name="frequency" defaultValue={((data as any)?.qpulse_config)?.frequency || 'Every 3 days'} className="w-full bg-bg-surface border border-border-theme p-3 rounded-lg text-sm text-text-primary outline-none focus:border-accent transition-colors appearance-none font-medium">
                    <option value="Daily">Daily</option>
                    <option value="Every 3 days">Every 3 days</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Off">Off</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full mt-2 bg-accent text-white font-bold py-3 rounded-lg hover-lift hover:bg-accent/90 transition-colors">
                Save Qpulse
              </button>
            </form>
          </div>
        </div>
      </div>
      
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8 mt-8">
        <h2 className="text-2xl font-bold mb-6">Payment Collection</h2>
        <div className="border border-border-theme rounded-xl p-6 bg-bg-surface max-w-xl">
          <h3 className="text-lg font-bold mb-2">Business Payment QR</h3>
          <p className="text-sm text-text-secondary mb-4">Customers can scan this QR to pay your business directly via UPI. (Requires manual confirmation of payment)</p>
          
          {((data as any)?.payment_qr_config)?.enabled && ((data as any)?.payment_qr_config)?.qr_url ? (
            <div className="mb-6 flex flex-col items-center">
              <div className="w-48 h-48 bg-white rounded-xl p-2 mb-4 border border-border-theme shadow-sm relative group overflow-hidden">
                <img src={((data as any)?.payment_qr_config).qr_url} alt="Business QR" className="w-full h-full object-contain rounded-lg" />
              </div>
              <div className="flex gap-4">
                <label className="px-4 py-2 bg-accent/10 text-accent font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-accent/20 transition-colors cursor-pointer border border-accent/20">
                  Replace QR
                  <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !businessId) return;
                    const formData = new FormData();
                    formData.append('business_id', businessId);
                    formData.append('file', file);
                    formData.append('action', 'upload');
                    try {
                      toast.loading('Uploading...');
                      const res = await fetch('/api/upload-qr', { method: 'POST', body: formData });
                      toast.dismiss();
                      if (res.ok) { toast.success('QR replaced successfully.'); /* fetchData removed for instant UI */ }
                      else { toast.error('Failed to replace QR.'); }
                    } catch { toast.error('Error uploading QR.'); }
                  }} />
                </label>
                <button onClick={async () => {
                  if (!businessId) return;
                  if (!confirm('Are you sure you want to remove this QR code?')) return;
                  const formData = new FormData();
                  formData.append('business_id', businessId);
                  formData.append('action', 'remove');
                  try {
                    const res = await fetch('/api/upload-qr', { method: 'POST', body: formData });
                    if (res.ok) { toast.success('QR removed successfully.'); /* fetchData removed for instant UI */ }
                    else { toast.error('Failed to remove QR.'); }
                  } catch { toast.error('Error removing QR.'); }
                }} className="px-4 py-2 bg-danger/10 text-danger font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-danger/20 transition-colors border border-danger/20">
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-border-theme rounded-xl p-8 text-center bg-bg-primary/50 hover:bg-bg-primary transition-colors">
              <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              </div>
              <h4 className="text-sm font-bold text-text-primary mb-1">Upload QR Code</h4>
              <p className="text-xs text-text-secondary mb-4">PNG, JPG up to 5MB</p>
              <label className="px-6 py-3 bg-accent text-white font-bold text-sm rounded-lg hover-lift hover:bg-accent/90 transition-colors shadow-lg cursor-pointer inline-block">
                Select File
                <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !businessId) return;
                  const formData = new FormData();
                  formData.append('business_id', businessId);
                  formData.append('file', file);
                  formData.append('action', 'upload');
                  try {
                    toast.loading('Uploading...', { id: 'upload' });
                    const res = await fetch('/api/upload-qr', { method: 'POST', body: formData });
                    if (res.ok) { toast.success('QR uploaded successfully.', { id: 'upload' }); /* fetchData removed for instant UI */ }
                    else { toast.error('Failed to upload QR.', { id: 'upload' }); }
                  } catch { toast.error('Error uploading QR.', { id: 'upload' }); }
                }} />
              </label>
            </div>
          )}
        </div>
      </div>
      {/* Change PIN UI */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8 mt-8">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 mb-6 border-b border-border-theme pb-4">
          Security Settings
        </h2>
        <form onSubmit={handleChangePassword} className="max-w-md flex flex-col gap-4">
          {passwordError && <div className="text-danger text-sm font-bold bg-danger/10 p-3 rounded-lg border border-danger/20">{passwordError}</div>}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Current Admin PIN</label>
            <div className="relative">
              <input type={showCurrentPin ? "text" : "password"} maxLength={4} pattern="\d{4}" value={currentPassword} onChange={e => setCurrentPassword(e.target.value.replace(/\D/g, ''))} className="w-full pl-3 pr-10 py-2.5 bg-bg-surface border border-border-theme rounded-lg text-lg text-text-primary outline-none focus:border-accent font-mono tracking-[0.5em] placeholder-text-disabled placeholder:tracking-normal" placeholder="••••" required />
              <button type="button" onClick={() => setShowCurrentPin(!showCurrentPin)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary hover:text-text-primary transition-colors focus:outline-none">
                {showCurrentPin ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">New Admin PIN</label>
            <div className="relative">
              <input type={showNewPin ? "text" : "password"} maxLength={4} pattern="\d{4}" value={newPassword} onChange={e => setNewPassword(e.target.value.replace(/\D/g, ''))} className="w-full pl-3 pr-10 py-2.5 bg-bg-surface border border-border-theme rounded-lg text-lg text-text-primary outline-none focus:border-accent font-mono tracking-[0.5em] placeholder-text-disabled placeholder:tracking-normal" placeholder="••••" required />
              <button type="button" onClick={() => setShowNewPin(!showNewPin)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary hover:text-text-primary transition-colors focus:outline-none">
                {showNewPin ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            <p className="text-[10px] text-text-secondary mt-1">Must be exactly 4 digits.</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Confirm New PIN</label>
            <div className="relative">
              <input type={showConfirmPin ? "text" : "password"} maxLength={4} pattern="\d{4}" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value.replace(/\D/g, ''))} className="w-full pl-3 pr-10 py-2.5 bg-bg-surface border border-border-theme rounded-lg text-lg text-text-primary outline-none focus:border-accent font-mono tracking-[0.5em] placeholder-text-disabled placeholder:tracking-normal" placeholder="••••" required />
              <button type="button" onClick={() => setShowConfirmPin(!showConfirmPin)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary hover:text-text-primary transition-colors focus:outline-none">
                {showConfirmPin ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={isChangingPassword || newPassword.length !== 4} className="mt-2 px-5 py-3 bg-accent text-black font-extrabold text-sm uppercase rounded-lg hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20">
            {isChangingPassword ? 'Updating...' : 'Change PIN'}
          </button>
        </form>
      </div>
      {/* Smart Reminders & Telegram UI */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8 mt-8">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 mb-6 border-b border-border-theme pb-4">
          <span>🤖</span> Telegram & Smart Reminders
        </h2>
        
        <div className="flex flex-col lg:flex-row gap-8">
          <form onSubmit={handleUpdateTelegramSettings} className="flex-1 max-w-md flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Reminder Interval (Minutes)</label>
              <select value={reminderInterval} onChange={e => setReminderInterval(e.target.value)} className="w-full px-3 py-2.5 bg-bg-surface border border-border-theme rounded-lg text-sm text-text-primary outline-none focus:border-accent">
                <option value="0">Disabled / No Reminders</option>
                <option value="30">30 Minutes</option>
                <option value="45">45 Minutes</option>
                <option value="60">60 Minutes</option>
                <option value="90">90 Minutes</option>
                <option value="120">120 Minutes</option>
              </select>
              <p className="text-[10px] text-text-secondary mt-1">How long before an active session is flagged as overdue.</p>
            </div>
            <button type="submit" disabled={isUpdatingTelegram} className="mt-2 px-5 py-3 bg-accent text-black font-extrabold text-sm uppercase rounded-lg hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20">
              {isUpdatingTelegram ? 'Saving...' : 'Save Settings'}
            </button>
          </form>

          <div className="flex-1 max-w-md bg-bg-surface border border-border-theme rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              👥 Manage Telegram Owners
            </h3>
            
            <div className="space-y-3 mb-6">

              
              {telegramOwners.map((owner, idx) => {
                const isRevoked = owner.status === 'revoked';
                return (
                  <div key={idx} className={`flex justify-between items-center bg-bg-card p-3 rounded-lg border ${isRevoked ? 'border-error/30 opacity-75' : 'border-border-theme'}`}>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold flex items-center gap-2">
                        {owner.name} 
                        {owner.role === 'PRIMARY_OWNER' && <Tooltip text="Primary Owner"><span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-bold uppercase cursor-help">Primary</span></Tooltip>} 
                        {isRevoked ? (
                          <span className="text-[10px] bg-error/10 text-error px-1.5 py-0.5 rounded font-bold uppercase">🔴 Revoked</span>
                        ) : (
                          <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded font-bold uppercase">🟢 Granted</span>
                        )}
                      </span>
                      <span className="text-xs text-text-secondary font-mono">{owner.chatId}</span>
                      {owner.addedAt && <span className="text-[10px] text-text-secondary mt-1">Added: {new Date(owner.addedAt).toLocaleDateString()}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isRevoked ? (
                        <button onClick={() => handleToggleTelegramOwnerAccess(owner.chatId, owner.status || 'granted')} className="text-xs font-bold text-success hover:bg-success/10 px-3 py-1.5 rounded transition-colors">
                          🔓 Grant Access
                        </button>
                      ) : (
                        <button onClick={() => handleToggleTelegramOwnerAccess(owner.chatId, owner.status || 'granted')} className="text-xs font-bold text-error hover:bg-error/10 px-3 py-1.5 rounded transition-colors">
                          Revoke Access
                        </button>
                      )}
                      <Tooltip text="Permanently Delete Owner">
                        <button
                          onClick={() => handlePermanentDeleteOwner(owner.chatId)}
                          className="p-1.5 text-text-secondary hover:text-red-500 transition-colors bg-bg-surface border border-border-theme hover:border-red-500 rounded"
                          aria-label="Permanently Delete Owner"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
              
              {telegramOwners.length === 0 && (
                <div className="text-sm text-text-secondary italic">No authorized Telegram owners yet.</div>
              )}
            </div>

            <div className="border-t border-border-theme pt-4">
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => handleGenerateTelegramLink('PRIMARY_OWNER')} 
                  disabled={generatingLinkRole === 'PRIMARY_OWNER'}
                  className="w-full px-4 py-2 bg-accent/10 text-accent font-bold text-sm uppercase rounded-lg hover:bg-accent/20 transition-colors border border-accent/30 flex items-center justify-center gap-2"
                >
                  {generatingLinkRole === 'PRIMARY_OWNER' ? 'Generating...' : 'Connect as Primary Owner'}
                </button>
                <button 
                  onClick={() => handleGenerateTelegramLink('SECONDARY_OWNER')} 
                  disabled={generatingLinkRole === 'SECONDARY_OWNER'}
                  className="w-full px-4 py-2 bg-blue-500/10 text-blue-400 font-bold text-sm uppercase rounded-lg hover:bg-blue-500/20 transition-colors border border-blue-500/30 flex items-center justify-center gap-2"
                >
                  {generatingLinkRole === 'SECONDARY_OWNER' ? 'Generating...' : '🔗 Link Secondary Owner'}
                </button>
              </div>
              
              {telegramInviteLink && (
                <div className="mt-3 p-3 bg-bg-card border border-accent/30 rounded-lg">
                  <p className="text-[10px] text-text-secondary mb-2">Share this link securely with the new owner:</p>
                  <div className="flex gap-2">
                    <input type="text" readOnly value={telegramInviteLink} className="w-full text-xs font-mono bg-bg-surface p-2 rounded outline-none text-accent" />
                    <button 
                      onClick={() => navigator.clipboard.writeText(telegramInviteLink)}
                      className="px-3 py-2 bg-accent/10 text-accent font-bold text-xs uppercase rounded hover:bg-accent/20 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
