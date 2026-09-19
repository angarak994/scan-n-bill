const fs = require('fs');

// 1. Fix dashboard-data/route.ts
let dash = fs.readFileSync('src/app/api/dashboard-data/route.ts', 'utf8');
const oldDashLogic = `    const dailyRevenue = completedSessions.reduce((acc, session) => {
      if (session.amount_paid !== undefined && session.amount_paid !== null) {
        return acc + Number(session.amount_paid);
      }
      if (session.payment_status === 'Paid') {
        return acc + (session.cost || 0);
      }
      return acc;
    }, 0);`;
const newDashLogic = `    const dailyRevenue = completedSessions.reduce((acc, session) => {
      let paid = 0;
      if (session.payment_status === 'Paid') {
          paid = (session.amount_paid && session.amount_paid > 0) ? Number(session.amount_paid) : (session.cost || 0);
      } else {
          paid = (session.amount_paid && session.amount_paid > 0) ? Number(session.amount_paid) : 0;
      }
      return acc + paid;
    }, 0);`;
dash = dash.replace(oldDashLogic, newDashLogic);
fs.writeFileSync('src/app/api/dashboard-data/route.ts', dash);


// 2. Fix telegram-webhook/route.ts
let tele = fs.readFileSync('src/app/api/telegram-webhook/route.ts', 'utf8');
const oldTeleLogic = `          completedSessions.forEach(s => {
            totalRevenue += Number(s.cost) || 0;
          });`;
const newTeleLogic = `          completedSessions.forEach(s => {
            let paid = 0;
            if (s.payment_status === 'Paid') {
                paid = (s.amount_paid && s.amount_paid > 0) ? Number(s.amount_paid) : (s.cost || 0);
            } else {
                paid = (s.amount_paid && s.amount_paid > 0) ? Number(s.amount_paid) : 0;
            }
            totalRevenue += paid;
          });`;
tele = tele.replace(oldTeleLogic, newTeleLogic);
fs.writeFileSync('src/app/api/telegram-webhook/route.ts', tele);

console.log("Revenue logic updated.");
