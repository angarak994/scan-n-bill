'use client';

import React from 'react';
import ProductShowcase from './sections/ProductShowcase';
import SmartBilling from './sections/SmartBilling';
import PromotionEngine from './sections/PromotionEngine';
import TelegramDemo from './sections/TelegramDemo';
import QRJourney from './sections/QRJourney';
import MembersReports from './sections/MembersReports';
import PricingFAQ from './sections/PricingFAQ';
import WhyQControl from './sections/WhyQControl';
import BeforeAfter from './sections/BeforeAfter';
import BuiltForBilliards from './sections/BuiltForBilliards';
import Calculator from './sections/Calculator';
import ComparisonTable from './sections/ComparisonTable';

export default function StorySections() {
  return (
    <div className="bg-bg-base text-white transition-colors duration-200">
      <WhyQControl />
      <BeforeAfter />
      <ProductShowcase />
      <SmartBilling />
      <PromotionEngine />
      <TelegramDemo />
      <QRJourney />
      <BuiltForBilliards />
      <MembersReports />
      <ComparisonTable />
      <PricingFAQ />
      <Calculator />
    </div>
  );
}
