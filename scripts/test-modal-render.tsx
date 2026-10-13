import React from 'react';
import ReactDOMServer from 'react-dom/server';
import SessionCompletionModal, { EndSessionModalData } from '../src/app/dashboard/SessionCompletionModal';

console.log('\n=== TESTING SESSION COMPLETION MODAL JSX RENDERING ===\n');

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

const formatINR = (val: number) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

// Scenario 1: Standard Active Session with Base Fee, Food Cost, and Promotion Discount
const mockData1: EndSessionModalData = {
  session: {
    id: 'sess-1',
    table_id: 'P1',
    customer_name: 'Rahul Sharma',
    member_id: 'mem-101',
    game_type: 'pool',
    start_time: new Date(Date.now() - 3600000).toISOString()
  },
  cost: 450,
  duration: '1 hr 15 min',
  breakdown: {
    baseTableCost: 400,
    foodCost: 150,
    discountAmount: 100,
    discountLabel: 'Happy Hours (20% Off)',
    appliedRateName: 'pool'
  }
};

const customerPhoneMap = new Map([
  ['9876543210', { id: 'cust-1', name: 'Rahul Sharma', phone: '9876543210', outstanding_balance: 350, is_member: true }]
]);
const membershipMap = new Map([
  ['mem-101', { id: 'mem-101', name: 'Rahul Sharma', mobile: '9876543210', tier: 'VIP' }]
]);

const html1 = ReactDOMServer.renderToString(
  <SessionCompletionModal
    isOpen={true}
    data={mockData1}
    customerByPhoneMap={customerPhoneMap}
    membershipByIdMap={membershipMap}
    onClose={() => {}}
    onConfirm={async () => true}
    formatINR={formatINR}
  />
);

assert(html1.includes('P1'), 'Table P1 rendered in header badge');
assert(html1.includes('Rahul Sharma'), 'Customer name rendered');
assert(html1.includes('VIP'), 'Member VIP tier rendered');
assert(html1.includes('Dues:'), 'Outstanding QKhata dues rendered');
assert(html1.includes('Happy Hours (20% Off)'), 'Discount label correctly rendered');
assert(!html1.includes('Discount: None'), 'Misleading "Discount: None" NEVER present');
assert(html1.includes('Total Payable'), 'Total Payable label rendered');
assert(html1.includes('₹450'), 'Payable amount ₹450 rendered');
assert(html1.includes('Collect Payment Now'), 'Pay Now toggle rendered for member');
assert(html1.includes('Add to QKhata (Credit)'), 'QKhata credit toggle rendered for member');

// Scenario 2: Walk-In / Guest with promo discount and NO table discount (the bug condition!)
const mockData2: EndSessionModalData = {
  session: {
    id: 'sess-2',
    table_id: 'S1',
    customer_name: 'Guest Walk-in',
    game_type: 'snooker',
    start_time: new Date(Date.now() - 1800000).toISOString()
  },
  cost: 220,
  duration: '35 min',
  breakdown: {
    baseTableCost: 280,
    foodCost: 0,
    discountAmount: 60,
    discountLabel: 'None', // BUGGY INPUT FROM BACKEND
    appliedRateName: 'snooker (Evening Peak)'
  }
};

const html2 = ReactDOMServer.renderToString(
  <SessionCompletionModal
    isOpen={true}
    data={mockData2}
    customerByPhoneMap={new Map()}
    membershipByIdMap={new Map()}
    onClose={() => {}}
    onConfirm={async () => true}
    formatINR={formatINR}
  />
);

assert(html2.includes('S1'), 'Table S1 rendered');
assert(html2.includes('Guest Walk-in'), 'Guest name rendered');
assert(!html2.includes('Add to QKhata (Credit)'), 'Walk-in cannot access QKhata toggle directly');
assert(html2.includes('₹60') && html2.includes('-'), 'Discount amount ₹60 rendered with minus');
assert(!html2.includes('>None<'), 'Fallback resolves label away from "None"');
assert(html2.includes('snooker (Evening Peak)'), 'Resolved label uses rate name instead of "None"');

// Scenario 3: Closed Modal returns empty string
const htmlClosed = ReactDOMServer.renderToString(
  <SessionCompletionModal
    isOpen={false}
    data={mockData1}
    onClose={() => {}}
    onConfirm={async () => true}
    formatINR={formatINR}
  />
);
assert(htmlClosed === '', 'Closed modal renders empty string');

console.log('\n======================================================');
console.log('🎉 ALL MODAL REACT SSR RENDER TESTS PASSED!');
console.log('======================================================\n');
