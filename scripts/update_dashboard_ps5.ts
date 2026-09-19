import * as fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

// The player selector should be conditional on manualGame
// We will replace the "Players" select to only render when manualGame === 'ps5'
const oldPlayersHTML = `<div>
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Players</label>
                      <CustomSelect 
                        value={manualPlayers} 
                        onChange={setManualPlayers} 
                        options={[
                          {value: '1', label: '1 Player'},
                          {value: '2', label: '2 Players'},
                          {value: '3', label: '3 Players'},
                          {value: '4', label: '4 Players'}
                        ]} 
                      />
                    </div>`;

const newPlayersHTML = `{manualGame === 'ps5' && (
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Players (PS5)</label>
                      <CustomSelect 
                        value={manualPlayers} 
                        onChange={setManualPlayers} 
                        options={[
                          {value: '1', label: '1 Player'},
                          {value: '2', label: '2 Players'},
                          {value: '3', label: '3 Players'},
                          {value: '4', label: '4 Players'}
                        ]} 
                      />
                    </div>
                    )}`;

// Wait, the grid cols might need adjusting if it's hidden, but grid-cols-2 will just leave an empty spot, which is fine or we can change grid structure.
// Instead of grid-cols-2, let's keep it as is, so if it's ps5 it shows players next to game type.
content = content.replace(oldPlayersHTML, newPlayersHTML);

// Ensure it applies to the second modal block as well if there are two (because we duplicated it in previous script)
// Wait, I used a replace earlier, so there are two places: one for Guest mode, one for normal mode.
// Actually, earlier I completely rewrote the modal, let's just do a global replace (with regex) ignoring whitespace to be safe, or just string replace twice.
content = content.split(oldPlayersHTML).join(newPlayersHTML);

fs.writeFileSync('src/app/dashboard/page.tsx', content);
console.log('Dashboard PS5 logic updated');
